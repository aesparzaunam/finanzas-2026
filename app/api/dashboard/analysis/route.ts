import { NextResponse } from 'next/server';
import { db } from '@/app/lib/firebase';
import { getUserId, unauthorizedResponse, internalErrorResponse } from '@/app/lib/api-utils';
import { Transaction, MSIPlan, RecurringPayment, Account, TimelinePoint, HormigaAnalysis, DebtRatioData } from '@/app/lib/types';
import { startOfMonth, subMonths, eachDayOfInterval, addDays, format, isAfter } from 'date-fns';

export async function GET() {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorizedResponse();

        const now = new Date();
        const thirtyDaysFromNow = addDays(now, 30);
        const threeMonthsAgo = subMonths(startOfMonth(now), 3);

        // Fetch Data Parallel
        const [transactionsSnap, msiSnap, recurringSnap, accountsSnap, categoriesSnap] = await Promise.all([
            db.collection('users').doc(userId).collection('transactions')
                .where('date', '>=', threeMonthsAgo.toISOString())
                .get(),
            db.collection('users').doc(userId).collection('msiPlans')
                .where('status', '==', 'ACTIVE')
                .get(),
            db.collection('users').doc(userId).collection('recurring_payments')
                .where('status', '==', 'ACTIVE')
                .get(),
            db.collection('users').doc(userId).collection('accounts').get(),
            db.collection('users').doc(userId).collection('categories').get()
        ]);

        const transactions = transactionsSnap.docs.map(d => d.data() as Transaction);
        const msiPlans = msiSnap.docs.map(d => d.data() as MSIPlan);
        const recurringPayments = recurringSnap.docs.map(d => d.data() as RecurringPayment);
        const accounts = accountsSnap.docs.map(d => d.data() as Account);
        const categories = categoriesSnap.docs.map(d => d.data() as any);
        const categoryMap = new Map(categories.map(c => [c.id, c.name]));

        // 1. Calculate Average Income (Last 3 Months)
        const incomeTransactions = transactions.filter(t => t.type === 'INCOME');
        const totalIncome = incomeTransactions.reduce((sum, t) => sum + t.amount, 0);
        const avgIncome = totalIncome / 3;

        // 2. Hormiga Analysis (Last 7 days)
        const sevenDaysAgo = addDays(now, -7);
        const recentExpenses = transactions.filter(t => 
            t.type === 'EXPENSE' && 
            isAfter(new Date(t.date), sevenDaysAgo) &&
            t.amount < 500
        );

        const hormigaByCategory: Record<string, HormigaAnalysis> = {};
        recentExpenses.forEach(t => {
            const catId = t.categoryId || 'sin-categoria';
            const catName = categoryMap.get(catId) || 'Sin Categoría';
            if (!hormigaByCategory[catId]) {
                hormigaByCategory[catId] = { categoryName: catName, count: 0, totalAmount: 0, hasFlag: false };
            }
            hormigaByCategory[catId].count++;
            hormigaByCategory[catId].totalAmount += t.amount;
            if (hormigaByCategory[catId].count > 3) hormigaByCategory[catId].hasFlag = true;
        });

        const hormigaAlerts = Object.values(hormigaByCategory).filter(a => a.hasFlag);

        // 3. Debt Ratio
        const currentMsiBills = msiPlans.reduce((sum, p) => sum + p.monthlyAmount, 0);
        const recurringBills = recurringPayments.reduce((sum, p) => {
            if (p.frequency === 'MONTHLY') return sum + p.amount;
            if (p.frequency === 'WEEKLY') return sum + (p.amount * 4);
            return sum;
        }, 0);
        
        const fixedLiabilities = currentMsiBills + recurringBills;
        const ratio = avgIncome > 0 ? fixedLiabilities / avgIncome : 0;
        const debtRatioData: DebtRatioData = {
            avgIncome,
            fixedLiabilities,
            ratio,
            isWarning: ratio > 0.4
        };

        // 4. Timeline Projection (30 Days)
        const liquidAccounts = accounts.filter(acc => acc.type === 'BANK' || acc.type === 'CASH');
        const creditAccounts = accounts.filter(acc => acc.type === 'CREDIT');
        
        // Helper to calculate what is due for a CC on a specific payment day
        const getCreditCardPaymentDue = (account: Account, paymentDate: Date) => {
            if (!account.billingDay) return 0;
            
            // Payment on 'paymentDate' (e.g. March 15)
            // Billing cycle ended on billingDay of the same month OR previous month
            // Example A: Billing 28, Payment 15. Payment March 15 -> Billing Feb 28.
            // Example B: Billing 5, Payment 25. Payment March 25 -> Billing March 5.
            
            let cutoffDate = new Date(paymentDate.getFullYear(), paymentDate.getMonth(), account.billingDay);
            if (!isAfter(paymentDate, cutoffDate)) {
                // If payment day (e.g. 15) is before or same as billing day (e.g. 28)
                // then the cutoff was in the previous month.
                cutoffDate = subMonths(cutoffDate, 1);
            }
            // Ensure we handle months with fewer days (28, 30, etc)
            const lastDay = new Date(cutoffDate.getFullYear(), cutoffDate.getMonth() + 1, 0).getDate();
            if (account.billingDay > lastDay) {
                cutoffDate.setDate(lastDay);
            }

            const cycleEnd = cutoffDate;
            const cycleStart = addDays(subMonths(cycleEnd, 1), 1);
            
            // Transactions in this cycle
            const cycleTransactions = transactions.filter(t => 
                t.accountId === account.id &&
                new Date(t.date) >= cycleStart &&
                new Date(t.date) <= cycleEnd &&
                (t.type === 'EXPENSE' || t.type === 'INCOME' || t.type === 'MSI_CHARGE')
            );
            
            const totalTx = cycleTransactions.reduce((sum, t) => {
                if (t.type === 'INCOME') return sum - t.amount;
                return sum + t.amount;
            }, 0);

            // MSI monthly payments active during this cycle
            // (MSI charges are usually already in 'transactions' as MSI_CHARGE, 
            // but let's be double sure and check if the user wants us to calculate from plans)
            const activeMsiPlans = msiPlans.filter(p => p.accountId === account.id && p.status === 'ACTIVE');
            const totalMsi = activeMsiPlans.reduce((sum, p) => sum + p.monthlyAmount, 0);

            return Math.max(0, totalTx + totalMsi);
        };

        let projectedLiquidity = liquidAccounts.reduce((sum, acc) => sum + acc.balance, 0);
        const dailyIncome = avgIncome / 30;
        
        const timeline: TimelinePoint[] = [];
        const days = eachDayOfInterval({ start: now, end: thirtyDaysFromNow });

        days.forEach(day => {
            let dayDelta = dailyIncome;
            let isImportantPayment = false;
            let paymentDescription = '';
            
            // Subtract Recurring
            recurringPayments.forEach(rp => {
                const start = new Date(rp.startDate);
                if (rp.frequency === 'MONTHLY' && day.getDate() === start.getDate()) {
                    dayDelta -= rp.amount;
                    isImportantPayment = true;
                    paymentDescription += `${paymentDescription ? ', ' : ''}${rp.name}`;
                }
            });

            // Subtract MSI
            msiPlans.forEach(plan => {
                const sDate = new Date(plan.startDate);
                if (day.getDate() === sDate.getDate()) {
                    dayDelta -= plan.monthlyAmount;
                    isImportantPayment = true;
                    paymentDescription += `${paymentDescription ? ', ' : ''}MSI: ${plan.description}`;
                }
            });

            // Subtract CC Payments (Pago de Tarjeta)
            creditAccounts.forEach(acc => {
                // Handle different month lengths for payment day
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
            timeline.push({
                date: format(day, 'yyyy-MM-dd'),
                balance: Math.round(projectedLiquidity * 100) / 100,
                isImportantPayment,
                paymentDescription
            });
        });

        // 5. Upcoming Payments (Next 5)
        const upcoming = recurringPayments
            .map(rp => {
                const dayOfMonth = new Date(rp.startDate).getDate();
                let nextDate = new Date(now.getFullYear(), now.getMonth(), dayOfMonth);
                if (isAfter(now, nextDate)) {
                    nextDate = addDays(nextDate, 30); // Move to next month
                }
                return { ...rp, nextDate };
            })
            .sort((a, b) => a.nextDate.getTime() - b.nextDate.getTime())
            .slice(0, 5);

        return NextResponse.json({
            timeline,
            debtRatio: debtRatioData,
            hormiga: hormigaAlerts,
            avgIncome,
            upcoming
        });

    } catch (error) {
        return internalErrorResponse('GET Dashboard Analysis', error);
    }
}
