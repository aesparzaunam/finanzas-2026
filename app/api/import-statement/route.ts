import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/app/lib/firebase';
import * as XLSX from 'xlsx';
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface ParsedTransaction {
  date: string;
  description: string;
  amount: number;
  type: 'INCOME' | 'EXPENSE';
  suggestedCategory?: string;
  suggestedCategoryId?: string;
  // MSI detection
  isMSI?: boolean;
  msiCurrentMonth?: number;  // e.g. 3 in "3/12"
  msiTotalMonths?: number;   // e.g. 12 in "3/12"
  msiTotalAmount?: number;   // estimación si se puede calcular
  rawRow?: string;
}

export interface ImportResult {
  transactions: ParsedTransaction[];
  bank: string;
  totalFound: number;
  source: 'csv' | 'excel' | 'pdf_ai';
  suggestedAccountId?: string;  // cuenta detectada por Gemini
  warnings?: string[];
}

// ─── Categorías del usuario ─────────────────────────────────────────────────

interface UserCategory {
  id: string;
  name: string;
  type: string;
  icon?: string;
}

async function getUserCategories(userId: string): Promise<UserCategory[]> {
  try {
    const snap = await db.collection('users').doc(userId).collection('categories').get();
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<UserCategory, 'id'>) }));
  } catch {
    return [];
  }
}

// ─── Cuentas del usuario ───────────────────────────────────────────

interface UserAccount {
  id: string;
  name: string;
  type: string; // BANK | CREDIT | INVESTMENT | CASH
}

async function getUserAccounts(userId: string): Promise<UserAccount[]> {
  try {
    const snap = await db.collection('users').doc(userId).collection('accounts').get();
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<UserAccount, 'id'>) }));
  } catch {
    return [];
  }
}

// ─── Keyword categorizer (CSV/Excel fallback) ───────────────────────────────

const KEYWORD_RULES: { keywords: string[]; category: string }[] = [
  { keywords: ['walmart', 'walmex', 'costco', 'soriana', 'chedraui', 'superama', 'la comer', 'bodega aurrera', 'mega', 'oxxo', 'seven eleven', '7-eleven', 'circle k', 'calimax'], category: 'Supermercados' },
  { keywords: ['uber eats', 'didi food', 'rappi', 'mcdonalds', 'burger king', 'dominos', 'pizza hut', 'starbucks', 'restaurant', 'restaurante', 'taqueria', 'cafeteria', 'hoteles', 'tortas', 'sushi', 'noodles', 'barbacoa'], category: 'Restaurantes' },
  { keywords: ['netflix', 'spotify', 'amazon prime', 'disney', 'hbo', 'apple one', 'youtube', 'crunchyroll', 'paramount', 'suscripcion', 'subscription', 'membresía', 'membresia'], category: 'Suscripciones' },
  { keywords: ['gasolina', 'pemex', 'bp station', 'shell', 'mobil', 'combustible', 'gas station'], category: 'Gasolina' },
  { keywords: ['uber', 'didi', 'cabify', 'indriver', 'taxi', 'beat', 'transporte', 'metro', 'metrobus', 'ecobici', 'ado', 'autobús', 'autobus'], category: 'Transporte' },
  { keywords: ['telmex', 'telcel', 'at&t', 'movistar', 'izzi', 'totalplay', 'megacable', 'axtel', 'internet', 'telefono', 'teléfono', 'celular', 'cfe', 'agua', 'gas natural', 'luz eléctrica'], category: 'Servicios' },
  { keywords: ['farmacia', 'farmacias', 'similares', 'del ahorro', 'san pablo', 'benavides', 'medico', 'hospital', 'clinica', 'laboratorio', 'consulta', 'dentista', 'doctor', 'medicina'], category: 'Salud' },
  { keywords: ['amazon', 'mercado libre', 'ebay', 'liverpool', 'el palacio', 'suburbia', 'zara', 'h&m', 'pull&bear', 'bershka', 'shein', 'ropa', 'calzado', 'zapatos'], category: 'Compras' },
  { keywords: ['cine', 'cinepolis', 'cinemex', 'teatro', 'concierto', 'event', 'entretenimiento', 'juego', 'gym', 'gimnasio', 'sport'], category: 'Entretenimiento' },
  { keywords: ['transferencia', 'transfer', 'envio', 'spei', 'deposito', 'depósito'], category: 'Transferencias' },
  { keywords: ['nomina', 'nómina', 'sueldo', 'salario', 'pago de', 'honorarios', 'ingreso'], category: 'Ingresos' },
  { keywords: ['renta', 'alquiler', 'arrendamiento', 'hipoteca', 'casa', 'departamento', 'mantenimiento edificio'], category: 'Vivienda' },
  { keywords: ['educacion', 'educación', 'colegio', 'escuela', 'universidad', 'curso', 'capacitacion', 'udemy', 'platzi', 'libro', 'libreria', 'libros'], category: 'Educación' },
];

