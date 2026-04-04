import { getUserId } from '@/app/lib/api-utils';
import { NextResponse } from 'next/server';
import { getAccounts } from '@/app/lib/db';

// GET /api/accounts/shared — shared accounts (simplified for local SQLite mode)
// In the local mode, shared accounts are those with isShared = 1
export async function GET() {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const accounts = await getAccounts(userId);
        const sharedAccounts = accounts
            .filter(a => Boolean(a.isShared))
            .map(a => ({ ...a, isShared: true, isDefault: Boolean(a.isDefault), autoDetected: Boolean(a.autoDetected) }));
        return NextResponse.json(sharedAccounts);
    } catch (error) {
        console.error('GET shared accounts:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
