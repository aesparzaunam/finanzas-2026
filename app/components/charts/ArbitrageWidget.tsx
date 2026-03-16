"use client";

import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle } from 'lucide-react';
import styles from './charts.module.css';

interface ArbitrageData {
    avgDebtCAT: number;
    investmentRate: number;
    investmentBalance: number;
    alert: boolean;
    message: string | null;
}

interface DebtStrategyResponse {
    arbitrage: ArbitrageData;
    summary: {
        totalDebt: number;
        avgCAT: number;
        totalMonthlyInterest: number;
    };
}

const formatMXN = (val: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(val);

export default function ArbitrageWidget() {
    const [data, setData] = useState<DebtStrategyResponse | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/debt/strategy')
            .then(r => r.json())
            .then(setData)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className={styles.arbitrageCardLoading}>
                <div className={styles.arbitrageLoadingText}>Analizando arbitraje...</div>
            </div>
        );
    }

    if (!data || data.summary.totalDebt === 0) {
        return (
            <div className={styles.arbitrageCardNoDebt}>
                <div className={styles.arbitrageNoDebtTitle}>💡 Arbitraje Financiero</div>
                <div className={styles.arbitrageNoDebtText}>Sin deudas activas. ¡Excelente posición!</div>
            </div>
        );
    }

    const { arbitrage, summary } = data;
    const isAlert = arbitrage.alert;
    const accentColor = isAlert ? '#ef4444' : '#10b981';
    const AlertIcon = isAlert ? AlertTriangle : CheckCircle;

    const veredictoClass = isAlert ? styles.arbitrageVeredictoAlert : styles.arbitrageVeredictoOk;

    return (
        <div className={styles.widgetCard}>
            {/* Header */}
            <div className={styles.arbitrageTitle}>💡 Arbitraje Financiero</div>

            {/* CAT vs Rendimiento */}
            <div className={styles.arbitrageGrid}>
                {/* Deuda */}
                <div className={styles.arbitrageDebtCard}>
                    <div className={styles.arbitrageCardHeader}>
                        <TrendingDown size={14} color="#ef4444" />
                        <span className={styles.arbitrageDebtLabel}>CAT Deuda</span>
                    </div>
                    <div className={styles.arbitrageDebtValue}>
                        {arbitrage.avgDebtCAT.toFixed(1)}%
                    </div>
                    <div className={styles.arbitrageSubtext}>
                        {formatMXN(summary.totalMonthlyInterest)}/mes en intereses
                    </div>
                </div>

                {/* Inversión */}
                <div className={styles.arbitrageInvestCard}>
                    <div className={styles.arbitrageCardHeader}>
                        <TrendingUp size={14} color="#10b981" />
                        <span className={styles.arbitrageInvestLabel}>Rendimiento</span>
                    </div>
                    <div className={styles.arbitrageInvestValue}>
                        {arbitrage.investmentRate > 0 ? `${arbitrage.investmentRate.toFixed(1)}%` : 'N/A'}
                    </div>
                    <div className={styles.arbitrageSubtext}>
                        {arbitrage.investmentBalance > 0 ? formatMXN(arbitrage.investmentBalance) + ' invertido' : 'Sin inversiones'}
                    </div>
                </div>
            </div>

            {/* Veredicto */}
            {arbitrage.message && (
                <div className={`${styles.arbitrageVeredicto} ${veredictoClass}`}>
                    <AlertIcon size={16} color={accentColor} style={{ flexShrink: 0, marginTop: 1 }} />
                    <span className={styles.arbitrageVeredictoText}>
                        {arbitrage.message}
                    </span>
                </div>
            )}

            {/* Deuda total */}
            <div className={styles.arbitrageFooter}>
                <span className={styles.arbitrageFooterLabel}>Deuda total activa</span>
                <span className={styles.arbitrageFooterValue}>{formatMXN(summary.totalDebt)}</span>
            </div>
        </div>
    );
}
