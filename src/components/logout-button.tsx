'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function logout() {
    if (pending) return;
    setPending(true);
    setError('');
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (!response.ok) { setError('Could not sign out. Try again.'); return; }
      router.replace('/login');
      router.refresh();
    } catch { setError('Could not sign out. Try again.'); }
    finally { setPending(false); }
  }

  return <div className="logout-control">
    <button type="button" disabled={pending} onClick={logout}>{pending ? 'Signing out…' : 'Sign out'}</button>
    <p className="form-error" role="alert" aria-live="assertive">{error}</p>
  </div>;
}
