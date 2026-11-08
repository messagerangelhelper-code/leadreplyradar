import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { scoreEmail } from './score';

// Mailboxes come from Render env vars:
//   MAIL1_USER, MAIL1_PASS (app password), optional MAIL1_HOST (default imap.gmail.com)
//   MAIL2_USER, MAIL2_PASS, MAIL2_HOST ... up to MAIL3
// The app opens the inbox READ-ONLY. It never sends, deletes or marks mail as read.

const DAYS = Number(process.env.MAIL_DAYS || 7);
const MAX_PER_BOX = Number(process.env.MAIL_MAX || 30);
const CACHE_MS = 45 * 1000;

let cache = { at: 0, data: null };

export function mailboxes() {
  const boxes = [];
  for (let i = 1; i <= 3; i++) {
    const user = process.env['MAIL' + i + '_USER'];
    const pass = process.env['MAIL' + i + '_PASS'];
    if (user && pass) {
      const host = process.env['MAIL' + i + '_HOST'] || 'imap.gmail.com';
      boxes.push({ user, pass: pass.replace(/\s+/g, ''), host });
    }
  }
  return boxes;
}

function gmailLink(user, messageId) {
  if (!messageId) return null;
  const id = messageId.replace(/^<|>$/g, '');
  return (
    'https://mail.google.com/mail/u/?authuser=' +
    encodeURIComponent(user) +
    '#search/rfc822msgid%3A' +
    encodeURIComponent(id)
  );
}

async function readBox(box) {
  const client = new ImapFlow({
    host: box.host,
    port: 993,
    secure: true,
    auth: { user: box.user, pass: box.pass },
    logger: false,
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 40000,
  });
  const items = [];
  await client.connect();
  const lock = await client.getMailboxLock('INBOX', { readOnly: true });
  try {
    const since = new Date(Date.now() - DAYS * 24 * 3600 * 1000);
    let uids = (await client.search({ since }, { uid: true })) || [];
    uids = uids.slice(-MAX_PER_BOX);
    if (uids.length) {
      for await (const msg of client.fetch(
        uids,
        { uid: true, envelope: true, flags: true, internalDate: true, source: { start: 0, maxLength: 6000 } },
        { uid: true }
      )) {
        let text = '';
        try {
          const parsed = await simpleParser(msg.source);
          text = (parsed.text || (parsed.html ? String(parsed.html).replace(/<[^>]+>/g, ' ') : '') || '')
            .replace(/\s+/g, ' ')
            .trim();
        } catch (e) {}
        const env = msg.envelope || {};
        const from = (env.from && env.from[0]) || {};
        const m = {
          id: box.user + ':' + msg.uid,
          account: box.user,
          fromName: from.name || from.address || 'Unknown',
          fromAddress: from.address || '',
          subject: env.subject || '(no subject)',
          text,
          preview: text.slice(0, 160),
          date: (env.date || msg.internalDate || new Date()).toISOString(),
          unread: !(msg.flags && msg.flags.has('\\Seen')),
          link: box.host.includes('gmail') ? gmailLink(box.user, env.messageId) : null,
        };
        Object.assign(m, scoreEmail(m));
        delete m.text;
        items.push(m);
      }
    }
  } finally {
    lock.release();
    await client.logout().catch(() => {});
  }
  return items;
}

function describe(err) {
  if (!err) return 'Unknown error';
  const extra = err.responseText || (err.authenticationFailed ? 'Gmail rejected the app password' : '');
  return String(err.message || err) + (extra ? ' (' + extra + ')' : '');
}

export async function readAllMail() {
  if (cache.data && Date.now() - cache.at < CACHE_MS) return cache.data;
  const boxes = mailboxes();
  const results = await Promise.allSettled(boxes.map(readBox));
  const items = [];
  const accounts = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      items.push(...r.value);
      accounts.push({ user: boxes[i].user, ok: true, count: r.value.length });
      console.log('LeadReplyRadar read ' + r.value.length + ' emails from ' + boxes[i].user);
    } else {
      console.error('LeadReplyRadar could not read ' + boxes[i].user + ': ' + describe(r.reason));
      accounts.push({ user: boxes[i].user, ok: false, error: describe(r.reason) });
    }
  });
  items.sort((a, b) => new Date(b.date) - new Date(a.date));
  const data = { items, accounts, checkedAt: new Date().toISOString() };
  cache = { at: Date.now(), data };
  return data;
}
