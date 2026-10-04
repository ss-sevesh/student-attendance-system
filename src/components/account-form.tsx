'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

export function AccountForm({ mode }: { mode: 'signup' | 'login' }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const isSignup = mode === 'signup';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError('');
    setPending(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: form.get('email'), password: form.get('password') }),
      });
      if (!response.ok) {
        const body = await response.json() as { error?: { message?: string } };
        setError(body.error?.message ?? 'Something went wrong. Try again.');
        return;
      }
      router.push('/dashboard');
      router.refresh();
    } catch {
      setError('Could not connect. Try again.');
    } finally { setPending(false); }
  }

  return (
    <form className="account-form" onSubmit={submit}>
      <label htmlFor="email">Email address</label>
      <input id="email" name="email" type="email" autoComplete="email" required maxLength={254} />
      <label htmlFor="password">Password</label>
      <input id="password" name="password" type="password" autoComplete={isSignup ? 'new-password' : 'current-password'} required />
      {isSignup && <p className="form-help">Use 12 to 128 characters. Spaces are allowed.</p>}
      <p className="form-error" role="alert" aria-live="assertive">{error}</p>
      <button type="submit" disabled={pending}>{pending ? 'Please wait…' : isSignup ? 'Create account' : 'Sign in'}</button>
    </form>
  );
}
