import { NextResponse } from 'next/server';
import { getUserId } from '@/app/lib/api-utils';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Database = require('better-sqlite3');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path');

// ── Sub-scores (cada uno de 0–100) ─────────────────────────────────────────

/** Tasa de ahorro: objetivo ≥20%. 0% = 0pts, 20%+ = 100pts */
function savingsScore(income: number, expenses: number): number {
    if (income <= 0) return 0;
    const rate = (income - expenses) / income;
    return Math.min(100, Math.max(0, Math.round(rate * 100 / 0.20 * 100)));
}

/** DTI (Deuda/Ingreso anual): <20% = 100, 40%+ = 0 */
function dtiScore(debtTotal: number, monthlyIncome: number): number {
    // Sin ingreso Y sin deuda = perfecto (nuevo usuario sin deudas)
    if (monthlyIncome <= 0 && debtTotal <= 0) return 100;
    // Sin ingreso pero CON deuda = máximo riesgo
    if (monthlyIncome <= 0) return 0;
    const dti = debtTotal / (monthlyIncome * 12);
    if (dti <= 0.20) return 100;
    if (dti >= 0.40) return 0;
    return Math.round((1 - (dti - 0.20) / 0.20) * 100);
}

/** Presupuestos cumplidos: % de presupuestos no excedidos */
function budgetScore(onTrack: number, total: number): number {
    // Sin presupuestos configurados = no penalizar (100 = sin desbordamientos)
    if (total === 0) return 100;
    return Math.round((onTrack / total) * 100);
}

/** Diversificación de ingresos: 1 fuente = 50, 2+ = 100 */
function incomeScore(incomeSources: number): number {
    if (incomeSources <= 0) return 0;
    if (incomeSources === 1) return 60;
    return 100;
}

/** Consistencia: meses con datos en los últimos 3 */
function consistencyScore(monthsWithData: number): number {
    return Math.round((monthsWithData / 3) * 100);
}

// ── Badges de logros ────────────────────────────────────────────────────────

interface Badge {
    id:          string;
    label:       string;
    icon:        string;
    description: string;
    earned:      boolean;
}

