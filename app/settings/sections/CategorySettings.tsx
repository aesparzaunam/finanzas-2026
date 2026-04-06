'use client';

import { useState, useEffect, useCallback } from 'react';
import { Tag, Plus, Pencil, Trash2, Check, X, RotateCcw } from 'lucide-react';
import styles from '../settings.module.css';
import catStyles from './categories.module.css';

const ICON_OPTIONS = ['tag','home','food','car','zap','heart','film','shopping','utensils','shirt','book','laptop','money','globe','music','gift','coffee','phone','plane','gym'];
const COLOR_OPTIONS = ['#ef4444','#f59e0b','#10b981','#3b82f6','#6366f1','#8b5cf6','#ec4899','#14b8a6','#f97316','#eab308','#a855f7','#0ea5e9','#64748b','#92aaff','#c084fc','#34d399'];

interface Category {
    id: string;
    name: string;
    type: 'INCOME' | 'EXPENSE';
    icon: string;
    color: string;
}

const emptyForm = { name: '', type: 'EXPENSE' as 'INCOME'|'EXPENSE', icon: 'tag', color: '#92aaff' };

export default function CategorySettings() {
    const [cats, setCats]       = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [editId, setEditId]   = useState<string | null>(null);
    const [form, setForm]       = useState(emptyForm);
    const [showNew, setShowNew] = useState(false);
    const [error, setError]     = useState('');
    const [saving, setSaving]   = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        const r = await fetch('/api/categories');
        const data = await r.json();
        setCats(Array.isArray(data) ? data : []);
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    const startEdit = (cat: Category) => {
        setEditId(cat.id);
        setForm({ name: cat.name, type: cat.type, icon: cat.icon, color: cat.color });
        setShowNew(false);
        setError('');
    };

    const cancelEdit = () => { setEditId(null); setForm(emptyForm); setError(''); };

    const saveEdit = async () => {
        if (!form.name.trim()) { setError('El nombre es requerido'); return; }
        setSaving(true);
        const r = await fetch('/api/categories', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: editId, name: form.name, icon: form.icon, color: form.color }),
        });
        setSaving(false);
        if (r.ok) { setEditId(null); setForm(emptyForm); load(); }
        else { const d = await r.json(); setError(d.error || 'Error al guardar'); }
    };

    const saveNew = async () => {
        if (!form.name.trim()) { setError('El nombre es requerido'); return; }
        setSaving(true);
        const r = await fetch('/api/categories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form),
        });
        setSaving(false);
        if (r.ok) { setShowNew(false); setForm(emptyForm); setError(''); load(); }
        else { const d = await r.json(); setError(d.error || 'Error al crear'); }
    };

    const deleteCat = async (id: string) => {
        if (!confirm('¿Eliminar esta categoría?')) return;
        const r = await fetch(`/api/categories?id=${id}`, { method: 'DELETE' });
        if (r.ok) load();
        else { const d = await r.json(); alert(d.error || 'No se pudo eliminar'); }
    };

    const income  = cats.filter(c => c.type === 'INCOME');
    const expense = cats.filter(c => c.type === 'EXPENSE');

    return (
        <div className={styles.card}>
            <div className={styles.rowHeader}>
                <h2 className={`${styles.cardTitle} ${styles.cardTitleFlat}`}>
                    <Tag size={14} className={styles.inlineIcon} />Categorías
                </h2>
                <button
                    className={styles.btnPrimary}
                    onClick={() => { setShowNew(true); setEditId(null); setForm(emptyForm); setError(''); }}
                >
                    <Plus size={14} /> Nueva
                </button>
            </div>

            <div className={catStyles.divider} />

            {/* Formulario nueva categoría */}
            {showNew && (
                <div className={catStyles.formCard}>
                    <p className={catStyles.formTitle}>Nueva Categoría</p>
                    <CategoryForm form={form} setForm={setForm} error={error} />
                    <div className={catStyles.formActions}>
                        <button className={styles.btnPrimary} onClick={saveNew} disabled={saving}>
                            <Check size={14} /> {saving ? 'Guardando...' : 'Crear'}
                        </button>
                        <button className={styles.btnSecondary} onClick={() => { setShowNew(false); setError(''); }}>
                            <X size={14} /> Cancelar
                        </button>
                    </div>
                </div>
            )}

            {loading ? <p className={styles.fieldDesc}>Cargando categorías...</p> : (
                <>
                    <CategoryGroup
                        title="Ingresos" emoji="⬆️" cats={income}
                        editId={editId} form={form} setForm={setForm}
                        onEdit={startEdit} onCancel={cancelEdit} onSave={saveEdit}
                        onDelete={deleteCat} saving={saving} error={error}
                    />
                    <CategoryGroup
                        title="Gastos" emoji="⬇️" cats={expense}
                        editId={editId} form={form} setForm={setForm}
                        onEdit={startEdit} onCancel={cancelEdit} onSave={saveEdit}
                        onDelete={deleteCat} saving={saving} error={error}
                    />
                </>
            )}

            {/* Restaurar por defecto */}
            <div className={styles.padTop}>
                <button
                    className={styles.btnSecondary}
                    onClick={async () => {
                        if (!confirm('¿Restaurar las categorías por defecto? Solo se añadirán las que falten.')) return;
                        await fetch('/api/categories/reset', { method: 'POST' });
                        load();
                    }}
                >
                    <RotateCcw size={14} /> Restaurar por defecto
                </button>
            </div>
        </div>
    );
}

