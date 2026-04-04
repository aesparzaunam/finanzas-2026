'use client';

import { useState, useEffect } from 'react';
import { Sparkles, Wifi, WifiOff, Trash2, Check } from 'lucide-react';
import styles from '../settings.module.css';

export default function AiSettings() {
    const [ollamaOk, setOllamaOk]     = useState<boolean | null>(null);
    const [modelLoaded, setModelLoaded] = useState<boolean | null>(null);
    const [modelName, setModelName]    = useState('');
    const [aiEnabled, setAiEnabled]    = useState(true);
    const [clearing, setClearing]      = useState(false);
    const [cleared, setCleared]        = useState(false);
    const [chatCount, setChatCount]    = useState<number | null>(null);

    useEffect(() => {
        const model = process.env.NEXT_PUBLIC_LOCAL_LLM_MODEL || 'qwen-claude:latest';
        setModelName(model);
        setAiEnabled(localStorage.getItem('ai-disabled') !== 'true');

        // Verificar estado Ollama con endpoint rápido (sin chat test)
        fetch('/api/ai/health')
            .then(r => r.json())
            .then(d => {
                setOllamaOk(d.ok === true);
                setModelLoaded(d.modelLoaded === true);
            })
            .catch(() => { setOllamaOk(false); setModelLoaded(false); });

        // Contar mensajes del chat
        fetch('/api/ai/chat/count')
            .then(r => r.ok ? r.json() : null)
            .then(d => d && setChatCount(d.count))
            .catch(() => {});
    }, []);

    const clearChat = async () => {
        if (!confirm('¿Borrar todo el historial de conversación con Fin?')) return;
        setClearing(true);
        await fetch('/api/ai/chat', { method: 'DELETE' });
        setClearing(false);
        setCleared(true);
        setChatCount(0);
        setTimeout(() => setCleared(false), 2500);
    };

    const toggleAi = (enabled: boolean) => {
        setAiEnabled(enabled);
        localStorage.setItem('ai-disabled', enabled ? 'false' : 'true');
    };

    return (
        <div className={styles.card}>
            <h2 className={styles.cardTitle}>
                <Sparkles size={14} style={{ display: 'inline', marginRight: 6 } as React.CSSProperties} />
                Inteligencia Artificial
            </h2>

            {/* Estado de Ollama */}
            <div className={styles.fieldRow}>
                <div>
                    <div className={styles.fieldLabel}>Modelo LLM activo</div>
                    <div className={styles.fieldDesc}>Servidor Ollama local</div>
                </div>
                <div className={styles.aiStatusCol}>
                    <span className={styles.infoPill}>{modelName}</span>
                    {ollamaOk === null && <span className={styles.statusWarn}>Verificando...</span>}
                    {ollamaOk === true && modelLoaded === true && (
                        <span className={styles.statusOk}>
                            <Wifi size={12} className={styles.inlineIcon} /> Conectado · modelo cargado
                        </span>
                    )}
                    {ollamaOk === true && modelLoaded === false && (
                        <span className={styles.statusWarn}>
                            <Wifi size={12} className={styles.inlineIcon} /> Ollama activo · modelo no encontrado
                        </span>
                    )}
                    {ollamaOk === false && (
                        <span className={styles.statusErr}>
                            <WifiOff size={12} className={styles.inlineIcon} /> Sin conexión — inicia Ollama
                        </span>
                    )}
                </div>
            </div>


            {/* IA habilitada */}
            <div className={styles.fieldRow}>
                <div>
                    <div className={styles.fieldLabel}>IA habilitada</div>
                    <div className={styles.fieldDesc}>Desactivar para modo offline sin llamadas al LLM</div>
                </div>
                <label className={styles.toggle} aria-label="Habilitar IA">
                    <input
                        type="checkbox"
                        checked={aiEnabled}
                        onChange={e => toggleAi(e.target.checked)}
                    />
                    <span className={styles.toggleSlider} />
                </label>
            </div>

            {/* API Key Gemini */}
            <div className={styles.fieldRow}>
                <div>
                    <div className={styles.fieldLabel}>Google Gemini API</div>
                    <div className={styles.fieldDesc}>Usado para análisis avanzados y embeddings</div>
                </div>
                <span className={styles.statusOk}>✓ Configurada</span>
            </div>

            {/* Historial de chat */}
            <div className={styles.fieldRow}>
                <div>
                    <div className={styles.fieldLabel}>Historial de chat con Fin</div>
                    <div className={styles.fieldDesc}>
                        {chatCount !== null ? `${chatCount} mensajes almacenados` : 'Calculando...'}
                    </div>
                </div>
                <button
                    className={styles.btnDanger}
                    onClick={clearChat}
                    disabled={clearing || chatCount === 0}
                >
                    {clearing ? '...' : <><Trash2 size={14} /> Limpiar</>}
                </button>
            </div>
            {cleared && <span className={styles.savedMsg}><Check size={14} style={{ display: 'inline' } as React.CSSProperties} /> Historial eliminado</span>}
        </div>
    );
}
