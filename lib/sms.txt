// Sends text alerts through Twilio. No extra package: it calls Twilio's API directly.
// Render env vars:
//   TWILIO_ACCOUNT_SID  (starts with AC)
//   TWILIO_AUTH_TOKEN
//   TWILIO_FROM         (your Twilio number, like +15125550123)
//   ALERT_PHONE         (your cell, like +15125550199)
// Optional: ALERT_MIN_SCORE (default 80 = Hot only)

const sent = new Set();
const bootAt = Date.now();

export function smsIsSet() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM &&
      process.env.ALERT_PHONE
  );
}

export async function sendSms(body) {
  if (!smsIsSet()) throw new Error('Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM and ALERT_PHONE on Render.');
  const sid = process.env.TWILIO_ACCOUNT_SID.trim();
  const auth = Buffer.from(sid + ':' + process.env.TWILIO_AUTH_TOKEN.trim()).toString('base64');
  const res = await fetch('https://api.twilio.com/2010-04-01/Accounts/' + sid + '/Messages.json', {
    method: 'POST',
    headers: { Authorization: 'Basic ' + auth, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      To: process.env.ALERT_PHONE.trim(),
      From: process.env.TWILIO_FROM.trim(),
      Body: body.slice(0, 300),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error('Twilio said: ' + (data.message || res.status));
  return data.sid;
}

// Texts you once for each new Hot email. Only emails that arrived in the last
// 2 hours count, so a restart never re-sends old ones. At most 3 texts per check.
export async function alertHot(items) {
  if (!smsIsSet()) return 0;
  const min = Number(process.env.ALERT_MIN_SCORE || 80);
  const cutoff = Math.max(Date.now() - 2 * 3600 * 1000, bootAt - 10 * 60 * 1000);
  const fresh = items.filter(
    (m) => m.score >= min && m.unread && new Date(m.date).getTime() >= cutoff && !sent.has(m.id)
  );
  let count = 0;
  for (const m of fresh.slice(0, 3)) {
    sent.add(m.id);
    try {
      await sendSms('LeadReplyRadar: Hot email from ' + m.fromName + ': ' + m.subject);
      count++;
    } catch (e) {
      console.error('LeadReplyRadar text failed: ' + String(e.message || e));
    }
  }
  return count;
}
