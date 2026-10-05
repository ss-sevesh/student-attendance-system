'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ManualTimetable } from './manual-timetable';
import { PrototypeStudent, type PrototypeStatus } from './prototype-student';
type Period = { id: number; weekday: number; name: string; start_time: string; end_time?: string | null };
export function PrototypeDashboard({ initial, admin = false }: { initial: PrototypeStatus & { timetable: Period[] }; admin?: boolean }) {
  const [periods, setPeriods] = useState(initial.timetable);
  return <div className="prototype-app"><header className="prototype-header"><Link href="/" className="brand"><span className="brand-mark" aria-hidden="true">a.</span><span>Attend<span className="brand-dot">.</span></span></Link><span className="prototype-tag">Campus prototype</span></header><main className="prototype-main attendance-page">
    <div className="workspace-heading"><div><p className="eyebrow">{admin ? 'ADMIN WORKSPACE' : 'STUDENT WORKSPACE'}</p><h1>{admin ? 'Make time for learning.' : 'Good to see you.'}</h1><p>{admin ? 'Build the timetable. Keep every period in order.' : 'Your photo. Your timetable. A simple way to show up.'}</p></div><nav className="role-switch" aria-label="Workspace"><Link href="/" aria-current={!admin ? 'page' : undefined}>Student</Link><Link href="/?view=admin" aria-current={admin ? 'page' : undefined}>Admin</Link></nav></div>
    <div className="workspace-meta"><span><span className="live-dot" />{admin ? 'Timetable management' : 'Face attendance'}</span><span>{initial.timezone} · No sign-in needed</span></div>
    {admin ? <div className="admin-workspace"><aside className="admin-note"><span className="step-label">THE WEEK, YOUR WAY</span><h2>Seven periods.<br />One clear plan.</h2><p>Choose a weekday and edit subjects, start times and end times. Save your changes to update the student timetable.</p><div className="admin-example"><span>EXAMPLE CHECK-IN</span><strong>10:00 → Period 2</strong><p>With a 09:45–10:45 range, a student can check in at any time during that period.</p></div></aside><ManualTimetable prototype initialWeekday={new Date(`${initial.date}T12:00:00Z`).getUTCDay()} periods={periods} onSaved={setPeriods} /></div> : <PrototypeStudent initial={initial} />}
    <footer className="prototype-footer"><span>Attend. / Show up, simply.</span><span>Shared demo workspace · Prototype face matching</span></footer></main></div>;
}
