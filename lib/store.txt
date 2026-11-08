// Saves the Tools page data (sequences, A/B tests, lead lists, calls) inside YOUR OWN
// Gmail, in a label called "LeadReplyRadar Data". No database and no other service.
// Render restarts the app on every deploy; this is how nothing gets lost.
// Only the newest copy is kept; older copies go to Gmail's Trash.

import { ImapFlow } from 'imapflow';
import { mailboxes } from './imap';

const FOLDER = 'LeadReplyRadar Data';
const SUBJECT = 'LeadReplyRadar data (do not delete)';
const SAVE_DELAY_MS = 20 * 1000;

function empty() {
  return { v: 1, sequences: [], tests: [], leads: [], calls: [], sentDay: { day: '', count: 0 } };
}

const box = (globalThis.__lrrTools = globalThis.__lrrTools || {
  data: empty(),
  loaded: false,
  loading: null,
  dirty: false,
  saving: null,
  timer: null,
  error: '',
  savedAt: '',
});

function connect() {
  const b = mailboxes()[0];
  if (!b) throw new Error('Add MAIL1_USER and MAIL1_PASS on Render first.');
  return new ImapFlow({
    host: b.host,
    port: 993,
    secure: true,
    auth: { user: b.user, pass: b.pass },
    logger: false,
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 40000,
  });
}

function decode(source) {
  const s = Buffer.isBuffer(source) ? source.toString('latin1') : String(source || '');
  const i = s.search(/\r?\n\r?\n/);
  if (i < 0) return null;
  const body = s.slice(i).replace(/[^A-Za-z0-9+/=]/g, '');
  return JSON.parse(Buffer.from(body, 'base64').toString('utf8'));
}

function encode(data, user) {
  const b64 = Buffer.from(JSON.stringify(data), 'utf8').toString('base64').replace(/.{1,76}/g, '$&\r\n');
  return [
    'From: ' + user,
    'To: ' + user,
    'Subject: ' + SUBJECT,
    'Date: ' + new Date().toUTCString(),
    'MIME-Version: 1.0',
    'Content-Type: application/json; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    b64,
  ].join('\r\n');
}

async function loadNow() {
  if (!mailboxes().length) {
    box.loaded = true;
    return box.data;
  }
  const client = connect();
  await client.connect();
  try {
    const list = await client.list();
    if (!list.some((f) => f.path === FOLDER)) {
      box.data = empty();
    } else {
      const lock = await client.getMailboxLock(FOLDER, { readOnly: true });
      try {
        const uids = (await client.search({ all: true }, { uid: true })) || [];
        if (uids.length) {
          const last = uids[uids.length - 1];
          const msg = await client.fetchOne(String(last), { source: true }, { uid: true });
          const parsed = msg && msg.source ? decode(msg.source) : null;
          box.data = { ...empty(), ...(parsed || {}) };
        } else {
          box.data = empty();
        }
      } finally {
        lock.release();
      }
    }
    box.loaded = true;
    box.error = '';
    console.log('LeadReplyRadar tools data loaded from Gmail');
  } finally {
    await client.logout().catch(() => {});
  }
  return box.data;
}

// Loads once after a restart. Safe to call many times.
export async function loadStore() {
  if (box.loaded) return box.data;
  if (!box.loading) {
    box.loading = loadNow()
      .catch((e) => {
        box.error = 'Could not load saved tools data: ' + String(e.message || e).slice(0, 150);
        console.error('LeadReplyRadar ' + box.error);
        throw e;
      })
      .finally(() => {
        box.loading = null;
      });
  }
  return box.loading;
}

export function store() {
  return box.data;
}

export function storeStatus() {
  return { loaded: box.loaded, error: box.error, savedAt: box.savedAt };
}

async function saveNow() {
  // Never save before the old data was read, or it would be wiped.
  if (!box.loaded) await loadStore();
  const b = mailboxes()[0];
  if (!b) return;
  box.dirty = false;
  const client = connect();
  await client.connect();
  try {
    const list = await client.list();
    if (!list.some((f) => f.path === FOLDER)) await client.mailboxCreate(FOLDER);
    const res = await client.append(FOLDER, encode(box.data, b.user), ['\\Seen']);
    const trash = list.find((f) => f.specialUse === '\\Trash');
    const lock = await client.getMailboxLock(FOLDER);
    try {
      const uids = (await client.search({ all: true }, { uid: true })) || [];
      const keep = res && res.uid ? res.uid : uids[uids.length - 1];
      const old = uids.filter((u) => u !== keep);
      if (old.length) {
        if (trash) await client.messageMove(old.join(','), trash.path, { uid: true });
        else await client.messageDelete(old.join(','), { uid: true });
      }
    } finally {
      lock.release();
    }
    // Empty our old copies out of Trash too, so they don't pile up.
    if (trash) {
      const tl = await client.getMailboxLock(trash.path);
      try {
        const junk = (await client.search({ subject: SUBJECT }, { uid: true })) || [];
        if (junk.length) await client.messageDelete(junk.join(','), { uid: true });
      } finally {
        tl.release();
      }
    }
    box.savedAt = new Date().toISOString();
    box.error = '';
  } catch (e) {
    box.dirty = true;
    box.error = 'Could not save tools data: ' + String(e.message || e).slice(0, 150);
    console.error('LeadReplyRadar ' + box.error);
  } finally {
    await client.logout().catch(() => {});
  }
}

// Call after any change. Saves to Gmail about 20 seconds later (changes are grouped).
export function markDirty() {
  box.dirty = true;
  if (box.timer) return;
  box.timer = setTimeout(() => {
    box.timer = null;
    flushStore().catch(() => {});
  }, SAVE_DELAY_MS);
}

export async function flushStore() {
  if (box.saving) return box.saving;
  if (!box.dirty) return;
  box.saving = saveNow().finally(() => {
    box.saving = null;
  });
  return box.saving;
}

export function newId(prefix) {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
