import { NextResponse } from 'next/server';
import { db } from '@/app/lib/firebase';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
    try {
        const { name, email, password } = await request.json();
        console.log('[Register] Attempting to register user:', email);

        if (!email || !password) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Check if user exists
        const userRef = db.collection('users').where('email', '==', email);
        const snapshot = await userRef.get();

        if (!snapshot.empty) {
            return NextResponse.json({ error: 'User already exists' }, { status: 409 });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUserRef = db.collection('users').doc();
        const userData = {
            id: newUserRef.id,
            name: name || '',
            email,
            password: hashedPassword,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        await newUserRef.set(userData);

        // Set session cookie
        const cookieStore = await cookies();
        cookieStore.set('userId', userData.id, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 60 * 60 * 24 * 7, // 1 week
            path: '/',
        });

        const { password: _, ...userWithoutPassword } = userData;

        return NextResponse.json(userWithoutPassword, { status: 201 });
    } catch (error: any) {
        console.error('Registration error details:', error);
        return NextResponse.json({
            error: 'Internal Server Error',
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
            code: error.code
        }, { status: 500 });
    }
}
