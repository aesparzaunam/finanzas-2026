"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./dashboard.module.css";

const links = [
    { href: "/", label: "Dashboard", icon: "📊" },
    { href: "/transactions", label: "Movimientos", icon: "💸" },
    { href: "/budgets", label: "Presupuestos", icon: "🎯" },
    { href: "/msi", label: "MSI", icon: "💳" },
    { href: "/accounts", label: "Cuentas", icon: "🏦" },
];

export default function Navbar() {
    const pathname = usePathname();

    return (
        <>
            {/* Desktop Navigation */}
            <nav className={styles.nav}>
                {links.map((l) => {
                    const active = pathname === l.href;
                    return (
                        <Link
                            key={l.href}
                            href={l.href}
                            className={`${styles.navItem} ${active ? styles.navItemActive : ""}`}
                        >
                            {l.label}
                        </Link>
                    );
                })}
            </nav>

            {/* Mobile Bottom Tab Bar */}
            <nav className={styles.mobileNav}>
                {links.map((l) => {
                    const active = pathname === l.href;
                    return (
                        <Link
                            key={l.href}
                            href={l.href}
                            className={`${styles.mobileNavItem} ${active ? styles.mobileNavItemActive : ""}`}
                        >
                            <span className={styles.mobileNavIcon}>{l.icon}</span>
                            <span className={styles.mobileNavLabel}>{l.label}</span>
                        </Link>
                    );
                })}
            </nav>
        </>
    );
}
