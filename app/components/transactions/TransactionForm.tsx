'use client';

import { useState, useEffect } from 'react';
import styles from './transactions.module.css';
import formStyles from '../accounts/accounts.module.css';
import { useCategoryAutocomplete } from './useCategoryAutocomplete';

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

interface TransactionFormProps {
    initialValues?: {
        description?: string;
        amount?: string;
        type?: string;
        accountId?: string;
        categoryId?: string;
        date?: string;
        toAccountId?: string;
    };
    onCheckSubmit: (data: {
        description: string;
        amount: string;
        type: string;
        accountId: string;
        categoryId: string;
        date: string;
        toAccountId?: string;
    }) => Promise<void>;
    onCancel: () => void;
    submitLabel?: string;
}

export default function TransactionForm({ initialValues, onCheckSubmit, onCancel, submitLabel }: TransactionFormProps) {
    const [description, setDescription] = useState(initialValues?.description || '');
    const [amount, setAmount] = useState(initialValues?.amount || '');
    const [type, setType] = useState(initialValues?.type || 'EXPENSE');
    const [accountId, setAccountId] = useState(initialValues?.accountId || '');
    const [categoryId, setCategoryId] = useState(initialValues?.categoryId || '');
    const [date, setDate] = useState(initialValues?.date || new Date().toISOString().split('T')[0]);
    const [toAccountId, setToAccountId] = useState(initialValues?.toAccountId || '');

    const [accounts, setAccounts]     = useState<Account[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [submitting, setSubmitting]  = useState(false);
    const [aiTitleLoading, setAiTitleLoading] = useState(false);
    const [aiTitleHint, setAiTitleHint]       = useState('');

    // Auto-título: solo cuando descripción vacía y hay monto + tipo
    const canSuggestTitle = !description.trim() && !!amount && (type === 'EXPENSE' || type === 'INCOME');

    const handleAiTitle = async () => {
        if (!canSuggestTitle || aiTitleLoading) return;
        setAiTitleLoading(true);
        setAiTitleHint('');
        try {
            const res = await fetch('/api/transactions/ai-autotitle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount: Number(amount), type, categoryId, accountId, date }),
            });
            if (res.ok) {
                const data = await res.json();
                if (data.title) {
                    setAiTitleHint(data.title);
                }
            }
        } catch { /* silencioso */ }
        finally { setAiTitleLoading(false); }
    };

    // ── #12 Autocompletado de Categorías ────────────────────────
    const { suggestions: catSuggestions, acceptSuggestion, dismiss: dismissSuggestion } = useCategoryAutocomplete(
        description,
        categoryId,
        {
            onSelect: (id) => setCategoryId(id),
        }
    );
    // Solo mostrar sugerencias cuando el tipo usa categoría
    const showCatSuggestion = catSuggestions.length > 0 && type !== 'TRANSFER' && type !== 'PAGO_TARJETA';

    useEffect(() => {
        fetch('/api/accounts').then(res => res.json()).then(setAccounts);
        fetch('/api/categories').then(res => res.json()).then(setCategories);
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await onCheckSubmit({
                description,
                amount,
                type,
                accountId,
                categoryId,
                date,
                ...(type === 'TRANSFER' || type === 'PAGO_TARJETA' ? { toAccountId } : {})
            });
        } finally {
            setSubmitting(false);
        }
    };

    // Filter categories based on type - for PAGO_TARJETA, show expense categories
    const getCategoryType = () => {
        if (type === 'INCOME') return 'INCOME';
        return 'EXPENSE'; // EXPENSE, PAGO_TARJETA, TRANSFER all use expense categories
    };

    const filteredCategories = categories.filter(c => c.type === getCategoryType());

    // For PAGO_TARJETA, only show credit card accounts
    const getFilteredAccounts = () => {
        if (type === 'PAGO_TARJETA') {
            return accounts.filter(a => a.type === 'CREDIT');
        }
        return accounts;
    };

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);

    const getTypeDescription = () => {
        switch (type) {
            case 'EXPENSE': return 'Un gasto normal que reduce tu presupuesto';
            case 'INCOME': return 'Ingreso que suma a tu cuenta';
            case 'TRANSFER': return 'Mover dinero entre cuentas (no afecta gastos)';
            case 'PAGO_TARJETA': return 'Pagar tu tarjeta de crédito (no cuenta como gasto)';
            default: return '';
        }
    };

    return (
        <div className={styles.formWrapper}>
            <form onSubmit={handleSubmit} className={styles.formGrid}>
                {/* Transaction Type Selector */}
                <div className={formStyles.inputGroup}>
                    <label className={formStyles.label}>Tipo de Movimiento</label>
                    <div className={styles.typeSelector}>
                        <button
                            type="button"
                            className={`${styles.typeOption} ${type === 'EXPENSE' ? `${styles.typeOptionActive} ${styles.typeExpense}` : ''}`}
                            onClick={() => setType('EXPENSE')}
                        >
                            💸 Gasto
                        </button>
                        <button
                            type="button"
                            className={`${styles.typeOption} ${type === 'INCOME' ? `${styles.typeOptionActive} ${styles.typeIncome}` : ''}`}
                            onClick={() => setType('INCOME')}
                        >
                            💰 Ingreso
                        </button>
                        <button
                            type="button"
                            className={`${styles.typeOption} ${type === 'TRANSFER' ? styles.typeOptionActive : ''}`}
                            onClick={() => setType('TRANSFER')}
                        >
                            🔄 Transfer
                        </button>
                        <button
                            type="button"
                            className={`${styles.typeOption} ${type === 'PAGO_TARJETA' ? styles.typeOptionActive : ''}`}
                            onClick={() => setType('PAGO_TARJETA')}
                        >
                            💳 Pago TDC
                        </button>
                    </div>
                    <p className={styles.typeHelpText}>
                        {getTypeDescription()}
                    </p>
                </div>

                {/* Description */}
                <div className={formStyles.inputGroup}>
                    <label className={formStyles.label} htmlFor="tx-description">Descripción</label>
                    <div className={styles.descInputRow}>
                        <input
                            id="tx-description"
                            className={formStyles.input}
                            value={description}
                            onChange={e => { setDescription(e.target.value); setAiTitleHint(''); }}
                            placeholder="ej. Supermercado, Nómina, etc."
                            required
                            autoComplete="off"
                        />
                        {/* Botón auto-título IA */}
                        {canSuggestTitle && (
                            <button
                                type="button"
                                className={styles.aiTitleBtn}
                                onClick={handleAiTitle}
                                disabled={aiTitleLoading}
                                title="Sugerir nombre con IA"
                                aria-label="Sugerir descripción con IA"
                                id="tx-ai-title-btn"
                            >
                                {aiTitleLoading ? '⟳' : '✨'}
                            </button>
                        )}
                    </div>
                    {/* Sugerencia de título IA */}
                    {aiTitleHint && (
                        <div className={styles.aiTitleBanner}>
                            <span className={styles.aiTitleIcon}>✨</span>
                            <span className={styles.aiTitleText}>
                                ¿Usar <strong>&ldquo;{aiTitleHint}&rdquo;</strong>?
                            </span>
                            <button
                                type="button"
                                className={styles.aiTitleAccept}
                                onClick={() => { setDescription(aiTitleHint); setAiTitleHint(''); }}
                            >
                                Sí
                            </button>
                            <button
                                type="button"
                                className={styles.catSuggestionDismiss}
                                onClick={() => setAiTitleHint('')}
                                aria-label="Ignorar sugerencia de título"
                            >
                                ✕
                            </button>
                        </div>
                    )}
                    {/* ── Sugerencia de categoría ── */}
                    {showCatSuggestion && (
                        <div className={styles.catSuggestionBanner}>
                            <span className={styles.catSuggestionIcon}>🤖</span>
                            <span className={styles.catSuggestionText}>
                                ¿Categoría <strong>{catSuggestions[0].categoryIcon} {catSuggestions[0].categoryName}</strong>?
                            </span>
                            <button
                                type="button"
                                className={styles.catSuggestionAccept}
                                onClick={() => acceptSuggestion(catSuggestions[0].categoryId)}
                            >
                                Usar
                            </button>
                            <button
                                type="button"
                                className={styles.catSuggestionDismiss}
                                onClick={dismissSuggestion}
                                aria-label="Ignorar sugerencia"
                            >
                                ✕
                            </button>
                        </div>
                    )}
                </div>

                {/* Amount */}
                <div className={formStyles.inputGroup}>
                    <label className={formStyles.label} htmlFor="tx-amount">Monto</label>
                    <input
                        id="tx-amount"
                        className={formStyles.input}
                        type="number"
                        step="0.01"
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        placeholder="0.00"
                        required
                    />
                </div>

                {/* Account (From Account for transfers) */}
                <div className={formStyles.inputGroup}>
                    <label className={formStyles.label} htmlFor="tx-account">
                        {type === 'TRANSFER' ? 'Cuenta Origen' : type === 'PAGO_TARJETA' ? 'Tarjeta a Pagar' : 'Cuenta'}
                    </label>
                    <select
                        id="tx-account"
                        title="Selecciona la cuenta"
                        className={formStyles.select}
                        value={accountId}
                        onChange={e => setAccountId(e.target.value)}
                        required
                    >
                        <option value="">Selecciona cuenta</option>
                        {getFilteredAccounts().map(acc => (
                            <option key={acc.id} value={acc.id}>
                                {acc.name} ({formatCurrency(Number(acc.balance))})
                            </option>
                        ))}
                    </select>
                </div>

                {/* To Account (for Transfers and PAGO_TARJETA) */}
                {(type === 'TRANSFER' || type === 'PAGO_TARJETA') && (
                    <div className={formStyles.inputGroup}>
                        <label className={formStyles.label} htmlFor="tx-to-account">
                            {type === 'PAGO_TARJETA' ? 'Pagar Desde' : 'Cuenta Destino'}
                        </label>
                        <select
                            id="tx-to-account"
                            title="Selecciona la cuenta destino"
                            className={formStyles.select}
                            value={toAccountId}
                            onChange={e => setToAccountId(e.target.value)}
                            required
                        >
                            <option value="">Selecciona cuenta</option>
                            {accounts
                                .filter(a => a.id !== accountId && (type === 'PAGO_TARJETA' ? a.type !== 'CREDIT' : true))
                                .map(acc => (
                                    <option key={acc.id} value={acc.id}>
                                        {acc.name} ({formatCurrency(Number(acc.balance))})
                                    </option>
                                ))}
                        </select>
                    </div>
                )}

                {/* Category (not needed for transfers/pago_tarjeta) */}
                {type !== 'TRANSFER' && type !== 'PAGO_TARJETA' && (
                    <div className={formStyles.inputGroup}>
                        <label className={formStyles.label} htmlFor="tx-category">Categoría</label>
                        <select
                            id="tx-category"
                            title="Selecciona la categoría"
                            className={formStyles.select}
                            value={categoryId}
                            onChange={e => setCategoryId(e.target.value)}
                            required
                        >
                            <option value="">Selecciona categoría</option>
                            {filteredCategories.map(cat => (
                                <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Date */}
                <div className={formStyles.inputGroup}>
                    <label className={formStyles.label} htmlFor="tx-date">Fecha</label>
                    <input
                        id="tx-date"
                        className={formStyles.input}
                        type="date"
                        value={date}
                        onChange={e => setDate(e.target.value)}
                        required
                    />
                </div>

                {/* Buttons */}
                <div className={styles.buttonGroup}>
                    <button type="submit" className={styles.buttonPrimary} disabled={submitting}>
                        {submitting ? 'Guardando...' : (submitLabel || 'Guardar Movimiento')}
                    </button>
                    <button type="button" className={styles.buttonSecondary} onClick={onCancel}>
                        Cancelar
                    </button>
                </div>
            </form>
        </div>
    );
}
