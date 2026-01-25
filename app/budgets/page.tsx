'use client';

import { useEffect, useState } from 'react';
import LayoutShell from '../components/dashboard/LayoutShell';
import BudgetCard from '../components/budgets/BudgetCard';
import CreateBudgetForm from '../components/budgets/CreateBudgetForm';
import styles from '../components/budgets/budgets.module.css';
import dashStyles from '../components/dashboard/dashboard.module.css';

export default function BudgetsPage() {
    const [budgets, setBudgets] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchBudgets = async () => {
        try {
            const res = await fetch('/api/budgets');
            if (res.ok) {
                const data = await res.json();
                setBudgets(data);
            }
        } catch (error) {
            console.error('Failed to fetch budgets', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBudgets();
    }, []);

    return (
        <LayoutShell>
            <h1 className={dashStyles.pageTitle}>Presupuestos Mensuales</h1>

            <CreateBudgetForm onSuccess={fetchBudgets} />

            {loading ? (
                <div className={styles.loadingState}>Cargando presupuestos...</div>
            ) : budgets.length === 0 ? (
                <div className={styles.emptyState}>
                    <p>No hay presupuestos configurados. Comienza agregando un límite para una categoría.</p>
                </div>
            ) : (
                <div className={styles.grid}>
                    {budgets.map((budget: any) => (
                        <BudgetCard key={budget.id} budget={budget} />
                    ))}
                </div>
            )}
        </LayoutShell>
    );
}
