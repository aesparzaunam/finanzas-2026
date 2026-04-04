import { getUserId } from '@/app/lib/api-utils';
import { NextResponse } from 'next/server';
import { getRecurringPaymentById, updateRecurringPayment, getAccountById, createTransaction, cuid } from '@/app/lib/db';

type RecurringFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

function advanceDate(from: Date, frequency: RecurringFrequency): Date {
    const next = new Date(from);
    switch (frequency) {
        case 'DAILY':   next.setDate(next.getDate() + 1); break;
        case 'WEEKLY':  next.setDate(next.getDate() + 7); break;
        case 'MONTHLY': next.setMonth(next.getMonth() + 1); break;
        case 'YEARLY':  next.setFullYear(next.getFullYear() + 1); break;
    }
    return next;
}

// POST /api/recurring-payments/advance?id=<paymentId>
export async function POST(request: Request) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id query param' }, { status: 400 });

    try {
        const body = await request.json().catch(() => ({})) as {
            createTransaction?: boolean; accountId?: string; paidDate?: string;
        };
        const { createTransaction: shouldCreateTx = false, accountId, paidDate } = body;

        const payment = await getRecurringPaymentById(id, userId);
        if (!payment) return NextResponse.json({ error: 'Recurring payment not found' }, { status: 404 });
        if (payment.status !== 'ACTIVE') {
            return NextResponse.json({ error: 'Solo se pueden avanzar pagos con estado ACTIVE' }, { status: 400 });
        }

        const currentNext = payment.nextPaymentDate
            ? new Date(payment.nextPaymentDate)
            : new Date(payment.startDate);
        const paidAt = paidDate ? new Date(paidDate) : new Date();
        const newNextDate = advanceDate(currentNext, payment.frequency as RecurringFrequency);

        await updateRecurringPayment(id, userId, {
            nextPaymentDate: newNextDate.toISOString().slice(0, 10),
            lastPaidAt: paidAt.toISOString(),
        });

        if (!shouldCreateTx) {
            return NextResponse.json({
                success: true,
                previousNextDate: currentNext.toISOString(),
                newNextDate: newNextDate.toISOString(),
                transactionCreated: false,
            });
        }

        if (!accountId) {
            return NextResponse.json({ error: 'accountId is required when createTransaction=true' }, { status: 400 });
        }

        const account = await getAccountById(accountId, userId);
        if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

        const amount = Number(payment.amount);
        const txId = cuid();

        // SQLite atomic: create tx + deduct balance
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const path = require('path');
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const Database = require('better-sqlite3');
        const dbPath = (process.env.DATABASE_URL ?? '').replace('file:', '') ||
            path.join(process.cwd(), 'prisma', 'finanzas.db');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db: any = Database(dbPath);
        db.pragma('foreign_keys = ON');

        const ts = new Date().toISOString();
        const dateStr = paidAt.toISOString().slice(0, 10);

        const tx = db.transaction(() => {
            db.prepare(`INSERT INTO NTransaction (id,userId,accountId,categoryId,amount,type,date,description,recurringPaymentId,isParent,isDeductible,createdAt,updatedAt)
                VALUES (?,?,?,?,?,?,?,?,?,0,0,?,?)`)
                .run(txId, userId, accountId, payment.categoryId ?? null, amount, 'EXPENSE', dateStr, payment.name, id, ts, ts);
            db.prepare("UPDATE Account SET balance = balance - ?, updatedAt = datetime('now') WHERE id = ? AND userId = ?")
                .run(amount, accountId, userId);
        });
        tx();
        db.close();

        return NextResponse.json({
            success: true,
            previousNextDate: currentNext.toISOString(),
            newNextDate: newNextDate.toISOString(),
            transactionCreated: true,
            transactionId: txId,
        });
    } catch (error) {
        console.error('POST recurring-payments/advance:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
