/**
 * app/lib/statement-parser.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Parser basado en regex para estados de cuenta bancarios mexicanos.
 * NO requiere LLM – extrae Y categoriza transacciones por patrones y keywords.
 *
 * Bancos soportados: AMEX, BBVA, Banorte, Mercado Pago, HSBC, Santander,
 *                    Liverpool, Banamex, y formato genérico.
 */

export interface RawTransaction {
    date:              string;   // ISO: YYYY-MM-DD
    description:       string;
    amount:            number;
    type:              'INCOME' | 'EXPENSE' | 'MSI_CHARGE';
    suggestedCategory: string;
    isMSI?:            boolean;
    msiCurrentMonth?:  number | null;
    msiTotalMonths?:   number | null;
    msiTotalAmount?:   number | null;
}

// ── Utilidades ────────────────────────────────────────────────────────────────

const MONTH_MAP: Record<string, string> = {
    ene: '01', enero: '01',
    feb: '02', febrero: '02',
    mar: '03', marzo: '03',
    abr: '04', abril: '04',
    may: '05', mayo: '05',
    jun: '06', junio: '06',
    jul: '07', julio: '07',
    ago: '08', agosto: '08',
    sep: '09', sept: '09', septiembre: '09',
    oct: '10', octubre: '10',
    nov: '11', noviembre: '11',
    dic: '12', diciembre: '12',
    jan: '01', feb2: '02', apr: '04', aug: '08',
};

function parseAmount(raw: string): number {
    return parseFloat(raw.replace(/[,\$\s]/g, '')) || 0;
}

function guessYear(): string {
    return String(new Date().getFullYear());
}

function toISO(day: string, month: string, year?: string): string {
    const y = year
        ? (year.length === 2 ? `20${year}` : year)
        : guessYear();
    const m = MONTH_MAP[month.toLowerCase()] || month.padStart(2, '0');
    return `${y}-${m}-${day.padStart(2, '0')}`;
}

function cleanText(raw: string): string {
    return raw
        .replace(/\r\n/g, '\n')
        .replace(/\r/g,   '\n')
        .replace(/\t/g,   ' ')
        .replace(/ {2,}/g, ' ')
        .split('\n')
        .map(l => l.trim())
        .join('\n');
}

// ── Clasificación por palabras clave (sin LLM) ────────────────────────────────

const CATEGORY_KEYWORDS: Array<[RegExp, string]> = [
    // Comida y restaurantes
    [/\b(oxxo|seven.?eleven|circle.?k|waldo|farmacias|farmacia)\b/i, 'Conveniencia'],
    [/\b(uber.?eats|rappi|didi.?food|doordash|grubhub|just.?eat)\b/i, 'Comida a domicilio'],
    [/\b(restaurant|restaur|burger|mcdonalds|kfc|subway|pizza|sushi|taco|taquer|comida|cafe|bistro|grill|steakhouse)\b/i, 'Restaurantes'],
    [/\b(walmart|sams|costco|chedraui|soriana|superama|la.?comer|bodega.?aurrera|liverpool|palacio|sears|zara|h.?m|primark)\b/i, 'Supermercado'],
    // Transporte
    [/\b(uber|didi|cabify|lyft|taxi|indriver)\b/i, 'Transporte'],
    [/\b(gasolinera|gas.?station|pemex|mobil|shell|bp|total.?gas)\b/i, 'Gasolina'],
    [/\b(aerom[ée]xico|volaris|vivaaerobus|united|american.?airlines|delta|latam|vuelo|aerolinea)\b/i, 'Viajes'],
    [/\b(booking|airbnb|hotel|resort|hostal|hyatt|marriott|hilton|sheraton)\b/i, 'Hospedaje'],
    // Servicios digitales
    [/\b(netflix|hbo|disney|amazon.?prime|apple.?tv|paramount|crunchyroll|streaming)\b/i, 'Entretenimiento'],
    [/\b(spotify|apple.?music|deezer|youtube.?music)\b/i, 'Entretenimiento'],
    [/\b(amazon|mercado.?libre|alibaba|aliexpress|ebay|shein|temu)\b/i, 'Compras en línea'],
    [/\b(apple|icloud|google|microsoft|dropbox|adobe|zoom|slack)\b/i, 'Tecnología'],
    // Salud
    [/\b(farmacia|farmacias|similares|del.?ahorro|benavides|gym|fitness|sport|medic|hospital|clinica|doctor|dentista)\b/i, 'Salud'],
    // Educación
    [/\b(universidad|colegio|escuela|udemy|coursera|platzi|duolingo|educacion|colegiatura|inscripcion)\b/i, 'Educación'],
    // Servicios
    [/\b(telmex|telcel|at.?t|movistar|izzi|totalplay|megacable|internet|telefono|luz|agua|gas|cfe)\b/i, 'Servicios'],
    [/\b(seguro|allianz|gnp|metlife|mapfre|axa|seguros|hdfc|zurich)\b/i, 'Seguros'],
    // Finanzas
    [/\b(pago|abono|deposito|transfer|spei|cargo|comision|interes|anualidad)\b/i, 'Finanzas'],
    // Entretenimiento
    [/\b(cine|cinemex|cinepolis|teatro|concierto|evento|ticketmaster|boletos|vive.?latino)\b/i, 'Entretenimiento'],
];

