'use client';

import { useState } from 'react';
import styles from '../accounts/accounts.module.css'; // Reusing account styles including modal

interface EditMSIModalProps {
    plan: any;
    categories: any[];
    onClose: () => void;
    onSave: (updatedPlan: any) => Promise<void>;
}

export default function EditMSIModal({ plan, categories, onClose, onSave }: EditMSIModalProps) {
    const [description, setDescription] = useState(plan.description);
    const [categoryId, setCategoryId] = useState(plan.categoryId || '');
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            await onSave({
                ...plan,
                description,
                categoryId: categoryId || null
            });
            onClose();
        } catch (error) {
            console.error(error);
            alert('Error updating MSI plan');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className={styles.modalOverlay}>
            <div className={styles.modal}>
                <div className={styles.modalHeader}>
                    <h3 className={styles.modalTitle}>Editar Plan MSI</h3>
                    <button className={styles.closeButton} onClick={onClose}>&times;</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className={styles.formGrid} style={{ display: 'flex', flexDirection: 'column' }}>
                        <div className={styles.inputGroup}>
                            <label className={styles.label}>Descripción</label>
                            <input
                                className={styles.input}
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                required
                            />
                        </div>
                        <div className={styles.inputGroup}>
                            <label className={styles.label}>Categoría</label>
                            <select
                                className={styles.select}
                                value={categoryId}
                                onChange={e => setCategoryId(e.target.value)}
                            >
                                <option value="">Sin categoría</option>
                                {categories.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className={styles.modalActions}>
                        <button type="button" className={styles.cancelButton} onClick={onClose}>Cancelar</button>
                        <button type="submit" className={styles.saveButton} disabled={saving}>
                            {saving ? 'Guardando...' : 'Guardar Cambios'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
