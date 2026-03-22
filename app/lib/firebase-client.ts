import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

// Las Firebase Web API keys son PÚBLICAS por diseño (no son secretos).
// Firebase las requiere en el cliente y la seguridad está garantizada
// por las Firebase Security Rules, no por ocultar esta configuración.
// Sin embargo, las movemos a NEXT_PUBLIC_ para evitar alertas de GitHub Secret Scanning.
const firebaseConfig = {
    projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID     || "mis-finanzas-d419c",
    appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID         || "1:624211726540:web:9f3be2c394701ac3333269",
    storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "mis-finanzas-d419c.firebasestorage.app",
    apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY        || "AIzaSyB0QkyFX8afdwgz8STRkVL-3lpG_9q7Xqw",
    authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN    || "mis-finanzas-d419c.firebaseapp.com",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_ID   || "624211726540",
    measurementId:     process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-CYL3CKSRKG",
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export { app, auth, googleProvider, signInWithPopup };
