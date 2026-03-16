"use client";

import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import styles from './charts.module.css';
import { StyledDiv, StyledSpan } from '../ui/StyledElements';

interface Rubro {
    id: string;
    label: string;
    color: string;
    total: number;
    count: number;
    percentage: number;
    topTransactions: { desc: string; amount: number }[];
}

interface RubrosData {
    totalGastos: number;
    rubros: Rubro[];
    period: { start: string; months: number };
}

const formatMXN = (val: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(val);

interface CustomTooltipProps {
    active?: boolean;
    payload?: { payload: Rubro }[];
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
    if (!active || !payload?.length) return null;
    const rubro = payload[0].payload;
    return (
        <div className={styles.rubrosTooltip}>
            <StyledSpan className={styles.rubrosTooltipTitle} applyStyle={{ color: rubro.color }}>{rubro.label}</StyledSpan>
            <div className={styles.rubrosTooltipTotal}>{formatMXN(rubro.total)}</div>
            <div className={styles.rubrosTooltipMeta}>{rubro.percentage.toFixed(1)}% del total • {rubro.count} movs</div>
            {rubro.topTransactions.length > 0 && (
                <>
                    <div className={styles.rubrosTooltipTopLabel}>Top movimientos</div>
                    {rubro.topTransactions.slice(0, 3).map((t, i) => (
                        <div key={i} className={styles.rubrosTooltipTxRow}>
                            <span className={styles.rubrosTooltipTxDesc}>{t.desc || '—'}</span>
                            <span className={styles.rubrosTooltipTxAmount}>{formatMXN(t.amount)}</span>
                        </div>
                    ))}
                </>
            )}
        </div>
    );
}

export default function RubrosDonutChart() {
    const [data, setData] = useState<RubrosData | null>(null);
    const [loading, setLoading] = useState(true);
    const [months, setMonths] = useState(1);
    const [activeIndex, setActiveIndex] = useState<number | null>(null);

    useEffect(() => {
        setLoading(true);
        fetch(`/api/debt/rubros?months=${months}`)
            .then(r => r.json())
            .then(setData)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [months]);

    const rubros = data?.rubros || [];

    return (
        <div className={styles.widgetCard}>
            {/* Header */}
            <div className={styles.rubrosHeader}>
                <div>
                    <div className={styles.rubrosTitle}>Gastos por Rubro</div>
                    {data && (
                        <div className={styles.rubrosSubtitle}>
                            Total: {formatMXN(data.totalGastos)}
                        </div>
                    )}
                </div>
                <label htmlFor="rubros-period-select" className="sr-only">Periodo</label>
                <select
                    id="rubros-period-select"
                    value={months}
                    onChange={e => setMonths(Number(e.target.value))}
                    className={styles.rubrosPeriodSelect}
                    title="Periodo"
                >
                    <option value={1}>Este mes</option>
                    <option value={3}>Últimos 3 meses</option>
                    <option value={6}>Últimos 6 meses</option>
                </select>
            </div>

            {loading ? (
                <div className={styles.centeredMessage}>Cargando rubros...</div>
            ) : rubros.length === 0 ? (
                <div className={styles.centeredMessage}>Sin gastos en este periodo</div>
            ) : (
                <>
                    {/* Donut Chart */}
                    <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                            <Pie
                                data={rubros}
                                cx="50%"
                                cy="50%"
                                innerRadius={55}
                                outerRadius={80}
                                paddingAngle={3}
                                dataKey="total"
                                nameKey="label"
                                onMouseEnter={(_, idx) => setActiveIndex(idx)}
                                onMouseLeave={() => setActiveIndex(null)}
                                stroke="none"
                            >
                                {rubros.map((rubro, idx) => (
                                    <Cell
                                        key={rubro.id}
                                        fill={rubro.color}
                                        opacity={activeIndex === null || activeIndex === idx ? 1 : 0.45}
                                        className={styles.cellTransition}
                                    />
                                ))}
                            </Pie>
                            <Tooltip content={<CustomTooltip />} />
                        </PieChart>
                    </ResponsiveContainer>

                    {/* Leyenda manual */}
                    <div className={styles.rubrosLegend}>
                        {rubros.map((rubro, idx) => {
                            return (
                                <div
                                    key={rubro.id}
                                    className={`${styles.rubrosLegendRow} ${activeIndex === idx ? styles.rubrosLegendRowActive : ''}`}
                                    onMouseEnter={() => setActiveIndex(idx)}
                                    onMouseLeave={() => setActiveIndex(null)}
                                >
                                    <div className={styles.rubrosLegendLeft}>
                                        <StyledDiv className={styles.rubrosLegendDot} applyStyle={{ background: rubro.color }} />
                                        <span className={styles.rubrosLegendName}>{rubro.label}</span>
                                    </div>
                                    <div className={styles.rubrosLegendRight}>
                                        <span className={styles.rubrosLegendPct}>{rubro.percentage.toFixed(1)}%</span>
                                        <span className={styles.rubrosLegendAmount}>{formatMXN(rubro.total)}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
}
