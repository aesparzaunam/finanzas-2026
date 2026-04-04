/**
 * lib/ai-utils.ts
 * ────────────────────────────────────────────────────────────────────────────
 * Cliente de inferencia unificado para Ollama via compatibilidad OpenAI API.
 * Contiene todos los prompts del sistema centralizados y optimizados.
 */

import OpenAI from 'openai';

// ── Configuración ─────────────────────────────────────────────────────────────
const LOCAL_LLM_URL        = process.env.LOCAL_LLM_URL        || 'http://localhost:11434/v1';
const LOCAL_LLM_MODEL_NAME = process.env.LOCAL_LLM_MODEL_NAME || 'qwen-claude';

export function getLocalLLMClient(): OpenAI {
    return new OpenAI({ baseURL: LOCAL_LLM_URL, apiKey: 'ollama' });
}

export function getLocalLLMModel(): string {
    return LOCAL_LLM_MODEL_NAME;
}

/**
 * Elimina bloques <think>...</think> que Qwen3 genera en thinking mode.
 * Devuelve solo la respuesta final limpia.
 */
export function stripThinking(raw: string): string {
    return raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

// ── Tipos compartidos ─────────────────────────────────────────────────────────

export interface ParsedTransactionAI {
    date:                 string;
    description:          string;
    amount:               number;
    type:                 'INCOME' | 'EXPENSE';
    suggestedCategory:    string;
    suggestedCategoryId?: string;
    isMSI:                boolean;
    msiCurrentMonth:      number | null;
    msiTotalMonths:       number | null;
    msiTotalAmount:       number | null;
}

export interface ImportResultAI {
    transactions:        ParsedTransactionAI[];
    bank:                string;
    totalFound:          number;
    source:              'csv' | 'excel' | 'pdf_ai';
    suggestedAccountId?: string;
    suggestedAccount?: {
        name: string;
        type: 'BANK' | 'CREDIT' | 'INVESTMENT' | 'LOAN';
        bank: string;
    };
    warnings?: string[];
}

// ── Prompt 1: Extracción de estados de cuenta ─────────────────────────────────
//
// Objetivo: extraer movimientos de un PDF/CSV bancario mexicano con OCR ruidoso.
// Mejoras vs. versión anterior:
//   - Instrucción explícita de robustez ante OCR ruidoso
//   - Guía de normalización de fechas ambiguas (dd/mm/YYYY → YYYY-MM-DD)
//   - Regla anti-alucinación: si no hay datos suficientes devolver array vacío
//   - Ejemplo de transacción MSI inline
//   - Separación clara entre reglas de cuenta y reglas de transacción

export function buildSystemPrompt(
    categories: { id: string; name: string }[],
    accounts:   { id: string; name: string; type: string }[]
): string {
    const categoryList = categories.length > 0
        ? categories.map(c => `"${c.name}"`).join(', ')
        : '"Supermercados","Restaurantes","Transporte","Servicios","Entretenimiento","Salud","Compras","Gasolina","Suscripciones","Educación","Vivienda","Ingresos","Otros"';

    const accountList = accounts.length > 0
        ? accounts.map(a => `{ "id": "${a.id}", "name": "${a.name}", "type": "${a.type}" }`).join(', ')
        : '[]';

    return `Eres un extractor financiero especializado en estados de cuenta bancarios y de tarjetas de crédito mexicanas.
Tu ÚNICA tarea: devolver un JSON estrictamente válido con los movimientos del documento.

## REGLAS ABSOLUTAS
- NO incluyas texto fuera del JSON.
- NO uses bloques de código markdown (no uses \`\`\`json).
- NO expliques, justifiques ni comentes nada.
- Si el documento no tiene movimientos claros, devuelve transactions=[].
- El JSON debe ser parseable directamente con JSON.parse().

## CONTEXTO DEL USUARIO
Cuentas existentes del usuario:
[${accountList}]

Categorías disponibles:
[${categoryList}]

## FORMATO DE RESPUESTA (devuelve EXACTAMENTE esto)
{
  "suggestedAccountId": "id_de_cuenta_existente_o_null",
  "detectedAccount": {
    "name": "Nombre descriptivo (ej: AMEX Platinum, BBVA Débito, Liverpool Crédito, Oro BBVA)",
    "type": "BANK|CREDIT|INVESTMENT|LOAN",
    "bank": "Institución (ej: AMEX, BBVA, Liverpool, Banorte, Mercado Pago, HSBC, Santander)"
  },
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "descripción limpia sin código de comercio ni caracteres raros",
      "amount": 123.45,
      "type": "EXPENSE|INCOME",
      "suggestedCategory": "una de las categorías listadas",
      "isMSI": false,
      "msiCurrentMonth": null,
      "msiTotalMonths": null
    }
  ]
}

## REGLAS DE CUENTA (detectedAccount)
- "suggestedAccountId": id de la cuenta existente que MEJOR coincida con el banco/emisor del documento. Si no coincide ninguna, pon null.
- "type" usa exactamente uno de estos valores:
    "BANK"       → cuenta de débito, chequera, nómina, CLABE o transferencia SPEI
    "CREDIT"     → tarjeta de crédito, departamental (Liverpool, Palacio, Coppel) o cartera de crédito
    "INVESTMENT" → inversión, fondos de inversión, CETES, cripto
    "LOAN"       → préstamo, hipoteca, crédito automotriz, crédito personal

## REGLAS DE TRANSACCIONES
- "date": formato YYYY-MM-DD. Si el documento usa dd/mm/YYYY, convierte. Año actual si falta.
- "description": texto limpio. Elimina: números de referencia, códigos de terminal, '*', exceso de espacios. Capitaliza correctamente.
- "amount": número positivo sin símbolo $. Usa punto decimal (no coma).
- "type": "EXPENSE" para cargos, compras, retiros, comisiones. "INCOME" para abonos, depósitos, devoluciones, pagos recibidos.
- "suggestedCategory": DEBE ser exactamente una de las categorías listadas. Si ninguna aplica usa "Otros".
- "isMSI": true SOLO si el texto indica explícitamente "meses sin intereses", "MSI", "diferido" o similar.
- Si isMSI=true: rellena msiCurrentMonth (mes actual del plan, ej: 1) y msiTotalMonths (total, ej: 12).
- Si isMSI=false: msiCurrentMonth y msiTotalMonths deben ser null.
- NO incluyas: saldos, totales, pagos mínimos, encabezados, fechas de corte. Solo movimientos individuales.

## ROBUSTEZ ANTE OCR
- El texto puede tener caracteres OCR corruptos (|, l→1, O→0). Infiere el valor correcto por contexto.
- Si una línea no es un movimiento claro (fecha + monto), ignórala.
- Si el monto parece inválido (negativo o cero), omite esa transacción.`;
}

// ── callLocalLLM ──────────────────────────────────────────────────────────────

/**
 * Llama a Ollama con el texto del documento y devuelve transacciones parseadas
 * junto con la cuenta detectada automáticamente.
 */
export async function callLocalLLM(
    documentText: string,
    categories:   { id: string; name: string }[],
    accounts:     { id: string; name: string; type: string }[]
): Promise<{
    transactions:      ParsedTransactionAI[];
    suggestedAccountId?: string;
    detectedAccount?: { name: string; type: 'BANK' | 'CREDIT' | 'INVESTMENT' | 'LOAN'; bank: string };
}> {
    const client       = getLocalLLMClient();
    const model        = getLocalLLMModel();
    const systemPrompt = buildSystemPrompt(categories, accounts);

    // Truncar a 12 000 caracteres para modelos con contexto limitado
    const truncatedText = documentText.length > 12000
        ? documentText.slice(0, 12000) + '\n[DOCUMENTO TRUNCADO - Extrae solo los movimientos visibles arriba]'
        : documentText;

    const response = await client.chat.completions.create({
        model,
        temperature: 0.0,        // determinístico: extracción de datos, no creatividad
        response_format: { type: 'json_object' },
        messages: [
            { role: 'system', content: systemPrompt },
            {
                role: 'user',
                content: `Extrae TODOS los movimientos individuales de este estado de cuenta. No incluyas saldos ni totales. Devuelve solo el JSON:\n\n${truncatedText}`,
            },
        ],
    });

    // Strip de thinking tokens de Qwen3 antes de parsear JSON
    const raw    = stripThinking(response.choices[0]?.message?.content ?? '{}') || '{}';
    let parsed: Record<string, unknown>;
    try {
        parsed = JSON.parse(raw);
    } catch {
        // Si devuelve JSON envuelto en markdown, intentar extraerlo
        const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
        parsed = match ? JSON.parse(match[1]) : {};
    }

    const rawTransactions: Record<string, unknown>[] = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed.transactions) ? parsed.transactions : [];

    const suggestedAccountId: string | undefined =
        typeof parsed.suggestedAccountId === 'string' && parsed.suggestedAccountId.trim()
            ? parsed.suggestedAccountId.trim()
            : undefined;

    const VALID_TYPES = ['BANK', 'CREDIT', 'INVESTMENT', 'LOAN'];
    const da = parsed.detectedAccount as Record<string, unknown> | undefined;
    const detectedAccount = da && typeof da.name === 'string' && da.name.trim()
        ? {
            name: da.name.trim(),
            type: VALID_TYPES.includes(String(da.type))
                ? da.type as 'BANK' | 'CREDIT' | 'INVESTMENT' | 'LOAN'
                : 'CREDIT' as const,
            bank: typeof da.bank === 'string' ? da.bank.trim() : '',
        }
        : undefined;

    const categoryMap = new Map(categories.map(c => [c.name.toLowerCase(), c.id]));

    const transactions: ParsedTransactionAI[] = rawTransactions
        .filter(item => item.amount && Number(item.amount) > 0) // descartar montos inválidos
        .map(item => {
            const catName    = String(item.suggestedCategory ?? '').trim();
            const catId      = categoryMap.get(catName.toLowerCase());
            const isMSI      = Boolean(item.isMSI);
            const amount     = Math.abs(Number(item.amount));
            const msiCurrent = isMSI && item.msiCurrentMonth ? Number(item.msiCurrentMonth) : null;
            const msiTotal   = isMSI && item.msiTotalMonths  ? Number(item.msiTotalMonths)  : null;

            return {
                date:                String(item.date || new Date().toISOString().slice(0, 10)),
                description:         String(item.description ?? '').trim(),
                amount,
                type:                item.type === 'INCOME' ? 'INCOME' : 'EXPENSE',
                suggestedCategory:   catName || 'Otros',
                suggestedCategoryId: catId,
                isMSI,
                msiCurrentMonth:     msiCurrent,
                msiTotalMonths:      msiTotal,
                msiTotalAmount:      isMSI && msiTotal ? Math.round(amount * msiTotal * 100) / 100 : null,
            };
        });

    return { transactions, suggestedAccountId, detectedAccount };
}

