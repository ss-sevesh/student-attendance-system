import Link from 'next/link';
import { AccountForm } from '../../components/account-form';

export default function SignupPage() {
  return <main className="account-page">
    <p className="eyebrow">Student Registration</p>
    <h1>Create your account</h1>
    <p>Save your reviewed student information when registration becomes available.</p>
    <AccountForm mode="signup" />
    <p>Already have an account? <Link href="/login">Sign in</Link></p>
  </main>;
}
