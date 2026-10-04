import Link from 'next/link';
import { requireUser } from '../../lib/auth/current-user';
import { IdCardUpload } from '../../components/id-card-upload';

export const dynamic = 'force-dynamic';

export default async function RegisterPage() {
  const user = await requireUser();

  return (
    <main className="register-page">
      <nav className="page-nav" aria-label="Breadcrumb">
        <Link href="/dashboard" className="nav-back">
          ← Back to Dashboard
        </Link>
      </nav>

      <header className="page-header">
        <p className="eyebrow">Student Registration Step 1</p>
        <h1>ID Card Extraction</h1>
        <p className="user-indicator">Signed in as {user.email}</p>
      </header>

      <IdCardUpload userEmail={user.email} />
    </main>
  );
}
