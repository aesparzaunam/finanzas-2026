'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, CartesianGrid, Line } from 'recharts';
import styles from '../dashboard/dashboard.module.css';

interface HistoryItem {
    month: string;
    income: number;
    expense: number;
}

interface ChartsProps {
    history: HistoryItem[];
}

interface TooltipEntry {
    name: string;
    value: number;
    color: string;
    payload: Record<string, unknown>;
}

interface CustomTooltipProps {
    active?: boolean;
    payload?: TooltipEntry[];
    label?: string;
}

// Custom tooltip component
const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
    if (active && payload && payload.length) {
        return (
            <div className={styles.tooltipContainer}>
                <p className={styles.tooltipLabel}>{label}</p>
                {payload.map((entry, index) => {
                    const entryStyle = { '--entry-color': entry.color } as React.CSSProperties;
                    return (
                        <p
                            key={index}
                            className={styles.tooltipEntry}
                            style={entryStyle}
                        >
                            {entry.name}: {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(entry.value)}
                        </p>
                    );
                })}
            </div>
        );
    }
    return null;
};

export default function Charts({ history }: ChartsProps) {
    // formatCurrency is used in rendering but defined here for consistency
    // const formatCurrency = (value: number) => ... (actually used in Tooltip)

    // Calculate net for area chart
    const historyWithNet = history.map(item => ({
        ...item,
        net: item.income - item.expense
    }));

    return (
        <>
            {/* Income vs Expense Chart */}
            <div className={styles.chartCard}>
                <h3 className={styles.chartTitle}>
                    📊 Ingresos vs Gastos (Últimos 6 meses)
                </h3>
                <div className={styles.chartContainer}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={history} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                            <XAxis
                                dataKey="month"
                                tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                                axisLine={{ stroke: 'var(--border-light)' }}
                            />
                            <YAxis
                                tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                                axisLine={{ stroke: 'var(--border-light)' }}
                                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend
                                wrapperStyle={{ paddingTop: '20px' }}
                                formatter={(value) => <span className={styles.legendText}>{value}</span>}
                            />
                            <Bar
                                dataKey="income"
                                name="Ingresos"
                                fill="#10b981"
                                radius={[6, 6, 0, 0]}
                                animationDuration={800}
                            />
                            <Bar
                                dataKey="expense"
                                name="Gastos"
                                fill="#ef4444"
                                radius={[6, 6, 0, 0]}
                                animationDuration={800}
                                animationBegin={200}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Monthly Expense Evolution (12 months) */}
            <div className={styles.chartCard}>
                <h3 className={styles.chartTitle}>
                    📈 Evolución del Gasto Mensual (12 meses)
                </h3>
                <div className={styles.chartContainer}>
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={historyWithNet} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="netGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                            <XAxis
                                dataKey="month"
                                tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                                axisLine={{ stroke: 'var(--border-light)' }}
                            />
                            <YAxis
                                tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                                axisLine={{ stroke: 'var(--border-light)' }}
                                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend
                                wrapperStyle={{ paddingTop: '20px' }}
                                formatter={(value) => <span className={styles.legendText}>{value}</span>}
                            />
                            <Area
                                type="monotone"
                                dataKey="expense"
                                name="Gastos"
                                stroke="#ef4444"
                                strokeWidth={2}
                                fill="url(#expenseGradient)"
                                animationDuration={1000}
                            />
                            <Line
                                type="monotone"
                                dataKey="net"
                                name="Flujo Neto"
                                stroke="#2563eb"
                                strokeWidth={2}
                                dot={{ fill: '#2563eb', strokeWidth: 2, r: 4 }}
                                activeDot={{ r: 6, strokeWidth: 0 }}
                                animationDuration={1000}
                                animationBegin={300}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </>
    );
}
