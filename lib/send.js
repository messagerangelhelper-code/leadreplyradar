// Sends ONE reply from your own mailbox, only when you press Send on the dashboard
// and confirm. Uses the same app password as reading mail (MAIL1_USER / MAIL1_PASS).
// Gmail: smtp.gmail.com. Other boxes: MAILn_HOST with "imap." changed to "smtp.",
// or set MAILn_SMTP_HOST yourself.

import nodemailer from 'nodemailer';
import { mailboxes } from './imap';

// Replies already sent since the last restart, so a double tap can't send twice.
const sent = (globalThis.__lrrSent = globalThis.__lrrSent || new Map());

export function wasSent(id) {
  return sent.has(id);
}

function smtpFor(user) {
  const boxes = mailboxes();
  for (let i = 0; i < boxes.length; i++) {
    if (boxes[i].user.toLowerCase() === String(user || '').toLowerCase()) {
      const own = process.env['MAIL' + (i + 1) + '_SMTP_HOST'];
      const host = (own || boxes[i].host.replace(/^imap\./i, 'smtp.')).trim();
      return { host, user: boxes[i].user, pass: boxes[i].pass };
    }
  }
  return null;
}

function cleanAddress(a) {
  const s = String(a || '').trim();
  return /^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+$/.test(s) ? s : '';
}

export async function sendReply(m, text) {
  if (sent.has(m.id)) throw new Error('You already sent a reply to this email.');
  if ((m.tags || []).includes('Check sender')) throw new Error('This email may be a scam, so the app will not reply to it.');
  const to = cleanAddress(m.fromAddress);
  if (!to) throw new Error('This email has no address to reply to.');
  if (/no-?reply|do-?not-?reply|mailer-daemon/i.test(to)) throw new Error('This sender does not take replies (' + to + ').');
  const body = String(text || '').trim();
  if (!body) throw new Error('The reply is empty.');
  if (body.length > 5000) throw new Error('The reply is too long.');
  const box = smtpFor(m.account);
  if (!box) throw new Error('Could not find the mailbox this email came to.');

  const transport = nodemailer.createTransport({
    host: box.host,
    port: 465,
    secure: true,
    auth: { user: box.user, pass: box.pass },
    connectionTimeout: 15000,
    socketTimeout: 30000,
  });
  const subject = /^\s*re\s*:/i.test(m.subject || '') ? m.subject : 'Re: ' + (m.subject || '');
  const info = await transport.sendMail({
    from: box.user,
    to,
    subject,
    text: body,
    ...(m.messageId ? { inReplyTo: m.messageId, references: m.messageId } : {}),
  });
  sent.set(m.id, { to, at: new Date().toISOString() });
  console.log('LeadReplyRadar sent a reply from ' + box.user + ' to ' + to);
  return { to, from: box.user, messageId: info && info.messageId };
}
