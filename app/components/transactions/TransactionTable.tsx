'use client';

import { useState } from 'react';
import styles from './transactions.module.css';
import { StyledSpan } from '../ui/StyledElements';
import TransactionForm from './TransactionForm';
import TagInput from './TagInput';

interface Transaction {
    id: string;
    date: string;
    description: string;
    amount: number;
    type: string;
    accountId: string;
    categoryId?: string | null;
    toAccountId?: string | null;
    tags?: string[];
    account: { name: string } | null;
    category: { name: string; icon: string; color: string } | null;
}

interface TransactionTableProps {
    transactions: Transaction[];
    onRefresh: () => void;
}

export default function TransactionTable({ transactions, onRefresh }: TransactionTableProps) {
    const [editingTx, setEditingTx] = useState<Transaction | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);

    const formatDate = (dateString: string) =>
        new Date(dateString).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });

    const typeLabel = (type: string) => {
        switch (type) {
            case 'INCOME': return { label: 'Ingreso', cls: styles.income };
            case 'EXPENSE': return { label: 'Gasto', cls: styles.expense };
            case 'TRANSFER': return { label: 'Transfer', cls: styles.transfer };
            case 'PAGO_TARJETA': return { label: 'Pago TDC', cls: styles.transfer };
            case 'MSI_CHARGE': return { label: 'MSI', cls: styles.expense };
            default: return { label: type, cls: '' };
        }
    };

    const amountSign = (type: string) => {
        if (type === 'INCOME') return '+';
        if (type === 'TRANSFER' || type === 'PAGO_TARJETA') return '⇆';
        return '-';
    };

    // ── Editar ──────────────────────────────────────────
    const handleEdit = async (data: {
        description: string; amount: string; type: string;
        accountId: string; categoryId: string; date: string; toAccountId?: string;
    }) => {
        if (!editingTx) return;
        const res = await fetch(`/api/transactions?id=${editingTx.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (res.ok) {
            setEditingTx(null);
            onRefresh();
        } else {
            alert('Error al guardar cambios');
        }
    };

    // ── Eliminar ─────────────────────────────────────────
    const handleDelete = async (id: string) => {
        setDeletingId(id);
        try {
            const res = await fetch(`/api/transactions?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                setConfirmDeleteId(null);
                onRefresh();
            } else {
                alert('Error al eliminar');
            }
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <>
            <div className={styles.tableContainer}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>Fecha</th>
                            <th>Descripción</th>
                            <th>Categoría</th>
                            <th>Cuenta</th>
                            <th>Tipo</th>
                            <th className={styles.tagsCell}>Etiquetas</th>
                            <th className={styles.amountCell}>Monto</th>
                            <th className={styles.actionsCell}>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {transactions.map(tx => {
                            const { label, cls } = typeLabel(tx.type);
                            return (
                                <tr key={tx.id} className={styles.tableRow}>
                                    <td className={styles.dateCell}>{formatDate(tx.date)}</td>
                                    <td className={styles.descCell} title={tx.description}>
                                        {tx.description || '—'}
                                    </td>
                                    <td className={styles.categoryCell}>
                                        <StyledSpan
                                            className={styles.categoryName}
                                            applyStyle={{ borderLeftColor: tx.category?.color || 'var(--text-secondary)' }}
                                        >
                                            {tx.category?.icon} {tx.category?.name || 'Sin categoría'}
                                        </StyledSpan>
                                    </td>
                                    <td className={styles.accountCell}>{tx.account?.name || '—'}</td>
                                    <td>
                                        <span className={`${styles.typeBadge} ${cls}`}>{label}</span>
                                    </td>
                                    <td className={styles.tagsCell}>
                                        <TagInput
                                            transactionId={tx.id}
                                            initialTags={tx.tags || []}
                                            compact
                                        />
                                    </td>
                                    <td className={`${styles.amountCell} ${cls}`}>
                                        {amountSign(tx.type)}{formatCurrency(Number(tx.amount))}
                                    </td>
                                    <td className={styles.actionsCell}>
                                        <button
                                            className={styles.editBtn}
                                            title="Editar"
                                            aria-label="Editar movimiento"
                                            onClick={() => setEditingTx(tx)}
                                        >
                                            ✏️
                                        </button>
                                        <button
                                            className={styles.deleteBtn}
                                            title="Eliminar"
                                            aria-label="Eliminar movimiento"
                                            onClick={() => setConfirmDeleteId(tx.id)}
                                        >
                                            🗑️
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                        {transactions.length === 0 && (
                            <tr>
                                <td colSpan={8} className={styles.centeredCell}>
                                    No se encontraron transacciones
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* ── Modal de Edición ── */}
            {editingTx && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalContent}>
                        <div className={styles.modalHeader}>
                            <h2 className={styles.modalTitle}>✏️ Editar Movimiento</h2>
                            <button
                                className={styles.modalCloseBtn}
                                onClick={() => setEditingTx(null)}
                                aria-label="Cerrar"
                            >
                                ✕
                            </button>
                        </div>
                        <TransactionForm
                            initialValues={{
                                description: editingTx.description,
                                amount: String(editingTx.amount),
                                type: editingTx.type,
                                accountId: editingTx.accountId,
                                categoryId: editingTx.categoryId || '',
                                date: editingTx.date.split('T')[0],
                                toAccountId: editingTx.toAccountId || '',
                            }}
                            onCheckSubmit={handleEdit}
                            onCancel={() => setEditingTx(null)}
                            submitLabel="Guardar Cambios"
                        />
                        {/* ── Tags ── */}
                        <div className={styles.tagEditSection}>
                            <label className={styles.tagEditLabel}>🏷️ Etiquetas</label>
                            <TagInput
                                transactionId={editingTx.id}
                                initialTags={editingTx.tags || []}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* ── Confirmación de Eliminar ── */}
            {confirmDeleteId && (
                <div className={styles.modalOverlay}>
                    <div className={styles.confirmBox}>
                        <div className={styles.confirmIcon}>🗑️</div>
                        <h3 className={styles.confirmTitle}>¿Eliminar movimiento?</h3>
                        <p className={styles.confirmText}>
                            Esta acción revertirá el efecto en el saldo de la cuenta. No se puede deshacer.
                        </p>
                        <div className={styles.confirmBtns}>
                            <button
                                className={styles.confirmCancelBtn}
                                onClick={() => setConfirmDeleteId(null)}
                            >
                                Cancelar
                            </button>
                            <button
                                className={styles.confirmDeleteBtn}
                                onClick={() => handleDelete(confirmDeleteId)}
                                disabled={deletingId === confirmDeleteId}
                            >
                                {deletingId === confirmDeleteId ? 'Eliminando...' : 'Sí, eliminar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
