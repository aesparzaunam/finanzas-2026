import styles from './accounts.module.css';

interface AccountProps {
    name: string;
    type: string;
    balance: number;
    currency: string;
}

export default function AccountCard({ name, type, balance, currency }: AccountProps) {
    const formattedBalance = new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: currency,
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
                <div className={`${styles.type} ${typeClassMap[type] || ''}`}>
                    {typeLabels[type] || type}
                </div>
            </div>
            <div className={styles.balance}>{formattedBalance}</div>
        </div>
    );
}
