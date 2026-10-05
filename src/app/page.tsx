import { PrototypeDashboard } from '../components/prototype-dashboard';
import { prototypeStatus } from '../lib/attendance/prototype';
import { allPeriods } from '../lib/attendance/service';

export const dynamic = 'force-dynamic';
export default async function HomePage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  return <PrototypeDashboard admin={view === 'admin'} initial={{ ...prototypeStatus(), timetable: allPeriods() }} />;
}
