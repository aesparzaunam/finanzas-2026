/**
 * scripts/migrate-from-firebase.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Exporta los datos de Firestore e importa a SQLite.
 * Ejecutar UNA sola vez: node scripts/migrate-from-firebase.js
 *
 * Orden: users → categories → accounts → transactions → budgets →
 *        msiPlans → recurringPayments → households
 */

const admin = require('firebase-admin');
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ── Config ─────────────────────────────────────────────────────────────────────

let serviceAccount;
try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    } else {
        // Leer del .env.local manualmente
        const envContent = fs.readFileSync('.env.local', 'utf8');
        const match = envContent.match(/FIREBASE_SERVICE_ACCOUNT_KEY=({.*})/);
        if (match) {
            serviceAccount = JSON.parse(match[1]);
        } else {
            // Intentar con el archivo .json.json
            serviceAccount = JSON.parse(fs.readFileSync('.firebase-admin.json.json', 'utf8'));
        }
    }
} catch (e) {
    console.error('❌ No se pudo leer el service account:', e.message);
    process.exit(1);
}

if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const firestore = admin.firestore();
firestore.settings({ preferRest: true });

// ── SQLite ─────────────────────────────────────────────────────────────────────

const dbPath = path.join(process.cwd(), 'prisma', 'finanzas.db');
if (!fs.existsSync(dbPath)) {
    console.error('❌ finanzas.db no existe. Ejecuta primero: node scripts/create-db.js');
    process.exit(1);
}
const db = new Database(dbPath);
db.pragma('foreign_keys = OFF'); // OFF durante migración para evitar constraints
db.pragma('journal_mode = WAL');

