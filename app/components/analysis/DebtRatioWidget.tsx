"use client";

import { AlertCircle } from 'lucide-react';
import { DebtRatioData } from '@/app/lib/types';
import styles from './analysis.module.css';

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
                <div 
                    className={`${styles.gaugeFill} ${data.isWarning ? styles.warning : ''}`} 
                    style={{ '--ratio-deg': `${limitedRotation}deg` } as any}
                />
            </div>
            
            <div className={styles.ratioValue}>
                {percentage}%
            </div>
            
            <div className={styles.ratioLabel}>
                Ratio de Endeudamiento
            </div>

            <div className={styles.grid} style={{ gridTemplateColumns: '1fr', width: '100%', gap: '8px', marginTop: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Ingreso Promedio:</span>
                    <span style={{ fontWeight: 600 }}>{formatCurrency(data.avgIncome)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Pasivos Fijos:</span>
                    <span style={{ color: data.isWarning ? 'var(--danger)' : 'inherit', fontWeight: 600 }}>
                        {formatCurrency(data.fixedLiabilities)}
                    </span>
                </div>
            </div>

            {data.isWarning && (
                <div style={{ color: 'var(--danger)', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '8px' }}>
                    <AlertCircle size={12} />
                    <span>Límite sugerido (40%) superado</span>
                </div>
            )}
        </div>
    );
}
