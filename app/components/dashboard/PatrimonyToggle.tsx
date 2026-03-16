"use client";

import { Home, User } from 'lucide-react';
import styles from './patrimony-toggle.module.css';

export type PatrimonyView = 'personal' | 'hogar';

interface PatrimonyToggleProps {
    value: PatrimonyView;
    onChange: (view: PatrimonyView) => void;
}

export default function PatrimonyToggle({ value, onChange }: PatrimonyToggleProps) {
    const isPersonal = value === 'personal';
    const isHogar = value === 'hogar';

    return (
        <div className={styles.toggleWrapper}>
            {isPersonal ? (
                <button
                    type="button"
                    onClick={() => onChange('personal')}
                    aria-pressed="true"
                    className={`${styles.toggleBtn} ${styles.toggleBtnPersonal} ${styles.active}`}
                >
                    <User size={13} />
                    Mi Patrimonio
                </button>
            ) : (
                <button
                    type="button"
                    onClick={() => onChange('personal')}
                    aria-pressed="false"
                    className={`${styles.toggleBtn} ${styles.toggleBtnPersonal}`}
                >
                    <User size={13} />
                    Mi Patrimonio
                </button>
            )}

            {isHogar ? (
                <button
                    type="button"
                    onClick={() => onChange('hogar')}
                    aria-pressed="true"
                    className={`${styles.toggleBtn} ${styles.toggleBtnHogar} ${styles.active}`}
                >
                    <Home size={13} />
                    Vista del Hogar
                </button>
            ) : (
                <button
                    type="button"
                    onClick={() => onChange('hogar')}
                    aria-pressed="false"
                    className={`${styles.toggleBtn} ${styles.toggleBtnHogar}`}
                >
                    <Home size={13} />
                    Vista del Hogar
                </button>
            )}
        </div>
    );
}