// ── Prompt 2: Detección y confirmación de suscripciones ───────────────────────
//
// Mejoras vs. versión anterior:
//   - Umbral explícito de intervalo (20–40 días = mensual, 6–8 días = semanal)
//   - Ejemplos concretos inline para few-shot guidance
//   - Diferencia explícita entre servicio recurrente vs. compra repetida
//   - Manejo del caso donde el array de respuesta está bajo una clave diferente

export interface SubscriptionCandidate {
    description: string;
    amount:      number;
    occurrences: number;
    avgInterval: number;
}

export interface ConfirmedSubscription {
    isSubscription: boolean;
    friendlyName:   string;
    categoryId?:    string;
    confidence:     number;
}

export async function confirmSubscriptions(
    candidates:  SubscriptionCandidate[],
    categories:  { id: string; name: string }[]
): Promise<ConfirmedSubscription[]> {
    if (candidates.length === 0) return [];

    const categoryList  = categories.map(c => `"${c.name}" (id:${c.id})`).join(', ');
    const candidateJSON = JSON.stringify(
        candidates.map((c, i) => ({
            index:          i,
            description:    c.description,
            amountMXN:      c.amount,
            occurrences:    c.occurrences,
            avgDaysBetween: c.avgInterval,
        })),
        null, 2
    );

    const systemPrompt = `Eres un detector de suscripciones y pagos recurrentes en extractos bancarios mexicanos.
Se te proporciona una lista de transacciones que se repiten en el historial del usuario.
Tu tarea: clasificar si cada una es una suscripción/membresía/servicio automático o simplemente una compra repetida.

## CATEGORÍAS DISPONIBLES
[${categoryList}]

## CRITERIOS DE CLASIFICACIÓN
- isSubscription=true si cumple al menos uno de estos criterios:
  • Nombre reconocible de servicio digital: Netflix, Spotify, Disney+, HBO, Apple, iCloud, Amazon, Zoom, Dropbox, Adobe, YouTube, ChatGPT, etc.
  • Membresía de gimnasio, club, asociación o seguro.
  • Monto fijo que se repite cada 25–35 días (ciclo mensual) o 360–370 días (anual).
  • Cargo automático de proveedor de servicios: agua, luz, gas, internet, teléfono, celular.
- isSubscription=false si:
  • Es una tienda física (Walmart, OXXO, gasolinera) que el usuario visita regularmente.
  • Es un restaurante o cafetería recurrente.
  • El monto varía significativamente entre ocurrencias (±20%).

## FORMATO DE RESPUESTA
Devuelve EXCLUSIVAMENTE un JSON array (sin texto adicional, sin markdown):
[
  {
    "index": 0,
    "isSubscription": true,
    "friendlyName": "Netflix",
    "categoryId": "id_o_null",
    "confidence": 0.97
  }
]

## EJEMPLOS
- "NETFLIX.COM" monto=$199 cada 30 días → isSubscription=true, friendlyName="Netflix", confidence=0.99
- "SPOTIFY" monto=$99 cada 30 días → isSubscription=true, friendlyName="Spotify", confidence=0.99
- "WALMART SUPERC" monto variable → isSubscription=false, confidence=0.05
- "GIMNASIO SPORT" monto fijo mensual → isSubscription=true, friendlyName="Gym Sport", confidence=0.85
- "TELMEX" cada mes → isSubscription=true, friendlyName="Telmex Internet", confidence=0.92

## REGLAS
- "friendlyName": nombre limpio y reconocible. Elimina números de referencia y asteriscos.
- "categoryId": id de la categoría más apropiada. null si ninguna aplica.
- "confidence": 0.0–1.0. >0.7 = alta certeza. 0.4–0.7 = probable. <0.4 = dudoso.
- Devuelve un objeto por cada elemento del array de entrada, en el mismo orden.
- NO omitas ningún índice.`;

    const fallback: ConfirmedSubscription[] = candidates.map(c => ({
        isSubscription: true,
        friendlyName:   c.description,
        confidence:     0.6,
    }));

    try {
        const client = getLocalLLMClient();
        const model  = getLocalLLMModel();

        const response = await client.chat.completions.create({
            model,
            temperature: 0.0,
            response_format: { type: 'json_object' },
            messages: [
                { role: 'system', content: systemPrompt },
                {
                    role: 'user',
                    content: `Analiza estos ${candidates.length} candidatos y devuelve el JSON array con un objeto por cada índice:\n${candidateJSON}`,
                },
            ],
        });

        const raw    = response.choices[0]?.message?.content ?? '[]';
        let parsed: unknown;
        try {
            parsed = JSON.parse(raw);
        } catch {
            const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
            parsed = match ? JSON.parse(match[1]) : [];
        }

        const items: {
            index: number;
            isSubscription: boolean;
            friendlyName: string;
            categoryId?: string;
            confidence: number;
        }[] = Array.isArray(parsed)
            ? parsed
            : (parsed as Record<string, unknown[]>).subscriptions
              ?? (parsed as Record<string, unknown[]>).items
              ?? (parsed as Record<string, unknown[]>).results
              ?? [];

        return candidates.map((_, i) => {
            const match = items.find(r => r.index === i);
            if (!match) return fallback[i];
            return {
                isSubscription: Boolean(match.isSubscription),
                friendlyName:   String(match.friendlyName || candidates[i].description),
                categoryId:     match.categoryId || undefined,
                confidence:     typeof match.confidence === 'number' ? match.confidence : 0.6,
            };
        });
    } catch (err) {
        console.error('[ai-utils] confirmSubscriptions error:', err);
        return fallback;
    }
}

