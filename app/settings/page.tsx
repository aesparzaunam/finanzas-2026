'use client';

import { useState } from 'react';
import LayoutShell from '../components/dashboard/LayoutShell';
import ProfileSettings    from './sections/ProfileSettings';
import CategorySettings   from './sections/CategorySettings';
import NotificationSettings from './sections/NotificationSettings';
import AiSettings         from './sections/AiSettings';
import HouseholdSettings  from './sections/HouseholdSettings';
import DataSettings       from './sections/DataSettings';
import styles from './settings.module.css';
import {
    User, Tag, Bell, Sparkles, Home, Database
} from 'lucide-react';

const TABS = [
    { id: 'profile',       label: 'Perfil',           icon: User,     component: ProfileSettings },
    { id: 'categories',    label: 'Categorías',        icon: Tag,      component: CategorySettings },
    { id: 'notifications', label: 'Notificaciones',    icon: Bell,     component: NotificationSettings },
    { id: 'ai',            label: 'Inteligencia IA',   icon: Sparkles, component: AiSettings },
    { id: 'household',     label: 'Hogar',             icon: Home,     component: HouseholdSettings },
    { id: 'data',          label: 'Datos',             icon: Database, component: DataSettings },
] as const;

type TabId = typeof TABS[number]['id'];

export default function SettingsPage() {
    const [active, setActive] = useState<TabId>('profile');

    const ActiveComponent = TABS.find(t => t.id === active)!.component;

    return (
        <LayoutShell>
            <div className={styles.page}>

                {/* ── Header ── */}
                <div className={styles.header}>
                    <h1 className={styles.title}>Ajustes</h1>
                    <p className={styles.subtitle}>Personaliza tu experiencia en Antigravity</p>
                </div>

                {/* ── Layout: tabs + content ── */}
                <div className={styles.layout}>

                    {/* Sidebar de tabs (desktop) */}
                    <nav className={styles.tabNav} aria-label="Secciones de ajustes">
                        {TABS.map(tab => {
                            const Icon = tab.icon;
                            const isActive = active === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    className={isActive ? `${styles.tabBtn} ${styles.tabBtnActive}` : styles.tabBtn}
                                    onClick={() => setActive(tab.id)}
                                    aria-current={isActive ? 'page' : undefined}
                                >
                                    <Icon size={16} strokeWidth={isActive ? 2.5 : 1.8} className={styles.tabIcon} />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </nav>

                    {/* Tabs horizontal scroll (mobile) */}
                    <div className={styles.tabScrollMobile}>
                        {TABS.map(tab => {
                            const Icon = tab.icon;
                            const isActive = active === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    className={isActive ? `${styles.chipBtn} ${styles.chipBtnActive}` : styles.chipBtn}
                                    onClick={() => setActive(tab.id)}
                                >
                                    <Icon size={14} />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Contenido de la sección activa */}
                    <div className={styles.content}>
                        <ActiveComponent />
                    </div>

                </div>
            </div>
        </LayoutShell>
    );
}
