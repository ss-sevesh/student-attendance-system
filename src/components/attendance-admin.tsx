'use client';

import { useEffect, useState } from 'react';

type Period = { id: number; weekday: number; start_time: string; name: string };
const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function AttendanceAdmin() {
  const [periods, setPeriods] = useState<Period[] | null>(null);
  const [weekday, setWeekday] = useState(1);
  const [startTime, setStartTime] = useState('09:00');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/attendance/periods', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not load timetable.');
        setPeriods((await response.json()).periods as Period[]);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Could not load timetable.'));
  }, []);

  async function change(method: 'POST' | 'DELETE', body: object) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/attendance/periods', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message ?? 'Timetable update failed.');
      setPeriods(data.periods as Period[]);
      if (method === 'POST') setName('');
      setMessage(method === 'POST' ? 'Period added.' : 'Period removed.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Timetable update failed.');
    } finally {
      setBusy(false);
    }
  }

  return <>
    {error && <p role="alert" className="form-error">{error}</p>}
    {message && <p role="status">{message}</p>}
    <form className="attendance-admin-form" onSubmit={(event) => { event.preventDefault(); void change('POST', { weekday, startTime, name }); }}>
      <label htmlFor="period-day">Weekday</label>
      <select id="period-day" value={weekday} onChange={(event) => setWeekday(Number(event.target.value))}>
        {days.map((day, index) => <option value={index} key={day}>{day}</option>)}
      </select>
      <label htmlFor="period-time">Start time</label>
      <input id="period-time" type="time" required value={startTime} onChange={(event) => setStartTime(event.target.value)} />
      <label htmlFor="period-name">Period name</label>
      <input id="period-name" required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Mathematics" />
      <button type="submit" disabled={busy}>Add period</button>
    </form>
    <section className="status" aria-labelledby="timetable-title">
      <h2 id="timetable-title">Weekly timetable</h2>
      {periods === null ? <p>Loading timetable…</p> : periods.length === 0 ? <p>No periods scheduled yet.</p> : periods.map((period) => <div className="attendance-period" key={period.id}>
        <span>{days[period.weekday]} {period.start_time} — {period.name}</span>
        <button type="button" disabled={busy} aria-label={`Remove ${period.name} on ${days[period.weekday]} at ${period.start_time}`} onClick={() => void change('DELETE', { id: period.id })}>Remove</button>
      </div>)}
    </section>
  </>;
}
