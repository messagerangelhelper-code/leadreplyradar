import { NextResponse } from 'next/server';
import { isAuthed, passwordIsSet } from '../../../lib/auth';
import { mailboxes, readAllMail } from '../../../lib/imap';
import { demoEmails } from '../../../lib/demo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  // No mailbox or no dashboard password yet: show sample data only.
  if (!mailboxes().length || !passwordIsSet()) {
    return NextResponse.json({
      mode: 'demo',
      items: demoEmails(),
      accounts: [],
      checkedAt: new Date().toISOString(),
      setup: !passwordIsSet() ? 'Add DASHBOARD_PASSWORD on Render.' : 'Add MAIL1_USER and MAIL1_PASS on Render.',
    });
  }
  if (!isAuthed(request)) {
    return NextResponse.json({ error: 'login' }, { status: 401 });
  }
  try {
    const data = await readAllMail();
    return NextResponse.json({ mode: 'live', ...data });
  } catch (e) {
    return NextResponse.json({ mode: 'live', items: [], accounts: [], error: String(e.message || e) }, { status: 500 });
  }
}
