import { NextResponse } from 'next/server';
import { db } from '@/app/lib/firebase';
import { getUserId, unauthorizedResponse, internalErrorResponse } from '@/app/lib/api-utils';
import { Account } from '@/app/lib/types';

/**
 * FASE 2: Motor de Deuda — Algoritmo Avalancha
 *
 * Fórmula de interés diario:
 *   Interés Diario = (Saldo × (CAT / 100)) / 360
 *
 * Regla: el cálculo es solo proyectado, nunca modifica historial.
 */

interface DebtAccount {
    id: string;
    name: string;
    type: string;
    balance: number;        // Saldo adeudado (positivo = deuda)
    annualRate: number;     // CAT en %
    minPayment: number;     // Pago mínimo mensual
    interestStartDate?: string;
    // Calculados
    dailyInterest: number;    // Costo por día
    monthlyInterest: number;  // Costo proyectado por mes
    monthsToPayoff: number;   // Meses para liquidar con solo mínimos
}

interface WhatIfResult {
    extraPayment: number;
    targetAccount: string | null;
    monthsSaved: number;
    totalInterestSaved: number;
    newMonthsToPayoff: number;
}

function calcMonthsToPayoff(balance: number, annualRate: number, monthlyPayment: number): number {
    if (monthlyPayment <= 0 || balance <= 0) return 0;
    const monthlyRate = annualRate / 100 / 12;
    if (monthlyRate <= 0) {
        return Math.ceil(balance / monthlyPayment);
    }
    // Fórmula de amortización inversa
    // n = -ln(1 - (r × P / C)) / ln(1 + r)
    const ratio = (monthlyRate * balance) / monthlyPayment;
    if (ratio >= 1) return 999; // Nunca se liquida con solo mínimos
    return Math.ceil(-Math.log(1 - ratio) / Math.log(1 + monthlyRate));
}

function calcTotalInterest(balance: number, annualRate: number, monthlyPayment: number, months: number): number {
    if (months >= 999 || balance <= 0) return balance * (annualRate / 100); // Approx
    return (monthlyPayment * months) - balance;
}

export async function GET(request: Request) {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorizedResponse();

        const url = new URL(request.url);
        const extraPaymentParam = url.searchParams.get('extraPayment');
        const extraPayment = extraPaymentParam ? Number(extraPaymentParam) : 0;

        // 1. Obtener todas las cuentas de deuda del usuario
        const accountsSnap = await db.collection('users').doc(userId).collection('accounts').get();
        const allAccounts = accountsSnap.docs.map(d => d.data() as Account);

        // 2. Filtrar solo CREDIT y LOAN con saldo adeudado
        const debtAccounts = allAccounts
            .filter(acc => (acc.type === 'CREDIT' || acc.type === 'LOAN') && acc.balance < 0)
            .map(acc => {
                const deuda = Math.abs(acc.balance);
                const cat = acc.annualRate || 0;
                const minPago = acc.minPayment || Math.max(deuda * 0.02, 200); // mínimo estimado: 2% o $200

                const dailyInterest = (deuda * (cat / 100)) / 360;
                const monthlyInterest = dailyInterest * 30;

                return {
                    id: acc.id,
                    name: acc.name,
                    type: acc.type,
                    balance: deuda,
                    annualRate: cat,
                    minPayment: minPago,
                    interestStartDate: acc.interestStartDate,
                    dailyInterest: Math.round(dailyInterest * 100) / 100,
                    monthlyInterest: Math.round(monthlyInterest * 100) / 100,
                    monthsToPayoff: calcMonthsToPayoff(deuda, cat, minPago),
                } as DebtAccount;
            });

        // 3. Algoritmo Avalancha: ordenar por CAT descendente
        const avalanche = [...debtAccounts].sort((a, b) => b.annualRate - a.annualRate);

        // 4. Métricas globales de deuda
        const totalDebt = debtAccounts.reduce((s, a) => s + a.balance, 0);
        const totalDailyBleed = debtAccounts.reduce((s, a) => s + a.dailyInterest, 0);
        const totalMonthlyInterest = debtAccounts.reduce((s, a) => s + a.monthlyInterest, 0);
        const avgCAT = debtAccounts.length > 0
            ? debtAccounts.reduce((s, a) => s + a.annualRate, 0) / debtAccounts.length
            : 0;

        // 5. Simulador "What If" — ¿Qué pasa si pago $X extra/mes al de mayor tasa?
        let whatIf: WhatIfResult | null = null;
        if (extraPayment > 0 && avalanche.length > 0) {
            const target = avalanche[0]; // El de mayor tasa (Avalancha prioriza este)
            const normalMonths = target.monthsToPayoff;
            const boostedMonths = calcMonthsToPayoff(target.balance, target.annualRate, target.minPayment + extraPayment);
            const monthsSaved = Math.max(0, normalMonths - boostedMonths);

            const interestNormal = calcTotalInterest(target.balance, target.annualRate, target.minPayment, normalMonths);
            const interestBoosted = calcTotalInterest(target.balance, target.annualRate, target.minPayment + extraPayment, boostedMonths);
            const interestSaved = Math.max(0, interestNormal - interestBoosted);

            whatIf = {
                extraPayment,
                targetAccount: target.name,
                monthsSaved,
                totalInterestSaved: Math.round(interestSaved * 100) / 100,
                newMonthsToPayoff: boostedMonths,
            };
        }

        // 6. Cuenta INVESTMENT para comparar (Fase 4 — Arbitraje)
        const investmentAccounts = allAccounts.filter(acc => acc.type === 'INVESTMENT');
        const investmentBalance = investmentAccounts.reduce((s, a) => s + a.balance, 0);
        // Rendimiento anual de INVESTMENT se guarda en annualRate (puede ser 0 si no se define)
        const investmentRate = investmentAccounts.length > 0
            ? investmentAccounts.reduce((s, a) => s + (a.annualRate || 0), 0) / investmentAccounts.length
            : 0;

        const arbitrageAlert = avgCAT > investmentRate && totalDebt > 0;

        return NextResponse.json({
            summary: {
                totalDebt: Math.round(totalDebt * 100) / 100,
                totalDailyBleed: Math.round(totalDailyBleed * 100) / 100,
                totalMonthlyInterest: Math.round(totalMonthlyInterest * 100) / 100,
                avgCAT: Math.round(avgCAT * 100) / 100,
                debtAccountsCount: debtAccounts.length,
            },
            avalanche,
            whatIf,
            arbitrage: {
                avgDebtCAT: Math.round(avgCAT * 100) / 100,
                investmentRate: Math.round(investmentRate * 100) / 100,
                investmentBalance: Math.round(investmentBalance * 100) / 100,
                alert: arbitrageAlert,
                message: arbitrageAlert
                    ? `Tu deuda promedio cuesta ${avgCAT.toFixed(1)}% anual. Tu inversión rinde ${investmentRate.toFixed(1)}%. Es mejor pagar deuda que invertir.`
                    : investmentRate > 0
                        ? `Tu inversión rinde ${investmentRate.toFixed(1)}%, más que el costo promedio de tu deuda (${avgCAT.toFixed(1)}%). ¡Buen arbitraje!`
                        : null,
            },
        });

    } catch (error) {
        return internalErrorResponse('GET Debt Strategy', error);
    }
}
