'use client';

import { useState, useEffect } from 'react';
import { Home, UserPlus, Link2Off, Users } from 'lucide-react';
import styles from '../settings.module.css';

interface HouseholdData {
    id: string;
    status: string;
    inviteEmail: string | null;
    partnerId: string | null;
    partner?: { name: string; email: string } | null;
}

export default function HouseholdSettings() {
    const [data, setData]       = useState<HouseholdData | null>(null);
    const [loading, setLoading] = useState(true);
    const [invite, setInvite]   = useState('');
    const [sending, setSending] = useState(false);
    const [msg, setMsg]         = useState('');

    useEffect(() => {
        fetch('/api/household')
            .then(r => r.ok ? r.json() : null)
            .then(d => { setData(d); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    const sendInvite = async () => {
        if (!invite.includes('@')) { setMsg('Ingresa un correo válido'); return; }
        setSending(true);
        const r = await fetch('/api/household', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ inviteEmail: invite }),
        });
        setSending(false);
        const d = await r.json();
        if (r.ok) { setMsg('✓ Invitación enviada'); setData(d); setInvite(''); }
        else { setMsg(d.error || 'Error al enviar'); }
    };

    const unlink = async () => {
        if (!confirm('¿Desvincular el hogar compartido?')) return;
        await fetch('/api/household', { method: 'DELETE' });
        setData(null);
        setMsg('Hogar desvinculado');
    };

    if (loading) return (
        <div className={styles.card}><p className={styles.fieldDesc}>Cargando...</p></div>
    );

    const status = data?.status;

    return (
        <div className={styles.card}>
            <h2 className={styles.cardTitle}>
                <Home size={14} style={{ display: 'inline', marginRight: 6 } as React.CSSProperties} />
                Hogar Compartido
            </h2>

            {/* Estado actual */}
            <div className={styles.fieldRow}>
                <div>
                    <div className={styles.fieldLabel}>Estado del hogar</div>
                    <div className={styles.fieldDesc}>
                        {!data && 'Sin hogar configurado'}
                        {status === 'PENDING'  && `Invitación pendiente → ${data?.inviteEmail}`}
                        {status === 'ACTIVE'   && `Vinculado con ${data?.partner?.name || data?.partner?.email || 'tu pareja'}`}
                    </div>
                </div>
                {!status        && <span className={styles.infoPill}>Sin hogar</span>}
                {status === 'PENDING' && <span className={styles.statusWarn}>⏳ Pendiente</span>}
                {status === 'ACTIVE'  && <span className={styles.statusOk}><Users size={12} style={{ display: 'inline' } as React.CSSProperties} /> Activo</span>}
            </div>

            {/* Invitar */}
            {!data && (
                <div className={styles.field}>
                    <label className={styles.fieldLabel} htmlFor="hh-email">
                        <UserPlus size={13} style={{ display: 'inline', marginRight: 4 } as React.CSSProperties} />
                        Invitar pareja o familiar
                    </label>
                    <div style={{ display: 'flex', gap: 8 } as React.CSSProperties}>
                        <input
                            id="hh-email"
                            className={styles.fieldInput}
                            placeholder="correo@ejemplo.com"
                            value={invite}
                            onChange={e => setInvite(e.target.value)}
                            type="email"
                        />
                        <button className={styles.btnPrimary} onClick={sendInvite} disabled={sending}>
                            {sending ? '...' : 'Invitar'}
                        </button>
                    </div>
                    {msg && <span className={styles.fieldDesc}>{msg}</span>}
                </div>
            )}

            {/* Desvincular */}
            {data && (
                <div className={styles.fieldRow}>
                    <div>
                        <div className={styles.fieldLabel}>Desvincular hogar</div>
                        <div className={styles.fieldDesc}>Esto eliminará el acceso compartido</div>
                    </div>
                    <button className={styles.btnDanger} onClick={unlink}>
                        <Link2Off size={14} /> Desvincular
                    </button>
                </div>
            )}
            {msg && data && <span className={styles.fieldDesc}>{msg}</span>}

            {/* Info */}
            <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-xl)', background: 'rgba(146,170,255,0.06)', fontSize: 'var(--text-xs)', color: 'var(--on-surface-variant)', lineHeight: 1.6 } as React.CSSProperties}>
                💡 El hogar compartido te permite ver el patrimonio consolidado con otro usuario. Cada usuario mantiene sus propias cuentas y transacciones privadas.
            </div>
        </div>
    );
}
