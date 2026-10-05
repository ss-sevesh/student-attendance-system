'use client';
import { useEffect, useRef, useState } from 'react';
import { profileChannelName, type ProfileMessage } from '../lib/linways/channel';

export function StudentDetails() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const channels = useRef<BroadcastChannel[]>([]);
  const activeChannel = useRef<BroadcastChannel | null>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    const pending = controller; const resultTabs = channels;
    return () => { pending.current?.abort(); for (const channel of resultTabs.current) { channel.postMessage({ type: 'cleared' }); channel.close(); } };
  }, []);

  async function load() {
    if (busy) return;
    setError(''); setMessage('');
    const id = crypto.randomUUID();
    const channel = new BroadcastChannel(profileChannelName(id));
    const resultTab = window.open(`/student/profile#${id}`, '_blank');
    if (!resultTab) { channel.close(); setError('Allow pop-ups for this site, then fetch again to open your profile tab.'); return; }
    resultTab.opener = null;
    channels.current.push(channel);
    activeChannel.current = channel;
    let latest: ProfileMessage = { type: 'loading' };
    channel.onmessage = (event: MessageEvent<ProfileMessage>) => { if (event.data.type === 'ready') channel.postMessage(latest); };
    setBusy(true);
    const request = new AbortController(); controller.current = request;
    const credentials = { email, password }; setPassword('');
    try {
      const response = await fetch('/api/linways/details', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(credentials), signal: request.signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message ?? 'Could not fetch student details.');
      if (!request.signal.aborted) {
        latest = { type: 'result', profile: result.profile, fetchedAt: result.fetchedAt };
        channel.postMessage(latest); setMessage('Your formatted Profile information is ready in the new tab.');
      }
    } catch (reason) {
      const text = request.signal.aborted ? 'Fetching was cancelled. Return to Student to try again.' : reason instanceof Error ? reason.message : 'Could not fetch student details.';
      latest = { type: 'error', message: text };
      // Unmount/reset has already closed its channels.
      if (!request.signal.aborted) { channel.postMessage(latest); setError(text); }
    }
    finally { if (activeChannel.current === channel) activeChannel.current = null; if (!request.signal.aborted) setBusy(false); }
  }

  return <section className="prototype-card student-details-panel">
    <div className="schedule-heading"><div><span className="step-label">YOUR CAMPUS PROFILE</span><h2>Student details</h2></div><button type="button" className="secondary-button" aria-expanded={open} aria-controls="student-details-content" onClick={() => {
      if (open) { activeChannel.current?.postMessage({ type: 'error', message: 'Fetching was cancelled. Return to Student to try again.' }); controller.current?.abort(); setBusy(false); setPassword(''); setEmail(''); setMessage(''); setError(''); }
      setOpen(!open);
    }}>{open ? 'Close details' : 'View student details'}</button></div>
    <p>Connect to Linways to view your student information.</p>
    {open && <div id="student-details-content">
      <form className="attendance-admin-form" onSubmit={(event) => { event.preventDefault(); void load(); }}>
        <label htmlFor="linways-email">Linways email</label><input id="linways-email" type="email" autoComplete="off" required maxLength={254} value={email} disabled={busy} onChange={(event) => setEmail(event.target.value)} />
        <label htmlFor="linways-password">Linways password</label><input id="linways-password" type="password" autoComplete="off" required maxLength={256} value={password} disabled={busy} onChange={(event) => setPassword(event.target.value)} />
        <p className="details-privacy">Your Profile opens in a new tab. Credentials are sent to kec.linways.com; your password and details are not saved in this app.</p>
        <button type="submit" disabled={busy}>{busy ? 'Fetching from Linways…' : 'Fetch student details'}</button>
      </form>
      {busy && <p role="status">Signing in to Linways and reading your profile…</p>}
      {error && <p role="alert" className="form-error">{error}</p>}
      {message && <p role="status" className="details-success">{message}</p>}
      <a href="https://kec.linways.com/ams/student/login" target="_blank" rel="noopener noreferrer">Open Linways directly ↗</a>
    </div>}
  </section>;
}
