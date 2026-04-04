import { getUserId } from '@/app/lib/api-utils';
import { NextResponse } from 'next/server';
import { getRecurringPayments, getAccounts, getBudgets, getTransactions } from '@/app/lib/db';

// GET /api/notifications/pending
export async function GET() {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const now = new Date();
        const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

        const notifications: { type: string; title: string; body: string; url: string; urgency: string; daysUntil: number }[] = [];

        // 1. Pagos recurrentes próximos (7 días)
        const recurringPayments = await getRecurringPayments(userId, 'ACTIVE');
        recurringPayments.forEach(rp => {
            if (!rp.nextPaymentDate) return;
            const nextDate = new Date(rp.nextPaymentDate);
            if (nextDate <= in7Days && nextDate >= now) {
                const daysUntil = Math.ceil((nextDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                const isUrgent = nextDate <= in3Days;
                notifications.push({
                    type: 'RECURRING_PAYMENT',
                    title: isUrgent ? `⚠️ Pago próximo: ${rp.name}` : `📅 Recordatorio: ${rp.name}`,
                    body: `Vence ${daysUntil === 0 ? 'hoy' : daysUntil === 1 ? 'mañana' : `en ${daysUntil} días`} · $${Number(rp.amount).toLocaleString('es-MX')}`,
                    url: '/',
                    urgency: isUrgent ? 'high' : 'normal',
                    daysUntil,
                });
            }
        });

        // 2. Presupuestos al 80% o más
        const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const [budgets, { transactions }] = await Promise.all([
            getBudgets(userId),
            getTransactions(userId, { limit: 1000, fromDate: `${monthStr}-01`, type: 'EXPENSE' }),
        ]);

        const spentByCategory = new Map<string, number>();
        transactions.forEach(tx => {
            if (!tx.categoryId) return;
            spentByCategory.set(tx.categoryId, (spentByCategory.get(tx.categoryId) || 0) + Number(tx.amount));
        });

        budgets.forEach(budget => {
            const spent = spentByCategory.get(budget.categoryId) || 0;
            const limit = Number(budget.amount);
            const pct = limit > 0 ? (spent / limit) * 100 : 0;
            if (pct >= 80) {
                notifications.push({
                    type: 'BUDGET_WARNING',
                    title: pct >= 100 ? `🔴 Presupuesto excedido` : `🟡 Presupuesto al ${Math.round(pct)}%`,
                    body: `$${spent.toLocaleString('es-MX')} / $${limit.toLocaleString('es-MX')}`,
                    url: '/budgets',
                    urgency: pct >= 100 ? 'high' : 'normal',
                    daysUntil: 0,
                });
            }
        });

        // 3. Fechas de corte de tarjetas (próximos 5 días)
        const accounts = await getAccounts(userId);
        accounts.filter(a => a.type === 'CREDIT' && a.billingDay).forEach(acc => {
            const billingDay = Number(acc.billingDay);
            let cutoffDate = new Date(now.getFullYear(), now.getMonth(), billingDay);
            if (cutoffDate < now) cutoffDate = new Date(now.getFullYear(), now.getMonth() + 1, billingDay);
            const daysUntil = Math.ceil((cutoffDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            if (daysUntil <= 5 && daysUntil >= 0) {
                notifications.push({
                    type: 'CARD_CUTOFF',
                    title: `💳 Corte de tarjeta: ${acc.name}`,
                    body: `Fecha de corte ${daysUntil === 0 ? 'hoy' : `en ${daysUntil} días`}`,
                    url: '/accounts',
                    urgency: daysUntil <= 2 ? 'high' : 'normal',
                    daysUntil,
                });
            }
        });

        notifications.sort((a, b) => {
            const order: Record<string, number> = { high: 0, normal: 1, low: 2 };
            if (order[a.urgency] !== order[b.urgency]) return order[a.urgency] - order[b.urgency];
            return a.daysUntil - b.daysUntil;
        });

        return NextResponse.json(notifications);
    } catch (error) {
        console.error('GET pending notifications:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
