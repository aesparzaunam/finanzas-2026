"use client";


import styles from './analysis.module.css';

interface UpcomingPaymentItem {
    id: string;
    name: string;
    amount: number;
    nextDate: string;
}

interface UpcomingPaymentsProps {
    payments: UpcomingPaymentItem[];
}

export default function UpcomingPayments({ payments }: UpcomingPaymentsProps) {
    if (payments.length === 0) return (
        <div className={styles.emptyPayments}>
            No hay pagos programados pronto.
        </div>
    );

    const formatCurrency = (val: number) => 
        new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);

    const formatDay = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
    };

    return (
        <div className={styles.upcomingList}>
            {payments.map(payment => (
                <div key={payment.id} className={styles.upcomingItem}>
                    <div className={styles.upcomingInfo}>
                        <span className={styles.upcomingName}>{payment.name}</span>
                        <span className={styles.upcomingDate}>
                            Próximo: {formatDay(payment.nextDate)}
                        </span>
                    </div>
                    <div className={styles.upcomingAmount}>
                        {formatCurrency(payment.amount)}
                    </div>
                </div>
            ))}
        </div>
    );
}
