"use client";

import { useEffect, useState, useCallback } from 'react';
import { LineChart, Zap, Plus, Calendar } from 'lucide-react';
import TimelineChart from './TimelineChart';
import DebtRatioWidget from './DebtRatioWidget';
import HormigaAlert from './HormigaAlert';
import UpcomingPayments from './UpcomingPayments';
import CreateRecurringModal from './CreateRecurringModal';
import { TimelinePoint, DebtRatioData, HormigaAnalysis } from '@/app/lib/types';
import styles from './analysis.module.css';

export default function AnalysisDashboard() {
    const [data, setData] = useState<{
        timeline: TimelinePoint[];
        debtRatio: DebtRatioData;
        hormiga: HormigaAnalysis[];
        upcoming: any[];
    } | null>(null);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            const r = await fetch('/api/dashboard/analysis');
            const res = await r.json();
            setData(res);
        } catch (err) {
            console.error('Failed to fetch analysis:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    if (loading && !data) {
        return (
            <div className={styles.panel}>
                <div className={styles.loadingWrapper}>
                    Analizando proyecciones financieras...
                </div>
            </div>
        );
    }

    if (!data) return null;

    return (
        <section className={styles.grid}>
            {/* Timeline Column */}
            <div className={styles.panel}>
                <div className={styles.panelHeader}>
                    <div className={styles.title}>
                        <LineChart size={20} />
                        Saldo Proyectado (30 días)
                    </div>
                </div>
                <TimelineChart data={data.timeline} />
                <HormigaAlert alerts={data.hormiga} />
            </div>

            {/* Side Column: Health + Upcoming */}
            <div className={styles.sideColumn}>
                <div className={styles.panel}>
                    <div className={styles.panelHeader}>
                        <div className={styles.title}>
                            <Zap size={20} />
                            Salud Financiera
                        </div>
                    </div>
                    <DebtRatioWidget data={data.debtRatio} />
                </div>

                <div className={styles.panel}>
                    <div className={styles.panelHeader}>
                        <div className={styles.title}>
                            <Calendar size={20} />
                            Próximos Pagos
                        </div>
                        <button
                            className={styles.btnAddSmall}
                            onClick={() => setShowModal(true)}
                            title="Añadir Pago Recurrente"
                        >
                            <Plus size={14} />
                            Añadir
                        </button>
                    </div>
                    <UpcomingPayments payments={data.upcoming} />
                </div>
            </div>

            {showModal && (
                <CreateRecurringModal
                    onClose={() => setShowModal(false)}
                    onSuccess={fetchData}
                />
            )}
        </section>
    );
}
