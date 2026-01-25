import styles from './dashboard.module.css';

interface MetricCardProps {
    title: string;
    value: string | number;
    trend?: {
        value: number;
        label: string;
    };
    highlight?: boolean;
}

export default function MetricCard({ title, value, trend, highlight }: MetricCardProps) {
    const trendClass = trend
        ? trend.value > 0 ? styles.trendPositive
            : trend.value < 0 ? styles.trendNegative
                : styles.trendNeutral
        : '';

    return (
        <div className={`${styles.card} ${highlight ? styles.netWorth : ''}`}>
            <div className={styles.cardTitle}>{title}</div>
            <div className={styles.cardValue}>{value}</div>
            {trend && (
                <div className={`${styles.cardTrend} ${trendClass}`}>
                    {trend.value > 0 ? '↑' : trend.value < 0 ? '↓' : '→'} {Math.abs(trend.value)}% {trend.label}
                </div>
            )}
        </div>
    );
}