function suggestCategoryByKeyword(description: string, userCategories: UserCategory[]): { name: string; id?: string } | null {
  const desc = description.toLowerCase();
  for (const rule of KEYWORD_RULES) {
    if (rule.keywords.some(kw => desc.includes(kw))) {
      // Try to match to a user category by name similarity
      const match = userCategories.find(c =>
        c.name.toLowerCase().includes(rule.category.toLowerCase()) ||
        rule.category.toLowerCase().includes(c.name.toLowerCase())
      );
      return { name: rule.category, id: match?.id };
    }
  }
  return null;
}

function applyKeywordCategories(transactions: ParsedTransaction[], userCategories: UserCategory[]): ParsedTransaction[] {
  return transactions.map(tx => {
    const suggestion = suggestCategoryByKeyword(tx.description, userCategories);
    // Detect MSI pattern by regex (e.g. "3/12", "Mes 3 de 12", "3 de 12 MSI")
    const msiMatch = tx.description.match(/(\d{1,2})\s*\/\s*(\d{1,2})/)  // "3/12"
      || tx.description.match(/mes\s*(\d{1,2})\s*(?:de|of)\s*(\d{1,2})/i) // "Mes 3 de 12"
      || tx.description.match(/(\d{1,2})\s*(?:de|of)\s*(\d{1,2})\s*(?:msi|meses|mensualidades)/i);
    
    const isMSI = !!msiMatch && Number(msiMatch[2]) >= 3 && Number(msiMatch[2]) <= 48;
    const msiCurrentMonth = isMSI ? Number(msiMatch![1]) : undefined;
    const msiTotalMonths  = isMSI ? Number(msiMatch![2]) : undefined;
    const msiTotalAmount  = isMSI ? Math.round(tx.amount * msiTotalMonths! * 100) / 100 : undefined;

    return {
      ...tx,
      ...(suggestion ? { suggestedCategory: suggestion.name, suggestedCategoryId: suggestion.id } : {}),
      ...(isMSI ? { isMSI, msiCurrentMonth, msiTotalMonths, msiTotalAmount } : {}),
    };
  });
}

// ─── Parsers por banco (CSV/Excel) ─────────────────────────────────────────

function detectBank(headers: string[], filename: string): string {
  const h = headers.join(',').toLowerCase();
  const f = filename.toLowerCase();
  if (f.includes('amex') || h.includes('american express') || h.includes('referencia de la transaccion')) return 'AMEX';
  if (f.includes('bbva') || h.includes('concepto') && h.includes('cargo') && h.includes('abono')) return 'BBVA';
  if (f.includes('banorte') || h.includes('descripcion') && h.includes('retiro') && h.includes('deposito')) return 'BANORTE';
  if (f.includes('mercado') || h.includes('tipo de operacion') || h.includes('medio de pago')) return 'MERCADO_PAGO';
  return 'GENERIC';
}

