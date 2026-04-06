'use client';

import { useState, useEffect } from 'react';
import { Database, Download, HardDrive, Shield, Trash2, AlertTriangle } from 'lucide-react';
import styles from '../settings.module.css';

export default function DataSettings() {
    const [dbSize, setDbSize]     = useState<string | null>(null);
    const [txCount, setTxCount]   = useState<number | null>(null);
    const [exporting, setExporting] = useState(false);
    const [confirm, setConfirm]   = useState('');

    useEffect(() => {
        fetch('/api/dashboard/stats')
            .then(r => r.ok ? r.json() : null)
            .then(d => {
                if (d) {
                    setTxCount(d.totalTransactions ?? null);
                    setDbSize(d.dbSizeMb ? `${d.dbSizeMb} MB` : null);
                }
            })
            .catch(() => {});
    }, []);

    const exportCsv = async () => {
        setExporting(true);
        const r = await fetch('/api/transactions/export?format=csv');
        if (r.ok) {
            const blob = await r.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `antigravity-export-${new Date().toISOString().slice(0,10)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
        }
        setExporting(false);
    };

    return (
        <div className={styles.card}>
            <h2 className={styles.cardTitle}>
                <Database size={14} className={styles.inlineIcon} />
                Datos y Privacidad
            </h2>

            {/* Info de la DB */}
            <div className={styles.fieldRow}>
                <div>
                    <div className={styles.fieldLabel}>Base de datos local</div>
                    <div className={styles.fieldDesc}>SQLite · prisma/finanzas.db</div>
                </div>
                <div className={styles.colEnd}>
                    {dbSize  && <span className={styles.infoPill}><HardDrive size={12} /> {dbSize}</span>}
                    {txCount !== null && <span className={styles.infoPill}>{txCount} transacciones</span>}
                    {!dbSize && !txCount && <span className={styles.fieldDesc}>Calculando...</span>}
                </div>
            </div>

            {/* Exportar CSV */}
            <div className={styles.fieldRow}>
                <div>
                    <div className={styles.fieldLabel}>Exportar movimientos</div>
                    <div className={styles.fieldDesc}>Descarga todas tus transacciones en CSV</div>
                </div>
                <button className={styles.btnSecondary} onClick={exportCsv} disabled={exporting}>
                    <Download size={14} /> {exporting ? 'Exportando...' : 'Exportar CSV'}
                </button>
            </div>

            {/* Backup */}
            <div className={styles.fieldRow}>
                <div>
                    <div className={styles.fieldLabel}>Backup de base de datos</div>
                    <div className={styles.fieldDesc}>Descarga una copia de finanzas.db</div>
                </div>
                <a
                    href="/api/data/backup"
                    className={styles.btnSecondary}
                    download="finanzas-backup.db"
                >
                    <Shield size={14} /> Descargar backup
                </a>
            </div>

            {/* Privacy */}
            <div className={styles.infoNote}>
                🔒 Todos tus datos son almacenados <strong>localmente</strong> en tu dispositivo. No se envían a ningún servidor externo, excepto las llamadas al modelo Gemini para análisis.
            </div>

            {/* Zona de peligro */}
            <div className={styles.dangerZone}>
                <div className={styles.dangerZoneHeader}>
                    <AlertTriangle size={16} className={styles.dangerIcon} />
                    <span className={styles.dangerTitle}>Zona de peligro</span>
                </div>
                <div className={styles.field}>
                    <label className={styles.fieldLabelMuted} htmlFor="del-confirm">
                        Escribe <strong>ELIMINAR</strong> para confirmar el borrado de cuenta
                    </label>
                    <div className={styles.rowGap}>
                        <input
                            id="del-confirm"
                            className={styles.fieldInput}
                            placeholder="ELIMINAR"
                            value={confirm}
                            onChange={e => setConfirm(e.target.value)}
                        />
                        <button
                            className={styles.btnDanger}
                            disabled={confirm !== 'ELIMINAR'}
                            onClick={() => {
                                if (confirm === 'ELIMINAR') {
                                    fetch('/api/auth/me', { method: 'DELETE' }).then(() => {
                                        window.location.href = '/auth/login';
                                    });
                                }
                            }}
                        >
                            <Trash2 size={14} /> Eliminar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
