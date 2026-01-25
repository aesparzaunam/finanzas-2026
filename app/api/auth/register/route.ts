import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
    try {
        const { name, email, password } = await request.json();
        console.log('[Register] Attempting to register user:', email);

        if (!email || !password) {
            console.log('[Register] Missing credentials');
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        console.log('[Register] Checking existing user...');

        // Check if user exists
        const existingUser = await prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            return NextResponse.json({ error: 'User already exists' }, { status: 409 });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const user = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
            },
        });

        // Return user without password
        const { password: _, ...userWithoutPassword } = user;

        return NextResponse.json(userWithoutPassword, { status: 201 });
    } catch (error: any) {
        console.error('Registration error details:', error);
        return NextResponse.json({
            error: 'Internal Server Error',
            details: error.message,
            code: error.code // Prisma error codes are useful
        }, { status: 500 });
    }
}
