import { getUserId } from '@/app/lib/api-utils';
import { NextResponse } from 'next/server';
import {
    getRecurringPayments, getRecurringPaymentById,
    createRecurringPayment, updateRecurringPayment, deleteRecurringPayment
} from '@/app/lib/db';

export async function GET() {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payments = await getRecurringPayments(userId);
    return NextResponse.json(payments);
}

export async function POST(request: Request) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { name, amount, categoryId, accountId, frequency, startDate } = await request.json();
        if (!name || amount === undefined || !accountId || !frequency || !startDate) {
            return NextResponse.json({ error: 'Missing required fields: name, amount, accountId, frequency, startDate' }, { status: 400 });
        }

        const payment = await createRecurringPayment(userId, {
            name,
            amount: Number(amount),
            categoryId: categoryId || null,
            accountId,
            frequency,
            startDate: new Date(startDate).toISOString().slice(0, 10),
            nextPaymentDate: new Date(startDate).toISOString().slice(0, 10),
            status: 'ACTIVE',
        });
        return NextResponse.json(payment, { status: 201 });
    } catch (error) {
        console.error('POST Recurring:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { id, name, amount, categoryId, accountId, frequency, nextPaymentDate, status } = await request.json();
        if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

        const existing = await getRecurringPaymentById(id, userId);
        if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        const updated = await updateRecurringPayment(id, userId, {
            name: name ?? existing.name,
            amount: amount !== undefined ? Number(amount) : existing.amount,
            categoryId: categoryId !== undefined ? categoryId : existing.categoryId,
            accountId: accountId ?? existing.accountId,
            frequency: frequency ?? existing.frequency,
            nextPaymentDate: nextPaymentDate ?? existing.nextPaymentDate,
            status: status ?? existing.status,
        });
        return NextResponse.json(updated);
    } catch (error) {
        console.error('PUT Recurring:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    const ok = await deleteRecurringPayment(id, userId);
    if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true });
}
