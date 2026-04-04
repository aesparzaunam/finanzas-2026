'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Header from './Header';
import Navbar from './Navbar';
import { useAuth } from '@/app/context/AuthProvider';
import styles from './shell.module.css';

const AiChatWidget = dynamic(() => import('./AiChatWidget'), { ssr: false });

export default function LayoutShell({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const { user, loading } = useAuth();

    useEffect(() => {
        if (!loading && !user) {
            router.push('/auth/login');
        }
    }, [user, loading, router]);

    if (loading) {
        return (
            <div className={styles.loadingScreen}>
                <div className={styles.loadingInner}>
                    <div className={styles.loadingLogo}>⬡</div>
                    <div className={styles.loadingSpinner} />
                    <p className={styles.loadingText}>Cargando Antigravity...</p>
                </div>
            </div>
        );
    }

    if (!user) return null;

    return (
        <div className={styles.shell}>
            {/* Desktop sidebar + mobile bottom nav + mobile sheet menu */}
            <Navbar />

            {/* Sticky glass header (mobile logo + action buttons) */}
            <Header />

            {/* Main content — offset by sidebar on desktop, header on top */}
            <main className={styles.shellMain}>
                <div className={styles.shellContainer}>
                    {children}
                </div>
            </main>

            {/* AI chat widget */}
            <AiChatWidget />
        </div>
    );
}
