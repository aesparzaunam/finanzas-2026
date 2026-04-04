import { NextResponse } from 'next/server';
import { getUserId } from '@/app/lib/api-utils';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Database = require('better-sqlite3');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path');

interface CategoryForecast {
    categoryId:   string;
    categoryName: string;
    avg3m:        number;   // promedio 3 meses
    trend:        number;   // % cambio mes a mes reciente
    forecast:     number;   // predicción próximo mes
    confidence:   'HIGH' | 'MEDIUM' | 'LOW';
}

interface ForecastSummary {
    totalForecast:   number;
    totalIncome:     number;       // promedio ingresos últimos 3 meses
    projectedSavings: number;
    byCategory:      CategoryForecast[];
    generatedAt:     string;
}

// GET /api/dashboard/forecast
export async function GET() {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const dbPath = (process.env.DATABASE_URL ?? '').replace('file:', '') ||
        path.join(process.cwd(), 'prisma', 'finanzas.db');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db: any = Database(dbPath);

    try {
        const now   = new Date();
        const months = [-3, -2, -1].map(offset => {
            const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
            return d.toISOString().slice(0, 7);
        });

        // ── Gastos por categoría en últimos 3 meses ──────────────────────────
        interface TxRow { categoryId: string; categoryName: string; month: string; total: number; }
        
        // Try with categoryId JOIN first, fallback to plain sum
        let catRows: TxRow[] = [];
        try {
            catRows = db.prepare(`
                SELECT
                    t.categoryId,
                    COALESCE(c.name, 'Sin categoría') AS categoryName,
                    substr(t.date, 1, 7)              AS month,
                    SUM(t.amount)                     AS total
                FROM NTransaction t
                LEFT JOIN Category c ON c.id = t.categoryId
                WHERE t.userId = ?
                  AND t.type IN ('EXPENSE', 'MSI_CHARGE')
                  AND substr(t.date, 1, 7) IN (?, ?, ?)
                GROUP BY t.categoryId, substr(t.date, 1, 7)
                ORDER BY t.categoryId, month
            `).all(userId, ...months) as TxRow[];
        } catch {
            // Fallback: sin JOIN (schema mínimo)
            catRows = db.prepare(`
                SELECT
                    categoryId,
                    'Sin categoría'            AS categoryName,
                    substr(date, 1, 7)         AS month,
                    SUM(amount)                AS total
                FROM NTransaction
                WHERE userId = ?
                  AND type IN ('EXPENSE', 'MSI_CHARGE')
                  AND substr(date, 1, 7) IN (?, ?, ?)
                GROUP BY categoryId, substr(date, 1, 7)
                ORDER BY categoryId, month
            `).all(userId, ...months) as TxRow[];
        }

        // ── Agrupar por categoría ────────────────────────────────────────────
        const byCategory = new Map<string, { name: string; monthly: number[] }>();
        for (const row of catRows) {
            if (!byCategory.has(row.categoryId)) {
                byCategory.set(row.categoryId, { name: row.categoryName, monthly: [] });
            }
            byCategory.get(row.categoryId)!.monthly.push(row.total);
        }

        const forecasts: CategoryForecast[] = [];
        for (const [catId, data] of byCategory.entries()) {
            const m = data.monthly;
            if (m.length === 0) continue;

            const avg3m = m.reduce((a, b) => a + b, 0) / m.length;

            // Tendencia: diferencia porcentual entre último y primer mes registrado
            const trend = m.length >= 2
                ? ((m[m.length - 1] - m[0]) / (m[0] || 1)) * 100
                : 0;

            // Forecast: promedio + extrapolación lineal conservadora (25% weight)
            const forecast = Math.max(0, avg3m + (avg3m * trend / 100) * 0.25);

            const confidence: CategoryForecast['confidence'] =
                m.length >= 3 ? 'HIGH' :
                m.length === 2 ? 'MEDIUM' : 'LOW';

            forecasts.push({
                categoryId:   catId,
                categoryName: data.name,
                avg3m:        Math.round(avg3m * 100) / 100,
                trend:        Math.round(trend * 10) / 10,
                forecast:     Math.round(forecast / 10) * 10,   // redondear a $10
                confidence,
            });
        }

        // Ordenar por forecast descendente
        forecasts.sort((a, b) => b.forecast - a.forecast);

        // ── Ingresos promedio 3 meses ────────────────────────────────────────
        let incomeRow: { avg: number } = { avg: 0 };
        try {
            incomeRow = db.prepare(`
                SELECT COALESCE(AVG(monthly_income), 0) AS avg FROM (
                    SELECT substr(date, 1, 7) AS month, SUM(amount) AS monthly_income
                    FROM NTransaction
                    WHERE userId = ? AND type = 'INCOME'
                      AND substr(date, 1, 7) IN (?, ?, ?)
                    GROUP BY month
                )
            `).get(userId, ...months) as { avg: number };
        } catch { /* sin ingresos */ }

        const totalForecast  = forecasts.reduce((s, f) => s + f.forecast, 0);
        const totalIncome    = Math.round(incomeRow.avg);
        const projectedSavings = totalIncome - totalForecast;

        const summary: ForecastSummary = {
            totalForecast:    Math.round(totalForecast),
            totalIncome,
            projectedSavings: Math.round(projectedSavings),
            byCategory:       forecasts.slice(0, 8),   // top 8
            generatedAt:      new Date().toISOString(),
        };

        return NextResponse.json(summary);

    } catch (err) {
        console.error('[forecast]', err);
        return NextResponse.json({ error: 'Error generando pronóstico' }, { status: 500 });
    } finally {
        db.close();
    }
}
