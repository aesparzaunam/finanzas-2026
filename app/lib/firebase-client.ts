import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

const firebaseConfig = {
    projectId: "mis-finanzas-d419c",
    appId: "1:624211726540:web:9f3be2c394701ac3333269",
    storageBucket: "mis-finanzas-d419c.firebasestorage.app",
    apiKey: "AIzaSyB0QkyFX8afdwgz8STRkVL-3lpG_9q7Xqw",
    authDomain: "mis-finanzas-d419c.firebaseapp.com",
    messagingSenderId: "624211726540",
    measurementId: "G-CYL3CKSRKG",
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export { app, auth, googleProvider, signInWithPopup };
