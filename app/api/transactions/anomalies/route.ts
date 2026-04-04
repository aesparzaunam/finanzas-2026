import { getUserId } from '@/app/lib/api-utils';
import { NextResponse } from 'next/server';

export const maxDuration = 60;

// ── Tipos ────────────────────────────────────────────────────────────────────

interface AnomalyResult {
    txId:        string;
    description: string;
    amount:      number;
    date:        string;
    categoryId:  string | null;
    categoryName:string;
    mean:        number;
    stdDev:      number;
    zscore:      number;
    severity:    'HIGH' | 'MEDIUM';
    explanation: string;
}

// GET /api/transactions/anomalies?month=YYYY-MM
// Detecta transacciones cuyo monto está ≥ 2σ por encima de la media de su categoría
// usando los últimos 6 meses como historial de referencia.
export async function GET(request: Request) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const month   = searchParams.get('month') || new Date().toISOString().slice(0, 7);
    const [year, mon] = month.split('-').map(Number);

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require('better-sqlite3');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path');
    const dbPath = (process.env.DATABASE_URL ?? '').replace('file:', '') ||
        path.join(process.cwd(), 'prisma', 'finanzas.db');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db: any = Database(dbPath);

    // Rango del mes consultado
    const fromDate = `${year}-${String(mon).padStart(2, '0')}-01`;
    const toDate   = `${year}-${String(mon).padStart(2, '0')}-31`;

    // Últimos 6 meses para historial estadístico (excluyendo el mes consultado)
    const histStart = new Date(year, mon - 7, 1).toISOString().slice(0, 10);
    const histEnd   = new Date(year, mon - 1, 0).toISOString().slice(0, 10);

    try {
        // ── 1. Estadísticas por categoría (6 meses de historial) ──────────────
        const histStats: { categoryId: string; mean: number; variance: number; count: number }[] = db.prepare(`
            SELECT
                categoryId,
                AVG(amount)                                                      AS mean,
                AVG(amount * amount) - AVG(amount) * AVG(amount)                AS variance,
                COUNT(*)                                                         AS count
            FROM NTransaction
            WHERE userId      = ?
              AND categoryId  IS NOT NULL
              AND type        IN ('EXPENSE', 'MSI_CHARGE')
              AND isParent    = 0
              AND deletedAt   IS NULL
              AND date        >= ?
              AND date        <= ?
            GROUP BY categoryId
            HAVING COUNT(*) >= 3
        `).all(userId, histStart, histEnd);

        // Necesitamos al menos 3 tx por categoría para calcular σ significativo
        const statsMap = new Map<string, { mean: number; stdDev: number }>();
        for (const s of histStats) {
            const variance = Math.max(0, Number(s.variance));
            const stdDev   = Math.sqrt(variance);
            if (stdDev > 0) {
                statsMap.set(s.categoryId, { mean: Number(s.mean), stdDev });
            }
        }

        if (statsMap.size === 0) {
            return NextResponse.json({ anomalies: [], message: 'Datos históricos insuficientes (mínimo 3 meses).' });
        }

        // ── 2. Transacciones del mes actual ────────────────────────────────────
        const txsOfMonth: {
            id: string; description: string; amount: number;
            date: string; categoryId: string | null;
            catName: string | null; catIcon: string | null;
        }[] = db.prepare(`
            SELECT
                t.id, t.description, t.amount, t.date, t.categoryId,
                c.name AS catName, c.icon AS catIcon
            FROM NTransaction t
            LEFT JOIN Category c ON c.id = t.categoryId
            WHERE t.userId    = ?
              AND t.type      IN ('EXPENSE', 'MSI_CHARGE')
              AND t.isParent  = 0
              AND t.deletedAt IS NULL
              AND t.date      >= ?
              AND t.date      <= ?
        `).all(userId, fromDate, toDate);

        // ── 3. Detectar anomalías (z-score ≥ 2) ───────────────────────────────
        const candidates: (AnomalyResult & { rawZscore: number })[] = [];

        for (const tx of txsOfMonth) {
            if (!tx.categoryId) continue;
            const stats = statsMap.get(tx.categoryId);
            if (!stats) continue;

            const zscore = (Number(tx.amount) - stats.mean) / stats.stdDev;
            if (zscore >= 2.0) {
                candidates.push({
                    txId:        tx.id,
                    description: tx.description || '(sin descripción)',
                    amount:      Number(tx.amount),
                    date:        tx.date,
                    categoryId:  tx.categoryId,
                    categoryName:tx.catName ?? 'Sin categoría',
                    mean:        Math.round(stats.mean * 100) / 100,
                    stdDev:      Math.round(stats.stdDev * 100) / 100,
                    zscore:      Math.round(zscore * 100) / 100,
                    severity:    zscore >= 3.0 ? 'HIGH' : 'MEDIUM',
                    rawZscore:   zscore,
                    explanation: '', // se llenará con Ollama
                });
            }
        }

        if (candidates.length === 0) {
            return NextResponse.json({ anomalies: [], message: 'No se detectaron gastos inusuales este mes. ¡Bien hecho!' });
        }

        // ── 4. Llamar a Ollama para generar explicaciones ─────────────────────
        // Máximo 8 anomalías para no saturar el modelo
        const top = candidates.sort((a, b) => b.rawZscore - a.rawZscore).slice(0, 8);

        const { getLocalLLMClient, getLocalLLMModel } = await import('@/app/lib/ai-utils');
        const client = getLocalLLMClient();
        const model  = getLocalLLMModel();

        const txList = top.map((t, i) =>
            `${i + 1}. "${t.description}" | $${t.amount.toFixed(2)} | Promedio histórico: $${t.mean.toFixed(2)} | Categoría: ${t.categoryName}`
        ).join('\n');

        const response = await client.chat.completions.create({
            model,
            temperature: 0.15,
            max_tokens:  600,
            response_format: { type: 'json_object' },
            messages: [
                {
                    role: 'system',
                    content: `Eres un detector de gastos inusuales en una app de finanzas personales mexicana.
Para cada transacción anómala proporcionada, escribe UNA oración natural (máx 15 palabras) que alerte al usuario de forma amigable.
Usa el monto real y el promedio histórico para contextualizar.
Tono amigable, no alarmante. No uses jerga técnica. Usa pesos mexicanos ($).
Devuelve SOLO JSON: {"explanations": ["oración 1", "oración 2", ...]} (mismo orden que la lista de entrada).`,
                },
                {
                    role: 'user',
                    content: `Genera una explicación para cada transacción:\n${txList}`,
                },
            ],
        });

        let explanations: string[] = [];
        try {
            const raw = response.choices[0]?.message?.content ?? '{}';
            explanations = JSON.parse(raw).explanations ?? [];
        } catch { /* fallback a mensajes genéricos */ }

        const anomalies: AnomalyResult[] = top.map((t, i) => ({
            txId:        t.txId,
            description: t.description,
            amount:      t.amount,
            date:        t.date,
            categoryId:  t.categoryId,
            categoryName:t.categoryName,
            mean:        t.mean,
            stdDev:      t.stdDev,
            zscore:      t.zscore,
            severity:    t.severity,
            explanation: explanations[i] || `Este gasto de $${t.amount.toFixed(0)} está muy por encima de tu promedio habitual de $${t.mean.toFixed(0)}.`,
        }));

        return NextResponse.json({ anomalies, scannedMonth: month });
    } catch (error) {
        console.error('[anomalies] Error:', error);
        return NextResponse.json({ error: 'Error al detectar anomalías', anomalies: [] }, { status: 500 });
    }
}