function parseAMEX(rows: Record<string, string>[]): ParsedTransaction[] {
  return rows.flatMap((row): ParsedTransaction[] => {
    const dateRaw = row['Fecha'] || row['Date'] || row['FECHA'] || '';
    const desc = row['Descripción'] || row['Descripcion'] || row['Description'] || row['DESCRIPCION'] || '';
    const amountRaw = row['Monto'] || row['Amount'] || row['Cargo'] || row['MONTO'] || '';
    if (!dateRaw || !amountRaw) return [];

    const amount = Math.abs(parseFloat(amountRaw.replace(/[$,\s]/g, '').replace(',', '.')));
    const isNegative = amountRaw.trim().startsWith('-');
    if (isNaN(amount) || amount === 0) return [];

    return [{ date: normalizeDate(dateRaw), description: desc.trim(), amount, type: isNegative ? 'EXPENSE' : 'INCOME' }];
  });
}

function parseBBVA(rows: Record<string, string>[]): ParsedTransaction[] {
  return rows.flatMap((row): ParsedTransaction[] => {
    const dateRaw = row['Fecha'] || row['FECHA'] || '';
    const desc = row['Concepto'] || row['Descripción'] || row['CONCEPTO'] || '';
    const cargo = parseFloat((row['Cargo'] || row['CARGO'] || '0').replace(/[$,\s]/g, ''));
    const abono = parseFloat((row['Abono'] || row['ABONO'] || '0').replace(/[$,\s]/g, ''));
    if (!dateRaw) return [];

    if (cargo > 0) return [{ date: normalizeDate(dateRaw), description: desc.trim(), amount: cargo, type: 'EXPENSE' }];
    if (abono > 0) return [{ date: normalizeDate(dateRaw), description: desc.trim(), amount: abono, type: 'INCOME' }];
    return [];
  });
}

function parseBanorte(rows: Record<string, string>[]): ParsedTransaction[] {
  return rows.flatMap((row): ParsedTransaction[] => {
    const dateRaw = row['Fecha'] || row['FECHA'] || row['Fecha Operacion'] || '';
    const desc = row['Descripcion'] || row['Descripción'] || row['DESCRIPCION'] || row['Concepto'] || '';
    const retiro = parseFloat((row['Retiro'] || row['RETIRO'] || row['Cargo'] || '0').replace(/[$,\s]/g, ''));
    const deposito = parseFloat((row['Deposito'] || row['DEPOSITO'] || row['Depósito'] || row['Abono'] || '0').replace(/[$,\s]/g, ''));
    if (!dateRaw) return [];

    if (retiro > 0) return [{ date: normalizeDate(dateRaw), description: desc.trim(), amount: retiro, type: 'EXPENSE' }];
    if (deposito > 0) return [{ date: normalizeDate(dateRaw), description: desc.trim(), amount: deposito, type: 'INCOME' }];
    return [];
  });
}

function parseMercadoPago(rows: Record<string, string>[]): ParsedTransaction[] {
  return rows.flatMap((row): ParsedTransaction[] => {
    const dateRaw = row['Fecha'] || row['Fecha de creación'] || row['Fecha de creacion'] || '';
    const desc = row['Descripción'] || row['Descripcion'] || row['Tipo de operación'] || row['Tipo de operacion'] || row['Detalle'] || '';
    const amountRaw = row['Monto'] || row['Importe'] || row['Total'] || '';
    if (!dateRaw || !amountRaw) return [];

    const raw = amountRaw.replace(/[$,\s]/g, '').replace(',', '.');
    const amount = Math.abs(parseFloat(raw));
    const isNegative = raw.startsWith('-');
    if (isNaN(amount) || amount === 0) return [];

    return [{ date: normalizeDate(dateRaw), description: desc.trim(), amount, type: isNegative ? 'EXPENSE' : 'INCOME' }];
  });
}

