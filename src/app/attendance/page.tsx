import Link from 'next/link';
import { requireUser } from '../../lib/auth/current-user';
import { AttendanceClient } from '../../components/attendance-client';

export const dynamic = 'force-dynamic';

export default async function AttendancePage() {
  const user = await requireUser();
  return <main className="attendance-page">
    <Link href="/dashboard">← Back to dashboard</Link>
    <p className="eyebrow">Student attendance prototype</p>
    <h1>Period check-in</h1>
    <p>Signed in as {user.email}. Each period opens for five minutes from its scheduled start.</p>
    <AttendanceClient />
  </main>;
}
