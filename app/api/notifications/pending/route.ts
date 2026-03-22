import { NextResponse } from 'next/server';
import { db } from '@/app/lib/firebase';
import { getUserId, unauthorizedResponse, internalErrorResponse } from '@/app/lib/api-utils';

interface Notification {
    type: 'RECURRING_PAYMENT' | 'BUDGET_WARNING' | 'CARD_CUTOFF';
    title: string;
    body: string;
    url: string;
    urgency: 'low' | 'normal' | 'high';
    daysUntil: number;
}

// GET /api/notifications/pending  – devuelve alertas pendientes para el usuario actual
export async function GET() {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorizedResponse();

        const now = new Date();
        const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

        const userRef = db.collection('users').doc(userId);
        const notifications: Notification[] = [];

        // 1. Pagos recurrentes próximos (en los próximos 7 días)
        const recurringSnap = await userRef
            .collection('recurring_payments')
            .where('status', '==', 'ACTIVE')
            .get();

        recurringSnap.docs.forEach(doc => {
            const data = doc.data();
            if (!data.nextPaymentDate) return;

            const nextDate = new Date(data.nextPaymentDate);
            if (nextDate <= in7Days && nextDate >= now) {
                const daysUntil = Math.ceil((nextDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                const isUrgent = nextDate <= in3Days;

                notifications.push({
                    type: 'RECURRING_PAYMENT',
                    title: isUrgent ? `⚠️ Pago próximo: ${data.name}` : `📅 Recordatorio: ${data.name}`,
                    body: `Vence ${daysUntil === 0 ? 'hoy' : daysUntil === 1 ? 'mañana' : `en ${daysUntil} días`} · $${Number(data.amount).toLocaleString('es-MX')}`,
                    url: '/',
                    urgency: isUrgent ? 'high' : 'normal',
                    daysUntil,
                });
            }
        });

        // 2. Presupuestos al 80% o más
        const [budgetSnap, txSnap] = await Promise.all([
            userRef.collection('budgets').get(),
            userRef.collection('transactions')
                .where('type', '==', 'EXPENSE')
                .where('date', '>=', new Date(now.getFullYear(), now.getMonth(), 1).toISOString())
                .get(),
        ]);

        // Agrupar gastos del mes por categoría
        const spentByCategory = new Map<string, number>();
        txSnap.docs.forEach(doc => {
            const data = doc.data();
            if (!data.categoryId) return;
            spentByCategory.set(data.categoryId, (spentByCategory.get(data.categoryId) || 0) + Number(data.amount));
        });

        budgetSnap.docs.forEach(doc => {
            const data = doc.data();
            const spent = spentByCategory.get(data.categoryId) || 0;
            const limit = Number(data.amount);
            const pct = limit > 0 ? (spent / limit) * 100 : 0;

            if (pct >= 80) {
                notifications.push({
                    type: 'BUDGET_WARNING',
                    title: pct >= 100 ? `🔴 Presupuesto excedido` : `🟡 Presupuesto al ${Math.round(pct)}%`,
                    body: `Categoría: Presupuesto · $${spent.toLocaleString('es-MX')} / $${limit.toLocaleString('es-MX')}`,
                    url: '/budgets',
                    urgency: pct >= 100 ? 'high' : 'normal',
                    daysUntil: 0,
                });
            }
        });

        // 3. Fecha de corte de tarjetas (si billingDay está configurado)
        const accountSnap = await userRef.collection('accounts').where('type', '==', 'CREDIT').get();
        accountSnap.docs.forEach(doc => {
            const data = doc.data();
            if (!data.billingDay) return;

            const billingDay = Number(data.billingDay);
            let cutoffDate = new Date(now.getFullYear(), now.getMonth(), billingDay);
            if (cutoffDate < now) {
                // Ya pasó este mes, calcular el del próximo mes
                cutoffDate = new Date(now.getFullYear(), now.getMonth() + 1, billingDay);
            }

            const daysUntil = Math.ceil((cutoffDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            if (daysUntil <= 5 && daysUntil >= 0) {
                notifications.push({
                    type: 'CARD_CUTOFF',
                    title: `💳 Corte de tarjeta: ${data.name}`,
                    body: `Fecha de corte ${daysUntil === 0 ? 'hoy' : `en ${daysUntil} días`}`,
                    url: '/accounts',
                    urgency: daysUntil <= 2 ? 'high' : 'normal',
                    daysUntil,
                });
            }
        });

        // Ordenar por urgencia y días restantes
        notifications.sort((a, b) => {
            const urgencyOrder = { high: 0, normal: 1, low: 2 };
            if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
                return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
            }
            return a.daysUntil - b.daysUntil;
        });

        return NextResponse.json(notifications);
    } catch (error) {
        return internalErrorResponse('GET pending notifications', error);
    }
}
