import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { cookies } from 'next/headers';

interface BudgetRecord {
    id: string;
    userId: string;
    categoryId: string | null;
    amount: { toNumber?: () => number } | number;
    period: string;
    enableCarryOver: boolean;
    carryOverAmount: { toNumber?: () => number } | number;
    lastCarryOverAt: Date | null;
    category: { name: string; icon: string | null; color: string | null } | null;
}

interface TransactionRecord {
    type: string;
    isParent: boolean;
    amount: { toNumber?: () => number } | number;
}

// Helper to get number from Decimal
function toNumber(val: { toNumber?: () => number } | number): number {
    if (typeof val === 'number') return val;
    if (val && typeof val.toNumber === 'function') return val.toNumber();
    return Number(val);
}

export async function GET() {
    try {
        const cookieStore = await cookies();
        const userId = cookieStore.get('userId')?.value;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const budgets = await prisma.budget.findMany({
            where: { userId },
            include: {
                category: { select: { name: true, icon: true, color: true } }
            }
        });

        const now = new Date();

        // Calculate spent and carry-over for each budget
        const budgetsWithStatus = await Promise.all(budgets.map(async (budget: BudgetRecord) => {
            let startDate, endDate, prevStartDate, prevEndDate;

            if (budget.period === 'MONTHLY') {
                // Current month
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                // Previous month
                prevStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                prevEndDate = new Date(now.getFullYear(), now.getMonth(), 0);
            } else {
                // Current year
                startDate = new Date(now.getFullYear(), 0, 1);
                endDate = new Date(now.getFullYear(), 11, 31);
                // Previous year
                prevStartDate = new Date(now.getFullYear() - 1, 0, 1);
                prevEndDate = new Date(now.getFullYear() - 1, 11, 31);
            }

            // Calculate carry-over from previous period (if enabled and not yet calculated this period)
            let carryOver = toNumber(budget.carryOverAmount);
            const budgetLimit = toNumber(budget.amount);

            // Check if we need to recalculate carry-over
            const periodStart = budget.period === 'MONTHLY'
                ? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
                : `${now.getFullYear()}`;

            const lastCalc = budget.lastCarryOverAt
                ? (budget.period === 'MONTHLY'
                    ? `${budget.lastCarryOverAt.getFullYear()}-${String(budget.lastCarryOverAt.getMonth() + 1).padStart(2, '0')}`
                    : `${budget.lastCarryOverAt.getFullYear()}`)
                : null;

            if (budget.enableCarryOver && lastCalc !== periodStart) {
                // Calculate previous period's remaining budget
                const prevTransactions = await prisma.transaction.findMany({
                    where: {
                        userId,
                        categoryId: budget.categoryId,
                        type: { in: ['EXPENSE', 'MSI_CHARGE'] },
                        date: { gte: prevStartDate, lte: prevEndDate }
                    }
                });

                let prevSpent = 0;
                prevTransactions.forEach((tx: TransactionRecord) => {
                    if (tx.type === 'EXPENSE' && !tx.isParent) {
                        prevSpent += toNumber(tx.amount);
                    } else if (tx.type === 'MSI_CHARGE') {
                        prevSpent += toNumber(tx.amount);
                    }
                });

                // Carry-over = previous limit + previous carry-over - previous spent
                const prevAvailable = budgetLimit + carryOver - prevSpent;
                carryOver = Math.max(0, prevAvailable); // Don't carry negative

                // Update the budget with new carry-over
                await prisma.budget.update({
                    where: { id: budget.id },
                    data: {
                        carryOverAmount: carryOver,
                        lastCarryOverAt: new Date()
                    }
                });
            }

            // Get current period's spending
            const transactions = await prisma.transaction.findMany({
                where: {
                    userId,
                    categoryId: budget.categoryId,
                    type: { in: ['EXPENSE', 'MSI_CHARGE'] },
                    date: { gte: startDate, lte: endDate }
                }
            });

            let spent = 0;
            transactions.forEach((tx: TransactionRecord) => {
                if (tx.type === 'EXPENSE' && !tx.isParent) {
                    spent += toNumber(tx.amount);
                } else if (tx.type === 'MSI_CHARGE') {
                    spent += toNumber(tx.amount);
                }
            });

            // Total available = base limit + carry-over
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

        // Check if budget already exists for this category
        const existing = await prisma.budget.findFirst({
            where: { userId, categoryId }
        });

        if (existing) {
            return NextResponse.json({ error: 'Budget already exists for this category' }, { status: 400 });
        }

        const budget = await prisma.budget.create({
            data: {
                userId,
                categoryId,
                amount: Number(amount),
                period: period || 'MONTHLY',
                enableCarryOver: enableCarryOver !== false, // Default true
                carryOverAmount: 0
            }
        });

        return NextResponse.json(budget, { status: 201 });
    } catch (error) {
        console.error('Failed to create budget:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
