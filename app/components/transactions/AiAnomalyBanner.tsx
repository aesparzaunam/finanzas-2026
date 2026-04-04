'use client';

import { useEffect, useState } from 'react';
import styles from '../transactions/transactions.module.css';

interface Anomaly {
    txId:         string;
    description:  string;
    amount:       number;
    date:         string;
    categoryName: string;
    mean:         number;
    zscore:       number;
    severity:     'HIGH' | 'MEDIUM';
    explanation:  string;
}

interface Props {
    month?: string;
}

export default function AiAnomalyBanner({ month }: Props) {
    const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
    const [loading, setLoading]     = useState(true);
    const [open, setOpen]           = useState(false);
    const [message, setMessage]     = useState('');

    const currentMonth = month || new Date().toISOString().slice(0, 7);

    useEffect(() => {
        fetch(`/api/transactions/anomalies?month=${currentMonth}`)
            .then(r => r.ok ? r.json() : null)
            .then(d => {
                if (d) {
                    setAnomalies(d.anomalies ?? []);
                    setMessage(d.message ?? '');
                    // Auto-abrir si hay anomalías HIGH
                    if ((d.anomalies ?? []).some((a: Anomaly) => a.severity === 'HIGH')) {
                        setOpen(true);
                    }
                }
            })
            .catch(() => null)
            .finally(() => setLoading(false));
    }, [currentMonth]);

    if (loading) return null; // No muestra nada mientras carga (no bloquea la tabla)

    const highCount   = anomalies.filter(a => a.severity === 'HIGH').length;
    const mediumCount = anomalies.filter(a => a.severity === 'MEDIUM').length;

    if (anomalies.length === 0) {
        // Si no hay anomalías y hay mensaje positivo, mostrar badge sutil
        if (message && message.includes('¡Bien')) {
            return (
                <div className={styles.anomalyGoodBadge}>
                    ✅ {message}
                </div>
            );
        }
        return null;
    }

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);

    return (
        <div className={`${styles.anomalyBanner} ${highCount > 0 ? styles.anomalyBannerHigh : styles.anomalyBannerMedium}`}>
            {/* Header colapsable */}
            <button
                className={styles.anomalyToggle}
                onClick={() => setOpen(o => !o)}
                aria-expanded={open}
                aria-controls="anomaly-panel"
            >
                <span className={styles.anomalyHeaderIcon}>
                    {highCount > 0 ? '🔴' : '🟡'}
                </span>
                <span className={styles.anomalyHeaderText}>
                    <strong>Fin IA detectó {anomalies.length} gasto{anomalies.length > 1 ? 's' : ''} inusual{anomalies.length > 1 ? 'es' : ''}</strong>
                    {highCount > 0 && <span className={styles.anomalySeverityHigh}> · {highCount} muy alto{highCount > 1 ? 's' : ''}</span>}
                    {mediumCount > 0 && <span className={styles.anomalySeverityMed}> · {mediumCount} moderado{mediumCount > 1 ? 's' : ''}</span>}
                </span>
                <span className={styles.anomalyChevron}>{open ? '▲' : '▼'}</span>
            </button>

            {/* Panel de detalles */}
            {open && (
                <div
                    id="anomaly-panel"
                    className={styles.anomalyList}
                >
                    {anomalies.map(a => (
                        <div
                            key={a.txId}
                            className={`${styles.anomalyItem} ${a.severity === 'HIGH' ? styles.anomalyItemHigh : styles.anomalyItemMed}`}
                        >
                            <div className={styles.anomalyItemHeader}>
                                <span className={styles.anomalyItemIcon}>
                                    {a.severity === 'HIGH' ? '🔴' : '🟡'}
                                </span>
                                <div className={styles.anomalyItemInfo}>
                                    <span className={styles.anomalyDesc}>{a.description}</span>
                                    <span className={styles.anomalyCategory}>{a.categoryName}</span>
                                </div>
                                <div className={styles.anomalyAmounts}>
                                    <span className={styles.anomalyAmount}>{formatCurrency(a.amount)}</span>
                                    <span className={styles.anomalyMean}>prom. {formatCurrency(a.mean)}</span>
                                </div>
                            </div>
                            <p className={styles.anomalyExplanation}>💬 {a.explanation}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
