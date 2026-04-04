'use client';

import { useState } from 'react';
import styles from './budgets.module.css';

interface AiSuggestion {
    categoryId:     string;
    categoryName:   string;
    categoryIcon:   string;
    monthlyAvg:     number;
    monthCount:     number;
    suggestedAmount:number;
    currentAmount:  number | null;
    isFixed:        boolean;
    reasoning:      string;
}

interface Props {
    onApply: (categoryId: string, amount: number) => Promise<void>;
}

export default function AiBudgetSuggestPanel({ onApply }: Props) {
    const [open, setOpen]               = useState(false);
    const [loading, setLoading]         = useState(false);
    const [suggestions, setSuggestions] = useState<AiSuggestion[]>([]);
    const [message, setMessage]         = useState('');
    const [applying, setApplying]       = useState<string | null>(null);
    const [applied, setApplied]         = useState<Set<string>>(new Set());

    const handleGenerate = async () => {
        setLoading(true);
        setSuggestions([]);
        setMessage('');
        try {
            const res = await fetch('/api/budgets/ai-suggest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            });
            const data = await res.json();
            setSuggestions(data.suggestions ?? []);
            setMessage(data.message ?? '');
            setOpen(true);
        } catch {
            setMessage('Error al conectar con Ollama. Verifica que esté activo.');
        } finally {
            setLoading(false);
        }
    };

    const handleApply = async (s: AiSuggestion) => {
        setApplying(s.categoryId);
        try {
            await onApply(s.categoryId, s.suggestedAmount);
            setApplied(prev => new Set([...prev, s.categoryId]));
        } finally {
            setApplying(null);
        }
    };

    const handleApplyAll = async () => {
        const pending = suggestions.filter(s => !applied.has(s.categoryId));
        for (const s of pending) {
            await handleApply(s);
        }
    };

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);

    const pendingCount = suggestions.filter(s => !applied.has(s.categoryId)).length;

    return (
        <div className={styles.aiSuggestContainer}>
            {/* Botón disparador */}
            <button
                className={styles.aiSuggestTrigger}
                onClick={handleGenerate}
                disabled={loading}
                id="ai-budget-suggest-btn"
                aria-label="Generar sugerencias de presupuesto con IA"
            >
                {loading ? (
                    <>
                        <span className={styles.aiSuggestSpinner}>⟳</span>
                        Fin IA analizando historial…
                    </>
                ) : (
                    <>
                        💡 Sugerir presupuestos con IA
                    </>
                )}
            </button>

            {/* Mensaje sin datos */}
            {message && suggestions.length === 0 && (
                <p className={styles.aiSuggestMessage}>{message}</p>
            )}

            {/* Panel de sugerencias */}
            {suggestions.length > 0 && open && (
                <div className={styles.aiSuggestPanel}>
                    <div className={styles.aiSuggestPanelHeader}>
                        <div className={styles.aiSuggestPanelTitle}>
                            <span>💡</span>
                            <span>Fin IA sugiere {suggestions.length} presupuesto{suggestions.length > 1 ? 's' : ''}</span>
                            <span className={styles.aiSuggestMeta}>· Basado en historial de 3 meses</span>
                        </div>
                        <div className={styles.aiSuggestPanelActions}>
                            {pendingCount > 1 && (
                                <button
                                    className={styles.aiApplyAllBtn}
                                    onClick={handleApplyAll}
                                    disabled={applying !== null}
                                >
                                    Aplicar todos ({pendingCount})
                                </button>
                            )}
                            <button
                                className={styles.aiSuggestClose}
                                onClick={() => setOpen(false)}
                                aria-label="Cerrar sugerencias"
                            >
                                ✕
                            </button>
                        </div>
                    </div>

                    <div className={styles.aiSuggestList}>
                        {suggestions.map(s => {
                            const isApplied = applied.has(s.categoryId);
                            const isApplying = applying === s.categoryId;
                            const diff = s.currentAmount
                                ? ((s.suggestedAmount - s.currentAmount) / s.currentAmount) * 100
                                : null;

                            return (
                                <div
                                    key={s.categoryId}
                                    className={`${styles.aiSuggestItem} ${isApplied ? styles.aiSuggestItemApplied : ''}`}
                                >
                                    <div className={styles.aiSuggestItemLeft}>
                                        <span className={styles.aiSuggestItemIcon}>{s.categoryIcon}</span>
                                        <div className={styles.aiSuggestItemInfo}>
                                            <div className={styles.aiSuggestItemName}>
                                                {s.categoryName}
                                                <span className={styles.aiSuggestFixed}>
                                                    {s.isFixed ? ' · fija' : ' · variable'}
                                                </span>
                                            </div>
                                            <div className={styles.aiSuggestReasoning}>{s.reasoning}</div>
                                        </div>
                                    </div>

                                    <div className={styles.aiSuggestItemRight}>
                                        <div className={styles.aiSuggestAmounts}>
                                            <span className={styles.aiSuggestSuggested}>
                                                {formatCurrency(s.suggestedAmount)}
                                            </span>
                                            {s.currentAmount !== null && (
                                                <span className={
                                                    diff === null ? '' :
                                                    diff > 0 ? styles.aiSuggestDiffUp : styles.aiSuggestDiffDown
                                                }>
                                                    {diff === null ? '' :
                                                     diff > 0 ? `+${diff.toFixed(0)}%` : `${diff.toFixed(0)}%`}
                                                </span>
                                            )}
                                        </div>
                                        {!isApplied ? (
                                            <button
                                                className={styles.aiApplyBtn}
                                                onClick={() => handleApply(s)}
                                                disabled={isApplying}
                                                aria-label={`Aplicar sugerencia para ${s.categoryName}`}
                                            >
                                                {isApplying ? '…' : 'Aplicar'}
                                            </button>
                                        ) : (
                                            <span className={styles.aiAppliedBadge}>✓ Aplicado</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
