'use client';

import { useEffect, useState, ComponentType, useMemo } from 'react';
import dynamic from 'next/dynamic';
import LayoutShell from '../components/dashboard/LayoutShell';
import TransactionTable from '../components/transactions/TransactionTable';
import TransactionForm from '../components/transactions/TransactionForm';
import styles from './transactions.module.css';
import type { StatementImporterProps } from '../components/StatementImporter';
import { TrendingUp, TrendingDown, ArrowLeftRight, Plus, Upload, BarChart2 } from 'lucide-react';

const AiAnomalyBanner = dynamic(() => import('../components/transactions/AiAnomalyBanner'), { ssr: false });

type Tx = {
    id: string; date: string; description: string; amount: number;
    type: string; accountId: string; categoryId?: string | null;
    toAccountId?: string | null; tags?: string[];
    account: { name: string } | null;
    category: { name: string; icon: string; color: string } | null;
};

type FilterType = 'ALL' | 'INCOME' | 'EXPENSE' | 'TRANSFER';

export default function TransactionsPage() {
    const [transactions, setTransactions] = useState<Tx[]>([]);
    const [isModalOpen, setIsModalOpen]   = useState(false);
    const [loading, setLoading]           = useState(true);
    const [filter, setFilter]             = useState<FilterType>('ALL');

    useEffect(() => { fetchTransactions(); }, []);

    async function fetchTransactions() {
        try {
            const res = await fetch('/api/transactions?limit=200');
            if (res.ok) {
                const data = await res.json();
                const txArray = Array.isArray(data) ? data : (data.transactions ?? []);
                setTransactions(txArray);
            }
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }

    async function handleCreate(data: Record<string, unknown>) {
        const res = await fetch('/api/transactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (res.ok) { setIsModalOpen(false); fetchTransactions(); }
        else alert('Error al guardar');
    }

    // KPI calculations
    const kpis = useMemo(() => {
        const income   = transactions.filter(t => t.type === 'INCOME').reduce((s, t) => s + Number(t.amount), 0);
        const expense  = transactions.filter(t => t.type === 'EXPENSE' || t.type === 'MSI_CHARGE').reduce((s, t) => s + Number(t.amount), 0);
        const transfer = transactions.filter(t => t.type === 'TRANSFER' || t.type === 'PAGO_TARJETA').reduce((s, t) => s + Number(t.amount), 0);
        return { income, expense, transfer, net: income - expense };
    }, [transactions]);

    const fmt = (v: number) =>
        new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(v);

    const filtered = filter === 'ALL' ? transactions
        : filter === 'TRANSFER'
            ? transactions.filter(t => t.type === 'TRANSFER' || t.type === 'PAGO_TARJETA')
            : filter === 'EXPENSE'
                ? transactions.filter(t => t.type === 'EXPENSE' || t.type === 'MSI_CHARGE')
                : transactions.filter(t => t.type === filter);

    return (
        <LayoutShell>
            <div className={styles.page}>

                {/* ── Page Header ── */}
                <div className={styles.pageHeader}>
                    <div className={styles.pageHeaderLeft}>
                        <div className={styles.pageIconWrap}>
                            <BarChart2 size={22} strokeWidth={2} />
                        </div>
                        <div>
                            <h1 className={styles.pageTitle}>Movimientos</h1>
                            <p className={styles.pageSub}>
                                {transactions.length} transacciones registradas
                            </p>
                        </div>
                    </div>
                    <div className={styles.pageActions}>
                        <ImportButton onImportComplete={fetchTransactions} />
                        <button className={styles.btnPrimary} onClick={() => setIsModalOpen(true)}>
                            <Plus size={16} strokeWidth={2.5} />
                            Nueva
                        </button>
                    </div>
                </div>

                {/* ── KPI Strip ── */}
                <div className={styles.kpiStrip}>
                    <div className={`${styles.kpiCard} ${styles.kpiIncome}`}>
                        <div className={styles.kpiIcon}><TrendingUp size={18} /></div>
                        <div>
                            <div className={styles.kpiLabel}>Ingresos</div>
                            <div className={styles.kpiValue}>{fmt(kpis.income)}</div>
                        </div>
                    </div>
                    <div className={`${styles.kpiCard} ${styles.kpiExpense}`}>
                        <div className={styles.kpiIcon}><TrendingDown size={18} /></div>
                        <div>
                            <div className={styles.kpiLabel}>Gastos</div>
                            <div className={styles.kpiValue}>{fmt(kpis.expense)}</div>
                        </div>
                    </div>
                    <div className={`${styles.kpiCard} ${styles.kpiTransfer}`}>
                        <div className={styles.kpiIcon}><ArrowLeftRight size={18} /></div>
                        <div>
                            <div className={styles.kpiLabel}>Transferencias</div>
                            <div className={styles.kpiValue}>{fmt(kpis.transfer)}</div>
                        </div>
                    </div>
                    <div className={`${styles.kpiCard} ${kpis.net >= 0 ? styles.kpiNet : styles.kpiNetNeg}`}>
                        <div className={styles.kpiIcon}>
                            {kpis.net >= 0
                                ? <TrendingUp size={18} />
                                : <TrendingDown size={18} />}
                        </div>
                        <div>
                            <div className={styles.kpiLabel}>Balance neto</div>
                            <div className={styles.kpiValue}>{kpis.net >= 0 ? '+' : ''}{fmt(kpis.net)}</div>
                        </div>
                    </div>
                </div>

                {/* ── AI Banner ── */}
                <AiAnomalyBanner />

                {/* ── Filter Chips ── */}
                <div className={styles.filterBar}>
                    {(['ALL', 'INCOME', 'EXPENSE', 'TRANSFER'] as FilterType[]).map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`${styles.chip} ${filter === f ? styles.chipActive : ''}`}
                        >
                            {f === 'ALL' && '✦ Todos'}
                            {f === 'INCOME' && '↑ Ingresos'}
                            {f === 'EXPENSE' && '↓ Gastos'}
                            {f === 'TRANSFER' && '⇆ Transferencias'}
                            {filter === f && filtered.length > 0 && (
                                <span className={styles.chipCount}>{filtered.length}</span>
                            )}
                        </button>
                    ))}
                </div>

                {/* ── Table ── */}
                {loading ? (
                    <div className={styles.loadingState}>
                        <div className={styles.loadingSpinner} />
                        <p>Cargando movimientos...</p>
                    </div>
                ) : (
                    <TransactionTable transactions={filtered} onRefresh={fetchTransactions} />
                )}

                {/* ── Modal nueva transacción ── */}
                {isModalOpen && (
                    <div className={styles.modalOverlay}>
                        <div className={styles.modalContent}>
                            <div className={styles.modalHeader}>
                                <h2 className={styles.modalTitle}>Nueva Transacción</h2>
                                <button className={styles.modalCloseBtn} onClick={() => setIsModalOpen(false)} aria-label="Cerrar">✕</button>
                            </div>
                            <TransactionForm onCheckSubmit={handleCreate} onCancel={() => setIsModalOpen(false)} />
                        </div>
                    </div>
                )}
            </div>
        </LayoutShell>
    );
}

