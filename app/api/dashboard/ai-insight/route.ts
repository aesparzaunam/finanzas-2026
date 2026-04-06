import { getUserId } from '@/app/lib/api-utils';
import { NextResponse } from 'next/server';
import { getAccounts, getMsiPlans, getRecurringPayments, getBudgets, getCategories } from '@/app/lib/db';
import { generateMonthlyInsight, AiInsight } from '@/app/lib/ai-utils';

export const maxDuration = 60;

// Clave de caché en tabla Notification: type='AI_INSIGHT', data=JSON con insight+expireAt
const CACHE_TYPE = 'AI_INSIGHT';
const TTL_HOURS  = 24;

// GET /api/dashboard/ai-insight
export async function GET() {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require('better-sqlite3');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path');
    const dbPath = (process.env.DATABASE_URL ?? '').replace('file:', '') ||
        path.join(process.cwd(), 'prisma', 'finanzas.db');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db: any = Database(dbPath);

    const now   = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // 1. Revisar caché en Notification
    const cached = db.prepare(
        `SELECT data FROM Notification WHERE userId=? AND type=? ORDER BY createdAt DESC LIMIT 1`
    ).get(userId, CACHE_TYPE);

    if (cached?.data) {
        try {
            const parsed = JSON.parse(cached.data);
            if (parsed.expireAt && new Date(parsed.expireAt) > now && parsed.month === month) {
                return NextResponse.json({ ...parsed.insight, cached: true });
            }
        } catch { /* cache inválido, regenerar */ }
    }

    // 2. Computar contexto financiero del mes actual
    try {
        const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        const end   = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-31`;
        const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
        const prevEnd   = new Date(now.getFullYear(), now.getMonth() - 1, 28).toISOString().slice(0, 10);

        const [accounts, msiPlans, recurringPayments, budgets, categories] = await Promise.all([
            getAccounts(userId),
            getMsiPlans(userId),
            getRecurringPayments(userId),
            getBudgets(userId),
            getCategories(userId),
        ]);

        // Transacciones del mes actual y mes anterior
        const txCurrent: { type: string; amount: number; categoryId: string; isParent: 0|1 }[] = db.prepare(
            `SELECT type, amount, categoryId, isParent FROM NTransaction
             WHERE userId=? AND date>=? AND date<=? AND deletedAt IS NULL`
        ).all(userId, start, end);

        const txPrev: { type: string; amount: number; categoryId: string }[] = db.prepare(
            `SELECT type, amount, categoryId FROM NTransaction
             WHERE userId=? AND date>=? AND date<=? AND deletedAt IS NULL AND type IN ('EXPENSE','MSI_CHARGE') AND isParent=0`
        ).all(userId, prevStart, prevEnd);

        // Cash flow
        let income = 0, expenses = 0;
        for (const tx of txCurrent) {
            const amt = Number(tx.amount) || 0;
            if (tx.type === 'INCOME') income += amt;
            else if ((tx.type === 'EXPENSE' || tx.type === 'MSI_CHARGE') && !tx.isParent) expenses += amt;
        }
        const cashFlow = income - expenses;

        // Liabilities para DTI
        const liabilities = accounts
            .filter(a => ['CREDIT','LOAN'].includes(a.type))
            .reduce((s, a) => s + Math.abs(Number(a.balance)), 0);
        const dti = income > 0 ? (liabilities / income) * 100 : 0;
        const savingsRate = income > 0 ? ((income - expenses) / income) * 100 : 0;

        // Top categorías con variación vs mes anterior
        const catMap = new Map(categories.map(c => [c.id, c.name]));
        const currentByCat: Record<string, number> = {};
        const prevByCat: Record<string, number>    = {};

        for (const tx of txCurrent) {
            if ((tx.type === 'EXPENSE' || tx.type === 'MSI_CHARGE') && !tx.isParent && tx.categoryId) {
                currentByCat[tx.categoryId] = (currentByCat[tx.categoryId] || 0) + Number(tx.amount);
            }
        }
        for (const tx of txPrev) {
            if (tx.categoryId) prevByCat[tx.categoryId] = (prevByCat[tx.categoryId] || 0) + Number(tx.amount);
        }

        const topCategories = Object.entries(currentByCat)
            .map(([catId, amount]) => ({
                name: catMap.get(catId) ?? 'Sin categoría',
                amount,
                vsLastMonth: prevByCat[catId]
                    ? ((amount - prevByCat[catId]) / prevByCat[catId]) * 100
                    : 0,
            }))
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 5);

        // Presupuestos excedidos
        const exceededBudgets = budgets
            .filter(b => {
                const spent = db.prepare(
                    `SELECT COALESCE(SUM(amount),0) as s FROM NTransaction
                     WHERE userId=? AND categoryId=? AND type IN ('EXPENSE','MSI_CHARGE')
                     AND isParent=0 AND date>=? AND date<=?`
                ).get(userId, b.categoryId, start, end)?.s ?? 0;
                return Number(spent) > Number(b.amount);
            })
            .map(b => {
                const spent = db.prepare(
                    `SELECT COALESCE(SUM(amount),0) as s FROM NTransaction
                     WHERE userId=? AND categoryId=? AND type IN ('EXPENSE','MSI_CHARGE')
                     AND isParent=0 AND date>=? AND date<=?`
                ).get(userId, b.categoryId, start, end)?.s ?? 0;
                return {
                    category: catMap.get(b.categoryId) ?? 'Sin nombre',
                    spent:    Number(spent),
                    limit:    Number(b.amount),
                };
            });

        // MSI y suscripciones activas
        const activeMsi = msiPlans.filter(p => p.status === 'ACTIVE');
        const activeMsiMonthly = activeMsi.reduce((s, p) => s + Number(p.monthlyAmount), 0);

        const activeSubs = recurringPayments.filter(r => r.status === 'ACTIVE');
        const subscriptionTotal = activeSubs.reduce((s, r) => s + Number(r.amount), 0);

        // 3. Llamar a Ollama
        const insight: AiInsight = await generateMonthlyInsight({
            month, income, expenses, cashFlow, dti, savingsRate,
            exceededBudgets, activeMsiCount: activeMsi.length,
            activeMsiMonthly, subscriptions: activeSubs.length,
            subscriptionTotal, topCategories,
        });

        // 4. Guardar en caché (Notification)
        const expireAt = new Date(now.getTime() + TTL_HOURS * 3600 * 1000).toISOString();
        const cacheData = JSON.stringify({ insight, expireAt, month });

        // Eliminar insight anterior y guardar nuevo
        db.prepare(`DELETE FROM Notification WHERE userId=? AND type=?`).run(userId, CACHE_TYPE);
        db.prepare(
            `INSERT INTO Notification (id, userId, type, title, body, data, createdAt)
             VALUES (lower(hex(randomblob(16))), ?, ?, 'AI Insight', ?, ?, datetime('now'))`
        ).run(userId, CACHE_TYPE, insight.insight.slice(0, 200), cacheData);

        return NextResponse.json({ ...insight, cached: false });
    } catch (error) {
        console.error('[ai-insight] Error generando consejo:', error instanceof Error ? error.message : error);
        // Fallback genérico: no mostrar mensaje de error técnico al usuario
        return NextResponse.json({
            insight: 'Este mes aún no hay suficientes datos para generar un consejo personalizado. ¡Agrega tus primeras transacciones!',
            type: 'TIP',
            icon: '💡',
            cached: false,
        });
    }
}