function parseGeneric(rows: Record<string, string>[]): ParsedTransaction[] {
  return rows.flatMap((row): ParsedTransaction[] => {
    const keys = Object.keys(row).map(k => k.toLowerCase());

    const dateKey = keys.find(k => k.includes('fecha') || k.includes('date'));
    const descKey = keys.find(k => k.includes('desc') || k.includes('concepto') || k.includes('detalle'));
    const amountKey = keys.find(k => k.includes('monto') || k.includes('amount') || k.includes('importe') || k.includes('total'));

    if (!dateKey || !amountKey) return [];

    const dateRaw = row[Object.keys(row)[keys.indexOf(dateKey)]];
    const desc = descKey ? row[Object.keys(row)[keys.indexOf(descKey)]] : '';
    const amountRaw = row[Object.keys(row)[keys.indexOf(amountKey)]];
    const raw = (amountRaw || '').replace(/[$,\s]/g, '');
    const amount = Math.abs(parseFloat(raw));
    const isNegative = raw.startsWith('-');
    if (isNaN(amount) || amount === 0) return [];

    return [{ date: normalizeDate(dateRaw), description: (desc || '').trim(), amount, type: isNegative ? 'EXPENSE' : 'INCOME' }];
  });
}

// ─── Normalización de fechas ────────────────────────────────────────────────

function normalizeDate(raw: string): string {
  if (!raw) return new Date().toISOString();
  raw = raw.trim();

  const dmySlash = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmySlash) {
    const [, d, m, y] = dmySlash;
    return new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`).toISOString();
  }

  const isoDate = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDate) return new Date(raw).toISOString();

  const months: Record<string, string> = {
    'ene': '01', 'feb': '02', 'mar': '03', 'abr': '04', 'may': '05', 'jun': '06',
    'jul': '07', 'ago': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dic': '12',
    'jan': '01', 'apr': '04', 'aug': '08', 'dec': '12',
  };
  const textDate = raw.match(/^(\d{1,2})\s+([a-z]{3})\s+(\d{4})$/i);
  if (textDate) {
    const [, d, mon, y] = textDate;
    const m = months[mon.toLowerCase()] || '01';
    return new Date(`${y}-${m}-${d.padStart(2, '0')}`).toISOString();
  }

  const parsed = new Date(raw);
  return isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

// ─── Parser Gemini para PDFs (con categorización) ───────────────────────────

async function parseWithGemini(
  pdfBuffer: Buffer,
  userCategories: UserCategory[],
  userAccounts: UserAccount[]
): Promise<{ transactions: ParsedTransaction[]; suggestedAccountId?: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY no configurada en .env.local');

  const genAI = new GoogleGenerativeAI(apiKey);
  // Usa GEMINI_MODEL env var para poder cambiar el modelo sin redeploy.
  // Por defecto: gemini-2.5-flash (verificado disponible con AI Studio key).
  const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const model = genAI.getGenerativeModel(
    { model: modelName },
    { apiVersion: 'v1beta' }
  );

  const base64pdf = pdfBuffer.toString('base64');

  const categoryList = userCategories.length > 0
    ? userCategories.map(c => `"${c.name}"`).join(', ')
    : '"Supermercados", "Restaurantes", "Transporte", "Servicios", "Entretenimiento", "Salud", "Compras", "Gasolina", "Suscripciones", "Educación", "Vivienda", "Ingresos", "Otros"';

  // Lista de cuentas del usuario para que Gemini detecte a cuál pertenece el estado
  const accountList = userAccounts.length > 0
    ? userAccounts.map(a => `{ "id": "${a.id}", "name": "${a.name}", "type": "${a.type}" }`).join(', ')
    : '[]';

  const prompt = `Eres un asistente especializado en análisis de estados de cuenta bancarios mexicanos.
Analiza este estado de cuenta bancario.

Cuentas registradas del usuario:
[${accountList}]

Extrae TODOS los movimientos y devuelve ÚNICAMENTE un JSON con este formato:
{
  "suggestedAccountId": "id_de_la_cuenta_correspondiente",
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "descripción del movimiento",
      "amount": 123.45,
      "type": "EXPENSE" o "INCOME",
      "suggestedCategory": "categoría más apropiada",
      "isMSI": false,
      "msiCurrentMonth": null,
      "msiTotalMonths": null
    }
  ]
}

