import { randomBytes, scrypt as callbackScrypt, timingSafeEqual } from 'node:crypto';
const params = { N: 16_384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 };

function scrypt(password: string, salt: Buffer, length: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    callbackScrypt(password, salt, length, params, (error, hash) => {
      if (error) reject(error);
      else resolve(hash);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt$1$${params.N}$${params.r}$${params.p}$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 7 || parts[0] !== 'scrypt' || parts[1] !== '1' ||
      parts[2] !== String(params.N) || parts[3] !== String(params.r) || parts[4] !== String(params.p) ||
      !/^[0-9a-f]{32}$/.test(parts[5]) || !/^[0-9a-f]{128}$/.test(parts[6])) return false;
  try {
    const expected = Buffer.from(parts[6], 'hex');
    const actual = await scrypt(password, Buffer.from(parts[5], 'hex'), expected.length);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
