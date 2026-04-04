'use client';

import dynamic from 'next/dynamic';
import LayoutShell from '../components/dashboard/LayoutShell';
import ForecastWidget from '../components/dashboard/ForecastWidget';
import AiNarrativeCard from '../components/dashboard/AiNarrativeCard';
import AiInsightCard from '../components/dashboard/AiInsightCard';
import HealthScoreWidget from '../components/dashboard/HealthScoreWidget';
import styles from './insights.module.css';
import { Sparkles, Brain, TrendingUp, Shield, MessageSquare, AlertTriangle, Zap } from 'lucide-react';

// Componentes con SSR deshabilitado
const AiChatWidget      = dynamic(() => import('../components/dashboard/AiChatWidget'),       { ssr: false });
const AiAnomalyBanner   = dynamic(() => import('../components/transactions/AiAnomalyBanner'), { ssr: false });
const AnalysisDashboard = dynamic(() => import('../components/analysis/AnalysisDashboard'),   { ssr: false });

export default function InsightsPage() {
    const currentMonth = new Date().toISOString().slice(0, 7);

    return (
        <LayoutShell>
            <div className={styles.page}>

                {/* ── Hero Header ── */}
                <div className={styles.hero}>
                    <div className={styles.heroLeft}>
                        <div className={styles.heroBadge}>
                            <Zap size={12} strokeWidth={2.5} />
                            Powered by Fin IA · Ollama
                        </div>
                        <h1 className={styles.heroTitle}>
                            Insights
                            <span className={styles.heroTitleAccent}> IA</span>
                        </h1>
                        <p className={styles.heroSub}>
                            Análisis inteligente de tu salud financiera, pronósticos y patrones de consumo generados por modelos locales de IA.
                        </p>
                    </div>
                    <div className={styles.heroOrb}>
                        <Sparkles size={36} strokeWidth={1.5} />
                    </div>
                </div>

                {/* ── Grid principal ── */}
                <div className={styles.mainGrid}>

                    {/* ── Columna Izquierda (2/3) ── */}
                    <div className={styles.colMain}>

                        {/* Detección de Anomalías */}
                        <section className={styles.section}>
                            <div className={styles.sectionHeader}>
                                <AlertTriangle size={16} strokeWidth={2} className={`${styles.sectionIcon} ${styles.iconAmber}`} />
                                <h2 className={styles.sectionTitle}>Detección de Anomalías</h2>
                                <span className={`${styles.sectionBadge} ${styles.badgeAmber}`}>IA</span>
                            </div>
                            <AiAnomalyBanner />
                        </section>

                        {/* Consejo del Mes */}
                        <section className={styles.section}>
                            <div className={styles.sectionHeader}>
                                <Brain size={16} strokeWidth={2} className={`${styles.sectionIcon} ${styles.iconPurple}`} />
                                <h2 className={styles.sectionTitle}>Consejo del Mes</h2>
                                <span className={`${styles.sectionBadge} ${styles.badgePurple}`}>Fin IA</span>
                            </div>
                            <AiInsightCard />
                        </section>

                        {/* Resumen Narrativo */}
                        <section className={styles.section}>
                            <div className={styles.sectionHeader}>
                                <MessageSquare size={16} strokeWidth={2} className={`${styles.sectionIcon} ${styles.iconBlue}`} />
                                <h2 className={styles.sectionTitle}>Resumen Narrativo</h2>
                                <span className={`${styles.sectionBadge} ${styles.badgeBlue}`}>LLM</span>
                            </div>
                            <AiNarrativeCard month={currentMonth} />
                        </section>

                        {/* Análisis de Flujo */}
                        <section className={styles.section}>
                            <div className={styles.sectionHeader}>
                                <TrendingUp size={16} strokeWidth={2} className={`${styles.sectionIcon} ${styles.iconGreen}`} />
                                <h2 className={styles.sectionTitle}>Análisis de Flujo</h2>
                                <span className={`${styles.sectionBadge} ${styles.badgeGreen}`}>Tendencias</span>
                            </div>
                            <AnalysisDashboard />
                        </section>

                    </div>

                    {/* ── Columna Derecha (1/3) ── */}
                    <div className={styles.colSide}>

                        {/* Salud Financiera */}
                        <section className={styles.section}>
                            <div className={styles.sectionHeader}>
                                <Shield size={16} strokeWidth={2} className={`${styles.sectionIcon} ${styles.iconCyan}`} />
                                <h2 className={styles.sectionTitle}>Salud Financiera</h2>
                                <span className={`${styles.sectionBadge} ${styles.badgeCyan}`}>Score</span>
                            </div>
                            <HealthScoreWidget />
                        </section>

                        {/* Pronóstico */}
                        <section className={styles.section}>
                            <div className={styles.sectionHeader}>
                                <TrendingUp size={16} strokeWidth={2} className={`${styles.sectionIcon} ${styles.iconIndigo}`} />
                                <h2 className={styles.sectionTitle}>Pronóstico</h2>
                                <span className={`${styles.sectionBadge} ${styles.badgeIndigo}`}>Proyección</span>
                            </div>
                            <ForecastWidget />
                        </section>

                        {/* Chat con Fin */}
                        <section className={`${styles.section} ${styles.chatSection}`}>
                            <div className={styles.sectionHeader}>
                                <Sparkles size={16} strokeWidth={2} className={`${styles.sectionIcon} ${styles.iconPurple}`} />
                                <h2 className={styles.sectionTitle}>Habla con Fin</h2>
                                <span className={`${styles.sectionBadge} ${styles.badgePurple}`}>Chat IA</span>
                            </div>
                            <p className={styles.chatHint}>
                                Fin tiene acceso completo a tus datos financieros. Pregúntale lo que quieras sobre tus finanzas.
                            </p>
                            <AiChatWidget />
                        </section>

                    </div>
                </div>

            </div>
        </LayoutShell>
    );
}
