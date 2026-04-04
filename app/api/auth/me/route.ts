import { NextResponse } from 'next/server';
import { findUserById } from '@/app/lib/db';
import { cookies } from 'next/headers';

export async function GET() {
    try {
        const cookieStore = await cookies();
        const userId = cookieStore.get('userId')?.value;
        if (!userId) return NextResponse.json({ user: null });

        const user = await findUserById(userId);
        if (!user) return NextResponse.json({ user: null });

        const { password: _, ...safe } = user;
        return NextResponse.json({ user: safe });
    } catch (error) {
        console.error('Session check error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST() {
    const cookieStore = await cookies();
    cookieStore.delete('userId');
    return NextResponse.json({ message: 'Logged out' });
}
