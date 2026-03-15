export type AccountType = 'BANK' | 'CASH' | 'CREDIT' | 'INVESTMENT' | 'LOAN';
export type TransactionType = 'INCOME' | 'EXPENSE' | 'TRANSFER' | 'MSI_CHARGE';
export type BudgetPeriod = 'MONTHLY' | 'YEARLY';

export interface User {
    id: string;
    name: string;
    email: string;
    createdAt: string;
    updatedAt: string;
}

export interface Account {
    id: string;
    userId: string;
    name: string;
    type: AccountType;
    balance: number;
    currency: string;
    // For CREDIT accounts
    billingDay?: number; 
    paymentDay?: number;
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
