import { NextResponse } from 'next/server';
import { db } from '@/app/lib/firebase';
import { getUserId, unauthorizedResponse, missingFieldsResponse, internalErrorResponse, notFoundResponse } from '@/app/lib/api-utils';
import { Account, AccountType } from '@/app/lib/types';

// Force refresh: 2026-03-15 03:15:00

export async function GET() {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorizedResponse();

        const snapshot = await db.collection('users').doc(userId).collection('accounts').orderBy('name', 'asc').get();
        const accounts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        return NextResponse.json(accounts);
    } catch (error) {
        return internalErrorResponse('GET Accounts', error);
    }
}

export async function POST(request: Request) {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorizedResponse();

        const { name, type, balance, currency, billingDay, paymentDay } = await request.json();

        if (!name || !type || balance === undefined) {
            return missingFieldsResponse(['name', 'type', 'balance']);
        }

        const validTypes: AccountType[] = ['BANK', 'CASH', 'CREDIT', 'INVESTMENT', 'LOAN'];
        if (!validTypes.includes(type as AccountType)) {
            return NextResponse.json({ error: 'Invalid account type' }, { status: 400 });
        }

        const accountRef = db.collection('users').doc(userId).collection('accounts').doc();
        const accountData: Account = {
            id: accountRef.id,
            userId,
            name,
            type: type as AccountType,
            balance: Number(balance),
            currency: currency || 'USD',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        if (type === 'CREDIT') {
            accountData.billingDay = billingDay !== undefined ? Number(billingDay) : 1;
            accountData.paymentDay = paymentDay !== undefined ? Number(paymentDay) : 15;
        }

        await accountRef.set(accountData);
        return NextResponse.json(accountData, { status: 201 });
    } catch (error) {
        return internalErrorResponse('POST Account', error);
    }
}

export async function PUT(request: Request) {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorizedResponse();

        const data = await request.json();
        const { id, name, type, balance, currency, billingDay, paymentDay } = data;
        if (!id) return missingFieldsResponse(['id']);

        const accountRef = db.collection('users').doc(userId).collection('accounts').doc(id);
        const doc = await accountRef.get();
        if (!doc.exists) return notFoundResponse('Account');

        if (type) {
            const validTypes: AccountType[] = ['BANK', 'CASH', 'CREDIT', 'INVESTMENT', 'LOAN'];
            if (!validTypes.includes(type as AccountType)) {
                return NextResponse.json({ error: 'Invalid account type' }, { status: 400 });
            }
        }

        const updateData: Partial<Account> = {
            updatedAt: new Date().toISOString()
        };
        if (name !== undefined) updateData.name = name;
        if (type !== undefined) updateData.type = type as AccountType;
        if (balance !== undefined) updateData.balance = Number(balance);
        if (currency !== undefined) updateData.currency = currency;
        
        if (type === 'CREDIT' || (!type && (doc.data()?.type === 'CREDIT'))) {
            if (billingDay !== undefined) updateData.billingDay = Number(billingDay);
            if (paymentDay !== undefined) updateData.paymentDay = Number(paymentDay);
        }

        await accountRef.update(updateData);
        return NextResponse.json({ id, ...doc.data(), ...updateData });
    } catch (error) {
        return internalErrorResponse('PUT Account', error);
    }
}

export async function DELETE(request: Request) {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorizedResponse();

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) return missingFieldsResponse(['id']);

        const accountRef = db.collection('users').doc(userId).collection('accounts').doc(id);
        const doc = await accountRef.get();
        if (!doc.exists) return notFoundResponse('Account');

        const transactionSnap = await db.collection('users').doc(userId).collection('transactions')
            .where('accountId', '==', id)
            .limit(1)
            .get();

        if (!transactionSnap.empty) {
            return NextResponse.json({
                error: 'No se puede eliminar una cuenta con transacciones. Elimina primero las transacciones.'
            }, { status: 400 });
        }

        await accountRef.delete();
        return NextResponse.json({ success: true });
    } catch (error) {
        return internalErrorResponse('DELETE Account', error);
    }
}
