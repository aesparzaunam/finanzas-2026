import { getUserId } from '@/app/lib/api-utils';
import { NextResponse } from 'next/server';
import { getTransactions, getCategories } from '@/app/lib/db';
import { categorizeSingle } from '@/app/lib/ai-utils';

// GET /api/transactions/suggest-category?q=<description>&ai=1
// - Sin ?ai=1  → solo historial (rápido, sin Ollama)
// - Con ?ai=1  → historial + fallback Ollama si < 2 resultados con score bajo
export async function GET(request: Request) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const query   = searchParams.get('q')?.trim().toLowerCase() || '';
    const useAi   = searchParams.get('ai') === '1';
    if (query.length < 2) return NextResponse.json([]);

    try {
        const [{ transactions }, categories] = await Promise.all([
            getTransactions(userId, { limit: 500 }),
            getCategories(userId),
        ]);

        const catMap = new Map(categories.map(c => [c.id, { name: c.name, icon: c.icon }]));

        // Mapa de frecuencias: descripción normalizada → categoryId → count
        const freq: Record<string, Record<string, { name: string; icon: string; count: number }>> = {};
        for (const tx of transactions) {
            if (!tx.description || !tx.categoryId) continue;
            const norm = tx.description.toLowerCase();
            if (!norm.includes(query)) continue;
            if (!freq[norm]) freq[norm] = {};
            const cat = catMap.get(tx.categoryId);
            if (!cat) continue;
            if (!freq[norm][tx.categoryId]) freq[norm][tx.categoryId] = { name: cat.name, icon: cat.icon, count: 0 };
            freq[norm][tx.categoryId].count++;
        }

        const agg: Record<string, { name: string; icon: string; score: number }> = {};
        for (const catCounts of Object.values(freq)) {
            for (const [catId, { name, icon, count }] of Object.entries(catCounts)) {
                if (!agg[catId]) agg[catId] = { name, icon, score: 0 };
                agg[catId].score += count;
            }
        }

        const suggestions = Object.entries(agg)
            .map(([categoryId, { name, icon, score }]) => ({
                categoryId,
                categoryName: name,
                categoryIcon: icon,
                score,
                source: 'history',
            }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 5);

        // Fallback a Ollama: solo si useAi=true Y el historial tiene < 2 resultados
        // con score bajo (ej. usuario nuevo o descripción desconocida).
        const highConfidenceFromHistory = suggestions.filter(s => s.score >= 2);
        if (useAi && highConfidenceFromHistory.length < 2 && categories.length > 0) {
            const aiResult = await categorizeSingle(query, categories.map(c => ({ id: c.id, name: c.name, icon: c.icon })));
            if (aiResult.categoryId && aiResult.confidence >= 0.5) {
                // Agregar resultado de IA si no está ya en el top
                const alreadyIn = suggestions.some(s => s.categoryId === aiResult.categoryId);
                if (!alreadyIn) {
                    suggestions.unshift({
                        categoryId:   aiResult.categoryId,
                        categoryName: aiResult.categoryName,
                        categoryIcon: categories.find(c => c.id === aiResult.categoryId)?.icon ?? 'tag',
                        score:        Math.round(aiResult.confidence * 10), // score proporcional a confianza
                        source:       'ai' as const,
                    });
                }
            }
        }

        return NextResponse.json(suggestions.slice(0, 5));
    } catch (error) {
        console.error('GET suggest-category:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
