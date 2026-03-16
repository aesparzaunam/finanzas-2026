'use client';

import { useState } from 'react';
import styles from './accounts.module.css';
import { TrendingDown, Calendar, Share2, Info } from 'lucide-react';

interface AccountData {
    id?: string;
    name?: string;
    type?: string;
    balance?: number;
    isShared?: boolean;
    billingDay?: number;
    paymentDay?: number;
    annualRate?: number;
    minPayment?: number;
    interestStartDate?: string | null;
    [key: string]: unknown;
}

interface EditAccountModalProps {
    account: AccountData;
    onClose: () => void;
    onSave: (updatedAccount: AccountData) => Promise<void>;
}

const isDebtAccount = (type: string) => type === 'CREDIT' || type === 'LOAN';
const isInvestmentAccount = (type: string) => type === 'INVESTMENT';

export default function EditAccountModal({ account, onClose, onSave }: EditAccountModalProps) {
    // Campos base
    const [name, setName]       = useState<string>(account.name ?? '');
    const [type, setType]       = useState<string>(account.type ?? 'BANK');
    const [balance, setBalance] = useState<string>(String(account.balance ?? 0));

    // Campos CREDIT / LOAN
    const [billingDay, setBillingDay]               = useState<string>(String(account.billingDay ?? 1));
    const [paymentDay, setPaymentDay]               = useState<string>(String(account.paymentDay ?? 15));
    const [annualRate, setAnnualRate]               = useState<string>(String(account.annualRate ?? ''));
    const [minPayment, setMinPayment]               = useState<string>(String(account.minPayment ?? ''));
    const [interestStartDate, setInterestStartDate] = useState<string>(
        account.interestStartDate ? account.interestStartDate.slice(0, 10) : ''
    );

    // Campo INVESTMENT — usa annualRate como rendimiento
    const [investRate, setInvestRate] = useState<string>(String(account.annualRate ?? ''));

    // Campos compartidos
    const [isShared, setIsShared] = useState<boolean>(account.isShared === true);

    const [saving, setSaving]   = useState(false);
    const [error, setError]     = useState<string | null>(null);

    const dayOptions = Array.from({ length: 31 }, (_, i) => i + 1);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSaving(true);
        try {
            const updatedAccount: AccountData = {
                ...account,
                name: name.trim(),
                type,
                balance: Number(balance),
                isShared,
            };

            if (isDebtAccount(type)) {
                if (type === 'CREDIT') {
                    updatedAccount.billingDay = Number(billingDay);
                    updatedAccount.paymentDay = Number(paymentDay);
                }
                if (annualRate !== '') updatedAccount.annualRate = Number(annualRate);
                if (minPayment !== '') updatedAccount.minPayment  = Number(minPayment);
                updatedAccount.interestStartDate = interestStartDate || null;
            }

            if (isInvestmentAccount(type)) {
                if (investRate !== '') updatedAccount.annualRate = Number(investRate);
            }

            await onSave(updatedAccount);
            onClose();
        } catch (err) {
            console.error(err);
            setError('No se pudo guardar. Intenta de nuevo.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div
                className={`${styles.modal} ${styles.modalTall}`}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className={styles.modalHeader}>
                    <div>
                        <h3 className={styles.modalTitle}>Editar Cuenta</h3>
                        <p className={styles.modalSubtitle}>
                            {account.name}
                        </p>
                    </div>
                    <button className={styles.closeButton} onClick={onClose} aria-label="Cerrar">×</button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className={styles.formGridColumn}>

                        {/* ── Grupo 1: Info básica ── */}
                        <div className={styles.sectionDivider}>
                            <span>Información General</span>
                        </div>

                        <div className={styles.inputGroup}>
                            <label className={styles.label} htmlFor="edit-account-name">
                                Nombre de Cuenta
                            </label>
                            <input
                                id="edit-account-name"
                                className={styles.input}
                                placeholder="Ej. BBVA Débito"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                required
                            />
                        </div>

                        <div className={styles.creditDaysGrid}>
                            <div className={styles.inputGroup}>
                                <label className={styles.label} htmlFor="edit-account-type">Tipo</label>
                                <select
                                    id="edit-account-type"
                                    className={styles.select}
                                    value={type}
                                    onChange={e => setType(e.target.value)}
                                    title="Tipo de cuenta"
                                >
                                    <option value="BANK">🏦 Banco</option>
                                    <option value="CASH">💵 Efectivo</option>
                                    <option value="CREDIT">💳 Crédito</option>
                                    <option value="INVESTMENT">📈 Inversión</option>
                                    <option value="LOAN">🏷️ Préstamo</option>
                                </select>
                            </div>

                            <div className={styles.inputGroup}>
                                <label className={styles.label} htmlFor="edit-account-balance">
                                    {isDebtAccount(type) ? 'Saldo Adeudado' : 'Balance Actual'}
                                </label>
                                <input
                                    id="edit-account-balance"
                                    className={styles.input}
                                    type="number"
                                    step="0.01"
                                    placeholder="0.00"
                                    value={balance}
                                    onChange={e => setBalance(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        {/* ── Grupo 2: Días de corte/pago (solo CREDIT) ── */}
                        {type === 'CREDIT' && (
                            <>
                                <div className={styles.sectionDivider}>
                                    <span>Ciclo de Facturación</span>
                                </div>
                                <div className={styles.creditDaysGrid}>
                                    <div className={styles.inputGroup}>
                                        <label className={styles.label}>Día de Corte</label>
                                        <select
                                            className={styles.select}
                                            value={billingDay}
                                            onChange={e => setBillingDay(e.target.value)}
                                            title="Día de Corte"
                                        >
                                            {dayOptions.map(d => <option key={d} value={d}>{d}</option>)}
                                        </select>
                                    </div>
                                    <div className={styles.inputGroup}>
                                        <label className={styles.label}>Día de Pago</label>
                                        <select
                                            className={styles.select}
                                            value={paymentDay}
                                            onChange={e => setPaymentDay(e.target.value)}
                                            title="Día de Pago"
                                        >
                                            {dayOptions.map(d => <option key={d} value={d}>{d}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* ── Grupo 3: Campos de deuda (CREDIT / LOAN) ── */}
                        {isDebtAccount(type) && (
                            <>
                                <div className={styles.sectionDivider}>
                                    <TrendingDown size={13} />
                                    <span>Tasas e Intereses</span>
                                </div>

                                <div className={styles.creditDaysGrid}>
                                    <div className={styles.inputGroup}>
                                        <label className={styles.label} htmlFor="edit-annual-rate">
                                            CAT Anual (%)
                                            <span className={styles.labelHint}>Costo total</span>
                                        </label>
                                        <div className={styles.inputWithSuffix}>
                                            <input
                                                id="edit-annual-rate"
                                                className={styles.input}
                                                type="number"
                                                step="0.1"
                                                min="0"
                                                max="200"
                                                placeholder="Ej. 45.5"
                                                value={annualRate}
                                                onChange={e => setAnnualRate(e.target.value)}
                                            />
                                            <span className={styles.inputSuffix}>%</span>
                                        </div>
                                        {annualRate !== '' && (
                                            <div className={styles.ratePreview}>
                                                Interés diario estimado:{' '}
                                                <strong>
                                                    {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(
                                                        (Math.abs(Number(balance)) * (Number(annualRate) / 100)) / 360
                                                    )}
                                                </strong>
                                            </div>
                                        )}
                                    </div>

                                    <div className={styles.inputGroup}>
                                        <label className={styles.label} htmlFor="edit-min-payment">
                                            Pago Mínimo (MXN)
                                            <span className={styles.labelHint}>Mensual</span>
                                        </label>
                                        <div className={styles.inputWithSuffix}>
                                            <span className={styles.inputPrefix}>$</span>
                                            <input
                                                id="edit-min-payment"
                                                className={`${styles.input} ${styles.inputWithPrefix}`}
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                placeholder="Ej. 800"
                                                value={minPayment}
                                                onChange={e => setMinPayment(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className={styles.inputGroup}>
                                    <label className={styles.label} htmlFor="edit-interest-start">
                                        <Calendar size={12} className={styles.inlineLabelIcon} />
                                        Inicio de Acumulación de Intereses
                                        <span className={styles.labelHint}>No afecta historial previo</span>
                                    </label>
                                    <input
                                        id="edit-interest-start"
                                        className={styles.input}
                                        type="date"
                                        value={interestStartDate}
                                        onChange={e => setInterestStartDate(e.target.value)}
                                    />
                                </div>
                            </>
                        )}

                        {/* ── Grupo 4: Rendimiento (solo INVESTMENT) ── */}
                        {isInvestmentAccount(type) && (
                            <>
                                <div className={styles.sectionDivider}>
                                    <span>📈 Rendimiento</span>
                                </div>
                                <div className={styles.inputGroup}>
                                    <label className={styles.label} htmlFor="edit-invest-rate">
                                        Rendimiento Anual (%)
                                        <span className={styles.labelHint}>Para comparar vs. deudas</span>
                                    </label>
                                    <div className={styles.inputWithSuffix}>
                                        <input
                                            id="edit-invest-rate"
                                            className={styles.input}
                                            type="number"
                                            step="0.1"
                                            min="0"
                                            placeholder="Ej. 12.5"
                                            value={investRate}
                                            onChange={e => setInvestRate(e.target.value)}
                                        />
                                        <span className={styles.inputSuffix}>%</span>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* ── Grupo 5: Cuenta compartida ── */}
                        <div className={styles.sectionDivider}>
                            <Share2 size={13} />
                            <span>Colaboración</span>
                        </div>

                        <label className={styles.toggleRow} htmlFor="edit-is-shared">
                            <div className={styles.toggleInfo}>
                                <span className={styles.toggleLabel}>Cuenta Compartida</span>
                                <span className={styles.toggleDesc}>
                                    Permite que otros usuarios con acceso vean esta cuenta
                                </span>
                            </div>
                            <div className={`${styles.toggleTrack} ${isShared ? styles.toggleActive : ''}`}>
                                <input
                                    id="edit-is-shared"
                                    type="checkbox"
                                    checked={isShared}
                                    onChange={e => setIsShared(e.target.checked)}
                                    className={styles.hiddenCheckbox}
                                />
                                <div className={styles.toggleThumb} />
                            </div>
                        </label>

                        {isShared && (
                            <div className={styles.infoBox}>
                                <Info size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                                <span>
                                    Para gestionar permisos de acceso, ve a la sección{' '}
                                    <strong>Cuentas</strong> y usa el botón de colaboradores.
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Error */}
                    {error && (
                        <div className={styles.errorBox}>{error}</div>
                    )}

                    {/* Actions */}
                    <div className={styles.modalActions}>
                        <button type="button" className={styles.cancelButton} onClick={onClose}>
                            Cancelar
                        </button>
                        <button type="submit" className={styles.saveButton} disabled={saving}>
                            {saving ? 'Guardando...' : 'Guardar Cambios'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
