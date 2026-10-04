import Link from 'next/link';
import { AccountForm } from '../../components/account-form';

export default function LoginPage() {
  return <main className="account-page">
    <p className="eyebrow">Student Registration</p>
    <h1>Sign in</h1>
    <p>Use your application account to open your dashboard.</p>
    <AccountForm mode="login" />
    <p>New here? <Link href="/signup">Create an account</Link></p>
  </main>;
}