// ── Prompt 3: Narrativa mensual de hogar (en household/summary/route.ts) ──────
//
// Este prompt está en app/api/household/summary/route.ts.
// Exportamos aquí la función para centralizar y poder reutilizarla.

export function buildHouseholdNarrativePrompt(): string {
    return `Eres un asesor financiero personal, amigable y empático. \
Escribes análisis narrativos concisos en español para parejas o familias mexicanas.

Tu tarea: redactar UN párrafo de 4–6 oraciones que resuma los gastos del hogar del mes.

## ESTRUCTURA DEL PÁRRAFO (sigue este orden)
1. Gasto total del hogar ese mes y si es alto, moderado o bajo según el contexto.
2. Quién gastó más y la diferencia porcentual entre ambos miembros.
3. Las 2–3 categorías con mayor gasto y montos aproximados.
4. Una observación positiva o una sugerencia concreta de mejora (sin alarmar).
5. Frase de cierre motivacional corta.

## REGLAS
- Usa prosa fluida. NO uses listas, viñetas ni subtítulos.
- Tono cálido, motivacional y sin juicios negativos.
- Menciona los nombres reales de los miembros si están disponibles.
- Usa pesos mexicanos (MXN / $). Formatea montos con 2 decimales.
- Máximo 120 palabras. Mínimo 60 palabras.
- No inventes datos que no estén en el contexto.`;
}


