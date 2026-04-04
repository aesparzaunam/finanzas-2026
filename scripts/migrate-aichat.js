const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(process.cwd(), 'prisma', 'finanzas.db');
const db = new Database(dbPath);

db.exec(`
CREATE TABLE IF NOT EXISTS AiChat (
  id        TEXT PRIMARY KEY,
  userId    TEXT NOT NULL,
  role      TEXT NOT NULL,
  content   TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_aichat_userId ON AiChat(userId);
CREATE INDEX IF NOT EXISTS idx_aichat_userId_created ON AiChat(userId, createdAt);
`);

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
console.log('Tablas:', tables.map(t => t.name).join(', '));
db.close();
console.log('OK - AiChat creada');
