'use client';

import { useState, useEffect } from 'react';
import styles from './budgets.module.css';

interface Category {
    id: string;
    name: string;
    type: string;
}

export default function CreateBudgetForm({ onSuccess }: { onSuccess: () => void }) {
    const [categories, setCategories] = useState<Category[]>([]);
    const [categoryId, setCategoryId] = useState('');
    const [amount, setAmount] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetch('/api/categories')
            .then(res => res.json())
            .then(data => {
                // Filter only EXPENSE categories
                if (Array.isArray(data)) {
                    setCategories(data.filter((c: Category) => c.type === 'EXPENSE'));
                }
            });
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch('/api/budgets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    categoryId,
                    amount: Number(amount),
                    period: 'MONTHLY' // Default for now
                })
            });

            if (res.ok) {
                setAmount('');
                setCategoryId('');
                onSuccess();
            } else {
                alert('Failed to create budget');
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.formGroup}>
                <label className={styles.label}>Category</label>
                <select
                    id="category-select"
                    className={styles.select}
                    value={categoryId}
                    title="Select Category"
                    onChange={(e) => setCategoryId(e.target.value)}
                    required
                >
                    <option value="">Select Category</option>
                    {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
            </div>

            <div className={styles.formGroup}>
                <label className={styles.label}>Monthly Limit</label>
                <input
                    type="number"
                    className={styles.input}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 500"
                    required
                    min="1"
                />
            </div>

            <button type="submit" className={styles.button} disabled={loading}>
                {loading ? 'Adding...' : 'Set Budget'}
            </button>
        </form>
    );
}
