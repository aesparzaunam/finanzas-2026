'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import styles from './widgets.module.css';

interface Badge {
    id:          string;
    label:       string;
    icon:        string;
    description: string;
    earned:      boolean;
}

interface HealthData {
    total:      number;
    level:      string;
    levelColor: string;
    scores: {
        savings:     number;
        dti:         number;
        budgets:     number;
        income:      number;
        consistency: number;
    };
    badges:  Badge[];
    meta: {
        income:      number;
        expenses:    number;
        debtTotal:   number;
        savingsRate: number;
    };
}

interface SubBarProps {
    label:  string;
    value:  number;
    color:  string;
    weight: string;
    isDark: boolean;
}

function SubBar({ label, value, color, weight, isDark }: SubBarProps) {
    return (
        <div className={styles.subBarRow}>
            <div className={`${styles.subBarLabel} ${isDark ? styles.subBarLabelDark : styles.subBarLabelLight}`}>
                {label}
            </div>
            <div className={`${styles.subBarTrack} ${isDark ? styles.subBarTrackDark : styles.subBarTrackLight}`}>
                <div
                    className={styles.subBarFill}
                    style={{ width: `${value}%`, '--bar-color': color } as React.CSSProperties}
                />
            </div>
            <div className={`${styles.subBarVal} ${isDark ? styles.subBarValDark : styles.subBarValLight}`}>
                {value}
            </div>
            <div className={`${styles.subBarWeight} ${isDark ? styles.subBarWeightDark : styles.subBarWeightLight}`}>
                {weight}
            </div>
        </div>
    );
}

export default function HealthScoreWidget() {
    const [data,       setData]       = useState<HealthData | null>(null);
    const [loading,    setLoading]    = useState(true);
    const [showDetail, setShowDetail] = useState(false);
    const { resolvedTheme } = useTheme();
    const isDark = resolvedTheme === 'dark';

    useEffect(() => {
        fetch('/api/dashboard/health-score')
            .then(r => r.json())
            .then(d => { setData(d); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    if (loading) return (
        <div className={`${styles.healthLoading} ${isDark ? styles.healthLoadingDark : styles.healthLoadingLight}`}>
            <div className={isDark ? styles.healthLoadingTextDark : styles.healthLoadingTextLight}>
                Calculando score...
            </div>
        </div>
    );

    if (!data) return null;

    // Estado vacío — nuevo usuario sin transacciones
    if (data.level === 'Sin datos') return (
        <div className={`${styles.health} ${isDark ? styles.healthDark : styles.healthLight}`}>
            <div className={`${styles.healthSectionLabel} ${isDark ? styles.healthSectionLabelDark : styles.healthSectionLabelLight}`}>
                🏅 Salud Financiera
            </div>
            <div className={styles.healthNoData}>
                <div className={styles.healthNoDataIcon}>📊</div>
                <div className={styles.healthNoDataTitle}>Sin calificación aún</div>
                <div className={styles.healthNoDataHint}>
                    Agrega tus primeros ingresos y gastos para ver tu puntuación real.
                </div>
            </div>
        </div>
    );

    const earnedBadges  = data.badges.filter(b => b.earned);
    const pendingBadges = data.badges.filter(b => !b.earned);



    return (
        <div className={`${styles.health} ${isDark ? styles.healthDark : styles.healthLight}`}>

            {/* Section label */}
            <div className={`${styles.healthSectionLabel} ${isDark ? styles.healthSectionLabelDark : styles.healthSectionLabelLight}`}>
                🏅 Salud Financiera
            </div>

            {/* Score arc + level */}
            <div className={styles.healthTop}>
                <div className={styles.healthArcWrap}>
                    <svg width="80" height="48" viewBox="0 0 80 48">
                        <path d="M 8 44 A 32 32 0 0 1 72 44" fill="none"
                            stroke="rgba(255,255,255,0.08)" strokeWidth="8" strokeLinecap="round" />
                        <path d="M 8 44 A 32 32 0 0 1 72 44" fill="none"
                            stroke={data.levelColor} strokeWidth="8" strokeLinecap="round"
                            strokeDasharray={`${(data.total / 100) * 100.53} 100.53`}
                        />
                    </svg>
                    <div
                        className={styles.healthScoreNum}
                        data-color={data.levelColor}
                        style={{ '--level-color': data.levelColor } as React.CSSProperties}
                    >
                        {data.total}
                    </div>
                </div>

                <div>
                    <div
                        className={styles.healthLevelName}
                        style={{ '--level-color': data.levelColor } as React.CSSProperties}
                    >
                        {data.level}
                    </div>
                    <div className={`${styles.healthLevelSub} ${isDark ? styles.healthLevelSubDark : styles.healthLevelSubLight}`}>
                        de 100 puntos posibles
                    </div>
                    {earnedBadges.length > 0 && (
                        <div className={styles.healthEarnedIcons}>
                            {earnedBadges.map(b => b.icon).join(' ')}
                        </div>
                    )}
                </div>
            </div>

            {/* Progress bar */}
            <div className={`${styles.healthBarTrack} ${isDark ? styles.healthBarTrackDark : styles.healthBarTrackLight}`}>
                <div
                    className={styles.healthBarFill}
                    style={{
                        width: `${data.total}%`,
                        '--level-color': data.levelColor,
                    } as React.CSSProperties}
                />
            </div>

            {/* Sub-scores toggle */}
            <button
                onClick={() => setShowDetail(!showDetail)}
                className={`${styles.healthDetailBtn} ${isDark ? styles.healthDetailBtnDark : styles.healthDetailBtnLight}`}
                aria-expanded={showDetail}
            >
                <span>Ver desglose</span>
                <span>{showDetail ? '▲' : '▼'}</span>
            </button>

            {showDetail && (
                <div className={styles.healthSubScores}>
                    <SubBar isDark={isDark} label="Tasa de ahorro"  value={data.scores.savings}     color="#22c55e" weight="30%" />
                    <SubBar isDark={isDark} label="Ratio de Deuda"  value={data.scores.dti}         color="#6366f1" weight="25%" />
                    <SubBar isDark={isDark} label="Presupuestos"    value={data.scores.budgets}     color="#f59e0b" weight="20%" />
                    <SubBar isDark={isDark} label="Consistencia"    value={data.scores.consistency} color="#8b5cf6" weight="15%" />
                    <SubBar isDark={isDark} label="Fuentes ingreso" value={data.scores.income}      color="#06b6d4" weight="10%" />
                </div>
            )}

            {/* Badges earned */}
            {earnedBadges.length > 0 && (
                <div className={`${styles.healthBadgeList} ${isDark ? styles.healthBadgeListDark : styles.healthBadgeListLight}`}>
                    {earnedBadges.map(badge => (
                        <div key={badge.id} title={badge.description} className={styles.healthBadgePill}>
                            <span>{badge.icon}</span>
                            <span className={`${styles.healthBadgeLabel} ${isDark ? styles.healthBadgeLabelDark : styles.healthBadgeLabelLight}`}>
                                {badge.label}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {/* Next badge hint */}
            {pendingBadges.length > 0 && (
                <div className={`${styles.healthNextBadge} ${isDark ? styles.healthNextDark : styles.healthNextLight}`}>
                    Próximo logro: {pendingBadges[0].icon} {pendingBadges[0].label}
                </div>
            )}
        </div>
    );
}
