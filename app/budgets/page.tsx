'use client';

import { useEffect, useState } from 'react';
import LayoutShell from '../components/dashboard/LayoutShell';
import BudgetCard from '../components/budgets/BudgetCard';
import CreateBudgetForm from '../components/budgets/CreateBudgetForm';
import EditBudgetModal from '../components/budgets/EditBudgetModal';
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

    const [editingBudget, setEditingBudget] = useState<any>(null);

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar este presupuesto?')) return;

        try {
            const res = await fetch(`/api/budgets?id=${id}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                fetchBudgets();
            } else {
                alert('Error al eliminar presupuesto');
            }
        } catch (error) {
            console.error(error);
            alert('Error al eliminar presupuesto');
        }
    };

    const handleUpdate = async (updatedBudget: any) => {
        const res = await fetch('/api/budgets', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: updatedBudget.id,
                amount: updatedBudget.amount,
                period: updatedBudget.period,
                enableCarryOver: updatedBudget.enableCarryOver
            })
        });

        if (res.ok) {
            fetchBudgets();
        } else {
            throw new Error('Failed to update');
        }
    };

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
                        <BudgetCard
                            key={budget.id}
                            budget={budget}
                            onEdit={() => setEditingBudget(budget)}
                            onDelete={() => handleDelete(budget.id)}
                        />
                    ))}
                </div>
            )}

            {editingBudget && (
                <EditBudgetModal
                    budget={editingBudget}
                    onClose={() => setEditingBudget(null)}
                    onSave={handleUpdate}
                />
            )}
        </LayoutShell>
    );
}
