'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface CategorySuggestion {
    categoryId:   string;
    categoryName: string;
    categoryIcon: string;
    score:        number;
    source?:      string; // 'history' | 'ai'
}

interface UseCategoryAutocompleteOptions {
    onSelect?: (categoryId: string) => void;
    debounceMs?: number;
}

export function useCategoryAutocomplete(
    description: string,
    currentCategoryId: string,
    options: UseCategoryAutocompleteOptions = {}
) {
    const { onSelect, debounceMs = 450 } = options;
    const [suggestions, setSuggestions] = useState<CategorySuggestion[]>([]);
    const [loading, setLoading]         = useState(false);
    const [dismissed, setDismissed]     = useState(false);
    const lastFetched = useRef<string>('');
    const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);

    const fetchSuggestions = useCallback(async (query: string) => {
        if (query.length < 3 || lastFetched.current === query) return;
        lastFetched.current = query;
        setLoading(true);

        try {
            // Fase 1: historial (rápido, sin Ollama)
            const res = await fetch(`/api/transactions/suggest-category?q=${encodeURIComponent(query)}`);
            if (!res.ok) return;

            const data: CategorySuggestion[] = await res.json();
            const filtered = data.filter(s => s.categoryId !== currentCategoryId);
            setSuggestions(filtered);

            // Fase 2: fallback IA si historial tiene < 2 resultados con score >= 2
            const highConf = filtered.filter(s => s.score >= 2);
            if (highConf.length < 2) {
                const aiRes = await fetch(
                    `/api/transactions/suggest-category?q=${encodeURIComponent(query)}&ai=1`
                );
                if (aiRes.ok) {
                    const aiData: CategorySuggestion[] = await aiRes.json();
                    // Poner resultados IA primero si no están ya en el historial
                    const aiOnly = aiData.filter(a =>
                        !filtered.some(f => f.categoryId === a.categoryId) &&
                        a.categoryId !== currentCategoryId
                    );
                    const merged = [...aiOnly, ...filtered].slice(0, 5);
                    setSuggestions(merged);
                }
            }
        } catch {
            setSuggestions([]);
        } finally {
            setLoading(false);
        }
    }, [currentCategoryId]);

    useEffect(() => {
        setDismissed(false);
        if (timerRef.current) clearTimeout(timerRef.current);
        if (description.length < 3) {
            setSuggestions([]);
            return;
        }
        timerRef.current = setTimeout(() => fetchSuggestions(description), debounceMs);
        return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    }, [description, debounceMs, fetchSuggestions]);

    const acceptSuggestion = (categoryId: string) => {
        setDismissed(true);
        setSuggestions([]);
        onSelect?.(categoryId);
    };

    const dismiss = () => {
        setDismissed(true);
        setSuggestions([]);
    };

    const visibleSuggestions = dismissed ? [] : suggestions;

    return { suggestions: visibleSuggestions, loading, acceptSuggestion, dismiss };
}
