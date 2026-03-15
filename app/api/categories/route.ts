import { NextResponse } from 'next/server';
import { db } from '@/app/lib/firebase';
import { getUserId, unauthorizedResponse, internalErrorResponse } from '@/app/lib/api-utils';
import { Category } from '@/app/lib/types';

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
        const userId = await getUserId();
        if (!userId) return unauthorizedResponse();

        const categoriesRef = db.collection('users').doc(userId).collection('categories');
        const snapshot = await categoriesRef.orderBy('name', 'asc').get();

        let categories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (categories.length === 0) {
            // Seed default categories
            const batch = db.batch();
            for (const cat of DEFAULT_CATEGORIES) {
                const newCatRef = categoriesRef.doc();
                const catData: Category = {
                    ...cat,
                    id: newCatRef.id,
                    userId,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                } as Category;
                batch.set(newCatRef, catData);
            }
            await batch.commit();

            const refreshedSnapshot = await categoriesRef.orderBy('name', 'asc').get();
            categories = refreshedSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        }

        return NextResponse.json(categories);
    } catch (error) {
        return internalErrorResponse('GET Categories', error);
    }
}
