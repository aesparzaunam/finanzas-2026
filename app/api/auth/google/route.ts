import { NextResponse } from 'next/server';
// Google auth is disabled in local SQLite mode
// If you want to re-enable Google Sign-In, implement it with a local OAuth flow
export async function GET() {
    return NextResponse.json({ error: 'Google Sign-In is not available in local mode' }, { status: 501 });
}
export async function POST() {
    return NextResponse.json({ error: 'Google Sign-In is not available in local mode' }, { status: 501 });
}
