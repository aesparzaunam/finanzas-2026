import { getUserId } from '@/app/lib/api-utils';
import { NextResponse } from 'next/server';
import {
    getMsiPlans, getMsiPlanById, createMsiPlan, updateMsiPlan, deleteMsiPlan,
    getAccountById, createTransaction, bulkCreateTransactions, cuid, getDb
} from '@/app/lib/db';

// GET /api/msi — returns all plans with their child transactions
export async function GET() {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const db = getDb();
        const plans = await getMsiPlans(userId);
        const todayStr = new Date().toISOString().slice(0, 10);

        const result = plans.map(plan => {
            const txs = db.prepare(
                `SELECT * FROM NTransaction WHERE msiPlanId = ? AND userId = ? ORDER BY date ASC`
            ).all(plan.id, userId) as { date: string; type: string }[];

            const elapsedMonths = txs.filter(t => t.date <= todayStr && t.type === 'MSI_CHARGE').length;
            return { ...plan, transactions: txs, paidMonths: elapsedMonths };
        });

        return NextResponse.json(result);
    } catch (error) {
        console.error('GET MSI:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// POST /api/msi — create plan + parent tx + N child MSI_CHARGE txs
export async function POST(request: Request) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { totalAmount, months, accountId, categoryId, description, startDate, isImport } = await request.json();

        if (!totalAmount || !months || !accountId) {
            return NextResponse.json({ error: 'Missing required fields: totalAmount, months, accountId' }, { status: 400 });
        }
        if (!Number.isInteger(months) || months < 3 || months > 48) {
            return NextResponse.json({ error: 'Invalid MSI months. Must be between 3 and 48' }, { status: 400 });
        }

        const account = await getAccountById(accountId, userId);
        if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });
        if (account.type !== 'CREDIT') {
            return NextResponse.json({ error: 'MSI only available for credit card accounts' }, { status: 400 });
        }

        const total = Number(totalAmount);
        const monthlyAmount = Math.round((total / months) * 100) / 100;
        const parsedStartDate = startDate ? new Date(startDate) : new Date();

        // Si es producto de una importación, debemos evitar duplicar el plan
        if (isImport) {
            const existingPlans = await getMsiPlans(userId);
            const duplicate = existingPlans.find(p => 
                p.accountId === accountId && 
                Math.abs(Number(p.totalAmount) - total) < 1 && // Margen de error muy estricto (1 peso max)
                Number(p.months) === Number(months) && // El plan debe tener los mismos meses
                p.description.toLowerCase() === (description || '').toLowerCase()
            );
            if (duplicate) {
                // El plan ya existe, retornamos success 200 sin crear nada.
                return NextResponse.json({
                    success: true,
                    msiPlan: { id: duplicate.id },
                    message: 'Plan MSI ya existente. Omitiendo duplicado.'
                }, { status: 200 });
            }
        }

        const planId = cuid();
        const parentTxId = cuid();

        // Create the MSI plan
        const plan = await createMsiPlan(userId, {
            id: planId,
            totalAmount: total,
            months: Number(months),
            monthlyAmount,
            startDate: parsedStartDate.toISOString().slice(0, 10),
            description: description || '',
            accountId,
            categoryId: categoryId || null,
            status: 'ACTIVE',
            paidMonths: 0,
        } as Parameters<typeof createMsiPlan>[1]);

        // Create parent transaction (visual, isParent=true)
        await createTransaction(userId, {
            id: parentTxId,
            accountId,
            categoryId: categoryId || null,
            amount: total,
            type: 'EXPENSE',
            date: parsedStartDate.toISOString().slice(0, 10),
            description: `[MSI ${months}M] ${description || 'Compra a meses'}`,
            msiPlanId: plan.id,
            isParent: 1,
        } as Parameters<typeof createTransaction>[1]);

        // Create N child MSI_CHARGE transactions
        const children = Array.from({ length: months }, (_, i) => {
            const chargeDate = new Date(parsedStartDate);
            chargeDate.setMonth(chargeDate.getMonth() + i);
            return {
                id: cuid(),
                accountId,
                categoryId: categoryId || null,
                amount: monthlyAmount,
                type: 'MSI_CHARGE',
                date: chargeDate.toISOString().slice(0, 10),
                description: `MSI ${i + 1}/${months}: ${description || 'Cargo mensual'}`,
                msiPlanId: plan.id,
                isParent: 0,
                parentId: parentTxId,
            };
        });

        await bulkCreateTransactions(userId, children as Parameters<typeof bulkCreateTransactions>[1]);

        return NextResponse.json({
            success: true,
            msiPlan: { id: plan.id },
            message: `Created MSI plan with ${months} monthly charges of $${monthlyAmount.toFixed(2)}`
        }, { status: 201 });
    } catch (error) {
        console.error('POST MSI:', error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

// PUT /api/msi — update description/categoryId
export async function PUT(request: Request) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { id, description, categoryId } = await request.json();
        if (!id) return NextResponse.json({ error: 'MSI Plan ID is required' }, { status: 400 });

        const existing = await getMsiPlanById(id, userId);
        if (!existing) return NextResponse.json({ error: 'MSI plan not found' }, { status: 404 });

        const updated = await updateMsiPlan(id, userId, {
            description: description !== undefined ? description : existing.description,
            categoryId: categoryId !== undefined ? (categoryId ?? null) : existing.categoryId,
        });

        if (!updated) return NextResponse.json({ error: 'MSI plan not updated' }, { status: 500 });

        return NextResponse.json(updated);
    } catch (error) {
        console.error('PUT MSI:', error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}


// DELETE /api/msi?id=... — delete plan + all related transactions
export async function DELETE(request: Request) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'MSI Plan ID is required' }, { status: 400 });

    try {
        const existing = await getMsiPlanById(id, userId);
        if (!existing) return NextResponse.json({ error: 'MSI plan not found' }, { status: 404 });

        // Delete all related transactions first
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const path = require('path');
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const Database = require('better-sqlite3');
        const dbPath = (process.env.DATABASE_URL ?? '').replace('file:', '') ||
            path.join(process.cwd(), 'prisma', 'finanzas.db');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db: any = Database(dbPath);
        db.prepare(`DELETE FROM NTransaction WHERE msiPlanId = ? AND userId = ?`).run(id, userId);
        db.close();

        await deleteMsiPlan(id, userId);

        return NextResponse.json({ success: true, message: 'MSI plan and all related transactions deleted' });
    } catch (error) {
        console.error('DELETE MSI:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
