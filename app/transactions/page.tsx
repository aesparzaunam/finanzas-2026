'use client';

import { useEffect, useState, ComponentType } from 'react';
import LayoutShell from '../components/dashboard/LayoutShell';
import TransactionTable from '../components/transactions/TransactionTable';
import TransactionForm from '../components/transactions/TransactionForm';
import styles from '../components/transactions/transactions.module.css';
import dashStyles from '../components/dashboard/dashboard.module.css';
import buttonStyles from '../components/accounts/accounts.module.css';
import type { StatementImporterProps } from '../components/StatementImporter';

export default function TransactionsPage() {
    const [transactions, setTransactions] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchTransactions();
    }, []);

    async function fetchTransactions() {
        try {
            const res = await fetch('/api/transactions');
            if (res.ok) {
                const data = await res.json();
                setTransactions(data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    async function handleCreate(data: Record<string, unknown>) {
        try {
            const res = await fetch('/api/transactions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });

            if (res.ok) {
                setIsModalOpen(false);
                fetchTransactions();
            } else {
                alert('Failed to save transaction');
            }
        } catch (error) {
            console.error(error);
            alert('Error saving transaction');
        }
    }

    return (
        <LayoutShell>
            <div className={styles.pageContainer}>
                <div className={styles.pageHeader}>
                    <h1 className={dashStyles.pageTitle}>Movimientos</h1>
                    <div className={styles.headerActions}>
                        <ImportButton onImportComplete={fetchTransactions} />
                        <button className={buttonStyles.button} onClick={() => setIsModalOpen(true)}>
                            + Nueva Transacción
                        </button>
                    </div>
                </div>

                {loading ? <p>Cargando...</p> : <TransactionTable transactions={transactions} onRefresh={fetchTransactions} />}

                {isModalOpen && (
                    <div className={styles.modalOverlay}>
                        <div className={styles.modalContent}>
                            <h2 className={styles.modalTitle}>Add Transaction</h2>
                            <TransactionForm onCheckSubmit={handleCreate} onCancel={() => setIsModalOpen(false)} />
                        </div>
                    </div>
                )}
            </div>
        </LayoutShell>
    );
}

// ── Botón + carga lazy del componente importador ──────────────────────────────

function ImportButton({ onImportComplete }: { onImportComplete: () => void }) {
    const [showImporter, setShowImporter] = useState(false);
    const [accounts, setAccounts] = useState([]);
    const [categories, setCategories] = useState([]);

    async function openImporter() {
        const [accRes, catRes] = await Promise.all([
            fetch('/api/accounts'),
            fetch('/api/categories'),
        ]);
        if (accRes.ok) setAccounts(await accRes.json());
        if (catRes.ok) setCategories(await catRes.json());
        setShowImporter(true);
    }

    return (
        <>
            <button
                onClick={openImporter}
                className={styles.importBtn}
            >
                📥 Importar Estado de Cuenta
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
