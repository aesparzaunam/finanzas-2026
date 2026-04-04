import { NextResponse } from 'next/server';
// Cron push notifications are not available in local SQLite mode.
// The cron endpoint requires cloud infrastructure (Firestore, VAPID).
// In production, re-enable this with your cloud deployment.
export async function GET(request: Request) {
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = request.headers.get('authorization') ?? '';
    const provided = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!cronSecret || provided !== cronSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ success: true, processed: 0, sent: 0, message: 'Push notifications not available in local mode', timestamp: new Date().toISOString() });
}
