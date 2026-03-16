"use client";

import { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import styles from './charts.module.css';
import { StyledDiv } from '../ui/StyledElements';

interface DebtAccount {
    id: string;
    name: string;
    type: string;
    balance: number;
    annualRate: number;
    minPayment: number;
    monthsToPayoff: number;
}

interface BurndownPoint {
    month: number;
    label: string;
    balance: number;
    balanceBoosted?: number;
}

const formatMXN = (val: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(val);

function buildBurndownData(
    balance: number,
    annualRate: number,
    minPayment: number,
    extraPayment: number,
    maxMonths = 60
): BurndownPoint[] {
    const monthlyRate = annualRate / 100 / 12;
    const points: BurndownPoint[] = [];
    let bal = balance;
    let balBoosted = balance;

    for (let m = 0; m <= maxMonths; m++) {
        const label = m === 0 ? 'Hoy' : `M${m}`;
        points.push({
            month: m,
            label,
            balance: Math.max(0, Math.round(bal * 100) / 100),
            balanceBoosted: Math.max(0, Math.round(balBoosted * 100) / 100),
        });

        if (bal <= 0 && balBoosted <= 0) break;

        if (bal > 0) {
            const interest = bal * monthlyRate;
            bal = Math.max(0, bal + interest - minPayment);
        }
        if (balBoosted > 0) {
            const interest = balBoosted * monthlyRate;
            balBoosted = Math.max(0, balBoosted + interest - (minPayment + extraPayment));
        }
    }

    return points;
}

interface CustomTooltipProps {
    active?: boolean;
    payload?: { value: number; name: string; color: string }[];
    label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
    if (!active || !payload?.length) return null;
    return (
        <div className={styles.tooltipBox}>
            <div className={styles.tooltipDateLabel}>{label}</div>
            {payload.map((p, i) => (
                <div key={i} className={styles.tooltipRow}>
                <StyledDiv
                        className={styles.tooltipDot}
                        applyStyle={{ background: p.color }}
                    />
                    <span className={styles.tooltipSeries}>{p.name}:</span>
                    <span className={styles.tooltipAmount}>{formatMXN(p.value)}</span>
                </div>
            ))}
        </div>
    );
}

export default function DebtBurndownChart() {
    const [debtData, setDebtData] = useState<{ avalanche: DebtAccount[]; summary: { totalDebt: number } } | null>(null);
    const [loading, setLoading] = useState(true);
    const [extraPayment, setExtraPayment] = useState(500);
    const [selectedDebt, setSelectedDebt] = useState<DebtAccount | null>(null);

    useEffect(() => {
        fetch('/api/debt/strategy')
            .then(r => r.json())
            .then(data => {
                setDebtData(data);
                if (data.avalanche?.length > 0) {
                    setSelectedDebt(data.avalanche[0]);
                }
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const burndown = selectedDebt
        ? buildBurndownData(selectedDebt.balance, selectedDebt.annualRate, selectedDebt.minPayment, extraPayment)
        : [];

    const zeroMonthNormal = burndown.find(p => p.balance === 0)?.month;
    const zeroMonthBoosted = burndown.find(p => p.balanceBoosted === 0)?.month;
    const monthsSaved = zeroMonthNormal && zeroMonthBoosted ? zeroMonthNormal - zeroMonthBoosted : 0;

    if (loading) {
        return (
            <div className={styles.widgetCard}>
                <div className={styles.centeredMessage}>Proyectando deuda...</div>
            </div>
        );
    }

    if (!debtData || debtData.summary.totalDebt === 0) {
        return (
            <div className={styles.widgetCard}>
                <div className={styles.widgetTitle}>📉 Proyección de Deuda</div>
                <div className={styles.noDebtMessage}>✅ Sin deudas activas</div>
            </div>
        );
    }

    return (
        <div className={styles.widgetCard}>
            {/* Header */}
            <div className={styles.widgetTitle}>📉 Proyección de Deuda</div>
            <div className={styles.widgetSubtitle}>Evolución proyectada hasta liquidar</div>

            {/* Selector de deuda */}
            {debtData.avalanche.length > 1 && (
                <label htmlFor="debt-selector" className="sr-only">Selecciona una deuda</label>
            )}
            {debtData.avalanche.length > 1 && (
                <select
                    id="debt-selector"
                    value={selectedDebt?.id || ''}
                    onChange={e => {
                        const found = debtData.avalanche.find(d => d.id === e.target.value);
                        if (found) setSelectedDebt(found);
                    }}
                    className={styles.debtSelect}
                    title="Seleccionar deuda"
                >
                    {debtData.avalanche.map(d => (
                        <option key={d.id} value={d.id}>
                            {d.name} — {d.annualRate}% CAT — {formatMXN(d.balance)}
                        </option>
                    ))}
                </select>
            )}

            {/* KPIs */}
            {selectedDebt && (
                <div className={styles.kpiGrid}>
                    <div className={`${styles.kpiCard} ${styles.kpiCardDebt}`}>
                        <div className={styles.kpiLabel}>CAT</div>
                        <div className={styles.kpiValueDebt}>{selectedDebt.annualRate}%</div>
                    </div>
                    <div className={`${styles.kpiCard} ${styles.kpiCardBlue}`}>
                        <div className={styles.kpiLabel}>Meses (normal)</div>
                        <div className={styles.kpiValueBlue}>
                            {zeroMonthNormal ?? (selectedDebt.monthsToPayoff >= 999 ? '∞' : selectedDebt.monthsToPayoff)}
                        </div>
                    </div>
                    <div className={`${styles.kpiCard} ${styles.kpiCardGreen}`}>
                        <div className={styles.kpiLabel}>Ahorro (meses)</div>
                        <div className={styles.kpiValueGreen}>
                            {monthsSaved > 0 ? `-${monthsSaved}` : '—'}
                        </div>
                    </div>
                </div>
            )}

            {/* Slider de pago extra */}
            <div className={styles.extraPaymentSection}>
                <div className={styles.extraPaymentHeader}>
                    <label htmlFor="extra-payment-range" className={styles.extraPaymentLabel}>
                        Pago extra mensual
                    </label>
                    <span className={styles.extraPaymentValue}>{formatMXN(extraPayment)}</span>
                </div>
                <input
                    id="extra-payment-range"
                    type="range"
                    min={0}
                    max={5000}
                    step={100}
                    value={extraPayment}
                    onChange={e => setExtraPayment(Number(e.target.value))}
                    className={styles.rangeInput}
                    aria-label="Pago extra mensual"
                />
                <div className={styles.rangeHints}>
                    <span>$0</span>
                    <span>$5,000</span>
                </div>
            </div>

            {/* Gráfica */}
            <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={burndown} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                    <defs>
                        <linearGradient id="debtGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25} />
                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0.03} />
                        </linearGradient>
                        <linearGradient id="boostedGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0.03} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis
                        dataKey="label"
                        tick={{ fontSize: 9, fill: '#475569' }}
                        tickLine={false}
                        interval={Math.floor(burndown.length / 6)}
                    />
                    <YAxis
                        tick={{ fontSize: 9, fill: '#475569' }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
                        width={36}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 4" />
                    <Area
                        type="monotone"
                        dataKey="balance"
                        name="Pago mínimo"
                        stroke="#ef4444"
                        strokeWidth={2}
                        fill="url(#debtGrad)"
                        dot={false}
                        activeDot={{ r: 4, fill: '#ef4444' }}
                    />
                    {extraPayment > 0 && (
                        <Area
                            type="monotone"
                            dataKey="balanceBoosted"
                            name={`+${formatMXN(extraPayment)} extra`}
                            stroke="#10b981"
                            strokeWidth={2}
                            strokeDasharray="5 3"
                            fill="url(#boostedGrad)"
                            dot={false}
                            activeDot={{ r: 4, fill: '#10b981' }}
                        />
                    )}
                </AreaChart>
            </ResponsiveContainer>

            {/* Leyenda */}
            <div className={styles.legendRow}>
                <div className={styles.legendItem}>
                    <div className={`${styles.legendLine} ${styles.legendLineRed}`} />
                    <span className={styles.legendLabelGray}>Solo mínimos</span>
                </div>
                {extraPayment > 0 && (
                    <div className={styles.legendItem}>
                        <div className={`${styles.legendLine} ${styles.legendLineGreen}`} />
                        <span className={styles.legendLabelGreen}>
                            +{formatMXN(extraPayment)}/mes
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}
