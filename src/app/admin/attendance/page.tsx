import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '../../../lib/auth/current-user';
import { AttendanceAdmin } from '../../../components/attendance-admin';

export const dynamic = 'force-dynamic';
export default async function AttendanceAdminPage() {
  const user = await requireUser();
  if (!process.env.ADMIN_EMAIL || user.email !== process.env.ADMIN_EMAIL.trim().toLowerCase()) notFound();
  return <main className="attendance-page">
    <Link href="/dashboard">← Back to dashboard</Link>
    <p className="eyebrow">Admin</p>
    <h1>Attendance timetable</h1>
    <p>Set each period’s start time. Student check-in closes five minutes later.</p>
    <AttendanceAdmin />
  </main>;
}
