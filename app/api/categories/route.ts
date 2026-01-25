import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { cookies } from 'next/headers';

const DEFAULT_CATEGORIES = [
    { name: 'Salary', type: 'INCOME', icon: '💰', color: '#10b981' },
    { name: 'Freelance', type: 'INCOME', icon: '💻', color: '#3b82f6' },
    { name: 'Housing', type: 'EXPENSE', icon: '🏠', color: '#ef4444' },
    { name: 'Food', type: 'EXPENSE', icon: '🍔', color: '#f59e0b' },
    { name: 'Transport', type: 'EXPENSE', icon: '🚗', color: '#6366f1' },
    { name: 'Utilities', type: 'EXPENSE', icon: '💡', color: '#8b5cf6' },
    { name: 'Health', type: 'EXPENSE', icon: '🏥', color: '#ec4899' },
    { name: 'Entertainment', type: 'EXPENSE', icon: '🎬', color: '#14b8a6' },
];

export async function GET() {
    try {
        const cookieStore = await cookies();
        const userId = cookieStore.get('userId')?.value;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        let categories = await prisma.category.findMany({
            where: { userId },
            orderBy: { name: 'asc' },
        });

        if (categories.length === 0) {
            // Seed default categories
            await prisma.category.createMany({
                data: DEFAULT_CATEGORIES.map(c => ({
                    ...c,
                    userId,
                    type: c.type as any
                }))
            });

            categories = await prisma.category.findMany({
                where: { userId },
                orderBy: { name: 'asc' },
            });
        }

        return NextResponse.json(categories);
    } catch (error) {
        console.error('Failed to fetch categories:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
