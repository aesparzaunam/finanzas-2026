"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TimelinePoint } from '@/app/lib/types';
import styles from './analysis.module.css';

interface TimelineChartProps {
    data: TimelinePoint[];
}

export default function TimelineChart({ data }: TimelineChartProps) {
    const formatXAxis = (tickItem: string) => {
        const date = new Date(tickItem);
        return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
    };

    const formatCurrency = (val: number) => 
        new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(val);

    return (
        <div className={styles.chartContainer}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <AreaChart data={data}>
                    <defs>
                        <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-light)" />
                    <XAxis 
                        dataKey="date" 
                        tickFormatter={formatXAxis} 
                        tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                        axisLine={false}
                        tickLine={false}
                        minTickGap={30}
                    />
                    <YAxis 
                        tickFormatter={formatCurrency}
                        tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                        axisLine={false}
                        tickLine={false}
                        width={60}
                    />
                    <Tooltip 
                        contentStyle={{ 
                            background: 'var(--background-alt)', 
                            border: '1px solid var(--border-light)',
                            borderRadius: '8px',
                            fontSize: '12px',
                            boxShadow: 'var(--shadow-lg)'
                        }}
                        content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                                const data = payload[0].payload as TimelinePoint;
                                return (
                                    <div className={styles.customTooltip}>
                                        <div className={styles.tooltipLabel}>
                                            {label ? new Date(label).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }) : ''}
                                        </div>
                                        <div className={styles.tooltipValue}>
                                            Saldo: <span>{formatCurrency(data.balance)}</span>
                                        </div>
                                        {data.isImportantPayment && (
                                            <div className={styles.tooltipImpact}>
                                                🎯 {data.paymentDescription}
                                            </div>
                                        )}
                                    </div>
                                );
                            }
                            return null;
                        }}
                    />
                    <Area 
                        type="monotone" 
                        dataKey="balance" 
                        stroke="var(--primary)" 
                        strokeWidth={3}
                        fillOpacity={1} 
                        fill="url(#colorBalance)" 
                        animationDuration={1500}
                        dot={(props: any) => {
                            const { cx, cy, payload } = props;
                            if (payload.isImportantPayment) {
                                return (
                                    <circle 
                                        key={`dot-${payload.date}`}
                                        cx={cx} 
                                        cy={cy} 
                                        r={5} 
                                        fill="var(--danger)" 
                                        stroke="white" 
                                        strokeWidth={2} 
                                    />
                                );
                            }
                            return <></>;
                        }}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
