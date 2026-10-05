'use client';

import { useState } from 'react';

type Period = { id: number; weekday: number; start_time: string; end_time?: string | null; name: string };
type Draft = { id?: number; name: string; startTime: string; endTime: string };
const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function ManualTimetable({ periods, onSaved, prototype = false, initialWeekday }: { periods: Period[]; onSaved: (periods: Period[]) => void; prototype?: boolean; initialWeekday?: number }) {
  const today = initialWeekday ?? new Date().getDay();
  const [open, setOpen] = useState(prototype);
  const [weekday, setWeekday] = useState(prototype ? today : 1);
  const [draft, setDraft] = useState<Draft[]>(() => makeDraft(prototype ? today : 1));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  function makeDraft(day: number): Draft[] {
    const existing = periods.filter((period) => period.weekday === day);
    return Array.from({ length: 7 }, (_, index) => existing[index]
      ? { id: existing[index].id, name: existing[index].name, startTime: existing[index].start_time, endTime: existing[index].end_time ?? `${String(10 + index).padStart(2, '0')}:00` }
      : { name: `Period ${index + 1}`, startTime: `${String(9 + index).padStart(2, '0')}:00`, endTime: `${String(10 + index).padStart(2, '0')}:00` });
  }

  function loadDay(day: number) {
    const existing = periods.filter((period) => period.weekday === day);
    setWeekday(day);
    setError(existing.length > 7 ? 'This day has more than seven periods. Remove extra periods from the weekly timetable first.' : '');
    setMessage('');
    setDraft(makeDraft(day));
  }

  function edit(index: number, field: 'name' | 'startTime' | 'endTime', value: string) {
    setDraft((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row));
    setMessage('');
  }

  async function save() {
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch(prototype ? '/api/prototype' : '/api/attendance/periods', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekday, periods: draft }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message ?? 'Could not save timetable.');
      const saved = data.periods as Period[];
      onSaved(saved);
      setDraft(saved.filter((period) => period.weekday === weekday).map((period) => ({ id: period.id, name: period.name, startTime: period.start_time, endTime: period.end_time! })));
      setMessage(`Seven periods saved for ${days[weekday]}. You can edit them here anytime.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save timetable.');
    } finally { setBusy(false); }
  }

  return <section className="status" aria-labelledby="manual-timetable-title">
    <h2 id="manual-timetable-title">Manual timetable</h2>
    <p>Seven periods. Your subjects, your schedule. All times are in the campus timezone.</p>
    <button type="button" aria-expanded={open} aria-controls="manual-timetable-editor" disabled={busy} onClick={() => { if (!open) loadDay(weekday); setOpen(!open); }}>
      {open ? 'Close timetable editor' : 'Enter timetable manually'}
    </button>
    {open && <form id="manual-timetable-editor" className="attendance-admin-form" onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <fieldset disabled={busy} className="manual-timetable-fields">
        <label htmlFor="manual-day">Timetable weekday</label>
        <select id="manual-day" value={weekday} onChange={(event) => loadDay(Number(event.target.value))}>
          {days.map((day, index) => <option key={day} value={index}>{day}</option>)}
        </select>
        <p>{prototype ? 'Students can mark present anytime within a period’s start and end time. Ranges cannot overlap.' : 'Start times must be in chronological order. Check-in stays open for five minutes after each start.'}</p>
        {draft.map((row, index) => <fieldset key={index} className="manual-period-row">
          <legend>Period {index + 1}</legend>
          <label htmlFor={`manual-name-${index}`}>Period {index + 1} name</label>
          <input id={`manual-name-${index}`} required maxLength={80} value={row.name} onChange={(event) => edit(index, 'name', event.target.value)} />
          <label htmlFor={`manual-time-${index}`}>Period {index + 1} start time</label>
          <input id={`manual-time-${index}`} type="time" required value={row.startTime} onChange={(event) => edit(index, 'startTime', event.target.value)} />
          {prototype && <><label htmlFor={`manual-end-${index}`}>Period {index + 1} end time</label>
            <input id={`manual-end-${index}`} type="time" required value={row.endTime} onChange={(event) => edit(index, 'endTime', event.target.value)} /></>}
        </fieldset>)}
        <button type="submit" disabled={periods.filter((period) => period.weekday === weekday).length > 7}>{busy ? 'Saving timetable…' : 'Save seven periods'}</button>
        <button type="button" onClick={() => loadDay(weekday)}>Reload saved timetable</button>
      </fieldset>
      {error && <p role="alert" className="form-error">{error}</p>}
      {message && <p role="status">{message}</p>}
    </form>}
  </section>;
}
