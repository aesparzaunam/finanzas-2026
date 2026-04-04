import { getUserId } from '@/app/lib/api-utils';
import { NextResponse } from 'next/server';
import { getAccounts } from '@/app/lib/db';

function calcMonthsToPayoff(balance: number, annualRate: number, monthlyPayment: number): number {
    if (monthlyPayment <= 0 || balance <= 0) return 0;
    const monthlyRate = annualRate / 100 / 12;
    if (monthlyRate <= 0) return Math.ceil(balance / monthlyPayment);
    const ratio = (monthlyRate * balance) / monthlyPayment;
    if (ratio >= 1) return 999;
    return Math.ceil(-Math.log(1 - ratio) / Math.log(1 + monthlyRate));
}

function calcTotalInterest(balance: number, annualRate: number, monthlyPayment: number, months: number): number {
    if (months >= 999 || balance <= 0) return balance * (annualRate / 100);
    return (monthlyPayment * months) - balance;
}

export async function GET(request: Request) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const url = new URL(request.url);
        const extraPayment = Number(url.searchParams.get('extraPayment') || '0');

        const allAccounts = await getAccounts(userId);

        const debtAccounts = allAccounts
            .filter(acc => (acc.type === 'CREDIT' || acc.type === 'LOAN') && acc.balance < 0)
            .map(acc => {
                const deuda = Math.abs(Number(acc.balance));
                const cat = Number(acc.annualRate) || 0;
                const minPago = Number(acc.minPayment) || Math.max(deuda * 0.02, 200);
                const dailyInterest = (deuda * (cat / 100)) / 360;
                const monthlyInterest = dailyInterest * 30;
                return {
                    id: acc.id, name: acc.name, type: acc.type,
                    balance: deuda, annualRate: cat, minPayment: minPago,
                    interestStartDate: acc.interestStartDate,
                    dailyInterest: Math.round(dailyInterest * 100) / 100,
                    monthlyInterest: Math.round(monthlyInterest * 100) / 100,
                    monthsToPayoff: calcMonthsToPayoff(deuda, cat, minPago),
                };
            });

        const avalanche = [...debtAccounts].sort((a, b) => b.annualRate - a.annualRate);
        const totalDebt = debtAccounts.reduce((s, a) => s + a.balance, 0);
        const totalDailyBleed = debtAccounts.reduce((s, a) => s + a.dailyInterest, 0);
        const totalMonthlyInterest = debtAccounts.reduce((s, a) => s + a.monthlyInterest, 0);
        const avgCAT = debtAccounts.length > 0 ? debtAccounts.reduce((s, a) => s + a.annualRate, 0) / debtAccounts.length : 0;

        let whatIf = null;
        if (extraPayment > 0 && avalanche.length > 0) {
            const target = avalanche[0];
            const normalMonths  = target.monthsToPayoff;
            const boostedMonths = calcMonthsToPayoff(target.balance, target.annualRate, target.minPayment + extraPayment);
            const monthsSaved   = Math.max(0, normalMonths - boostedMonths);
            const interestNormal  = calcTotalInterest(target.balance, target.annualRate, target.minPayment, normalMonths);
            const interestBoosted = calcTotalInterest(target.balance, target.annualRate, target.minPayment + extraPayment, boostedMonths);
            whatIf = { extraPayment, targetAccount: target.name, monthsSaved, totalInterestSaved: Math.round(Math.max(0, interestNormal - interestBoosted) * 100) / 100, newMonthsToPayoff: boostedMonths };
        }

        const investmentAccounts = allAccounts.filter(acc => acc.type === 'INVESTMENT');
        const investmentBalance = investmentAccounts.reduce((s, a) => s + Number(a.balance), 0);
        const investmentRate = investmentAccounts.length > 0 ? investmentAccounts.reduce((s, a) => s + (Number(a.annualRate) || 0), 0) / investmentAccounts.length : 0;
        const arbitrageAlert = avgCAT > investmentRate && totalDebt > 0;

        return NextResponse.json({
            summary: { totalDebt: Math.round(totalDebt * 100) / 100, totalDailyBleed: Math.round(totalDailyBleed * 100) / 100, totalMonthlyInterest: Math.round(totalMonthlyInterest * 100) / 100, avgCAT: Math.round(avgCAT * 100) / 100, debtAccountsCount: debtAccounts.length },
            avalanche, whatIf,
            arbitrage: { avgDebtCAT: Math.round(avgCAT * 100) / 100, investmentRate: Math.round(investmentRate * 100) / 100, investmentBalance: Math.round(investmentBalance * 100) / 100, alert: arbitrageAlert, message: arbitrageAlert ? `Tu deuda promedio cuesta ${avgCAT.toFixed(1)}% anual. Tu inversión rinde ${investmentRate.toFixed(1)}%. Es mejor pagar deuda que invertir.` : investmentRate > 0 ? `Tu inversión rinde ${investmentRate.toFixed(1)}%, más que el costo promedio de tu deuda (${avgCAT.toFixed(1)}%). ¡Buen arbitraje!` : null },
        });
    } catch (error) {
        console.error('GET debt/strategy:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
