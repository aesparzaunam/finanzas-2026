// Service Worker for Push Notifications – Finanzas 2026
// Archivo: public/sw.js

const CACHE_NAME = 'finanzas-sw-v1';

// ── Instalar ──────────────────────────────────────────────────
self.addEventListener('install', (event) => {
    console.log('[SW] Instalado');
    self.skipWaiting();
});

// ── Activar ───────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
    console.log('[SW] Activado');
    event.waitUntil(self.clients.claim());
});

// ── Push recibido ─────────────────────────────────────────────
self.addEventListener('push', (event) => {
    if (!event.data) return;

    let payload;
    try {
        payload = event.data.json();
    } catch {
        payload = { title: 'Finanzas 2026', body: event.data.text() };
    }

    const { title = 'Finanzas 2026', body, icon, badge, tag, data } = payload;

    const options = {
        body,
        icon: icon || '/icon-192.png',
        badge: badge || '/badge-72.png',
        tag: tag || 'finanzas-notification',
        data: data || {},
        requireInteraction: false,
        actions: data?.actions || [],
        vibrate: [200, 100, 200],
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

// ── Click en notificación ─────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const urlToOpen = event.notification.data?.url || '/';

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // Si ya hay una ventana abierta, enfócala
            for (const client of clientList) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    client.focus();
                    client.navigate(urlToOpen);
                    return;
                }
            }
            // Si no hay ventana, ábrela
            if (self.clients.openWindow) {
                return self.clients.openWindow(urlToOpen);
            }
        })
    );
});
