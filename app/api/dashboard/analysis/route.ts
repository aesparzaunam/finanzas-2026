import { getUserId } from '@/app/lib/api-utils';
import { NextResponse } from 'next/server';
import { getTransactions, getMsiPlans, getRecurringPayments, getAccounts, getCategories } from '@/app/lib/db';
import { startOfMonth, subMonths, eachDayOfInterval, addDays, format, isAfter, subMonths as sub } from 'date-fns';

export async function GET() {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const now = new Date();
        const thirtyDaysFromNow = addDays(now, 30);
        const threeMonthsAgo = subMonths(startOfMonth(now), 3).toISOString().slice(0, 10);

        const [{ transactions }, msiPlans, recurringPayments, accounts, categories] = await Promise.all([
            getTransactions(userId, { limit: 1000, fromDate: threeMonthsAgo }),
            getMsiPlans(userId, 'ACTIVE'),
            getRecurringPayments(userId, 'ACTIVE'),
            getAccounts(userId),
            getCategories(userId),
        ]);

        const categoryMap = new Map(categories.map(c => [c.id, c.name]));

        // 1. Average Income (Last 3 months)
        const totalIncome = transactions.filter(t => t.type === 'INCOME').reduce((s, t) => s + Number(t.amount), 0);
        const avgIncome = totalIncome / 3;

        // 2. Hormiga Analysis (Last 7 days)
        const sevenDaysAgo = addDays(now, -7).toISOString().slice(0, 10);
        const recentExpenses = transactions.filter(t => t.type === 'EXPENSE' && t.date >= sevenDaysAgo && Number(t.amount) < 500);

        const hormigaByCategory: Record<string, { categoryName: string; count: number; totalAmount: number; hasFlag: boolean }> = {};
        recentExpenses.forEach(t => {
            const catId = t.categoryId || 'sin-categoria';
            const catName = categoryMap.get(catId) || 'Sin Categoría';
            if (!hormigaByCategory[catId]) hormigaByCategory[catId] = { categoryName: catName, count: 0, totalAmount: 0, hasFlag: false };
            hormigaByCategory[catId].count++;
            hormigaByCategory[catId].totalAmount += Number(t.amount);
            if (hormigaByCategory[catId].count > 3) hormigaByCategory[catId].hasFlag = true;
        });
        const hormigaAlerts = Object.values(hormigaByCategory).filter(a => a.hasFlag);

        // 3. Debt Ratio
        const currentMsiBills = msiPlans.reduce((s, p) => s + Number(p.monthlyAmount), 0);
        const recurringBills = recurringPayments.reduce((s, p) => {
            if (p.frequency === 'MONTHLY') return s + Number(p.amount);
            if (p.frequency === 'WEEKLY') return s + Number(p.amount) * 4;
            return s;
        }, 0);
        const fixedLiabilities = currentMsiBills + recurringBills;
        const ratio = avgIncome > 0 ? fixedLiabilities / avgIncome : 0;
        const debtRatioData = { avgIncome, fixedLiabilities, ratio, isWarning: ratio > 0.4 };

        // 4. Timeline Projection (30 Days)
        const liquidAccounts = accounts.filter(acc => acc.type === 'BANK' || acc.type === 'CASH');
        const creditAccounts = accounts.filter(acc => acc.type === 'CREDIT');

        const getCreditCardPaymentDue = (account: typeof accounts[0], paymentDate: Date) => {
            if (!account.billingDay) return 0;
            let cutoffDate = new Date(paymentDate.getFullYear(), paymentDate.getMonth(), account.billingDay);
            if (!isAfter(paymentDate, cutoffDate)) cutoffDate = sub(cutoffDate, 1);
            const lastDay = new Date(cutoffDate.getFullYear(), cutoffDate.getMonth() + 1, 0).getDate();
            if (account.billingDay > lastDay) cutoffDate.setDate(lastDay);
            const cycleEnd = cutoffDate;
            const cycleStart = addDays(sub(cycleEnd, 1), 1);
            const cycleEndStr  = cycleEnd.toISOString().slice(0, 10);
            const cycleStartStr = cycleStart.toISOString().slice(0, 10);
            const cycleTxs = transactions.filter(t => t.accountId === account.id && t.date >= cycleStartStr && t.date <= cycleEndStr && ['EXPENSE', 'INCOME', 'MSI_CHARGE'].includes(t.type));
            const totalTx = cycleTxs.reduce((s, t) => t.type === 'INCOME' ? s - Number(t.amount) : s + Number(t.amount), 0);
            const activeMsiPlans = msiPlans.filter(p => p.accountId === account.id);
            const totalMsi = activeMsiPlans.reduce((s, p) => s + Number(p.monthlyAmount), 0);
            return Math.max(0, totalTx + totalMsi);
        };

        let projectedLiquidity = liquidAccounts.reduce((s, acc) => s + Number(acc.balance), 0);
        const dailyIncome = avgIncome / 30;
        const days = eachDayOfInterval({ start: now, end: thirtyDaysFromNow });

        const timeline = days.map(day => {
            let dayDelta = dailyIncome;
            let isImportantPayment = false;
            let paymentDescription = '';

            recurringPayments.forEach(rp => {
                const startDate = new Date(rp.startDate);
                if (rp.frequency === 'MONTHLY' && day.getDate() === startDate.getDate()) {
                    dayDelta -= Number(rp.amount);
                    isImportantPayment = true;
                    paymentDescription += `${paymentDescription ? ', ' : ''}${rp.name}`;
                }
            });
            msiPlans.forEach(plan => {
                const sDate = new Date(plan.startDate);
                if (day.getDate() === sDate.getDate()) {
                    dayDelta -= Number(plan.monthlyAmount);
                    isImportantPayment = true;
                    paymentDescription += `${paymentDescription ? ', ' : ''}MSI: ${plan.description}`;
                }
            });
            creditAccounts.forEach(acc => {
                const lastDay = new Date(day.getFullYear(), day.getMonth() + 1, 0).getDate();
                const actualPaymentDay = Math.min(acc.paymentDay || 15, lastDay);
                if (day.getDate() === actualPaymentDay) {
                    const amountDue = getCreditCardPaymentDue(acc, day);
                    if (amountDue > 0) {
                        dayDelta -= amountDue;
                        isImportantPayment = true;
                        paymentDescription += `${paymentDescription ? ', ' : ''}Pago ${acc.name}`;
                    }
                }
            });

            projectedLiquidity += dayDelta;
            return { date: format(day, 'yyyy-MM-dd'), balance: Math.round(projectedLiquidity * 100) / 100, isImportantPayment, paymentDescription };
        });

        // 5. Upcoming Payments
        const upcoming = recurringPayments
            .map(rp => {
                const dayOfMonth = new Date(rp.startDate).getDate();
                let nextDate = new Date(now.getFullYear(), now.getMonth(), dayOfMonth);
                if (isAfter(now, nextDate)) nextDate = addDays(nextDate, 30);
                return { ...rp, nextDate };
            })
            .sort((a, b) => a.nextDate.getTime() - b.nextDate.getTime())
            .slice(0, 5);

        return NextResponse.json({ timeline, debtRatio: debtRatioData, hormiga: hormigaAlerts, avgIncome, upcoming });
    } catch (error) {
        console.error('GET dashboard/analysis:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
