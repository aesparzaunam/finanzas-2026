'use client';

import { useEffect, useState, useCallback } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    Legend, ResponsiveContainer,
} from 'recharts';
import { Household, HouseholdSummary, HouseholdTransaction } from '@/app/lib/types';
import styles from './household.module.css';

// ── Tipos internos ─────────────────────────────────────────────────────────────

interface HouseholdWithRole extends Household {
    role: 'OWNER' | 'PARTNER';
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function currentYYYYMM(): string {
    return new Date().toISOString().slice(0, 7);
}

const MONTH_NAMES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

function formatMonth(yyyyMM: string): string {
    const [y, m] = yyyyMM.split('-');
    return `${MONTH_NAMES[parseInt(m) - 1]} ${y}`;
}

function fmtMXN(n: number): string {
    return `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function HouseholdPage() {
    const [household, setHousehold]   = useState<HouseholdWithRole | null | 'loading'>('loading');
    const [month,     setMonth]       = useState(currentYYYYMM());
    const [summary,   setSummary]     = useState<HouseholdSummary | null>(null);
    const [txs,       setTxs]         = useState<HouseholdTransaction[]>([]);
    const [summaryLoading, setSummaryLoading] = useState(false);
    const [txLoading,      setTxLoading]      = useState(false);

    // Invitación
    const [partnerEmail,  setPartnerEmail]  = useState('');
    const [inviteLoading, setInviteLoading] = useState(false);
    const [inviteError,   setInviteError]   = useState('');
    const [inviteSuccess, setInviteSuccess] = useState('');

    // ── Cargar household ──────────────────────────────────────────────────────
    useEffect(() => {
        fetch('/api/household')
            .then(r => r.json())
            .then(data => setHousehold(data))
            .catch(() => setHousehold(null));
    }, []);

    // ── Cargar datos del mes ──────────────────────────────────────────────────
    const loadData = useCallback(async (m: string) => {
        if (!household || household === 'loading') return;
        const h = household as HouseholdWithRole;
        if (h.status !== 'ACTIVE') return;

        setSummaryLoading(true);
        setTxLoading(true);

        fetch(`/api/household/summary?month=${m}`)
            .then(r => r.json())
            .then(data => setSummary(data))
            .catch(() => setSummary(null))
            .finally(() => setSummaryLoading(false));

        fetch(`/api/household/transactions?month=${m}`)
            .then(r => r.json())
            .then(data => setTxs(data?.transactions ?? []))
            .catch(() => setTxs([]))
            .finally(() => setTxLoading(false));
    }, [household]);

    useEffect(() => { loadData(month); }, [month, loadData]);

    // ── Aceptar invitación ────────────────────────────────────────────────────
    async function handleAccept() {
        const res = await fetch('/api/household', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'accept' }),
        });
        if (res.ok) {
            const updated = await fetch('/api/household').then(r => r.json());
            setHousehold(updated);
        }
    }

    async function handleReject() {
        await fetch('/api/household', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'reject' }),
        });
        setHousehold(null);
    }

    // ── Crear invitación ──────────────────────────────────────────────────────
    async function handleInvite(e: React.FormEvent) {
        e.preventDefault();
        setInviteError('');
        setInviteSuccess('');
        setInviteLoading(true);
        try {
            const res = await fetch('/api/household', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ partnerEmail }),
            });
            const data = await res.json();
            if (!res.ok) { setInviteError(data.error || 'Error al enviar invitación'); return; }
            setInviteSuccess(`Invitación enviada a ${partnerEmail}. Cuando acepte, verán las finanzas del hogar.`);
            setPartnerEmail('');
            const updated = await fetch('/api/household').then(r => r.json());
            setHousehold(updated);
        } catch {
            setInviteError('Error de red. Intenta de nuevo.');
        } finally {
            setInviteLoading(false);
        }
    }

    // ── Disolver hogar ────────────────────────────────────────────────────────
    async function handleDissolve() {
        if (!confirm('¿Estás seguro de disolver el hogar? Ambos usuarios perderán acceso a la vista compartida.')) return;
        await fetch('/api/household', { method: 'DELETE' });
        setHousehold(null);
        setSummary(null);
        setTxs([]);
    }

    // ── Render: loading ───────────────────────────────────────────────────────
    if (household === 'loading') {
        return (
            <main className={styles.page}>
                <div className={styles.loadingState}>
                    <div className={styles.spinner} />
                    <p>Cargando hogar…</p>
                </div>
            </main>
        );
    }

    // ── Render: sin hogar ─────────────────────────────────────────────────────
    if (!household) {
        return (
            <main className={styles.page}>
                <header className={styles.header}>
                    <h1 className={styles.pageTitle}>🏠 Finanzas del Hogar</h1>
                    <p className={styles.pageSubtitle}>Comparte y analiza las finanzas con tu pareja o familiar.</p>
                </header>
                <section className={styles.setupCard}>
                    <h2>Conectar con tu pareja</h2>
                    <p>Ingresa el correo de la persona con quien quieres compartir las finanzas.<br />
                    El usuario debe tener una cuenta activa en la app.</p>
                    <form onSubmit={handleInvite} className={styles.inviteForm}>
                        <input
                            type="email"
                            value={partnerEmail}
                            onChange={e => setPartnerEmail(e.target.value)}
                            placeholder="correo@ejemplo.com"
                            required
                            className={styles.input}
                        />
                        <button type="submit" disabled={inviteLoading} className={styles.btnPrimary}>
                            {inviteLoading ? 'Enviando…' : 'Enviar invitación'}
                        </button>
                    </form>
                    {inviteError   && <p className={styles.error}>{inviteError}</p>}
                    {inviteSuccess && <p className={styles.success}>{inviteSuccess}</p>}
                </section>
            </main>
        );
    }

    const h = household as HouseholdWithRole;

    // ── Render: invitación pendiente (como PARTNER) ───────────────────────────
    if (h.status === 'PENDING' && h.role === 'PARTNER') {
        return (
            <main className={styles.page}>
                <section className={styles.pendingBanner}>
                    <div className={styles.pendingIcon}>💌</div>
                    <h2>Tienes una invitación</h2>
                    <p><strong>{h.ownerName}</strong> ({h.ownerEmail}) quiere compartir las finanzas del hogar contigo.</p>
                    <div className={styles.pendingActions}>
                        <button onClick={handleAccept} className={styles.btnPrimary}>✅ Aceptar</button>
                        <button onClick={handleReject} className={styles.btnDanger}>❌ Rechazar</button>
                    </div>
                </section>
            </main>
        );
    }

    // ── Render: invitación enviada, esperando respuesta ────────────────────────
    if (h.status === 'PENDING' && h.role === 'OWNER') {
        return (
            <main className={styles.page}>
                <section className={styles.pendingBanner}>
                    <div className={styles.pendingIcon}>⏳</div>
                    <h2>Invitación enviada</h2>
                    <p>Esperando que <strong>{h.partnerName || h.partnerEmail}</strong> acepte la invitación.</p>
                    <button onClick={handleDissolve} className={styles.btnDanger}>Cancelar invitación</button>
                </section>
            </main>
        );
    }

    // ── Render: hogar activo ──────────────────────────────────────────────────

    // Datos para la gráfica de barras
    const chartData = (summary?.byCategory ?? []).slice(0, 8).map(c => ({
        name: c.categoryName.length > 12 ? c.categoryName.slice(0, 11) + '…' : c.categoryName,
        [summary?.ownerName ?? 'Propietario']:   Math.round(c.ownerAmount),
        [summary?.partnerName ?? 'Pareja']:       Math.round(c.partnerAmount),
    }));

    return (
        <main className={styles.page}>
            {/* ── Header ─────────────────────────────────────────────────────── */}
            <header className={styles.header}>
                <div>
                    <h1 className={styles.pageTitle}>🏠 Finanzas del Hogar</h1>
                    <p className={styles.pageSubtitle}>
                        {h.ownerName} &amp; {h.partnerName}
                    </p>
                </div>
                <div className={styles.headerActions}>
                    <select
                        value={month}
                        onChange={e => setMonth(e.target.value)}
                        className={styles.monthSelect}
                        title="Seleccionar mes"
                        aria-label="Seleccionar mes"
                    >
                        {Array.from({ length: 12 }, (_, i) => {
                            const d = new Date();
                            d.setMonth(d.getMonth() - i);
                            const val = d.toISOString().slice(0, 7);
                            return <option key={val} value={val}>{formatMonth(val)}</option>;
                        })}
                    </select>
                    {h.role === 'OWNER' && (
                        <button onClick={handleDissolve} className={styles.btnDangerSm}>
                            Disolver hogar
                        </button>
                    )}
                </div>
            </header>

            {/* ── KPIs ───────────────────────────────────────────────────────── */}
            <div className={styles.kpiRow}>
                <div className={styles.kpiCard}>
                    <span className={styles.kpiLabel}>Gasto total del hogar</span>
                    <span className={styles.kpiValue}>
                        {summaryLoading ? '—' : fmtMXN((summary?.totalByMember.owner ?? 0) + (summary?.totalByMember.partner ?? 0))}
                    </span>
                </div>
                <div className={styles.kpiCard}>
                    <span className={styles.kpiLabel}>{h.ownerName}</span>
                    <span className={styles.kpiValue}>
                        {summaryLoading ? '—' : fmtMXN(summary?.totalByMember.owner ?? 0)}
                    </span>
                </div>
                <div className={styles.kpiCard}>
                    <span className={styles.kpiLabel}>{h.partnerName}</span>
                    <span className={styles.kpiValue}>
                        {summaryLoading ? '—' : fmtMXN(summary?.totalByMember.partner ?? 0)}
                    </span>
                </div>
            </div>

            {/* ── Narrativa Ollama ───────────────────────────────────────────── */}
            {summaryLoading ? (
                <div className={styles.narrativeSkeleton} />
            ) : summary?.narrative ? (
                <div className={styles.narrativeCard}>
                    <span className={styles.narrativeIcon}>✨</span>
                    <p className={styles.narrativeText}>{summary.narrative}</p>
                </div>
            ) : null}

            {/* ── Gráfica comparativa ─────────────────────────────────────────── */}
            <section className={styles.chartSection}>
                <h2 className={styles.sectionTitle}>Gasto por categoría</h2>
                {summaryLoading ? (
                    <div className={styles.chartSkeleton} />
                ) : chartData.length === 0 ? (
                    <p className={styles.empty}>Sin transacciones este mes.</p>
                ) : (
                    <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                            <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={v => `$${v}`} />
                            <Tooltip
                                contentStyle={{ background: '#1e1b4b', border: '1px solid #4f46e5', borderRadius: 8 }}
                                labelStyle={{ color: '#e2e8f0' }}
                                formatter={(v: number | undefined) => v != null ? fmtMXN(v) : ''}
                            />
                            <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 12 }} />
                            <Bar dataKey={summary?.ownerName ?? 'Propietario'} fill="#6366f1" radius={[4,4,0,0]} />
                            <Bar dataKey={summary?.partnerName ?? 'Pareja'}    fill="#a855f7" radius={[4,4,0,0]} />
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </section>

            {/* ── Feed de transacciones ──────────────────────────────────────── */}
            <section className={styles.feedSection}>
                <h2 className={styles.sectionTitle}>Transacciones del mes</h2>
                {txLoading ? (
                    <div className={styles.txSkeletons}>
                        {[1,2,3,4,5].map(n => <div key={n} className={styles.txSkeleton} />)}
                    </div>
                ) : txs.length === 0 ? (
                    <p className={styles.empty}>Sin transacciones registradas.</p>
                ) : (
                    <ul className={styles.txList}>
                        {txs.map(tx => (
                            <li key={tx.id} className={styles.txItem}>
                                <div
                                    className={`${styles.txAvatar} ${tx.member === 'OWNER' ? styles.txAvatarOwner : styles.txAvatarPartner}`}
                                >
                                    {tx.memberName.charAt(0).toUpperCase()}
                                </div>
                                <div className={styles.txBody}>
                                    <span className={styles.txDesc}>{tx.description}</span>
                                    <span className={styles.txMeta}>
                                        {tx.memberName} · {new Date(tx.date).toLocaleDateString('es-MX')}
                                    </span>
                                </div>
                                <span className={styles.txAmount}>
                                    {tx.type === 'INCOME' ? '+' : '-'}{fmtMXN(tx.amount)}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </main>
    );
}
