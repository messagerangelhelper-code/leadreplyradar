// Links LeadReplyRadar to your own Fit-Rend-Base (your own CRM, in place of Brevo).
//   - Every 5 minutes, important senders (score 50+) are saved as Contacts in Fit-Rend-Base.
//   - Fit-Rend-Base campaigns send their emails through /api/frb, from your Gmail.
// Render env vars (Fit-Rend-Base shows both under Contacts > Connection > Make secret):
//   FRB_URL     the Fit-Rend-Base address, like https://1-2-3-4.sslip.io
//   FRB_SECRET  the shared secret
// Optional: FRB_MIN_SCORE (default 50).
// With FRB_URL and FRB_SECRET set, Brevo is no longer used.

import crypto from 'crypto';

const state = (globalThis.__lrrFrb = globalThis.__lrrFrb || { saved: new Set(), tried: new Set(), lastError: '', lastOk: '' });

const url = () => String(process.env.FRB_URL || '').trim().replace(/\/+$/, '');
const secret = () => String(process.env.FRB_SECRET || '').trim();

export function frbIsSet() {
  return Boolean(url() && secret());
}
export function frbStatus() {
  return { on: frbIsSet(), saved: state.saved.size, error: state.lastError, lastOk: state.lastOk };
}
export function inFrb(id) {
  return state.saved.has(id);
}

const hmac = (text) => crypto.createHmac('sha256', secret()).update(text).digest('hex');

// Checks that a call really came from your Fit-Rend-Base (signed, and less than 5 minutes old).
export function frbVerify(request, raw) {
  if (!frbIsSet()) return false;
  const ts = Number(request.headers.get('x-frb-timestamp') || 0);
  const sig = String(request.headers.get('x-frb-signature') || '');
  if (!ts || Math.abs(Date.now() - ts) > 5 * 60 * 1000) return false;
  const want = hmac('frb-to-lrr.' + ts + '.' + raw);
  const a = Buffer.from(sig);
  const b = Buffer.from(want);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function isRobot(address) {
  return /no-?reply|do-?not-?reply|notifications?@|mailer-daemon|postmaster|bounce|newsletter|news@|marketing@|alerts?@/i.test(address);
}
function myAddresses() {
  const out = [];
  for (let i = 1; i <= 3; i++) {
    const u = process.env['MAIL' + i + '_USER'];
    if (u) out.push(u.trim().toLowerCase());
  }
  if (process.env.CAMPAIGN_MAIL_USER) out.push(process.env.CAMPAIGN_MAIL_USER.trim().toLowerCase());
  return out;
}
const refFor = (id) => 'lrr-' + crypto.createHash('sha1').update(String(id)).digest('hex').slice(0, 10);

// Saves new important senders, 20 at most per check.
export async function syncToFrb(items) {
  if (!frbIsSet()) return 0;
  const min = Number(process.env.FRB_MIN_SCORE || 50);
  const mine = myAddresses();
  const todo = items
    .filter(
      (m) =>
        m.score >= min &&
        m.fromAddress &&
        !state.saved.has(m.id) &&
        !state.tried.has(m.id) &&
        !isRobot(m.fromAddress) &&
        !mine.includes(m.fromAddress.trim().toLowerCase()) &&
        !(m.tags || []).includes('Check sender') &&
        !(m.tags || []).includes('Unsubscribe')
    )
    .slice(0, 20);
  if (!todo.length) return 0;
  const leads = todo.map((m) => ({
    email: m.fromAddress.trim().toLowerCase(),
    name: String(m.fromName || '').includes('@') ? '' : String(m.fromName || '').trim().slice(0, 80),
    score: m.score,
    subject: String(m.subject || '').slice(0, 200),
    tags: (m.tags || []).filter((t) => ['Hot', 'Interested', 'Question', 'Meeting'].includes(t)),
    date: m.date,
    ref: refFor(m.id),
  }));
  const body = JSON.stringify({ leads });
  const ts = Date.now();
  try {
    const res = await fetch(url() + '/in/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-FRB-Timestamp': String(ts), 'X-FRB-Signature': hmac('lrr-to-frb.' + ts + '.' + body) },
      body,
      signal: AbortSignal.timeout(30000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Fit-Rend-Base answered ' + res.status);
    todo.forEach((m) => state.saved.add(m.id));
    state.lastError = '';
    state.lastOk = new Date().toISOString();
    return (data.saved || []).length;
  } catch (e) {
    state.lastError = String(e.message || e).slice(0, 200);
    console.error('LeadReplyRadar Fit-Rend-Base error: ' + state.lastError);
    // A wrong secret or address: try the same people again once it's fixed. Others: skip them this run.
    if (!/signature|401|fetch failed|timeout|ENOTFOUND|ECONNREFUSED/i.test(state.lastError)) todo.forEach((m) => state.tried.add(m.id));
    return 0;
  }
}
