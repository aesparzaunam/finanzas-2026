/**
 * app/lib/db.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Capa de acceso a datos SQLite (better-sqlite3).
 * Reemplaza completamente a Firebase Admin SDK.
 *
 * Optimizaciones:
 *  - Prepared statements cacheados en Map (evita re-parse en cada request)
 *  - Pragmas de performance: WAL, cache 64 MB, mmap 256 MB, temp en RAM
 *  - Limit máximo de transacciones: 500 (suficiente para analytics en-memoria)
 *  - Queries de agregación directas en SQL (sin filtrado post-fetch)
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Database = require('better-sqlite3');
import path from 'path';
import { randomBytes } from 'crypto';

// ── Singleton de conexión ─────────────────────────────────────────────────────

const DB_PATH = process.env.DATABASE_URL?.replace('file:', '') ??
    path.join(process.cwd(), 'prisma', 'finanzas.db');

let _db: ReturnType<typeof Database> | null = null;

function getDb() {
    if (!_db) {
        _db = new Database(DB_PATH);
        // Performance pragmas
        _db.pragma('journal_mode = WAL');
        _db.pragma('foreign_keys = ON');
        _db.pragma('synchronous = NORMAL');       // safe + fast (WAL mode)
        _db.pragma('cache_size = -65536');         // 64 MB page cache
        _db.pragma('temp_store = MEMORY');         // temp tables in RAM
        _db.pragma('mmap_size = 268435456');       // 256 MB memory-mapped I/O
        _db.pragma('wal_autocheckpoint = 1000');   // checkpoint every 1000 pages
    }
    return _db;
}

// ── Caché de prepared statements ──────────────────────────────────────────────
// Re-usar statements compilados evita que SQLite re-parsee el SQL en cada request
const stmtCache = new Map<string, ReturnType<typeof Database.prototype.prepare>>();

function stmt(sql: string) {
    if (!stmtCache.has(sql)) {
        stmtCache.set(sql, getDb().prepare(sql));
    }
    return stmtCache.get(sql)!;
}

// ── Utilidades ────────────────────────────────────────────────────────────────

export function cuid(): string {
    return 'c' + randomBytes(11).toString('hex');
}

function now(): string {
    return new Date().toISOString();
}

// ── USERS ─────────────────────────────────────────────────────────────────────

export interface DbUser {
    id: string; name: string; email: string; password: string;
    avatar?: string | null; createdAt: string; updatedAt: string;
}

export async function findUserByEmail(email: string): Promise<DbUser | null> {
    return stmt('SELECT * FROM User WHERE email = ?').get(email) ?? null;
}

export async function findUserById(id: string): Promise<DbUser | null> {
    return stmt('SELECT * FROM User WHERE id = ?').get(id) ?? null;
}

export async function createUser(data: { name: string; email: string; password: string }): Promise<DbUser> {
    const db = getDb();
    const id = cuid(); const ts = now();
    stmt('INSERT INTO User (id,name,email,password,createdAt,updatedAt) VALUES (?,?,?,?,?,?)')
        .run(id, data.name, data.email, data.password, ts, ts);
    return stmt('SELECT * FROM User WHERE id = ?').get(id) as DbUser;
}

// ── ACCOUNTS ──────────────────────────────────────────────────────────────────

export interface DbAccount {
    id: string; userId: string; name: string; type: string; typeLabel: string;
    bank: string; balance: number; currency: string; isDefault: number; isShared: number;
    autoDetected: number; billingDay?: number | null; paymentDay?: number | null;
    annualRate?: number | null; minPayment?: number | null; interestStartDate?: string | null;
    color?: string | null; icon?: string | null; createdAt: string; updatedAt: string;
}

export async function getAccounts(userId: string): Promise<DbAccount[]> {
    return stmt('SELECT * FROM Account WHERE userId = ? ORDER BY name').all(userId);
}

export async function getAccountById(id: string, userId: string): Promise<DbAccount | null> {
    return stmt('SELECT * FROM Account WHERE id = ? AND userId = ?').get(id, userId) ?? null;
}

export async function createAccount(userId: string, data: Partial<DbAccount>): Promise<DbAccount> {
    const id = cuid(); const ts = now();
    stmt(`INSERT INTO Account (id,userId,name,type,typeLabel,bank,balance,currency,isDefault,isShared,autoDetected,billingDay,paymentDay,annualRate,minPayment,interestStartDate,color,icon,createdAt,updatedAt)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(id, userId, data.name ?? '', data.type ?? 'BANK', data.typeLabel ?? '', data.bank ?? '',
            data.balance ?? 0, data.currency ?? 'MXN', data.isDefault ?? 0, data.isShared ?? 0,
            data.autoDetected ?? 0, data.billingDay ?? null, data.paymentDay ?? null,
            data.annualRate ?? null, data.minPayment ?? null, data.interestStartDate ?? null,
            data.color ?? null, data.icon ?? null, ts, ts);
    return stmt('SELECT * FROM Account WHERE id = ?').get(id) as DbAccount;
}

export async function updateAccount(id: string, userId: string, data: Partial<DbAccount>): Promise<DbAccount | null> {
    const existing = await getAccountById(id, userId);
    if (!existing) return null;
    const m = { ...existing, ...data, updatedAt: now() };
    stmt(`UPDATE Account SET name=?,type=?,typeLabel=?,bank=?,balance=?,currency=?,isDefault=?,isShared=?,billingDay=?,paymentDay=?,annualRate=?,minPayment=?,interestStartDate=?,color=?,icon=?,updatedAt=? WHERE id=? AND userId=?`)
        .run(m.name, m.type, m.typeLabel, m.bank, m.balance, m.currency,
            m.isDefault, m.isShared, m.billingDay, m.paymentDay, m.annualRate,
            m.minPayment, m.interestStartDate, m.color, m.icon, m.updatedAt, id, userId);
    return stmt('SELECT * FROM Account WHERE id = ?').get(id) as DbAccount;
}

export async function deleteAccount(id: string, userId: string): Promise<boolean> {
    return stmt('DELETE FROM Account WHERE id = ? AND userId = ?').run(id, userId).changes > 0;
}

// ── CATEGORIES ────────────────────────────────────────────────────────────────

export interface DbCategory {
    id: string; userId: string; name: string; type: string;
    icon: string; color: string; createdAt: string; updatedAt: string;
}

export async function getCategories(userId: string): Promise<DbCategory[]> {
    return stmt('SELECT * FROM Category WHERE userId = ? ORDER BY name').all(userId);
}

export async function getCategoryById(id: string, userId: string): Promise<DbCategory | null> {
    return stmt('SELECT * FROM Category WHERE id = ? AND userId = ?').get(id, userId) ?? null;
}

export async function createCategory(userId: string, data: Partial<DbCategory>): Promise<DbCategory> {
    const id = cuid(); const ts = now();
    stmt('INSERT INTO Category (id,userId,name,type,icon,color,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?)')
        .run(id, userId, data.name ?? '', data.type ?? 'EXPENSE', data.icon ?? 'tag', data.color ?? '#6366f1', ts, ts);
    return stmt('SELECT * FROM Category WHERE id = ?').get(id) as DbCategory;
}

export async function updateCategory(id: string, userId: string, data: Partial<DbCategory>): Promise<DbCategory | null> {
    const existing = await getCategoryById(id, userId);
    if (!existing) return null;
    const m = { ...existing, ...data };
    stmt('UPDATE Category SET name=?,type=?,icon=?,color=?,updatedAt=? WHERE id=? AND userId=?')
        .run(m.name, m.type, m.icon, m.color, now(), id, userId);
    return stmt('SELECT * FROM Category WHERE id = ?').get(id) as DbCategory;
}

export async function deleteCategory(id: string, userId: string): Promise<boolean> {
    return stmt('DELETE FROM Category WHERE id = ? AND userId = ?').run(id, userId).changes > 0;
}

// ── TRANSACTIONS ──────────────────────────────────────────────────────────────

export interface DbTransaction {
    id: string; userId: string; accountId: string; categoryId?: string | null;
    amount: number; type: string; date: string; description: string;
    notes?: string | null; tags?: string | null; msiPlanId?: string | null;
    isParent: number; parentId?: string | null; toAccountId?: string | null;
    recurringPaymentId?: string | null; isDeductible: number;
    createdById?: string | null; importSource?: string | null;
    createdAt: string; updatedAt: string;
}

export interface TransactionFilter {
    limit?: number; afterDate?: string; fromDate?: string; toDate?: string;
    type?: string; accountId?: string; categoryId?: string; q?: string;
}

export async function getTransactions(
    userId: string,
    filter: TransactionFilter = {}
): Promise<{ transactions: DbTransaction[]; hasMore: boolean }> {
    const limit = Math.min(filter.limit ?? 50, 500);
    const conditions: string[] = ['userId = ?'];
    const params: (string | number)[] = [userId];

    if (filter.type)       { conditions.push('type = ?');       params.push(filter.type); }
    if (filter.accountId)  { conditions.push('accountId = ?');  params.push(filter.accountId); }
    if (filter.categoryId) { conditions.push('categoryId = ?'); params.push(filter.categoryId); }
    if (filter.fromDate)   { conditions.push('date >= ?');      params.push(filter.fromDate); }
    if (filter.toDate)     { conditions.push('date <= ?');      params.push(filter.toDate); }
    if (filter.afterDate)  { conditions.push('date < ?');       params.push(filter.afterDate); }
    if (filter.q)          { conditions.push("description LIKE ?"); params.push(`%${filter.q}%`); }

    // Build SQL with exact filter combo (statement cache per unique WHERE clause)
    const where = conditions.join(' AND ');
    const sql = `SELECT * FROM NTransaction WHERE ${where} ORDER BY date DESC LIMIT ?`;
    const rows = getDb().prepare(sql).all(...params, limit + 1) as DbTransaction[];

    const hasMore = rows.length > limit;
    return { transactions: rows.slice(0, limit), hasMore };
}

export async function getTransactionById(id: string, userId: string): Promise<DbTransaction | null> {
    return stmt('SELECT * FROM NTransaction WHERE id = ? AND userId = ?').get(id, userId) ?? null;
}

export async function createTransaction(userId: string, data: Partial<DbTransaction>): Promise<DbTransaction> {
    const id = cuid(); const ts = now();
    stmt(`INSERT INTO NTransaction (id,userId,accountId,categoryId,amount,type,date,description,notes,tags,msiPlanId,isParent,parentId,toAccountId,recurringPaymentId,isDeductible,createdById,importSource,createdAt,updatedAt)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(id, userId, data.accountId ?? '', data.categoryId ?? null, data.amount ?? 0,
            data.type ?? 'EXPENSE', data.date ?? new Date().toISOString().slice(0, 10),
            data.description ?? '', data.notes ?? null, data.tags ?? null, data.msiPlanId ?? null,
            data.isParent ?? 0, data.parentId ?? null, data.toAccountId ?? null,
            data.recurringPaymentId ?? null, data.isDeductible ?? 0,
            data.createdById ?? null, data.importSource ?? null, ts, ts);
    return stmt('SELECT * FROM NTransaction WHERE id = ?').get(id) as DbTransaction;
}

export async function updateTransaction(id: string, userId: string, data: Partial<DbTransaction>): Promise<DbTransaction | null> {
    const existing = await getTransactionById(id, userId);
    if (!existing) return null;
    const m = { ...existing, ...data };
    stmt(`UPDATE NTransaction SET accountId=?,categoryId=?,amount=?,type=?,date=?,description=?,notes=?,tags=?,msiPlanId=?,isParent=?,parentId=?,toAccountId=?,recurringPaymentId=?,isDeductible=?,updatedAt=? WHERE id=? AND userId=?`)
        .run(m.accountId, m.categoryId, m.amount, m.type, m.date, m.description, m.notes,
            m.tags, m.msiPlanId, m.isParent, m.parentId, m.toAccountId,
            m.recurringPaymentId, m.isDeductible, now(), id, userId);
    return stmt('SELECT * FROM NTransaction WHERE id = ?').get(id) as DbTransaction;
}

export async function deleteTransaction(id: string, userId: string): Promise<boolean> {
    return stmt('DELETE FROM NTransaction WHERE id = ? AND userId = ?').run(id, userId).changes > 0;
}

export async function bulkCreateTransactions(userId: string, transactions: Partial<DbTransaction>[]): Promise<number> {
    const db = getDb();
    const insert = db.prepare(`INSERT OR IGNORE INTO NTransaction (id,userId,accountId,categoryId,amount,type,date,description,notes,tags,msiPlanId,isParent,parentId,toAccountId,recurringPaymentId,isDeductible,createdById,importSource,createdAt,updatedAt)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    const insertMany = db.transaction((txs: Partial<DbTransaction>[]) => {
        let count = 0;
        for (const data of txs) {
            const id = cuid(); const ts = now();
            insert.run(id, userId, data.accountId ?? '', data.categoryId ?? null, data.amount ?? 0,
                data.type ?? 'EXPENSE', data.date ?? new Date().toISOString().slice(0, 10),
                data.description ?? '', data.notes ?? null, data.tags ?? null, data.msiPlanId ?? null,
                data.isParent ?? 0, data.parentId ?? null, data.toAccountId ?? null,
                data.recurringPaymentId ?? null, data.isDeductible ?? 0,
                data.createdById ?? null, data.importSource ?? null, ts, ts);
            count++;
        }
        return count;
    });
    return insertMany(transactions);
}

// ── BUDGETS ───────────────────────────────────────────────────────────────────

export interface DbBudget {
    id: string; userId: string; categoryId: string; amount: number;
    period: string; enableCarryOver: number; carryOverAmount: number;
    lastCarryOverAt?: string | null; createdAt: string; updatedAt: string;
}

export async function getBudgets(userId: string): Promise<DbBudget[]> {
    return stmt('SELECT * FROM Budget WHERE userId = ?').all(userId);
}

export async function getBudgetById(id: string, userId: string): Promise<DbBudget | null> {
    return stmt('SELECT * FROM Budget WHERE id = ? AND userId = ?').get(id, userId) ?? null;
}

export async function upsertBudget(userId: string, categoryId: string, data: Partial<DbBudget>): Promise<DbBudget> {
    const db = getDb();
    const existing = stmt('SELECT * FROM Budget WHERE userId = ? AND categoryId = ?').get(userId, categoryId) as DbBudget | undefined;
    if (existing) {
        stmt('UPDATE Budget SET amount=?,period=?,enableCarryOver=?,carryOverAmount=?,lastCarryOverAt=?,updatedAt=? WHERE id=?')
            .run(data.amount ?? existing.amount, data.period ?? existing.period,
                data.enableCarryOver ?? existing.enableCarryOver, data.carryOverAmount ?? existing.carryOverAmount,
                data.lastCarryOverAt ?? existing.lastCarryOverAt, now(), existing.id);
        return stmt('SELECT * FROM Budget WHERE id = ?').get(existing.id) as DbBudget;
    }
    const id = cuid(); const ts = now();
    stmt('INSERT INTO Budget (id,userId,categoryId,amount,period,enableCarryOver,carryOverAmount,lastCarryOverAt,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?)')
        .run(id, userId, categoryId, data.amount ?? 0, data.period ?? 'MONTHLY',
            data.enableCarryOver ?? 0, data.carryOverAmount ?? 0, data.lastCarryOverAt ?? null, ts, ts);
    return stmt('SELECT * FROM Budget WHERE id = ?').get(id) as DbBudget;
}

export async function deleteBudget(id: string, userId: string): Promise<boolean> {
    return stmt('DELETE FROM Budget WHERE id = ? AND userId = ?').run(id, userId).changes > 0;
}

// ── MSI PLANS ─────────────────────────────────────────────────────────────────

export interface DbMsiPlan {
    id: string; userId: string; accountId: string; categoryId?: string | null;
    totalAmount: number; months: number; monthlyAmount: number; startDate: string;
    description: string; status: string; paidMonths: number;
    createdAt: string; updatedAt: string;
}

export async function getMsiPlans(userId: string, status?: string): Promise<DbMsiPlan[]> {
    if (status) {
        return stmt('SELECT * FROM MsiPlan WHERE userId = ? AND status = ? ORDER BY createdAt DESC').all(userId, status);
    }
    return stmt('SELECT * FROM MsiPlan WHERE userId = ? ORDER BY createdAt DESC').all(userId);
}

export async function getMsiPlanById(id: string, userId: string): Promise<DbMsiPlan | null> {
    return stmt('SELECT * FROM MsiPlan WHERE id = ? AND userId = ?').get(id, userId) ?? null;
}

export async function createMsiPlan(userId: string, data: Partial<DbMsiPlan>): Promise<DbMsiPlan> {
    const id = cuid(); const ts = now();
    stmt('INSERT INTO MsiPlan (id,userId,accountId,categoryId,totalAmount,months,monthlyAmount,startDate,description,status,paidMonths,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)')
        .run(id, userId, data.accountId ?? '', data.categoryId ?? null, data.totalAmount ?? 0,
            data.months ?? 1, data.monthlyAmount ?? 0, data.startDate ?? '', data.description ?? '',
            data.status ?? 'ACTIVE', data.paidMonths ?? 0, ts, ts);
    return stmt('SELECT * FROM MsiPlan WHERE id = ?').get(id) as DbMsiPlan;
}

export async function updateMsiPlan(id: string, userId: string, data: Partial<DbMsiPlan>): Promise<DbMsiPlan | null> {
    const existing = await getMsiPlanById(id, userId);
    if (!existing) return null;
    const m = { ...existing, ...data };
    stmt('UPDATE MsiPlan SET accountId=?,categoryId=?,totalAmount=?,months=?,monthlyAmount=?,startDate=?,description=?,status=?,paidMonths=?,updatedAt=? WHERE id=? AND userId=?')
        .run(m.accountId, m.categoryId, m.totalAmount, m.months, m.monthlyAmount,
            m.startDate, m.description, m.status, m.paidMonths, now(), id, userId);
    return stmt('SELECT * FROM MsiPlan WHERE id = ?').get(id) as DbMsiPlan;
}

export async function deleteMsiPlan(id: string, userId: string): Promise<boolean> {
    return stmt('DELETE FROM MsiPlan WHERE id = ? AND userId = ?').run(id, userId).changes > 0;
}

// ── RECURRING PAYMENTS ────────────────────────────────────────────────────────

export interface DbRecurringPayment {
    id: string; userId: string; accountId: string; categoryId?: string | null;
    name: string; amount: number; frequency: string; startDate: string;
    nextPaymentDate: string; lastPaidAt?: string | null; status: string;
    createdAt: string; updatedAt: string;
}

export async function getRecurringPayments(userId: string, status?: string): Promise<DbRecurringPayment[]> {
    if (status) {
        return stmt('SELECT * FROM RecurringPayment WHERE userId = ? AND status = ? ORDER BY nextPaymentDate').all(userId, status);
    }
    return stmt('SELECT * FROM RecurringPayment WHERE userId = ? ORDER BY nextPaymentDate').all(userId);
}

export async function getRecurringPaymentById(id: string, userId: string): Promise<DbRecurringPayment | null> {
    return stmt('SELECT * FROM RecurringPayment WHERE id = ? AND userId = ?').get(id, userId) ?? null;
}

export async function createRecurringPayment(userId: string, data: Partial<DbRecurringPayment>): Promise<DbRecurringPayment> {
    const id = cuid(); const ts = now();
    stmt('INSERT INTO RecurringPayment (id,userId,accountId,categoryId,name,amount,frequency,startDate,nextPaymentDate,lastPaidAt,status,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)')
        .run(id, userId, data.accountId ?? '', data.categoryId ?? null, data.name ?? '',
            data.amount ?? 0, data.frequency ?? 'MONTHLY', data.startDate ?? '',
            data.nextPaymentDate ?? '', data.lastPaidAt ?? null, data.status ?? 'ACTIVE', ts, ts);
    return stmt('SELECT * FROM RecurringPayment WHERE id = ?').get(id) as DbRecurringPayment;
}

export async function updateRecurringPayment(id: string, userId: string, data: Partial<DbRecurringPayment>): Promise<DbRecurringPayment | null> {
    const existing = await getRecurringPaymentById(id, userId);
    if (!existing) return null;
    const m = { ...existing, ...data };
    stmt('UPDATE RecurringPayment SET accountId=?,categoryId=?,name=?,amount=?,frequency=?,startDate=?,nextPaymentDate=?,lastPaidAt=?,status=?,updatedAt=? WHERE id=? AND userId=?')
        .run(m.accountId, m.categoryId, m.name, m.amount, m.frequency,
            m.startDate, m.nextPaymentDate, m.lastPaidAt, m.status, now(), id, userId);
    return stmt('SELECT * FROM RecurringPayment WHERE id = ?').get(id) as DbRecurringPayment;
}

export async function deleteRecurringPayment(id: string, userId: string): Promise<boolean> {
    return stmt('DELETE FROM RecurringPayment WHERE id = ? AND userId = ?').run(id, userId).changes > 0;
}

// ── DASHBOARD AGGREGATIONS (SQL puro — sin fetch+filter en JS) ───────────────

export async function getMonthSummary(userId: string, year: number, month: number) {
    const from = `${year}-${String(month).padStart(2, '0')}-01`;
    const to   = `${year}-${String(month).padStart(2, '0')}-31`;

    const rows = stmt(
        `SELECT type, SUM(amount) as total FROM NTransaction
         WHERE userId=? AND date >= ? AND date <= ? AND type IN ('INCOME','EXPENSE') GROUP BY type`
    ).all(userId, from, to) as { type: string; total: number }[];

    const income  = rows.find(r => r.type === 'INCOME')?.total  ?? 0;
    const expense = rows.find(r => r.type === 'EXPENSE')?.total ?? 0;
    return { income, expense, balance: income - expense };
}

export async function getCategoryBreakdown(userId: string, from: string, to: string) {
    return stmt(`
        SELECT t.categoryId, c.name as categoryName, c.icon, c.color,
               SUM(t.amount) as total, COUNT(*) as count
        FROM NTransaction t
        LEFT JOIN Category c ON t.categoryId = c.id
        WHERE t.userId = ? AND t.date >= ? AND t.date <= ? AND t.type = 'EXPENSE'
          AND t.isParent = 0
        GROUP BY t.categoryId ORDER BY total DESC`)
        .all(userId, from, to);
}

// ── HOUSEHOLDS ────────────────────────────────────────────────────────────────

export interface DbHousehold {
    id: string; ownerId: string; partnerId?: string | null;
    status: string; inviteEmail?: string | null;
    createdAt: string; updatedAt: string;
}

export async function getHouseholdByUserId(userId: string): Promise<DbHousehold | null> {
    return stmt('SELECT * FROM Household WHERE ownerId = ? OR partnerId = ?').get(userId, userId) ?? null;
}

export async function createHousehold(ownerId: string, inviteEmail: string): Promise<DbHousehold> {
    const id = cuid(); const ts = now();
    stmt('INSERT INTO Household (id,ownerId,inviteEmail,status,createdAt,updatedAt) VALUES (?,?,?,?,?,?)')
        .run(id, ownerId, inviteEmail, 'PENDING', ts, ts);
    return stmt('SELECT * FROM Household WHERE id = ?').get(id) as DbHousehold;
}

export async function updateHousehold(id: string, data: Partial<DbHousehold>): Promise<DbHousehold | null> {
    const existing = stmt('SELECT * FROM Household WHERE id = ?').get(id) as DbHousehold | undefined;
    if (!existing) return null;
    const m = { ...existing, ...data };
    stmt('UPDATE Household SET partnerId=?,status=?,inviteEmail=?,updatedAt=? WHERE id=?')
        .run(m.partnerId, m.status, m.inviteEmail, now(), id);
    return stmt('SELECT * FROM Household WHERE id = ?').get(id) as DbHousehold;
}

// ── NOTIFICATIONS ─────────────────────────────────────────────────────────────

export interface DbNotification {
    id: string; userId: string; type: string; title: string; body: string;
    isRead: number; data?: string | null; createdAt: string;
}

export async function getNotifications(userId: string): Promise<DbNotification[]> {
    return stmt('SELECT * FROM Notification WHERE userId = ? ORDER BY createdAt DESC LIMIT 50').all(userId);
}

export async function createNotification(userId: string, data: Omit<DbNotification, 'id' | 'userId' | 'createdAt'>): Promise<DbNotification> {
    const id = cuid(); const ts = now();
    stmt('INSERT INTO Notification (id,userId,type,title,body,isRead,data,createdAt) VALUES (?,?,?,?,?,?,?,?)')
        .run(id, userId, data.type, data.title, data.body, data.isRead ?? 0, data.data ?? null, ts);
    return stmt('SELECT * FROM Notification WHERE id = ?').get(id) as DbNotification;
}

// ── GENERIC HELPERS ───────────────────────────────────────────────────────────

export async function countByCategoryId(table: string, categoryId: string, userId: string): Promise<number> {
    const allowedTables = ['NTransaction', 'Budget', 'MsiPlan', 'RecurringPayment'];
    if (!allowedTables.includes(table)) throw new Error(`Table not allowed: ${table}`);
    const row = stmt(`SELECT COUNT(*) as c FROM ${table} WHERE categoryId = ? AND userId = ?`).get(categoryId, userId) as { c: number };
    return row.c;
}

export async function markNotificationsRead(userId: string): Promise<void> {
    stmt('UPDATE Notification SET isRead = 1 WHERE userId = ?').run(userId);
}
