'use client';

import { useState, useEffect } from 'react';
import { Bell, BellOff, Check } from 'lucide-react';
import styles from '../settings.module.css';

export default function NotificationSettings() {
    const [pushEnabled, setPushEnabled]   = useState(false);
    const [supported, setSupported]       = useState(false);
    const [daysAhead, setDaysAhead]       = useState(3);
    const [budgetAlert, setBudgetAlert]   = useState(true);
    const [weeklyDigest, setWeeklyDigest] = useState(false);
    const [saved, setSaved]               = useState(false);

    useEffect(() => {
        setSupported('Notification' in window && 'serviceWorker' in navigator);
        const perm = (typeof Notification !== 'undefined') ? Notification.permission : 'default';
        setPushEnabled(perm === 'granted');

        // Cargar preferencias del localStorage
        const prefs = localStorage.getItem('notif-prefs');
        if (prefs) {
            const p = JSON.parse(prefs);
            setDaysAhead(p.daysAhead ?? 3);
            setBudgetAlert(p.budgetAlert ?? true);
            setWeeklyDigest(p.weeklyDigest ?? false);
        }
    }, []);

    const requestPush = async () => {
        if (!supported) return;
        const perm = await Notification.requestPermission();
        setPushEnabled(perm === 'granted');
    };

    const savePrefs = () => {
        localStorage.setItem('notif-prefs', JSON.stringify({ daysAhead, budgetAlert, weeklyDigest }));
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
    };

    return (
        <div className={styles.card}>
            <h2 className={styles.cardTitle}>
                <Bell size={14} className={styles.inlineIcon} />
                Notificaciones
            </h2>

            {/* Push notifications */}
            <div className={styles.fieldRow}>
                <div>
                    <div className={styles.fieldLabel}>Notificaciones push</div>
                    <div className={styles.fieldDesc}>
                        {!supported
                            ? 'Tu navegador no soporta notificaciones push'
                            : pushEnabled
                            ? 'Activas — recibirás alertas en este dispositivo'
                            : 'Inactivas — haz clic para activar'
                        }
                    </div>
                </div>
                {supported && (
                    pushEnabled
                        ? <span className={styles.statusOk}><BellOff size={14} className={styles.inlineIcon} /> Activas</span>
                        : <button className={styles.btnPrimary} onClick={requestPush}>
                            <Bell size={14} /> Activar
                          </button>
                )}
            </div>

            {/* Días de anticipación */}
            <div className={styles.fieldRow}>
                <div>
                    <div className={styles.fieldLabel}>Días de anticipación</div>
                    <div className={styles.fieldDesc}>Avisar antes de pagos recurrentes</div>
                </div>
                <select
                    className={styles.fieldSelect}
                    value={daysAhead}
                    onChange={e => setDaysAhead(Number(e.target.value))}
                    aria-label="Días de anticipación para avisar antes de pagos recurrentes"
                >
                    <option value={1}>1 día antes</option>
                    <option value={3}>3 días antes</option>
                    <option value={5}>5 días antes</option>
                    <option value={7}>7 días antes</option>
                </select>
            </div>

            {/* Alerta de presupuesto */}
            <div className={styles.fieldRow}>
                <div>
                    <div className={styles.fieldLabel}>Alerta de presupuesto</div>
                    <div className={styles.fieldDesc}>Notificar cuando una categoría supere el 80%</div>
                </div>
                <label className={styles.toggle} aria-label="Alerta de presupuesto">
                    <input
                        type="checkbox"
                        checked={budgetAlert}
                        onChange={e => setBudgetAlert(e.target.checked)}
                    />
                    <span className={styles.toggleSlider} />
                </label>
            </div>

            {/* Resumen semanal */}
            <div className={styles.fieldRow}>
                <div>
                    <div className={styles.fieldLabel}>Resumen semanal</div>
                    <div className={styles.fieldDesc}>Recibir un resumen cada lunes (próximamente)</div>
                </div>
                <label className={styles.toggle} aria-label="Resumen semanal">
                    <input
                        type="checkbox"
                        checked={weeklyDigest}
                        onChange={e => setWeeklyDigest(e.target.checked)}
                        disabled
                    />
                    <span className={styles.toggleSlider} />
                </label>
            </div>

            <div className={styles.saveRow}>
                <button className={styles.btnPrimary} onClick={savePrefs}>
                    <Check size={14} /> Guardar preferencias
                </button>
                {saved && <span className={styles.savedMsg}>✓ Guardado</span>}
            </div>
        </div>
    );
}
