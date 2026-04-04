'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import styles from './chat.module.css';

interface Message {
    role:      'user' | 'assistant';
    content:   string;
    timestamp: number;
}

const WELCOME = '¡Hola! Soy **Fin**, tu asistente financiero personal. Tengo acceso a tus datos actuales. ¿En qué te puedo ayudar hoy?';

const QUICK_PROMPTS = [
    '¿Cómo va mi presupuesto este mes?',
    '¿Cuánto gasté en comida?',
    '¿Cuál es mi deuda total?',
    '¿Cómo mejorar mi ahorro?',
];

export default function AiChatWidget() {
    const [open, setOpen]             = useState(false);
    const [messages, setMessages]     = useState<Message[]>([]);
    const [input, setInput]           = useState('');
    const [loading, setLoading]       = useState(false);
    const [sessionId]                 = useState(() => `s_${Date.now()}`);
    const [hasUnread, setHasUnread]   = useState(false);
    const bottomRef  = useRef<HTMLDivElement>(null);
    const inputRef   = useRef<HTMLInputElement>(null);

    // Scroll al último mensaje
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Focus el input cuando se abre
    useEffect(() => {
        if (open) {
            setHasUnread(false);
            setTimeout(() => inputRef.current?.focus(), 150);
        }
    }, [open]);

    const sendMessage = useCallback(async (text: string) => {
        const msg = text.trim();
        if (!msg || loading) return;

        const userMessage: Message = { role: 'user', content: msg, timestamp: Date.now() };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setLoading(true);

        try {
            // Historial de los últimos 10 mensajes (sin el actual)
            const historyForApi = messages.slice(-10).map(m => ({
                role:    m.role,
                content: m.content,
            }));

            const res = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message:   msg,
                    history:   historyForApi,
                    sessionId,
                }),
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || 'Error del servidor');
            }

            const data = await res.json();
            const assistantMessage: Message = {
                role:      'assistant',
                content:   data.reply,
                timestamp: Date.now(),
            };
            setMessages(prev => [...prev, assistantMessage]);

            // Badge de no leído si el chat está cerrado
            if (!open) setHasUnread(true);
        } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : 'Error desconocido';
            setMessages(prev => [...prev, {
                role:      'assistant',
                content:   `⚠️ Error: ${errMsg}`,
                timestamp: Date.now(),
            }]);
        } finally {
            setLoading(false);
        }
    }, [loading, messages, open, sessionId]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage(input);
        }
    };

    const clearChat = () => {
        setMessages([]);
    };

    // Renderiza markdown básico: **bold**, *italic*, listas `-`
    const renderContent = (text: string) => {
        return text
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g,     '<em>$1</em>')
            .replace(/^- (.+)$/gm,     '<li>$1</li>')
            .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
            .replace(/\n/g, '<br/>');
    };

    const formatTime = (ts: number) => {
        return new Date(ts).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <>
            {/* ── FAB trigger ─────────────────────────────────────────────── */}
            <button
                className={`${styles.fab} ${open ? styles.fabOpen : ''}`}
                onClick={() => setOpen(o => !o)}
                aria-label={open ? 'Cerrar asistente financiero' : 'Abrir asistente financiero Fin'}
                id="fin-chat-fab"
            >
                {open ? (
                    <span className={styles.fabIconClose}>✕</span>
                ) : (
                    <>
                        <span className={styles.fabIcon}>💬</span>
                        {hasUnread && <span className={styles.fabBadge} aria-label="Mensaje sin leer" />}
                    </>
                )}
            </button>

            {/* ── Panel de chat ────────────────────────────────────────────── */}
            {open && (
                <div
                    className={styles.panel}
                    role="dialog"
                    aria-label="Asistente financiero Fin"
                    aria-modal="false"
                >
                    {/* Header */}
                    <div className={styles.header}>
                        <div className={styles.headerLeft}>
                            <div className={styles.avatar}>🤖</div>
                            <div className={styles.headerInfo}>
                                <span className={styles.headerName}>Fin</span>
                                <span className={styles.headerSub}>Asistente financiero personal</span>
                            </div>
                        </div>
                        <div className={styles.headerActions}>
                            {messages.length > 0 && (
                                <button
                                    className={styles.clearBtn}
                                    onClick={clearChat}
                                    title="Nueva conversación"
                                    aria-label="Nueva conversación"
                                >
                                    🗑️
                                </button>
                            )}
                            <button
                                className={styles.closeBtn}
                                onClick={() => setOpen(false)}
                                aria-label="Cerrar chat"
                            >
                                ✕
                            </button>
                        </div>
                    </div>

                    {/* Mensajes */}
                    <div className={styles.messages} role="log" aria-live="polite">
                        {/* Mensaje de bienvenida */}
                        <div className={`${styles.bubble} ${styles.bubbleAssistant}`}>
                            <div
                                className={styles.bubbleContent}
                                dangerouslySetInnerHTML={{ __html: renderContent(WELCOME) }}
                            />
                        </div>

                        {/* Quick prompts (solo si no hay mensajes) */}
                        {messages.length === 0 && (
                            <div className={styles.quickPrompts}>
                                {QUICK_PROMPTS.map(q => (
                                    <button
                                        key={q}
                                        className={styles.quickPrompt}
                                        onClick={() => sendMessage(q)}
                                        disabled={loading}
                                    >
                                        {q}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Historial */}
                        {messages.map((m, i) => (
                            <div
                                key={i}
                                className={`${styles.bubble} ${m.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant}`}
                            >
                                <div
                                    className={styles.bubbleContent}
                                    dangerouslySetInnerHTML={{ __html: renderContent(m.content) }}
                                />
                                <span className={styles.bubbleTime}>{formatTime(m.timestamp)}</span>
                            </div>
                        ))}

                        {/* Typing indicator */}
                        {loading && (
                            <div className={`${styles.bubble} ${styles.bubbleAssistant}`}>
                                <div className={styles.typingDots}>
                                    <span />
                                    <span />
                                    <span />
                                </div>
                            </div>
                        )}

                        <div ref={bottomRef} />
                    </div>

                    {/* Input */}
                    <div className={styles.inputArea}>
                        <input
                            ref={inputRef}
                            className={styles.chatInput}
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Pregunta sobre tu situación financiera…"
                            disabled={loading}
                            aria-label="Mensaje para Fin"
                            id="fin-chat-input"
                            maxLength={500}
                        />
                        <button
                            className={styles.sendBtn}
                            onClick={() => sendMessage(input)}
                            disabled={loading || !input.trim()}
                            aria-label="Enviar mensaje"
                            id="fin-chat-send"
                        >
                            {loading ? (
                                <span className={styles.sendSpinner}>⟳</span>
                            ) : (
                                '➤'
                            )}
                        </button>
                    </div>

                    <p className={styles.disclaimer}>
                        Fin usa IA local · Los datos nunca salen de tu dispositivo
                    </p>
                </div>
            )}
        </>
    );
}
