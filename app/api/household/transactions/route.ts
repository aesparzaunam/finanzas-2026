import { getUserId } from '@/app/lib/api-utils';
import { NextResponse } from 'next/server';
import { getHouseholdByUserId, findUserById, getTransactions } from '@/app/lib/db';

// GET /api/household/transactions?month=YYYY-MM
export async function GET(request: Request) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { searchParams } = new URL(request.url);
        const month = searchParams.get('month');

        const household = await getHouseholdByUserId(userId);
        if (!household) return NextResponse.json({ error: 'No perteneces a ningún hogar' }, { status: 404 });
        if (household.status !== 'ACTIVE') return NextResponse.json({ error: 'El hogar no está activo' }, { status: 400 });

        const isOwner = userId === household.ownerId;
        const ownerUserId   = household.ownerId;
        const partnerUserId = household.partnerId;

        // Resolver nombres de ambos miembros
        const [owner, partner] = await Promise.all([
            findUserById(ownerUserId),
            partnerUserId ? findUserById(partnerUserId) : Promise.resolve(null),
        ]);
        const ownerName   = owner?.name   || 'Propietario';
        const partnerName = partner?.name || 'Pareja';

        // Rango de fechas
        let fromDate: string, toDate: string;
        if (month && /^\d{4}-\d{2}$/.test(month)) {
            const [year, mon] = month.split('-').map(Number);
            fromDate = `${year}-${String(mon).padStart(2, '0')}-01`;
            toDate   = `${year}-${String(mon).padStart(2, '0')}-31`;
        } else {
            const now = new Date();
            const y = now.getFullYear(), m = now.getMonth() + 1;
            fromDate = `${y}-${String(m).padStart(2, '0')}-01`;
            toDate   = `${y}-${String(m).padStart(2, '0')}-31`;
        }

        // Fetch transacciones de ambos miembros
        const [ownerResult, partnerResult] = await Promise.all([
            getTransactions(ownerUserId, { limit: 500, fromDate, toDate }),
            partnerUserId ? getTransactions(partnerUserId, { limit: 500, fromDate, toDate }) : Promise.resolve({ transactions: [], hasMore: false }),
        ]);

        const ownerTxs = ownerResult.transactions.map(tx => ({ ...tx, member: 'OWNER', memberName: ownerName }));
        const partnerTxs = partnerResult.transactions.map(tx => ({ ...tx, member: 'PARTNER', memberName: partnerName }));
        const combined = [...ownerTxs, ...partnerTxs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        return NextResponse.json({
            transactions: combined,
            ownerName, partnerName,
            userRole: isOwner ? 'OWNER' : 'PARTNER',
            month: month || new Date().toISOString().slice(0, 7),
        });
    } catch (error) {
        console.error('GET household/transactions:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
