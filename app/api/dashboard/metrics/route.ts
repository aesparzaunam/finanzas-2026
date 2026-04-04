import { getUserId } from '@/app/lib/api-utils';
import { NextResponse } from 'next/server';
import { getAccounts, getMsiPlans, getRecurringPayments } from '@/app/lib/db';

export async function GET() {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const path = require('path');
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const Database = require('better-sqlite3');
        const dbPath = (process.env.DATABASE_URL ?? '').replace('file:', '') ||
            path.join(process.cwd(), 'prisma', 'finanzas.db');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db: any = Database(dbPath);

        const now = new Date();

        function pad(n: number) { return String(n).padStart(2, '0'); }
        const monthStr  = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
        const histStart = `${now.getFullYear() - 1}-${pad(now.getMonth() + 1)}-01`;
        const start3m   = new Date(now.getFullYear(), now.getMonth() - 2, 1)
            .toISOString().slice(0, 10);

        // ── 1. Accounts ─────────────────────────────────────────────────────────
        const accounts = await getAccounts(userId);
        let assets = 0, liabilities = 0, liquidAssets = 0;
        accounts.forEach(acc => {
            const bal = Number(acc.balance) || 0;
            if (['BANK', 'CASH', 'INVESTMENT'].includes(acc.type)) {
                assets += bal;
                if (['BANK', 'CASH'].includes(acc.type)) liquidAssets += bal;
            } else if (['CREDIT', 'LOAN'].includes(acc.type)) {
                liabilities += Math.abs(bal);
            }
        });
        const netWorth = assets - liabilities;

        // ── 2. Transactions: last 12 months ──────────────────────────────────────
        const allTx: Array<{ type: string; amount: number; date: string; isParent: 0 | 1 }> =
            db.prepare(
                `SELECT type, amount, date, isParent FROM NTransaction
                 WHERE userId = ? AND date >= ? ORDER BY date ASC`
            ).all(userId, histStart);

        // ── 3. Cash Flow (current month) ─────────────────────────────────────────
        let income = 0, expenses = 0;
        allTx.forEach(tx => {
            if (!tx.date.startsWith(monthStr)) return;
            const amt = Number(tx.amount) || 0;
            if (tx.type === 'INCOME') income += amt;
            else if (tx.type === 'EXPENSE' && !tx.isParent) expenses += amt;
            else if (tx.type === 'MSI_CHARGE') expenses += amt;
        });
        const cashFlow = income - expenses;

        // ── 4. Runway ─────────────────────────────────────────────────────────────
        const avgExpenses = expenses > 0 ? expenses : 1;
        const runway = liquidAssets / avgExpenses;

        // ── 5. Savings Rate ───────────────────────────────────────────────────────
        const savingsRate: number | null = income > 0
            ? Math.round(((income - expenses) / income) * 10000) / 100
            : null;

        // ── 6. DTI ────────────────────────────────────────────────────────────────
        const [msiPlans, recurringPayments] = await Promise.all([
            getMsiPlans(userId, 'ACTIVE'),
            getRecurringPayments(userId, 'ACTIVE'),
        ]);

        let msiMonthly = 0;
        msiPlans.forEach(p => { msiMonthly += Number(p.monthlyAmount) || 0; });

        let recurringMonthly = 0;
        recurringPayments.forEach(r => {
            const amt = Number(r.amount) || 0;
            switch (r.frequency) {
                case 'DAILY':   recurringMonthly += amt * 30; break;
                case 'WEEKLY':  recurringMonthly += amt * 4;  break;
                case 'MONTHLY': recurringMonthly += amt;      break;
                case 'YEARLY':  recurringMonthly += amt / 12; break;
            }
        });
        const fixedLiabilities = msiMonthly + recurringMonthly;

        let incomeSum3m = 0;
        allTx.forEach(tx => {
            if (tx.date >= start3m && tx.type === 'INCOME') incomeSum3m += Number(tx.amount) || 0;
        });
        const avgIncome3m = incomeSum3m / 3;
        const dti: number | null = avgIncome3m > 0
            ? Math.round((fixedLiabilities / avgIncome3m) * 10000) / 100
            : null;

        // ── 7. History chart (12 months) ─────────────────────────────────────────
        const history = [];
        for (let i = 11; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const ms = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
            let mIncome = 0, mExpense = 0;
            allTx.forEach(tx => {
                if (!tx.date.startsWith(ms)) return;
                const val = Number(tx.amount);
                if (tx.type === 'INCOME') mIncome += val;
                if (tx.type === 'EXPENSE' && !tx.isParent) mExpense += val;
                if (tx.type === 'MSI_CHARGE') mExpense += val;
            });
            history.push({ month: d.toLocaleString('es-MX', { month: 'short' }), income: mIncome, expense: mExpense });
        }

        // ── 8. Account summary ────────────────────────────────────────────────────
        const accountSummary = {
            total: accounts.length,
            banks:  accounts.filter(a => a.type === 'BANK').length,
            credit: accounts.filter(a => a.type === 'CREDIT').length,
            cash:   accounts.filter(a => a.type === 'CASH').length,
            others: accounts.filter(a => !['BANK', 'CREDIT', 'CASH'].includes(a.type)).length,
        };

        db.close();

        return NextResponse.json({ netWorth, cashFlow, savingsRate, runway, dti, history, accountSummary });
    } catch (error) {
        console.error('Dashboard metrics:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