/* ── Sub-components ── */
function CategoryGroup({
    title, emoji, cats, editId, form, setForm, onEdit, onCancel, onSave, onDelete, saving, error
}: {
    title: string; emoji: string; cats: Category[];
    editId: string | null; form: typeof emptyForm; setForm: (f: typeof emptyForm) => void;
    onEdit: (c: Category) => void; onCancel: () => void; onSave: () => void;
    onDelete: (id: string) => void; saving: boolean; error: string;
}) {
    return (
        <div>
            <p className={catStyles.groupTitle}>{emoji} {title}</p>
            <div className={catStyles.list}>
                {cats.length === 0 && <p className={catStyles.empty}>Sin categorías</p>}
                {cats.map(cat => (
                    <div key={cat.id}>
                        {editId === cat.id ? (
                            <div className={catStyles.formCard}>
                                <CategoryForm form={form} setForm={setForm} error={error} />
                                <div className={catStyles.formActions}>
                                    <button className={styles.btnPrimary} onClick={onSave} disabled={saving}>
                                        <Check size={14} /> {saving ? '...' : 'Guardar'}
                                    </button>
                                    <button className={styles.btnSecondary} onClick={onCancel}>
                                        <X size={14} /> Cancelar
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className={catStyles.row}>
                                <div className={catStyles.catDot} style={{ '--cat-color': cat.color } as React.CSSProperties} />
                                <span className={catStyles.catIcon}>{cat.icon}</span>
                                <span className={catStyles.catName}>{cat.name}</span>
                                <div className={catStyles.rowActions}>
                                    <button className={catStyles.iconBtn} onClick={() => onEdit(cat)} aria-label={`Editar ${cat.name}`}>
                                        <Pencil size={14} />
                                    </button>
                                    <button className={`${catStyles.iconBtn} ${catStyles.iconBtnDanger}`} onClick={() => onDelete(cat.id)} aria-label={`Eliminar ${cat.name}`}>
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

function CategoryForm({ form, setForm, error }: {
    form: typeof emptyForm;
    setForm: (f: typeof emptyForm) => void;
    error: string;
}) {
    return (
        <div className={catStyles.formFields}>
            <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="cat-name">Nombre</label>
                <input
                    id="cat-name"
                    className={styles.fieldInput}
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder="Ej. Supermercado"
                />
                {error && <span className={styles.statusErr}>{error}</span>}
            </div>

            <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="cat-type">Tipo</label>
                <select
                    id="cat-type"
                    className={styles.fieldSelect}
                    value={form.type}
                    onChange={e => setForm({ ...form, type: e.target.value as 'INCOME'|'EXPENSE' })}
                >
                    <option value="EXPENSE">Gasto</option>
                    <option value="INCOME">Ingreso</option>
                </select>
            </div>

            {/* Color swatches */}
            <div className={styles.field}>
                <label className={styles.fieldLabel}>Color</label>
                <div className={catStyles.swatches}>
                    {COLOR_OPTIONS.map(c => (
                        <button
                            key={c}
                            className={form.color === c ? `${catStyles.swatch} ${catStyles.swatchActive}` : catStyles.swatch}
                            style={{ '--swatch-color': c } as React.CSSProperties}
                            onClick={() => setForm({ ...form, color: c })}
                            aria-label={`Color ${c}`}
                        />
                    ))}
                </div>
            </div>

            {/* Icon chips */}
            <div className={styles.field}>
                <label className={styles.fieldLabel}>Ícono</label>
                <div className={catStyles.iconChips}>
                    {ICON_OPTIONS.map(ic => (
                        <button
                            key={ic}
                            className={form.icon === ic ? `${catStyles.iconChip} ${catStyles.iconChipActive}` : catStyles.iconChip}
                            onClick={() => setForm({ ...form, icon: ic })}
                        >
                            {ic}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
