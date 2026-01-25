'use client';

import React, { useState } from 'react';
import styles from './budgets.module.css';

interface EditBudgetModalProps {
    budget: any;
    onClose: () => void;
    onSave: (updatedBudget: any) => Promise<void>;
}

export default function EditBudgetModal({ budget, onClose, onSave }: EditBudgetModalProps) {
    const [amount, setAmount] = useState(budget.amount);
    const [period, setPeriod] = useState(budget.period);
    const [enableCarryOver, setEnableCarryOver] = useState(budget.enableCarryOver);
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            await onSave({
                ...budget,
                amount: Number(amount),
                period,
                enableCarryOver
            });
            onClose();
        } catch (error) {
            console.error(error);
            alert('Error updating budget');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className={styles.modalOverlay}>
            <div className={styles.modal}>
                <div className={styles.modalHeader}>
                    <h3 className={styles.modalTitle}>Editar Presupuesto: {budget.category.name}</h3>
                    <button className={styles.closeButton} onClick={onClose}>&times;</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <label className={styles.label}>Límite ({budget.period === 'MONTHLY' ? 'Mensual' : 'Anual'})</label>
                            <input
                                type="number"
                                className={styles.input}
                                value={amount}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmount(e.target.value)}
                                required
                            />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <label className={styles.label}>Periodo</label>
                            <select
                                className={styles.select}
                                value={period}
                                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPeriod(e.target.value)}
                            >
                                <option value="MONTHLY">Mensual</option>
                                <option value="YEARLY">Anual</option>
                            </select>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <input
                                type="checkbox"
                                id="carryOver"
                                checked={enableCarryOver}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEnableCarryOver(e.target.checked)}
                                style={{ width: 'auto' }}
                            />
                            <label htmlFor="carryOver" className={styles.label} style={{ marginBottom: 0 }}>
                                Habilitar Rollover (acumular saldo no gastado)
                            </label>
                        </div>
                    </div>

                    <div className={styles.modalActions}>
                        <button type="button" className={styles.cancelButton} onClick={onClose}>Cancelar</button>
                        <button type="submit" className={styles.saveButton} disabled={saving}>
                            {saving ? 'Guardando...' : 'Guardar Cambios'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
