// Customers: people who sign up, pay for a plan and connect their own inbox.
// The owner (DASHBOARD_PASSWORD) keeps working exactly as before.
//
// Sign-in uses CashCow's Supabase project (same accounts as PlateTrace).
// Each customer's inbox address and app password live in the lrr_mail_accounts table.
// The app password is encrypted here with LRR_ENC_KEY before it is saved, so the
// database only ever holds the scrambled version.
//
// Render env vars:
//   LRR_ENC_KEY        Render's Generate button (or 64 hex characters). Keep it secret; changing it means
//                      every customer has to reconnect their email.
//   STRIPE_SECRET_KEY  restricted Stripe key: Customers Read, Subscriptions Read.
//   SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY  (optional; CashCow's are the defaults)

import crypto from 'crypto';

export const SB_URL = (process.env.SUPABASE_URL || 'https://wbugdujmydwmzemccbiy.supabase.co').replace(/\/$/, '');
export const SB_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_4RYit1aVs5Egh3gJsx2bJA_m6Kje0ES';

// Mail providers customers can connect. Only these hosts, so the server never
// connects anywhere a stranger types in.
export const PROVIDERS = {
  gmail: { label: 'Gmail', host: 'imap.gmail.com' },
  outlook: { label: 'Outlook / Hotmail / Microsoft 365', host: 'outlook.office365.com' },
  yahoo: { label: 'Yahoo Mail', host: 'imap.mail.yahoo.com' },
  icloud: { label: 'iCloud Mail', host: 'imap.mail.me.com' },
  aol: { label: 'AOL Mail', host: 'imap.aol.com' },
  zoho: { label: 'Zoho Mail', host: 'imap.zoho.com' },
};

// LeadReplyRadar prices in Stripe (live mode)
export const PLANS = {
  price_1Ub2C3QlNR3EndWPj4heshOk: 'Starter',
  price_1Ub2C6QlNR3EndWPUGvfQr5b: 'Pro',
  price_1Ub2C9QlNR3EndWPJOAGDwQz: 'Business',
};

// ---------- who is asking ----------
const userCache = new Map(); // token -> { at, user }

export function customerToken(request) {
  return String(request.headers.get('x-lrr-user') || '').trim();
}

export async function customerFrom(request) {
  const token = customerToken(request);
  if (!token) return null;
  const hit = userCache.get(token);
  if (hit && Date.now() - hit.at < 60 * 1000) return hit.user;
  const r = await fetch(SB_URL + '/auth/v1/user', { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + token }, cache: 'no-store' });
  if (!r.ok) return null;
  const j = await r.json().catch(() => null);
  if (!j || !j.id || !j.email) return null;
  const user = { id: j.id, email: String(j.email).toLowerCase(), token };
  userCache.set(token, { at: Date.now(), user });
  if (userCache.size > 1000) userCache.delete(userCache.keys().next().value);
  return user;
}

// ---------- plan (Stripe) ----------
const planCache = new Map(); // email -> { at, plan }

export function forgetPlan(email) {
  planCache.delete(String(email || '').toLowerCase());
}

export async function planFor(email) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return { active: false, error: 'Billing is not connected yet.' };
  const hit = planCache.get(email);
  if (hit && Date.now() - hit.at < 5 * 60 * 1000) return hit.plan;
  const stripe = async (path, params) => {
    const r = await fetch('https://api.stripe.com/v1/' + path + '?' + new URLSearchParams(params), {
      headers: { Authorization: 'Bearer ' + key },
      cache: 'no-store',
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((j.error && j.error.message) || 'Stripe error ' + r.status);
    return j;
  };
  let plan = { active: false };
  const customers = await stripe('customers', { email, limit: '10' });
  for (const c of customers.data || []) {
    const subs = await stripe('subscriptions', { customer: c.id, status: 'all', limit: '20' });
    for (const s of subs.data || []) {
      if (s.status !== 'active' && s.status !== 'trialing') continue;
      for (const it of (s.items && s.items.data) || []) {
        const name = PLANS[it.price && it.price.id];
        if (name) plan = { active: true, plan: name, status: s.status, trial_end: s.trial_end || null, cancel_at_period_end: !!s.cancel_at_period_end };
      }
    }
  }
  // Remember "no plan" only briefly, so a new subscription shows up fast.
  planCache.set(email, { at: plan.active ? Date.now() : Date.now() - 4 * 60 * 1000, plan });
  return plan;
}

// ---------- the customer's inbox ----------
// LRR_ENC_KEY: 64 hex characters, or the 32-byte base64 value from Render's "Generate" button.
function encKey() {
  const v = String(process.env.LRR_ENC_KEY || '').trim();
  if (/^[0-9a-fA-F]{64}$/.test(v)) return Buffer.from(v, 'hex');
  const b = Buffer.from(v, 'base64');
  if (b.length === 32) return b;
  throw new Error('LRR_ENC_KEY is not set on Render. Add it with the Generate button.');
}

export function encryptPass(plain) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', encKey(), iv);
  const data = Buffer.concat([c.update(String(plain), 'utf8'), c.final()]);
  return ['v1', iv.toString('base64'), c.getAuthTag().toString('base64'), data.toString('base64')].join(':');
}

export function decryptPass(stored) {
  const [v, iv, tag, data] = String(stored || '').split(':');
  if (v !== 'v1') throw new Error('Saved password is in an unknown format. Reconnect your email.');
  const d = crypto.createDecipheriv('aes-256-gcm', encKey(), Buffer.from(iv, 'base64'));
  d.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([d.update(Buffer.from(data, 'base64')), d.final()]).toString('utf8');
}

// Database calls run as the signed-in customer, so row-level security only lets
// them touch their own row.
async function rest(user, path, opts = {}) {
  const r = await fetch(SB_URL + '/rest/v1/' + path, {
    ...opts,
    cache: 'no-store',
    headers: { apikey: SB_KEY, Authorization: 'Bearer ' + user.token, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  const text = await r.text();
  const j = text ? JSON.parse(text) : null;
  if (!r.ok) throw new Error((j && (j.message || j.error)) || 'Database error ' + r.status);
  return j;
}

export async function getAccount(user) {
  const rows = await rest(user, 'lrr_mail_accounts?select=email,host,pass_enc,updated_at&user_id=eq.' + encodeURIComponent(user.id));
  return (rows && rows[0]) || null;
}

export async function saveAccount(user, { email, host, pass }) {
  const row = { user_id: user.id, email, host, pass_enc: encryptPass(pass), updated_at: new Date().toISOString() };
  await rest(user, 'lrr_mail_accounts?on_conflict=user_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(row),
  });
}

export async function deleteAccount(user) {
  await rest(user, 'lrr_mail_accounts?user_id=eq.' + encodeURIComponent(user.id), { method: 'DELETE' });
}

export function boxFor(account) {
  return { user: account.email, host: account.host, pass: decryptPass(account.pass_enc).replace(/\s+/g, '') };
}
