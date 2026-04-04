'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, AlertCircle } from 'lucide-react';
import styles from './widgets.module.css';

interface CategoryForecast {
    categoryId:   string;
    categoryName: string;
    avg3m:        number;
    trend:        number;
    forecast:     number;
    confidence:   'HIGH' | 'MEDIUM' | 'LOW';
}

interface ForecastData {
    totalForecast:    number;
    totalIncome:      number;
    projectedSavings: number;
    byCategory:       CategoryForecast[];
    generatedAt:      string;
}

function fmt(n: number) {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);
}

export default function ForecastWidget() {
    const [data,     setData]     = useState<ForecastData | null>(null);
    const [loading,  setLoading]  = useState(true);
    const [error,    setError]    = useState<string | null>(null);
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        fetch('/api/dashboard/forecast')
            .then(r => r.json())
            .then(d => { setData(d); setLoading(false); })
            .catch(() => { setError('No disponible'); setLoading(false); });
    }, []);

    if (loading) return (
        <div className={styles.forecastLoading}>
            <div className={styles.forecastLoadingText}>Calculando pronóstico...</div>
        </div>
    );

    if (error || !data) return null;

    const positive = data.projectedSavings >= 0;
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const nextMonthLabel = nextMonth.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });

    return (
        <div className={styles.forecast}>
            {/* Header */}
            <div className={styles.forecastHeader}>
                <div>
                    <div className={styles.forecastLabel}>📈 Pronóstico — {nextMonthLabel}</div>
                    <div className={styles.forecastTotal}>{fmt(data.totalForecast)}</div>
                    <div className={styles.forecastSubLabel}>gasto estimado próximo mes</div>
                </div>
                <div className={positive ? styles.forecastSavingsPositive : styles.forecastSavingsNegative}>
                    <div className={styles.forecastSavingsLabel}>Ahorro proyectado</div>
                    <div className={positive ? styles.forecastSavingsPositiveAmt : styles.forecastSavingsNegativeAmt}>
                        {positive ? '+' : ''}{fmt(data.projectedSavings)}
                    </div>
                </div>
            </div>

            {/* Summary bar */}
            <div className={styles.forecastSummaryBar}>
                <div className={styles.forecastSummaryItem}>
                    <div className={styles.forecastSummaryItemLabel}>Ingreso promedio</div>
                    <div className={styles.forecastSummaryItemValue}>{fmt(data.totalIncome)}</div>
                </div>
                <div className={styles.forecastSummaryDivider} />
                <div className={styles.forecastSummaryItem}>
                    <div className={styles.forecastSummaryItemLabel}>Gasto estimado</div>
                    <div className={styles.forecastSummaryItemValue}>{fmt(data.totalForecast)}</div>
                </div>
            </div>

            {/* Categories toggle */}
            {data.byCategory.length > 0 && (
                <>
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className={styles.forecastToggleBtn}
                        aria-expanded={expanded}
                    >
                        <span>Desglose por categoría ({data.byCategory.length})</span>
                        <span>{expanded ? '▲' : '▼'}</span>
                    </button>

                    {expanded && (
                        <div className={styles.forecastCatList}>
                            {data.byCategory.map(cat => (
                                <div key={cat.categoryId} className={styles.forecastCatRow}>
                                    <div className={styles.forecastCatLeft}>
                                        {cat.trend > 5
                                            ? <TrendingUp size={14} color="#f87171" />
                                            : cat.trend < -5
                                            ? <TrendingDown size={14} color="#86efac" />
                                            : <Minus size={14} color="rgba(255,255,255,0.4)" />
                                        }
                                        <span className={styles.forecastCatName}>{cat.categoryName}</span>
                                        {cat.confidence === 'LOW' && (
                                            <AlertCircle size={12} color="rgba(255,200,0,0.6)" />
                                        )}
                                    </div>
                                    <div className={styles.forecastCatRight}>
                                        <div className={styles.forecastCatAmt}>{fmt(cat.forecast)}</div>
                                        <div className={
                                            cat.trend > 5 ? styles.forecastTrendUp :
                                            cat.trend < -5 ? styles.forecastTrendDown :
                                            styles.forecastTrendFlat
                                        }>
                                            {cat.trend > 0 ? '+' : ''}{cat.trend}%
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            {data.byCategory.length === 0 && (
                <div className={styles.forecastEmptyNote}>
                    Registra transacciones en los últimos 3 meses para ver el pronóstico
                </div>
            )}
        </div>
    );
}
