'use client';

import { useState } from 'react';
import { useAuth } from '@/app/context/AuthProvider';
import Link from 'next/link';
import styles from '../auth.module.css';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            if (res.ok) {
                const user = await res.json();
                login(user);
            } else {
                const data = await res.json();
                setError(data.error || 'Invalid credentials');
            }
        } catch (err) {
            console.error(err);
            setError('An error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.card}>
                <h1 className={styles.title}>Login</h1>
                <form onSubmit={handleSubmit} className={styles.form}>
                    {error && <div className={styles.error} role="alert">{error}</div>}
                    <div className={styles.inputGroup}>
                        <label htmlFor="email-login" className={styles.label}>Email</label>
                        <input
                            id="email-login"
                            className={styles.input}
                            type="email"
                            placeholder="email@example.com"
                            title="Email Address"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div className={styles.inputGroup}>
                        <label htmlFor="password-login" className={styles.label}>Password</label>
                        <input
                            id="password-login"
                            className={styles.input}
                            type="password"
                            placeholder="••••••"
                            title="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    <button type="submit" className={styles.button} disabled={loading}>
                        {loading ? 'Signing In...' : 'Sign In'}
                    </button>
                </form>
                <p className={styles.link}>
                    Don&apos;t have an account? <Link href="/auth/register">Register</Link>
                </p>
            </div>
        </div>
    );
}
