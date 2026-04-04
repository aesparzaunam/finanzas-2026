/**
 * /api/import-statement/route.ts
 * ──────────────────────────────────────────────────────────────────────────────
 * Pipeline de importación de estados de cuenta.
 *
 * Flujo:
 *   PDF  → pdf-parse → texto ≥ 50 chars → Ollama
 *          pdf-parse → texto < 50 chars  → tesseract.js OCR → Ollama
 *   CSV  → XLSX text → Ollama
 *   XLS  → XLSX text → Ollama
 *
 * Novedad: Ollama detecta automáticamente banco, tipo de cuenta y nombre.
 * Si la cuenta no existe en Firestore, se crea automáticamente.
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getCategories, getAccounts, createAccount } from '@/app/lib/db';
import * as XLSX from 'xlsx';
import { callLocalLLM, ParsedTransactionAI, ImportResultAI } from '@/app/lib/ai-utils';

export const maxDuration = 300;

// ── Tipos re-exportados para compatibilidad con StatementImporter.tsx ─────────
export type ParsedTransaction = ParsedTransactionAI & { rawRow?: string };
export type { ImportResultAI as ImportResult };

// ── Tipos internos ────────────────────────────────────────────────────────────

interface UserCategory { id: string; name: string; type: string; icon?: string }
interface UserAccount  { id: string; name: string; type: string }

// ── Helpers SQLite ────────────────────────────────────────────────────────────

async function getUserCategories(userId: string): Promise<UserCategory[]> {
    try {
        const cats = await getCategories(userId);
        return cats.map(c => ({ id: c.id, name: c.name, type: c.type, icon: c.icon }));
    } catch { return []; }
}

async function getUserAccounts(userId: string): Promise<UserAccount[]> {
    try {
        const accs = await getAccounts(userId);
        return accs.map(a => ({ id: a.id, name: a.name, type: a.type }));
    } catch { return []; }
}

/**
 * Crea la cuenta detectada por Ollama en Firestore si no existe una coincidente.
 * Devuelve el id de la cuenta (nueva o existente).
 */
async function resolveOrCreateAccount(
    userId: string,
    existingAccounts: UserAccount[],
    suggestedAccountId: string | undefined,
    detectedAccount: { name: string; type: 'BANK' | 'CREDIT' | 'INVESTMENT' | 'LOAN'; bank: string } | undefined
): Promise<string | undefined> {
    if (suggestedAccountId && existingAccounts.some(a => a.id === suggestedAccountId)) {
        return suggestedAccountId;
    }
    if (!detectedAccount?.name) return undefined;

    const nameLower = detectedAccount.name.toLowerCase().trim();
    const existing = existingAccounts.find(a =>
        a.name.toLowerCase().trim() === nameLower ||
        a.name.toLowerCase().includes(nameLower) ||
        nameLower.includes(a.name.toLowerCase())
    );
    if (existing) return existing.id;

    const typeToLabel: Record<string, string> = { BANK: 'Cuenta de Banco', CREDIT: 'Tarjeta de Crédito', INVESTMENT: 'Inversión', LOAN: 'Préstamo' };
    const newAccount = await createAccount(userId, {
        name:         detectedAccount.name,
        type:         detectedAccount.type,
        typeLabel:    typeToLabel[detectedAccount.type] || detectedAccount.type,
        bank:         detectedAccount.bank,
        balance:      0,
        currency:     'MXN',
        isDefault:    0,
        autoDetected: 1,
    });
    console.log(`[import-statement] Cuenta auto-creada: "${detectedAccount.name}" (${detectedAccount.type}) → ${newAccount.id}`);
    return newAccount.id;
}

// ── Extracción de texto ───────────────────────────────────────────────────────

