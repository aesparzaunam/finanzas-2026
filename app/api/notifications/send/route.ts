import { NextResponse } from 'next/server';
// Push notification sending is not available in local SQLite mode.
// In production, implement with web-push library and stored subscriptions.
export async function POST() {
    return NextResponse.json({ success: false, message: 'Push notifications not available in local mode', sent: 0 });
}
