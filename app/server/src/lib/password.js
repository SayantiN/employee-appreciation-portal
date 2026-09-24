import crypto from 'node:crypto';

/**
 * NF-2 — salted hashes using a modern adaptive algorithm.
 * scrypt is built into Node, so there is no native module to compile and
 * nothing to keep patched. Format: scrypt$N$r$p$salt$hash (all hex).
 */
const N = 16384, r = 8, p = 1, KEYLEN = 64;

export function hashPassword(plain) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(plain, salt, KEYLEN, { N, r, p, maxmem: 64 * 1024 * 1024 });
  return `scrypt$${N}$${r}$${p}$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifyPassword(plain, stored) {
  try {
    const [scheme, n, rr, pp, saltHex, hashHex] = String(stored).split('$');
    if (scheme !== 'scrypt') return false;
    const salt = Buffer.from(saltHex, 'hex');
    const expected = Buffer.from(hashHex, 'hex');
    const actual = crypto.scryptSync(plain, salt, expected.length, {
      N: Number(n), r: Number(rr), p: Number(pp), maxmem: 64 * 1024 * 1024,
    });
    return crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

/** SPEC 6.2 — policy. Returns [] when the password is acceptable. */
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

  const blocklist = [
    'password', 'passw0rd', '12345678', '123456789', 'qwertyuiop',
    'letmein', 'welcome1', 'admin123', 'iloveyou', 'changeme',
  ];
  if (blocklist.some((b) => lower.includes(b))) errors.push('Too common — choose something less guessable');

  return errors;
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

export function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}
