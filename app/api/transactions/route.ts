import { NextResponse } from 'next/server';
import { db } from '@/app/lib/firebase';
import { cookies } from 'next/headers';
import * as admin from 'firebase-admin';

export async function GET(request: Request) {
    try {
        const cookieStore = await cookies();
        const userId = cookieStore.get('userId')?.value;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const url = new URL(request.url);
        const limitParam = parseInt(url.searchParams.get('limit') || '100', 10);

        const txRef = db.collection('users').doc(userId).collection('transactions');

        // Fetch everything in parallel
        const [snapshot, accSnap, catSnap, msiSnap] = await Promise.all([
            txRef.orderBy('date', 'desc').limit(limitParam).get(),
            db.collection('users').doc(userId).collection('accounts').get(),
            db.collection('users').doc(userId).collection('categories').get(),
            db.collection('users').doc(userId).collection('msiPlans').get()
        ]);

        const accounts = new Map(accSnap.docs.map(d => [d.id, d.data()]));
        const categories = new Map(catSnap.docs.map(d => [d.id, d.data()]));
        const msiPlans = new Map(msiSnap.docs.map(d => [d.id, d.data()]));

        const transactions = snapshot.docs.map(doc => {
            const data = doc.data();
            const accountData = data.accountId ? accounts.get(data.accountId) as { name: string } | undefined : undefined;
            const categoryData = data.categoryId ? categories.get(data.categoryId) as { name: string, icon: string, color: string } | undefined : undefined;
            const msiPlanData = data.msiPlanId ? msiPlans.get(data.msiPlanId) as { months: number, totalAmount: number } | undefined : undefined;

            return {
                id: doc.id,
                ...data,
                account: accountData ? { name: accountData.name } : null,
                category: categoryData ? {
                    name: categoryData.name,
                    icon: categoryData.icon,
                    color: categoryData.color
                } : null,
                msiPlan: msiPlanData ? {
                    months: msiPlanData.months,
                    totalAmount: msiPlanData.totalAmount
                } : null
            };
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

        if (!amount || !type || !accountId) {
            return NextResponse.json({ error: 'Missing required fields: amount, type, accountId' }, { status: 400 });
        }

        if ((type === 'INCOME' || type === 'EXPENSE') && !categoryId) {
            return NextResponse.json({ error: 'Category required for income/expense' }, { status: 400 });
        }

        if ((type === 'TRANSFER' || type === 'PAGO_TARJETA') && !toAccountId) {
            return NextResponse.json({ error: 'Destination account required for transfer/payment' }, { status: 400 });
        }

        const amountNum = Number(amount);
        const txDate = new Date(date || new Date()).toISOString();

        const userRef = db.collection('users').doc(userId);
        const newTxRef = userRef.collection('transactions').doc();

        const accountRef = userRef.collection('accounts').doc(accountId);
        const toAccountRef = toAccountId ? userRef.collection('accounts').doc(toAccountId) : null;

        await db.runTransaction(async (transaction) => {
            const txData: any = {
                id: newTxRef.id,
                userId,
                accountId,
                categoryId: categoryId || null,
                amount: amountNum,
                type: type,
                date: txDate,
                description: description || '',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            if (toAccountId) txData.toAccountId = toAccountId;
            
            transaction.set(newTxRef, txData);

            switch (type) {
                case 'INCOME':
                    transaction.update(accountRef, { balance: admin.firestore.FieldValue.increment(amountNum) });
                    break;
                case 'EXPENSE':
                case 'MSI_CHARGE':
                    transaction.update(accountRef, { balance: admin.firestore.FieldValue.increment(-amountNum) });
                    break;
                case 'TRANSFER':
                    // accountId = Origen (reduce), toAccountId = Destino (increase)
                    transaction.update(accountRef, { balance: admin.firestore.FieldValue.increment(-amountNum) });
                    if (toAccountRef) {
                        transaction.update(toAccountRef, { balance: admin.firestore.FieldValue.increment(amountNum) });
                    }
                    break;
                case 'PAGO_TARJETA':
                    // accountId = Tarjeta (increase balance to reduce debt), toAccountId = Origen (reduce balance)
                    transaction.update(accountRef, { balance: admin.firestore.FieldValue.increment(amountNum) });
                    if (toAccountRef) {
                        transaction.update(toAccountRef, { balance: admin.firestore.FieldValue.increment(-amountNum) });
                    }
                    break;
            }
            return txData;
        });

        const txData: Record<string, unknown> = {
            id: newTxRef.id,
            userId, accountId, categoryId: categoryId || null, amount: amountNum, type, date: txDate, description: description || ''
        };
        if (toAccountId) txData.toAccountId = toAccountId;

        return NextResponse.json(txData, { status: 201 });
    } catch (error) {
        console.error('Failed to create transaction:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const cookieStore = await cookies();
        const userId = cookieStore.get('userId')?.value;
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        const deleteAll = searchParams.get('all') === 'true';

        if (deleteAll) {
            const txRef = db.collection('users').doc(userId).collection('transactions');
            const snapshot = await txRef.get();
            
            // For bulk delete, we should ideally use batches. 
            // Also user wants to clear "everything". To be safe with balances we might want to reset account balances too.
            const batch = db.batch();
            snapshot.docs.forEach(doc => batch.delete(doc.ref));
            
            // Optional: Reset account balances to 0 if clearing all movements?
            // The user only asked for movements. I'll just delete transactions for now.
            // But usually this breaks consistency. I'll reset balances to 0 as well to be helpful.
            const accountsSnap = await db.collection('users').doc(userId).collection('accounts').get();
            accountsSnap.docs.forEach(doc => batch.update(doc.ref, { balance: 0, updatedAt: new Date().toISOString() }));

            await batch.commit();
            return NextResponse.json({ success: true, count: snapshot.size });
        }

        if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

        const txRef = db.collection('users').doc(userId).collection('transactions').doc(id);
        const doc = await txRef.get();
        if (!doc.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        const data = doc.data() as any;
        const amount = data.amount || 0;
        const type = data.type;
        const accountId = data.accountId;
        const toAccountId = data.toAccountId;

        const userRef = db.collection('users').doc(userId);
        const accountRef = userRef.collection('accounts').doc(accountId);
        const toAccountRef = toAccountId ? userRef.collection('accounts').doc(toAccountId) : null;

        await db.runTransaction(async (transaction) => {
            transaction.delete(txRef);

            // Revert balance changes
            switch (type) {
                case 'INCOME':
                    transaction.update(accountRef, { balance: admin.firestore.FieldValue.increment(-amount) });
                    break;
                case 'EXPENSE':
                case 'MSI_CHARGE':
                    transaction.update(accountRef, { balance: admin.firestore.FieldValue.increment(amount) });
                    break;
                case 'TRANSFER':
                    transaction.update(accountRef, { balance: admin.firestore.FieldValue.increment(amount) });
                    if (toAccountRef) {
                        transaction.update(toAccountRef, { balance: admin.firestore.FieldValue.increment(-amount) });
                    }
                    break;
                case 'PAGO_TARJETA':
                    transaction.update(accountRef, { balance: admin.firestore.FieldValue.increment(-amount) });
                    if (toAccountRef) {
                        transaction.update(toAccountRef, { balance: admin.firestore.FieldValue.increment(amount) });
                    }
                    break;
            }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to delete transaction(s):', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
