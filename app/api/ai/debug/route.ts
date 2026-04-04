import { NextResponse } from 'next/server';
import { getUserId } from '@/app/lib/api-utils';

export const maxDuration = 30;

// GET /api/ai/debug — diagnóstico completo (requiere auth para ver todos los datos)
export async function GET(request: Request) {
    const llmUrl   = process.env.LOCAL_LLM_URL   ?? 'NO_CONFIGURADO';
    const llmModel = process.env.LOCAL_LLM_MODEL_NAME ?? 'NO_CONFIGURADO';
    const dbUrl    = process.env.DATABASE_URL ?? 'NO_CONFIGURADO';

    const results: Record<string, unknown> = {
        env: { llmUrl, llmModel, dbUrl },
        auth: 'not_checked',
        db:   {},
        ollama: {},
    };

    // Auth check
    try {
        results.auth = (await getUserId()) ? 'ok' : 'no_session';
    } catch (e) { results.auth = `error: ${e}`; }

    // DB check
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const Database = require('better-sqlite3');
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const path = require('path');
        const dbPath = dbUrl.replace('file:', '') || path.join(process.cwd(), 'prisma', 'finanzas.db');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db: any = Database(dbPath);
        const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`).all();
        const aiChat = tables.find((t: { name: string }) => t.name === 'AiChat');
        results.db = {
            ok: true,
            path: dbPath,
            tables: tables.map((t: { name: string }) => t.name),
            hasAiChat: !!aiChat,
        };
        db.close();
    } catch (e) { results.db = { ok: false, error: String(e) }; }

    // Ollama check
    try {
        const tagsRes = await fetch(`${llmUrl.replace('/v1', '')}/api/tags`, { signal: AbortSignal.timeout(5000) });
        const tagsData = await tagsRes.json();
        results.ollama = {
            tags: { ok: true, models: tagsData.models?.map((m: { name: string }) => m.name) },
        };
    } catch (e) {
        results.ollama = { tags: { ok: false, error: String(e) } };
    }

    // Quick chat test (solo si hay URL)
    if (llmUrl !== 'NO_CONFIGURADO') {
        try {
            const chatRes = await fetch(`${llmUrl}/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: llmModel, messages: [{ role: 'user', content: 'Di: OK' }], max_tokens: 3, think: false }),
                signal: AbortSignal.timeout(15000),
            });
            const chatOk = chatRes.ok;
            const chatData = chatOk ? await chatRes.json() : await chatRes.text();
            (results.ollama as Record<string, unknown>).chat = chatOk
                ? { ok: true, reply: chatData.choices?.[0]?.message?.content }
                : { ok: false, status: chatRes.status, body: chatData };
        } catch (e) {
            (results.ollama as Record<string, unknown>).chat = { ok: false, error: String(e) };
        }
    }

    const url = new URL(request.url);
    return NextResponse.json(results, {
        status: 200,
        headers: url.searchParams.get('pretty') ? { 'Content-Type': 'application/json' } : {},
    });
}
