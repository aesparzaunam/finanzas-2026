'use client';

import { useEffect, useState } from 'react';
import LayoutShell from '../components/dashboard/LayoutShell';
import TransactionTable from '../components/transactions/TransactionTable';
import TransactionForm from '../components/transactions/TransactionForm';
import styles from '../components/transactions/transactions.module.css';
import dashStyles from '../components/dashboard/dashboard.module.css';
import buttonStyles from '../components/accounts/accounts.module.css';

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

    async function handleCreate(data: any) {
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
                    <button className={buttonStyles.button} onClick={() => setIsModalOpen(true)}>
                        + Nueva Transacción
                    </button>
                </div>

                {loading ? <p>Loading...</p> : <TransactionTable transactions={transactions} />}

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
