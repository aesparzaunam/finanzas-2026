'use client';

import { useEffect, useState } from 'react';
import styles from './dashboard.module.css';

interface Transaction {
    id: string;
    amount: number;
    type: string;
    description: string;
    date: string;
    isParent: boolean;
    account: { name: string };
    category: { name: string; icon: string; color: string } | null;
}

export default function RecentTransactions() {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/transactions')
            .then(async res => {
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data)) {
                        // Filter out MSI parent transactions and take first 5
                        const recent = data
                            .filter((tx: Transaction) => !tx.isParent)
                            .slice(0, 5);
                        setTransactions(recent);
                    } else {
                        console.error('Expected array of transactions, got:', data);
                        setTransactions([]);
                    }
                } else if (res.status === 401) {
                    console.log('Unauthorized fetch for transactions');
                    setTransactions([]);
                }
                setLoading(false);
            })
            .catch((err) => {
                console.error('Fetch error:', err);
                setLoading(false);
            });
    }, []);

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);

    const formatDate = (dateString: string) =>
        new Date(dateString).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'INCOME': return 'var(--success)';
            case 'EXPENSE':
            case 'MSI_CHARGE': return 'var(--danger)';
            case 'TRANSFER': return 'var(--info)';
            case 'PAGO_TARJETA': return 'var(--warning)';
            default: return 'var(--text-secondary)';
        }
    };

    const getTypeSign = (type: string) => {
        if (type === 'INCOME') return '+';
        if (type === 'EXPENSE' || type === 'MSI_CHARGE') return '-';
        return '';
    };

    if (loading) {
        return (
            <div className={styles.recentCard}>
                <div className={styles.recentHeader}>
                    <h3>Movimientos Recientes</h3>
                </div>
                <div className={styles.loadingState}>Cargando...</div>
            </div>
        );
    }

    if (transactions.length === 0) {
        return (
            <div className={styles.recentCard}>
                <div className={styles.recentHeader}>
                    <h3>Movimientos Recientes</h3>
                </div>
                <div className={styles.emptyState}>
                    <p>No hay movimientos aún</p>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.recentCard}>
            <div className={styles.recentHeader}>
                <h3>Movimientos Recientes</h3>
                <a href="/transactions" className={styles.viewAllLink}>Ver todos →</a>
            </div>
            <div className={styles.recentList}>
                {transactions.map(tx => (
                    <div key={tx.id} className={styles.recentItem}>
                        <div className={styles.recentIcon}>
                            {tx.category?.icon || (tx.type === 'INCOME' ? '💰' : '💸')}
                        </div>
                        <div className={styles.recentInfo}>
                            <div className={styles.recentTitle}>{tx.description || tx.category?.name || 'Transacción'}</div>
                            <div className={styles.recentMeta}>
                                {tx.account.name} · {formatDate(tx.date)}
                            </div>
                        </div>
                        <div
                            className={styles.recentAmount}
                            style={{ color: getTypeColor(tx.type) }}
                        >
                            {getTypeSign(tx.type)}{formatCurrency(Number(tx.amount))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
