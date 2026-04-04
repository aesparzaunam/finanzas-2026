import { getUserId } from '@/app/lib/api-utils';
import { NextResponse } from 'next/server';
import { buildChatSystemPrompt, stripThinking } from '@/app/lib/ai-utils';

export const maxDuration = 180; // qwen3-27B puede tardar hasta ~90s en carga inicial

// ── Tipos ────────────────────────────────────────────────────────────────────
interface ChatMessage {
    role:    'user' | 'assistant' | 'system';
    content: string;
}

// POST /api/ai/chat
// Body: { message: string; history?: ChatMessage[]; sessionId?: string }
// Respuesta: { reply: string; sessionId: string }
export async function POST(request: Request) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const userMessage: string = body.message ?? '';
    const history: ChatMessage[] = body.history ?? [];
    const sessionId: string = body.sessionId || `${Date.now()}`;

    if (!userMessage.trim()) {
        return NextResponse.json({ error: 'Mensaje vacío' }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require('better-sqlite3');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path');
    const dbPath = (process.env.DATABASE_URL ?? '').replace('file:', '') ||
        path.join(process.cwd(), 'prisma', 'finanzas.db');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db: any = Database(dbPath);

    try {
        // ── 1. Cargar KPIs del mes actual para contexto ────────────────────────
        const now   = new Date();
        const month = now.toISOString().slice(0, 7);
        const fromDate = `${month}-01`;
        const toDate   = `${month}-31`;

        // KPIs del mes — sin columnas opcionales (deletedAt / isParent pueden no existir)
        let kpisRow: { income: number; expenses: number } | null = null;
        try {
            kpisRow = db.prepare(`
                SELECT
                    COALESCE(SUM(CASE WHEN type = 'INCOME'  THEN amount ELSE 0 END), 0) AS income,
                    COALESCE(SUM(CASE WHEN type IN ('EXPENSE','MSI_CHARGE') THEN amount ELSE 0 END), 0) AS expenses
                FROM NTransaction
                WHERE userId = ? AND date >= ? AND date <= ?
            `).get(userId, fromDate, toDate) as { income: number; expenses: number };
        } catch {
            // Si NTransaction no tiene el schema esperado, fallback
            try {
                kpisRow = db.prepare(`
                    SELECT
                        COALESCE(SUM(CASE WHEN type = 'INCOME' THEN amount ELSE 0 END), 0) AS income,
                        COALESCE(SUM(CASE WHEN type = 'EXPENSE' THEN amount ELSE 0 END), 0) AS expenses
                    FROM NTransaction WHERE userId = ? AND date >= ? AND date <= ?
                `).get(userId, fromDate, toDate) as { income: number; expenses: number };
            } catch { /* sin datos */ }
        }

        const income      = kpisRow?.income   ?? 0;
        const expenses    = kpisRow?.expenses ?? 0;
        const cashFlow    = income - expenses;
        const savingsRate = income > 0 ? (cashFlow / income) * 100 : 0;

        // Deuda total
        let debtRow: { totalDebt: number } = { totalDebt: 0 };
        try {
            debtRow = db.prepare(`
                SELECT COALESCE(SUM(CASE WHEN balance < 0 THEN ABS(balance) ELSE 0 END), 0) AS totalDebt
                FROM Account WHERE userId = ? AND type IN ('CREDIT','LOAN')
            `).get(userId) as { totalDebt: number };
        } catch { /* sin cuentas */ }

        const totalDebt = debtRow?.totalDebt ?? 0;
        const dti = income > 0 ? (totalDebt / (income * 12)) * 100 : 0;

        // Patrimonio
        let networthRow: { netWorth: number } = { netWorth: 0 };
        try {
            networthRow = db.prepare(`
                SELECT COALESCE(SUM(balance), 0) AS netWorth FROM Account WHERE userId = ?
            `).get(userId) as { netWorth: number };
        } catch { /* sin cuentas */ }

        // Top categorías
        let topCats: { name: string; amount: number }[] = [];
        try {
            topCats = db.prepare(`
                SELECT c.name, SUM(t.amount) AS amount
                FROM NTransaction t
                JOIN Category c ON c.id = t.categoryId
                WHERE t.userId = ? AND t.type IN ('EXPENSE','MSI_CHARGE')
                  AND t.date >= ? AND t.date <= ?
                GROUP BY t.categoryId
                ORDER BY amount DESC LIMIT 5
            `).all(userId, fromDate, toDate) as { name: string; amount: number }[];
        } catch { /* sin categorías */ }

        // Cuentas
        let accounts: { name: string; type: string; balance: number }[] = [];
        try {
            accounts = db.prepare(`
                SELECT name, type, balance FROM Account WHERE userId = ? ORDER BY balance DESC LIMIT 6
            `).all(userId) as { name: string; type: string; balance: number }[];
        } catch { /* sin cuentas */ }

        // MSI activo mensual
        let msiRow: { monthly: number } = { monthly: 0 };
        try {
            msiRow = db.prepare(`
                SELECT COALESCE(SUM(monthlyAmount), 0) AS monthly
                FROM MsiPlan WHERE userId = ? AND status = 'ACTIVE'
            `).get(userId) as { monthly: number };
        } catch { /* sin MSI */ }

        // Suscripciones (tabla opcional)
        let subRow: { count: number; total: number } = { count: 0, total: 0 };
        try {
            const subTableExists = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='Subscription'`).get();
            if (subTableExists) {
                subRow = db.prepare(`
                    SELECT COUNT(*) AS count, COALESCE(SUM(monthlyFee), 0) AS total
                    FROM Subscription WHERE userId = ? AND isActive = 1
                `).get(userId) as { count: number; total: number };
            }
        } catch { /* tabla no existe */ }

        // ── 2. Construir prompt del sistema ───────────────────────────────────
        const systemPrompt = buildChatSystemPrompt({
            month,
            netWorth:         networthRow?.netWorth ?? 0,
            income:           income,
            expenses:         expenses,
            cashFlow,
            dti,
            savingsRate,
            topCategories:    topCats,
            totalDebt,
            activeMsiMonthly: msiRow?.monthly ?? 0,
            subscriptions:    subRow?.count ?? 0,
            subscriptionTotal:subRow?.total ?? 0,
            accounts,
        });

        // ── 3. Llamar a Ollama con fetch nativo (timeout explícito 120s) ─────
        const llmUrl   = process.env.LOCAL_LLM_URL ?? 'http://127.0.0.1:11434/v1';
        const llmModel = process.env.LOCAL_LLM_MODEL_NAME ?? 'qwen-claude:latest';

        // Construir historial (máx 10 mensajes para no saturar el contexto)
        const recentHistory = history.slice(-10);
        const messages: ChatMessage[] = [
            { role: 'system', content: systemPrompt },
            ...recentHistory,
            { role: 'user', content: userMessage },
        ];

        const ollamaRes = await fetch(`${llmUrl}/chat/completions`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ollama' },
            body:    JSON.stringify({
                model:       llmModel,
                temperature: 0.4,
                max_tokens:  600,
                messages,
                think:       false,  // Desactiva chain-of-thought en Qwen3
            }),
            signal: AbortSignal.timeout(120_000),
        });

        if (!ollamaRes.ok) {
            const errText = await ollamaRes.text();
            console.error('[ai/chat] Ollama HTTP error:', ollamaRes.status, errText);
            throw new Error(`Ollama respondió con status ${ollamaRes.status}`);
        }

        const ollamaData = await ollamaRes.json() as {
            choices: { message: { content: string } }[];
        };

        // Strip de bloques <think>...</think> si el modelo los incluye
        const rawContent = ollamaData.choices[0]?.message?.content ?? '';
        const reply = stripThinking(rawContent) || 'Lo siento, no pude procesar tu pregunta.';

        // ── 4. Persistir en AiChat ──────────────────────────────────────────
        // Schema real: id, userId, role, content, createdAt (sin sessionId)
        const tableExists = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='AiChat'`).get();
        if (tableExists) {
            try {
                db.prepare(`
                    INSERT INTO AiChat (id, userId, role, content, createdAt)
                    VALUES (?, ?, ?, ?, ?)
                `).run(`${Date.now()}_u`, userId, 'user', userMessage, new Date().toISOString());
                db.prepare(`
                    INSERT INTO AiChat (id, userId, role, content, createdAt)
                    VALUES (?, ?, ?, ?, ?)
                `).run(`${Date.now()}_a`, userId, 'assistant', reply, new Date().toISOString());
            } catch (dbErr) {
                // No bloquear la respuesta si falla el guardado
                console.warn('[ai/chat] No se pudo guardar en AiChat:', dbErr);
            }
        }

        return NextResponse.json({ reply, sessionId });
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        const errStack = error instanceof Error ? error.stack?.split('\n').slice(0,3).join(' | ') : '';
        console.error('[ai/chat] FATAL:', errMsg, errStack);
        return NextResponse.json(
            { error: errMsg, debug: errStack, reply: null },
            { status: 500 }
        );
    }
}

// GET /api/ai/chat?sessionId=xxx  → historial de sesión
export async function GET(request: Request) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) return NextResponse.json({ messages: [] });

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require('better-sqlite3');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path');
    const dbPath = (process.env.DATABASE_URL ?? '').replace('file:', '') ||
        path.join(process.cwd(), 'prisma', 'finanzas.db');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db: any = Database(dbPath);

    try {
        const tableExists = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='AiChat'`).get();
        if (!tableExists) return NextResponse.json({ messages: [] });

        const messages = db.prepare(`
            SELECT role, content, createdAt FROM AiChat
            WHERE userId = ? AND sessionId = ?
            ORDER BY createdAt ASC LIMIT 50
        `).all(userId, sessionId);

        return NextResponse.json({ messages });
    } catch {
        return NextResponse.json({ messages: [] });
    }
}
