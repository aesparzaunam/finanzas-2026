import { getUserId } from '@/app/lib/api-utils';
import { NextResponse } from 'next/server';
import {
    getTransactions, getTransactionById,
    getAccounts, getCategories, getMsiPlans
} from '@/app/lib/db';

// GET /api/transactions
// Query params: limit, after(ISO date cursor), from, to, type, accountId, categoryId, q
export async function GET(request: Request) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const url = new URL(request.url);
        const limit   = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200);
        const after   = url.searchParams.get('after') || undefined;
        const from    = url.searchParams.get('from') || undefined;
        // Si no mandan toDate, no queremos mostrar transacciones del futuro generadas por MSI
        const to      = url.searchParams.get('to') || new Date().toISOString().slice(0, 10);
        const type    = url.searchParams.get('type') || undefined;
        const accountId  = url.searchParams.get('accountId') || undefined;
        const categoryId = url.searchParams.get('categoryId') || undefined;
        const q = url.searchParams.get('q')?.toLowerCase().trim() || undefined;

        const [{ transactions, hasMore }, accounts, categories, plans] = await Promise.all([
            getTransactions(userId, { limit, afterDate: after, fromDate: from, toDate: to, type, accountId, categoryId, q }),
            getAccounts(userId),
            getCategories(userId),
            getMsiPlans(userId),
        ]);

        const accountMap  = new Map(accounts.map(a => [a.id, a]));
        const categoryMap = new Map(categories.map(c => [c.id, c]));
        const planMap     = new Map(plans.map(p => [p.id, p]));

        const enriched = transactions.map(tx => ({
            ...tx,
            isParent: Boolean(tx.isParent),
            isDeductible: Boolean(tx.isDeductible),
            tags: tx.tags ? JSON.parse(tx.tags) : [],
            account:  tx.accountId  ? { name: accountMap.get(tx.accountId)?.name }  : null,
            category: tx.categoryId ? {
                name:  categoryMap.get(tx.categoryId)?.name,
                icon:  categoryMap.get(tx.categoryId)?.icon,
                color: categoryMap.get(tx.categoryId)?.color,
            } : null,
            msiPlan: tx.msiPlanId ? {
                months:      planMap.get(tx.msiPlanId)?.months,
                totalAmount: planMap.get(tx.msiPlanId)?.totalAmount,
            } : null,
        }));

        const nextCursor = hasMore && enriched.length > 0
            ? enriched[enriched.length - 1].date
            : null;

        return NextResponse.json({ transactions: enriched, hasMore, nextCursor });
    } catch (error) {
        console.error('GET transactions:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// POST /api/transactions
export async function POST(request: Request) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        const { accountId, categoryId, amount, type, date, description,
                toAccountId, tags, isParent, msiPlanId, parentId, isDeductible } = body;

        if (!accountId || !amount || !type || !date) {
            return NextResponse.json({ error: 'Missing required fields: accountId, amount, type, date' }, { status: 400 });
        }
        const validTypes = ['INCOME', 'EXPENSE', 'TRANSFER', 'PAGO_TARJETA', 'MSI_CHARGE'];
        if (!validTypes.includes(type)) {
            return NextResponse.json({ error: `Invalid type. Use: ${validTypes.join(', ')}` }, { status: 400 });
        }

        const numAmount = Math.abs(parseFloat(amount));
        const dateStr = new Date(date).toISOString().slice(0, 10);

        // SQLite direct for atomic balance update
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const path = require('path');
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const Database = require('better-sqlite3');
        const dbPath = (process.env.DATABASE_URL ?? '').replace('file:', '') ||
            path.join(process.cwd(), 'prisma', 'finanzas.db');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db: any = Database(dbPath);
        db.pragma('foreign_keys = ON');

        const tx = db.transaction(() => {
            // Check account exists
            const account = db.prepare('SELECT * FROM Account WHERE id = ? AND userId = ?').get(accountId, userId);
            if (!account) throw new Error('Account not found');

            // Insert transaction
            const tx = createTransactionSync(db, userId, {
                accountId, categoryId: categoryId || null,
                amount: numAmount, type, date: dateStr,
                description: description || '',
                tags: tags ? JSON.stringify(tags) : null,
                isParent: isParent ? 1 : 0,
                msiPlanId: msiPlanId || null,
                parentId: parentId || null,
                toAccountId: toAccountId || null,
                isDeductible: isDeductible ? 1 : 0,
            });

            // Update account balance
            if (!isParent) {
                if (type === 'INCOME') {
                    db.prepare('UPDATE Account SET balance = balance + ?, updatedAt = datetime(\'now\') WHERE id = ? AND userId = ?').run(numAmount, accountId, userId);
                } else if (['EXPENSE', 'MSI_CHARGE', 'PAGO_TARJETA'].includes(type)) {
                    db.prepare('UPDATE Account SET balance = balance - ?, updatedAt = datetime(\'now\') WHERE id = ? AND userId = ?').run(numAmount, accountId, userId);
                } else if (type === 'TRANSFER' && toAccountId) {
                    db.prepare('UPDATE Account SET balance = balance - ?, updatedAt = datetime(\'now\') WHERE id = ? AND userId = ?').run(numAmount, accountId, userId);
                    db.prepare('UPDATE Account SET balance = balance + ?, updatedAt = datetime(\'now\') WHERE id = ? AND userId = ?').run(numAmount, toAccountId, userId);
                }
            }
            return tx;
        });

        const newTx = tx();
        db.close();
        return NextResponse.json({ id: newTx.id, success: true }, { status: 201 });
    } catch (error) {
        console.error('POST transaction:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createTransactionSync(db: any, userId: string, data: Record<string, unknown>) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { randomBytes } = require('crypto');
    const id = 'c' + randomBytes(11).toString('hex');
    const ts = new Date().toISOString();
    db.prepare(`INSERT INTO NTransaction (id,userId,accountId,categoryId,amount,type,date,description,tags,msiPlanId,isParent,parentId,toAccountId,recurringPaymentId,isDeductible,createdById,importSource,createdAt,updatedAt)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,null,?,null,?,?,?)`)
        .run(id, userId, data.accountId, data.categoryId, data.amount, data.type, data.date,
             data.description, data.tags, data.msiPlanId, data.isParent, data.parentId,
             data.toAccountId, data.isDeductible, data.importSource || null, ts, ts);
    return { id };
}

// PATCH /api/transactions?id=... — update a transaction
export async function PATCH(request: Request) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Transaction ID required' }, { status: 400 });

    try {
        const body = await request.json();
        const { description, amount, type, accountId, categoryId, date, toAccountId, tags, isDeductible } = body;

        const existing = await getTransactionById(id, userId);
        if (!existing) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });

        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const path = require('path');
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const Database = require('better-sqlite3');
        const dbPath = (process.env.DATABASE_URL ?? '').replace('file:', '') ||
            path.join(process.cwd(), 'prisma', 'finanzas.db');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db: any = Database(dbPath);
        db.pragma('foreign_keys = ON');

        const tx = db.transaction(() => {
            const oldAmount  = Number(existing.amount);
            const oldType    = existing.type;
            const oldAccId   = existing.accountId;
            const oldToAccId = existing.toAccountId;

            // Revert old balance effect
            if (!existing.isParent) {
                if (oldType === 'INCOME') {
                    db.prepare('UPDATE Account SET balance = balance - ? WHERE id = ? AND userId = ?').run(oldAmount, oldAccId, userId);
                } else if (['EXPENSE', 'MSI_CHARGE', 'PAGO_TARJETA'].includes(oldType)) {
                    db.prepare('UPDATE Account SET balance = balance + ? WHERE id = ? AND userId = ?').run(oldAmount, oldAccId, userId);
                } else if (oldType === 'TRANSFER' && oldToAccId) {
                    db.prepare('UPDATE Account SET balance = balance + ? WHERE id = ? AND userId = ?').run(oldAmount, oldAccId, userId);
                    db.prepare('UPDATE Account SET balance = balance - ? WHERE id = ? AND userId = ?').run(oldAmount, oldToAccId, userId);
                }
            }

            // Apply new balance effect
            const newAmount  = amount ? Math.abs(parseFloat(amount)) : oldAmount;
            const newType    = type ?? oldType;
            const newAccId   = accountId ?? oldAccId;
            const newToAccId = toAccountId !== undefined ? toAccountId : oldToAccId;

            if (!existing.isParent) {
                if (newType === 'INCOME') {
                    db.prepare('UPDATE Account SET balance = balance + ? WHERE id = ? AND userId = ?').run(newAmount, newAccId, userId);
                } else if (['EXPENSE', 'MSI_CHARGE', 'PAGO_TARJETA'].includes(newType)) {
                    db.prepare('UPDATE Account SET balance = balance - ? WHERE id = ? AND userId = ?').run(newAmount, newAccId, userId);
                } else if (newType === 'TRANSFER' && newToAccId) {
                    db.prepare('UPDATE Account SET balance = balance - ? WHERE id = ? AND userId = ?').run(newAmount, newAccId, userId);
                    db.prepare('UPDATE Account SET balance = balance + ? WHERE id = ? AND userId = ?').run(newAmount, newToAccId, userId);
                }
            }

            // Update transaction
            db.prepare(`UPDATE NTransaction SET
                description=?, amount=?, type=?, accountId=?, categoryId=?,
                date=?, toAccountId=?, tags=?, isDeductible=?, updatedAt=datetime('now')
                WHERE id=? AND userId=?`)
                .run(
                    description ?? existing.description,
                    newAmount, newType, newAccId,
                    categoryId !== undefined ? categoryId : existing.categoryId,
                    date ? new Date(date).toISOString().slice(0, 10) : existing.date,
                    newToAccId,
                    tags !== undefined ? JSON.stringify(tags) : existing.tags,
                    isDeductible !== undefined ? (isDeductible ? 1 : 0) : existing.isDeductible,
                    id, userId
                );
        });

        tx();
        db.close();
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('PATCH transaction:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// DELETE /api/transactions?id=... or ?all=true
export async function DELETE(request: Request) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const deleteAll = searchParams.get('all') === 'true';

    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const path = require('path');
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const Database = require('better-sqlite3');
        const dbPath = (process.env.DATABASE_URL ?? '').replace('file:', '') ||
            path.join(process.cwd(), 'prisma', 'finanzas.db');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db: any = Database(dbPath);

        if (deleteAll) {
            const result = db.prepare('DELETE FROM NTransaction WHERE userId = ?').run(userId);
            db.close();
            return NextResponse.json({ success: true, deleted: result.changes });
        }

        if (!id) {
            db.close();
            return NextResponse.json({ error: 'Transaction ID required' }, { status: 400 });
        }

        const existing = db.prepare('SELECT * FROM NTransaction WHERE id = ? AND userId = ?').get(id, userId);
        if (!existing) {
            db.close();
            return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
        }

        const tx = db.transaction(() => {
            const amount = Number(existing.amount);
            if (!existing.isParent) {
                if (existing.type === 'INCOME') {
                    db.prepare('UPDATE Account SET balance = balance - ? WHERE id = ? AND userId = ?').run(amount, existing.accountId, userId);
                } else if (['EXPENSE', 'MSI_CHARGE', 'PAGO_TARJETA'].includes(existing.type)) {
                    db.prepare('UPDATE Account SET balance = balance + ? WHERE id = ? AND userId = ?').run(amount, existing.accountId, userId);
                } else if (existing.type === 'TRANSFER' && existing.toAccountId) {
                    db.prepare('UPDATE Account SET balance = balance + ? WHERE id = ? AND userId = ?').run(amount, existing.accountId, userId);
                    db.prepare('UPDATE Account SET balance = balance - ? WHERE id = ? AND userId = ?').run(amount, existing.toAccountId, userId);
                }
            }
            db.prepare('DELETE FROM NTransaction WHERE id = ? AND userId = ?').run(id, userId);
        });

        tx();
        db.close();
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('DELETE transaction:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
