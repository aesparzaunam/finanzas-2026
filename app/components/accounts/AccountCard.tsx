import styles from './accounts.module.css';

interface AccountProps {
    id: string; // Added ID for actions
    name: string;
    type: string;
    balance: number;
    currency: string;
    onEdit?: (account: { id: string; name: string; type: string; balance: number; currency: string }) => void;
    onDelete?: (id: string) => void;
}

export default function AccountCard({ id, name, type, balance, currency, onEdit, onDelete }: AccountProps) {
    const formattedBalance = new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN',
    }).format(balance);

    // Map type to CSS class
    const typeClassMap: Record<string, string> = {
        BANK: styles.typeBank,
        CASH: styles.typeCash,
        CREDIT: styles.typeCredit,
        INVESTMENT: styles.typeInvestment,
        LOAN: styles.typeLoan,
    };

    const typeLabels: Record<string, string> = {
        BANK: 'Banco',
        CASH: 'Efectivo',
        CREDIT: 'Crédito',
        INVESTMENT: 'Inversión',
        LOAN: 'Préstamo',
    };

    return (
        <div className={styles.card}>
            <div className={styles.header}>
                <div className={styles.name}>{name}</div>
                <div className={styles.typeContainer}>
                    <div className={`${styles.type} ${typeClassMap[type] || ''}`}>
                        {typeLabels[type] || type}
                    </div>
                    {(onEdit || onDelete) && (
                        <div className={styles.actions}>
                            {onEdit && (
                                <button
                                    className={styles.actionBtn}
                                    onClick={() => onEdit({ id, name, type, balance, currency })}
                                    title="Editar cuenta"

                                >
                                    ✏️
                                </button>
                            )}
                            {onDelete && (
                                <button
                                    className={`${styles.actionBtn} ${styles.deleteBtn}`}
                                    onClick={() => onDelete(id)}
                                    title="Eliminar cuenta"
                                >
                                    🗑️
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
            <div className={styles.balance}>{formattedBalance}</div>
        </div>
    );
}
