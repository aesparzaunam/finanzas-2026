import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { cookies } from 'next/headers';



export async function GET() {
    try {
        const cookieStore = await cookies();
        const userId = cookieStore.get('userId')?.value;

        if (!userId) {
            return NextResponse.json({
                netWorth: 0,
                cashFlow: 0,
                savingsRate: 0,
                runway: 0,
                dti: 0
            });
        }

        // Verify user exists
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 401 });
        }

        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        // 1. Net Worth: Assets - Liabilities
        const accounts = await prisma.account.findMany({
            where: { userId }
        });

        let assets = 0;
        let liabilities = 0;
        let liquidAssets = 0; // For runway

        accounts.forEach((acc: any) => {
            const bal = Number(acc.balance);
            if (['BANK', 'CASH', 'INVESTMENT'].includes(acc.type)) {
                assets += bal;
                if (['BANK', 'CASH'].includes(acc.type)) liquidAssets += bal;
            } else if (['CREDIT', 'LOAN'].includes(acc.type)) {
                liabilities += Math.abs(bal); // Assuming debts might be stored as positive or negative, usually positive in liability accounts but let's handle logic
            }
        });

        // Adjust logic: If we decide liabilities are negative numbers in DB, just sum all.
        // Usually easier if everything is positive and type determines sign.
        // Let's assume balance is absolute value.
        const netWorth = assets - liabilities;

        // 2. Cash Flow: Income - Expenses (Current Month)
        const transactions = await prisma.transaction.findMany({
            where: {
                userId,
                date: {
                    gte: startOfMonth,
                    lte: endOfMonth
                }
            }
        });

        let income = 0;
        let expenses = 0;
        // const savings = 0; // TODO: Implement logic
        // const debtPayments = 0; // TODO: Implement logic

        transactions.forEach((tx: any) => {
            const amt = Number(tx.amount);
            if (tx.type === 'INCOME') {
                income += amt;
            } else if (tx.type === 'EXPENSE') {
                // Only count EXPENSE if it's NOT a parent MSI transaction
                if (!tx.isParent) {
                    expenses += amt;
                }
            } else if (tx.type === 'MSI_CHARGE') {
                // MSI monthly charges count as expenses
                expenses += amt;
            }
            // PAGO_TARJETA and TRANSFER do not count as expenses
        });

        const cashFlow = income - expenses;

        // 3. Savings Rate: Savings / Income
        // 4. Runway: Liquid Assets / Avg Expenses (using current month for now as proxy)
        const avgExpenses = expenses > 0 ? expenses : 1; // Avoid div by 0
        const runway = liquidAssets / avgExpenses;

        // 5. DTI: Debt Payments / Income
        // Placeholder logic until categories are fully implemented
        const dti = 0;
        const savingsRate = 0;

        // 6. History for Charts (Last 12 Months)
        const history = [];
        for (let i = 11; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
            const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);

            const monthTx = await prisma.transaction.findMany({
                where: {
                    userId,
                    date: { gte: monthStart, lte: monthEnd }
                }
            });

            let mIncome = 0;
            let mExpense = 0;
            monthTx.forEach((tx: any) => {
                const val = Number(tx.amount);
                if (tx.type === 'INCOME') mIncome += val;
                // Count EXPENSE only if not a parent MSI, and always count MSI_CHARGE
                if (tx.type === 'EXPENSE' && !tx.isParent) mExpense += val;
                if (tx.type === 'MSI_CHARGE') mExpense += val;
            });

            history.push({
                month: d.toLocaleString('default', { month: 'short' }),
                income: mIncome,
                expense: mExpense
            });
        }

        return NextResponse.json({
            netWorth,
            cashFlow,
            savingsRate,
            runway,
            dti,
            history
        });

    } catch (error) {
        console.error('Dashboard metrics error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
