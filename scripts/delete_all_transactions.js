const admin = require('firebase-admin');
const serviceAccount = require('../.firebase-admin.json.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function deleteAllTransactions() {
    console.log('Fetching all users...');
    const usersSnap = await db.collection('users').get();
    
    for (const userDoc of usersSnap.docs) {
        const userId = userDoc.id;
        console.log(`Processing user: ${userId}`);
        
        const txSnap = await db.collection('users').doc(userId).collection('transactions').get();
        console.log(`Found ${txSnap.size} transactions for user ${userId}`);
        
        if (txSnap.size > 0) {
            const batch = db.batch();
            txSnap.docs.forEach(doc => batch.delete(doc.ref));
            
            // Reset account balances
            const accountsSnap = await db.collection('users').doc(userId).collection('accounts').get();
            accountsSnap.docs.forEach(doc => {
                batch.update(doc.ref, { balance: 0, updatedAt: new Date().toISOString() });
            });
            
            // Reset MSI plans if any
            const msiSnap = await db.collection('users').doc(userId).collection('msiPlans').get();
            msiSnap.docs.forEach(doc => {
                batch.update(doc.ref, { status: 'PAID', updatedAt: new Date().toISOString() });
            });

            await batch.commit();
            console.log(`Deleted ${txSnap.size} transactions and reset balances for ${userId}`);
        }
    }
    console.log('Cleanup complete!');
}

deleteAllTransactions().catch(console.error);
