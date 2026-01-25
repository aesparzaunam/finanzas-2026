import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { cookies } from 'next/headers';

export async function GET() {
    try {
        const cookieStore = await cookies();
        const userId = cookieStore.get('userId')?.value;

        if (!userId) {
            return NextResponse.json({ user: null }, { status: 200 });
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            return NextResponse.json({ user: null }, { status: 200 });
        }

        const { password: _, ...userWithoutPassword } = user;

        return NextResponse.json({ user: userWithoutPassword }, { status: 200 });

    } catch (error) {
        console.error('Session check error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST() {
    // Logout
    const cookieStore = await cookies();
    cookieStore.delete('userId');
    return NextResponse.json({ message: 'Logged out' });
}
