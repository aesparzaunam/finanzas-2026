"use client";

import { AlertTriangle, Info } from 'lucide-react';
import { HormigaAnalysis } from '@/app/lib/types';
import styles from './analysis.module.css';

interface HormigaAlertProps {
    alerts: HormigaAnalysis[];
}

export default function HormigaAlert({ alerts }: HormigaAlertProps) {
    if (alerts.length === 0) return null;

    return (
        <div className={styles.hormigaBanner}>
            <AlertTriangle className={styles.alertIcon} size={20} />
            <div className={styles.alertContent}>
                <div className={styles.alertTitle}>¡Alerta de Gasto Hormiga!</div>
                <div className={styles.alertText}>
                    Se detectaron patrones de gastos menores a $500 repetitivos en la última semana:
                    <div className={styles.tagContainer}>
                        {alerts.map(alert => (
                            <span key={alert.categoryName} className={styles.categoryTag}>
                                {alert.categoryName}: {alert.count} veces
                            </span>
                        ))}
                    </div>
                </div>
            </div>
            <div className={styles.infoWrapper} title="Gastos hormiga: micro-compras que acumuladas afectan tu flujo de caja.">
                <Info size={16} />
            </div>
        </div>
    );
}