const INCOME_RE = /\b(abono|deposito|dep[oó]sito|pago recibido|transferencia recibida|n[oó]mina|sueldo|cashback|devoluci[oó]n|reembolso|refund|cr[eé]dito|bonificaci[oó]n|premio|recompensa)\b/i;

export function suggestCategory(description: string, categories: string[]): string {
    const desc = description.toLowerCase();

    // Buscar coincidencia por keywords
    for (const [pattern, cat] of CATEGORY_KEYWORDS) {
        if (pattern.test(desc)) {
            // Verificar si existe en las categorías del usuario
            const found = categories.find(c => c.toLowerCase().includes(cat.toLowerCase()) || cat.toLowerCase().includes(c.toLowerCase()));
            if (found) return found;
            return cat;
        }
    }

    // Si no hay match, usar "Otros"
    return categories.find(c => c.toLowerCase() === 'otros') || 'Otros';
}

// ── Parser AMEX específico ────────────────────────────────────────────────────
//
// Formato AMEX México:
//   DD MES   DESCRIPCION DEL COMERCIO        IMPORTE
//   "01 ENE  AMAZON.COM.MX                   $1,234.56"
//   o todo en una sola línea: "01 ENE AMAZON.COM.MX 1,234.56"

export function parseAMEX(text: string): RawTransaction[] {
    const results: RawTransaction[] = [];
    const lines = cleanText(text).split('\n');

    // Maneja "01 ENE", "1 de Enero", "12 Mar"
    const TX_START_RE = /^(\d{1,2})\s+(?:de\s+)?(Enero|Febrero|Marzo|Abril|Mayo|Junio|Julio|Agosto|Septiembre|Octubre|Noviembre|Diciembre|Ene|Feb|Mar|Abr|May|Jun|Jul|Ago|Sep|Oct|Nov|Dic)(.*)$/i;

    let activeTx: { day: string; month: string; desc: string; amount?: number; isCredit?: boolean } | null = null;

    const pushActiveTx = () => {
        if (activeTx && activeTx.amount !== undefined) {
             const isCredit = /pago|gracias/i.test(activeTx.desc) || !!activeTx.isCredit;
             
             let isMSI = false;
             let msiCurrentMonth: number | null = null;
             let msiTotalMonths: number | null = null;

             const msiMatch = activeTx.desc.match(/CARGO\s+(\d+)\s+DE\s+(\d+)/i) || activeTx.desc.match(/(\d+)\s+de\s+(\d+)/i);
             if (msiMatch) {
                 isMSI = true;
                 msiCurrentMonth = parseInt(msiMatch[1], 10);
                 msiTotalMonths = parseInt(msiMatch[2], 10);
             }

             const finalDesc = activeTx.desc
                 .replace(/RFC[A-Z0-9]+(?:\s*\/REF[A-Za-z0-9_]+)?/gi, '')
                 .replace(/CARGO \d+ DE \d+/gi, '')
                 .replace(/\s{2,}/g, ' ')
                 .trim();

             const finalType = isCredit ? 'INCOME' : (isMSI ? 'MSI_CHARGE' : 'EXPENSE');

             results.push({
                 date: toISO(activeTx.day, activeTx.month),
                 description: finalDesc,
                 amount: activeTx.amount,
                 type: finalType,
                 suggestedCategory: '',
                 isMSI,
                 msiCurrentMonth,
                 msiTotalMonths,
                 msiTotalAmount: (isMSI && msiTotalMonths) ? activeTx.amount * msiTotalMonths : null
             });
        }
        activeTx = null;
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Evitar duplicar los meses sin intereses facturados en la sección del resumen
        if (line.includes('Resumen de Meses sin Intereses') || line.includes('Resumen de Recompensas')) {
            break; 
        }

        if (line === 'CR' && activeTx) {
             activeTx.isCredit = true;
             continue; 
        }

        const startMatch = line.match(TX_START_RE);
        if (startMatch) {
             pushActiveTx(); 

             const day = startMatch[1];
             const month = startMatch[2];
             let rest = startMatch[3].trim();

             let amount: number | undefined = undefined;
             const amountAtEnd = rest.match(/[\$]?([\d,]+\.\d{2})$/);
             if (amountAtEnd) {
                 amount = parseAmount(amountAtEnd[1]);
                 rest = rest.replace(/[\$]?([\d,]+\.\d{2})$/, '').trim();
             }

             activeTx = { day, month, desc: rest, amount };
             continue;
        }

        if (activeTx) {
            if (activeTx.amount !== undefined) {
                // Si la línea subsecuente es "CARGO X DE Y", agregarla a la descripción para que isMSI se active
                if (/CARGO\s+\d+\s+DE\s+\d+/i.test(line) || /^\s*\d+\s+de\s+\d+\s*$/i.test(line)) {
                    activeTx.desc += ' ' + line;
                }
                continue;
            }

            const exactAmount = line.match(/^[\$]?([\d,]+\.\d{2})$/);
            if (exactAmount) {
                activeTx.amount = parseAmount(exactAmount[1]);
                continue;
            }

            activeTx.desc += ' ' + line;
            
            const amountAtEndEnd = line.match(/\s+[\$]?([\d,]+\.\d{2})$/);
            if (amountAtEndEnd) {
                 activeTx.amount = parseAmount(amountAtEndEnd[1]);
                 activeTx.desc = activeTx.desc.replace(/\s+[\$]?([\d,]+\.\d{2})$/, '').trim();
            }
        }
    }
    pushActiveTx(); 

    return results;
}

