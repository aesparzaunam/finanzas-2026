import { getUserId } from '@/app/lib/api-utils';
import { NextResponse } from 'next/server';
import { getAccountById, updateAccount } from '@/app/lib/db';

// GET /api/accounts/access?accountId=xxx
export async function GET(request: Request) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');
    if (!accountId) return NextResponse.json({ error: 'accountId is required' }, { status: 400 });

    const account = await getAccountById(accountId, userId);
    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

    // In local SQLite mode, shared access is simplified: isShared flag
    return NextResponse.json([]);
}

// POST /api/accounts/access — mark account as shared
export async function POST(request: Request) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { accountId } = await request.json();
        if (!accountId) return NextResponse.json({ error: 'accountId is required' }, { status: 400 });

        const updated = await updateAccount(accountId, userId, { isShared: 1 });
        if (!updated) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

        return NextResponse.json({ success: true, accountId, isShared: true }, { status: 201 });
    } catch (error) {
        console.error('POST accounts/access:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// DELETE /api/accounts/access?accountId=xxx — revoke sharing
export async function DELETE(request: Request) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');
    if (!accountId) return NextResponse.json({ error: 'accountId is required' }, { status: 400 });

    const updated = await updateAccount(accountId, userId, { isShared: 0 });
    if (!updated) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

    return NextResponse.json({ success: true });
}
