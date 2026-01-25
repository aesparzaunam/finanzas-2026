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
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
            router.push('/auth/login');
        } catch (error) {
            console.error('Logout failed', error);
        }
    };

    if (loading) {
        return <div className={styles.loadingOverlay}>
            <p>Cargando sesión...</p>
        </div>;
    }

    if (!user) {
        return null;
    }

    return (
        <div className={styles.shell}>
            <header className={styles.header}>
                <div className={styles.container}>
                    <div className={styles.headerContent}>
                        <div className={styles.logo}>
                            <div className={styles.logoIcon}>💰</div>
                            <span className={styles.logoText}>Finanzas</span>
                        </div>

                        <Navbar />

                        <div className={styles.userMenu}>
                            <div className={styles.userAvatar}>{user.email?.[0]?.toUpperCase() || 'U'}</div>
                            <button className={styles.logoutBtn} onClick={handleLogout} aria-label="Cerrar sesión">
                                <span className={styles.logoutText}>Salir</span>
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.logoutIconSvg}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
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
