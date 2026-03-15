"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BarChart2, CreditCard, LayoutTemplate, PieChart, LogOut, Bell, Sun, Moon, Plus } from "lucide-react";
import { useAuth } from "@/app/context/AuthProvider";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import Image from "next/image";
import styles from "./dashboard.module.css";

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
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

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
                    {mounted && (
                        <button 
                            className={styles.iconButton} 
                            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                            aria-label="Cambiar Tema"
                        >
                            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                        </button>
                    )}
                    
                    <Link 
                        href="/transactions/new" 
                        className={`${styles.iconButton} ${styles.primaryBtn}`}
                        aria-label="Añadir Transacción"
                        title="Nueva Transacción"
                    >
                        <Plus size={20} />
                    </Link>
                    
                    <button className={styles.iconButton} aria-label="Notificaciones">
                        <Bell size={20} />
                    </button>

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
