import { NextResponse } from 'next/server';
import { db } from '@/app/lib/firebase';
import { getUserId, unauthorizedResponse, internalErrorResponse } from '@/app/lib/api-utils';

interface CategoryHint {
    categoryId: string;
    categoryName: string;
    categoryIcon: string;
    score: number; // how many times this combo has appeared
}

interface SuggestionMap {
    [normalizedDesc: string]: { [categoryId: string]: { name: string; icon: string; count: number } };
}

// GET /api/transactions/suggest-category?q=<description>
export async function GET(request: Request) {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorizedResponse();

        const { searchParams } = new URL(request.url);
        const query = searchParams.get('q')?.trim().toLowerCase() || '';

        if (query.length < 2) {
            return NextResponse.json([]);
        }

        // Fetch last 500 transactions to build a frequency map
        const [txSnap, catSnap] = await Promise.all([
            db.collection('users').doc(userId).collection('transactions')
                .where('type', 'in', ['EXPENSE', 'INCOME'])
                .orderBy('createdAt', 'desc')
                .limit(500)
                .get(),
            db.collection('users').doc(userId).collection('categories').get(),
        ]);

        const categories = new Map(catSnap.docs.map(d => [d.id, d.data()]));

        // Build frequency index: normalize description → categoryId → count
        const freqMap: SuggestionMap = {};

        txSnap.docs.forEach(doc => {
            const data = doc.data();
            if (!data.categoryId || !data.description) return;
            
            // Break description into words for partial matching
            const words: string[] = (String(data.description).toLowerCase()).split(/\s+/);
            const catData = categories.get(data.categoryId) as { name: string; icon: string } | undefined;
            if (!catData) return;

            words.forEach((word: string) => {
                if (word.length < 3) return;
                if (!freqMap[word]) freqMap[word] = {};
                if (!freqMap[word][data.categoryId]) {
                    freqMap[word][data.categoryId] = { name: catData.name, icon: catData.icon || '', count: 0 };
                }
                freqMap[word][data.categoryId].count++;
            });
        });

        // Score suggestions based on query words
        const queryWords = query.split(/\s+/).filter(w => w.length >= 2);
        const scoreMap: Map<string, CategoryHint> = new Map();

        queryWords.forEach(qWord => {
            // Exact prefix match gets higher weight
            Object.keys(freqMap).forEach(word => {
                if (word.startsWith(qWord) || qWord.startsWith(word)) {
                    const matchWeight = word === qWord ? 2 : 1;
                    Object.entries(freqMap[word]).forEach(([catId, catData]) => {
                        const existing = scoreMap.get(catId);
                        const addScore = catData.count * matchWeight;
                        if (existing) {
                            existing.score += addScore;
                        } else {
                            scoreMap.set(catId, {
                                categoryId: catId,
                                categoryName: catData.name,
                                categoryIcon: catData.icon,
                                score: addScore,
                            });
                        }
                    });
                }
            });
        });

        // Return top 3 suggestions sorted by score
        const suggestions = Array.from(scoreMap.values())
            .sort((a, b) => b.score - a.score)
            .slice(0, 3);

        return NextResponse.json(suggestions);
    } catch (error) {
        return internalErrorResponse('GET suggest-category', error);
    }
}
