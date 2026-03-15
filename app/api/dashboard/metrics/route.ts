import { NextResponse } from 'next/server';
import { db } from '@/app/lib/firebase';
import { getUserId, unauthorizedResponse, internalErrorResponse, notFoundResponse } from '@/app/lib/api-utils';

import { Account, Transaction } from '@/app/lib/types';

export async function GET() {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorizedResponse();

        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) return notFoundResponse('User');

        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

        // Run DB queries in parallel: we only need accounts and the last 12 months of transactions
        const startOfHistory = new Date(now.getFullYear(), now.getMonth() - 11, 1).toISOString();
        const txRef = db.collection('users').doc(userId).collection('transactions');

        const [accountsSnap, historySnap] = await Promise.all([
            db.collection('users').doc(userId).collection('accounts').get(),
            txRef.where('date', '>=', startOfHistory).get()
        ]);

        const accounts = accountsSnap.docs.map(d => d.data() as Account);
        const allTransactions = historySnap.docs.map(d => d.data() as Transaction);

        // 1. Net Worth: Assets - Liabilities
        let assets = 0;
        let liabilities = 0;
        let liquidAssets = 0;

        accounts.forEach((acc: Account) => {
            const bal = Number(acc.balance) || 0;
            if (['BANK', 'CASH', 'INVESTMENT'].includes(acc.type)) {
                assets += bal;
                if (['BANK', 'CASH'].includes(acc.type)) liquidAssets += bal;
            } else if (['CREDIT', 'LOAN'].includes(acc.type)) {
                liabilities += Math.abs(bal);
            }
        });

        const netWorth = assets - liabilities;

        // 2. Cash Flow: Income - Expenses (Current Month)
        let income = 0;
        let expenses = 0;

        allTransactions.forEach((tx: Transaction) => {
            if (tx.date >= startOfMonth && tx.date <= endOfMonth) {
                const amt = Number(tx.amount) || 0;
                if (tx.type === 'INCOME') {
                    income += amt;
                } else if (tx.type === 'EXPENSE') {
                    if (!tx.isParent) expenses += amt;
                } else if (tx.type === 'MSI_CHARGE') {
                    expenses += amt;
                }
            }
        });

        const cashFlow = income - expenses;

        // 3. Runway
        const avgExpenses = expenses > 0 ? expenses : 1;
        const runway = liquidAssets / avgExpenses;

        // 4. History for Charts (Last 12 Months)
        const history = [];

        for (let i = 11; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthStart = new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
            const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).toISOString();

            let mIncome = 0;
            let mExpense = 0;

            allTransactions.forEach((tx: Transaction) => {
                if (tx.date >= monthStart && tx.date <= monthEnd) {
                    const val = Number(tx.amount);
                    if (tx.type === 'INCOME') mIncome += val;
                    if (tx.type === 'EXPENSE' && !tx.isParent) mExpense += val;
                    if (tx.type === 'MSI_CHARGE') mExpense += val;
                }
            });

            history.push({
                month: d.toLocaleString('default', { month: 'short' }),
                income: mIncome,
                expense: mExpense
            });
        }

        // 5. Account Summary
        const accountSummary = {
            total: accounts.length,
            banks: accounts.filter(a => a.type === 'BANK').length,
            credit: accounts.filter(a => a.type === 'CREDIT').length,
            cash: accounts.filter(a => a.type === 'CASH').length,
            others: accounts.filter(a => !['BANK', 'CREDIT', 'CASH'].includes(a.type)).length
        };

        return NextResponse.json({
            netWorth,
            cashFlow,
            savingsRate: 0,
            runway,
            dti: 0,
            history,
            accountSummary
        });

    } catch (error) {
        return internalErrorResponse('Dashboard Metrics', error);
    }
}
