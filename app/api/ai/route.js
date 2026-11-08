import { NextResponse } from 'next/server';
import { isAuthed, passwordIsSet } from '../../../lib/auth';
import { mailboxes, readAllMail } from '../../../lib/imap';
import { aiErrorText, aiIsSet, aiStatus, briefNow, draftOne, sortAllNow } from '../../../lib/ai';
import { sendReply } from '../../../lib/send';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// One-click AI buttons on the dashboard.
//   { action: 'sort' }            sort every email not sorted yet
//   { action: 'draft', id: '...' } write (or rewrite) a reply draft for one email
//   { action: 'brief' }           make today's to-do list from this week's mail
//   { action: 'send', id, text }  send ONE reply, only after you press Send and confirm
export async function POST(request) {
  if (!passwordIsSet() || !isAuthed(request)) {
    return NextResponse.json({ ok: false, error: 'Sign in to the dashboard first.' }, { status: 401 });
  }
  if (!aiIsSet()) {
    return NextResponse.json({ ok: false, error: 'AI is off. Add ANTHROPIC_API_KEY on Render.' }, { status: 400 });
  }
  if (!mailboxes().length) {
    return NextResponse.json({ ok: false, error: 'Add MAIL1_USER and MAIL1_PASS on Render first.' }, { status: 400 });
  }
  let body = {};
  try {
    body = await request.json();
  } catch (e) {}
  try {
    const data = await readAllMail();
    const items = data.items || [];
    if (body.action === 'sort') {
      const r = await sortAllNow(items);
      return NextResponse.json({ ok: true, ...r, ai: aiStatus() });
    }
    if (body.action === 'draft') {
      const m = items.find((x) => x.id === body.id);
      if (!m) return NextResponse.json({ ok: false, error: 'That email is no longer in the last week of mail.' }, { status: 404 });
      const ai = await draftOne(m);
      return NextResponse.json({ ok: true, id: m.id, ai });
    }
    if (body.action === 'brief') {
      const brief = await briefNow(items);
      return NextResponse.json({ ok: true, brief });
    }
    if (body.action === 'send') {
      const m = items.find((x) => x.id === body.id);
      if (!m) return NextResponse.json({ ok: false, error: 'That email is no longer in the last week of mail.' }, { status: 404 });
      try {
        const r = await sendReply(m, body.text);
        return NextResponse.json({ ok: true, id: m.id, to: r.to, from: r.from });
      } catch (e) {
        const msg = String((e && e.message) || e);
        console.error('LeadReplyRadar send error: ' + msg);
        const nice = /auth|535|534|credentials/i.test(msg) ? 'Gmail would not let the app send. Check MAIL1_PASS is your Gmail app password.' : msg;
        return NextResponse.json({ ok: false, error: nice }, { status: 400 });
      }
    }
    return NextResponse.json({ ok: false, error: 'Unknown button.' }, { status: 400 });
  } catch (e) {
    const msg = aiErrorText(e);
    console.error('LeadReplyRadar AI button error: ' + msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
