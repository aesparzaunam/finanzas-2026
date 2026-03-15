'use client';

import { useState } from 'react';
import styles from './accounts.module.css';

interface EditAccountModalProps {
    account: any;
    onClose: () => void;
    onSave: (updatedAccount: any) => Promise<void>;
}

export default function EditAccountModal({ account, onClose, onSave }: EditAccountModalProps) {
    const [name, setName] = useState(account.name);
    const [type, setType] = useState(account.type);
    const [balance, setBalance] = useState(account.balance);
    const [billingDay, setBillingDay] = useState(account.billingDay || 1);
    const [paymentDay, setPaymentDay] = useState(account.paymentDay || 15);
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const updatedAccount: any = {
                ...account,
                name,
                type,
                balance: Number(balance)
            };
            
            if (type === 'CREDIT') {
                updatedAccount.billingDay = Number(billingDay);
                updatedAccount.paymentDay = Number(paymentDay);
            }

            await onSave(updatedAccount);
            onClose();
        } catch (error) {
            console.error(error);
            alert('Error updating account');
        } finally {
            setSaving(false);
        }
    };

    const dayOptions = Array.from({ length: 31 }, (_, i) => i + 1);

    return (
        <div className={styles.modalOverlay}>
            <div className={styles.modal}>
                <div className={styles.modalHeader}>
                    <h3 className={styles.modalTitle}>Editar Cuenta: {account.name}</h3>
                    <button className={styles.closeButton} onClick={onClose}>&times;</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className={styles.formGrid} style={{ display: 'flex', flexDirection: 'column' }}>
                        <div className={styles.inputGroup}>
                            <label className={styles.label}>Nombre de Cuenta</label>
                            <input
                                className={styles.input}
                                value={name}
                                onChange={e => setName(e.target.value)}
                                required
                            />
                        </div>
                        <div className={styles.inputGroup}>
                            <label className={styles.label}>Tipo</label>
                            <select
                                className={styles.select}
                                value={type}
                                onChange={e => setType(e.target.value)}
                            >
                                <option value="BANK">Banco</option>
                                <option value="CASH">Efectivo</option>
                                <option value="CREDIT">Crédito</option>
                                <option value="INVESTMENT">Inversión</option>
                                <option value="LOAN">Préstamo</option>
                            </select>
                        </div>
                        <div className={styles.inputGroup}>
                            <label className={styles.label}>Balance Actual</label>
                            <input
                                className={styles.input}
                                type="number"
                                step="0.01"
                                value={balance}
                                onChange={e => setBalance(e.target.value)}
                                required
                            />
                        </div>

                        {type === 'CREDIT' && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div className={styles.inputGroup}>
                                    <label className={styles.label}>Día de Corte</label>
                                    <select
                                        className={styles.select}
                                        value={billingDay}
                                        onChange={(e) => setBillingDay(e.target.value)}
                                        title="Día de Corte"
                                    >
                                        {dayOptions.map(day => (
                                            <option key={day} value={day}>{day}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className={styles.inputGroup}>
                                    <label className={styles.label}>Día de Pago</label>
                                    <select
                                        className={styles.select}
                                        value={paymentDay}
                                        onChange={(e) => setPaymentDay(e.target.value)}
                                        title="Día de Pago"
                                    >
                                        {dayOptions.map(day => (
                                            <option key={day} value={day}>{day}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        )}
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
