'use client';

import styles from './budgets.module.css';

interface BudgetProps {
    budget: {
        id: string;
        amount: number;
        spent: number;
        remaining: number;
        percentage: number;
        totalAvailable: number;
        carryOverAmount: number;
        enableCarryOver: boolean;
        category: {
            name: string;
            icon?: string;
            color?: string;
        };
        period: string;
    };
}

export default function BudgetCard({ budget }: BudgetProps) {
    const { category, spent, remaining, percentage, totalAvailable, carryOverAmount, enableCarryOver } = budget;

    // Determine status class based on percentage
    let progressClass = styles.statusGood;
    if (percentage > 100) progressClass = styles.statusDanger;
    else if (percentage > 80) progressClass = styles.statusWarning;

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);

    return (
        <div className={styles.card}>
            <div className={styles.header}>
                <div
                    className={styles.icon}
                    style={{ background: category.color ? `linear-gradient(135deg, ${category.color}, ${category.color}dd)` : 'linear-gradient(135deg, #6b7280, #4b5563)' }}
                >
                    {category.icon || '💰'}
                </div>
                <div className={styles.info}>
                    <h3>{category.name}</h3>
                    <span className={styles.period}>
                        {budget.period === 'MONTHLY' ? 'Mensual' : 'Anual'}
                        {enableCarryOver && carryOverAmount > 0 && (
                            <span className={styles.carryOverBadge}> +{formatCurrency(carryOverAmount)} rollover</span>
                        )}
                    </span>
                </div>
                <div className={styles.amount}>
                    {formatCurrency(totalAvailable)}
                </div>
            </div>

            <div className={styles.progressContainer}>
                <div className={styles.progressLabels}>
                    <span>{formatCurrency(spent)} gastado</span>
                    <span className={remaining >= 0 ? styles.remainingPositive : styles.remainingNegative}>
                        {remaining >= 0 ? `${formatCurrency(remaining)} disponible` : `${formatCurrency(Math.abs(remaining))} excedido`}
                    </span>
                </div>
                <div className={styles.progressBarBg}>
                    <div
                        className={`${styles.progressBarFill} ${progressClass}`}
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                </div>
                <div className={styles.percentageLabel}>
                    {percentage.toFixed(0)}% usado
                </div>
            </div>
        </div>
    );
}
