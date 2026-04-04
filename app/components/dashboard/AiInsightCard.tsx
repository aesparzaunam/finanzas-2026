'use client';

import { useEffect, useState } from 'react';
import styles from './dashboard.module.css';

interface InsightData {
    insight: string;
    type:    'WARNING' | 'TIP' | 'POSITIVE';
    icon:    string;
    cached?: boolean;
}

export default function AiInsightCard() {
    const [data, setData]       = useState<InsightData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/dashboard/ai-insight')
            .then(r => r.ok ? r.json() : null)
            .then(d => { if (d) setData(d); })
            .catch(() => null)
            .finally(() => setLoading(false));
    }, []);

    if (loading) return (
        <div className={`${styles.aiInsightCard} ${styles.aiInsightLoading}`}>
            <div className={styles.aiInsightPulse} />
            <span className={styles.aiInsightLoadingText}>Fin está analizando tu mes…</span>
        </div>
    );

    if (!data) return null;

    const colorClass = {
        WARNING:  styles.aiInsightWarning,
        TIP:      styles.aiInsightTip,
        POSITIVE: styles.aiInsightPositive,
    }[data.type];

    return (
        <div className={`${styles.aiInsightCard} ${colorClass}`}>
            <div className={styles.aiInsightHeader}>
                <span className={styles.aiInsightIcon}>{data.icon}</span>
                <span className={styles.aiInsightLabel}>Consejo del mes · Fin IA</span>
                {data.cached && <span className={styles.aiInsightCacheHint}>·  actualizado ayer</span>}
            </div>
            <p className={styles.aiInsightText}>{data.insight}</p>
        </div>
    );
}
