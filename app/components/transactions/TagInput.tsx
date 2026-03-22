'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import styles from './TagInput.module.css';

interface TagInputProps {
    transactionId: string;
    initialTags?: string[];
    allTags?: string[]; // sugerencias globales del usuario
    onTagsChange?: (tags: string[]) => void;
    compact?: boolean; // modo solo lectura/compacto para tablas
}

export default function TagInput({ transactionId, initialTags = [], allTags = [], onTagsChange, compact = false }: TagInputProps) {
    const [tags, setTags] = useState<string[]>(initialTags);
    const [input, setInput] = useState('');
    const [saving, setSaving] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const filtered = allTags.filter(t => t.startsWith(input.toLowerCase()) && !tags.includes(t));

    useEffect(() => {
        setTags(initialTags);
    }, [initialTags.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

    const saveTags = async (newTags: string[]) => {
        setSaving(true);
        try {
            await fetch(`/api/transactions/tags?id=${transactionId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tags: newTags }),
            });
            onTagsChange?.(newTags);
        } finally {
            setSaving(false);
        }
    };

    const addTag = async (tag: string) => {
        const clean = tag.trim().toLowerCase().replace(/\s+/g, '-').slice(0, 20);
        if (!clean || tags.includes(clean) || tags.length >= 10) return;
        const next = [...tags, clean];
        setTags(next);
        setInput('');
        setShowSuggestions(false);
        await saveTags(next);
    };

    const removeTag = async (tag: string) => {
        const next = tags.filter(t => t !== tag);
        setTags(next);
        await saveTags(next);
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
            e.preventDefault();
            if (input.trim()) addTag(input);
        }
        if (e.key === 'Backspace' && !input && tags.length > 0) {
            removeTag(tags[tags.length - 1]);
        }
        if (e.key === 'Escape') {
            setShowSuggestions(false);
            setInput('');
        }
    };

    if (compact) {
        // Vista de solo lectura para tabla
        return (
            <div className={styles.compactTags}>
                {tags.map(tag => (
                    <span key={tag} className={styles.tagChipCompact}>#{tag}</span>
                ))}
            </div>
        );
    }

    return (
        <div className={styles.tagInputWrapper}>
            <div className={styles.tagField} onClick={() => inputRef.current?.focus()}>
                {tags.map(tag => (
                    <span key={tag} className={styles.tagChip}>
                        <span className={styles.tagHash}>#</span>
                        {tag}
                        <button
                            className={styles.tagRemove}
                            onClick={(e) => { e.stopPropagation(); removeTag(tag); }}
                            title={`Quitar #${tag}`}
                            aria-label={`Quitar etiqueta ${tag}`}
                        >
                            ×
                        </button>
                    </span>
                ))}
                <input
                    ref={inputRef}
                    className={styles.tagRawInput}
                    value={input}
                    onChange={(e) => {
                        setInput(e.target.value);
                        setShowSuggestions(e.target.value.length > 0);
                    }}
                    onKeyDown={handleKeyDown}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                    onFocus={() => input.length > 0 && setShowSuggestions(true)}
                    placeholder={tags.length === 0 ? 'ej: trabajo, viaje, deducible…' : ''}
                    disabled={saving}
                    maxLength={20}
                    aria-label="Agregar etiqueta"
                />
                {saving && <span className={styles.savingDot} title="Guardando…">⏳</span>}
            </div>

            {showSuggestions && filtered.length > 0 && (
                <ul className={styles.suggestionList}>
                    {filtered.slice(0, 6).map(suggestion => (
                        <li key={suggestion}>
                            <button
                                className={styles.suggestionItem}
                                onMouseDown={() => addTag(suggestion)}
                            >
                                <span className={styles.tagHash}>#</span>
                                {suggestion}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            <p className={styles.tagHint}>Presiona Enter, coma o espacio para agregar. Máx. 10 etiquetas.</p>
        </div>
    );
}
