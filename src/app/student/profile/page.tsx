import type { Metadata } from 'next';
import { StudentProfilePage } from '../../../components/student-profile-page';
export const metadata: Metadata = { title: 'Student profile — Attend.' };
export default function ProfilePage() { return <StudentProfilePage />; }
