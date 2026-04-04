import { getUserId } from '@/app/lib/api-utils';
import { NextResponse } from 'next/server';
import { getTransactions, getRecurringPayments, getCategories } from '@/app/lib/db';
import { confirmSubscriptions } from '@/app/lib/ai-utils';

export const maxDuration = 120;

function normalizeDescription(raw: string): string {
    return raw
        .toLowerCase()
        .replace(/\d{4,}/g, '')
        .replace(/\b(compra|cargo|pago|cobro|comision|comisión|tarjeta|debit|credit)\b/g, '')
        .replace(/[^a-záéíóúüñ\s]/gi, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim();
}

function median(arr: number[]): number {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function classifyFrequency(avgDays: number): 'WEEKLY' | 'MONTHLY' | 'YEARLY' | null {
    if (avgDays >= 6  && avgDays <= 9)   return 'WEEKLY';
    if (avgDays >= 25 && avgDays <= 35)  return 'MONTHLY';
    if (avgDays >= 350 && avgDays <= 380) return 'YEARLY';
    return null;
}

export async function GET() {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const cutoff = new Date();
        cutoff.setFullYear(cutoff.getFullYear() - 1);
        const cutoffStr = cutoff.toISOString().slice(0, 10);

        const [{ transactions: txs }, recurringPayments, categories] = await Promise.all([
            getTransactions(userId, { limit: 1000, fromDate: cutoffStr, type: 'EXPENSE' }),
            getRecurringPayments(userId),
            getCategories(userId),
        ]);

        const registeredKeys = new Set(recurringPayments.map(r => normalizeDescription(r.name)));
        const catList = categories.map(c => ({ id: c.id, name: c.name }));

        const groups: Map<string, { dates: Date[]; amounts: number[]; original: string }> = new Map();
        for (const tx of txs) {
            if (!tx.description) continue;
            const key = normalizeDescription(tx.description);
            if (key.length < 3) continue;
            if (!groups.has(key)) groups.set(key, { dates: [], amounts: [], original: tx.description });
            const g = groups.get(key)!;
            g.dates.push(new Date(tx.date));
            g.amounts.push(Number(tx.amount));
        }

        const candidates: {
            key: string; originalDescription: string; avgAmount: number;
            frequency: 'WEEKLY' | 'MONTHLY' | 'YEARLY';
            occurrences: number; lastSeen: string; avgInterval: number;
        }[] = [];

        for (const [key, { dates, amounts, original }] of groups) {
            if (dates.length < 3) continue;
            if (registeredKeys.has(key)) continue;
            const intervals: number[] = [];
            for (let i = 1; i < dates.length; i++) {
                intervals.push((dates[i].getTime() - dates[i-1].getTime()) / 86_400_000);
            }
            const avgInterval = median(intervals);
            const frequency = classifyFrequency(avgInterval);
            if (!frequency) continue;
            const avgAmount = amounts.reduce((s, a) => s + a, 0) / amounts.length;
            const hasStableAmount = amounts.every(a => Math.abs(a - avgAmount) / avgAmount <= 0.15);
            if (!hasStableAmount) continue;
            candidates.push({
                key, originalDescription: original,
                avgAmount: Math.round(avgAmount * 100) / 100,
                frequency, occurrences: dates.length,
                lastSeen: dates[dates.length - 1].toISOString(),
                avgInterval: Math.round(avgInterval),
            });
        }

        if (candidates.length === 0) return NextResponse.json([]);

        const confirmed = await confirmSubscriptions(
            candidates.map(c => ({ description: c.originalDescription, amount: c.avgAmount, occurrences: c.occurrences, avgInterval: c.avgInterval })),
            catList
        );

        const result = confirmed
            .map((item, i) => {
                const stats = candidates[i];
                if (!stats) return null;
                return {
                    key: stats.key,
                    suggestedName: item.friendlyName || stats.originalDescription,
                    originalDescription: stats.originalDescription,
                    amount: stats.avgAmount,
                    frequency: stats.frequency,
                    categoryId: item.categoryId || null,
                    occurrences: stats.occurrences,
                    lastSeen: stats.lastSeen,
                    averageInterval: stats.avgInterval,
                    confidence: item.confidence ?? 0,
                    isSubscription: item.isSubscription,
                };
            })
            .filter(item => item !== null && item.isSubscription && item.confidence >= 0.6);

        return NextResponse.json(result);
    } catch (error) {
        console.error('GET recurring/detect:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
