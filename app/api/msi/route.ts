import { NextResponse } from 'next/server';
import { db } from '@/app/lib/firebase';
import { cookies } from 'next/headers';

export async function GET() {
    try {
        const cookieStore = await cookies();
        const userId = cookieStore.get('userId')?.value;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const msiPlansRef = db.collection('users').doc(userId).collection('msiPlans');
        const snapshot = await msiPlansRef.orderBy('createdAt', 'desc').get();
        const msiPlans = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const txRef = db.collection('users').doc(userId).collection('transactions');
        for (const plan of msiPlans) {
            const txSnap = await txRef.where('msiPlanId', '==', plan.id).get();
            const txs = txSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            // Sort in memory to avoid requiring a Firestore composite index (msiPlanId, date)
            txs.sort((a, b) => new Date((a as unknown as { date: string }).date).getTime() - new Date((b as unknown as { date: string }).date).getTime());
            (plan as Record<string, unknown>).transactions = txs;
        }

        return NextResponse.json(msiPlans);
    } catch (error) {
        console.error('Failed to fetch MSI plans:', error);
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

        const {
            totalAmount,
            months,
            accountId,
            categoryId,
            description,
            startDate
        } = await request.json();

        if (!totalAmount || !months || !accountId) {
            return NextResponse.json({ error: 'Missing required fields: totalAmount, months, accountId' }, { status: 400 });
        }

        if (!Number.isInteger(months) || months < 3 || months > 48) {
            return NextResponse.json({ error: 'Invalid MSI months. Must be between 3 and 48' }, { status: 400 });
        }

        const accountRef = db.collection('users').doc(userId).collection('accounts').doc(accountId);
        const accountDoc = await accountRef.get();

        if (!accountDoc.exists) {
            return NextResponse.json({ error: 'Account not found' }, { status: 404 });
        }

        const accountD = accountDoc.data();
        if (accountD?.type !== 'CREDIT') {
            return NextResponse.json({ error: 'MSI only available for credit card accounts' }, { status: 400 });
        }

        const total = Number(totalAmount);
        const monthlyAmount = Math.round((total / months) * 100) / 100;
        const parsedStartDate = startDate ? new Date(startDate) : new Date();

        const userRef = db.collection('users').doc(userId);
        const msiPlanRef = userRef.collection('msiPlans').doc();
        const parentTxRef = userRef.collection('transactions').doc();

        await db.runTransaction(async (transaction) => {
            const msiData = {
                id: msiPlanRef.id,
                userId,
                totalAmount: total,
                months: Number(months),
                monthlyAmount,
                startDate: parsedStartDate.toISOString(),
                description: description || '',
                accountId,
                categoryId: categoryId || null,
                status: 'ACTIVE',
                paidMonths: 0,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            transaction.set(msiPlanRef, msiData);

            const parentTxData = {
                id: parentTxRef.id,
                userId,
                accountId,
                categoryId: categoryId || null,
                amount: total,
                type: 'EXPENSE',
                date: parsedStartDate.toISOString(),
                description: `[MSI ${months}M] ${description || 'Compra a meses'}`,
                msiPlanId: msiPlanRef.id,
                isParent: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            transaction.set(parentTxRef, parentTxData);

            for (let i = 0; i < months; i++) {
                const chargeDate = new Date(parsedStartDate);
                chargeDate.setMonth(chargeDate.getMonth() + i);

                const childRef = userRef.collection('transactions').doc();
                const childData = {
                    id: childRef.id,
                    userId,
                    accountId,
                    categoryId: categoryId || null,
                    amount: monthlyAmount,
                    type: 'MSI_CHARGE',
                    date: chargeDate.toISOString(),
                    description: `MSI ${i + 1}/${months}: ${description || 'Cargo mensual'}`,
                    msiPlanId: msiPlanRef.id,
                    isParent: false,
                    parentId: parentTxRef.id,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                transaction.set(childRef, childData);
            }
        });

        return NextResponse.json({
            success: true,
            msiPlan: { id: msiPlanRef.id },
            message: `Created MSI plan with ${months} monthly charges of $${monthlyAmount.toFixed(2)}`
        }, { status: 201 });

    } catch (error) {
        console.error('Failed to create MSI plan:', error);
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

        const { id, description, categoryId } = await request.json();

        if (!id) {
            return NextResponse.json({ error: 'MSI Plan ID is required' }, { status: 400 });
        }

        const msiPlanRef = db.collection('users').doc(userId).collection('msiPlans').doc(id);
        const doc = await msiPlanRef.get();

        if (!doc.exists) {
            return NextResponse.json({ error: 'MSI plan not found' }, { status: 404 });
        }

        const updateData: Record<string, string | null> = {
            updatedAt: new Date().toISOString()
        };
        if (description !== undefined) updateData.description = description;
        if (categoryId !== undefined) updateData.categoryId = categoryId ?? null;

        await db.runTransaction(async (transaction) => {
            transaction.update(msiPlanRef, updateData);

            if (description !== undefined) {
                const txSnap = await db.collection('users').doc(userId).collection('transactions')
                    .where('msiPlanId', '==', id)
                    .get();

                txSnap.docs.forEach(txDoc => {
                    const txData = txDoc.data();
                    let newDesc = txData.description;
                    if (txData.isParent) {
                        newDesc = `[MSI ${txData.description.split(']')[0].split('MSI ')[1]}M] ${description}`;
                    } else {
                        newDesc = `MSI ${txData.description.split(':')[0].split('MSI ')[1]}: ${description}`;
                    }
                    transaction.update(txDoc.ref, { description: newDesc, updatedAt: new Date().toISOString() });
                });
            }
        });

        return NextResponse.json({ id, ...doc.data(), ...updateData });
    } catch (error) {
        console.error('Failed to update MSI plan:', error);
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
            return NextResponse.json({ error: 'MSI Plan ID is required' }, { status: 400 });
        }

        const msiPlanRef = db.collection('users').doc(userId).collection('msiPlans').doc(id);
        const doc = await msiPlanRef.get();

        if (!doc.exists) {
            return NextResponse.json({ error: 'MSI plan not found' }, { status: 404 });
        }

        await db.runTransaction(async (transaction) => {
            // Find and delete all related transactions
            const txSnap = await db.collection('users').doc(userId).collection('transactions')
                .where('msiPlanId', '==', id)
                .get();

            txSnap.docs.forEach(txDoc => {
                transaction.delete(txDoc.ref);
            });

            // Delete the plan
            transaction.delete(msiPlanRef);
        });

        return NextResponse.json({
            success: true,
            message: 'MSI plan and all related transactions deleted'
        });
    } catch (error) {
        console.error('Failed to delete MSI plan:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
