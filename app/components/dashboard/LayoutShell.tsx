'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from './Header';
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
            <Header />
            <main className={styles.main}>
                <div className={styles.container}>
                    {children}
                </div>
            </main>
            
            <Navbar />
        </div>
    );
}