async function extractTextFromPDF(buffer: Buffer): Promise<string> {
    try {
        const pdfParseModule = await import('pdf-parse');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pdfParse = (pdfParseModule as any).default ?? pdfParseModule;
        const result   = await pdfParse(buffer);
        const text     = result.text?.trim() ?? '';
        if (text.length >= 50) {
            console.log('[import-statement] pdf-parse OK →', text.length, 'chars');
            return text;
        }
        console.log('[import-statement] pdf-parse insuficiente (' + text.length + ' chars) → OCR fallback');
    } catch (err) {
        console.warn('[import-statement] pdf-parse error:', err);
    }

    try {
        const { createWorker } = await import('tesseract.js');
        const worker = await createWorker('spa+eng');
        const { data: { text } } = await worker.recognize(buffer);
        await worker.terminate();
        const cleaned = text.trim();
        console.log('[import-statement] OCR tesseract.js →', cleaned.length, 'chars');
        return cleaned;
    } catch (err) {
        console.error('[import-statement] OCR error:', err);
        throw new Error('No se pudo extraer texto del PDF (ni pdf-parse ni OCR).');
    }
}

function extractTextFromSpreadsheet(buffer: Buffer, isCSV: boolean): string {
    const workbook = isCSV
        ? XLSX.read(buffer.toString('utf-8'), { type: 'string' })
        : XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_csv(sheet);
}

// ── Route Handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request) {
    try {
        const cookieStore = await cookies();
        const userId = cookieStore.get('userId')?.value;
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const formData = await request.formData();
        const file     = formData.get('file') as File | null;
        if (!file) return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 });

        const filename = file.name.toLowerCase();
        const buffer   = Buffer.from(await file.arrayBuffer());

        const [userCategories, userAccounts] = await Promise.all([
            getUserCategories(userId),
            getUserAccounts(userId),
        ]);

        // ── Extraer texto ────────────────────────────────────────────────────
        let documentText: string;
        let source: ImportResultAI['source'];
        let bank = 'AUTO_DETECTADO';

        if (filename.endsWith('.pdf')) {
            documentText = await extractTextFromPDF(buffer);
            source = 'pdf_ai';
            if      (filename.includes('amex'))       bank = 'AMEX';
            else if (filename.includes('bbva'))        bank = 'BBVA';
            else if (filename.includes('banorte'))     bank = 'BANORTE';
            else if (filename.includes('mercado'))     bank = 'MERCADO_PAGO';
            else if (filename.includes('liverpool'))   bank = 'LIVERPOOL';
            else if (filename.includes('hsbc'))        bank = 'HSBC';
            else if (filename.includes('santander'))   bank = 'SANTANDER';
        } else if (filename.endsWith('.csv')) {
            documentText = extractTextFromSpreadsheet(buffer, true);
            source = 'csv';
        } else if (filename.endsWith('.xlsx') || filename.endsWith('.xls')) {
            documentText = extractTextFromSpreadsheet(buffer, false);
            source = 'excel';
        } else {
            return NextResponse.json(
                { error: 'Formato no soportado. Usa PDF, CSV, XLS o XLSX' },
                { status: 400 }
            );
        }

        if (!documentText || documentText.trim().length < 10) {
            return NextResponse.json({ error: 'No se encontró contenido legible en el archivo.' }, { status: 400 });
        }

        // ── Llamar al LLM local ──────────────────────────────────────────────
        console.log(`[import-statement] Enviando a Ollama (${process.env.LOCAL_LLM_MODEL_NAME || 'qwen-claude'}) ${documentText.length} chars…`);
        const { transactions, suggestedAccountId, detectedAccount } = await callLocalLLM(
            documentText,
            userCategories,
            userAccounts,
        );

        // Actualizar nombre de banco desde la cuenta detectada si está disponible
        if (detectedAccount?.bank) bank = detectedAccount.bank;

        // ── Auto-crear la cuenta si no existe ────────────────────────────────
        const resolvedAccountId = await resolveOrCreateAccount(
            userId,
            userAccounts,
            suggestedAccountId,
            detectedAccount
        );

        const result: ImportResultAI = {
            transactions,
            bank,
            totalFound:          transactions.length,
            source,
            suggestedAccountId:  resolvedAccountId,
            suggestedAccount:    detectedAccount
                ? { name: detectedAccount.name, type: detectedAccount.type, bank: detectedAccount.bank }
                : undefined,
        };

        return NextResponse.json(result);
    } catch (error: unknown) {
        console.error('[import-statement] Error:', error);
        const msg = error instanceof Error ? error.message : 'Error procesando el archivo';
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
