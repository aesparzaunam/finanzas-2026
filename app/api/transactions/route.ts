import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { cookies } from 'next/headers';

interface TransactionRecord {
    id: string;
    amount: number | { toNumber: () => number };
    type: string;
    date: Date;
    description: string;
    accountId: string;
    categoryId: string | null;
    isParent: boolean;
    msiPlanId: string | null;
}

export async function GET() {
    try {
        const cookieStore = await cookies();
        const userId = cookieStore.get('userId')?.value;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const transactions = await prisma.transaction.findMany({
            where: {
                userId,
                // Optionally hide MSI parent transactions from the list
                // isParent: false 
            },
            include: {
                account: { select: { name: true } },
                category: { select: { name: true, icon: true, color: true } },
                msiPlan: { select: { months: true, totalAmount: true } }
            },
            orderBy: { date: 'desc' },
            take: 100,
        });

        return NextResponse.json(transactions);
    } catch (error) {
        console.error('Failed to fetch transactions:', error);
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

        const { date, description, amount, type, accountId, categoryId, toAccountId } = await request.json();

        // Validation based on type
        if (!amount || !type || !accountId) {
            return NextResponse.json({ error: 'Missing required fields: amount, type, accountId' }, { status: 400 });
        }

        // Category required for INCOME and EXPENSE
        if ((type === 'INCOME' || type === 'EXPENSE') && !categoryId) {
            return NextResponse.json({ error: 'Category required for income/expense' }, { status: 400 });
        }

        // toAccountId required for TRANSFER and PAGO_TARJETA
        if ((type === 'TRANSFER' || type === 'PAGO_TARJETA') && !toAccountId) {
            return NextResponse.json({ error: 'Destination account required for transfer/payment' }, { status: 400 });
        }

        const amountNum = Number(amount);

        const result = await prisma.$transaction(async (tx) => {
            // Create the transaction
            const newTx = await tx.transaction.create({
                data: {
                    userId,
                    accountId,
                    categoryId: categoryId || null,
                    amount: amountNum,
                    type: type,
                    date: new Date(date || new Date()),
                    description: description || '',
                    isParent: false,
                },
            });

            // Update account balances based on type
            switch (type) {
                case 'INCOME':
                    // Add to account
                    await tx.account.update({
                        where: { id: accountId },
                        data: { balance: { increment: amountNum } }
                    });
                    break;

                case 'EXPENSE':
                case 'MSI_CHARGE':
                    // Subtract from account
                    await tx.account.update({
                        where: { id: accountId },
                        data: { balance: { decrement: amountNum } }
                    });
                    break;

                case 'TRANSFER':
                    // Subtract from source, add to destination
                    await tx.account.update({
                        where: { id: accountId },
                        data: { balance: { decrement: amountNum } }
                    });
                    await tx.account.update({
                        where: { id: toAccountId },
                        data: { balance: { increment: amountNum } }
                    });
                    break;

                case 'PAGO_TARJETA':
                    // Credit card payment: 
                    // - Reduce credit card debt (accountId is the credit card)
                    // - Subtract from source account (toAccountId is where money comes from)
                    // Note: Credit card balances are tracked as debt (positive = owed)
                    await tx.account.update({
                        where: { id: accountId }, // Credit card
                        data: { balance: { decrement: amountNum } } // Reduce debt
                    });
                    await tx.account.update({
                        where: { id: toAccountId }, // Bank/Cash account
                        data: { balance: { decrement: amountNum } } // Money leaves
                    });
                    break;
            }

            return newTx;
        });

        return NextResponse.json(result, { status: 201 });
    } catch (error) {
        console.error('Failed to create transaction:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