// ══════════════════════════════════════════════════════════════════════════════
// FASE 1: NUEVAS FUNCIONES DE IA
// ══════════════════════════════════════════════════════════════════════════════

// ── Prompt A: Categorización con IA (fallback cuando historial < 2 resultados)

export interface AiCategoryResult {
    categoryId:   string | null;
    categoryName: string;
    confidence:   number;
}

export async function categorizeSingle(
    description: string,
    categories:  { id: string; name: string; icon?: string }[]
): Promise<AiCategoryResult> {
    const catList = categories.map(c => `"${c.name}" (id:${c.id})`).join(', ');

    const systemPrompt = `Eres un categorizador financiero especializado en transacciones bancarias mexicanas.
Dado el texto de una transacción, devuelve la categoría más probable de la lista.
Responde SOLO con JSON válido: {"categoryId":"...","categoryName":"...","confidence":0.9}
NO incluyas texto adicional ni markdown.

Categorías disponibles: [${catList}]

Guía rápida para México:
- OXXO, 7Eleven, tienda → Supermercados o Compras
- Uber Eats, Rappi, DiDi Food, restaurante → Restaurantes
- Gasolinera, Pemex, Shell, BP → Gasolina
- Netflix, Spotify, Disney+, HBO, Apple → Suscripciones
- Farmacia, hospital, médico, dentista → Salud
- Uber, Didi, Cabify, metro, taxi → Transporte
- CFE, TELMEX, Totalplay, internet, agua, gas → Servicios
- Amazon, Mercado Libre, Shein, tienda departamental → Compras
- Gym, gimnasio, Sport City, Smart Fit → Salud o Entretenimiento
- Escuela, colegio, universidad → Educación
- SPEI recibido, nómina, salario → Ingresos
- Sin coincidencia clara → "Otros"`;

    try {
        const client = getLocalLLMClient();
        const model  = getLocalLLMModel();
        const response = await client.chat.completions.create({
            model,
            temperature: 0.0,
            response_format: { type: 'json_object' },
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user',   content: `Categoriza esta transacción: "${description}"` },
            ],
        });
        const raw    = response.choices[0]?.message?.content ?? '{}';
        const parsed = JSON.parse(raw);
        return {
            categoryId:   typeof parsed.categoryId === 'string' ? parsed.categoryId : null,
            categoryName: String(parsed.categoryName ?? 'Otros'),
            confidence:   typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
        };
    } catch {
        return { categoryId: null, categoryName: 'Otros', confidence: 0 };
    }
}

