/**
 * /api/debug-pdf/route.ts
 * Endpoint temporal para diagnosticar la extracción de texto de PDFs.
 * Muestra las primeras líneas del texto extraído + resultado del parser.
 * ELIMINAR después del diagnóstico.
 */

import { NextResponse } from 'next/server';

export const maxDuration = 60;

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });

        const buffer = Buffer.from(await file.arrayBuffer());

        // 1. Extraer texto
        let rawText = '';
        let extractMethod = '';

        try {
            // @ts-expect-error type missing
            const pdfParseModule = await import('pdf-parse/lib/pdf-parse.js');
            const pdfParse = (pdfParseModule).default ?? pdfParseModule;
            const result = await pdfParse(buffer);
            rawText = result.text?.trim() ?? '';
            extractMethod = 'pdf-parse';
        } catch (e) {
            extractMethod = 'pdf-parse-error: ' + String(e);
        }

        // 2. Correr el parser
        const { parseStatement } = await import('@/app/lib/statement-parser');
        const parsed = parseStatement(rawText, []);

        // 3. Retornar diagnóstico
        const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);

        return NextResponse.json({
            file: file.name,
            extractMethod,
            totalChars: rawText.length,
            totalLines: lines.length,
            // Primeras 50 líneas con contenido
            sampleLines: lines.slice(0, 50),
            // Resultado del parser
            parserUsed: parsed.parserUsed,
            bankDetected: parsed.bank,
            transactionsFound: parsed.transactions.length,
            transactions: parsed.transactions.slice(0, 10),
        });
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
