import { getUserId } from '@/app/lib/api-utils';
import { NextResponse } from 'next/server';
import { getBudgets, upsertBudget, deleteBudget, getBudgetById, getCategories } from '@/app/lib/db';

function toNumber(v: unknown): number { return Number(v) || 0; }

function pad(n: number) { return String(n).padStart(2, '0'); }

export async function GET() {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const budgets = await getBudgets(userId);
        const categories = await getCategories(userId);
        const catMap = new Map(categories.map(c => [c.id, c]));
        const now = new Date();

        // Import DB singleton for spend queries
        const { default: Database } = await import('better-sqlite3');
        const path = require('path');
        const dbPath = (process.env.DATABASE_URL ?? '').replace('file:', '') ||
            path.join(process.cwd(), 'prisma', 'finanzas.db');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db: any = Database(dbPath);

        const result = budgets.map(budget => {
            const period = budget.period;
            const monthStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
            const yearStr  = `${now.getFullYear()}`;
            const periodKey = period === 'MONTHLY' ? monthStr : yearStr;

            const fromDate = period === 'MONTHLY'
                ? `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`
                : `${now.getFullYear()}-01-01`;
            const toDate = period === 'MONTHLY'
                ? `${now.getFullYear()}-${pad(now.getMonth() + 1)}-31`
                : `${now.getFullYear()}-12-31`;

            const spent: number = db.prepare(
                `SELECT COALESCE(SUM(amount),0) as s FROM NTransaction
                 WHERE userId=? AND categoryId=? AND type IN ('EXPENSE','MSI_CHARGE')
                 AND isParent=0 AND date >= ? AND date <= ?`
            ).get(userId, budget.categoryId, fromDate, toDate)?.s ?? 0;

            const carryOver = toNumber(budget.carryOverAmount);
            const budgetLimit = toNumber(budget.amount);
            const totalAvailable = budgetLimit + carryOver;
            const remaining = totalAvailable - spent;
            const percentage = totalAvailable > 0 ? (spent / totalAvailable) * 100 : 0;

            return {
                ...budget,
                enableCarryOver: Boolean(budget.enableCarryOver),
                category: catMap.get(budget.categoryId),
                spent,
                remaining,
                totalAvailable,
                percentage,
                periodKey,
            };
        });

        db.close();
        return NextResponse.json(result);
    } catch (error) {
        console.error('GET Budgets:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { categoryId, amount, period, enableCarryOver } = await request.json();
        if (!categoryId || !amount) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const budget = await upsertBudget(userId, categoryId, {
            amount: Number(amount),
            period: period || 'MONTHLY',
            enableCarryOver: enableCarryOver !== false ? 1 : 0,
            carryOverAmount: 0,
        });
        return NextResponse.json({ ...budget, enableCarryOver: Boolean(budget.enableCarryOver) }, { status: 201 });
    } catch (error) {
        console.error('POST Budget:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { id, amount, period, enableCarryOver } = await request.json();
        if (!id) return NextResponse.json({ error: 'Budget ID is required' }, { status: 400 });

        const existing = await getBudgetById(id, userId);
        if (!existing) return NextResponse.json({ error: 'Budget not found' }, { status: 404 });

        const updated = await upsertBudget(userId, existing.categoryId, {
            amount: amount !== undefined ? Number(amount) : existing.amount,
            period: period !== undefined ? period : existing.period,
            enableCarryOver: enableCarryOver !== undefined ? (enableCarryOver ? 1 : 0) : existing.enableCarryOver,
        });
        return NextResponse.json({ ...updated, enableCarryOver: Boolean(updated.enableCarryOver) });
    } catch (error) {
        console.error('PUT Budget:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Budget ID is required' }, { status: 400 });

    const ok = await deleteBudget(id, userId);
    if (!ok) return NextResponse.json({ error: 'Budget not found' }, { status: 404 });
    return NextResponse.json({ success: true });
}
