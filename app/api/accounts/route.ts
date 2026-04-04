import { getUserId } from '@/app/lib/api-utils';
import { NextResponse } from 'next/server';
import {
    getAccounts, createAccount, getAccountById, updateAccount, deleteAccount
} from '@/app/lib/db';

// GET /api/accounts
export async function GET() {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const accounts = await getAccounts(userId);
    // Convert SQLite integers (0/1) to booleans for frontend compatibility
    return NextResponse.json(accounts.map(a => ({
        ...a,
        isDefault: Boolean(a.isDefault),
        isShared: Boolean(a.isShared),
        autoDetected: Boolean(a.autoDetected),
    })));
}

// POST /api/accounts
export async function POST(request: Request) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        const account = await createAccount(userId, body);
        return NextResponse.json({
            ...account,
            isDefault: Boolean(account.isDefault),
            isShared: Boolean(account.isShared),
            autoDetected: Boolean(account.autoDetected),
        }, { status: 201 });
    } catch (error) {
        console.error('Create account error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// PUT /api/accounts?id=...
export async function PUT(request: Request) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    try {
        const body = await request.json();
        const account = await updateAccount(id, userId, body);
        if (!account) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        return NextResponse.json({
            ...account,
            isDefault: Boolean(account.isDefault),
            isShared: Boolean(account.isShared),
            autoDetected: Boolean(account.autoDetected),
        });
    } catch (error) {
        console.error('Update account error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// DELETE /api/accounts?id=...
export async function DELETE(request: Request) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const ok = await deleteAccount(id, userId);
    if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true });
}
