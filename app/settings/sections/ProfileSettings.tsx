'use client';

import { useState, useEffect } from 'react';
import { User, Save, Moon, Sun } from 'lucide-react';
import styles from '../settings.module.css';
import { useTheme } from 'next-themes';

export default function ProfileSettings() {
    const { theme, setTheme } = useTheme();
    const [name, setName]   = useState('');
    const [email, setEmail] = useState('');
    const [saved, setSaved] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/auth/me')
            .then(r => r.json())
            .then(data => {
                setName(data.name  || '');
                setEmail(data.email || '');
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    const handleSave = async () => {
        const res = await fetch('/api/auth/me', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name }),
        });
        if (res.ok) {
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
        }
    };

    if (loading) {
        return <div className={styles.card}><p className={styles.fieldDesc}>Cargando perfil...</p></div>;
    }

    return (
        <div className={styles.card}>
            <h2 className={styles.cardTitle}><User size={14} style={{ display: 'inline', marginRight: 6 }} />Perfil y Cuenta</h2>

            {/* Nombre */}
            <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="prf-name">Nombre</label>
                <input
                    id="prf-name"
                    className={styles.fieldInput}
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Tu nombre"
                />
            </div>

            {/* Email (read-only) */}
            <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="prf-email">Correo electrónico</label>
                <input
                    id="prf-email"
                    className={styles.fieldInput}
                    value={email}
                    readOnly
                    style={{ opacity: 0.6, cursor: 'not-allowed' } as React.CSSProperties}
                />
                <span className={styles.fieldDesc}>El correo no se puede cambiar desde aquí.</span>
            </div>

            {/* Tema */}
            <div className={styles.fieldRow}>
                <div>
                    <div className={styles.fieldLabel}>Tema de la aplicación</div>
                    <div className={styles.fieldDesc}>Cambia entre modo oscuro y claro</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 } as React.CSSProperties}>
                    <Sun size={14} style={{ color: 'var(--on-surface-variant)' } as React.CSSProperties} />
                    <label className={styles.toggle} aria-label="Cambiar tema">
                        <input
                            type="checkbox"
                            checked={theme === 'dark'}
                            onChange={e => setTheme(e.target.checked ? 'dark' : 'light')}
                        />
                        <span className={styles.toggleSlider} />
                    </label>
                    <Moon size={14} style={{ color: 'var(--on-surface-variant)' } as React.CSSProperties} />
                </div>
            </div>

            {/* Moneda */}
            <div className={styles.fieldRow}>
                <div>
                    <div className={styles.fieldLabel}>Moneda principal</div>
                    <div className={styles.fieldDesc}>Usada en todos los totales</div>
                </div>
                <span className={styles.infoPill}>🇲🇽 MXN</span>
            </div>

            {/* Save */}
            <div className={styles.saveRow}>
                <button className={styles.btnPrimary} onClick={handleSave}>
                    <Save size={14} /> Guardar cambios
                </button>
                {saved && <span className={styles.savedMsg}>✓ Guardado</span>}
            </div>
        </div>
    );
}
