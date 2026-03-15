'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LayoutShell from '@/app/components/dashboard/LayoutShell';
import styles from './new.module.css';

interface Account {
    id: string;
    name: string;
    balance: number;
    type: string;
}

interface Category {
    id: string;
    name: string;
    type: string;
    icon?: string;
}

export default function NewTransactionPage() {
    const router = useRouter();
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [type, setType] = useState('EXPENSE');
    const [accountId, setAccountId] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [toAccountId, setToAccountId] = useState('');

    const [accounts, setAccounts] = useState<Account[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetch('/api/accounts').then(res => res.json()).then(setAccounts);
        fetch('/api/categories').then(res => res.json()).then(setCategories);
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const data = {
                description,
                amount,
                type,
                accountId,
                categoryId,
                date,
                ...(type === 'TRANSFER' || type === 'PAGO_TARJETA' ? { toAccountId } : {})
            };

            const res = await fetch('/api/transactions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });

            if (res.ok) {
                router.push('/');
            } else {
                alert('No se pudo guardar la transacción');
            }
        } catch (error) {
            console.error(error);
            alert('Error guardando la transacción');
        } finally {
            setSubmitting(false);
        }
    };

    const getCategoryType = () => type === 'INCOME' ? 'INCOME' : 'EXPENSE';
    const filteredCategories = categories.filter(c => c.type === getCategoryType());
    
    const getFilteredAccounts = () => type === 'PAGO_TARJETA' ? accounts.filter(a => a.type === 'CREDIT') : accounts;

    const formatCurrency = (val: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);

    const getTypeDescription = () => {
        switch (type) {
            case 'EXPENSE': return 'Un gasto normal que reduce tu presupuesto';
            case 'INCOME': return 'Ingreso que suma a tu cuenta';
            case 'TRANSFER': return 'Mover dinero entre cuentas (no afecta ingresos/gastos)';
            case 'PAGO_TARJETA': return 'Pagar tu tarjeta de crédito (no cuenta como gasto)';
            default: return '';
        }
    };

    return (
        <LayoutShell>
            <div className={styles.formContainer}>
                
                <div className={styles.formBox}>
                    <h1 className={styles.pageTitle}>Nuevo Movimiento</h1>
                    
                    <form onSubmit={handleSubmit} className={styles.formBody}>
                        {/* Type Selector matching mockup */}
                        <div className={styles.inputGroup}>
                            <label className={styles.label}>Tipo de Movimiento</label>
                            <div className={styles.typeSelector}>
                                <button type="button" 
                                    className={`${styles.typeBtn} ${type === 'EXPENSE' ? `${styles.active} ${styles.green}` : ''}`} 
                                    onClick={() => setType('EXPENSE')}>
                                    <span className={styles.typeIcon}>💸</span>
                                    Gasto
                                </button>
                                <button type="button" 
                                    className={`${styles.typeBtn} ${type === 'INCOME' ? `${styles.active} ${styles.orange}` : ''}`} 
                                    onClick={() => setType('INCOME')}>
                                    <span className={styles.typeIcon}>💰</span>
                                    Ingreso
                                </button>
                                <button type="button" 
                                    className={`${styles.typeBtn} ${type === 'TRANSFER' ? styles.active : ''}`} 
                                    onClick={() => setType('TRANSFER')}>
                                    <span className={styles.typeIcon}>🔄</span>
                                    Transfer
                                </button>
                                <button type="button" 
                                    className={`${styles.typeBtn} ${type === 'PAGO_TARJETA' ? `${styles.active} ${styles.blue}` : ''}`} 
                                    onClick={() => setType('PAGO_TARJETA')}>
                                    <span className={styles.typeIcon}>💳</span>
                                    Pago TDC
                                </button>
                            </div>
                            <span className={styles.helpText}>{getTypeDescription()}</span>
                        </div>

                        {/* Description */}
                        <div className={styles.inputGroup}>
                            <label className={styles.label}>Descripción</label>
                            <input className={styles.input} value={description} onChange={e => setDescription(e.target.value)} required placeholder="ej. pagotdc" />
                        </div>

                        {/* Amount */}
                        <div className={styles.inputGroup}>
                            <label className={styles.label}>Monto</label>
                            <input className={styles.input} type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} required placeholder="176.55" />
                        </div>

                        {/* Account */}
                        <div className={styles.inputGroup}>
                            <label className={styles.label}>{type === 'TRANSFER' ? 'Cuenta Origen' : type === 'PAGO_TARJETA' ? 'Tarjeta a Pagar' : 'Cuenta'}</label>
                            <select className={styles.select} value={accountId} onChange={e => setAccountId(e.target.value)} required title="Cuenta Origen">
                                <option value="" disabled>Selecciona cuenta</option>
                                {getFilteredAccounts().map(acc => (
                                    <option key={acc.id} value={acc.id}>{acc.name} ({formatCurrency(acc.balance)})</option>
                                ))}
                            </select>
                        </div>

                        {/* To Account */}
                        {(type === 'TRANSFER' || type === 'PAGO_TARJETA') && (
                            <div className={styles.inputGroup}>
                                <label className={styles.label}>{type === 'PAGO_TARJETA' ? 'Pagar Desde' : 'Cuenta Destino'}</label>
                                <select className={styles.select} value={toAccountId} onChange={e => setToAccountId(e.target.value)} required title="Cuenta Destino">
                                    <option value="" disabled>Selecciona cuenta</option>
                                    {accounts.filter(a => a.id !== accountId && (type === 'PAGO_TARJETA' ? a.type !== 'CREDIT' : true)).map(acc => (
                                        <option key={acc.id} value={acc.id}>{acc.name} ({formatCurrency(acc.balance)})</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Category */}
                        {type !== 'TRANSFER' && type !== 'PAGO_TARJETA' && (
                            <div className={styles.inputGroup}>
                                <label className={styles.label}>Categoría</label>
                                <select className={styles.select} value={categoryId} onChange={e => setCategoryId(e.target.value)} required title="Categoría">
                                    <option value="" disabled>Selecciona categoría</option>
                                    {filteredCategories.map(cat => (
                                        <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Date */}
                        <div className={styles.inputGroup}>
                            <label className={styles.label}>Fecha</label>
                            <input className={styles.input} type="date" value={date} onChange={e => setDate(e.target.value)} required title="Fecha de movimiento" />
                        </div>

                        {/* Action Buttons */}
                        <div className={styles.buttonGroup}>
                            <button type="submit" className={styles.btnPrimary} disabled={submitting}>
                                {submitting ? 'Guardando...' : 'Guardar Movimiento'}
                            </button>
                            <button type="button" className={styles.btnSecondary} onClick={() => router.back()}>Cancelar</button>
                        </div>

                    </form>
                </div>
            </div>
        </LayoutShell>
    );
}
