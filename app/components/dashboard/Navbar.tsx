"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    Home, CreditCard, BarChart2, PieChart,
    LayoutTemplate, Plus, Menu, X, LogOut,
    FileText, Settings, Sparkles,
} from "lucide-react";
import { useAuth } from "@/app/context/AuthProvider";
import styles from "./shell.module.css";

// ── Desktop sidebar navigation items ──────────────────────────
const SIDEBAR_ITEMS = [
    { href: "/",             label: "Inicio",       icon: Home },
    { href: "/accounts",     label: "Cuentas",      icon: CreditCard },
    { href: "/transactions", label: "Historial",    icon: BarChart2 },
    { href: "/budgets",      label: "Presupuestos", icon: PieChart },
    { href: "/msi",          label: "MSI",          icon: LayoutTemplate },
    { href: "/insights",     label: "Insights IA",  icon: Sparkles },
];

// ── Mobile bottom bar items ───────────────────────────────────
const BOTTOM_LEFT  = [
    { href: "/",         label: "Inicio",   icon: Home },
    { href: "/accounts", label: "Cuentas",  icon: CreditCard },
];
const BOTTOM_RIGHT = [
    { href: "/transactions", label: "Historial", icon: BarChart2 },
];

// ── Menu sheet items (all routes) ─────────────────────────────
const MENU_ITEMS = [
    { href: "/budgets",      label: "Presupuestos", desc: "Control de gastos",   icon: PieChart,       color: "#5bf083" },
    { href: "/msi",          label: "MSI",          desc: "Pagos sin intereses",  icon: LayoutTemplate, color: "#92aaff" },
    { href: "/accounts",     label: "Cuentas",      desc: "Saldos y tarjetas",    icon: CreditCard,     color: "#3c6bed" },
    { href: "/transactions", label: "Movimientos",  desc: "Historial completo",   icon: FileText,       color: "#a3aac4" },
    { href: "/insights",     label: "Insights IA",  desc: "Análisis inteligente", icon: Sparkles,       color: "#c084fc" },
];


export default function Navbar() {
    const pathname = usePathname();
    const { logout } = useAuth();
    const [menuOpen, setMenuOpen] = useState(false);

    const isActive = (href: string) =>
        href === "/" ? pathname === "/" : pathname.startsWith(href);

    // ── Desktop sidebar link ─────────────────────────────────
    const SidebarLink = ({ href, label, icon: Icon }: { href: string; label: string; icon: typeof Home }) => {
        const active = isActive(href);
        return (
            <Link
                href={href}
                className={active ? styles.sidebarLinkActive : styles.sidebarLink}
                aria-current={active ? "page" : undefined}
            >
                <Icon size={18} strokeWidth={active ? 2.5 : 1.8} className={styles.sidebarLinkIcon} />
                {label}
            </Link>
        );
    };

    // ── Mobile bottom tab link ───────────────────────────────
    const TabLink = ({ href, label, icon: Icon }: { href: string; label: string; icon: typeof Home }) => {
        const active = isActive(href);
        return (
            <Link href={href} className={`${styles.tabLink} ${active ? styles.tabLinkActiveDark : styles.tabLinkDark}`}>
                <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
                <span className={`${styles.tabLabel} ${active ? styles.tabLabelActive : ""}`}>{label}</span>
            </Link>
        );
    };

    return (
        <>
            {/* ═══════════════════════════════════════════
                DESKTOP SIDEBAR
            ═══════════════════════════════════════════ */}
            <aside className={styles.sidebar}>
                <div className={styles.sidebarLogoWrap}>
                    <div className={styles.sidebarLogo}>
                        <span className={styles.sidebarLogoAccent}>⬡</span>
                        Antigravity
                    </div>
                </div>

                <nav className={styles.sidebarNav}>
                    {SIDEBAR_ITEMS.map(item => (
                        <SidebarLink key={item.href} {...item} />
                    ))}
                </nav>

                <div className={styles.sidebarBottom}>
                    <Link href="/transactions/new" className={styles.sidebarLink} aria-label="Nueva Transacción">
                        <Plus size={18} strokeWidth={2} />
                        Nueva Transacción
                    </Link>
                    <Link href="/settings" className={isActive('/settings') ? styles.sidebarLinkActive : styles.sidebarLink} aria-label="Ajustes" aria-current={isActive('/settings') ? 'page' : undefined}>
                        <Settings size={18} strokeWidth={1.8} />
                        Ajustes
                    </Link>
                    <button
                        onClick={() => logout()}
                        className={styles.sidebarLogoutBtn}
                        aria-label="Cerrar Sesión"
                    >
                        <LogOut size={16} strokeWidth={1.8} />
                        Cerrar Sesión
                    </button>
                </div>
            </aside>

            {/* ═══════════════════════════════════════════
                MOBILE BOTTOM BAR
            ═══════════════════════════════════════════ */}
            <nav className={`${styles.mobileBar} ${styles.mobileBarDark}`} aria-label="Navegación principal">
                {BOTTOM_LEFT.map(l => <TabLink key={l.href} {...l} />)}

                {/* FAB */}
                <Link href="/transactions/new" aria-label="Nueva Transacción" className={styles.fab}>
                    <Plus size={26} strokeWidth={2.5} />
                </Link>

                {BOTTOM_RIGHT.map(l => <TabLink key={l.href} {...l} />)}

                {/* More button */}
                <button
                    onClick={() => setMenuOpen(true)}
                    aria-label="Abrir Menú"
                    aria-expanded={menuOpen}
                    className={`${styles.tabLink} ${menuOpen ? styles.tabLinkActiveDark : styles.tabLinkDark}`}
                >
                    <Menu size={22} strokeWidth={1.8} />
                    <span className={styles.tabLabel}>Más</span>
                </button>
            </nav>

            {/* ═══════════════════════════════════════════
                SLIDE-UP MENU SHEET
            ═══════════════════════════════════════════ */}
            {menuOpen && (
                <div className={styles.menuOverlay} onClick={() => setMenuOpen(false)} role="dialog" aria-modal="true" aria-label="Menú principal">
                    <div
                        className={`${styles.menuSheet} ${styles.menuSheetDark}`}
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Drag handle */}
                        <div className={styles.menuDragHandle} />

                        {/* Header */}
                        <div className={styles.menuSheetHeader}>
                            <h2 className={styles.menuTitle}>Navegación</h2>
                            <div className={styles.menuHeaderActions}>
                                <button
                                    onClick={() => { logout(); setMenuOpen(false); }}
                                    className={styles.menuLogoutBtn}
                                    aria-label="Cerrar Sesión"
                                >
                                    <LogOut size={13} /> Salir
                                </button>
                                <button
                                    onClick={() => setMenuOpen(false)}
                                    aria-label="Cerrar Menú"
                                    className={styles.menuCloseBtn}
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>

                        {/* Menu grid */}
                        <div className={styles.menuGrid}>
                            {MENU_ITEMS.map(item => {
                                const Icon = item.icon;
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={() => setMenuOpen(false)}
                                        className={styles.menuGridItem}
                                    >
                                        <div
                                            className={styles.menuItemIcon}
                                            style={{ '--item-color': item.color } as React.CSSProperties}
                                        >
                                            <Icon size={22} />
                                        </div>
                                        <div className={styles.menuItemText}>
                                            <div className={styles.menuItemTitle}>{item.label}</div>
                                            <div className={styles.menuItemDesc}>{item.desc}</div>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
