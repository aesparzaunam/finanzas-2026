import { getUserId } from '@/app/lib/api-utils';
import { NextResponse } from 'next/server';
import { getHouseholdByUserId, findUserById, getTransactions, getCategories } from '@/app/lib/db';
import { getLocalLLMClient, getLocalLLMModel, buildHouseholdNarrativePrompt } from '@/app/lib/ai-utils';

export const maxDuration = 120;

// GET /api/household/summary?month=YYYY-MM
export async function GET(request: Request) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { searchParams } = new URL(request.url);
        const month = searchParams.get('month') || new Date().toISOString().slice(0, 7);
        const [year, mon] = month.split('-').map(Number);
        const fromDate = `${year}-${String(mon).padStart(2, '0')}-01`;
        const toDate   = `${year}-${String(mon).padStart(2, '0')}-31`;

        const household = await getHouseholdByUserId(userId);
        if (!household) return NextResponse.json({ error: 'No perteneces a ningún hogar' }, { status: 404 });
        if (household.status !== 'ACTIVE') return NextResponse.json({ error: 'El hogar no está activo' }, { status: 400 });

        const ownerUserId   = household.ownerId;
        const partnerUserId = household.partnerId;

        const [owner, partner, ownerCats, partnerCats, ownerTxR, partnerTxR] = await Promise.all([
            findUserById(ownerUserId),
            partnerUserId ? findUserById(partnerUserId) : Promise.resolve(null),
            getCategories(ownerUserId),
            partnerUserId ? getCategories(partnerUserId) : Promise.resolve([]),
            getTransactions(ownerUserId, { limit: 500, fromDate, toDate }),
            partnerUserId ? getTransactions(partnerUserId, { limit: 500, fromDate, toDate }) : Promise.resolve({ transactions: [], hasMore: false }),
        ]);

        const ownerName   = owner?.name   || 'Propietario';
        const partnerName = partner?.name || 'Pareja';

        const catMap = new Map([...ownerCats, ...partnerCats].map(c => [c.id, { name: c.name, icon: c.icon }]));

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const breakdown = new Map<string, any>();
        const accumulate = (txs: typeof ownerTxR.transactions, role: 'owner' | 'partner') => {
            txs.filter(tx => ['EXPENSE', 'MSI_CHARGE'].includes(tx.type)).forEach(tx => {
                const catId   = tx.categoryId || 'uncategorized';
                const catInfo = catMap.get(catId) || { name: 'Sin categoría', icon: 'tag' };
                const amount  = Number(tx.amount) || 0;
                if (!breakdown.has(catId)) {
                    breakdown.set(catId, { categoryId: catId, categoryName: catInfo.name, categoryIcon: catInfo.icon, ownerAmount: 0, partnerAmount: 0 });
                }
                const entry = breakdown.get(catId);
                if (role === 'owner') entry.ownerAmount += amount;
                else entry.partnerAmount += amount;
            });
        };

        accumulate(ownerTxR.transactions, 'owner');
        accumulate(partnerTxR.transactions, 'partner');

        const byCategory = Array.from(breakdown.values()).sort((a, b) => (b.ownerAmount + b.partnerAmount) - (a.ownerAmount + a.partnerAmount));
        const totalOwner   = ownerTxR.transactions.filter(t => ['EXPENSE','MSI_CHARGE'].includes(t.type)).reduce((s, t) => s + Number(t.amount), 0);
        const totalPartner = partnerTxR.transactions.filter(t => ['EXPENSE','MSI_CHARGE'].includes(t.type)).reduce((s, t) => s + Number(t.amount), 0);
        const totalHousehold = totalOwner + totalPartner;
        const topCategories = byCategory.slice(0, 3).map(c => c.categoryName);

        // Narrativa con Ollama — prompt centralizado en ai-utils.ts
        let narrative = '';
        try {
            const monthName  = new Date(year, mon - 1, 1).toLocaleString('es-MX', { month: 'long', year: 'numeric' });
            const pct        = (n: number) => totalHousehold > 0 ? Math.round(n / totalHousehold * 100) : 0;
            const diffPct    = totalPartner > 0 ? Math.round(Math.abs(totalOwner - totalPartner) / totalPartner * 100) : 0;
            const whoMore    = totalOwner >= totalPartner ? ownerName : partnerName;
            const topCatsStr = byCategory.slice(0, 5).map(c =>
                `${c.categoryName}: $${(c.ownerAmount + c.partnerAmount).toFixed(2)} (${ownerName}: $${c.ownerAmount.toFixed(2)}, ${partnerName}: $${c.partnerAmount.toFixed(2)})`
            ).join(' | ');

            const dataContext = [
                `Mes analizado: ${monthName}`,
                `Gasto total del hogar: $${totalHousehold.toFixed(2)} MXN`,
                `${ownerName} gastó: $${totalOwner.toFixed(2)} (${pct(totalOwner)}% del total)`,
                `${partnerName} gastó: $${totalPartner.toFixed(2)} (${pct(totalPartner)}% del total)`,
                `Diferencia entre miembros: ${diffPct}% — ${whoMore} gastó más este mes`,
                `Categorías con mayor gasto: ${topCatsStr}`,
            ].join('\n');

            const client   = getLocalLLMClient();
            const model    = getLocalLLMModel();
            const llmResp = await client.chat.completions.create({
                model,
                temperature: 0.35,   // leve creatividad para narrativa natural
                max_tokens:  250,    // máx ~120 palabras
                messages: [
                    { role: 'system', content: buildHouseholdNarrativePrompt() },
                    { role: 'user',   content: `Genera el párrafo narrativo con estos datos reales del hogar:\n\n${dataContext}` },
                ],
            });
            narrative = llmResp.choices[0]?.message?.content?.trim() || '';
        } catch {
            narrative = totalHousehold > 0
                ? `En ${new Date(year, mon - 1, 1).toLocaleString('es-MX', { month: 'long' })}, el hogar registró un gasto total de $${totalHousehold.toFixed(2)} MXN. ${ownerName} aportó $${totalOwner.toFixed(2)} y ${partnerName} $${totalPartner.toFixed(2)}.`
                : 'Aún no hay transacciones registradas para este mes en el hogar.';
        }

        return NextResponse.json({ month, totalByMember: { owner: totalOwner, partner: totalPartner }, byCategory, topCategories, narrative, ownerName, partnerName });
    } catch (error) {
        console.error('GET household/summary:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
