// Checks your mail every 5 minutes, even when the page is closed, and texts you Hot emails.
// It also visits its own web address so Render's free plan doesn't put it to sleep.
import { mailboxes, readAllMail } from './imap';
import { alertHot, smsIsSet } from './sms';

const EVERY_MS = 5 * 60 * 1000;
let started = false;

async function tick() {
  try {
    if (mailboxes().length && smsIsSet()) {
      const data = await readAllMail();
      const n = await alertHot(data.items || []);
      if (n) console.log('LeadReplyRadar sent ' + n + ' text alert(s)');
    }
  } catch (e) {
    console.error('LeadReplyRadar watcher error: ' + String(e.message || e));
  }
  const url = process.env.RENDER_EXTERNAL_URL;
  if (url) fetch(url + '/').catch(() => {});
}

export function startWatcher() {
  if (started) return;
  started = true;
  setTimeout(tick, 30 * 1000);
  setInterval(tick, EVERY_MS);
  console.log('LeadReplyRadar watcher started');
}
