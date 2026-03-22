import { NextResponse } from 'next/server';
import { db } from '@/app/lib/firebase';
import { getUserId, unauthorizedResponse, internalErrorResponse } from '@/app/lib/api-utils';

// PATCH /api/transactions/tags?id=<txId>  { tags: string[] }
export async function PATCH(request: Request) {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorizedResponse();

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

        const { tags } = await request.json();
        if (!Array.isArray(tags)) {
            return NextResponse.json({ error: 'tags must be an array' }, { status: 400 });
        }

        // Sanitize: lowercase, no spaces, max 20 chars, max 10 tags
        const cleaned = [...new Set(
            tags
                .map((t: string) => t.trim().toLowerCase().replace(/\s+/g, '-').slice(0, 20))
                .filter(Boolean)
        )].slice(0, 10);

        const txRef = db.collection('users').doc(userId).collection('transactions').doc(id);
        const doc = await txRef.get();
        if (!doc.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        await txRef.update({ tags: cleaned, updatedAt: new Date().toISOString() });

        return NextResponse.json({ id, tags: cleaned });
    } catch (error) {
        return internalErrorResponse('PATCH transaction tags', error);
    }
}

// GET /api/transactions/tags  – devuelve todos los tags únicos del usuario
export async function GET() {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorizedResponse();

        const snapshot = await db
            .collection('users')
            .doc(userId)
            .collection('transactions')
            .where('tags', '!=', null)
            .get();

        const allTags = new Set<string>();
        snapshot.docs.forEach(doc => {
            const data = doc.data();
            if (Array.isArray(data.tags)) {
                data.tags.forEach((t: string) => allTags.add(t));
            }
        });

        return NextResponse.json(Array.from(allTags).sort());
    } catch (error) {
        return internalErrorResponse('GET transaction tags', error);
    }
}
