import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { cookies } from 'next/headers';

// GET: List all MSI plans for the user
export async function GET() {
    try {
        const cookieStore = await cookies();
        const userId = cookieStore.get('userId')?.value;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const msiPlans = await prisma.mSIPlan.findMany({
            where: { userId },
            include: {
                transactions: {
                    orderBy: { date: 'asc' }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json(msiPlans);
    } catch (error) {
        console.error('Failed to fetch MSI plans:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// POST: Create a new MSI purchase
// This creates the MSIPlan and expands it into monthly child transactions
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

        // Validation
        if (!totalAmount || !months || !accountId) {
            return NextResponse.json({ error: 'Missing required fields: totalAmount, months, accountId' }, { status: 400 });
        }

        const validMonths = [3, 6, 9, 12, 18, 24];
        if (!validMonths.includes(months)) {
            return NextResponse.json({ error: 'Invalid MSI months. Must be 3, 6, 9, 12, 18, or 24' }, { status: 400 });
        }

        // Verify account belongs to user and is a credit card
        const account = await prisma.account.findFirst({
            where: { id: accountId, userId }
        });

        if (!account) {
            return NextResponse.json({ error: 'Account not found' }, { status: 404 });
        }

        if (account.type !== 'CREDIT') {
            return NextResponse.json({ error: 'MSI only available for credit card accounts' }, { status: 400 });
        }

        const total = Number(totalAmount);
        const monthlyAmount = Math.round((total / months) * 100) / 100; // Round to 2 decimals
        const parsedStartDate = startDate ? new Date(startDate) : new Date();

        // Create MSI Plan and all child transactions in a transaction
        const result = await prisma.$transaction(async (tx) => {
            // 1. Create the MSI Plan
            const msiPlan = await tx.mSIPlan.create({
                data: {
                    userId,
                    totalAmount: total,
                    months,
                    monthlyAmount,
                    startDate: parsedStartDate,
                    description,
                    accountId,
                    categoryId,
                    status: 'ACTIVE',
                    paidMonths: 0
                }
            });

            // 2. Create the parent transaction (the original purchase - does NOT count as expense)
            const parentTransaction = await tx.transaction.create({
                data: {
                    userId,
                    accountId,
                    categoryId,
                    amount: total,
                    type: 'EXPENSE', // The total purchase
                    date: parsedStartDate,
                    description: `[MSI ${months}M] ${description || 'Compra a meses'}`,
                    msiPlanId: msiPlan.id,
                    isParent: true // Mark as parent - should be excluded from expense calculations
                }
            });

            // 3. Create child transactions for each month
            const childTransactions = [];
            for (let i = 0; i < months; i++) {
                const chargeDate = new Date(parsedStartDate);
                chargeDate.setMonth(chargeDate.getMonth() + i);

                const child = await tx.transaction.create({
                    data: {
                        userId,
                        accountId,
                        categoryId,
                        amount: monthlyAmount,
                        type: 'MSI_CHARGE', // Monthly MSI charge - counts as expense
                        date: chargeDate,
                        description: `MSI ${i + 1}/${months}: ${description || 'Cargo mensual'}`,
                        msiPlanId: msiPlan.id,
                        isParent: false,
                        parentId: parentTransaction.id
                    }
                });
                childTransactions.push(child);
            }

            return { msiPlan, parentTransaction, childTransactions };
        });

        return NextResponse.json({
            success: true,
            msiPlan: result.msiPlan,
            message: `Created MSI plan with ${months} monthly charges of $${monthlyAmount.toFixed(2)}`
        }, { status: 201 });

    } catch (error) {
        console.error('Failed to create MSI plan:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
