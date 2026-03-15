'use client';

import { useState } from 'react';
import { useAuth } from '@/app/context/AuthProvider';
import Link from 'next/link';
import { auth, googleProvider, signInWithPopup } from '@/app/lib/firebase-client';
import styles from '../auth.module.css';

export default function RegisterPage() {
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
                const data = await res.json();
                setError(data.error || 'Google registration failed');
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
                <h1 className={styles.title}>Crear Cuenta</h1>

                <div className={styles.googleWrapper}>
                    <p className={styles.googleSubtitle}>
                        Regístrate rápidamente con tu cuenta de Google.
                    </p>

                    {error && <div className={styles.error} role="alert">{error}</div>}

                    <button
                        type="button"
                        className={styles.googleButton}
                        onClick={handleGoogleLogin}
                        disabled={loading}
                        aria-label="Registrarse con Google"
                    >
                        {loading ? 'Conectando...' : 'Registrarse con Google 🚀'}
                    </button>
                </div>

                <p className={styles.linkContainer}>
                    ¿Ya tienes una cuenta? <Link href="/auth/login">Inicia Sesión</Link>
                </p>
            </div>
        </div>
    );
}