function cuid() {
    return 'c' + crypto.randomBytes(11).toString('hex');
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function safeString(v) { return v != null ? String(v) : ''; }
function safeFloat(v)  { return v != null ? Number(v) : 0; }
function safeInt(v)    { return v != null ? Math.round(Number(v)) : 0; }
function safeBool(v)   { return v ? 1 : 0; }
function safeDate(v)   {
    if (!v) return new Date().toISOString();
    if (typeof v === 'string') return v;
    if (v._seconds) return new Date(v._seconds * 1000).toISOString();
    if (v.toDate) return v.toDate().toISOString();
    return String(v);
}

// ── Migración ─────────────────────────────────────────────────────────────────

async function migrateUsers() {
    console.log('\n📦 Migrando usuarios...');
    const snap = await firestore.collection('users').get();
    let count = 0;

    const insert = db.prepare(`INSERT OR IGNORE INTO User (id,name,email,password,avatar,createdAt,updatedAt)
        VALUES (?,?,?,?,?,?,?)`);

    for (const doc of snap.docs) {
        const d = doc.data();
        try {
            insert.run(
                d.id || doc.id,
                safeString(d.name),
                safeString(d.email),
                safeString(d.password || '$2b$10$placeholder'), // placeholder si no tiene password
                d.avatar || null,
                safeDate(d.createdAt),
                safeDate(d.updatedAt || d.createdAt)
            );
            count++;
        } catch (e) {
            console.warn(`  ⚠️  Usuario ${doc.id}: ${e.message}`);
        }
    }
    console.log(`  ✅ ${count}/${snap.size} usuarios migrados`);
    return snap.docs.map(d => d.data().id || d.id);
}

async function migrateSubcollection(userId, firestoreUserId) {
    const collections = ['categories', 'accounts', 'transactions', 'budgets', 'msi_plans', 'recurring_payments'];

    for (const col of collections) {
        let snap;
        try {
            snap = await firestore.collection('users').doc(firestoreUserId).collection(col).get();
        } catch (e) {
            continue;
        }
        if (snap.empty) continue;

        console.log(`  📁 ${col}: ${snap.size} docs para usuario ${firestoreUserId.slice(0,8)}...`);

        for (const doc of snap.docs) {
            const d = doc.data();
            try {
                await migrateDoc(col, userId, firestoreUserId, doc.id, d);
            } catch (e) {
                console.warn(`    ⚠️  ${col}/${doc.id}: ${e.message}`);
            }
        }
    }
}

function migrateDoc(col, userId, firestoreUserId, docId, d) {
    const id = docId; // preservamos el mismo ID para mantener referencias

    if (col === 'categories') {
        db.prepare(`INSERT OR IGNORE INTO Category (id,userId,name,type,icon,color,createdAt,updatedAt)
            VALUES (?,?,?,?,?,?,?,?)`)
            .run(id, userId, safeString(d.name), safeString(d.type || 'EXPENSE'),
                 safeString(d.icon || 'tag'), safeString(d.color || '#6366f1'),
                 safeDate(d.createdAt), safeDate(d.updatedAt || d.createdAt));
    }
    else if (col === 'accounts') {
        db.prepare(`INSERT OR IGNORE INTO Account (id,userId,name,type,typeLabel,bank,balance,currency,isDefault,isShared,autoDetected,billingDay,paymentDay,annualRate,minPayment,interestStartDate,color,icon,createdAt,updatedAt)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
            .run(id, userId, safeString(d.name), safeString(d.type || 'BANK'),
                 safeString(d.typeLabel || ''), safeString(d.bank || ''),
                 safeFloat(d.balance), safeString(d.currency || 'MXN'),
                 safeBool(d.isDefault), safeBool(d.isShared), safeBool(d.autoDetected),
                 d.billingDay ?? null, d.paymentDay ?? null,
                 d.annualRate ?? null, d.minPayment ?? null,
                 d.interestStartDate ?? null, d.color ?? null, d.icon ?? null,
                 safeDate(d.createdAt), safeDate(d.updatedAt || d.createdAt));
    }
    else if (col === 'transactions') {
        const dateStr = d.date
            ? (typeof d.date === 'string' ? d.date.slice(0, 10) : safeDate(d.date).slice(0, 10))
            : new Date().toISOString().slice(0, 10);

        db.prepare(`INSERT OR IGNORE INTO NTransaction (id,userId,accountId,categoryId,amount,type,date,description,notes,tags,msiPlanId,isParent,parentId,toAccountId,recurringPaymentId,isDeductible,createdById,importSource,createdAt,updatedAt)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
            .run(id, userId, safeString(d.accountId), d.categoryId || null,
                 safeFloat(d.amount), safeString(d.type || 'EXPENSE'),
                 dateStr, safeString(d.description),
                 d.notes || null,
                 d.tags ? JSON.stringify(d.tags) : null,
                 d.msiPlanId || null, safeBool(d.isParent),
                 d.parentId || null, d.toAccountId || null,
                 d.recurringPaymentId || null, safeBool(d.isDeductible),
                 d.createdById || null, d.importSource || null,
                 safeDate(d.createdAt), safeDate(d.updatedAt || d.createdAt));
    }
    else if (col === 'budgets') {
        db.prepare(`INSERT OR IGNORE INTO Budget (id,userId,categoryId,amount,period,enableCarryOver,carryOverAmount,lastCarryOverAt,createdAt,updatedAt)
            VALUES (?,?,?,?,?,?,?,?,?,?)`)
            .run(id, userId, safeString(d.categoryId), safeFloat(d.amount),
                 safeString(d.period || 'MONTHLY'), safeBool(d.enableCarryOver),
                 safeFloat(d.carryOverAmount), d.lastCarryOverAt || null,
                 safeDate(d.createdAt), safeDate(d.updatedAt || d.createdAt));
    }
    else if (col === 'msi_plans') {
        db.prepare(`INSERT OR IGNORE INTO MsiPlan (id,userId,accountId,categoryId,totalAmount,months,monthlyAmount,startDate,description,status,paidMonths,createdAt,updatedAt)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
            .run(id, userId, safeString(d.accountId), d.categoryId || null,
                 safeFloat(d.totalAmount), safeInt(d.months), safeFloat(d.monthlyAmount),
                 safeString(d.startDate || ''), safeString(d.description),
                 safeString(d.status || 'ACTIVE'), safeInt(d.paidMonths),
                 safeDate(d.createdAt), safeDate(d.updatedAt || d.createdAt));
    }
    else if (col === 'recurring_payments') {
        db.prepare(`INSERT OR IGNORE INTO RecurringPayment (id,userId,accountId,categoryId,name,amount,frequency,startDate,nextPaymentDate,lastPaidAt,status,createdAt,updatedAt)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
            .run(id, userId, safeString(d.accountId), d.categoryId || null,
                 safeString(d.name), safeFloat(d.amount),
                 safeString(d.frequency || 'MONTHLY'), safeString(d.startDate || ''),
                 safeString(d.nextPaymentDate || d.startDate || ''),
                 d.lastPaidAt || null, safeString(d.status || 'ACTIVE'),
                 safeDate(d.createdAt), safeDate(d.updatedAt || d.createdAt));
    }
}

async function migrateHouseholds() {
    console.log('\n📦 Migrando households...');
    try {
        const snap = await firestore.collection('households').get();
        if (snap.empty) { console.log('  (ninguno)'); return; }
        let count = 0;
        for (const doc of snap.docs) {
            const d = doc.data();
            try {
                db.prepare(`INSERT OR IGNORE INTO Household (id,ownerId,partnerId,status,inviteEmail,createdAt,updatedAt)
                    VALUES (?,?,?,?,?,?,?)`)
                    .run(doc.id, safeString(d.ownerId), d.partnerId || null,
                         safeString(d.status || 'PENDING'), d.inviteEmail || null,
                         safeDate(d.createdAt), safeDate(d.updatedAt || d.createdAt));
                count++;
            } catch (e) {
                console.warn(`  ⚠️  ${doc.id}: ${e.message}`);
            }
        }
        console.log(`  ✅ ${count} households migrados`);
    } catch (e) {
        console.warn('  (colección households no existe o error:', e.message, ')');
    }
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
    console.log('🚀 Iniciando migración Firestore → SQLite');
    console.log('   DB destino:', dbPath);

    const userIds = await migrateUsers();

    // Obtener el mapa userId en Firestore -> userId en SQLite
    const usersSnap = await firestore.collection('users').get();
    console.log('\n📦 Migrando subcollections...');

    for (const doc of usersSnap.docs) {
        const d = doc.data();
        const sqliteId = d.id || doc.id; // el id que guardamos en SQLite
        await migrateSubcollection(sqliteId, doc.id);
    }

    await migrateHouseholds();

    // Estadísticas finales
    console.log('\n📊 Estadísticas finales:');
    const tables = ['User','Account','Category','NTransaction','Budget','MsiPlan','RecurringPayment','Household','Notification'];
    for (const t of tables) {
        const count = db.prepare(`SELECT COUNT(*) as c FROM ${t}`).get().c;
        console.log(`   ${t}: ${count} registros`);
    }

    db.pragma('foreign_keys = ON');
    db.close();
    console.log('\n✅ Migración completada exitosamente!');
    process.exit(0);
}

main().catch(e => {
    console.error('❌ Error en migración:', e);
    process.exit(1);
});
