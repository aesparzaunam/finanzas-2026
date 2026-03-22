"use client";

import { useState, useEffect } from 'react';
import styles from './analysis.module.css';
import { X, Pencil, Trash2 } from 'lucide-react';

interface UpcomingPaymentItem {
    id: string;
    name: string;
    amount: number;
    nextDate: string | Date;
    frequency?: string;
    categoryId?: string | null;
    accountId?: string;
    startDate?: string;
    status?: string;
}

interface UpcomingPaymentsProps {
    payments: UpcomingPaymentItem[];
    onRefresh: () => void;
}

const FREQ_LABELS: Record<string, string> = {
    WEEKLY: 'Semanal',
    MONTHLY: 'Mensual',
    YEARLY: 'Anual',
};

export default function UpcomingPayments({ payments, onRefresh }: UpcomingPaymentsProps) {
    // ── Edit modal state ──────────────────────────────────────────────────────
    const [editing, setEditing] = useState<UpcomingPaymentItem | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<UpcomingPaymentItem | null>(null);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);

    // Form state (for edit modal)
    const [editName, setEditName] = useState('');
    const [editAmount, setEditAmount] = useState('');
    const [editFrequency, setEditFrequency] = useState('MONTHLY');
    const [editStartDate, setEditStartDate] = useState('');
    const [categories, setCategories] = useState<{ id: string; name: string; icon?: string }[]>([]);
    const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([]);
    const [editCategoryId, setEditCategoryId] = useState('');
    const [editAccountId, setEditAccountId] = useState('');

    // Load cats/accs when edit modal opens
    useEffect(() => {
        if (!editing) return;
        Promise.all([
            fetch('/api/categories').then(r => r.json()),
            fetch('/api/accounts').then(r => r.json()),
        ]).then(([cats, accs]) => {
            if (Array.isArray(cats)) setCategories(cats);
            if (Array.isArray(accs)) setAccounts(accs);
        });
    }, [editing]);

    const openEdit = (p: UpcomingPaymentItem) => {
        setEditing(p);
        setEditName(p.name);
        setEditAmount(String(p.amount));
        setEditFrequency(p.frequency || 'MONTHLY');
        setEditStartDate(p.startDate ? p.startDate.split('T')[0] : new Date().toISOString().split('T')[0]);
        setEditCategoryId(p.categoryId || '');
        setEditAccountId(p.accountId || '');
    };

    const handleSave = async () => {
        if (!editing) return;
        setSaving(true);
        try {
            const res = await fetch('/api/recurring-payments', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: editing.id,
                    name: editName,
                    amount: Number(editAmount),
                    frequency: editFrequency,
                    startDate: new Date(editStartDate).toISOString(),
                    categoryId: editCategoryId || null,
                    accountId: editAccountId || editing.accountId,
                }),
            });
            if (res.ok) {
                setEditing(null);
                onRefresh();
            } else {
                alert('Error al guardar cambios');
            }
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!confirmDelete) return;
        setDeleting(true);
        try {
            const res = await fetch(`/api/recurring-payments?id=${confirmDelete.id}`, { method: 'DELETE' });
            if (res.ok) {
                setConfirmDelete(null);
                onRefresh();
            } else {
                alert('Error al eliminar pago');
            }
        } finally {
            setDeleting(false);
        }
    };

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);

    const formatDay = (dateStr: string | Date) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
    };

    return (
        <>
            {payments.length === 0 ? (
                <div className={styles.emptyPayments}>
                    No hay pagos programados. Agrega uno con el botón +
                </div>
            ) : (
                <div className={styles.upcomingList}>
                    {payments.map(payment => (
                        <div key={payment.id} className={styles.upcomingItem}>
                            <div className={styles.upcomingInfo}>
                                <span className={styles.upcomingName}>{payment.name}</span>
                                <span className={styles.upcomingDate}>
                                    Próximo: {formatDay(payment.nextDate)} · {FREQ_LABELS[payment.frequency || ''] || payment.frequency}
                                </span>
                            </div>
                            <div className={styles.upcomingRight}>
                                <span className={styles.upcomingAmount}>{formatCurrency(payment.amount)}</span>
                                <div className={styles.upcomingActions}>
                                    <button
                                        className={styles.upcomingEditBtn}
                                        title="Editar"
                                        aria-label="Editar pago recurrente"
                                        onClick={() => openEdit(payment)}
                                    >
                                        <Pencil size={13} />
                                    </button>
                                    <button
                                        className={styles.upcomingDeleteBtn}
                                        title="Eliminar"
                                        aria-label="Eliminar pago recurrente"
                                        onClick={() => setConfirmDelete(payment)}
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Edit Modal ── */}
            {editing && (
                <div className={styles.modalOverlay} onClick={() => setEditing(null)}>
                    <div className={styles.modal} onClick={e => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h3 className={styles.modalTitle}>✏️ Editar Pago Recurrente</h3>
                            <button className={styles.closeButton} onClick={() => setEditing(null)} aria-label="Cerrar">
                                <X size={20} />
                            </button>
                        </div>

                        <div className={styles.form}>
                            <div className={styles.formGroup}>
                                <label className={styles.label} htmlFor="edit-name">Nombre del servicio</label>
                                <input id="edit-name" className={styles.input} value={editName} onChange={e => setEditName(e.target.value)} required />
                            </div>

                            <div className={styles.gridTwoCols}>
                                <div className={styles.formGroup}>
                                    <label className={styles.label} htmlFor="edit-amount">Monto</label>
                                    <input id="edit-amount" type="number" className={styles.input} value={editAmount} onChange={e => setEditAmount(e.target.value)} min="1" step="0.01" required />
                                </div>
                                <div className={styles.formGroup}>
                                    <label className={styles.label} htmlFor="edit-frequency">Frecuencia</label>
                                    <select id="edit-frequency" title="Frecuencia" className={styles.select} value={editFrequency} onChange={e => setEditFrequency(e.target.value)}>
                                        <option value="WEEKLY">Semanal</option>
                                        <option value="MONTHLY">Mensual</option>
                                        <option value="YEARLY">Anual</option>
                                    </select>
                                </div>
                            </div>

                            <div className={styles.formGroup}>
                                <label className={styles.label} htmlFor="edit-account">Cuenta de pago</label>
                                <select id="edit-account" title="Cuenta de pago" className={styles.select} value={editAccountId} onChange={e => setEditAccountId(e.target.value)}>
                                    <option value="">Sin cuenta</option>
                                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                </select>
                            </div>

                            <div className={styles.formGroup}>
                                <label className={styles.label} htmlFor="edit-category">Categoría (opcional)</label>
                                <select id="edit-category" title="Categoría" className={styles.select} value={editCategoryId} onChange={e => setEditCategoryId(e.target.value)}>
                                    <option value="">Sin categoría</option>
                                    {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                                </select>
                            </div>

                            <div className={styles.formGroup}>
                                <label className={styles.label} htmlFor="edit-date">Fecha próximo pago</label>
                                <input id="edit-date" type="date" className={styles.input} value={editStartDate} onChange={e => setEditStartDate(e.target.value)} required />
                            </div>

                            <div className={styles.modalActions}>
                                <button className={styles.btnCancel} onClick={() => setEditing(null)}>Cancelar</button>
                                <button className={styles.btnSave} onClick={handleSave} disabled={saving}>
                                    {saving ? 'Guardando...' : 'Guardar cambios'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Delete Confirm ── */}
            {confirmDelete && (
                <div className={styles.modalOverlay} onClick={() => setConfirmDelete(null)}>
                    <div className={styles.confirmDeleteBox} onClick={e => e.stopPropagation()}>
                        <div className={styles.confirmDeleteIcon}>🗑️</div>
                        <h3 className={styles.confirmDeleteTitle}>¿Eliminar pago?</h3>
                        <p className={styles.confirmDeleteText}>
                            Se eliminará <strong>{confirmDelete.name}</strong> de tus pagos recurrentes. No afecta transacciones ya registradas.
                        </p>
                        <div className={styles.modalActions}>
                            <button className={styles.btnCancel} onClick={() => setConfirmDelete(null)}>Cancelar</button>
                            <button className={styles.btnDelete} onClick={handleDelete} disabled={deleting}>
                                {deleting ? 'Eliminando...' : 'Sí, eliminar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