// ── Parser genérico mejorado ───────────────────────────────────────────────────

export function parseGeneric(text: string): RawTransaction[] {
    const results: RawTransaction[] = [];
    const lines = cleanText(text).split('\n');

    // Fecha DD/MM/YYYY o DD/MM o DD-MES-YYYY o DD MES
    const DATE_RE = /\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b|\b(\d{1,2})\s+(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)\b/i;
    const AMOUNT_END_RE = /\$?\s*([\d]{1,3}(?:,\d{3})*\.\d{2})\s*$/;

    for (const line of lines) {
        if (line.length < 8 || line.length > 250) continue;

        const dateMatch = line.match(DATE_RE);
        if (!dateMatch) continue;

        const amountMatch = line.match(AMOUNT_END_RE);
        if (!amountMatch) continue;

        const amount = parseAmount(amountMatch[1]);
        if (amount <= 0 || amount > 9_999_999) continue;

        let date: string;
        if (dateMatch[4] && dateMatch[5]) {
            date = toISO(dateMatch[4], dateMatch[5]);
        } else {
            date = toISO(dateMatch[1], dateMatch[2], dateMatch[3]);
        }

        const dateEnd     = (dateMatch.index ?? 0) + dateMatch[0].length;
        const amountStart = line.length - amountMatch[0].length;
        const description = line.slice(dateEnd, amountStart).replace(/\$?\s*[\d,]+\.?\d*$/, '').trim();

        if (description.length < 2) continue;

        const type: 'INCOME' | 'EXPENSE' = INCOME_RE.test(description) ? 'INCOME' : 'EXPENSE';

        results.push({ date, description, amount, type, suggestedCategory: '' });
    }

    return results;
}

// ── Parser BBVA ───────────────────────────────────────────────────────────────
//
// Formato BBVA México (estado de cuenta PDF):
//   DD/MM/YYYY  DESCRIPCION DEL COMERCIO   +/-IMPORTE
//   o: DD/MM    DESCRIPCION   IMPORTE  SALDO
//
// También detecta: "CARGO", "ABONO", "COMPRA", líneas de movimientos tabulares

