'use client';

import { useEffect, useState, useCallback } from 'react';
import { Bell, BellOff, BellRing, X, ExternalLink } from 'lucide-react';
import styles from './NotificationCenter.module.css';

interface PendingNotification {
    type: 'RECURRING_PAYMENT' | 'BUDGET_WARNING' | 'CARD_CUTOFF';
    title: string;
    body: string;
    url: string;
    urgency: 'low' | 'normal' | 'high';
    daysUntil: number;
}



export default function NotificationCenter() {
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState<PendingNotification[]>([]);
    const [pushEnabled, setPushEnabled] = useState<boolean | null>(null);
    const [loading, setLoading] = useState(false);

    // Cargar notificaciones pendientes
    const fetchNotifications = useCallback(async () => {
        try {
            const res = await fetch('/api/notifications/pending');
            if (res.ok) {
                const data = await res.json();
                setNotifications(Array.isArray(data) ? data : []);
            }
        } catch (err) {
            console.error('Error fetching notifications', err);
        }
    }, []);

    // Verificar estado de suscripción push
    const checkPushStatus = useCallback(async () => {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            setPushEnabled(false);
            return;
        }
        const perm = Notification.permission;
        if (perm === 'denied') { setPushEnabled(false); return; }
        
        try {
            const res = await fetch('/api/notifications/subscribe');
            if (res.ok) {
                const data = await res.json();
                setPushEnabled(data.subscribed);
            }
        } catch {
            setPushEnabled(false);
        }
    }, []);

    useEffect(() => {
        fetchNotifications();
        checkPushStatus();
        // Re-check cada 5 minutos
        const interval = setInterval(fetchNotifications, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, [fetchNotifications, checkPushStatus]);

    // Registrar Service Worker y suscribirse
    const enablePush = async () => {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            alert('Tu navegador no soporta notificaciones push.');
            return;
        }

        const perm = await Notification.requestPermission();
        if (perm !== 'granted') {
            alert('Permiso denegado. Activa las notificaciones desde la configuración del navegador.');
            return;
        }

        setLoading(true);
        try {
            const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
            await navigator.serviceWorker.ready;

            // Obtener suscripción existente o crear nueva con VAPID key
            let sub = await reg.pushManager.getSubscription();
            if (!sub) {
                const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
                if (!vapidPublicKey) {
                    throw new Error('VAPID public key not configured');
                }

                // Convertir la VAPID key de base64url a Uint8Array
                const keyData = vapidPublicKey.replace(/-/g, '+').replace(/_/g, '/');
                const rawKey = Uint8Array.from(atob(keyData), c => c.charCodeAt(0));

                sub = await reg.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: rawKey,
                });
            }

            const res = await fetch('/api/notifications/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subscription: sub.toJSON() }),
            });

            if (res.ok) {
                setPushEnabled(true);
                // Mostrar notificación de bienvenida
                reg.showNotification('✅ Notificaciones activadas', {
                    body: 'Recibirás alertas de pagos próximos, presupuestos y fechas de corte.',
                    icon: '/icon-192.png',
                    tag: 'finanzas-welcome',
                });
            }
        } catch (err) {
            console.error('Error enabling push:', err);
            alert('Error al activar notificaciones. Verifica que el sitio esté en HTTPS o usa localhost.');
        } finally {
            setLoading(false);
        }
    };

    const disablePush = async () => {
        setLoading(true);
        try {
            const reg = await navigator.serviceWorker.getRegistration('/sw.js');
            if (reg) {
                const sub = await reg.pushManager.getSubscription();
                if (sub) {
                    const endpoint = encodeURIComponent(sub.endpoint);
                    await fetch(`/api/notifications/subscribe?endpoint=${endpoint}`, { method: 'DELETE' });
                    await sub.unsubscribe();
                }
            }
            setPushEnabled(false);
        } catch (err) {
            console.error('Error disabling push:', err);
        } finally {
            setLoading(false);
        }
    };

    const urgentCount = notifications.filter(n => n.urgency === 'high').length;
    const hasNotifications = notifications.length > 0;

    return (
        <div className={styles.wrapper}>
            {/* Bell Button */}
            <button
                id="notification-bell-btn"
                className={`${styles.bellBtn} ${hasNotifications ? styles.bellActive : ''}`}
                onClick={() => setIsOpen(o => !o)}
                aria-label={`Notificaciones${hasNotifications ? ` (${notifications.length})` : ''}`}
                title="Centro de notificaciones"
            >
                {hasNotifications
                    ? <BellRing size={20} className={urgentCount > 0 ? styles.bellUrgent : ''} />
                    : <Bell size={20} />
                }
                {hasNotifications && (
                    <span className={`${styles.badge} ${urgentCount > 0 ? styles.badgeUrgent : ''}`}>
                        {notifications.length}
                    </span>
                )}
            </button>

            {/* Panel */}
            {isOpen && (
                <>
                    <div className={styles.backdrop} onClick={() => setIsOpen(false)} />
                    <div className={styles.panel}>
                        <div className={styles.panelHeader}>
                            <div className={styles.panelTitle}>
                                <BellRing size={16} />
                                Alertas Financieras
                            </div>
                            <div className={styles.panelActions}>
                                {/* Toggle push */}
                                <button
                                    className={`${styles.pushToggle} ${pushEnabled ? styles.pushOn : styles.pushOff}`}
                                    onClick={pushEnabled ? disablePush : enablePush}
                                    disabled={loading}
                                    title={pushEnabled ? 'Desactivar notificaciones push' : 'Activar notificaciones push'}
                                >
                                    {loading ? '…' : pushEnabled ? <><BellOff size={12} /> Push On</> : <><Bell size={12} /> Activar Push</>}
                                </button>
                                <button className={styles.closeBtn} onClick={() => setIsOpen(false)} aria-label="Cerrar">
                                    <X size={16} />
                                </button>
                            </div>
                        </div>

                        <div className={styles.notifList}>
                            {notifications.length === 0 ? (
                                <div className={styles.empty}>
                                    <span className={styles.emptyIcon}>🎉</span>
                                    <p>Todo al día — sin alertas pendientes</p>
                                </div>
                            ) : (
                                notifications.map((n, i) => (
                                    <a key={i} href={n.url} className={styles.notifItem} onClick={() => setIsOpen(false)}>
                                        <div
                                            className={styles.urgencyDot}
                                            data-urgency={n.urgency}
                                            title={n.urgency}
                                        />
                                        <div className={styles.notifContent}>
                                            <div className={styles.notifTitle}>{n.title}</div>
                                            <div className={styles.notifBody}>{n.body}</div>
                                        </div>
                                        <ExternalLink size={12} className={styles.notifArrow} />
                                    </a>
                                ))
                            )}
                        </div>

                        {!hasNotifications && pushEnabled && (
                            <div className={styles.pushStatus}>
                                <span className={styles.pushDot} /> Push activo — recibirás alertas automáticas
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
