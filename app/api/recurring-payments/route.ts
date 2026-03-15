import { NextResponse } from 'next/server';
import { db } from '@/app/lib/firebase';
import { getUserId, unauthorizedResponse, missingFieldsResponse, internalErrorResponse, notFoundResponse } from '@/app/lib/api-utils';
import { RecurringPayment, RecurringFrequency } from '@/app/lib/types';

export async function GET() {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorizedResponse();

        const snapshot = await db.collection('users').doc(userId).collection('recurring_payments').orderBy('createdAt', 'desc').get();
        const payments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        return NextResponse.json(payments);
    } catch (error) {
        return internalErrorResponse('GET Recurring Payments', error);
    }
}

export async function POST(request: Request) {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorizedResponse();

        const { name, amount, categoryId, accountId, frequency, startDate } = await request.json();

        if (!name || amount === undefined || !accountId || !frequency || !startDate) {
            return missingFieldsResponse(['name', 'amount', 'accountId', 'frequency', 'startDate']);
        }

        const nextDate = new Date(startDate);
        const paymentRef = db.collection('users').doc(userId).collection('recurring_payments').doc();
        
        const paymentData: RecurringPayment = {
            id: paymentRef.id,
            userId,
            name,
            amount: Number(amount),
            categoryId: categoryId || null,
            accountId,
            frequency: frequency as RecurringFrequency,
            startDate: new Date(startDate).toISOString(),
            nextPaymentDate: nextDate.toISOString(),
            status: 'ACTIVE',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        await paymentRef.set(paymentData);
        return NextResponse.json(paymentData, { status: 201 });
    } catch (error) {
        return internalErrorResponse('POST Recurring Payment', error);
    }
}

export async function PUT(request: Request) {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorizedResponse();

        const { id, ...data } = await request.json();
        if (!id) return missingFieldsResponse(['id']);

        const paymentRef = db.collection('users').doc(userId).collection('recurring_payments').doc(id);
        const doc = await paymentRef.get();
        if (!doc.exists) return notFoundResponse('Recurring Payment');

        const updateData = {
            ...data,
            updatedAt: new Date().toISOString()
        };

        await paymentRef.update(updateData);
        return NextResponse.json({ id, ...doc.data(), ...updateData });
    } catch (error) {
        return internalErrorResponse('PUT Recurring Payment', error);
    }
}

export async function DELETE(request: Request) {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorizedResponse();

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) return missingFieldsResponse(['id']);

        const paymentRef = db.collection('users').doc(userId).collection('recurring_payments').doc(id);
        await paymentRef.delete();

        return NextResponse.json({ success: true });
    } catch (error) {
        return internalErrorResponse('DELETE Recurring Payment', error);
    }
}
