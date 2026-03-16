import { NextResponse } from 'next/server';
import { db } from '@/app/lib/firebase';
import { getUserId, unauthorizedResponse, internalErrorResponse } from '@/app/lib/api-utils';
import { Transaction } from '@/app/lib/types';
import { startOfMonth, subMonths } from 'date-fns';

/**
 * FASE 4: Clasificación de Gastos en Rubros Personalizados
 *
 * Rubros del usuario:
 * 1. Gestión Inmobiliaria  — keywords: renta, hipoteca, predial, mantenimiento, condominio
 * 2. Desarrollo Personal   — keywords: curso, libro, gym, terapia, capacitación, educación
 * 3. Cuidado Animal        — keywords: veterinario, mascota, comida animal, alimento perro, alimento gato
 * 4. Movilidad UNAM        — keywords: gasolina, transporte, uber, metro, camión, unam, estacionamiento
 * 5. Gastos Hormiga        — cualquier EXPENSE < $500 MXN que no encaje en otro rubro
 * 6. Otros                 — lo que no clasifica en ningún rubro
 */

const RUBROS: {
    id: string;
    label: string;
    color: string;
    keywords: string[];
    maxAmount?: number; // Si se define, también filtra por monto
}[] = [
    {
        id: 'inmobiliaria',
        label: 'Gestión Inmobiliaria',
        color: '#6366f1',
        keywords: ['renta', 'hipoteca', 'predial', 'mantenimiento', 'condominio', 'departamento', 'casa', 'propiedad'],
    },
    {
        id: 'desarrollo',
        label: 'Desarrollo Personal',
        color: '#10b981',
        keywords: ['curso', 'libro', 'gym', 'gimnasio', 'terapia', 'capacitacion', 'educacion', 'escuela', 'universidad', 'coaching'],
    },
    {
        id: 'animal',
        label: 'Cuidado Animal',
        color: '#f59e0b',
        keywords: ['veterinario', 'mascota', 'perro', 'gato', 'alimento animal', 'medicamento mascota', 'peluqueria', 'grooming'],
    },
    {
        id: 'movilidad',
        label: 'Movilidad UNAM',
        color: '#3b82f6',
        keywords: ['gasolina', 'transporte', 'uber', 'didi', 'metro', 'camion', 'unam', 'estacionamiento', 'taxi', 'autobus', 'caseta'],
    },
];

function classifyTransaction(tx: Transaction, categoryName: string): string {
    const textToSearch = `${tx.description} ${categoryName}`.toLowerCase()
        // Normalizar tildes
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    for (const rubro of RUBROS) {
        if (rubro.keywords.some(kw => textToSearch.includes(kw))) {
            // Si tiene maxAmount, verificar
            if (rubro.maxAmount && tx.amount > rubro.maxAmount) continue;
            return rubro.id;
        }
    }

    // Gastos Hormiga: EXPENSE < $500 sin clasificar
    if (tx.type === 'EXPENSE' && tx.amount < 500) {
        return 'hormiga';
    }

    return 'otros';
}

export async function GET(request: Request) {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorizedResponse();

        const url = new URL(request.url);
        const monthsBack = parseInt(url.searchParams.get('months') || '1', 10);

        const now = new Date();
        const periodStart = startOfMonth(subMonths(now, monthsBack - 1)).toISOString();

        // Obtener transacciones y categorías en paralelo
        const [txSnap, catSnap] = await Promise.all([
            db.collection('users').doc(userId).collection('transactions')
                .where('date', '>=', periodStart)
                .where('type', '==', 'EXPENSE')
                .get(),
            db.collection('users').doc(userId).collection('categories').get(),
        ]);

        const categoryMap = new Map(catSnap.docs.map(d => [d.id, d.data().name as string]));
        const transactions = txSnap.docs.map(d => d.data() as Transaction).filter(tx => !tx.isParent);

        // Agrupar por rubro
        const rubroMap: Record<string, { total: number; count: number; transactions: { desc: string; amount: number }[] }> = {};

        const allRubroIds = [...RUBROS.map(r => r.id), 'hormiga', 'otros'];
        allRubroIds.forEach(id => { rubroMap[id] = { total: 0, count: 0, transactions: [] }; });

        transactions.forEach(tx => {
            const catName = tx.categoryId ? (categoryMap.get(tx.categoryId) || '') : '';
            const rubroId = classifyTransaction(tx, catName);
            rubroMap[rubroId].total += tx.amount;
            rubroMap[rubroId].count++;
            if (rubroMap[rubroId].transactions.length < 5) {
                rubroMap[rubroId].transactions.push({ desc: tx.description || catName, amount: tx.amount });
            }
        });

        const totalGastos = transactions.reduce((s, t) => s + t.amount, 0);

        const rubros = [
            ...RUBROS.map(r => ({
                id: r.id,
                label: r.label,
                color: r.color,
                total: Math.round(rubroMap[r.id].total * 100) / 100,
                count: rubroMap[r.id].count,
                percentage: totalGastos > 0 ? Math.round((rubroMap[r.id].total / totalGastos) * 10000) / 100 : 0,
                topTransactions: rubroMap[r.id].transactions,
            })),
            {
                id: 'hormiga',
                label: 'Gastos Hormiga',
                color: '#ef4444',
                total: Math.round(rubroMap['hormiga'].total * 100) / 100,
                count: rubroMap['hormiga'].count,
                percentage: totalGastos > 0 ? Math.round((rubroMap['hormiga'].total / totalGastos) * 10000) / 100 : 0,
                topTransactions: rubroMap['hormiga'].transactions,
            },
            {
                id: 'otros',
                label: 'Otros',
                color: '#64748b',
                total: Math.round(rubroMap['otros'].total * 100) / 100,
                count: rubroMap['otros'].count,
                percentage: totalGastos > 0 ? Math.round((rubroMap['otros'].total / totalGastos) * 10000) / 100 : 0,
                topTransactions: rubroMap['otros'].transactions,
            },
        ].filter(r => r.total > 0); // Solo mostrar rubros con gastos

        return NextResponse.json({
            period: { start: periodStart, months: monthsBack },
            totalGastos: Math.round(totalGastos * 100) / 100,
            rubros,
        });

    } catch (error) {
        return internalErrorResponse('GET Debt Rubros', error);
    }
}
