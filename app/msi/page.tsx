'use client';

import { useEffect, useState } from 'react';
import LayoutShell from '../components/dashboard/LayoutShell';
import styles from '../components/dashboard/dashboard.module.css';
import formStyles from '../components/accounts/accounts.module.css';
import EditMSIModal from '../components/msi/EditMSIModal';

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

    // Form state
    const [totalAmount, setTotalAmount] = useState('');
    const [months, setMonths] = useState('12');
    const [accountId, setAccountId] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [description, setDescription] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        Promise.all([
            fetch('/api/msi').then(r => r.json()),
            fetch('/api/accounts').then(r => r.json()),
            fetch('/api/categories').then(r => r.json())
        ]).then(([plans, accs, cats]) => {
            setMsiPlans(plans);
            // Filter only credit card accounts
            setAccounts(accs.filter((a: Account) => a.type === 'CREDIT'));
            setCategories(cats.filter((c: { type: string }) => c.type === 'EXPENSE'));
            setLoading(false);
        });
    }, []);

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
                    description
                })
            });

            if (res.ok) {
                setTotalAmount('');
                setMonths('12');
                setAccountId('');
                setCategoryId('');
                setDescription('');

                // Refresh MSI plans
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

    const [editingPlan, setEditingPlan] = useState<MSIPlan | null>(null);

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de cancelar este plan MSI? Se borrarán todas las transacciones asociadas.')) return;

        try {
            const res = await fetch(`/api/msi?id=${id}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                // Refresh
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
            body: JSON.stringify({
                id: updatedPlan.id,
                description: updatedPlan.description,
                categoryId: updatedPlan.categoryId
            })
        });

        if (res.ok) {
            // Refresh
            const plans = await fetch('/api/msi').then(r => r.json());
            setMsiPlans(plans);
        } else {
            throw new Error('Failed to update');
        }
    };

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);

    const formatDate = (dateString: string) =>
        new Date(dateString).toLocaleDateString('es-MX', { month: 'short', year: 'numeric' });

    return (
        <LayoutShell>
            <h1 className={styles.pageTitle}>Meses Sin Intereses (MSI)</h1>
            <p className={styles.pageSubtitle}>
                Gestiona tus compras a plazos. Los cargos se distribuyen automáticamente por mes.
            </p>

            {/* Create MSI Form */}
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
                            <label className={formStyles.label} htmlFor="months">Meses</label>
                            <select
                                id="months"
                                title="Selecciona el plazo en meses"
                                className={formStyles.select}
                                value={months}
                                onChange={e => setMonths(e.target.value)}
                            >
                                <option value="3">3 meses</option>
                                <option value="6">6 meses</option>
                                <option value="9">9 meses</option>
                                <option value="12">12 meses</option>
                                <option value="18">18 meses</option>
                                <option value="24">24 meses</option>
                            </select>
                        </div>
                        <div className={formStyles.inputGroup}>
                            <label className={formStyles.label} htmlFor="accountId">Tarjeta de Crédito</label>
                            <select
                                id="accountId"
                                title="Selecciona la tarjeta de crédito"
                                className={formStyles.select}
                                value={accountId}
                                onChange={e => setAccountId(e.target.value)}
                                required
                            >
                                <option value="">Selecciona tarjeta</option>
                                {accounts.map(a => (
                                    <option key={a.id} value={a.id}>{a.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className={formStyles.inputGroup}>
                            <label className={formStyles.label} htmlFor="categoryId">Categoría</label>
                            <select
                                id="categoryId"
                                title="Selecciona la categoría"
                                className={formStyles.select}
                                value={categoryId}
                                onChange={e => setCategoryId(e.target.value)}
                            >
                                <option value="">Sin categoría</option>
                                {categories.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
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
                            <strong>Pago mensual: </strong>
                            {formatCurrency(Number(totalAmount) / Number(months))} x {months} meses
                        </div>
                    )}

                    <button type="submit" className={formStyles.button} disabled={submitting}>
                        {submitting ? 'Creando...' : 'Crear Compra MSI'}
                    </button>
                </form>
            </div>

            {/* MSI Plans List */}
            <h2 className={styles.sectionTitle}>
                Compras Activas
            </h2>

            {loading ? (
                <div className={styles.loadingState}>Cargando...</div>
            ) : msiPlans.length === 0 ? (
                <div className={styles.emptyState}>
                    <p>No tienes compras a meses. Usa el formulario de arriba para agregar una.</p>
                </div>
            ) : (
                <div className={styles.grid}>
                    {msiPlans.map((plan: MSIPlan) => {
                        const progressStyle = { '--progress-width': `${(plan.paidMonths / plan.months) * 100}%` } as React.CSSProperties;
                        return (
                            <div key={plan.id} className={styles.card}>
                                <div className={`${styles.flexBetween} ${styles.alignStart}`}>
                                    <div className={styles.cardTitle}>{plan.description || 'Compra MSI'}</div>
                                    <div className={formStyles.actions}>
                                        <button
                                            onClick={() => setEditingPlan(plan)}
                                            className={formStyles.actionBtn}
                                            title="Editar"
                                        >
                                            ✏️
                                        </button>
                                        <button
                                            onClick={() => handleDelete(plan.id)}
                                            className={formStyles.actionBtn}
                                            title="Eliminar"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                                <div className={styles.cardValue}>{formatCurrency(plan.totalAmount)}</div>
                                <div className={`${styles.flexBetween} ${styles.textSmSecondary}`}>
                                    <span>{plan.months} meses</span>
                                    <span>{formatCurrency(plan.monthlyAmount)}/mes</span>
                                </div>
                                <div className={styles.mt3}>
                                    <div className={`${styles.flexBetween} ${styles.textXsMuted} ${styles.mb4}`}>
                                        <span>Progreso</span>
                                        <span>{plan.paidMonths}/{plan.months} meses</span>
                                    </div>
                                    <div className={styles.progressBarWrapper}>
                                        <div
                                            className={styles.progressBar}
                                            style={progressStyle}
                                        />
                                    </div>
                                </div>
                                <div className={`${styles.mt2} ${styles.textXsMuted}`}>
                                    Inicio: {formatDate(plan.startDate)}
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
