"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BarChart2, CreditCard, LayoutTemplate, PieChart, LogOut, Sun, Moon, Plus } from "lucide-react";
import { useAuth } from "@/app/context/AuthProvider";
import { useTheme } from "next-themes";
import { useState, useEffect } from "react";
import Image from "next/image";
import styles from "./dashboard.module.css";
import NotificationCenter from "@/app/components/NotificationCenter";

const navLinks = [
    { href: "/", label: "Inicio", icon: Home },
    { href: "/transactions", label: "Historial", icon: BarChart2 },
    { href: "/budgets", label: "Presupuestos", icon: PieChart },
    { href: "/msi", label: "MSI", icon: LayoutTemplate },
    { href: "/accounts", label: "Cuentas", icon: CreditCard },
];

export default function Header() {
    const pathname = usePathname();
    const { user, logout } = useAuth();
    const { setTheme, resolvedTheme } = useTheme();

    // Patrón oficial next-themes: esperar a que el cliente hidrate
    // antes de leer resolvedTheme para evitar mismatch SSR/cliente
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    const isDark = mounted && resolvedTheme === 'dark';

    return (
        <header className={styles.header}>
            <div className={styles.headerContainer}>
                {/* Logo Section */}
                <div className={styles.headerLogo}>
                    <div className={styles.logoImageWrapper}>
                        <Image 
                            src="/logo.jpeg" 
                            alt="Logo" 
                            width={36} 
                            height={36} 
                            className={styles.logoImage}
                        />
                    </div>
                    <span className={styles.logoText}>Finanzas</span>
                </div>

                {/* Centered Navigation */}
                <nav className={styles.desktopNav}>
                    {navLinks.map((link) => {
                        const active = pathname === link.href;
                        const Icon = link.icon;
                        return (
                            <Link
                                key={link.href}
                                href={link.href}
                                className={`${styles.desktopNavItem} ${active ? styles.desktopNavItemActive : ""}`}
                            >
                                <Icon size={18} />
                                <span>{link.label}</span>
                            </Link>
                        );
                    })}
                </nav>

                {/* User Actions Section */}
                <div className={styles.headerRight}>
                    <button 
                        className={`${styles.iconButton} ${styles.themeBtn}`} 
                        onClick={() => setTheme(isDark ? 'light' : 'dark')}
                        aria-label={mounted ? (isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro') : 'Cambiar Tema'}
                        title={mounted ? (isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro') : 'Cambiar Tema'}
                    >
                        {mounted ? (
                            isDark ? <Sun size={16} /> : <Moon size={16} />
                        ) : (
                            <Moon size={16} />
                        )}
                        <span className={styles.themeBtnLabel}>
                            {mounted ? (isDark ? 'Claro' : 'Oscuro') : 'Tema'}
                        </span>
                    </button>
                    
                    {/* #10 Notification Center */}
                    <NotificationCenter />
                    
                    <Link 
                        href="/transactions/new" 
                        className={`${styles.iconButton} ${styles.primaryBtn}`}
                        aria-label="Añadir Transacción"
                        title="Nueva Transacción"
                    >
                        <Plus size={20} />
                    </Link>

                    <div className={styles.userSection}>
                        <div className={styles.userAvatar}>
                            {user?.photoURL ? (
                                <Image src={user.photoURL} alt="Profile" width={32} height={32} className={styles.avatarImg} />
                            ) : (
                                user?.email?.[0]?.toUpperCase() || 'U'
                            )}
                        </div>
                        <div className={styles.userDetails}>
                            <span className={styles.userEmail}>{user?.email?.split('@')[0]}</span>
                        </div>
                        <button className={styles.logoutAction} onClick={() => logout()} title="Cerrar Sesión">
                            <LogOut size={18} />
                        </button>
                    </div>
                </div>
            </div>
        </header>
    );
}
