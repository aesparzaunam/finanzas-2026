'use client';

import { useState } from 'react';
import { useAuth } from '@/app/context/AuthProvider';
import Link from 'next/link';
import { auth, googleProvider, signInWithPopup } from '@/app/lib/firebase-client';
import Image from 'next/image';
import styles from '../auth.module.css';

export default function LoginPage() {
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();

    const handleGoogleLogin = async () => {
        setError('');
        setLoading(true);
        try {
            const result = await signInWithPopup(auth, googleProvider);
            const user = result.user;

            const res = await fetch('/api/auth/google', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    uid: user.uid,
                    email: user.email,
                    name: user.displayName,
                    photoURL: user.photoURL,
                }),
            });

            if (res.ok) {
                const userData = await res.json();
                login(userData);
            } else {
                const text = await res.text();
                let errMsg = 'Google login failed';
                try {
                    const data = JSON.parse(text);
                    errMsg = data.error || data.details || errMsg;
                } catch {
                    console.error("Non-JSON API error response:", text);
                    errMsg = `Server Error (${res.status}): ${text.substring(0, 500)}`;
                }
                setError(errMsg);
            }
        } catch (err: unknown) {
            console.error(err);
            const authError = err as { code?: string, message?: string };
            if (authError.code !== 'auth/popup-closed-by-user') {
                setError(authError.message || 'Google Auth Error');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.card}>
                <div className={styles.logoContainer}>
                    <Image src="/logo.jpeg" alt="Logo" width={64} height={64} className={styles.logoImg} />
                </div>
                <h1 className={styles.title}>Mis Finanzas</h1>

                <p className={styles.linkContainer}>
                    ¿No tienes una cuenta? <Link href="/auth/register">Regístrate</Link>
                </p>

                <div className={styles.googleWrapper}>
                    <p className={styles.googleSubtitle}>
                        Inicia sesión con tu cuenta de Google para acceder a tu dashboard
                    </p>

                    {error && <div className={styles.error} role="alert">{error}</div>}

                    <button
                        type="button"
                        className={styles.googleButton}
                        onClick={handleGoogleLogin}
                        disabled={loading}
                        aria-label="Iniciar sesión con Google"
                    >
                        {loading ? 'Conectando...' : 'Iniciar sesión con Google 🚀'}
                    </button>
                </div>
            </div>
        </div>
    );
}
