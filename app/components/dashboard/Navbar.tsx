"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BarChart2, CreditCard, LayoutTemplate, PieChart, Plus, Menu, X, LogOut, FileText } from "lucide-react";
import { useAuth } from "@/app/context/AuthProvider";
import styles from "./dashboard.module.css";
import menuStyles from "./menu.module.css";

const linksLeft = [
    { href: "/", label: "Inicio", icon: Home },
    { href: "/accounts", label: "Tarjetas", icon: CreditCard },
];

const linksRight = [
    { href: "/transactions", label: "Historial", icon: BarChart2 },
];

export default function Navbar() {
    const pathname = usePathname();
    const { logout } = useAuth();
    const [menuOpen, setMenuOpen] = useState(false);

    return (
        <>

            

            {/* Mobile Bottom Tab Bar */}
            <div className={styles.mobileNavWrapper}>
                <nav className={styles.mobileNav}>
                    <div className={styles.navSection}>
                        {linksLeft.map((l) => {
                            const active = pathname === l.href || (pathname.startsWith('/transactions') && l.label === 'Movimientos');
                            const Icon = l.icon;
                            return (
                                <Link
                                    key={l.href}
                                    href={l.href}
                                    className={`${styles.mobileNavItem} ${active ? styles.mobileNavItemActive : ""}`}
                                >
                                    <Icon size={24} className={styles.mobileNavIcon} strokeWidth={active ? 2.5 : 2} />
                                    <span className={styles.mobileNavLabel}>{l.label}</span>
                                </Link>
                            );
                        })}
                    </div>
                    
                    <div className={styles.fabWrapper}>
                        <Link href="/transactions/new" className={styles.fabButton} aria-label="Add transaction">
                            <Plus size={28} color="white" />
                        </Link>
                    </div>

                    <div className={styles.navSection}>
                        {linksRight.map((l) => {
                            const active = pathname.startsWith(l.href);
                            const Icon = l.icon;
                            return (
                                <Link
                                    key={l.href}
                                    href={l.href}
                                    className={`${styles.mobileNavItem} ${active ? styles.mobileNavItemActive : ""}`}
                                >
                                    <Icon size={24} className={styles.mobileNavIcon} strokeWidth={active ? 2.5 : 2} />
                                    <span className={styles.mobileNavLabel}>{l.label}</span>
                                </Link>
                            );
                        })}
                        {/* Custom Menu Toggle Button */}
                        <button 
                            className={`${styles.mobileNavItem} ${menuOpen ? styles.mobileNavItemActive : ""} ${menuStyles.btnTransparent}`}
                            onClick={() => setMenuOpen(!menuOpen)}
                            aria-label="Abrir Menú"
                            title="Abrir Menú"
                        >
                            <Menu size={24} className={styles.mobileNavIcon} strokeWidth={menuOpen ? 2.5 : 2} />
                            <span className={styles.mobileNavLabel}>Menú</span>
                        </button>
                    </div>
                </nav>
            </div>

            {menuOpen && (
                <div className={menuStyles.menuOverlay} onClick={() => setMenuOpen(false)}>
                    <div className={menuStyles.menuSheet} onClick={e => e.stopPropagation()}>
                        <div className={menuStyles.menuDragIndicator} />
                        <div className={menuStyles.menuHeader}>
                            <h2 className={menuStyles.menuTitle}>Menú</h2>
                            <div className={menuStyles.headerActions}>
                                <button className={menuStyles.logoutHeaderBtn} onClick={() => logout()} aria-label="Cerrar Sesión" title="Cerrar Sesión">
                                    <LogOut size={18} strokeWidth={2.5} />
                                    <span>Salir</span>
                                </button>
                                <button className={menuStyles.closeBtn} onClick={() => setMenuOpen(false)} aria-label="Cerrar" title="Cerrar">
                                    <X size={20} strokeWidth={2.5} />
                                    <span>Cerrar</span>
                                </button>
                            </div>
                        </div>

                        <div className={menuStyles.menuGrid}>
                            <Link href="/budgets" className={menuStyles.menuGridItem} onClick={() => setMenuOpen(false)}>
                                <div className={`${menuStyles.menuActionIcon} ${menuStyles.iconGreen}`}>
                                    <PieChart size={24} />
                                </div>
                                <div>
                                    <div className={menuStyles.menuGridItemTitle}>Presupuestos</div>
                                    <div className={menuStyles.menuGridItemDesc}>Control de gastos</div>
                                </div>
                            </Link>

                            <Link href="/msi" className={menuStyles.menuGridItem} onClick={() => setMenuOpen(false)}>
                                <div className={`${menuStyles.menuActionIcon} ${menuStyles.iconOrange}`}>
                                    <LayoutTemplate size={24} />
                                </div>
                                <div>
                                    <div className={menuStyles.menuGridItemTitle}>MSI</div>
                                    <div className={menuStyles.menuGridItemDesc}>Plazos sin intereses</div>
                                </div>
                            </Link>
                            
                             <Link href="/accounts" className={menuStyles.menuGridItem} onClick={() => setMenuOpen(false)}>
                                <div className={`${menuStyles.menuActionIcon} ${menuStyles.iconBlue}`}>
                                    <CreditCard size={24} />
                                </div>
                                <div>
                                    <div className={menuStyles.menuGridItemTitle}>Cuentas</div>
                                    <div className={menuStyles.menuGridItemDesc}>Saldos y tarjetas</div>
                                </div>
                            </Link>

                            <Link href="/transactions" className={menuStyles.menuGridItem} onClick={() => setMenuOpen(false)}>
                                <div className={`${menuStyles.menuActionIcon} ${menuStyles.iconSlate}`}>
                                    <FileText size={24} />
                                </div>
                                <div>
                                    <div className={menuStyles.menuGridItemTitle}>Movimientos</div>
                                    <div className={menuStyles.menuGridItemDesc}>Historial completo</div>
                                </div>
                            </Link>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
