'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from './Navbar';
import { useAuth } from '@/app/context/AuthProvider';
import styles from './dashboard.module.css';

export default function LayoutShell({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const { user, loading } = useAuth();

    useEffect(() => {
        if (!loading && !user) {
            router.push('/auth/login');
        }
    }, [user, loading, router]);

    const handleLogout = async () => {
        await fetch('/api/auth/me', { method: 'POST' }); // Use the me route for logout as seen in me/route.ts
        router.push('/auth/login');
    };

    if (loading) {
        return <div className={styles.shell} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p>Cargando sesión...</p>
        </div>;
    }

    if (!user) {
        return null; // Don't render anything while redirecting
    }

    return (
        <div className={styles.shell}>
            <header className={styles.header}>
                <div className={styles.container}>
                    <div className={styles.headerContent}>
                        <div className={styles.logo}>
                            <div className={styles.logoIcon}>💰</div>
                            <span>Finanzas</span>
                        </div>

                        <Navbar />

                        <div className={styles.userMenu}>
                            <div className={styles.userAvatar}>U</div>
                            <button className={styles.logoutBtn} onClick={handleLogout}>
                                Salir
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <main className={styles.main}>
                <div className={styles.container}>
                    {children}
                </div>
            </main>
        </div>
    );
}