export function parseBBVA(text: string): RawTransaction[] {
    const results: RawTransaction[] = [];
    const lines = cleanText(text).split('\n');

    // Formato 1: DD/MM/YYYY o DD/MM al inicio de línea
    const DATE_RE = /^(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?\s+(.+)/;
    // Monto al final con posible signo + - o CR/DB
    const AMOUNT_END_RE = /([+-]?\s*\$?\s*[\d,]+\.\d{2})\s*(?:CR|DB|M\.N\.?)?\s*$/i;
    // Monto seguido de saldo (dos números al final)
    const AMOUNT_SALDO_RE = /\s+([+-]?\$?[\d,]+\.\d{2})\s+[+-]?\$?[\d,]+\.\d{2}\s*$/;

    const SKIP_RE = /^(fecha|descripci[oó]n|saldo|cargo|abono|movimiento|estado de cuenta|folio|referencia|total|p[aá]gina|pagina|n[uú]mero)/i;

    for (const line of lines) {
        if (!line.trim() || SKIP_RE.test(line.trim())) continue;
        if (line.length < 8 || line.length > 300) continue;

        const dateMatch = line.match(DATE_RE);
        if (!dateMatch) continue;

        const [, day, month, year, rest] = dateMatch;

        // Buscar monto: forma "DESCRIPCION  CARGO  SALDO" — tomar el primer monto
        const amountSaldo = rest.match(AMOUNT_SALDO_RE);
        const amountEnd   = rest.match(AMOUNT_END_RE);
        const amountMatch = amountSaldo || amountEnd;

        if (!amountMatch) continue;

        const rawAmt = amountMatch[1].replace(/\s/g, '');
        const amount = parseAmount(rawAmt.replace(/[+\-\$]/g, ''));
        if (amount <= 0 || amount > 9_999_999) continue;

        const description = rest
            .replace(amountMatch[0], '')
            .replace(/\$?[\d,]+\.\d{2}/g, '')
            .replace(/\s{2,}/g, ' ')
            .trim();

        if (description.length < 3) continue;

        // CR al final = abono/pago = INCOME
        const isCreditLine = /CR\s*$/i.test(line) || /abono|pago recibido|dep[oó]sito/i.test(description);
        const isDebit = /DB\s*$/i.test(line) || rawAmt.startsWith('-');
        const type: 'INCOME' | 'EXPENSE' = (isCreditLine && !isDebit) ? 'INCOME' : 'EXPENSE';

        results.push({
            date: toISO(day, month, year),
            description,
            amount,
            type,
            suggestedCategory: '',
        });
    }

    return results;
}

// ── Parser Liverpool ──────────────────────────────────────────────────────────
//
// Formato Liverpool (estado de cuenta tarjeta):
//   Fecha op.  Fecha liq.  DESCRIPCION          CARGO     ABONO
//   DD/MM/YYYY DD/MM/YYYY  NOMBRE COMERCIO  $X,XXX.XX
//   o líneas con: "DD/MM/YY DESCRIPCION $X,XXX.XX"

export function parseLiverpool(text: string): RawTransaction[] {
    const results: RawTransaction[] = [];
    const lines = cleanText(text).split('\n');

    // Liverpool suele tener fecha operación y fecha liquidación al inicio
    // Intentamos capturar: FECHA  FECHA2  DESCRIPCION  MONTO_CARGO  [MONTO_ABONO]
    const DOUBLE_DATE_RE = /^(\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?)\s+(\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?)\s+(.+)/;
    // Formato simple: solo una fecha al inicio
    const SINGLE_DATE_RE = /^(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})\s+(.+)/;
    const AMOUNT_RE      = /\$?\s*([\d,]+\.\d{2})/g;
    const SKIP_RE        = /^(fecha|descripci[oó]n|cargo|abono|saldo|folio|p[aá]gina|pago m[ií]nimo|l[ií]mite|liverpool)/i;

    for (const line of lines) {
        if (!line.trim() || SKIP_RE.test(line.trim())) continue;
        if (line.length < 10 || line.length > 300) continue;

        let rawDate: string;
        let rest: string;

        const doubleMatch = line.match(DOUBLE_DATE_RE);
        if (doubleMatch) {
            rawDate = doubleMatch[1];       // usar fecha operación
            rest    = doubleMatch[3].trim();
        } else {
            const singleMatch = line.match(SINGLE_DATE_RE);
            if (!singleMatch) continue;
            rawDate = singleMatch[1];
            rest    = singleMatch[2].trim();
        }

        // Extraer todos los montos en la línea
        const amounts: number[] = [];
        let m: RegExpExecArray | null;
        AMOUNT_RE.lastIndex = 0;
        while ((m = AMOUNT_RE.exec(rest)) !== null) {
            const v = parseAmount(m[1]);
            if (v > 0 && v < 9_999_999) amounts.push(v);
        }
        if (amounts.length === 0) continue;

        // Descripción = todo antes de los montos
        const description = rest
            .replace(/\$?\s*[\d,]+\.\d{2}/g, '')
            .replace(/\s{2,}/g, ' ')
            .trim();

        if (description.length < 3) continue;

        // Si hay dos montos (cargo y abono), tomar el cargo (primero)
        // Si la línea tiene "ABONO" o parece pago, es INCOME
        const amount = amounts[0];
        const isAbono = amounts.length >= 2
            ? amounts[1] > 0 && amounts[0] === 0   // abono en segunda columna
            : /abono|pago|devoluci[oó]n|reembolso/i.test(description);

        const type: 'INCOME' | 'EXPENSE' = isAbono ? 'INCOME' : 'EXPENSE';

        // Parsear fecha: DD/MM/YYYY o DD/MM/YY
        const dateParts = rawDate.split(/[\/\-]/);
        const isoDate = dateParts.length >= 3
            ? toISO(dateParts[0], dateParts[1], dateParts[2])
            : toISO(dateParts[0], dateParts[1]);

        results.push({ date: isoDate, description, amount, type, suggestedCategory: '' });
    }

    return results;
}

