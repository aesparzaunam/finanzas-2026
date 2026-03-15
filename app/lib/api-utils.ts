import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function getUserId() {
    const cookieStore = await cookies();
    return cookieStore.get('userId')?.value;
}

export function unauthorizedResponse() {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

export function missingFieldsResponse(fields: string[]) {
    return NextResponse.json({ error: `Missing required fields: ${fields.join(', ')}` }, { status: 400 });
}

export function internalErrorResponse(context: string, error: unknown) {
    console.error(`[${context}] Error:`, error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    const code = (error as { code?: string })?.code;
    return NextResponse.json({
        error: 'Internal Server Error',
        details: message,
        code
    }, { status: 500 });
}

export function notFoundResponse(entity: string) {
    return NextResponse.json({ error: `${entity} not found` }, { status: 404 });
}

export function toNumber(val: string | number): number {
    return Number(val) || 0;
}