// GET /api/dashboard/health-score
export async function GET() {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const dbPath = (process.env.DATABASE_URL ?? '').replace('file:', '') ||
        path.join(process.cwd(), 'prisma', 'finanzas.db');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db: any = Database(dbPath);

    try {
        const now   = new Date();
        const month = now.toISOString().slice(0, 7);
        const from  = `${month}-01`;
        const to    = `${month}-31`;
        const months3 = [-3, -2, -1].map(offset => {
            const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
            return d.toISOString().slice(0, 7);
        });

        // ── Datos base ────────────────────────────────────────────────────────
        let income = 0, expenses = 0;
        try {
            const row = db.prepare(`
                SELECT
                    COALESCE(SUM(CASE WHEN type='INCOME' THEN amount ELSE 0 END),0) AS income,
                    COALESCE(SUM(CASE WHEN type IN ('EXPENSE','MSI_CHARGE') THEN amount ELSE 0 END),0) AS expenses
                FROM NTransaction
                WHERE userId = ? AND date >= ? AND date <= ?
            `).get(userId, from, to) as { income: number; expenses: number };
            income   = row?.income   ?? 0;
            expenses = row?.expenses ?? 0;
        } catch { /* vacio */ }

        let debtTotal = 0;
        try {
            const d = db.prepare(`
                SELECT COALESCE(SUM(CASE WHEN balance<0 THEN ABS(balance) ELSE 0 END),0) AS total
                FROM Account WHERE userId=? AND type IN ('CREDIT','LOAN')
            `).get(userId) as { total: number };
            debtTotal = d?.total ?? 0;
        } catch { /* vacio */ }

        // Presupuestos del mes
        let budgetsOnTrack = 0, budgetsTotal = 0;
        try {
            const budgets = db.prepare(`SELECT limitAmount AS "limit", carryIn FROM Budget WHERE userId=? AND month=?`)
                .all(userId, month) as Array<{ limit: number; carryIn: number }>;
            budgetsTotal = budgets.length;
            if (budgetsTotal > 0) {
                // Para cada presupuesto, calcular gasto aproximado
                for (const b of budgets) {
                    const available = b.limit + (b.carryIn ?? 0);
                    // Si tiene carryIn positivo aún tiene margen — simplificado
                    if (available >= 0) budgetsOnTrack++;
                }
            }
        } catch { /* vacio */ }

        // Fuentes de ingreso distintas (cuentas que recibieron ingresos)
        let incomeSources = 0;
        try {
            const s = db.prepare(`
                SELECT COUNT(DISTINCT accountId) AS cnt
                FROM NTransaction WHERE userId=? AND type='INCOME' AND date>=? AND date<=?
            `).get(userId, from, to) as { cnt: number };
            incomeSources = s?.cnt ?? 0;
        } catch { /* vacio */ }

        // Meses con datos en últimos 3
        let monthsWithData = 0;
        try {
            const m = db.prepare(`
                SELECT COUNT(DISTINCT substr(date,1,7)) AS cnt
                FROM NTransaction WHERE userId=? AND substr(date,1,7) IN (?,?,?)
            `).get(userId, ...months3) as { cnt: number };
            monthsWithData = m?.cnt ?? 0;
        } catch { /* vacio */ }

        // ── Calcular sub-scores ───────────────────────────────────────────────
        // Detectar si el usuario no tiene ningún dato cargado aún
        const hasTransactions = (income > 0 || expenses > 0 || monthsWithData > 0);

        const scores = {
            savings:     savingsScore(income, expenses),
            dti:         dtiScore(debtTotal, income),
            budgets:     budgetScore(budgetsOnTrack, budgetsTotal),
            income:      incomeScore(incomeSources),
            consistency: consistencyScore(monthsWithData),
        };

        // Score total ponderado
        const total = Math.round(
            scores.savings     * 0.30 +
            scores.dti         * 0.25 +
            scores.budgets     * 0.20 +
            scores.income      * 0.10 +
            scores.consistency * 0.15
        );

        // ── Nivel ────────────────────────────────────────────────────────────
        // Sin datos = no calificar con "Crítico", mostrar estado neutro
        const level = !hasTransactions ? 'Sin datos' :
            total >= 85 ? 'Excelente'    :
            total >= 70 ? 'Bueno'        :
            total >= 50 ? 'Regular'      :
            total >= 30 ? 'En riesgo'    :
                          'Crítico';


        const levelColor =
            total >= 85 ? '#22c55e' :
            total >= 70 ? '#84cc16' :
            total >= 50 ? '#f59e0b' :
            total >= 30 ? '#ef4444' :
                          '#dc2626';

        // ── Badges ────────────────────────────────────────────────────────────
        const savingsRate = income > 0 ? (income - expenses) / income : 0;
        const badges: Badge[] = [
            {
                id: 'first_save',
                label: 'Primer Ahorro',
                icon: '🌱',
                description: 'Cerraste un mes con saldo positivo',
                earned: savingsRate > 0,
            },
            {
                id: 'super_saver',
                label: 'Super Ahorrador',
                icon: '⚡',
                description: 'Ahorraste más del 20% de tus ingresos',
                earned: savingsRate >= 0.20,
            },
            {
                id: 'budget_master',
                label: 'Maestro del Presupuesto',
                icon: '🎯',
                description: 'Todos tus presupuestos están en verde',
                earned: budgetsTotal > 0 && budgetsOnTrack === budgetsTotal,
            },
            {
                id: 'data_driven',
                label: 'Datos al Día',
                icon: '📊',
                description: 'Tienes 3 meses de historial continuo',
                earned: monthsWithData >= 3,
            },
            {
                id: 'debt_free',
                label: 'Sin Deuda',
                icon: '🏆',
                description: 'Tu deuda total es $0',
                earned: debtTotal === 0 && income > 0,
            },
        ];

        return NextResponse.json({
            total,
            level,
            levelColor,
            scores,
            badges,
            meta: {
                income,
                expenses,
                debtTotal,
                savingsRate: Math.round(savingsRate * 100),
            },
            generatedAt: new Date().toISOString(),
        });

    } catch (err) {
        console.error('[health-score]', err);
        return NextResponse.json({ error: 'Error calculando score' }, { status: 500 });
    } finally {
        db.close();
    }
}
