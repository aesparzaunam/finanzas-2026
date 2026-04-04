'use client';

import { useEffect, useState } from 'react';
import { RecurringFrequency } from '@/app/lib/types';
import styles from './DetectedSubscriptions.module.css';

interface DetectedItem {
    key:                 string;
    suggestedName:       string;
    originalDescription: string;
    amount:              number;
    frequency:           RecurringFrequency;
    categoryId:          string | null;
    occurrences:         number;
    lastSeen:            string;
    averageInterval:     number;
    confidence:          number;
}

interface Props {
    defaultAccountId?: string;
    onAdded?: (name: string) => void;
}

const FREQ_LABELS: Record<string, string> = {
    WEEKLY:  'Semanal',
    MONTHLY: 'Mensual',
    YEARLY:  'Anual',
};

export default function DetectedSubscriptions({ defaultAccountId, onAdded }: Props) {
    const [items, setItems]     = useState<DetectedItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [adding, setAdding]   = useState<string | null>(null);
    const [ignored, setIgnored] = useState<Set<string>>(new Set());

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        fetch('/api/recurring-payments/detect')
            .then(r => r.json())
            .then(data => {
                if (!cancelled) setItems(Array.isArray(data) ? data : []);
            })
            .catch(() => { if (!cancelled) setItems([]); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, []);

    const visible = items.filter(i => !ignored.has(i.key));

    async function handleAdd(item: DetectedItem) {
        if (!defaultAccountId) {
            alert('Selecciona una cuenta por defecto en Ajustes para agregar suscripciones detectadas.');
            return;
        }
        setAdding(item.key);
        try {
            const res = await fetch('/api/recurring-payments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name:              item.suggestedName,
                    amount:            item.amount,
                    categoryId:        item.categoryId,
                    accountId:         defaultAccountId,
                    frequency:         item.frequency,
                    startDate:         item.lastSeen,
                    detectedFromHistory: true,
                }),
            });
            if (res.ok) {
                setIgnored(prev => new Set([...prev, item.key]));
                onAdded?.(item.suggestedName);
            }
        } finally {
            setAdding(null);
        }
    }

    function handleIgnore(key: string) {
        setIgnored(prev => new Set([...prev, key]));
    }

    if (loading) {
        return (
            <section className={styles.section}>
                <h3 className={styles.title}>
                    <span className={styles.icon}>🔍</span>
                    Detectando suscripciones…
                </h3>
                <div className={styles.skeletonGrid}>
                    {[1, 2, 3].map(n => (
                        <div key={n} className={styles.skeleton} />
                    ))}
                </div>
                <p className={styles.hint}>Analizando el historial con IA local…</p>
            </section>
        );
    }

    if (visible.length === 0) return null;

    return (
        <section className={styles.section}>
            <h3 className={styles.title}>
                <span className={styles.icon}>🔍</span>
                Suscripciones detectadas ({visible.length})
            </h3>
            <p className={styles.subtitle}>
                Encontramos pagos recurrentes en tu historial que no están registrados.
            </p>
            <div className={styles.grid}>
                {visible.map(item => (
                    <div key={item.key} className={styles.card}>
                        <div className={styles.cardHeader}>
                            <span className={styles.name}>{item.suggestedName}</span>
                            <span className={styles.freq}>{FREQ_LABELS[item.frequency] ?? item.frequency}</span>
                        </div>
                        <div className={styles.amount}>
                            ${item.amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                        </div>
                        <div className={styles.meta}>
                            {item.occurrences} apariciones · últ. {new Date(item.lastSeen).toLocaleDateString('es-MX')}
                        </div>
                        <div className={styles.confidence}>
                            <div
                                className={styles.confidenceBar}
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                {...{ style: { '--bar-width': `${Math.round(item.confidence * 100)}%` } } as any}
                            />
                        </div>
                        <div className={styles.actions}>
                            <button
                                className={styles.btnAdd}
                                onClick={() => handleAdd(item)}
                                disabled={adding === item.key}
                            >
                                {adding === item.key ? 'Agregando…' : '➕ Agregar'}
                            </button>
                            <button
                                className={styles.btnIgnore}
                                onClick={() => handleIgnore(item.key)}
                            >
                                Ignorar
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}
