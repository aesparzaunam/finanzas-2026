import * as admin from 'firebase-admin';

if (!admin.apps.length) {
    try {
        if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
            // Emulating local or custom Vercel service account logic
            const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                projectId: 'mis-finanzas-d419c'
            });
        } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
            // Explicit local logic
            admin.initializeApp({
                credential: admin.credential.applicationDefault(),
                projectId: 'mis-finanzas-d419c'
            });
        } else {
            // If deployed to Firebase Hosting with Next.js (Cloud Run), it MUST be called empty 
            // so it automatically magically discovers Identity Platform service accounts.
            admin.initializeApp();
        }
    } catch (error: unknown) {
        console.log('Firebase admin initialization error:', error instanceof Error ? error.message : String(error));
    }
}

export const db = admin.firestore();
export const auth = admin.auth();
