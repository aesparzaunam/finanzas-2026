import { NextResponse } from 'next/server';
import { db } from '@/app/lib/firebase';
import { cookies } from 'next/headers';

// Helper to get number from string
function toNumber(val: string | number): number {
    return Number(val) || 0;
}

export async function GET() {
    try {
        const cookieStore = await cookies();
        const userId = cookieStore.get('userId')?.value;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const budgetsRef = db.collection('users').doc(userId).collection('budgets');
        const budgetSnap = await budgetsRef.get();
        const budgets = budgetSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const catRef = db.collection('users').doc(userId).collection('categories');
        const catSnap = await catRef.get();
        const categories = new Map(catSnap.docs.map(doc => [doc.id, doc.data()]));

        // Attach category metadata
        budgets.forEach((b: any) => {
            if (b.categoryId && categories.has(b.categoryId)) {
                b.category = categories.get(b.categoryId);
            }
        });

        const now = new Date();

        // Calculate spent and carry-over for each budget
        const budgetsWithStatus = await Promise.all(budgets.map(async (budget: any) => {
            let startDate: Date, endDate: Date, prevStartDate: Date, prevEndDate: Date;

            if (budget.period === 'MONTHLY') {
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
                prevStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                prevEndDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
            } else {
                startDate = new Date(now.getFullYear(), 0, 1);
                endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
                prevStartDate = new Date(now.getFullYear() - 1, 0, 1);
                prevEndDate = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59);
            }

            let carryOver = toNumber(budget.carryOverAmount);
            const budgetLimit = toNumber(budget.amount);

            const periodStart = budget.period === 'MONTHLY'
                ? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
                : `${now.getFullYear()}`;

            let lastCalcDateStr = budget.lastCarryOverAt;
            const lastCalcDate = lastCalcDateStr ? new Date(lastCalcDateStr) : null;
            const lastCalc = lastCalcDate
                ? (budget.period === 'MONTHLY'
                    ? `${lastCalcDate.getFullYear()}-${String(lastCalcDate.getMonth() + 1).padStart(2, '0')}`
                    : `${lastCalcDate.getFullYear()}`)
                : null;

            const transactionsRef = db.collection('users').doc(userId).collection('transactions')
                .where('categoryId', '==', budget.categoryId)
                .where('type', 'in', ['EXPENSE', 'MSI_CHARGE']);

            if (budget.enableCarryOver && lastCalc !== periodStart) {
                const prevSnap = await transactionsRef
                    .where('date', '>=', prevStartDate.toISOString())
                    .where('date', '<=', prevEndDate.toISOString())
                    .get();

                let prevSpent = 0;
                prevSnap.docs.forEach((doc) => {
                    const tx = doc.data();
                    if (tx.type === 'EXPENSE' && !tx.isParent) {
                        prevSpent += toNumber(tx.amount);
                    } else if (tx.type === 'MSI_CHARGE') {
                        prevSpent += toNumber(tx.amount);
                    }
                });

                const prevAvailable = budgetLimit + carryOver - prevSpent;
                carryOver = Math.max(0, prevAvailable);

                await budgetsRef.doc(budget.id).update({
                    carryOverAmount: carryOver,
                    lastCarryOverAt: new Date().toISOString()
                });
            }

            const currSnap = await transactionsRef
                .where('date', '>=', startDate.toISOString())
                .where('date', '<=', endDate.toISOString())
                .get();

            let spent = 0;
            currSnap.docs.forEach((doc) => {
                const tx = doc.data();
                if (tx.type === 'EXPENSE' && !tx.isParent) {
                    spent += toNumber(tx.amount);
                } else if (tx.type === 'MSI_CHARGE') {
                    spent += toNumber(tx.amount);
                }
            });

            const totalAvailable = budgetLimit + carryOver;
            const remaining = totalAvailable - spent;
            const percentage = (spent / totalAvailable) * 100;

            return {
                ...budget,
                amount: budgetLimit,
                carryOverAmount: carryOver,
                spent,
                remaining,
                totalAvailable,
                percentage
            };
        }));

        return NextResponse.json(budgetsWithStatus);
    } catch (error) {
        console.error('Failed to fetch budgets:', error);
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

        const { categoryId, amount, period, enableCarryOver } = await request.json();

        if (!categoryId || !amount) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const budgetsRef = db.collection('users').doc(userId).collection('budgets');
        const existingSnap = await budgetsRef.where('categoryId', '==', categoryId).get();

        if (!existingSnap.empty) {
            return NextResponse.json({ error: 'Budget already exists for this category' }, { status: 400 });
        }

        const newBudgetRef = budgetsRef.doc();
        const budgetData = {
            id: newBudgetRef.id,
            userId,
            categoryId,
            amount: Number(amount),
            period: period || 'MONTHLY',
            enableCarryOver: enableCarryOver !== false,
            carryOverAmount: 0,
            lastCarryOverAt: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        await newBudgetRef.set(budgetData);

        return NextResponse.json(budgetData, { status: 201 });
    } catch (error) {
        console.error('Failed to create budget:', error);
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

        const { id, amount, period, enableCarryOver } = await request.json();

        if (!id) {
            return NextResponse.json({ error: 'Budget ID is required' }, { status: 400 });
        }

        const budgetRef = db.collection('users').doc(userId).collection('budgets').doc(id);
        const doc = await budgetRef.get();

        if (!doc.exists) {
            return NextResponse.json({ error: 'Budget not found' }, { status: 404 });
        }

        const updateData: any = {
            updatedAt: new Date().toISOString()
        };
        if (amount !== undefined) updateData.amount = Number(amount);
        if (period !== undefined) updateData.period = period;
        if (enableCarryOver !== undefined) updateData.enableCarryOver = enableCarryOver;

        await budgetRef.update(updateData);

        return NextResponse.json({ id, ...doc.data(), ...updateData });
    } catch (error) {
        console.error('Failed to update budget:', error);
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
            return NextResponse.json({ error: 'Budget ID is required' }, { status: 400 });
        }

        const budgetRef = db.collection('users').doc(userId).collection('budgets').doc(id);
        const doc = await budgetRef.get();

        if (!doc.exists) {
            return NextResponse.json({ error: 'Budget not found' }, { status: 404 });
        }

        await budgetRef.delete();

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to delete budget:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
