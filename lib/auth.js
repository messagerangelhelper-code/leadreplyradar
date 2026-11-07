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
  const cookie = request.cookies.get(COOKIE_NAME);
  if (!cookie || !cookie.value) return false;
  const expected = tokenFor(process.env.DASHBOARD_PASSWORD);
  const a = Buffer.from(cookie.value);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
