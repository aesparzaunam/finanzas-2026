'use client';

import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Sparkles, Clock, WifiOff, BookOpen } from 'lucide-react';
import styles from './narrative.module.css';

interface NarrativeData {
    narrative: string;
    cached?:   boolean;
}

interface Props {
    month?: string;
}

// ── Limpia los bloques <think>…</think> del modelo reasoning ──
// Maneja tanto tags cerrados como tags abiertos sin cerrar (modelo truncado)
function stripThinkTags(text: string): string {
    return text
        .replace(/<think>[\s\S]*?<\/think>/gi, '')  // tag cerrado normal
        .replace(/<think>[\s\S]*/gi, '')              // tag abierto sin cerrar
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

// ── Parser de markdown mínimo → bloques estructurados ──
type Block =
    | { type: 'h1'; text: string }
    | { type: 'h2'; text: string }
    | { type: 'h3'; text: string }
    | { type: 'p';  text: string }
    | { type: 'li'; text: string }
    | { type: 'hr' }
    | { type: 'empty' };

function parseMarkdown(md: string): Block[] {
    const lines = md.split('\n');
    const blocks: Block[] = [];

    for (const raw of lines) {
        const line = raw.trimEnd();
        if (!line.trim()) { blocks.push({ type: 'empty' }); continue; }
        if (/^---+$/.test(line))              { blocks.push({ type: 'hr' }); continue; }
        if (line.startsWith('### '))          { blocks.push({ type: 'h3', text: line.slice(4).trim() }); continue; }
        if (line.startsWith('## '))           { blocks.push({ type: 'h2', text: line.slice(3).trim() }); continue; }
        if (line.startsWith('# '))            { blocks.push({ type: 'h1', text: line.slice(2).trim() }); continue; }
        if (/^[-*•]\s/.test(line))            { blocks.push({ type: 'li', text: line.replace(/^[-*•]\s/, '').trim() }); continue; }
        blocks.push({ type: 'p', text: line.trim() });
    }
    return blocks;
}

// ── Inline formatting: **bold**, *italic*, `code` ──
function renderInline(text: string) {
    // Split by bold, italic, code markers
    const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
    return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**'))
            return <strong key={i}>{part.slice(2, -2)}</strong>;
        if (part.startsWith('*') && part.endsWith('*'))
            return <em key={i}>{part.slice(1, -1)}</em>;
        if (part.startsWith('`') && part.endsWith('`'))
            return <code key={i} className={styles.inlineCode}>{part.slice(1, -1)}</code>;
        return part;
    });
}


function MarkdownBlock({ block }: { block: Block }) {
    switch (block.type) {
        case 'h1': return <h2 className={styles.mdH1}>{renderInline(block.text)}</h2>;
        case 'h2': return <h3 className={styles.mdH2}>{renderInline(block.text)}</h3>;
        case 'h3': return <h4 className={styles.mdH3}>{renderInline(block.text)}</h4>;
        case 'hr': return <div className={styles.mdHr} />;
        case 'li': return (
            <div className={styles.mdLi}>
                <span className={styles.mdBullet}>▸</span>
                <span>{renderInline(block.text)}</span>
            </div>
        );
        case 'p': return <p className={styles.mdP}>{renderInline(block.text)}</p>;
        case 'empty': return <div className={styles.mdSpacer} />;
        default: return null;
    }
}

// ── Main component ──
export default function AiNarrativeCard({ month }: Props) {
    const [data, setData]             = useState<NarrativeData | null>(null);
    const [loading, setLoading]       = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError]           = useState(false);

    const currentMonth = month || new Date().toISOString().slice(0, 7);
    const monthLabel = new Date(currentMonth + '-15').toLocaleString('es-MX', { month: 'long', year: 'numeric' });

    const fetchNarrative = useCallback(async (force = false) => {
        setError(false);
        const url = `/api/dashboard/ai-summary?month=${currentMonth}${force ? '&refresh=1' : ''}`;
        try {
            const r = await fetch(url);
            if (r.ok) setData(await r.json());
            else setError(true);
        } catch { setError(true); }
    }, [currentMonth]);

    useEffect(() => {
        setLoading(true);
        fetchNarrative().finally(() => setLoading(false));
    }, [fetchNarrative]);

    const handleRefresh = async () => {
        setRefreshing(true);
        await fetchNarrative(true);
        setRefreshing(false);
    };

    // ── Loading skeleton ──
    if (loading) return (
        <div className={styles.card}>
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    <div className={styles.iconWrap}><BookOpen size={16} /></div>
                    <div>
                        <div className={styles.title}>Resumen Narrativo</div>
                        <div className={styles.subtitle}>Generando análisis...</div>
                    </div>
                </div>
            </div>
            <div className={styles.skeleton}>
                {[90, 70, 100, 55, 80, 60].map((w, i) => (
                    <div key={i} className={`${styles.skeletonLine} ${styles[`sk${w}`] || ''}`}
                        data-width={w} />
                ))}
            </div>
        </div>
    );

    // ── Error state ──
    if (error || !data) return (
        <div className={styles.card}>
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    <div className={styles.iconWrap}><BookOpen size={16} /></div>
                    <div className={styles.title}>Resumen Narrativo</div>
                </div>
            </div>
            <div className={styles.errorState}>
                <WifiOff size={24} className={styles.errorIcon} />
                <p className={styles.errorText}>No se pudo generar el resumen.</p>
                <p className={styles.errorHint}>Verifica que Ollama esté activo y vuelve a intentarlo.</p>
                <button className={styles.retryBtn} onClick={() => fetchNarrative()}>
                    <RefreshCw size={14} /> Reintentar
                </button>
            </div>
        </div>
    );

    // ── Clean and parse ──
    const cleaned = stripThinkTags(data.narrative);
    const blocks  = parseMarkdown(cleaned);

    return (
        <div className={styles.card}>
            {/* Header */}
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    <div className={styles.iconWrap}>
                        <BookOpen size={16} />
                    </div>
                    <div>
                        <div className={styles.title}>Resumen Narrativo</div>
                        <div className={styles.subtitle}>
                            <Sparkles size={11} className={styles.subtitleIcon} />
                            {monthLabel} · Fin IA
                        </div>
                    </div>
                </div>
                <button
                    className={`${styles.refreshBtn} ${refreshing ? styles.refreshSpinning : ''}`}
                    onClick={handleRefresh}
                    disabled={refreshing}
                    aria-label="Regenerar resumen con IA"
                    title="Regenerar resumen"
                >
                    <RefreshCw size={13} />
                    <span>{refreshing ? 'Generando...' : 'Regenerar'}</span>
                </button>
            </div>

            {/* Badge cached */}
            {data.cached && (
                <div className={styles.cachedBadge}>
                    <Clock size={11} />
                    Análisis guardado · se actualiza mañana
                </div>
            )}

            {/* Markdown content */}
            <div className={styles.body}>
                {blocks.map((block, i) => (
                    <MarkdownBlock key={i} block={block} />
                ))}
            </div>
        </div>
    );
}
