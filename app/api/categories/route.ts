import { getUserId } from '@/app/lib/api-utils';
import { NextResponse } from 'next/server';
import {
    getCategories, createCategory, updateCategory, deleteCategory, getCategoryById, countByCategoryId
} from '@/app/lib/db';

const DEFAULT_CATEGORIES = [
    { name: 'Salario', type: 'INCOME', icon: 'money', color: '#10b981' },
    { name: 'Freelance', type: 'INCOME', icon: 'laptop', color: '#3b82f6' },
    { name: 'Vivienda', type: 'EXPENSE', icon: 'home', color: '#ef4444' },
    { name: 'Comida', type: 'EXPENSE', icon: 'food', color: '#f59e0b' },
    { name: 'Transporte', type: 'EXPENSE', icon: 'car', color: '#6366f1' },
    { name: 'Servicios', type: 'EXPENSE', icon: 'zap', color: '#8b5cf6' },
    { name: 'Salud', type: 'EXPENSE', icon: 'heart', color: '#ec4899' },
    { name: 'Entretenimiento', type: 'EXPENSE', icon: 'film', color: '#14b8a6' },
    { name: 'Supermercado', type: 'EXPENSE', icon: 'shopping', color: '#f97316' },
    { name: 'Restaurantes', type: 'EXPENSE', icon: 'utensils', color: '#eab308' },
    { name: 'Ropa', type: 'EXPENSE', icon: 'shirt', color: '#a855f7' },
    { name: 'Educación', type: 'EXPENSE', icon: 'book', color: '#0ea5e9' },
];

export async function GET() {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let categories = await getCategories(userId);

    if (categories.length === 0) {
        // Seed categorías por defecto
        await Promise.all(
            DEFAULT_CATEGORIES.map(c => createCategory(userId, c))
        );
        categories = await getCategories(userId);
    }

    return NextResponse.json(categories);
}

export async function POST(request: Request) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { name, type, icon, color } = await request.json();
        if (!name || !type) {
            return NextResponse.json({ error: 'Missing required fields: name, type' }, { status: 400 });
        }
        if (!['INCOME', 'EXPENSE'].includes(type)) {
            return NextResponse.json({ error: 'Invalid type. Use INCOME or EXPENSE' }, { status: 400 });
        }

        const all = await getCategories(userId);
        const dup = all.find(c => c.name.toLowerCase() === name.trim().toLowerCase());
        if (dup) {
            return NextResponse.json({ error: 'Ya existe una categoría con ese nombre' }, { status: 409 });
        }

        const category = await createCategory(userId, {
            name: name.trim(), type, icon: icon || 'tag', color: color || '#64748b'
        });
        return NextResponse.json(category, { status: 201 });
    } catch (error) {
        console.error('POST Category:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { id, name, icon, color } = await request.json();
        if (!id) return NextResponse.json({ error: 'Category ID is required' }, { status: 400 });

        const existing = await getCategoryById(id, userId);
        if (!existing) return NextResponse.json({ error: 'Category not found' }, { status: 404 });

        if (name !== undefined) {
            const all = await getCategories(userId);
            const dup = all.find(c => c.id !== id && c.name.toLowerCase() === name.trim().toLowerCase());
            if (dup) return NextResponse.json({ error: 'Ya existe otra categoría con ese nombre' }, { status: 409 });
        }

        const updated = await updateCategory(id, userId, {
            name: name !== undefined ? name.trim() : existing.name,
            icon: icon !== undefined ? icon : existing.icon,
            color: color !== undefined ? color : existing.color,
        });
        return NextResponse.json(updated);
    } catch (error) {
        console.error('PUT Category:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Category ID is required' }, { status: 400 });

    try {
        const existing = await getCategoryById(id, userId);
        if (!existing) return NextResponse.json({ error: 'Category not found' }, { status: 404 });

        const { countByCategoryId } = await import('@/app/lib/db');
        const txCount = await countByCategoryId('NTransaction', id, userId);
        const budgetCount = await countByCategoryId('Budget', id, userId);

        if (txCount > 0) {
            return NextResponse.json({ error: 'No se puede eliminar: hay transacciones que usan esta categoría.' }, { status: 400 });
        }
        if (budgetCount > 0) {
            return NextResponse.json({ error: 'No se puede eliminar: hay un presupuesto asignado. Elimina el presupuesto primero.' }, { status: 400 });
        }

        await deleteCategory(id, userId);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('DELETE Category:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
