"use client";

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import styles from './analysis.module.css';

interface CreateRecurringModalProps {
    onClose: () => void;
    onSuccess: () => void;
}

export default function CreateRecurringModal({ onClose, onSuccess }: CreateRecurringModalProps) {
    const [name, setName] = useState('');
    const [amount, setAmount] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [accountId, setAccountId] = useState('');
    const [frequency, setFrequency] = useState('MONTHLY');
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    
    const [categories, setCategories] = useState<any[]>([]);
    const [accounts, setAccounts] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        Promise.all([
            fetch('/api/categories').then(r => r.json()),
            fetch('/api/accounts').then(r => r.json())
        ]).then(([cats, accs]) => {
            if (Array.isArray(cats)) setCategories(cats.filter(c => c.type === 'EXPENSE'));
            if (Array.isArray(accs)) setAccounts(accs);
        });
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch('/api/recurring-payments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    amount: Number(amount),
                    categoryId: categoryId || null,
                    accountId,
                    frequency,
                    startDate: new Date(startDate).toISOString()
                })
            });

            if (res.ok) {
                onSuccess();
                onClose();
            } else {
                alert('Error al crear el pago recurrente');
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                    <h3 className={styles.modalTitle}>Nuevo Pago Recurrente</h3>
                    <button className={styles.closeButton} onClick={onClose} aria-label="Cerrar">
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className={styles.form}>
                    <div className={styles.formGroup}>
                        <label className={styles.label} htmlFor="service-name">Nombre del Servicio</label>
                        <input
                            id="service-name"
                            type="text"
                            className={styles.input}
                            placeholder="Ej. Netflix, Renta, Gym..."
                            value={name}
                            onChange={e => setName(e.target.value)}
                            required
                        />
                    </div>

                    <div className={styles.grid} style={{ gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div className={styles.formGroup}>
                            <label className={styles.label} htmlFor="amount">Monto</label>
                            <input
                                id="amount"
                                type="number"
                                className={styles.input}
                                placeholder="0.00"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                required
                                min="1"
                                step="0.01"
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label className={styles.label} htmlFor="frequency">Frecuencia</label>
                            <select 
                                id="frequency"
                                title="Frecuencia"
                                className={styles.select}
                                value={frequency}
                                onChange={e => setFrequency(e.target.value)}
                            >
                                <option value="WEEKLY">Semanal</option>
                                <option value="MONTHLY">Mensual</option>
                                <option value="YEARLY">Anual</option>
                            </select>
                        </div>
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.label} htmlFor="account">Cuenta de Pago</label>
                        <select 
                            id="account"
                            title="Cuenta de Pago"
                            className={styles.select}
                            value={accountId}
                            onChange={e => setAccountId(e.target.value)}
                            required
                        >
                            <option value="">Seleccionar cuenta</option>
                            {accounts.map(acc => (
                                <option key={acc.id} value={acc.id}>{acc.name} ({acc.type})</option>
                            ))}
                        </select>
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.label} htmlFor="category">Categoría (Opcional)</label>
                        <select 
                            id="category"
                            title="Categoría"
                            className={styles.select}
                            value={categoryId}
                            onChange={e => setCategoryId(e.target.value)}
                        >
                            <option value="">Sin categoría</option>
                            {categories.map(cat => (
                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.label} htmlFor="next-date">Fecha del próximo pago</label>
                        <input
                            id="next-date"
                            type="date"
                            className={styles.input}
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                            required
                        />
                    </div>

                    <div className={styles.modalActions}>
                        <button type="button" className={styles.btnCancel} onClick={onClose}>
                            Cancelar
                        </button>
                        <button type="submit" className={styles.btnSave} disabled={loading}>
                            {loading ? 'Guardando...' : 'Programar Pago'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
