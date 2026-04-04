'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import MetricCard from './MetricCard';
import RecentTransactions from './RecentTransactions';
import styles from './dashboard.module.css';

// Lazy load componentes pesados
const Charts = dynamic(() => import('../charts/Charts'), {
    ssr: false,
    loading: () => <div className={styles.loadingState}>Cargando visualizaciones...</div>
});
const AiInsightCard  = dynamic(() => import('./AiInsightCard'),  { ssr: false });
const AiNarrativeCard = dynamic(() => import('./AiNarrativeCard'), { ssr: false });

interface DashboardMetrics {
    netWorth: number;
    cashFlow: number;
    savingsRate: number;
    runway: number;
    dti: number;
    history: { month: string; income: number; expense: number }[];
}

export default function MetricsGrid() {
    const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchMetrics() {
            try {
                const res = await fetch('/api/dashboard/metrics');
                if (res.ok) {
                    const data = await res.json();
                    setMetrics(data);
                }
            } catch (error) {
                console.error('Failed to fetch metrics', error);
            } finally {
                setLoading(false);
            }
        }
        fetchMetrics();
    }, []);

    if (loading) return <div className={styles.loadingState}>Cargando dashboard...</div>;
    if (!metrics) return <div className={styles.emptyState}><p>Error cargando métricas</p></div>;

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);

    // Determine trend direction for cash flow
    const cashFlowTrend = metrics.cashFlow >= 0 ? { value: metrics.cashFlow, label: 'Superávit' } : { value: metrics.cashFlow, label: 'Déficit' };

    return (
        <div className={styles.grid}>
            {/* Net Worth - Hero Card */}
            <MetricCard
                title="Patrimonio Neto"
                value={formatCurrency(metrics.netWorth)}
                trend={{ value: 2.5, label: "vs mes anterior" }}
                highlight
            />

            {/* Monthly Cash Flow */}
            <MetricCard
                title="Flujo de Caja Mensual"
                value={formatCurrency(metrics.cashFlow)}
                trend={cashFlowTrend}
            />

            {/* Savings Rate */}
            <MetricCard
                title="Tasa de Ahorro"
                value={`${metrics.savingsRate.toFixed(1)}%`}
            />

            {/* Runway / Emergency Fund */}
            <MetricCard
                title="Fondo de Emergencia"
                value={`${metrics.runway.toFixed(1)} meses`}
            />

            {/* Debt-to-Income */}
            <MetricCard
                title="Ratio Deuda/Ingreso"
                value={`${metrics.dti.toFixed(1)}%`}
                trend={{ value: 0, label: "Estable" }}
            />

            {/* Recent Transactions */}
            <RecentTransactions />

            {/* AI Insight — Consejo mensual generado por Ollama */}
            <AiInsightCard />

            {/* Charts Section */}
            {metrics.history && <Charts history={metrics.history} />}

            {/* AI Narrative — Resumen narrativo individual del mes */}
            <AiNarrativeCard />
        </div>
    );
}
