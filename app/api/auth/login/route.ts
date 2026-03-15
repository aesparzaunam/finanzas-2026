import { NextResponse } from 'next/server';
import { db } from '@/app/lib/firebase';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
    try {
        const { email, password } = await request.json();

        if (!email || !password) {
            return NextResponse.json({ error: 'Missing credentials' }, { status: 400 });
        }

        const snapshot = await db.collection('users').where('email', '==', email).limit(1).get();

        if (snapshot.empty) {
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
        }

        const userDoc = snapshot.docs[0];
        const user = userDoc.data();

        const isValid = await bcrypt.compare(password, user.password);

        if (!isValid) {
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
        }

        // Set session cookie
        const cookieStore = await cookies();
        cookieStore.set('userId', user.id, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 60 * 60 * 24 * 7, // 1 week
            path: '/',
        });

        const { password: _, ...userWithoutPassword } = user as any;

        return NextResponse.json(userWithoutPassword);
    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
