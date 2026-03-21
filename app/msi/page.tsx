'use client';

import { useEffect, useState, useMemo } from 'react';
import LayoutShell from '../components/dashboard/LayoutShell';
import styles from '../components/dashboard/dashboard.module.css';
import formStyles from '../components/accounts/accounts.module.css';
import msiStyles from './msi.module.css';
import EditMSIModal from '../components/msi/EditMSIModal';
import { StyledDiv } from '../components/ui/StyledElements';

interface Account {
    id: string;
    name: string;
    type: string;
}

import { MSIPlan } from '@/app/lib/types';

export default function MSIPage() {
    const [msiPlans, setMsiPlans] = useState<MSIPlan[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
    const [loading, setLoading] = useState(true);

    // Filter state
    const [filterAccountId, setFilterAccountId] = useState<string>('ALL');

    // Form state
    const [totalAmount, setTotalAmount] = useState('');
    const [months, setMonths] = useState('12');
    const [accountId, setAccountId] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [description, setDescription] = useState('');
    const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [submitting, setSubmitting] = useState(false);
    const [editingPlan, setEditingPlan] = useState<MSIPlan | null>(null);

    useEffect(() => {
        Promise.all([
            fetch('/api/msi').then(r => r.json()),
            fetch('/api/accounts').then(r => r.json()),
            fetch('/api/categories').then(r => r.json())
        ]).then(([plans, accs, cats]) => {
            if (Array.isArray(plans)) setMsiPlans(plans);
            if (Array.isArray(accs)) setAccounts(accs.filter((a: Account) => a.type === 'CREDIT'));
            if (Array.isArray(cats)) setCategories(cats.filter((c: { type: string }) => c.type === 'EXPENSE'));
            setLoading(false);
        });
    }, []);

    // End date preview
    const endDate = useMemo(() => {
        if (!startDate) return null;
        const d = new Date(startDate);
        d.setMonth(d.getMonth() + Number(months) - 1);
        return d.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
    }, [startDate, months]);

    // Helper: account name lookup
    const accountName = (id: string) =>
        accounts.find(a => a.id === id)?.name ?? 'Tarjeta';

    // Filtered plans
    const filteredPlans = useMemo(() =>
        filterAccountId === 'ALL'
            ? msiPlans
            : msiPlans.filter(p => p.accountId === filterAccountId),
        [msiPlans, filterAccountId]
    );

    // Totals for filtered plans
    const totals = useMemo(() => {
        const totalComprado = filteredPlans.reduce((s, p) => s + Number(p.totalAmount), 0);
        const totalMensual = filteredPlans.reduce((s, p) => s + Number(p.monthlyAmount), 0);
        const totalRestante = filteredPlans.reduce((s, p) => {
            const remaining = Number(p.monthlyAmount) * (p.months - p.paidMonths);
            return s + remaining;
        }, 0);
        return { totalComprado, totalMensual, totalRestante };
    }, [filteredPlans]);

    // Per-card summary (always over ALL plans for the breakdown table)
    const perCardSummary = useMemo(() => {
        const getName = (id: string) => accounts.find(a => a.id === id)?.name ?? 'Tarjeta';
        const map = new Map<string, { name: string; totalComprado: number; totalMensual: number; plans: number }>();
        for (const p of msiPlans) {
            const prev = map.get(p.accountId) ?? { name: getName(p.accountId), totalComprado: 0, totalMensual: 0, plans: 0 };
            map.set(p.accountId, {
                name: getName(p.accountId),
                totalComprado: prev.totalComprado + Number(p.totalAmount),
                totalMensual: prev.totalMensual + Number(p.monthlyAmount),
                plans: prev.plans + 1,
            });
        }
        return Array.from(map.entries()).map(([id, data]) => ({ id, ...data }));
    }, [msiPlans, accounts]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const res = await fetch('/api/msi', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    totalAmount: Number(totalAmount),
                    months: Number(months),
                    accountId,
                    categoryId: categoryId || null,
                    description,
                    startDate: startDate || undefined,
                })
            });
            if (res.ok) {
                setTotalAmount(''); setMonths('12'); setAccountId('');
                setCategoryId(''); setDescription('');
                setStartDate(new Date().toISOString().slice(0, 10));
                const plans = await fetch('/api/msi').then(r => r.json());
                setMsiPlans(plans);
            } else {
                const error = await res.json();
                alert(error.error || 'Error creating MSI');
            }
        } catch (error) {
            console.error(error);
            alert('Error creating MSI');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de cancelar este plan MSI? Se borrarán todas las transacciones asociadas.')) return;
        try {
            const res = await fetch(`/api/msi?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                const plans = await fetch('/api/msi').then(r => r.json());
                setMsiPlans(plans);
            } else {
                alert('Error al eliminar plan MSI');
            }
        } catch (error) {
            console.error(error);
            alert('Error al eliminar plan MSI');
        }
    };

    const handleUpdate = async (updatedPlan: MSIPlan) => {
        const res = await fetch('/api/msi', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: updatedPlan.id, description: updatedPlan.description, categoryId: updatedPlan.categoryId })
        });
        if (res.ok) {
            const plans = await fetch('/api/msi').then(r => r.json());
            setMsiPlans(plans);
        } else {
            throw new Error('Failed to update');
        }
    };

    const fmt = (amount: number) =>
        new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);

    const formatDate = (dateString: string) =>
        new Date(dateString).toLocaleDateString('es-MX', { month: 'short', year: 'numeric' });

    return (
        <LayoutShell>
            <h1 className={styles.pageTitle}>Meses Sin Intereses (MSI)</h1>
            <p className={styles.pageSubtitle}>
                Gestiona tus compras a plazos. Los cargos se distribuyen automáticamente por mes.
            </p>

            {/* ── RESUMEN GENERAL ────────────────────────────────── */}
            {!loading && msiPlans.length > 0 && (
                <div className={msiStyles.summarySection}>
                    {/* Filtro por tarjeta */}
                    <div className={msiStyles.filterRow}>
                        <span className={msiStyles.filterLabel}>Filtrar por tarjeta:</span>
                        <div className={msiStyles.filterChips}>
                            <button
                                type="button"
                                className={`${msiStyles.chip} ${filterAccountId === 'ALL' ? msiStyles.chipActive : ''}`}
                                onClick={() => setFilterAccountId('ALL')}
                            >
                                Todas ({msiPlans.length})
                            </button>
                            {perCardSummary.map(card => (
                                <button
                                    key={card.id}
                                    type="button"
                                    className={`${msiStyles.chip} ${filterAccountId === card.id ? msiStyles.chipActive : ''}`}
                                    onClick={() => setFilterAccountId(card.id)}
                                >
                                    {card.name} ({card.plans})
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* KPIs */}
                    <div className={msiStyles.kpiRow}>
                        <div className={msiStyles.kpiCard}>
                            <div className={msiStyles.kpiLabel}>Total comprado</div>
                            <div className={msiStyles.kpiValue}>{fmt(totals.totalComprado)}</div>
                            <div className={msiStyles.kpiSub}>{filteredPlans.length} {filteredPlans.length === 1 ? 'plan' : 'planes'}</div>
                        </div>
                        <div className={msiStyles.kpiCard}>
                            <div className={msiStyles.kpiLabel}>Cargo mensual total</div>
                            <div className={`${msiStyles.kpiValue} ${msiStyles.kpiAlert}`}>{fmt(totals.totalMensual)}</div>
                            <div className={msiStyles.kpiSub}>suma de todos los meses activos</div>
                        </div>
                        <div className={msiStyles.kpiCard}>
                            <div className={msiStyles.kpiLabel}>Por liquidar</div>
                            <div className={msiStyles.kpiValue}>{fmt(totals.totalRestante)}</div>
                            <div className={msiStyles.kpiSub}>saldo pendiente total</div>
                        </div>
                    </div>

                    {/* Desglose por tarjeta (solo en vista "Todas") */}
                    {filterAccountId === 'ALL' && perCardSummary.length > 1 && (
                        <div className={msiStyles.breakdown}>
                            <div className={msiStyles.breakdownTitle}>Desglose por tarjeta</div>
                            {perCardSummary.map(card => (
                                <div key={card.id} className={msiStyles.breakdownRow}>
                                    <span className={msiStyles.breakdownName}>{card.name}</span>
                                    <span className={msiStyles.breakdownPlans}>{card.plans} {card.plans === 1 ? 'plan' : 'planes'}</span>
                                    <span className={msiStyles.breakdownMonthly}>{fmt(card.totalMensual)}/mes</span>
                                    <span className={msiStyles.breakdownTotal}>{fmt(card.totalComprado)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── FORMULARIO ────────────────────────────────────────── */}
            <div className={formStyles.formContainer}>
                <div className={formStyles.formTitle}>Nueva Compra MSI</div>
                <form onSubmit={handleSubmit}>
                    <div className={formStyles.formGrid}>
                        <div className={formStyles.inputGroup}>
                            <label className={formStyles.label} htmlFor="totalAmount">Monto Total</label>
                            <input
                                id="totalAmount"
                                className={formStyles.input}
                                type="number"
                                step="0.01"
                                value={totalAmount}
                                onChange={e => setTotalAmount(e.target.value)}
                                placeholder="ej. 12000"
                                required
                            />
                        </div>
                        <div className={formStyles.inputGroup}>
                            <label className={formStyles.label} htmlFor="months">Meses sin intereses</label>
                            <select id="months" title="Selecciona el plazo en meses" className={formStyles.select} value={months} onChange={e => setMonths(e.target.value)}>
                                {Array.from({ length: 46 }, (_, i) => i + 3).map(m => (
                                    <option key={m} value={m}>{m} {m === 1 ? 'mes' : 'meses'}</option>
                                ))}
                            </select>
                        </div>
                        <div className={formStyles.inputGroup}>
                            <label className={formStyles.label} htmlFor="accountId">Tarjeta de Crédito</label>
                            <select id="accountId" title="Selecciona la tarjeta de crédito" className={formStyles.select} value={accountId} onChange={e => setAccountId(e.target.value)} required>
                                <option value="">Selecciona tarjeta</option>
                                {accounts.map(a => (
                                    <option key={a.id} value={a.id}>{a.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className={formStyles.inputGroup}>
                            <label className={formStyles.label} htmlFor="categoryId">Categoría</label>
                            <select id="categoryId" title="Selecciona la categoría" className={formStyles.select} value={categoryId} onChange={e => setCategoryId(e.target.value)}>
                                <option value="">Sin categoría</option>
                                {categories.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className={formStyles.inputGroup}>
                            <label className={formStyles.label} htmlFor="startDate">Fecha de inicio</label>
                            <input
                                id="startDate"
                                className={formStyles.input}
                                type="date"
                                value={startDate}
                                onChange={e => setStartDate(e.target.value)}
                                required
                            />
                        </div>
                        <div className={`${formStyles.inputGroup} ${styles.spanGrid2}`}>
                            <label className={formStyles.label} htmlFor="description">Descripción</label>
                            <input
                                id="description"
                                className={formStyles.input}
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                placeholder="ej. iPhone 15 Pro"
                            />
                        </div>
                    </div>

                    {totalAmount && (
                        <div className={styles.infoBox}>
                            <div><strong>Pago mensual:</strong> {fmt(Number(totalAmount) / Number(months))} × {months} meses</div>
                            {endDate && (
                                <div className={msiStyles.endDatePreview}>
                                    <strong>Último cargo:</strong> {endDate}
                                </div>
                            )}
                        </div>
                    )}

                    <button type="submit" className={formStyles.button} disabled={submitting}>
                        {submitting ? 'Creando...' : 'Crear Compra MSI'}
                    </button>
                </form>
            </div>

            {/* ── LISTA DE PLANES ───────────────────────────────────── */}
            <div className={msiStyles.sectionHeader}>
                <h2 className={styles.sectionTitle}>
                    Compras Activas
                    {filterAccountId !== 'ALL' && (
                        <span className={msiStyles.filterBadge}> — {accountName(filterAccountId)}</span>
                    )}
                </h2>
            </div>

            {loading ? (
                <div className={styles.loadingState}>Cargando...</div>
            ) : filteredPlans.length === 0 ? (
                <div className={styles.emptyState}>
                    <p>{filterAccountId === 'ALL'
                        ? 'No tienes compras a meses. Usa el formulario de arriba para agregar una.'
                        : `No hay planes activos para ${accountName(filterAccountId)}.`}
                    </p>
                </div>
            ) : (
                <div className={styles.grid}>
                    {filteredPlans.map((plan: MSIPlan) => {
                        const progressWidth = `${(plan.paidMonths / plan.months) * 100}%`;
                        const remaining = Number(plan.monthlyAmount) * (plan.months - plan.paidMonths);
                        return (
                            <div key={plan.id} className={styles.card}>
                                <div className={`${styles.flexBetween} ${styles.alignStart}`}>
                                    <div>
                                        <div className={styles.cardTitle}>{plan.description || 'Compra MSI'}</div>
                                        <span className={msiStyles.cardAccountBadge}>
                                            💳 {accountName(plan.accountId)}
                                        </span>
                                    </div>
                                    <div className={formStyles.actions}>
                                        <button onClick={() => setEditingPlan(plan)} className={formStyles.actionBtn} title="Editar">✏️</button>
                                        <button onClick={() => handleDelete(plan.id)} className={formStyles.actionBtn} title="Eliminar">🗑️</button>
                                    </div>
                                </div>

                                <div className={styles.cardValue}>{fmt(plan.totalAmount)}</div>

                                <div className={`${styles.flexBetween} ${styles.textSmSecondary}`}>
                                    <span>{plan.months} meses</span>
                                    <span>{fmt(plan.monthlyAmount)}/mes</span>
                                </div>

                                <div className={styles.mt3}>
                                    <div className={`${styles.flexBetween} ${styles.textXsMuted} ${styles.mb4}`}>
                                        <span>Progreso</span>
                                        <span>{plan.paidMonths}/{plan.months} meses</span>
                                    </div>
                                    <div className={styles.progressBarWrapper}>
                                        <StyledDiv
                                            className={styles.progressBar}
                                            applyStyle={{ width: progressWidth }}
                                        />
                                    </div>
                                </div>

                                <div className={`${styles.flexBetween} ${styles.mt2} ${styles.textXsMuted}`}>
                                    <span>Inicio: {formatDate(plan.startDate)}</span>
                                    <span className={msiStyles.remainingTag}>Por pagar: {fmt(remaining)}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {editingPlan && (
                <EditMSIModal
                    plan={editingPlan}
                    categories={categories}
                    onClose={() => setEditingPlan(null)}
                    onSave={handleUpdate}
                />
            )}

        </LayoutShell>
    );
}