// ── Prompt B: Consejo mensual para el Dashboard ────────────────────────────────

export interface AiInsight {
    insight: string;
    type:    'WARNING' | 'TIP' | 'POSITIVE';
    icon:    string;
}

export async function generateMonthlyInsight(context: {
    month:              string;
    income:             number;
    expenses:           number;
    cashFlow:           number;
    dti:                number;
    savingsRate:        number;
    exceededBudgets:    { category: string; spent: number; limit: number }[];
    activeMsiCount:     number;
    activeMsiMonthly:   number;
    subscriptions:      number;
    subscriptionTotal:  number;
    topCategories:      { name: string; amount: number; vsLastMonth: number }[];
}): Promise<AiInsight> {
    const exceededStr = context.exceededBudgets.length > 0
        ? context.exceededBudgets.map(b => `${b.category}: $${b.spent.toFixed(0)} de $${b.limit.toFixed(0)}`).join('; ')
        : 'Ninguno';
    const topStr = context.topCategories
        .map(c => `${c.name}: $${c.amount.toFixed(0)} (${c.vsLastMonth >= 0 ? '+' : ''}${c.vsLastMonth.toFixed(0)}%)`)
        .join(', ');

    const systemPrompt = `Eres un asesor financiero personal experto en finanzas mexicanas. Eres directo, empático y práctico.
Tu tarea: analizar los datos del mes y generar UN consejo único, concreto y accionable (máx 2 oraciones).

Prioridad: 1) Presupuestos excedidos → alerta, 2) DTI>40% → advertencia deuda,
3) Flujo negativo → recortar gastos, 4) Suscripciones>$1000 → revisar,
5) Categoría +35% → señalarlo, 6) Todo bien → refuerzo positivo.

Devuelve SOLO JSON: {"insight":"...","type":"WARNING|TIP|POSITIVE","icon":"⚠️|💡|✅"}`;

    const userContent = `Mes: ${context.month}
Ingresos: $${context.income.toFixed(2)} | Gastos: $${context.expenses.toFixed(2)} | Flujo: $${context.cashFlow.toFixed(2)}
DTI: ${context.dti.toFixed(1)}% | Ahorro: ${context.savingsRate.toFixed(1)}%
Presupuestos excedidos: ${exceededStr}
MSI activos: ${context.activeMsiCount} ($${context.activeMsiMonthly.toFixed(0)}/mes)
Suscripciones: ${context.subscriptions} ($${context.subscriptionTotal.toFixed(0)}/mes)
Top gastos: ${topStr}`;

    const fallback: AiInsight = {
        insight: context.cashFlow >= 0
            ? `¡Vas por buen camino! Este mes lograste un superávit de $${context.cashFlow.toFixed(0)}.`
            : `Tus gastos superaron tus ingresos por $${Math.abs(context.cashFlow).toFixed(0)}. Revisa tus categorías principales.`,
        type: context.cashFlow >= 0 ? 'POSITIVE' : 'WARNING',
        icon: context.cashFlow >= 0 ? '✅' : '⚠️',
    };

    try {
        const client = getLocalLLMClient();
        const model  = getLocalLLMModel();
        const response = await client.chat.completions.create({
            model, temperature: 0.4, max_tokens: 150,
            response_format: { type: 'json_object' },
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user',   content: userContent },
            ],
        });
        const raw    = response.choices[0]?.message?.content ?? '{}';
        const parsed = JSON.parse(raw);
        if (!parsed.insight) return fallback;
        return {
            insight: String(parsed.insight),
            type:    ['WARNING','TIP','POSITIVE'].includes(parsed.type) ? parsed.type : 'TIP',
            icon:    String(parsed.icon ?? '💡'),
        };
    } catch { return fallback; }
}

