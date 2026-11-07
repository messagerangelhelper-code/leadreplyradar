import { NextResponse } from 'next/server';
import { COOKIE_NAME, tokenFor, passwordIsSet } from '../../../lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Sign in to the dashboard with DASHBOARD_PASSWORD (set on Render).
export async function POST(request) {
  if (!passwordIsSet()) {
    return NextResponse.json(
      { ok: false, error: 'DASHBOARD_PASSWORD is not set on Render yet.' },
      { status: 400 }
    );
  }
  let body = {};
  try {
    body = await request.json();
  } catch (e) {}
  if (String(body.password || '') !== process.env.DASHBOARD_PASSWORD) {
    return NextResponse.json({ ok: false, error: 'Wrong password.' }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, tokenFor(process.env.DASHBOARD_PASSWORD), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
// Sign out.
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, '', { path: '/', maxAge: 0 });
  return res;
}
