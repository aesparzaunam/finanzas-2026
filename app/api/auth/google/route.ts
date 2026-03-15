import { NextResponse } from 'next/server';
import { db } from '@/app/lib/firebase';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
    try {
        const { uid, email, name, photoURL } = await request.json();

        if (!uid || !email) {
            return NextResponse.json({ error: 'Missing required Google Auth fields' }, { status: 400 });
        }

        // Check if user already exists in Firestore users collection
        let targetUserId = uid;
        const userRef = db.collection('users').where('email', '==', email);
        const snapshot = await userRef.get();

        let userData;

        if (!snapshot.empty) {
            // User exists via traditional email or previous google auth. Use existing document
            const existingDoc = snapshot.docs[0];
            userData = existingDoc.data();
            targetUserId = existingDoc.id; // Override in case it maps to older local id

            // Optionally, we could update name or photoURL if missing, but we'll leave it simple
        } else {
            // New User Registration disguised as plain login
            const newUserRef = db.collection('users').doc(uid); // Make Firestore document ID = Firebase Auth UID
            userData = {
                id: uid,
                email,
                name: name || '',
                photoURL: photoURL || '',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            await newUserRef.set(userData);
        }

        // Set session cookie
        const cookieStore = await cookies();
        cookieStore.set('userId', targetUserId, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 60 * 60 * 24 * 7, // 1 week
            path: '/',
        });

        // Safe return
        const userWithoutPassword = { ...userData };
        delete (userWithoutPassword as { password?: string }).password;

        return NextResponse.json(userWithoutPassword, { status: 200 });
    } catch (error: any) {
        console.error('Google Auth sync error:', error);
        return NextResponse.json({
            error: 'Internal Server Error',
            details: error?.message || 'Unknown error',
            fullError: String(error),
            stack: error?.stack
        }, { status: 500 });
    }
}
