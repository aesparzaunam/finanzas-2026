'use client';

import styles from './transactions.module.css';

interface Transaction {
    id: string;
    date: string;
    description: string;
    amount: number;
    type: string;
    account: { name: string };
    category: { name: string; icon: string; color: string } | null;
}

export default function TransactionTable({ transactions }: { transactions: Transaction[] }) {
    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);

    return (
        <div className={styles.tableContainer}>
            <table className={styles.table}>
                <thead>
                    <tr>
                        <th>Fecha</th>
                        <th>Descripción</th>
                        <th>Categoría</th>
                        <th>Cuenta</th>
                        <th>Monto</th>
                    </tr>
                </thead>
                <tbody>
                    {transactions.map(tx => {
                        const style = { '--category-color': tx.category?.color || 'var(--text-secondary)' } as React.CSSProperties;
                        return (
                            <tr key={tx.id}>
                                <td className={styles.dateCell}>{new Date(tx.date).toLocaleDateString()}</td>
                                <td className={styles.descCell}>{tx.description}</td>
                                <td className={styles.categoryCell}>
                                    <span className={styles.categoryName} style={style}>
                                        {tx.category?.icon} {tx.category?.name || 'Sin categoría'}
                                    </span>
                                </td>
                                <td className={styles.accountCell}>{tx.account?.name}</td>
                                <td className={`${styles.amountCell} ${tx.type === 'INCOME' ? styles.income : (tx.type === 'TRANSFER' ? styles.transfer : styles.expense)}`}>
                                    {tx.type === 'INCOME' ? '+' : (tx.type === 'TRANSFER' ? '' : '-')}{formatCurrency(Number(tx.amount))}
                                </td>
                            </tr>
                        );
                    })}
                    {transactions.length === 0 && (
                        <tr>
                            <td colSpan={5} className={styles.centeredCell}>No se encontraron transacciones</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}
