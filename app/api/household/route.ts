import { getUserId } from '@/app/lib/api-utils';
import { NextResponse } from 'next/server';
import {
    findUserById, findUserByEmail,
    getHouseholdByUserId, createHousehold, updateHousehold
} from '@/app/lib/db';

// POST — crear invitación de hogar
export async function POST(request: Request) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { partnerEmail } = await request.json();
        if (!partnerEmail) return NextResponse.json({ error: 'partnerEmail requerido' }, { status: 400 });

        const owner = await findUserById(userId);
        if (!owner) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        if (owner.email?.toLowerCase() === partnerEmail.toLowerCase()) {
            return NextResponse.json({ error: 'No puedes invitarte a ti mismo' }, { status: 400 });
        }

        // Verificar que el owner no tenga ya un hogar
        const existingHousehold = await getHouseholdByUserId(userId);
        if (existingHousehold && existingHousehold.status === 'ACTIVE') {
            return NextResponse.json({ error: 'Ya perteneces a un hogar. Disuelve el actual primero.' }, { status: 409 });
        }

        // Buscar partner por email
        const partner = await findUserByEmail(partnerEmail.toLowerCase());
        if (!partner) {
            return NextResponse.json({ error: 'Usuario no encontrado. El invitado debe tener una cuenta activa.' }, { status: 404 });
        }

        const partnerHousehold = await getHouseholdByUserId(partner.id);
        if (partnerHousehold && partnerHousehold.status === 'ACTIVE') {
            return NextResponse.json({ error: 'El usuario invitado ya pertenece a otro hogar.' }, { status: 409 });
        }

        const household = await createHousehold(userId, partnerEmail.toLowerCase());
        return NextResponse.json({ ...household, partnerId: partner.id }, { status: 201 });
    } catch (error) {
        console.error('POST household:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// GET — estado del hogar del usuario
export async function GET() {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const household = await getHouseholdByUserId(userId);
    if (!household) return NextResponse.json(null);

    const role = household.ownerId === userId ? 'OWNER' : 'PARTNER';
    return NextResponse.json({ ...household, role });
}

// PATCH — aceptar/rechazar invitación
export async function PATCH(request: Request) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { action } = await request.json() as { action: 'accept' | 'reject' };

        const household = await getHouseholdByUserId(userId);
        if (!household || household.ownerId === userId) {
            return NextResponse.json({ error: 'No tienes invitación pendiente' }, { status: 400 });
        }
        if (household.status !== 'PENDING') {
            return NextResponse.json({ error: 'Invitación no encontrada o ya procesada' }, { status: 404 });
        }

        if (action === 'accept') {
            const updated = await updateHousehold(household.id, { status: 'ACTIVE', partnerId: userId });
            return NextResponse.json({ status: updated?.status });
        } else {
            const updated = await updateHousehold(household.id, { status: 'DISSOLVED' });
            return NextResponse.json({ status: updated?.status });
        }
    } catch (error) {
        console.error('PATCH household:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// DELETE — disolver hogar (solo OWNER)
export async function DELETE() {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const household = await getHouseholdByUserId(userId);
    if (!household || household.ownerId !== userId) {
        return NextResponse.json({ error: 'Solo el propietario puede disolver el hogar' }, { status: 403 });
    }

    await updateHousehold(household.id, { status: 'DISSOLVED' });
    return NextResponse.json({ success: true });
}
