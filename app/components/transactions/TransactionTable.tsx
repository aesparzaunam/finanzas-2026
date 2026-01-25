import styles from './transactions.module.css';

interface Transaction {
    id: string;
    date: string;
    description: string;
    amount: number;
    type: string;
    account: { name: string };
    category: { name: string; icon: string; color: string };
}

export default function TransactionTable({ transactions }: { transactions: Transaction[] }) {
    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

    return (
        <div className={styles.tableContainer}>
            <table className={styles.table}>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Description</th>
                        <th>Category</th>
                        <th>Account</th>
                        <th>Amount</th>
                    </tr>
                </thead>
                <tbody>
                    {transactions.map(tx => (
                        <tr key={tx.id}>
                            <td>{new Date(tx.date).toLocaleDateString()}</td>
                            <td>{tx.description}</td>
                            <td>
                                <span style={{ color: tx.category?.color }}>{tx.category?.icon} {tx.category?.name}</span>
                            </td>
                            <td>{tx.account?.name}</td>
                            <td className={`${styles.amount} ${tx.type === 'INCOME' ? styles.income : styles.expense}`}>
                                {tx.type === 'EXPENSE' ? '-' : '+'}{formatCurrency(Number(tx.amount))}
                            </td>
                        </tr>
                    ))}
                    {transactions.length === 0 && (
                        <tr>
                            <td colSpan={5} style={{ textAlign: 'center', color: '#999' }}>No transactions found</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}
