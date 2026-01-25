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
