// scripts/append-ai-prompts.js
// Agrega los nuevos prompts de Fase 1 al final de ai-utils.ts
const fs = require('fs');
const path = require('path');

const target = path.join(process.cwd(), 'app', 'lib', 'ai-utils.ts');
const content = fs.readFileSync(target, 'utf8');

// No duplicar si ya está
if (content.includes('categorizeSingle')) {
    console.log('Prompts ya agregados, nada que hacer.');
    process.exit(0);
}

const additions = `

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
    const catList = categories.map(c => \`"\${c.name}" (id:\${c.id})\`).join(', ');

    const systemPrompt = \`Eres un categorizador financiero especializado en transacciones bancarias mexicanas.
Dado el texto de una transacción, devuelve la categoría más probable de la lista.
Responde SOLO con JSON válido: {"categoryId":"...","categoryName":"...","confidence":0.9}
NO incluyas texto adicional ni markdown.

Categorías disponibles: [\${catList}]

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
- Sin coincidencia clara → "Otros"\`;

    try {
        const client = getLocalLLMClient();
        const model  = getLocalLLMModel();
        const response = await client.chat.completions.create({
            model,
            temperature: 0.0,
            response_format: { type: 'json_object' },
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user',   content: \`Categoriza esta transacción: "\${description}"\` },
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
        ? context.exceededBudgets.map(b => \`\${b.category}: $\${b.spent.toFixed(0)} de $\${b.limit.toFixed(0)}\`).join('; ')
        : 'Ninguno';
    const topStr = context.topCategories
        .map(c => \`\${c.name}: $\${c.amount.toFixed(0)} (\${c.vsLastMonth >= 0 ? '+' : ''}\${c.vsLastMonth.toFixed(0)}%)\`)
        .join(', ');

    const systemPrompt = \`Eres un asesor financiero personal experto en finanzas mexicanas. Eres directo, empático y práctico.
Tu tarea: analizar los datos del mes y generar UN consejo único, concreto y accionable (máx 2 oraciones).

Prioridad: 1) Presupuestos excedidos → alerta, 2) DTI>40% → advertencia deuda,
3) Flujo negativo → recortar gastos, 4) Suscripciones>$1000 → revisar,
5) Categoría +35% → señalarlo, 6) Todo bien → refuerzo positivo.

Devuelve SOLO JSON: {"insight":"...","type":"WARNING|TIP|POSITIVE","icon":"⚠️|💡|✅"}\`;

    const userContent = \`Mes: \${context.month}
Ingresos: $\${context.income.toFixed(2)} | Gastos: $\${context.expenses.toFixed(2)} | Flujo: $\${context.cashFlow.toFixed(2)}
DTI: \${context.dti.toFixed(1)}% | Ahorro: \${context.savingsRate.toFixed(1)}%
Presupuestos excedidos: \${exceededStr}
MSI activos: \${context.activeMsiCount} ($\${context.activeMsiMonthly.toFixed(0)}/mes)
Suscripciones: \${context.subscriptions} ($\${context.subscriptionTotal.toFixed(0)}/mes)
Top gastos: \${topStr}\`;

    const fallback: AiInsight = {
        insight: context.cashFlow >= 0
            ? \`¡Vas por buen camino! Este mes lograste un superávit de $\${context.cashFlow.toFixed(0)}.\`
            : \`Tus gastos superaron tus ingresos por $\${Math.abs(context.cashFlow).toFixed(0)}. Revisa tus categorías principales.\`,
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
    return \`Eres un asesor financiero personal amigable y empático. Analistas financieros en español para usuarios mexicanos.

Tu tarea: redactar UN párrafo de 4–6 oraciones que resuma el mes financiero personal.

ESTRUCTURA: 1) Balance (ahorro o déficit), 2) Top 2–3 categorías con montos,
3) Dato llamativo (suscripciones, MSI, variación), 4) Sugerencia o refuerzo positivo,
5) Frase de cierre motivacional.

REGLAS: Prosa fluida, sin listas. Tono cálido. Pesos mexicanos ($). 60–130 palabras.
No inventes datos que no estén en el contexto.\`;
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
    const systemPrompt = \`Genera un título corto (2–4 palabras) para una transacción bancaria mexicana sin descripción.
Basándote en monto, tipo, categoría y día de la semana, sugiere el tipo de gasto más probable.
Devuelve SOLO JSON: {"title":"Súper semanal","confidence":0.75}
Ejemplos: "Súper del lunes", "Gasolina semana", "Restaurante viernes", "Pago nómina"\`;

    const fallback = context.type === 'INCOME' ? 'Ingreso recibido' : \`\${context.categoryName} \${context.dayOfWeek}\`;

    try {
        const client = getLocalLLMClient();
        const model  = getLocalLLMModel();
        const response = await client.chat.completions.create({
            model, temperature: 0.3, max_tokens: 40,
            response_format: { type: 'json_object' },
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user',   content: \`Tipo: \${context.type} | Monto: $\${context.amount.toFixed(2)} | Categoría: \${context.categoryName} | Cuenta: \${context.accountName} | Día: \${context.dayOfWeek}\` },
            ],
        });
        const raw    = response.choices[0]?.message?.content ?? '{}';
        const parsed = JSON.parse(raw);
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
    const accountsStr = ctx.accounts.map(a => \`\${a.name} (\${a.type}): $\${a.balance.toFixed(2)}\`).join(', ');
    const topStr      = ctx.topCategories.map(c => \`\${c.name}: $\${c.amount.toFixed(2)}\`).join(', ');

    return \`Eres "Fin", un asistente financiero personal integrado en Antigravity Finance.
Tienes acceso a los datos reales del usuario. Responde en español de forma concisa y útil.
NO inventes cifras. Si no tienes el dato, dilo honestamente.

DATOS FINANCIEROS — \${ctx.month}:
Patrimonio: $\${ctx.netWorth.toFixed(2)} | Ingresos: $\${ctx.income.toFixed(2)} | Gastos: $\${ctx.expenses.toFixed(2)} | Flujo: $\${ctx.cashFlow.toFixed(2)}
Ahorro: \${ctx.savingsRate.toFixed(1)}% | DTI: \${ctx.dti.toFixed(1)}% | Deuda total: $\${ctx.totalDebt.toFixed(2)}
Cuentas: \${accountsStr}
Top gastos: \${topStr}
MSI mensuales: $\${ctx.activeMsiMonthly.toFixed(2)} | Suscripciones: \${ctx.subscriptions} ($\${ctx.subscriptionTotal.toFixed(2)}/mes)

Estilo: máx 3 párrafos. Listas solo si el usuario las pide. Tono amigable y directo.\`;
}
`;

fs.appendFileSync(target, additions, 'utf8');
console.log('✅ Prompts de Fase 1 agregados a ai-utils.ts');
