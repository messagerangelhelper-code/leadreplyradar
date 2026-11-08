import { NextResponse } from 'next/server';
import { isAuthed } from '../../../lib/auth';
import { sendSms } from '../../../lib/sms';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Sign in to the dashboard first, then open /api/sms-test to get a test text.
export async function GET(request) {
  if (!isAuthed(request)) {
    return NextResponse.json({ ok: false, error: 'Sign in to the dashboard first, then open this page again.' }, { status: 401 });
  }
  try {
    await sendSms('LeadReplyRadar test: text alerts are working.');
    return NextResponse.json({ ok: true, message: 'Test text sent. Check your phone.' });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e.message || e) }, { status: 500 });
  }
}
