import { NextResponse } from 'next/server';
import { findUserByEmail, createUser } from '@/app/lib/db';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
    try {
        const { name, email, password } = await request.json();
        if (!email || !password) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const existing = await findUserByEmail(email);
        if (existing) {
            return NextResponse.json({ error: 'User already exists' }, { status: 409 });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await createUser({ name: name || '', email, password: hashedPassword });

        const cookieStore = await cookies();
        cookieStore.set('userId', user.id, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 60 * 60 * 24 * 7,
            path: '/',
        });

        const { password: _pw, ...safe } = user;
        return NextResponse.json(safe, { status: 201 });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Error';
        return NextResponse.json({ error: 'Internal Server Error', details: msg }, { status: 500 });
    }
}
