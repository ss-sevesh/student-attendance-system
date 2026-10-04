import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="welcome">
      <p className="eyebrow">Student Registration</p>
      <h1>Your student information, in one place.</h1>
      <p>Review your ID card and student portal details before saving your profile.</p>
      <p><Link href="/signup">Create account</Link> or <Link href="/login">sign in</Link> to continue.</p>
      <section className="status" aria-labelledby="status-title">
        <h2 id="status-title">Getting ready</h2>
        <p>Account access is available. Student registration is coming next.</p>
      </section>
    </main>
  );
}
