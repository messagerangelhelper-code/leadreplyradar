// Saves the sender of each important email as a Brevo contact, with a note
// (subject, score, date). No extra package: it calls Brevo's API directly.
// Render env vars:
//   BREVO_API_KEY    (Brevo > SMTP & API > API keys)
// Optional:
//   BREVO_LIST_ID    (number of a Brevo contact list to add them to)
//   BREVO_MIN_SCORE  (default 50 = "Need a reply" and Hot)
// With no key set, nothing happens.

import crypto from 'crypto';

const API = 'https://api.brevo.com/v3';
// Kept on globalThis so the watcher and the dashboard share the same numbers.
const state = (globalThis.__lrrBrevo = globalThis.__lrrBrevo || {
  saved: new Set(), // email ids already in Brevo
  tried: new Set(), // email ids that failed this run
  lastError: '',
  notesOff: false,
});
const saved = state.saved;
const tried = state.tried;

export function brevoIsSet() {
  return Boolean(process.env.BREVO_API_KEY && process.env.BREVO_API_KEY.trim());
}

export function brevoStatus() {
  return { on: brevoIsSet(), saved: saved.size, error: state.lastError };
}

export function inBrevo(id) {
  return saved.has(id);
}

async function call(method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: {
      'api-key': process.env.BREVO_API_KEY.trim(),
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch (e) {}
  return { ok: res.ok, status: res.status, data };
}

function fail(what, r) {
  return new Error(what + ': ' + ((r.data && (r.data.message || r.data.code)) || r.status));
}

function isRobot(address) {
  return /no-?reply|do-?not-?reply|notifications?@|mailer-daemon|postmaster|bounce|newsletter|news@|marketing@|alerts?@/i.test(
    address
  );
}

function myAddresses() {
  const out = [];
  for (let i = 1; i <= 3; i++) {
    const u = process.env['MAIL' + i + '_USER'];
    if (u) out.push(u.trim().toLowerCase());
  }
  return out;
}

function splitName(name, address) {
  const n = String(name || '').trim();
  if (!n || n.includes('@') || n.toLowerCase() === address) return {};
  const parts = n.split(/\s+/);
  const attrs = { FIRSTNAME: parts[0] };
  if (parts.length > 1) attrs.LASTNAME = parts.slice(1).join(' ');
  return attrs;
}

function refFor(id) {
  return 'lrr-' + crypto.createHash('sha1').update(String(id)).digest('hex').slice(0, 10);
}

async function getOrCreateContact(m, listId) {
  const email = m.fromAddress.trim().toLowerCase();
  const got = await call('GET', '/contacts/' + encodeURIComponent(email));
  if (got.ok) {
    if (listId && !(got.data.listIds || []).includes(listId)) {
      const add = await call('POST', '/contacts/lists/' + listId + '/contacts/add', { emails: [email] });
      if (!add.ok) console.error('LeadReplyRadar Brevo list add failed for ' + email + ': ' + add.status);
    }
    return got.data.id;
  }
  if (got.status !== 404) throw fail('Brevo contact lookup', got);
  const body = { email, attributes: splitName(m.fromName, email), updateEnabled: true };
  if (listId) body.listIds = [listId];
  const made = await call('POST', '/contacts', body);
  if (!made.ok) throw fail('Brevo contact save', made);
  if (made.data && made.data.id) return made.data.id;
  const again = await call('GET', '/contacts/' + encodeURIComponent(email));
  if (!again.ok) throw fail('Brevo contact lookup', again);
  return again.data.id;
}

async function addNote(contactId, m) {
  if (state.notesOff) return;
  const ref = refFor(m.id);
  const list = await call('GET', '/crm/notes?entity=contacts&entityIds=' + contactId + '&limit=50');
  if (list.ok) {
    const notes = Array.isArray(list.data) ? list.data : list.data.items || list.data.notes || [];
    if (notes.some((n) => String(n.text || '').includes(ref))) return; // already noted
  }
  const level = m.score >= 80 ? 'Hot' : 'Need a reply';
  const day = new Date(m.date).toLocaleString('en-US', {
    timeZone: 'America/Chicago',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  const text =
    'LeadReplyRadar: ' + level + ' email (score ' + m.score + ') on ' + day + '\n' +
    'Subject: ' + m.subject + '\n' +
    (m.tags && m.tags.length ? 'Tags: ' + m.tags.join(', ') + '\n' : '') +
    'Ref: ' + ref;
  const r = await call('POST', '/crm/notes', { text, contactIds: [contactId] });
  if (!r.ok) {
    if (r.status === 403 || r.status === 404) {
      state.notesOff = true; // account has no CRM notes; keep saving contacts
      console.error('LeadReplyRadar Brevo notes are off for this account (' + r.status + '); saving contacts only');
      return;
    }
    throw fail('Brevo note', r);
  }
}

// Saves new important senders. At most 10 per check, so the free plan stays fast.
export async function syncToBrevo(items) {
  if (!brevoIsSet()) return 0;
  const min = Number(process.env.BREVO_MIN_SCORE || 50);
  const listId = Number(process.env.BREVO_LIST_ID || 0) || null;
  const mine = myAddresses();
  const todo = items.filter(
    (m) =>
      m.score >= min &&
      m.fromAddress &&
      !saved.has(m.id) &&
      !tried.has(m.id) &&
      !isRobot(m.fromAddress) &&
      !mine.includes(m.fromAddress.trim().toLowerCase()) &&
      !(m.tags || []).includes('Check sender') &&
      !(m.tags || []).includes('Unsubscribe')
  );
  let count = 0;
  for (const m of todo.slice(0, 10)) {
    try {
      const id = await getOrCreateContact(m, listId);
      await addNote(id, m);
      saved.add(m.id);
      count++;
      state.lastError = '';
    } catch (e) {
      tried.add(m.id);
      state.lastError = String(e.message || e);
      console.error('LeadReplyRadar Brevo error for ' + m.fromAddress + ': ' + state.lastError);
      if (/unauthori[sz]ed|key not found|401/i.test(state.lastError)) {
        tried.delete(m.id); // try again once the key is fixed
        break;
      }
    }
  }
  return count;
}
