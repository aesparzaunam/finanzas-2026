"use client";

import Link from "next/link";
import { Bell, Sun, Moon, Plus, LogOut } from "lucide-react";
import { useAuth } from "@/app/context/AuthProvider";
import { useTheme } from "next-themes";
import { useState, useEffect } from "react";
import Image from "next/image";
import styles from "./shell.module.css";

export default function Header() {
    const { user, logout } = useAuth();
    const { setTheme, resolvedTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => { setMounted(true); }, []);

    const isDark = !mounted || resolvedTheme === "dark";
    const initials = user?.email?.[0]?.toUpperCase() ?? "U";

    return (
        <header className={`${styles.header} ${isDark ? styles.headerDark : styles.headerLight}`}>

            {/* Mobile logo */}
            <Link href="/" className={styles.headerTitle} aria-label="Antigravity Home">
                ⬡ Antigravity
            </Link>

            {/* Right actions */}
            <div className={styles.headerRight}>

                {/* Theme toggle */}
                <button
                    onClick={() => setTheme(isDark ? "light" : "dark")}
                    aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
                    title={isDark ? "Modo claro" : "Modo oscuro"}
                    className={`${styles.headerIconBtn} ${isDark ? styles.headerIconBtnDark : styles.headerIconBtnLight}`}
                >
                    {mounted
                        ? (isDark
                            ? <Sun size={18} strokeWidth={2} />
                            : <Moon size={18} strokeWidth={2} />)
                        : <Sun size={18} strokeWidth={2} />
                    }
                </button>

                {/* Notifications */}
                <button
                    className={`${styles.headerIconBtn} ${isDark ? styles.headerIconBtnDark : styles.headerIconBtnLight}`}
                    aria-label="Notificaciones"
                    title="Notificaciones"
                >
                    <Bell size={18} strokeWidth={2} />
                    <span className={styles.headerNotifDot} aria-hidden="true" />
                </button>

                {/* Add transaction */}
                <Link
                    href="/transactions/new"
                    aria-label="Nueva Transacción"
                    title="Nueva Transacción"
                    className={`${styles.headerIconBtn} ${styles.headerAddBtn}`}
                >
                    <Plus size={18} strokeWidth={2.5} />
                </Link>

                {/* User avatar */}
                <div
                    className={styles.headerAvatar}
                    role="button"
                    tabIndex={0}
                    aria-label="Perfil de usuario"
                    title={user?.email ?? "Usuario"}
                >
                    {user?.photoURL ? (
                        <Image
                            src={user.photoURL}
                            alt="Foto de perfil"
                            width={32}
                            height={32}
                            className={styles.headerAvatarImg}
                        />
                    ) : initials}
                </div>

                {/* Logout */}
                <button
                    onClick={() => logout()}
                    aria-label="Cerrar Sesión"
                    title="Cerrar Sesión"
                    className={`${styles.headerIconBtn} ${styles.headerLogoutBtn} ${isDark ? styles.headerLogoutBtnDark : styles.headerLogoutBtnLight}`}
                >
                    <LogOut size={18} strokeWidth={2} />
                </button>
            </div>
        </header>
    );
}
