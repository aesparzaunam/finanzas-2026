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
                <Database size={14} style={{ display: 'inline', marginRight: 6 } as React.CSSProperties} />
                Datos y Privacidad
            </h2>

            {/* Info de la DB */}
            <div className={styles.fieldRow}>
                <div>
                    <div className={styles.fieldLabel}>Base de datos local</div>
                    <div className={styles.fieldDesc}>SQLite · prisma/finanzas.db</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 } as React.CSSProperties}>
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
            <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-xl)', background: 'rgba(52,211,153,0.06)', fontSize: 'var(--text-xs)', color: 'var(--on-surface-variant)', lineHeight: 1.6 } as React.CSSProperties}>
                🔒 Todos tus datos son almacenados <strong>localmente</strong> en tu dispositivo. No se envían a ningún servidor externo, excepto las llamadas al modelo Gemini para análisis.
            </div>

            {/* Zona de peligro */}
            <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-4)', borderRadius: 'var(--radius-xl)', border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.04)' } as React.CSSProperties}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--space-3)' } as React.CSSProperties}>
                    <AlertTriangle size={16} style={{ color: '#ef4444' } as React.CSSProperties} />
                    <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: '#ef4444' } as React.CSSProperties}>Zona de peligro</span>
                </div>
                <div className={styles.field}>
                    <label className={styles.fieldLabel} htmlFor="del-confirm" style={{ color: 'var(--on-surface-variant)' } as React.CSSProperties}>
                        Escribe <strong>ELIMINAR</strong> para confirmar el borrado de cuenta
                    </label>
                    <div style={{ display: 'flex', gap: 8 } as React.CSSProperties}>
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