Las categorías disponibles son: ${categoryList}

Reglas:
- "suggestedAccountId": el campo "id" de la cuenta que más coincida con este estado de cuenta (por nombre de banco/emisor). Si no hay coincidencia clara, usa null.
  Ejemplos de coincidencia: estado de American Express → cuenta con name="AMEX"; BBVA débito → name="BBVA Debito"; Liverpool → name="Liverpool"; Mercado Pago → name="Mercado Pago"; Banorte → nombre que contenga "Banorte"; Oro BBVA → name="Oro BBVA"
- "type" = "EXPENSE" para cargos, compras, retiros, pagos
- "type" = "INCOME" para abonos, depósitos, devoluciones, pagos recibidos
- "amount" siempre positivo (número, sin símbolo $)
- "date" en formato YYYY-MM-DD
- "suggestedCategory" debe ser UNA de las categorías listadas. Si ninguna aplica usa "Otros"
- Si hay pagos de tarjeta de crédito (ej. "Pago de contado"), clasifícalos como INCOME
- NO incluyas totales ni saldos, solo movimientos individuales
- "isMSI": true si la descripción indica un cargo a meses sin intereses ("3/12", "Mes 3 de 12", "MSI", "meses sin intereses")
- Si isMSI es true: msiCurrentMonth = número de mensualidad actual, msiTotalMonths = total de meses
- Si isMSI es false: msiCurrentMonth y msiTotalMonths = null
- Responde SOLO con el JSON (objeto, no array), sin texto adicional, sin markdown`;

  const result = await model.generateContent([
    { inlineData: { mimeType: 'application/pdf', data: base64pdf } },
    prompt,
  ]);

  const text = result.response.text().trim();
  const jsonText = text.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();

  // El resultado es ahora un objeto { suggestedAccountId, transactions }
  // con fallback a array puro (compatibilidad hacia atrás)
  let suggestedAccountId: string | undefined;
  let rawTransactions: Record<string, unknown>[];

  const outer = JSON.parse(jsonText);
  if (Array.isArray(outer)) {
    // Respuesta de formato anterior (array puro)
    rawTransactions = outer;
  } else if (outer && Array.isArray(outer.transactions)) {
    rawTransactions = outer.transactions;
    const accId = String(outer.suggestedAccountId || '').trim();
    // Verifica que el ID realmente exista en la lista del usuario
    if (accId && userAccounts.some(a => a.id === accId)) {
      suggestedAccountId = accId;
    }
  } else {
    throw new Error('Gemini no devolvió un formato válido');
  }

  const transactions = rawTransactions.map((item: Record<string, unknown>) => {
    const suggestedName = String(item.suggestedCategory || '').trim();
    const matchedCat = userCategories.find(c =>
      c.name.toLowerCase() === suggestedName.toLowerCase()
    );
    const isMSI = Boolean(item.isMSI);
    const msiCurrentMonth = isMSI && item.msiCurrentMonth ? Number(item.msiCurrentMonth) : undefined;
    const msiTotalMonths  = isMSI && item.msiTotalMonths  ? Number(item.msiTotalMonths)  : undefined;
    const monthlyAmount   = Math.abs(Number(item.amount));
    const msiTotalAmount  = isMSI && msiTotalMonths ? Math.round(monthlyAmount * msiTotalMonths * 100) / 100 : undefined;

    return {
      date: new Date(String(item.date)).toISOString(),
      description: String(item.description || '').trim(),
      amount: monthlyAmount,
      type: item.type === 'INCOME' ? ('INCOME' as const) : ('EXPENSE' as const),
      suggestedCategory: suggestedName || undefined,
      suggestedCategoryId: matchedCat?.id,
      ...(isMSI ? { isMSI, msiCurrentMonth, msiTotalMonths, msiTotalAmount } : {}),
    };
  });

  return { transactions, suggestedAccountId };
}

// ─── Route Handler ──────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('userId')?.value;
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 });

    const filename = file.name.toLowerCase();
    const buffer = Buffer.from(await file.arrayBuffer());

    // Cargar categorías y cuentas del usuario en paralelo
    const [userCategories, userAccounts] = await Promise.all([
      getUserCategories(userId),
      getUserAccounts(userId),
    ]);

    let result: ImportResult;

    // ── PDF → Gemini AI ──────────────────────────────────────────────────
    if (filename.endsWith('.pdf')) {
      const { transactions, suggestedAccountId } = await parseWithGemini(buffer, userCategories, userAccounts);

      // Intenta detectar banco por nombre de archivo también como fallback
      const bank = filename.includes('amex') ? 'AMEX'
        : filename.includes('bbva') ? 'BBVA'
        : filename.includes('banorte') ? 'BANORTE'
        : filename.includes('mercado') ? 'MERCADO_PAGO'
        : filename.includes('liverpool') ? 'LIVERPOOL'
        : 'AUTO_DETECTADO';

      result = { transactions, bank, totalFound: transactions.length, source: 'pdf_ai', suggestedAccountId };
    }

    // ── CSV ───────────────────────────────────────────────────────────────
    else if (filename.endsWith('.csv')) {
      const text = buffer.toString('utf-8');
      const workbook = XLSX.read(text, { type: 'string' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { raw: false, defval: '' });

      if (rows.length === 0) return NextResponse.json({ error: 'El CSV está vacío o no tiene datos' }, { status: 400 });

      const headers = Object.keys(rows[0] || {});
      const bank = detectBank(headers, filename);

      let transactions: ParsedTransaction[] = [];
      switch (bank) {
        case 'AMEX': transactions = parseAMEX(rows); break;
        case 'BBVA': transactions = parseBBVA(rows); break;
        case 'BANORTE': transactions = parseBanorte(rows); break;
        case 'MERCADO_PAGO': transactions = parseMercadoPago(rows); break;
        default: transactions = parseGeneric(rows);
      }

      // Categorización por keywords
      transactions = applyKeywordCategories(transactions, userCategories);
      result = { transactions, bank, totalFound: transactions.length, source: 'csv' };
    }

    // ── Excel (XLS/XLSX) ─────────────────────────────────────────────────
    else if (filename.endsWith('.xlsx') || filename.endsWith('.xls')) {
      const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { raw: false, defval: '' });

      if (rows.length === 0) return NextResponse.json({ error: 'El Excel está vacío o no tiene datos' }, { status: 400 });

      const headers = Object.keys(rows[0] || {});
      const bank = detectBank(headers, filename);

      let transactions: ParsedTransaction[] = [];
      switch (bank) {
        case 'AMEX': transactions = parseAMEX(rows); break;
        case 'BBVA': transactions = parseBBVA(rows); break;
        case 'BANORTE': transactions = parseBanorte(rows); break;
        case 'MERCADO_PAGO': transactions = parseMercadoPago(rows); break;
        default: transactions = parseGeneric(rows);
      }

      transactions = applyKeywordCategories(transactions, userCategories);
      result = { transactions, bank, totalFound: transactions.length, source: 'excel' };
    }

    else {
      return NextResponse.json({ error: 'Formato no soportado. Usa PDF, CSV, XLS o XLSX' }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error('Import error:', error);
    const msg = error instanceof Error ? error.message : 'Error procesando el archivo';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
