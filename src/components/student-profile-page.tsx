'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { StudentProfile } from '../lib/linways/profile';
import { profileChannelName, type ProfileMessage } from '../lib/linways/channel';

type View = { phase: 'waiting' | 'loading' | 'ready' | 'error' | 'cleared'; profile?: StudentProfile; fetchedAt?: number; message?: string };
export function StudentProfilePage() {
  const [view, setView] = useState<View>({ phase: 'waiting' });
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!/^[a-f0-9-]{36}$/.test(id)) {
      const expired = setTimeout(() => setView({ phase: 'error', message: 'Open this page using Fetch student details in the Student tab.' }), 0);
      return () => clearTimeout(expired);
    }
    const channel = new BroadcastChannel(profileChannelName(id));
    let connected = false;
    channel.onmessage = (event: MessageEvent<ProfileMessage>) => {
      connected = true;
      const value = event.data;
      if (value.type === 'result') setView({ phase: 'ready', profile: value.profile, fetchedAt: value.fetchedAt });
      else if (value.type === 'error') setView({ phase: 'error', message: value.message });
      else if (value.type === 'cleared') setView({ phase: 'cleared' });
      else if (value.type === 'loading') setView({ phase: 'loading' });
    };
    channel.postMessage({ type: 'ready' });
    const timeout = setTimeout(() => { if (!connected) setView({ phase: 'error', message: 'This temporary profile session has expired. Fetch your details again from Student.' }); }, 10_000);
    return () => { clearTimeout(timeout); channel.close(); };
  }, []);
  const profile = view.profile;
  const populated = profile?.sections.reduce((count, section) => count + section.fields.filter((field) => field.value !== null).length, 0) ?? 0;
  return <div className="prototype-app profile-app"><header className="prototype-header"><Link href="/" className="brand"><span className="brand-mark" aria-hidden="true">a.</span><span>Attend.</span></Link><span className="prototype-tag">Student profile</span></header><main className="profile-main attendance-page">
    <div className="profile-toolbar"><Link href="/">← Student workspace</Link><span className="step-label">LINWAYS / PROFILE</span></div>
    {view.phase === 'ready' && profile ? <>
      <section className="profile-overview"><div className="profile-monogram" aria-hidden="true">{(profile.summary.name ?? 'Student').split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase()}</div><div className="profile-identity"><p className="eyebrow">YOUR STUDENT PROFILE</p><h1>{profile.summary.name ?? 'Student profile'}</h1><p>{profile.summary.programme ?? 'Programme not provided'}</p><div className="profile-id-row"><span>Roll no. <strong>{profile.summary.rollNo ?? 'Not provided'}</strong></span><span>Register no. <strong>{profile.summary.registerNo ?? 'Not provided'}</strong></span></div></div><div className="profile-source"><span className="state-pill is-success">Fetched from Linways</span><p>{view.fetchedAt ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(view.fetchedAt) : ''}</p><span>{populated} populated fields</span></div></section>
      {profile.notes.length > 0 && <div className="profile-notes" role="status">{profile.notes.map((note) => <p key={note}>{note}</p>)}</div>}
      <div className="profile-layout"><nav className="profile-section-nav" aria-label="Profile sections"><span className="step-label">ON THIS PAGE</span>{profile.sections.map((section, index) => <a href={`#profile-section-${index}`} key={section.title}>{section.title}</a>)}</nav><div className="profile-sections">{profile.sections.map((section, index) => <section id={`profile-section-${index}`} className="prototype-card profile-section" key={section.title}><div className="profile-section-heading"><span className="profile-section-number">{String(index + 1).padStart(2, '0')}</span><h2>{section.title}</h2></div><dl className="profile-field-grid">{section.fields.map((field) => <div key={field.label} className={field.value === null ? 'field-empty' : ''}><dt>{field.label}</dt><dd>{field.value ?? 'Not provided'}</dd></div>)}</dl></section>)}</div></div>
    </> : <section className="prototype-card profile-loading" aria-live="polite"><span className="step-label">YOUR CAMPUS PROFILE</span><h1>{view.phase === 'cleared' ? 'Profile cleared.' : view.phase === 'error' ? 'Couldn’t load your profile.' : 'Getting your profile ready.'}</h1><p>{view.phase === 'cleared' ? 'Your student workspace was reset or closed. Fetch your details again to start fresh.' : view.message ?? 'Signing in to Linways and organizing your Profile information. This may take a few seconds.'}</p><Link href="/">Return to Student</Link></section>}
    <footer className="prototype-footer"><span>Profile information, clearly presented.</span><span>Empty fields show “Not provided” · Details stay in this session</span></footer>
  </main></div>;
}