// ── Prompt C: Narrativa mensual individual ─────────────────────────────────────

export function buildIndividualNarrativePrompt(): string {
    return `Eres un asesor financiero personal amigable y empático. Analistas financieros en español para usuarios mexicanos.

Tu tarea: redactar UN párrafo de 4–6 oraciones que resuma el mes financiero personal.

ESTRUCTURA: 1) Balance (ahorro o déficit), 2) Top 2–3 categorías con montos,
3) Dato llamativo (suscripciones, MSI, variación), 4) Sugerencia o refuerzo positivo,
5) Frase de cierre motivacional.

REGLAS: Prosa fluida, sin listas. Tono cálido. Pesos mexicanos ($). 60–130 palabras.
No inventes datos que no estén en el contexto.`;
}

// ── Prompt G: Auto-título para transacciones sin descripción ───────────────────

export interface AiAutoTitle {
    title:      string;
    confidence: number;
}

export async function generateTransactionTitle(context: {
    amount:       number;
    type:         'EXPENSE' | 'INCOME';
    categoryName: string;
    dayOfWeek:    string;
    accountName:  string;
}): Promise<AiAutoTitle> {
    const systemPrompt = `Genera un título corto (2–4 palabras) para una transacción bancaria mexicana sin descripción.
Basándote en monto, tipo, categoría y día de la semana, sugiere el tipo de gasto más probable.
Devuelve SOLO JSON: {"title":"Súper semanal","confidence":0.75}
Ejemplos: "Súper del lunes", "Gasolina semana", "Restaurante viernes", "Pago nómina"`;

    const fallback = context.type === 'INCOME' ? 'Ingreso recibido' : `${context.categoryName} ${context.dayOfWeek}`;

    try {
        const client = getLocalLLMClient();
        const model  = getLocalLLMModel();
        const response = await client.chat.completions.create({
            model, temperature: 0.3, max_tokens: 40,
            response_format: { type: 'json_object' },
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user',   content: `Tipo: ${context.type} | Monto: $${context.amount.toFixed(2)} | Categoría: ${context.categoryName} | Cuenta: ${context.accountName} | Día: ${context.dayOfWeek}` },
            ],
        });
        // Strip thinking mode de Qwen3 antes de parsear JSON
        const rawContent = stripThinking(response.choices[0]?.message?.content ?? '{}') || '{}';
        const parsed = JSON.parse(rawContent);
        return {
            title:      String(parsed.title ?? fallback),
            confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
        };
    } catch {
        return { title: fallback, confidence: 0 };
    }
}

