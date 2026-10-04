import { expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../../src/lib/auth/password';

it('uses fresh salts and verifies only the unchanged password', async () => {
  const first = await hashPassword('  strong password  ');
  const second = await hashPassword('  strong password  ');
  expect(first).not.toBe(second);
  expect(await verifyPassword('  strong password  ', first)).toBe(true);
  expect(await verifyPassword('strong password', first)).toBe(false);
});

it('fails safely for malformed stored hashes', async () => {
  for (const hash of ['', 'scrypt$1$99999999$8$1$a$b', 'scrypt$1$16384$8$1$bad$bad']) {
    expect(await verifyPassword('strong password', hash)).toBe(false);
  }
});
