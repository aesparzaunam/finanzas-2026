const Database = require('better-sqlite3');
const fs = require('fs');

fs.mkdirSync('prisma', { recursive: true });
const db = new Database('prisma/finanzas.db');
db.pragma('foreign_keys = ON');

const schema = `
CREATE TABLE IF NOT EXISTS User (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  avatar TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS Account (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  typeLabel TEXT NOT NULL DEFAULT '',
  bank TEXT NOT NULL DEFAULT '',
  balance REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'MXN',
  isDefault INTEGER NOT NULL DEFAULT 0,
  isShared INTEGER NOT NULL DEFAULT 0,
  autoDetected INTEGER NOT NULL DEFAULT 0,
  billingDay INTEGER,
  paymentDay INTEGER,
  annualRate REAL,
  minPayment REAL,
  interestStartDate TEXT,
  color TEXT,
  icon TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_account_userId ON Account(userId);

CREATE TABLE IF NOT EXISTS Category (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'tag',
  color TEXT NOT NULL DEFAULT '#6366f1',
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_category_userId ON Category(userId);

CREATE TABLE IF NOT EXISTS NTransaction (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  accountId TEXT NOT NULL,
  categoryId TEXT,
  amount REAL NOT NULL,
  type TEXT NOT NULL,
  date TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  notes TEXT,
  tags TEXT,
  msiPlanId TEXT,
  isParent INTEGER NOT NULL DEFAULT 0,
  parentId TEXT,
  toAccountId TEXT,
  recurringPaymentId TEXT,
  isDeductible INTEGER NOT NULL DEFAULT 0,
  createdById TEXT,
  importSource TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE,
  FOREIGN KEY (accountId) REFERENCES Account(id),
  FOREIGN KEY (categoryId) REFERENCES Category(id)
);
CREATE INDEX IF NOT EXISTS idx_tx_userId ON NTransaction(userId);
CREATE INDEX IF NOT EXISTS idx_tx_date ON NTransaction(userId, date);
CREATE INDEX IF NOT EXISTS idx_tx_account ON NTransaction(userId, accountId);
CREATE INDEX IF NOT EXISTS idx_tx_type ON NTransaction(userId, type);
CREATE INDEX IF NOT EXISTS idx_tx_cat ON NTransaction(userId, categoryId);

CREATE TABLE IF NOT EXISTS Budget (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  categoryId TEXT NOT NULL,
  amount REAL NOT NULL,
  period TEXT NOT NULL DEFAULT 'MONTHLY',
  enableCarryOver INTEGER NOT NULL DEFAULT 0,
  carryOverAmount REAL NOT NULL DEFAULT 0,
  lastCarryOverAt TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE,
  FOREIGN KEY (categoryId) REFERENCES Category(id),
  UNIQUE(userId, categoryId)
);
CREATE INDEX IF NOT EXISTS idx_budget_userId ON Budget(userId);

CREATE TABLE IF NOT EXISTS MsiPlan (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  accountId TEXT NOT NULL,
  categoryId TEXT,
  totalAmount REAL NOT NULL,
  months INTEGER NOT NULL,
  monthlyAmount REAL NOT NULL,
  startDate TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  paidMonths INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE,
  FOREIGN KEY (accountId) REFERENCES Account(id),
  FOREIGN KEY (categoryId) REFERENCES Category(id)
);
CREATE INDEX IF NOT EXISTS idx_msi_userId ON MsiPlan(userId);

CREATE TABLE IF NOT EXISTS RecurringPayment (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  accountId TEXT NOT NULL,
  categoryId TEXT,
  name TEXT NOT NULL,
  amount REAL NOT NULL,
  frequency TEXT NOT NULL,
  startDate TEXT NOT NULL,
  nextPaymentDate TEXT NOT NULL,
  lastPaidAt TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE,
  FOREIGN KEY (accountId) REFERENCES Account(id),
  FOREIGN KEY (categoryId) REFERENCES Category(id)
);
CREATE INDEX IF NOT EXISTS idx_rp_userId ON RecurringPayment(userId);

CREATE TABLE IF NOT EXISTS Household (
  id TEXT PRIMARY KEY,
  ownerId TEXT NOT NULL UNIQUE,
  partnerId TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'PENDING',
  inviteEmail TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (ownerId) REFERENCES User(id),
  FOREIGN KEY (partnerId) REFERENCES User(id)
);

CREATE TABLE IF NOT EXISTS Notification (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  isRead INTEGER NOT NULL DEFAULT 0,
  data TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notif_userId ON Notification(userId);
`;

db.exec(schema);

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
console.log('✅ SQLite DB creada. Tablas:', tables.map(t => t.name).join(', '));
db.close();
