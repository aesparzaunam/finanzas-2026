import { NextResponse } from 'next/server';
// Push subscriptions are stored in-memory in local SQLite mode
// In production, persist to DB or use a service like Web Push
export async function POST() {
    return NextResponse.json({ success: true, message: 'Push subscriptions not persisted in local mode' });
}
export async function DELETE() {
    return NextResponse.json({ success: true, deleted: 0 });
}
export async function GET() {
    return NextResponse.json({ subscribed: false });
}
