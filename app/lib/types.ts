export type AccountType = 'BANK' | 'CASH' | 'CREDIT' | 'INVESTMENT' | 'LOAN';
export type AccountRole = 'OWNER' | 'EDITOR' | 'VIEWER';

export interface AccountAccess {
    id: string;
    userId: string;      // quien tiene el acceso
    accountId: string;
    role: AccountRole;
    grantedBy: string;   // userId del OWNER
    createdAt: string;
}
export type TransactionType = 'INCOME' | 'EXPENSE' | 'TRANSFER' | 'MSI_CHARGE';
export type BudgetPeriod = 'MONTHLY' | 'YEARLY';

export interface User {
    id: string;
    name: string;
    email: string;
    familyId?: string;   // Fase 3: agrupar usuarios en un hogar
    createdAt: string;
    updatedAt: string;
}

export interface Account {
    id: string;
    userId: string;             // ownerId — quien creó la cuenta
    name: string;
    type: AccountType;
    balance: number;
    currency: string;
    // For CREDIT / LOAN accounts — Fase 1
    billingDay?: number;
    paymentDay?: number;
    annualRate?: number;        // CAT anual en % (ej: 45.5)
    minPayment?: number;        // Pago mínimo mensual
    interestStartDate?: string; // Fecha desde la que empieza a acumularse interés
    // Colaboración — Fase 3
    isShared?: boolean;         // Si true, otros usuarios con AccountAccess pueden verla
    createdAt: string;
    updatedAt: string;
}

export type RecurringFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

export interface RecurringPayment {
    id: string;
    userId: string;
    name: string;
    amount: number;
    categoryId: string | null;
    accountId: string;
    frequency: RecurringFrequency;
    startDate: string;
    nextPaymentDate: string;
    lastPaidAt?: string;         // ISO date — last time advance was called
    status: 'ACTIVE' | 'PAUSED' | 'CANCELLED';
    createdAt: string;
    updatedAt: string;
}

export interface HormigaAnalysis {
    categoryName: string;
    count: number;
    totalAmount: number;
    hasFlag: boolean;
}

export interface DebtRatioData {
    avgIncome: number;
    fixedLiabilities: number;
    ratio: number; // 0 to 1
    isWarning: boolean;
}

export interface TimelinePoint {
    date: string;
    balance: number;
    income?: number;
    expense?: number;
    isImportantPayment?: boolean;
    paymentDescription?: string;
}

export interface Category {
    id: string;
    userId: string;
    name: string;
    type: 'INCOME' | 'EXPENSE';
    icon: string;
    color: string;
    createdAt: string;
    updatedAt: string;
}


export interface Transaction {
    id: string;
    userId: string;
    accountId: string;
    categoryId: string | null;
    amount: number;
    type: TransactionType;
    date: string;
    description: string;
    msiPlanId?: string | null;
    isParent?: boolean;
    parentId?: string | null;
    // Fase 1: trazabilidad y deducibilidad
    createdById?: string;       // userId de quien registró (puede diferir si cuenta es shared)
    isDeductible?: boolean;     // ¿Es deducible de impuestos?
    toAccountId?: string;           // Para TRANSFER / PAGO_TARJETA
    recurringPaymentId?: string;    // Vínculo al pago recurrente que originó esta transacción
    createdAt: string;
    updatedAt: string;
}

export interface Budget {
    id: string;
    userId: string;
    categoryId: string;
    amount: number;
    period: BudgetPeriod;
    enableCarryOver: boolean;
    carryOverAmount: number;
    lastCarryOverAt: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface MSIPlan {
    id: string;
    userId: string;
    totalAmount: number;
    months: number;
    monthlyAmount: number;
    startDate: string;
    description: string;
    accountId: string;
    categoryId: string | null;
    status: 'ACTIVE' | 'PAID' | 'CANCELLED';
    paidMonths: number;
    createdAt: string;
    updatedAt: string;
}

// ── Finanzas Compartidas ───────────────────────────────────────────────────────

export type HouseholdRole   = 'OWNER' | 'PARTNER';
export type HouseholdStatus = 'PENDING' | 'ACTIVE' | 'DISSOLVED';

export interface Household {
    id:             string;
    ownerUserId:    string;
    ownerEmail:     string;
    ownerName:      string;
    partnerUserId:  string;
    partnerEmail:   string;
    partnerName:    string;
    status:         HouseholdStatus;
    createdAt:      string;
    updatedAt:      string;
}

/** Transacción enriquecida con info del miembro, para la vista combinada del hogar */
export interface HouseholdTransaction extends Transaction {
    member:     HouseholdRole;
    memberName: string;
}

export interface HouseholdCategoryBreakdown {
    categoryId:    string;
    categoryName:  string;
    categoryIcon:  string;
    ownerAmount:   number;
    partnerAmount: number;
}

export interface HouseholdSummary {
    month:          string;          // YYYY-MM
    totalByMember:  { owner: number; partner: number };
    byCategory:     HouseholdCategoryBreakdown[];
    topCategories:  string[];
    narrative:      string;          // texto generado por Ollama
    ownerName:      string;
    partnerName:    string;
}
