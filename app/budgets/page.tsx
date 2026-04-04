'use client';

import { useEffect, useState } from 'react';
import LayoutShell from '../components/dashboard/LayoutShell';
import BudgetCard from '../components/budgets/BudgetCard';
import CreateBudgetForm from '../components/budgets/CreateBudgetForm';
import EditBudgetModal from '../components/budgets/EditBudgetModal';
import AiBudgetSuggestPanel from '../components/budgets/AiBudgetSuggestPanel';
import styles from '../components/budgets/budgets.module.css';
import dashStyles from '../components/dashboard/dashboard.module.css';

// Tipo mínimo que usa la página (BudgetCard acepta más campos pero estos son suficientes)
interface BudgetItem {
    id:              string;
    categoryId:      string;
    amount:          number;
    period:          string;
    spent:           number;
    remaining:       number;
    percentage:      number;
    totalAvailable:  number;
    carryOverAmount: number;
    enableCarryOver: boolean;
    category: {
        name:   string;
        icon?:  string;
        color?: string;
    };
}

export default function BudgetsPage() {
    const [budgets, setBudgets]           = useState<BudgetItem[]>([]);
    const [loading, setLoading]           = useState(true);
    const [editingBudget, setEditingBudget] = useState<BudgetItem | null>(null);

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

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar este presupuesto?')) return;
        try {
            const res = await fetch(`/api/budgets?id=${id}`, { method: 'DELETE' });
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

    const handleUpdate = async (updatedBudget: BudgetItem) => {
        const res = await fetch('/api/budgets', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: updatedBudget.id,
                amount: updatedBudget.amount,
                period: updatedBudget.period,
                enableCarryOver: updatedBudget.enableCarryOver,
            }),
        });
        if (res.ok) {
            fetchBudgets();
        } else {
            throw new Error('Failed to update');
        }
    };

    // Aplica sugerencia IA: actualiza si ya existe, crea si no
    const handleAiApply = async (categoryId: string, amount: number) => {
        const existing = budgets.find(b => b.categoryId === categoryId);
        if (existing) {
            await handleUpdate({ ...existing, amount });
        } else {
            await fetch('/api/budgets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ categoryId, amount, period: 'MONTHLY' }),
            });
            fetchBudgets();
        }
    };

    return (
        <LayoutShell>
            <div className={styles.budgetsPageHeader}>
                <h1 className={dashStyles.pageTitle}>Presupuestos Mensuales</h1>
                {/* Fin IA — Sugerencias de presupuesto basadas en historial */}
                <AiBudgetSuggestPanel onApply={handleAiApply} />
            </div>

            <CreateBudgetForm onSuccess={fetchBudgets} />

            {loading ? (
                <div className={styles.loadingState}>Cargando presupuestos...</div>
            ) : budgets.length === 0 ? (
                <div className={styles.emptyState}>
                    <p>No hay presupuestos configurados. Comienza agregando un límite para una categoría.</p>
                </div>
            ) : (
                <div className={styles.grid}>
                    {budgets.map((budget) => (
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
