import { getUserId } from '@/app/lib/api-utils';
import { NextResponse } from 'next/server';

export const maxDuration = 30;

// POST /api/transactions/ai-autotitle
// Body: { amount: number; type: string; categoryId: string; accountId: string; date: string }
// Respuesta: { title: string; confidence: number }
export async function POST(request: Request) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const { amount, type, categoryId, accountId, date } = body;

    if (!amount || !type) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require('better-sqlite3');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path');
    const dbPath = (process.env.DATABASE_URL ?? '').replace('file:', '') ||
        path.join(process.cwd(), 'prisma', 'finanzas.db');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db: any = Database(dbPath);

    try {
        // Obtener nombre de categoría y cuenta
        const category: { name: string } | null = categoryId
            ? db.prepare('SELECT name FROM Category WHERE id = ? AND userId = ?').get(categoryId, userId) as { name: string }
            : null;
        const account: { name: string } | null = accountId
            ? db.prepare('SELECT name FROM Account WHERE id = ? AND userId = ?').get(accountId, userId) as { name: string }
            : null;

        const dateObj   = date ? new Date(date) : new Date();
        const days      = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
        const dayOfWeek = days[dateObj.getDay()];

        const { generateTransactionTitle } = await import('@/app/lib/ai-utils');
        const result = await generateTransactionTitle({
            amount:       Number(amount),
            type:         type as 'EXPENSE' | 'INCOME',
            categoryName: category?.name ?? 'Sin categoría',
            dayOfWeek,
            accountName:  account?.name ?? 'Cuenta',
        });

        return NextResponse.json(result);
    } catch (error) {
        console.error('[ai-autotitle] Error:', error);
        return NextResponse.json({ title: '', confidence: 0 }, { status: 500 });
    }
}
