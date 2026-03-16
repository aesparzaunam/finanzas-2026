import { NextResponse } from 'next/server';
import { db } from '@/app/lib/firebase';
import { getUserId, unauthorizedResponse, internalErrorResponse, missingFieldsResponse, notFoundResponse } from '@/app/lib/api-utils';
import { AccountAccess, AccountRole } from '@/app/lib/types';

/**
 * FASE 3: Gestión de accesos a cuentas compartidas
 *
 * Colección: users/{ownerId}/accounts/{accountId}/access/{accessId}
 *
 * Reglas:
 * - Solo el OWNER puede otorgar/revocar accesos
 * - El Net Worth personal solo incluye cuentas donde userId === ownerId
 * - Un VIEWER/EDITOR ve las transacciones de esa cuenta compartida
 */

// GET /api/accounts/access?accountId=xxx — Listar accesos de una cuenta
export async function GET(request: Request) {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorizedResponse();

        const { searchParams } = new URL(request.url);
        const accountId = searchParams.get('accountId');
        if (!accountId) return missingFieldsResponse(['accountId']);

        // Verificar que el usuario es el owner
        const accountDoc = await db.collection('users').doc(userId).collection('accounts').doc(accountId).get();
        if (!accountDoc.exists) return notFoundResponse('Account');

        const accessSnap = await db
            .collection('users').doc(userId)
            .collection('accounts').doc(accountId)
            .collection('access')
            .orderBy('createdAt', 'desc')
            .get();

        const accesses = accessSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        return NextResponse.json(accesses);
    } catch (error) {
        return internalErrorResponse('GET AccountAccess', error);
    }
}

// POST /api/accounts/access — Grants access to another user
export async function POST(request: Request) {
    try {
        const userId = await getUserId(); // Este es el OWNER
        if (!userId) return unauthorizedResponse();

        const { accountId, targetUserId, role } = await request.json();

        if (!accountId || !targetUserId || !role) {
            return missingFieldsResponse(['accountId', 'targetUserId', 'role']);
        }

        const validRoles: AccountRole[] = ['EDITOR', 'VIEWER']; // OWNER no se otorga
        if (!validRoles.includes(role as AccountRole)) {
            return NextResponse.json({ error: 'Role inválido. Usa EDITOR o VIEWER.' }, { status: 400 });
        }

        if (targetUserId === userId) {
            return NextResponse.json({ error: 'No puedes otorgarte acceso a ti mismo.' }, { status: 400 });
        }

        // Verificar que la cuenta existe y pertenece al caller
        const accountRef = db.collection('users').doc(userId).collection('accounts').doc(accountId);
        const accountDoc = await accountRef.get();
        if (!accountDoc.exists) return notFoundResponse('Account');

        // Marcar la cuenta como compartida
        await accountRef.update({ isShared: true, updatedAt: new Date().toISOString() });

        // Crear el registro de acceso
        const accessRef = accountRef.collection('access').doc();
        const accessData: AccountAccess = {
            id: accessRef.id,
            userId: targetUserId,
            accountId,
            role: role as AccountRole,
            grantedBy: userId,
            createdAt: new Date().toISOString(),
        };
        await accessRef.set(accessData);

        // También registrar en la colección del usuario invitado para lookup inverso
        await db.collection('users').doc(targetUserId)
            .collection('sharedAccountRefs')
            .doc(`${userId}_${accountId}`)
            .set({
                ownerUserId: userId,
                accountId,
                accessId: accessRef.id,
                role,
                createdAt: new Date().toISOString(),
            });

        return NextResponse.json(accessData, { status: 201 });
    } catch (error) {
        return internalErrorResponse('POST AccountAccess', error);
    }
}

// DELETE /api/accounts/access?accountId=xxx&accessId=yyy — Revoke access
export async function DELETE(request: Request) {
    try {
        const userId = await getUserId(); // OWNER quien revoca
        if (!userId) return unauthorizedResponse();

        const { searchParams } = new URL(request.url);
        const accountId = searchParams.get('accountId');
        const accessId = searchParams.get('accessId');

        if (!accountId || !accessId) return missingFieldsResponse(['accountId', 'accessId']);

        const accessRef = db
            .collection('users').doc(userId)
            .collection('accounts').doc(accountId)
            .collection('access').doc(accessId);

        const accessDoc = await accessRef.get();
        if (!accessDoc.exists) return notFoundResponse('AccountAccess');

        const accessData = accessDoc.data() as AccountAccess;

        // Revocar
        await accessRef.delete();

        // Limpiar ref inversa del usuario invitado
        await db.collection('users').doc(accessData.userId)
            .collection('sharedAccountRefs')
            .doc(`${userId}_${accountId}`)
            .delete();

        // Si no quedan accesos, marcar como no compartida
        const remainingSnap = await db
            .collection('users').doc(userId)
            .collection('accounts').doc(accountId)
            .collection('access')
            .limit(1)
            .get();

        if (remainingSnap.empty) {
            await db.collection('users').doc(userId).collection('accounts').doc(accountId)
                .update({ isShared: false, updatedAt: new Date().toISOString() });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        return internalErrorResponse('DELETE AccountAccess', error);
    }
}
