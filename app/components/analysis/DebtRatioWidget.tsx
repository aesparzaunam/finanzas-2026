"use client";

import { AlertCircle } from 'lucide-react';
import { DebtRatioData } from '@/app/lib/types';
import styles from './analysis.module.css';
import { StyledDiv } from '../ui/StyledElements';

interface DebtRatioWidgetProps {
    data: DebtRatioData;
}

export default function DebtRatioWidget({ data }: DebtRatioWidgetProps) {
    const percentage = Math.round(data.ratio * 100);
    // Convert 0-1 ratio to -90 to 90 degrees for the gauge
    const rotation = (data.ratio * 180) - 90;
    const limitedRotation = Math.min(Math.max(rotation, -90), 90);

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(val);

    return (
        <div className={styles.ratioWrapper}>
            <div className={styles.gaugeContainer}>
                <div className={styles.gaugeBackground} />
                <StyledDiv
                    className={`${styles.gaugeFill} ${data.isWarning ? styles.warning : ''}`}
                    applyStyle={{ transform: `rotate(${limitedRotation}deg)` }}
                />
            </div>

            <div className={styles.ratioValue}>
                {percentage}%
            </div>

            <div className={styles.ratioLabel}>
                Ratio de Endeudamiento
            </div>

            <div className={styles.debtInfoGrid}>
                <div className={styles.debtInfoRow}>
                    <span className={styles.debtInfoLabel}>Ingreso Promedio:</span>
                    <span className={styles.debtInfoValue}>{formatCurrency(data.avgIncome)}</span>
                </div>
                <div className={styles.debtInfoRow}>
                    <span className={styles.debtInfoLabel}>Pasivos Fijos:</span>
                    <span className={data.isWarning ? styles.debtInfoValueDanger : styles.debtInfoValue}>
                        {formatCurrency(data.fixedLiabilities)}
                    </span>
                </div>
            </div>

            {data.isWarning && (
                <div className={styles.debtWarning}>
                    <AlertCircle size={12} />
                    <span>Límite sugerido (40%) superado</span>
                </div>
            )}
        </div>
    );
}