/* ── Import button ──────────────────────────────────────────── */
function ImportButton({ onImportComplete }: { onImportComplete: () => void }) {
    const [showImporter, setShowImporter] = useState(false);
    const [accounts, setAccounts]         = useState([]);
    const [categories, setCategories]     = useState([]);

    async function openImporter() {
        const [accRes, catRes] = await Promise.all([fetch('/api/accounts'), fetch('/api/categories')]);
        if (accRes.ok) setAccounts(await accRes.json());
        if (catRes.ok) setCategories(await catRes.json());
        setShowImporter(true);
    }

    return (
        <>
            <button onClick={openImporter} className={styles.btnSecondary}>
                <Upload size={15} strokeWidth={2} />
                Importar
            </button>
            {showImporter && (
                <StatementImporterLazy
                    accounts={accounts}
                    categories={categories}
                    onImportComplete={() => { onImportComplete(); setShowImporter(false); }}
                    onClose={() => setShowImporter(false)}
                />
            )}
        </>
    );
}

function StatementImporterLazy(props: StatementImporterProps) {
    const [Component, setComponent] = useState<ComponentType<StatementImporterProps> | null>(null);
    useEffect(() => {
        import('../components/StatementImporter').then(m => setComponent(() => m.default));
    }, []);
    if (!Component) return null;
    return <Component {...props} />;
}
