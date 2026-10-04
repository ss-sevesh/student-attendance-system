import Link from 'next/link';
import { requireUser } from '../../lib/auth/current-user';
import { LogoutButton } from '../../components/logout-button';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const user = await requireUser();
  return <main className="dashboard">
    <p className="eyebrow">Student Registration</p>
    <h1>Your dashboard</h1>
    <p>Signed in as {user.email}</p>
    <section className="status" aria-labelledby="register-title">
      <h2 id="register-title">Register Student</h2>
      <p>Upload your student ID card to extract candidate details for review.</p>
      <Link href="/register" className="action-button">Register Student</Link>
    </section>
    <section className="status" aria-labelledby="profile-title">
      <h2 id="profile-title">Latest reviewed profile</h2>
      <p>No reviewed profile yet. Your saved profile will appear here after registration is available.</p>
    </section>
    <section className="status" aria-labelledby="attendance-title">
      <h2 id="attendance-title">Period attendance</h2>
      <p>Enroll your ID-card portrait, then check in during a scheduled period’s first five minutes.</p>
      <Link href="/attendance" className="action-button">Open attendance</Link>
      {process.env.ADMIN_EMAIL?.trim().toLowerCase() === user.email && <p><Link href="/admin/attendance">Manage timetable</Link></p>}
    </section>
    <LogoutButton />
  </main>;
}
