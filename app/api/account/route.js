import { NextResponse } from 'next/server';
import { customerFrom, planFor, forgetPlan, getAccount, saveAccount, deleteAccount, PROVIDERS } from '../../../lib/customer';
import { testLogin, describe, forgetCustomerMail } from '../../../lib/imap';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const providers = Object.entries(PROVIDERS).map(([id, p]) => ({ id, label: p.label }));
const login = () => NextResponse.json({ ok: false, error: 'login' }, { status: 401 });

// A customer's account: plan and connected inbox (never the password).
export async function GET(request) {
  const user = await customerFrom(request).catch(() => null);
  if (!user) return login();
  const url = new URL(request.url);
  if (url.searchParams.get('fresh')) forgetPlan(user.email);
  let plan = { active: false };
  try {
    plan = await planFor(user.email);
  } catch (e) {
    plan = { active: false, error: "We couldn't check your plan just now." };
  }
  const acc = await getAccount(user).catch(() => null);
  return NextResponse.json({
    ok: true,
    email: user.email,
    plan,
    account: acc ? { email: acc.email, host: acc.host, updated_at: acc.updated_at } : null,
    providers,
  });
}

// Connect (or change) the customer's inbox. The sign-in is tested before it is saved.
export async function POST(request) {
  const user = await customerFrom(request).catch(() => null);
  if (!user) return login();
  let body = {};
  try {
    body = await request.json();
  } catch (e) {}
  const provider = PROVIDERS[String(body.provider || '')];
  const email = String(body.email || '').trim().toLowerCase();
  const pass = String(body.pass || '').replace(/\s+/g, '');
  if (!provider) return NextResponse.json({ ok: false, error: 'Pick your email provider.' }, { status: 400 });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ ok: false, error: 'Enter a full email address.' }, { status: 400 });
  if (pass.length < 8 || pass.length > 200) return NextResponse.json({ ok: false, error: 'Enter the app password from your email provider.' }, { status: 400 });
  let plan;
  try {
    plan = await planFor(user.email);
  } catch (e) {
    return NextResponse.json({ ok: false, error: "We couldn't check your plan just now. Try again in a minute." }, { status: 503 });
  }
  if (!plan.active) return NextResponse.json({ ok: false, error: 'Start a plan first.' }, { status: 402 });
  try {
    await testLogin({ host: provider.host, user: email, pass });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "Couldn't sign in to that inbox. Check the address and that you used an app password, not your normal password. (" + describe(e) + ')' },
      { status: 400 }
    );
  }
  try {
    await saveAccount(user, { email, host: provider.host, pass });
  } catch (e) {
    return NextResponse.json({ ok: false, error: 'Signed in fine, but saving failed: ' + String(e.message || e) }, { status: 500 });
  }
  forgetCustomerMail(user.id);
  return NextResponse.json({ ok: true, account: { email, host: provider.host } });
}

// Disconnect the inbox. The saved password is deleted.
export async function DELETE(request) {
  const user = await customerFrom(request).catch(() => null);
  if (!user) return login();
  try {
    await deleteAccount(user);
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e.message || e) }, { status: 500 });
  }
  forgetCustomerMail(user.id);
  return NextResponse.json({ ok: true });
}
