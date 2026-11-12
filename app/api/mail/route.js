import { NextResponse } from 'next/server';
import { isAuthed, passwordIsSet } from '../../../lib/auth';
import { mailboxes, readAllMail } from '../../../lib/imap';
import { demoEmails } from '../../../lib/demo';
import { brevoStatus, inBrevo } from '../../../lib/brevo';
import { aiFor, aiStatus, lastBrief, sortWithAi } from '../../../lib/ai';
import { readCustomerMail } from '../../../lib/imap';
import { customerToken, customerFrom, planFor, getAccount, boxFor } from '../../../lib/customer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// A customer: signed in with their own account, paying, with their own inbox connected.
async function customerMail(request) {
  const user = await customerFrom(request).catch(() => null);
  if (!user) return NextResponse.json({ error: 'login', customer: true }, { status: 401 });
  let plan;
  try {
    plan = await planFor(user.email);
  } catch (e) {
    return NextResponse.json({ error: 'billing', message: "We couldn't check your plan just now. Try again in a minute." }, { status: 503 });
  }
  if (!plan.active) return NextResponse.json({ error: 'plan', email: user.email, message: plan.error || '' }, { status: 402 });
  let account;
  try {
    account = await getAccount(user);
  } catch (e) {
    return NextResponse.json({ error: 'server', message: String(e.message || e) }, { status: 500 });
  }
  if (!account) return NextResponse.json({ error: 'connect', email: user.email, plan }, { status: 409 });
  try {
    const data = await readCustomerMail(user.id, boxFor(account));
    const items = (data.items || []).map(({ body, ...m }) => m);
    return NextResponse.json({ mode: 'live', customer: { email: user.email, inbox: account.email, plan }, ...data, items });
  } catch (e) {
    return NextResponse.json({ mode: 'live', customer: { email: user.email, inbox: account.email, plan }, items: [], accounts: [], error: String(e.message || e) }, { status: 500 });
  }
}

export async function GET(request) {
  if (customerToken(request)) return customerMail(request);
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
    // Start sorting new emails in the background; results show on the next refresh.
    sortWithAi(data.items || []).catch(() => {});
    const items = (data.items || []).map(({ body, ...m }) => {
      const out = inBrevo(m.id) ? { ...m, inBrevo: true } : m;
      const ai = aiFor(m.id);
      return ai ? { ...out, ai } : out;
    });
    return NextResponse.json({ mode: 'live', ...data, items, brevo: brevoStatus(), ai: aiStatus(), brief: lastBrief() });
  } catch (e) {
    console.error('LeadReplyRadar mail error: ' + String(e.message || e));
    return NextResponse.json({ mode: 'live', items: [], accounts: [], error: String(e.message || e) }, { status: 500 });
  }
}
