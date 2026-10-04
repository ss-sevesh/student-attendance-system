'use client';

import { useEffect, useRef, useState } from 'react';
import { describeFace } from '../lib/attendance/face-client';

type Period = { id: number; start_time: string; name: string; open: boolean; recordedAt: number | null };
type Status = { date: string; timezone: string; periods: Period[]; enrolled: boolean };
const supportedCardTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const maxCardBytes = 10 * 1024 * 1024;

async function send(path: string, body: object) {
  const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message ?? 'Request failed.');
  return data;
}

export function AttendanceClient() {
  const [status, setStatus] = useState<Status | null>(null);
  const [message, setMessage] = useState('Loading attendance…');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [cardFile, setCardFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraRequestRef = useRef(0);

  async function refresh() {
    const response = await fetch('/api/attendance/status', { cache: 'no-store' });
    if (!response.ok) throw new Error('Could not load the timetable.');
    setStatus(await response.json() as Status);
  }

  useEffect(() => {
    fetch('/api/attendance/status', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not load the timetable.');
        setStatus(await response.json() as Status);
        setMessage('');
      })
      .catch((reason) => setError(String(reason)));
    return () => {
      cameraRequestRef.current += 1;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  function selectCard(file: File | null) {
    setCardFile(null);
    setError('');
    setMessage('');
    if (!file) return;
    if (!supportedCardTypes.has(file.type)) {
      setError('Choose a JPEG, PNG, or WebP ID card image.');
      return;
    }
    if (file.size === 0 || file.size > maxCardBytes) {
      setError('Choose an ID card image between 1 byte and 10 MB.');
      return;
    }
    setCardFile(file);
  }

  async function enroll() {
    if (!cardFile || !consent || busy) return;
    setBusy(true); setError(''); setMessage('Loading face model and reading card portrait…');
    const url = URL.createObjectURL(cardFile);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      const descriptor = await describeFace(image);
      await send('/api/attendance/enroll', { descriptor, consent: true });
      await refresh();
      setMessage(status?.enrolled ? 'Face reference replaced. You can check in during an open period.' : 'Face reference enrolled. You can now check in during an open period.');
      setCardFile(null);
      setConsent(false);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Enrollment failed.'); setMessage(''); }
    finally { URL.revokeObjectURL(url); setBusy(false); }
  }

  async function removeEnrollment() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/attendance/enroll', { method: 'DELETE' });
      if (!response.ok) throw new Error('Could not remove face reference.');
      await refresh();
      stopCamera();
      setCardFile(null);
      setConsent(false);
      setMessage('Face reference removed. Existing attendance records remain.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Removal failed.'); }
    finally { setBusy(false); }
  }

  async function startCamera() {
    if (cameraStarting || cameraOn) return;
    setError(''); setMessage(''); setCameraStarting(true);
    const requestId = ++cameraRequestRef.current;
    let stream: MediaStream | null = null;
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera access requires HTTPS or localhost and a supported browser.');
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      if (requestId !== cameraRequestRef.current) { stream.getTracks().forEach((track) => track.stop()); return; }
      streamRef.current = stream;
      if (!videoRef.current) throw new Error('Camera preview is unavailable. Retry or ask staff for help.');
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      if (requestId !== cameraRequestRef.current) { stream.getTracks().forEach((track) => track.stop()); return; }
      setCameraOn(true);
      setMessage('Camera ready. Choose an open period and check in.');
    } catch (reason) {
      stream?.getTracks().forEach((track) => track.stop());
      if (streamRef.current === stream) streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      if (requestId === cameraRequestRef.current) setError(reason instanceof Error && reason.message.startsWith('Camera access requires') ? reason.message : 'Camera unavailable or permission denied. Allow camera access and retry, or ask staff for help.');
    } finally { if (requestId === cameraRequestRef.current) setCameraStarting(false); }
  }

  function stopCamera() {
    cameraRequestRef.current += 1;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
    setCameraStarting(false);
  }

  async function checkIn(periodId: number) {
    if (!videoRef.current || !cameraOn || busy) return;
    setBusy(true); setError(''); setMessage('Comparing your camera face with the enrolled portrait…');
    try {
      const descriptor = await describeFace(videoRef.current);
      const result = await send('/api/attendance/check-in', { periodId, descriptor });
      await refresh();
      setMessage(result.status === 'present' ? 'Present recorded for this period.' : 'Attendance was already recorded for this period.');
      stopCamera();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Check-in failed.'); setMessage(''); }
    finally { setBusy(false); }
  }

  return <>
    <p className="attendance-warning">Prototype face matching can be fooled by a photo or a modified browser request. Do not use it for real attendance decisions yet.</p>
    {message && <p role="status" aria-live="polite">{message}</p>}
    {error && <p role="alert" className="form-error">{error}</p>}
    {!status ? null : <>
      <section className="status" aria-labelledby="enrollment-title">
        <h2 id="enrollment-title">Face enrollment</h2>
        <p>{status.enrolled ? 'A reference is enrolled. Upload a new card photo here to replace it.' : 'Upload an ID card with one clear portrait to enroll.'}</p>
        <label htmlFor="attendance-card">ID card image</label>
        <input id="attendance-card" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { selectCard(event.target.files?.[0] ?? null); event.target.value = ''; }} />
        {cardFile && <p>Selected: {cardFile.name}</p>}
        <label className="attendance-consent"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /> I agree to store an encrypted face reference for attendance. The card image is discarded after enrollment.</label>
        <button type="button" disabled={!cardFile || !consent || busy} onClick={enroll}>{status.enrolled ? 'Replace face reference' : 'Enroll face from card'}</button>
        {status.enrolled && <button type="button" disabled={busy} onClick={removeEnrollment} className="attendance-remove">Remove face reference</button>}
      </section>
      <section className="status" aria-labelledby="periods-title">
        <h2 id="periods-title">Today’s periods — {status.date} ({status.timezone})</h2>
        {status.periods.length === 0 && <p>No periods are scheduled today.</p>}
        {status.periods.map((period) => <div className="attendance-period" key={period.id}>
          <div><strong>{period.name}</strong> · {period.start_time}–{endTime(period.start_time)}
            <p>{period.recordedAt ? `Present at ${new Date(period.recordedAt).toLocaleTimeString()}` : period.open ? 'Check-in open now' : 'Check-in closed'}</p></div>
          {period.open && !period.recordedAt && status.enrolled && <button type="button" disabled={!cameraOn || busy} onClick={() => checkIn(period.id)}>Check in</button>}
        </div>)}
        {status.enrolled && <div className="attendance-camera-controls">
          <button type="button" onClick={cameraOn || cameraStarting ? stopCamera : startCamera} disabled={busy}>{cameraStarting ? 'Cancel camera' : cameraOn ? 'Stop camera' : 'Start camera'}</button>
          <video ref={videoRef} autoPlay playsInline muted aria-label="Live camera preview" className={cameraOn ? 'attendance-video' : 'attendance-video hidden'} />
        </div>}
      </section>
    </>}
  </>;
}

function endTime(start: string) {
  const [hour, minute] = start.split(':').map(Number);
  const total = hour * 60 + minute + 5;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
