import { NextResponse } from 'next/server';

// GET /api/ai/health — verificación rápida del estado de Ollama (sin chat test)
export async function GET() {
    const llmUrl   = process.env.LOCAL_LLM_URL   ?? '';
    const llmModel = process.env.LOCAL_LLM_MODEL_NAME ?? '';

    // Si no hay URL configurada, responder directamente
    if (!llmUrl) {
        return NextResponse.json({ ok: false, reason: 'LOCAL_LLM_URL not configured' });
    }

    const ollamaBase = llmUrl.replace('/v1', '');

    try {
        // Solo verificamos /api/tags (no hacemos chat), timeout de 4 segundos
        const res = await fetch(`${ollamaBase}/api/tags`, {
            signal: AbortSignal.timeout(4000),
        });

        if (!res.ok) {
            return NextResponse.json({ ok: false, reason: `HTTP ${res.status}` });
        }

        const data = await res.json();
        const models: string[] = data.models?.map((m: { name: string }) => m.name) ?? [];
        const activeModel = models.find(m => m === llmModel || m.startsWith(llmModel.split(':')[0]));

        return NextResponse.json({
            ok: true,
            model: llmModel,
            modelLoaded: !!activeModel,
            availableModels: models,
        });
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ ok: false, reason: msg });
    }
}
