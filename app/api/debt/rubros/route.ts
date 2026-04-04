import { getUserId } from '@/app/lib/api-utils';
import { NextResponse } from 'next/server';
import { getTransactions, getCategories } from '@/app/lib/db';
import { startOfMonth, subMonths } from 'date-fns';

const RUBROS: { id: string; label: string; color: string; keywords: string[]; maxAmount?: number }[] = [
    { id: 'inmobiliaria', label: 'Gestión Inmobiliaria', color: '#6366f1', keywords: ['renta', 'hipoteca', 'predial', 'mantenimiento', 'condominio', 'departamento', 'casa', 'propiedad'] },
    { id: 'desarrollo', label: 'Desarrollo Personal', color: '#10b981', keywords: ['curso', 'libro', 'gym', 'gimnasio', 'terapia', 'capacitacion', 'educacion', 'escuela', 'universidad', 'coaching'] },
    { id: 'animal', label: 'Cuidado Animal', color: '#f59e0b', keywords: ['veterinario', 'mascota', 'perro', 'gato', 'alimento animal', 'medicamento mascota', 'peluqueria', 'grooming'] },
    { id: 'movilidad', label: 'Movilidad UNAM', color: '#3b82f6', keywords: ['gasolina', 'transporte', 'uber', 'didi', 'metro', 'camion', 'unam', 'estacionamiento', 'taxi', 'autobus', 'caseta'] },
];

function classifyTransaction(description: string, categoryName: string, amount: number): string {
    const text = `${description} ${categoryName}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    for (const rubro of RUBROS) {
        if (rubro.keywords.some(kw => text.includes(kw))) {
            if (rubro.maxAmount && amount > rubro.maxAmount) continue;
            return rubro.id;
        }
    }
    if (amount < 500) return 'hormiga';
    return 'otros';
}

export async function GET(request: Request) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const url = new URL(request.url);
        const monthsBack = parseInt(url.searchParams.get('months') || '1', 10);
        const now = new Date();
        const periodStart = startOfMonth(subMonths(now, monthsBack - 1)).toISOString().slice(0, 10);

        const [{ transactions }, categories] = await Promise.all([
            getTransactions(userId, { limit: 1000, fromDate: periodStart, type: 'EXPENSE' }),
            getCategories(userId),
        ]);

        const categoryMap = new Map(categories.map(c => [c.id, c.name]));
        const validTxs = transactions.filter(tx => !tx.isParent);

        const allRubroIds = [...RUBROS.map(r => r.id), 'hormiga', 'otros'];
        const rubroMap: Record<string, { total: number; count: number; transactions: { desc: string; amount: number }[] }> = {};
        allRubroIds.forEach(id => { rubroMap[id] = { total: 0, count: 0, transactions: [] }; });

        validTxs.forEach(tx => {
            const catName = tx.categoryId ? (categoryMap.get(tx.categoryId) || '') : '';
            const rubroId = classifyTransaction(tx.description || '', catName, Number(tx.amount));
            rubroMap[rubroId].total += Number(tx.amount);
            rubroMap[rubroId].count++;
            if (rubroMap[rubroId].transactions.length < 5) {
                rubroMap[rubroId].transactions.push({ desc: tx.description || catName, amount: Number(tx.amount) });
            }
        });

        const totalGastos = validTxs.reduce((s, t) => s + Number(t.amount), 0);

        const rubros = [
            ...RUBROS.map(r => ({ id: r.id, label: r.label, color: r.color, total: Math.round(rubroMap[r.id].total * 100) / 100, count: rubroMap[r.id].count, percentage: totalGastos > 0 ? Math.round((rubroMap[r.id].total / totalGastos) * 10000) / 100 : 0, topTransactions: rubroMap[r.id].transactions })),
            { id: 'hormiga', label: 'Gastos Hormiga', color: '#ef4444', total: Math.round(rubroMap['hormiga'].total * 100) / 100, count: rubroMap['hormiga'].count, percentage: totalGastos > 0 ? Math.round((rubroMap['hormiga'].total / totalGastos) * 10000) / 100 : 0, topTransactions: rubroMap['hormiga'].transactions },
            { id: 'otros', label: 'Otros', color: '#64748b', total: Math.round(rubroMap['otros'].total * 100) / 100, count: rubroMap['otros'].count, percentage: totalGastos > 0 ? Math.round((rubroMap['otros'].total / totalGastos) * 10000) / 100 : 0, topTransactions: rubroMap['otros'].transactions },
        ].filter(r => r.total > 0);

        return NextResponse.json({ period: { start: periodStart, months: monthsBack }, totalGastos: Math.round(totalGastos * 100) / 100, rubros });
    } catch (error) {
        console.error('GET debt/rubros:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
