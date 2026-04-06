import { getUserId } from '@/app/lib/api-utils';
import { NextResponse } from 'next/server';
import { getTransactions, getCategories, getMsiPlans, getRecurringPayments } from '@/app/lib/db';
import { getLocalLLMClient, getLocalLLMModel, buildIndividualNarrativePrompt } from '@/app/lib/ai-utils';

export const maxDuration = 60;

const CACHE_TYPE = 'AI_NARRATIVE';
const TTL_HOURS  = 24;

// GET /api/dashboard/ai-summary?month=YYYY-MM
export async function GET(request: Request) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const month   = searchParams.get('month') || new Date().toISOString().slice(0, 7);
    const forceRefresh = searchParams.get('refresh') === '1';   // ← Regenerar button
    const [year, mon] = month.split('-').map(Number);
    const fromDate = `${year}-${String(mon).padStart(2, '0')}-01`;
    const toDate   = `${year}-${String(mon).padStart(2, '0')}-31`;

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require('better-sqlite3');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path');
    const dbPath = (process.env.DATABASE_URL ?? '').replace('file:', '') ||
        path.join(process.cwd(), 'prisma', 'finanzas.db');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db: any = Database(dbPath);
    const now = new Date();

    // 1. Caché en Notification (se salta si el usuario pide regenerar)
    const cacheKey = `${CACHE_TYPE}:${month}`;

    if (!forceRefresh) {
        const cached = db.prepare(
            `SELECT data FROM Notification WHERE userId=? AND type=? AND title=? ORDER BY createdAt DESC LIMIT 1`
        ).get(userId, CACHE_TYPE, cacheKey);

        if (cached?.data) {
            try {
                const parsed = JSON.parse(cached.data);
                if (parsed.expireAt && new Date(parsed.expireAt) > now) {
                    return NextResponse.json({ narrative: parsed.narrative, cached: true });
                }
            } catch { /* regenerar */ }
        }
    }
    // Si forceRefresh=true, borramos el caché antiguo para que se reescriba después
    if (forceRefresh) {
        db.prepare(`DELETE FROM Notification WHERE userId=? AND type=? AND title=?`)
          .run(userId, CACHE_TYPE, cacheKey);
    }


    try {
        const [{ transactions: txs }, categories, msiPlans, recurringPayments] = await Promise.all([
            getTransactions(userId, { limit: 500, fromDate, toDate }),
            getCategories(userId),
            getMsiPlans(userId),
            getRecurringPayments(userId),
        ]);

        const catMap = new Map(categories.map(c => [c.id, c.name]));

        let income = 0, expenses = 0;
        const byCat: Record<string, number> = {};
        for (const tx of txs) {
            const amt = Number(tx.amount) || 0;
            if (tx.type === 'INCOME') income += amt;
            else if ((tx.type === 'EXPENSE' || tx.type === 'MSI_CHARGE') && !tx.isParent) {
                expenses += amt;
                if (tx.categoryId) byCat[tx.categoryId] = (byCat[tx.categoryId] || 0) + amt;
            }
        }

        const topCats = Object.entries(byCat)
            .map(([id, amt]) => `${catMap.get(id) ?? 'Sin categoría'}: $${amt.toFixed(2)}`)
            .sort((a, b) => {
                const aAmt = parseFloat(a.split('$')[1]);
                const bAmt = parseFloat(b.split('$')[1]);
                return bAmt - aAmt;
            })
            .slice(0, 3)
            .join(', ');

        const activeMsi  = msiPlans.filter(p => p.status === 'ACTIVE');
        const activeSubs = recurringPayments.filter(r => r.status === 'ACTIVE');
        const monthName  = new Date(year, mon - 1, 1).toLocaleString('es-MX', { month: 'long', year: 'numeric' });

        const dataContext = [
            `Mes: ${monthName}`,
            `Ingresos del mes: $${income.toFixed(2)} MXN`,
            `Gastos del mes: $${expenses.toFixed(2)} MXN`,
            `Flujo de caja: $${(income - expenses).toFixed(2)} MXN (${income >= expenses ? 'superávit' : 'déficit'})`,
            `Top categorías de gasto: ${topCats || 'Sin gastos categorized'}`,
            `Planes MSI activos: ${activeMsi.length} por $${activeMsi.reduce((s, p) => s + Number(p.monthlyAmount), 0).toFixed(2)}/mes`,
            `Suscripciones activas: ${activeSubs.length} por $${activeSubs.reduce((s, r) => s + Number(r.amount), 0).toFixed(2)}/mes`,
        ].join('\n');

        const client   = getLocalLLMClient();
        const model    = getLocalLLMModel();
        const llmResp = await client.chat.completions.create({
            model,
            temperature: 0.35,
            max_tokens:  160,           // Reducido: el prompt pide 60-130 palabras
            messages: [
                { role: 'system', content: buildIndividualNarrativePrompt() },
                // /no_think desactiva el modo thinking de Qwen3 → respuesta más rápida
                { role: 'user',   content: `Datos:\n${dataContext}\n\nEscribe el párrafo narrativo ahora: /no_think` },
            ],
        });

        const rawNarrative = llmResp.choices[0]?.message?.content?.trim() ||
            `En ${monthName}, tus ingresos fueron $${income.toFixed(2)} y tus gastos $${expenses.toFixed(2)} MXN.`;

        // Limpiar bloques <think>…</think> del modelo reasoning (qwen, deepseek, etc.)
        // Maneja tanto tags cerrados como tags abiertos sin cerrar (modelo truncado)
        const narrative = rawNarrative
            .replace(/<think>[\s\S]*?<\/think>/gi, '')  // cerrado normal
            .replace(/<think>[\s\S]*/gi, '')              // abierto sin cerrar
            .replace(/\n{3,}/g, '\n\n')
            .trim();

        // Cachear en Notification
        const expireAt = new Date(now.getTime() + TTL_HOURS * 3600 * 1000).toISOString();
        db.prepare(`DELETE FROM Notification WHERE userId=? AND type=? AND title=?`).run(userId, CACHE_TYPE, cacheKey);
        db.prepare(
            `INSERT INTO Notification (id, userId, type, title, body, data, createdAt)
             VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, datetime('now'))`
        ).run(userId, CACHE_TYPE, cacheKey, narrative.slice(0, 500), JSON.stringify({ narrative, expireAt }));

        return NextResponse.json({ narrative, cached: false });
    } catch (error) {
        console.error('[ai-summary] Error:', error);
        const monthName = new Date(year, mon - 1, 1).toLocaleString('es-MX', { month: 'long' });
        return NextResponse.json({
            narrative: `No se pudo generar el resumen de ${monthName}. Verifica que Ollama esté activo.`,
            cached: false,
        });
    }
}
