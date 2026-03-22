import { NextResponse } from 'next/server';
import { db } from '@/app/lib/firebase';
import { getUserId, unauthorizedResponse, internalErrorResponse } from '@/app/lib/api-utils';

// POST /api/notifications/subscribe  { subscription: PushSubscriptionJSON }
export async function POST(request: Request) {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorizedResponse();

        const { subscription } = await request.json();
        if (!subscription?.endpoint) {
            return NextResponse.json({ error: 'Invalid subscription object' }, { status: 400 });
        }

        // Guardar la suscripción en Firestore
        const subRef = db
            .collection('users')
            .doc(userId)
            .collection('push_subscriptions')
            .doc();

        await subRef.set({
            id: subRef.id,
            userId,
            subscription,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        });

        return NextResponse.json({ success: true, id: subRef.id });
    } catch (error) {
        return internalErrorResponse('POST subscribe', error);
    }
}

// DELETE /api/notifications/subscribe?endpoint=<encoded_endpoint>
export async function DELETE(request: Request) {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorizedResponse();

        const { searchParams } = new URL(request.url);
        const endpoint = searchParams.get('endpoint');
        if (!endpoint) return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 });

        const snapshot = await db
            .collection('users')
            .doc(userId)
            .collection('push_subscriptions')
            .where('subscription.endpoint', '==', decodeURIComponent(endpoint))
            .get();

        const batch = db.batch();
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();

        return NextResponse.json({ success: true, deleted: snapshot.size });
    } catch (error) {
        return internalErrorResponse('DELETE subscribe', error);
    }
}

// GET /api/notifications/subscribe – devuelve si el usuario tiene suscripciones activas
export async function GET() {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorizedResponse();

        const snapshot = await db
            .collection('users')
            .doc(userId)
            .collection('push_subscriptions')
            .limit(1)
            .get();

        return NextResponse.json({ subscribed: !snapshot.empty });
    } catch (error) {
        return internalErrorResponse('GET subscriptions', error);
    }
}
