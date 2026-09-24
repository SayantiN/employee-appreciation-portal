/**
 * Design demo — stand-in for the live scrypt module. Browsers have no
 * synchronous scrypt, and a demo on sample data needs none: passwords are
 * stored with a readable prefix. The policy check is the real one, so the
 * sign-in and change-password screens behave exactly as in production.
 */
export function hashPassword(plain) {
  return `demo$${plain}`;
}

export function verifyPassword(plain, stored) {
  return String(stored) === `demo$${plain}`;
}

export function passwordPolicyErrors(plain, { fullName = '', email = '' } = {}) {
  const errors = [];
  const pw = String(plain || '');
  if (pw.length < 10) errors.push('At least 10 characters');
  const classes = [/[A-Z]/, /[a-z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(pw)).length;
  if (classes < 3) errors.push('Three of: uppercase, lowercase, digit, symbol');
  const local = String(email).split('@')[0].toLowerCase();
  const lower = pw.toLowerCase();
  const nameParts = String(fullName).toLowerCase().split(/\s+/).filter((s) => s.length > 2);
  if ((local && local.length > 2 && lower.includes(local)) || nameParts.some((n) => lower.includes(n))) {
    errors.push('Must not contain your name or email');
  }
  const blocklist = ['password', 'passw0rd', '12345678', '123456789', 'qwertyuiop', 'letmein', 'welcome1', 'admin123', 'iloveyou', 'changeme'];
  if (blocklist.some((b) => lower.includes(b))) errors.push('Too common — choose something less guessable');
  return errors;
}

export function randomToken(bytes = 32) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Only used to look up reset tokens by value; any stable hash will do here. */
export function sha256(value) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (const ch of String(value)) {
    const c = ch.charCodeAt(0);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  return (h1 >>> 0).toString(16) + (h2 >>> 0).toString(16);
}
