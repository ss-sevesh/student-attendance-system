import { HttpError } from '../auth/http';
import { buildProfile, type StudentProfile } from './profile';

const origin = 'https://kec.linways.com';
export const studentFields = ['name', 'rollNo', 'registerNo', 'programme', 'campusName', 'batchName', 'currentSem', 'fatherName', 'motherName', 'email', 'phone'] as const;
export type StudentDetails = Partial<Record<typeof studentFields[number], string>>;

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function validatePortalCredentials(value: Record<string, unknown>) {
  const { email, password } = value;
  if (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
    typeof password !== 'string' || !password || password.length > 256) {
    throw new HttpError(400, 'invalid_credentials', 'Enter your Linways email and password.');
  }
  return { email: email.trim(), password };
}

export async function fetchStudentDetails(email: string, password: string): Promise<StudentProfile> {
  const signal = AbortSignal.timeout(25_000);
  async function portalRequest(path: string, options: RequestInit) {
    try {
      const response = await fetch(`${origin}${path}`, { ...options, cache: 'no-store', redirect: 'error', signal });
      if (!response.ok) throw new HttpError(response.status === 401 || response.status === 403 ? 401 : 502, 'portal_unavailable', response.status === 401 || response.status === 403 ? 'Linways could not authorize this request. Check your credentials or sign in directly to the portal.' : 'Linways could not return student details. Try again later.');
      return { response, body: object(await response.json()) };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(502, 'portal_unavailable', 'Could not reach Linways. Try again, or open the portal directly.');
    }
  }
  const login = await portalRequest('/academics/api/v1/auth/student-login-credentials', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: email, password, userType: 'STUDENT', next: '' }),
  });
  const data = object(login.body.data);
  if (login.body.success !== true || data.validLogin !== true || typeof data.accessToken !== 'string' || !data.accessToken) {
    if (login.body.code === 'FAILED_TO_MEET_PASSWORD_POLICY') throw new HttpError(409, 'portal_action_required', 'Linways requires a password update. Open Linways and complete it there, then try again.');
    throw new HttpError(401, 'invalid_credentials', 'Linways did not accept these credentials. Check your email and password.');
  }
  // Cookies and token belong only to this request; never return or persist them.
  const cookies = login.response.headers.getSetCookie().map((cookie) => cookie.split(';')[0]).join('; ');
  const profile = await portalRequest('/academics/api/v1/student/get-my-profile-details', {
    method: 'GET', headers: { Authorization: `Bearer ${data.accessToken}`, ...(cookies ? { Cookie: cookies } : {}) },
  });
  if (profile.body.success !== true) throw new HttpError(502, 'profile_unavailable', 'Signed in, but Linways could not return your profile. Try again later.');
  const source = object(profile.body.data);
  const details: StudentDetails = {};
  for (const field of studentFields) {
    const value = source[field];
    if (typeof value === 'string' && value.trim()) details[field] = value.slice(0, 500);
    else if (typeof value === 'number' && Number.isFinite(value)) details[field] = String(value);
  }
  if (!details.name && !details.rollNo && !details.registerNo) throw new HttpError(502, 'profile_unavailable', 'Linways returned an unfamiliar profile format. Open the portal to view your details.');
  // The ID comes from the token returned by Linways, never from client input.
  let studentId: unknown;
  try {
    const claims = object(JSON.parse(Buffer.from(data.accessToken.split('.')[1], 'base64url').toString()));
    const account = object(claims.data);
    if (account.userType === 'STUDENT') studentId = account.userId;
  } catch { /* Fall back to the verified summary when no student ID is available. */ }
  if (typeof studentId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(studentId)) {
    return buildProfile(source, {}, {}, ['Linways returned the profile summary, but the full Profile section could not be loaded.']);
  }
  const authHeaders = { Authorization: `Bearer ${data.accessToken}`, ...(cookies ? { Cookie: cookies } : {}) };
  const results = await Promise.allSettled([
    portalRequest(`/academics/api/v1/student/get-student-detailed/${encodeURIComponent(studentId)}`, { method: 'GET', headers: authHeaders }),
    portalRequest('/academics/api/v1/student/get-student-history-and-datails', { method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify({ request: { studentId, showPreviousEducation: true } }) }),
  ]);
  const notes: string[] = [];
  const sections = results.map((result, index) => {
    if (result.status === 'fulfilled' && result.value.body.success === true) return object(result.value.body.data);
    notes.push(index === 0 ? 'The full Profile section was unavailable. Summary information is shown; other fields may be missing.' : 'Previous education and academic history could not be loaded from Linways.');
    return {};
  });
  return buildProfile(source, sections[0], sections[1], notes);
}
