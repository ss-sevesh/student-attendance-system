export type Credentials = Readonly<{ email: string; password: string }>;

export function validateCredentials(input: unknown): Credentials {
  if (typeof input !== 'object' || input === null || !('email' in input) || !('password' in input)) {
    throw new Error('Enter a valid email and password.');
  }
  const { email, password } = input;
  if (typeof email !== 'string' || typeof password !== 'string') {
    throw new Error('Enter a valid email and password.');
  }
  const canonicalEmail = email.trim().toLowerCase();
  if (canonicalEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(canonicalEmail)) {
    throw new Error('Enter a valid email address.');
  }
  if (Array.from(password).length < 12 || Array.from(password).length > 128) {
    throw new Error('Use a password of 12 to 128 characters.');
  }
  return { email: canonicalEmail, password };
}
