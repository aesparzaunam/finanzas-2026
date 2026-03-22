import { NextResponse } from 'next/server';
import webPush from 'web-push';
import { db } from '@/app/lib/firebase';
import { getUserId, unauthorizedResponse, internalErrorResponse } from '@/app/lib/api-utils';

// POST /api/notifications/send  – envía push a todos los endpoints del usuario
export async function POST(request: Request) {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorizedResponse();

        // Configurar VAPID en runtime (no en build-time).
        // Esto evita el error "No key set vapidDetails.publicKey" durante
        // el build de Cloud Build donde las env vars no están disponibles.
        const publicKey  = process.env.VAPID_PUBLIC_KEY;
        const privateKey = process.env.VAPID_PRIVATE_KEY;
        const subject    = process.env.VAPID_SUBJECT || 'mailto:admin@finanzas2026.app';

        if (!publicKey || !privateKey) {
            return NextResponse.json({ sent: 0, message: 'Web Push no configurado (faltan VAPID keys)' });
        }

        webPush.setVapidDetails(subject, publicKey, privateKey);

        const { title, body, url, tag } = await request.json();

        // Obtener todas las suscripciones del usuario
        const snapshot = await db
            .collection('users')
            .doc(userId)
            .collection('push_subscriptions')
            .get();

        if (snapshot.empty) {
            return NextResponse.json({ sent: 0, message: 'No hay suscripciones activas' });
        }

        const payload = JSON.stringify({ title, body, url, tag });
        const results = await Promise.allSettled(
            snapshot.docs.map(async (doc) => {
                const data = doc.data();
                try {
                    await webPush.sendNotification(data.subscription as webPush.PushSubscription, payload);
                    return { id: doc.id, status: 'sent' };
                } catch (err: unknown) {
                    // Si la suscripción expiró (410 Gone), eliminarla
                    if (err instanceof webPush.WebPushError && (err.statusCode === 410 || err.statusCode === 404)) {
                        await doc.ref.delete();
                        return { id: doc.id, status: 'expired_deleted' };
                    }
                    throw err;
                }
            })
        );

        const sent = results.filter(r => r.status === 'fulfilled').length;
        return NextResponse.json({ sent, total: snapshot.size });
    } catch (error) {
        return internalErrorResponse('POST send notification', error);
    }
}
