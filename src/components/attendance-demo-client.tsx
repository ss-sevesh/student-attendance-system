'use client';

import { useEffect, useRef, useState } from 'react';
import { describeFace } from '../lib/attendance/face-client';

type DemoStatus = { enrolled: boolean; recordedAt: number | null };

async function demoRequest(method = 'GET', body?: object): Promise<DemoStatus> {
  const response = await fetch('/api/attendance/demo', {
    method, cache: 'no-store',
    ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message ?? 'Could not complete the demo request.');
  return data;
}

export function AttendanceDemoClient() {
  const [status, setStatus] = useState<DemoStatus | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Loading demo...');
  const [error, setError] = useState('');
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraRequestRef = useRef(0);

  useEffect(() => {
    let active = true;
    demoRequest().then((data) => { if (active) { setStatus(data); setMessage(''); } })
      .catch((reason) => { if (active) { setError(reason.message); setMessage(''); } });
    return () => {
      active = false;
      cameraRequestRef.current += 1;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  function stopCamera() {
    cameraRequestRef.current += 1;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false); setCameraStarting(false);
  }

  async function startCamera() {
    if (cameraOn || cameraStarting || busy) return;
    const requestId = ++cameraRequestRef.current;
    setCameraStarting(true); setError(''); setMessage('');
    let stream: MediaStream | null = null;
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera access requires HTTPS or localhost and a supported browser.');
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      if (requestId !== cameraRequestRef.current) { stream.getTracks().forEach((track) => track.stop()); return; }
      streamRef.current = stream;
      if (!videoRef.current) throw new Error('Camera preview is unavailable. Try again.');
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      if (requestId !== cameraRequestRef.current) { stream.getTracks().forEach((track) => track.stop()); return; }
      setCameraOn(true); setMessage('Camera ready. Look straight ahead and mark demo attendance.');
    } catch (reason) {
      stream?.getTracks().forEach((track) => track.stop());
      if (requestId === cameraRequestRef.current) {
        streamRef.current = null;
        if (videoRef.current) videoRef.current.srcObject = null;
        setError(reason instanceof Error && reason.message.startsWith('Camera access requires') ? reason.message : 'Camera unavailable or permission denied. Allow camera access and try again.');
      }
    } finally { if (requestId === cameraRequestRef.current) setCameraStarting(false); }
  }

  async function run(action: 'enroll' | 'check-in' | 'reset' | 'remove') {
    if (busy || cameraStarting) return;
    setBusy(true); setError(''); setMessage(action === 'enroll' ? 'Reading your selfie...' : action === 'check-in' ? 'Comparing your face...' : 'Updating demo...');
    let url: string | undefined;
    try {
      if (action === 'enroll') {
        if (!file || !consent) throw new Error('Choose a selfie and agree to save its face reference.');
        stopCamera();
        url = URL.createObjectURL(file);
        const image = new Image(); image.src = url; await image.decode();
        setStatus(await demoRequest('POST', { action, consent: true, descriptor: await describeFace(image) }));
        setFile(null); setConsent(false); setMessage('Demo reference saved. Start the camera to try your face.');
      } else if (action === 'check-in') {
        if (!cameraOn || !videoRef.current) throw new Error('Start the camera first.');
        await demoRequest('POST', { action, descriptor: await describeFace(videoRef.current) });
        setStatus(await demoRequest());
        stopCamera(); setMessage('Present! Your face matched and demo attendance was saved.');
      } else {
        setStatus(await demoRequest(action === 'remove' ? 'DELETE' : 'POST', action === 'reset' ? { action } : undefined));
        stopCamera();
        setMessage(action === 'reset' ? 'Demo result reset. You can try again.' : 'Demo reference and result removed.');
      }
    } catch (reason) { setMessage(''); setError(reason instanceof Error ? reason.message : 'Demo failed. Try again.'); }
    finally { if (url) URL.revokeObjectURL(url); setBusy(false); }
  }

  function selectFile(selected: File | null) {
    setFile(null); setError(''); setMessage('');
    if (!selected) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(selected.type) || selected.size === 0 || selected.size > 10 * 1024 * 1024) {
      setError('Choose a JPEG, PNG, or WebP selfie up to 10 MB.'); return;
    }
    setFile(selected);
  }

  return <>
    <p className="attendance-warning">Demo results are separate from class attendance. This prototype can be fooled by photos and has no liveness check.</p>
    {message && <p role="status">{message}</p>}
    {error && <p role="alert" className="form-error">{error}</p>}
    {status && <>
      <section className="status" aria-labelledby="demo-reference-title">
        <h2 id="demo-reference-title">1. Save your reference selfie</h2>
        <p>{status.enrolled ? 'Your demo reference is saved. You can replace it below.' : 'Choose a clear photo containing only your face.'} The photo is discarded after reading; only an encrypted face reference is stored.</p>
        <label htmlFor="demo-selfie">Reference selfie</label>
        <input id="demo-selfie" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || cameraStarting} onChange={(event) => { selectFile(event.target.files?.[0] ?? null); event.target.value = ''; }} />
        {file && <p>Selected: {file.name}</p>}
        <label className="attendance-consent"><input type="checkbox" checked={consent} disabled={busy} onChange={(event) => setConsent(event.target.checked)} /> I agree to save my face reference for this demo.</label>
        <button type="button" onClick={() => run('enroll')} disabled={!file || !consent || busy || cameraStarting}>Save demo reference</button>
        {status.enrolled && <button type="button" className="attendance-remove" disabled={busy || cameraStarting} onClick={() => run('remove')}>Remove demo reference</button>}
      </section>
      <section className="status" aria-labelledby="demo-camera-title">
        <h2 id="demo-camera-title">2. Show your face</h2>
        <p>Allow camera access, face the camera in good light, then press Mark demo attendance.</p>
        <div className="attendance-camera-controls">
          <button type="button" disabled={!status.enrolled || busy} onClick={cameraOn || cameraStarting ? stopCamera : startCamera}>{cameraStarting ? 'Cancel camera' : cameraOn ? 'Stop camera' : 'Start camera'}</button>
          <video ref={videoRef} autoPlay playsInline muted aria-label="Live camera preview" className={cameraOn ? 'attendance-video' : 'attendance-video hidden'} />
          <button type="button" disabled={!cameraOn || busy} onClick={() => run('check-in')}>Mark demo attendance</button>
        </div>
      </section>
      <section className="status" aria-labelledby="demo-result-title">
        <h2 id="demo-result-title">3. Demo result</h2>
        <p>{status.recordedAt !== null ? `Last demo Present: ${new Date(status.recordedAt).toLocaleString()}` : 'No demo attendance marked yet.'}</p>
        {status.recordedAt !== null && <button type="button" disabled={busy || cameraStarting} onClick={() => run('reset')}>Reset demo result</button>}
      </section>
    </>}
  </>;
}