// ── Prompt F: Chat financiero con contexto ─────────────────────────────────────

export function buildChatSystemPrompt(ctx: {
    month:             string;
    netWorth:          number;
    income:            number;
    expenses:          number;
    cashFlow:          number;
    dti:               number;
    savingsRate:       number;
    topCategories:     { name: string; amount: number }[];
    totalDebt:         number;
    activeMsiMonthly:  number;
    subscriptions:     number;
    subscriptionTotal: number;
    accounts:          { name: string; type: string; balance: number }[];
}): string {
    const accountsStr = ctx.accounts.map(a => `${a.name} (${a.type}): $${a.balance.toFixed(2)}`).join(', ');
    const topStr      = ctx.topCategories.map(c => `${c.name}: $${c.amount.toFixed(2)}`).join(', ');

    return `Eres "Fin", un asistente financiero personal integrado en Antigravity Finance.
Tienes acceso a los datos reales del usuario. Responde en español de forma concisa y útil.
NO inventes cifras. Si no tienes el dato, dilo honestamente.

DATOS FINANCIEROS — ${ctx.month}:
Patrimonio: $${ctx.netWorth.toFixed(2)} | Ingresos: $${ctx.income.toFixed(2)} | Gastos: $${ctx.expenses.toFixed(2)} | Flujo: $${ctx.cashFlow.toFixed(2)}
Ahorro: ${ctx.savingsRate.toFixed(1)}% | DTI: ${ctx.dti.toFixed(1)}% | Deuda total: $${ctx.totalDebt.toFixed(2)}
Cuentas: ${accountsStr}
Top gastos: ${topStr}
MSI mensuales: $${ctx.activeMsiMonthly.toFixed(2)} | Suscripciones: ${ctx.subscriptions} ($${ctx.subscriptionTotal.toFixed(2)}/mes)

Estilo: máx 3 párrafos. Listas solo si el usuario las pide. Tono amigable y directo.`;
}
