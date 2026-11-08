import crypto from 'crypto';

export const COOKIE_NAME = 'lrr_auth';

// The cookie holds a hash of the dashboard password, never the password itself.
export function tokenFor(password) {
  return crypto
    .createHash('sha256')
    .update('leadreplyradar:' + String(password || ''))
    .digest('hex');
}

export function passwordIsSet() {
  return Boolean(process.env.DASHBOARD_PASSWORD);
}

export function isAuthed(request) {
  if (!passwordIsSet()) return false;
  // The cookie works when the app is opened on its own. Inside the CashCow Mail
  // dashboard, phones block that cookie, so the page also sends the same value in a header.
  const cookie = request.cookies.get(COOKIE_NAME);
  const given = request.headers.get('x-lrr-auth') || (cookie && cookie.value) || '';
  if (!given) return false;
  const expected = tokenFor(process.env.DASHBOARD_PASSWORD);
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
