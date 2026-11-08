// Checks your mail every 5 minutes, even when the page is closed. It texts you Hot
// emails and saves important senders to Brevo.
// It also visits its own web address so Render's free plan doesn't put it to sleep.
import { mailboxes, readAllMail } from './imap';
import { alertHot, smsIsSet } from './sms';
import { brevoIsSet, syncToBrevo } from './brevo';

const EVERY_MS = 5 * 60 * 1000;
let started = false;

async function tick() {
  try {
    if (mailboxes().length && (smsIsSet() || brevoIsSet())) {
      const data = await readAllMail();
      const items = data.items || [];
      const n = await alertHot(items);
      if (n) console.log('LeadReplyRadar sent ' + n + ' text alert(s)');
      const b = await syncToBrevo(items);
      if (b) console.log('LeadReplyRadar saved ' + b + ' contact(s) to Brevo');
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
  console.log('LeadReplyRadar watcher started' + (brevoIsSet() ? ' (Brevo on)' : ''));
}
