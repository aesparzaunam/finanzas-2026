import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getTransactions } from '@/app/lib/db';

export async function GET() {
    const cookieStore = await cookies();
    const userId = cookieStore.get('userId')?.value;
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        // Get all transaction tags (stored as JSON strings)
        const { transactions } = await getTransactions(userId, { limit: 500 });
        const tagSet = new Set<string>();
        transactions.forEach(tx => {
            if (tx.tags) {
                try {
                    const parsed = JSON.parse(tx.tags);
                    if (Array.isArray(parsed)) parsed.forEach(t => tagSet.add(t));
                } catch { /* ignore */ }
            }
        });
        return NextResponse.json([...tagSet].sort());
    } catch (error) {
        console.error('GET tags:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
