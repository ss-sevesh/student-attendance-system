'use client';
import { useEffect, useRef, useState } from 'react';
import { describeFace } from '../lib/attendance/face-client';
import { StudentDetails } from './student-details';

export type PrototypeStatus = { date: string; timezone: string; enrolled: boolean; photoSavedAt: number | null; periods: { id: number; name: string; start_time: string; end_time: string; open: boolean; recordedAt: number | null }[] };

export function PrototypeStudent({ initial }: { initial: PrototypeStatus }) {
  const [status, setStatus] = useState(initial);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [camera, setCamera] = useState(false);
  const [starting, setStarting] = useState(false);
  const [detailsVersion, setDetailsVersion] = useState(0);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const requestId = useRef(0);
  const photoUrl = useRef('');
  const refreshSequence = useRef(0);
  const current = status.periods.find((period) => period.open);
  async function refresh() {
    const sequence = ++refreshSequence.current;
    const response = await fetch('/api/prototype', { cache: 'no-store' });
    if (!response.ok) throw new Error('Could not refresh attendance.');
    const updated = await response.json();
    if (sequence === refreshSequence.current) setStatus(updated);
  }
  useEffect(() => {
    const cameraRequest = requestId;
    const cameraStream = stream;
    const selectedPhoto = photoUrl;
    const interval = setInterval(() => { void refresh().catch(() => setError('Could not refresh attendance. Please reload.')); }, 15_000);
    return () => { clearInterval(interval); cameraRequest.current++; cameraStream.current?.getTracks().forEach((track) => track.stop()); if (selectedPhoto.current) URL.revokeObjectURL(selectedPhoto.current); };
  }, []);
  async function savePhoto() {
    if (!file || !consent || busy) return;
    setBusy(true); setError(''); setMessage('Reading your face and saving photo…');
    const url = URL.createObjectURL(file);
    try {
      const image = new Image(); image.src = url; await image.decode();
      const descriptor = await describeFace(image);
      const form = new FormData(); form.set('photo', file); form.set('descriptor', JSON.stringify(descriptor)); form.set('consent', 'true');
      const response = await fetch('/api/prototype', { method: 'POST', body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message ?? 'Photo could not be saved.');
      setStatus(result); setFile(null); URL.revokeObjectURL(photoUrl.current); photoUrl.current = ''; setPreview(''); setConsent(false); setMessage('Photo saved. Your face is ready for attendance.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save photo.'); setMessage(''); }
    finally { URL.revokeObjectURL(url); setBusy(false); }
  }
  function stopCamera() {
    requestId.current++; stream.current?.getTracks().forEach((track) => track.stop()); stream.current = null;
    if (video.current) video.current.srcObject = null;
    setCamera(false); setStarting(false);
  }
  async function startCamera() {
    const id = ++requestId.current; setStarting(true); setError(''); setMessage('');
    let captured: MediaStream | null = null;
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera needs localhost or HTTPS.');
      captured = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      if (id !== requestId.current) { captured.getTracks().forEach((track) => track.stop()); return; }
      stream.current = captured;
      if (!video.current) throw new Error('Camera preview unavailable.');
      video.current.srcObject = captured; await video.current.play();
      if (id === requestId.current) setCamera(true);
    } catch { captured?.getTracks().forEach((track) => track.stop()); if (id === requestId.current) setError('Allow camera access, then try again.'); }
    finally { if (id === requestId.current) setStarting(false); }
  }
  async function markPresent() {
    if (!camera || !video.current || busy) return;
    setBusy(true); setError(''); setMessage('Matching your face…');
    try {
      const descriptor = await describeFace(video.current);
      const response = await fetch('/api/prototype', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ descriptor }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message ?? 'Could not mark attendance.');
      await refresh(); setMessage(result.status === 'present' ? `Present marked for ${result.periodName}.` : `Already present for ${result.periodName}.`); stopCamera();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Face check failed.'); setMessage(''); }
    finally { setBusy(false); }
  }
  async function removePhoto() {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/prototype', { method: 'DELETE' });
      if (!response.ok) throw new Error('Could not remove photo.');
      setStatus(await response.json()); stopCamera(); setMessage('Saved photo removed. Attendance records are retained.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not remove photo.'); }
    finally { setBusy(false); }
  }
  async function resetStudent() {
    if (busy) return;
    setBusy(true); setError(''); setMessage(''); stopCamera();
    refreshSequence.current++;
    try {
      const response = await fetch('/api/prototype', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reset' }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message ?? 'Could not reset student.');
      refreshSequence.current++;
      setStatus(result); setFile(null); setConsent(false); setPreview('');
      setDetailsVersion((version) => version + 1);
      if (photoUrl.current) URL.revokeObjectURL(photoUrl.current);
      photoUrl.current = '';
      setMessage('Student reset. Your saved photo and marked attendance have been cleared.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not reset student.'); }
    finally { setBusy(false); }
  }
  return <>
    <StudentDetails key={detailsVersion} />
    <div className="student-reset"><p>Start fresh by clearing your saved photo and all marked attendance.</p><button type="button" className="secondary-button" disabled={busy} onClick={() => void resetStudent()}>Reset student</button></div>
    {message && <p className="prototype-notice" role="status">{message}</p>}{error && <p className="prototype-notice form-error" role="alert">{error}</p>}
    <div className="student-workspace">
      <section className="prototype-card photo-panel">
        <div className="card-heading"><span className="step-label">01 / YOUR PHOTO</span><span className={`state-pill ${status.photoSavedAt ? 'is-success' : ''}`}>{status.photoSavedAt ? 'Photo saved' : 'Setup needed'}</span></div>
        <h2>A face to remember.</h2><p>Upload a clear selfie or ID portrait. Save it once, then use your camera to check in.</p>
        <div className="portrait-frame">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {file && preview ? <img src={preview} alt="Selected photo, not saved yet" /> : status.photoSavedAt ? <img src={`/api/prototype?photo=1&v=${status.photoSavedAt}`} alt="Your saved attendance photo" /> : <div className="portrait-empty"><span aria-hidden="true">◎</span><p>Your photo goes here</p></div>}
        </div>
        {file && <p className="photo-caption">{file.name} · Not saved yet</p>}{!file && status.photoSavedAt && <p className="photo-caption">Saved {new Date(status.photoSavedAt).toLocaleString()}</p>}
        <label className="upload-label" htmlFor="prototype-photo">{status.photoSavedAt ? 'Choose a replacement photo' : 'Choose your photo'}</label>
        <input id="prototype-photo" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(event) => {
          const selected = event.target.files?.[0] ?? null; event.target.value = ''; setError(''); setMessage('');
          if (selected && (!['image/jpeg', 'image/png', 'image/webp'].includes(selected.type) || selected.size === 0 || selected.size > 10 * 1024 * 1024)) { setError('Choose a JPEG, PNG or WebP photo under 10 MB.'); return; }
          if (photoUrl.current) URL.revokeObjectURL(photoUrl.current);
          photoUrl.current = selected ? URL.createObjectURL(selected) : '';
          setPreview(photoUrl.current); setFile(selected); setConsent(false);
        }} />
        {file && <label className="attendance-consent"><input type="checkbox" checked={consent} disabled={busy} onChange={(event) => setConsent(event.target.checked)} /> Save my photo and face reference for this prototype.</label>}
        <div className="button-row"><button type="button" disabled={!file || !consent || busy} onClick={() => void savePhoto()}>{busy && file ? 'Saving photo…' : 'Save photo'}</button>{status.photoSavedAt && <button className="secondary-button" disabled={busy} type="button" onClick={() => void removePhoto()}>Remove photo</button>}</div>
      </section>
      <section className="prototype-card checkin-panel">
        <div className="card-heading"><span className="step-label">02 / CHECK IN</span><span className="state-pill">{current ? 'Period active' : 'Between periods'}</span></div><h2>{current ? current.name : 'Ready when you are.'}</h2><p>{current ? `${current.start_time} – ${current.end_time} · ${status.timezone}` : 'Your next check-in will appear during a scheduled period.'}</p>
        <div className="camera-frame"><video ref={video} autoPlay playsInline muted aria-label="Live camera preview" className={camera ? '' : 'camera-hidden'} />{!camera && <div className="camera-placeholder"><span aria-hidden="true">⌖</span><strong>{status.enrolled ? 'Let’s see you.' : 'Save your photo first.'}</strong><p>Your camera preview appears here.</p></div>}{camera && <span className="camera-live">● Camera live</span>}</div>
        <div className="button-row"><button type="button" className="secondary-button" disabled={!status.enrolled || busy} onClick={() => camera || starting ? stopCamera() : void startCamera()}>{starting ? 'Cancel camera' : camera ? 'Stop camera' : 'Start camera'}</button><button type="button" disabled={!camera || busy || !current || Boolean(current.recordedAt)} onClick={() => void markPresent()}>{current?.recordedAt ? 'Already present' : busy && !file ? 'Checking…' : 'Mark present'}</button></div><p className="checkin-help">Look straight at the camera, then mark present. We’ll select the current period automatically.</p>
      </section>
    </div>
    <section className="prototype-card day-schedule"><div className="schedule-heading"><div><span className="step-label">YOUR DAY AT A GLANCE</span><h2>Today’s timetable</h2></div><span className="schedule-date">{status.date}</span></div><div className="schedule-list">{status.periods.map((period, index) => <div key={period.id} className={`schedule-row ${period.open ? 'current-period' : ''}`}><span className="period-number">{String(index + 1).padStart(2, '0')}</span><div><strong>{period.name}</strong><span>{period.start_time} – {period.end_time}</span></div><span className={`state-pill ${period.recordedAt ? 'is-success' : ''}`}>{period.recordedAt ? 'Present' : period.open ? 'Active now' : 'Scheduled'}</span></div>)}</div>{status.periods.length === 0 && <p>No periods today. Open Admin to add your timetable.</p>}</section>
  </>;
}
