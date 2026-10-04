import Link from 'next/link';
import { requireUser } from '../../../lib/auth/current-user';
import { AttendanceDemoClient } from '../../../components/attendance-demo-client';

export const dynamic = 'force-dynamic';

export default async function AttendanceDemoPage() {
  await requireUser();
  return <main className="attendance-page">
    <Link href="/attendance">Back to attendance</Link>
    <p className="eyebrow">Try it anytime</p>
    <h1>Attendance demo</h1>
    <p>Save a clear selfie, show your face to the camera, and mark demo attendance. No scheduled period is needed.</p>
    <AttendanceDemoClient />
  </main>;
}
