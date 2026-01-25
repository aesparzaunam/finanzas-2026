import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { cookies } from 'next/headers';
import { AccountType } from '@prisma/client';

export async function GET() {
    try {
        const cookieStore = await cookies();
        const userId = cookieStore.get('userId')?.value;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const accounts = await prisma.account.findMany({
            where: { userId },
            orderBy: { name: 'asc' },
        });

        return NextResponse.json(accounts);
    } catch (error) {
        console.error('Failed to fetch accounts:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const cookieStore = await cookies();
        const userId = cookieStore.get('userId')?.value;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { name, type, balance, currency } = await request.json();

        if (!name || !type || balance === undefined) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Validate type
        const validTypes = ['BANK', 'CASH', 'CREDIT', 'INVESTMENT', 'LOAN'];
        if (!validTypes.includes(type)) {
            return NextResponse.json({ error: 'Invalid account type' }, { status: 400 });
        }

        const account = await prisma.account.create({
            data: {
                userId,
                name,
                type: type as AccountType,
                balance: Number(balance),
                currency: currency || 'USD',
            },
        });

        return NextResponse.json(account, { status: 201 });

    } catch (error) {
        console.error('Failed to create account:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const cookieStore = await cookies();
        const userId = cookieStore.get('userId')?.value;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id, name, type, balance, currency } = await request.json();

        if (!id) {
            return NextResponse.json({ error: 'Account ID is required' }, { status: 400 });
        }

        // Verify account belongs to user
        const existing = await prisma.account.findFirst({
            where: { id, userId }
        });

        if (!existing) {
            return NextResponse.json({ error: 'Account not found' }, { status: 404 });
        }

        // Validate type if provided
        if (type) {
            const validTypes = ['BANK', 'CASH', 'CREDIT', 'INVESTMENT', 'LOAN'];
            if (!validTypes.includes(type)) {
                return NextResponse.json({ error: 'Invalid account type' }, { status: 400 });
            }
        }

        const updatedAccount = await prisma.account.update({
            where: { id },
            data: {
                ...(name !== undefined && { name }),
                ...(type !== undefined && { type: type as AccountType }),
                ...(balance !== undefined && { balance: Number(balance) }),
                ...(currency !== undefined && { currency })
            }
        });

        return NextResponse.json(updatedAccount);
    } catch (error) {
        console.error('Failed to update account:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const cookieStore = await cookies();
        const userId = cookieStore.get('userId')?.value;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Account ID is required' }, { status: 400 });
        }

        // Verify account belongs to user
        const existing = await prisma.account.findFirst({
            where: { id, userId }
        });

        if (!existing) {
            return NextResponse.json({ error: 'Account not found' }, { status: 404 });
        }

        // Check if account has transactions
        const transactionCount = await prisma.transaction.count({
            where: { accountId: id }
        });

        if (transactionCount > 0) {
            return NextResponse.json({
                error: 'No se puede eliminar una cuenta con transacciones. Elimina primero las transacciones.'
            }, { status: 400 });
        }

        await prisma.account.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to delete account:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