// ── Detectar banco ────────────────────────────────────────────────────────────

function detectBank(text: string): string {
    const u = text.toUpperCase();
    if (u.includes('AMERICAN EXPRESS') || u.includes('AMEX')) return 'AMEX';
    if (u.includes('BBVA'))              return 'BBVA';
    if (u.includes('BANORTE'))           return 'BANORTE';
    if (u.includes('MERCADO PAGO'))      return 'MERCADO_PAGO';
    if (u.includes('HSBC'))              return 'HSBC';
    if (u.includes('SANTANDER'))         return 'SANTANDER';
    if (u.includes('LIVERPOOL'))         return 'LIVERPOOL';
    if (u.includes('BANAMEX') || u.includes('CITIBANAMEX')) return 'BANAMEX';
    if (u.includes('SCOTIABANK'))        return 'SCOTIABANK';
    if (u.includes('INBURSA'))           return 'INBURSA';
    return 'GENERIC';
}

function detectAccountInfo(text: string, bank: string): {
    name?: string;
    type: 'BANK' | 'CREDIT' | 'INVESTMENT' | 'LOAN';
} {
    const isCreditCard = /tarjeta de cr[eé]dito|cr[eé]dito|american express|amex|liverpool/i.test(text);
    const type = isCreditCard ? 'CREDIT' : 'BANK';

    const nameMatch = text.match(/TITULAR[:\s]+([A-ZÁÉÍÓÚÑÜ ]{5,50})/i) ||
                      text.match(/S[EE][ÑN]OR(?:ITA|A)?[:\s]+([A-ZÁÉÍÓÚÑÜ ]{5,50})/i) ||
                      text.match(/NOMBRE[:\s]+([A-ZÁÉÍÓÚÑÜ ]{5,50})/i);

    return { name: nameMatch ? `${bank} – ${nameMatch[1].trim()}` : bank, type };
}

// ── Punto de entrada principal ─────────────────────────────────────────────────

export interface ParsedStatementResult {
    transactions:    RawTransaction[];
    bank:            string;
    detectedAccount: { name: string; type: 'BANK' | 'CREDIT' | 'INVESTMENT' | 'LOAN'; bank: string };
    parserUsed:      string;
}

export function parseStatement(rawText: string, userCategories: string[] = []): ParsedStatementResult {
    const text = cleanText(rawText);
    const bank = detectBank(text);
    const accountInfo = detectAccountInfo(text, bank);

    // Elegir el parser más adecuado
    let transactions: RawTransaction[] = [];
    let parserUsed = 'generic';

    if (bank === 'AMEX') {
        transactions = parseAMEX(text);
        parserUsed = 'amex';
    } else if (bank === 'BBVA') {
        transactions = parseBBVA(text);
        parserUsed = 'bbva';
    } else if (bank === 'LIVERPOOL') {
        transactions = parseLiverpool(text);
        parserUsed = 'liverpool';
    }

    // Si el parser específico no encontró suficiente, usar genérico
    if (transactions.length < 3) {
        const generic = parseGeneric(text);
        if (generic.length > transactions.length) {
            transactions = generic;
            parserUsed = `${parserUsed}_generic_fallback`;
        }
    }

    // Deduplicar
    const seen = new Set<string>();
    transactions = transactions.filter(t => {
        const key = `${t.date}|${t.description}|${t.amount}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    // Categorizar con keywords (sin LLM)
    transactions = transactions.map(t => ({
        ...t,
        suggestedCategory: suggestCategory(t.description, userCategories),
    }));

    return {
        transactions,
        bank,
        detectedAccount: {
            name: accountInfo.name ?? bank,
            type: accountInfo.type,
            bank,
        },
        parserUsed,
    };
}

