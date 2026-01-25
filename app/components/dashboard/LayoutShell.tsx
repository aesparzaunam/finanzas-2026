'use client';

import { useRouter } from 'next/navigation';
import Navbar from './Navbar';
import styles from './dashboard.module.css';

export default function LayoutShell({ children }: { children: React.ReactNode }) {
    const router = useRouter();

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/auth/login');
    };

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
