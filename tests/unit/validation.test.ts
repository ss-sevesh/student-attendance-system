import { expect, it } from 'vitest';
import { validateCredentials } from '../../src/lib/auth/validation';

it('canonicalizes email while preserving the password exactly', () => {
  expect(validateCredentials({ email: ' Student@Example.COM ', password: '  twelve chars  ' }))
    .toEqual({ email: 'student@example.com', password: '  twelve chars  ' });
});

it('rejects malformed and unbounded credentials', () => {
  for (const input of [
    { email: 1, password: 'long enough password' },
    { email: 'bad email', password: 'long enough password' },
    { email: 'a@example.com', password: 'short' },
    { email: 'a@example.com', password: 'x'.repeat(129) },
    { email: `${'a'.repeat(245)}@example.com`, password: 'long enough password' },
  ]) expect(() => validateCredentials(input)).toThrow();
});
