import { getUserId } from '@/app/lib/api-utils';
import { NextResponse } from 'next/server';
import { getLocalLLMClient, getLocalLLMModel } from '@/app/lib/ai-utils';

export const maxDuration = 90;

// POST /api/budgets/ai-suggest
// Body: { categoryIds?: string[] }  → vacío = sugerir para todas las categorías SIN presupuesto
export async function POST(request: Request) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const requestedCatIds: string[] | undefined = body.categoryIds;

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require('better-sqlite3');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path');
    const dbPath = (process.env.DATABASE_URL ?? '').replace('file:', '') ||
        path.join(process.cwd(), 'prisma', 'finanzas.db');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db: any = Database(dbPath);

    const now   = new Date();
    // Últimos 3 meses de historial
    const hist3Start = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().slice(0, 10);
    const hist3End   = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);

    try {
        // ── 1. Promedio mensual por categoría (3 meses) ───────────────────────
        const histData: {
            categoryId: string; catName: string; catIcon: string;
            monthlyAvg: number; monthCount: number; isFixed: number;
        }[] = db.prepare(`
            SELECT
                t.categoryId,
                c.name                              AS catName,
                c.icon                              AS catIcon,
                AVG(monthly_totals.monthly_sum)     AS monthlyAvg,
                COUNT(DISTINCT monthly_totals.month)AS monthCount,
                CASE WHEN c.name LIKE '%Servicios%'
                          OR c.name LIKE '%Suscripci%'
                          OR c.name LIKE '%Internet%'
                          OR c.name LIKE '%Celular%'
                          OR c.name LIKE '%Renta%'
                     THEN 1 ELSE 0 END              AS isFixed
            FROM (
                SELECT
                    substr(date, 1, 7)  AS month,
                    categoryId,
                    SUM(amount)         AS monthly_sum
                FROM NTransaction
                WHERE userId    = ?
                  AND type      IN ('EXPENSE', 'MSI_CHARGE')
                  AND isParent  = 0
                  AND deletedAt IS NULL
                  AND date      >= ?
                  AND date      <= ?
                  AND categoryId IS NOT NULL
                GROUP BY substr(date, 1, 7), categoryId
            ) AS monthly_totals
            JOIN Category c ON c.id = monthly_totals.categoryId
            WHERE c.userId = ?
            GROUP BY monthly_totals.categoryId
            HAVING COUNT(DISTINCT monthly_totals.month) >= 1
        `).all(userId, hist3Start, hist3End, userId);

        if (histData.length === 0) {
            return NextResponse.json({
                suggestions: [],
                message: 'No hay suficiente historial (mínimo 1 mes de transacciones) para generar sugerencias.',
            });
        }

        // ── 2. Filtrar: si requestedCatIds especificado, usar solo esos; sino todos ──
        const filtered = requestedCatIds && requestedCatIds.length > 0
            ? histData.filter(h => requestedCatIds.includes(h.categoryId))
            : histData;

        if (filtered.length === 0) {
            return NextResponse.json({ suggestions: [], message: 'No se encontraron datos para las categorías solicitadas.' });
        }

        // ── 3. Presupuestos existentes para contexto ───────────────────────────
        const existingBudgets: { categoryId: string; amount: number }[] = db.prepare(
            `SELECT categoryId, amount FROM Budget WHERE userId = ?`
        ).all(userId);
        const budgetMap = new Map(existingBudgets.map(b => [b.categoryId, Number(b.amount)]));

        // ── 4. Preparar contexto para Ollama ───────────────────────────────────
        const catLines = filtered.map((h, i) => {
            const avg      = Math.round(h.monthlyAvg * 100) / 100;
            const existing = budgetMap.get(h.categoryId);
            const budgetStr = existing ? ` (presupuesto actual: $${existing.toFixed(0)})` : ' (sin presupuesto)';
            const fixedStr  = h.isFixed ? ' [FIJA]' : ' [VARIABLE]';
            return `${i + 1}. ${h.catName}${fixedStr}: promedio $${avg.toFixed(2)}/mes en ${h.monthCount} mes(es)${budgetStr}`;
        }).join('\n');

        const client = getLocalLLMClient();
        const model  = getLocalLLMModel();

        const response = await client.chat.completions.create({
            model,
            temperature: 0.2,
            max_tokens:  900,
            response_format: { type: 'json_object' },
            messages: [
                {
                    role: 'system',
                    content: `Eres un planificador financiero personal para usuarios mexicanos.
Tu tarea: sugerir un presupuesto mensual REALISTA para cada categoría basándote en el historial.

## REGLAS DE CÁLCULO
- Categorías FIJAS (servicios, suscripciones, renta, internet): usa exactamente el promedio histórico.
- Categorías VARIABLES (supermercado, restaurantes, entretenimiento, compras): agrega 10-15% sobre el promedio.
- Redondea al múltiplo de 50 más cercano (ej: $1,337 → $1,350 | $892 → $900).
- Si el presupuesto actual ya existe y está cerca (±20%) del óptimo, sugiere mantenerlo.
- Si el presupuesto actual es muy alto (>40% sobre el promedio), sugiere reducirlo.

## FORMATO DE RESPUESTA
Devuelve SOLO JSON:
{
  "suggestions": [
    {
      "categoryId": "...",
      "categoryName": "...",
      "suggestedAmount": 1500,
      "currentAmount": 2000,
      "reasoning": "Basado en 3 meses de historial..."
    }
  ]
}`,
                },
                {
                    role: 'user',
                    content: `Categorías con historial:\n${catLines}\n\nGenera sugerencias para estas ${filtered.length} categorías.`,
                },
            ],
        });

        const raw = response.choices[0]?.message?.content ?? '{}';
        let aiSuggestions: { categoryId: string; categoryName: string; suggestedAmount: number; currentAmount?: number; reasoning: string }[] = [];

        try {
            const parsed   = JSON.parse(raw);
            aiSuggestions  = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];
        } catch { /* fallback */ }

        // ── 5. Enriquecer con IDs correctos si el modelo los mezcló ───────────
        // El LLM a veces inventa IDs; forzamos que los IDs vengan del historial real
        const enriched = filtered.map((h, i) => {
            const ai = aiSuggestions[i] || aiSuggestions.find(s => s.categoryName === h.catName);
            const suggested = ai?.suggestedAmount || Math.round((h.monthlyAvg * (h.isFixed ? 1 : 1.12)) / 50) * 50;
            return {
                categoryId:      h.categoryId,
                categoryName:    h.catName,
                categoryIcon:    h.catIcon || 'tag',
                monthlyAvg:      Math.round(h.monthlyAvg * 100) / 100,
                monthCount:      h.monthCount,
                suggestedAmount: suggested,
                currentAmount:   budgetMap.get(h.categoryId) || null,
                isFixed:         h.isFixed === 1,
                reasoning:       ai?.reasoning || `Promedio histórico de $${h.monthlyAvg.toFixed(0)}/mes en ${h.monthCount} mes(es).`,
            };
        });

        return NextResponse.json({ suggestions: enriched, totalCategories: enriched.length });
    } catch (error) {
        console.error('[budgets/ai-suggest] Error:', error);
        return NextResponse.json({ error: 'Error al generar sugerencias', suggestions: [] }, { status: 500 });
    }
}
