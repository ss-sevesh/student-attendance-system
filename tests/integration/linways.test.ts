import { afterEach, expect, it, vi } from 'vitest';
import { fetchStudentDetails, validatePortalCredentials } from '../../src/lib/linways/service';
import { POST } from '../../src/app/api/linways/details/route';

afterEach(() => vi.restoreAllMocks());
const login = () => Response.json({ success: true, data: { validLogin: true, accessToken: 'test-token' } }, { headers: { 'Set-Cookie': 'session=test-session; HttpOnly' } });

it('fetches only the signed-in student profile and returns no credentials or token', async () => {
  const mocked = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(login()).mockResolvedValueOnce(Response.json({ success: true, data: { name: 'Demo Student', rollNo: 'DEMO001', currentSem: 3, email: 'demo@example.com', accessToken: 'should-not-return', unexpected: 'ignored' } }));
  const result = await fetchStudentDetails('demo@example.com', 'short-pass');
  expect(result.summary).toEqual({ name: 'Demo Student', rollNo: 'DEMO001', currentSem: '3', email: 'demo@example.com' });
  expect(JSON.stringify(result)).not.toContain('should-not-return');
  expect(mocked.mock.calls[0][0]).toBe('https://kec.linways.com/academics/api/v1/auth/student-login-credentials');
  expect(mocked.mock.calls[1][0]).toBe('https://kec.linways.com/academics/api/v1/student/get-my-profile-details');
  expect(mocked.mock.calls[1][1]).toMatchObject({ redirect: 'error', cache: 'no-store', headers: { Authorization: 'Bearer test-token', Cookie: 'session=test-session' } });
});

it('does not impose this app’s new-account password policy on existing Linways passwords', () => {
  expect(validatePortalCredentials({ email: ' demo@example.com ', password: 'short' })).toEqual({ email: 'demo@example.com', password: 'short' });
  expect(() => validatePortalCredentials({ email: 'bad', password: 'short' })).toThrow('Linways email');
  expect(() => validatePortalCredentials({ email: 'demo@example.com', password: '' })).toThrow('Linways email');
});

it('handles incorrect credentials, required password changes and network failure without leaking upstream errors', async () => {
  const mocked = vi.spyOn(globalThis, 'fetch');
  mocked.mockResolvedValueOnce(Response.json({ success: false, message: 'sensitive upstream text' }));
  await expect(fetchStudentDetails('demo@example.com', 'short')).rejects.toMatchObject({ status: 401, code: 'invalid_credentials' });
  mocked.mockResolvedValueOnce(Response.json({ success: false, code: 'FAILED_TO_MEET_PASSWORD_POLICY' }));
  await expect(fetchStudentDetails('demo@example.com', 'short')).rejects.toMatchObject({ status: 409, code: 'portal_action_required' });
  mocked.mockRejectedValueOnce(new Error('secret upstream error'));
  await expect(fetchStudentDetails('demo@example.com', 'short')).rejects.toMatchObject({ status: 502, message: 'Could not reach Linways. Try again, or open the portal directly.' });
});

it('rejects requests from another origin and marks profile responses no-store', async () => {
  const mocked = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(login()).mockResolvedValueOnce(Response.json({ success: true, data: { name: 'Demo Student', rollNo: 'DEMO001' } }));
  const request = (origin: string) => new Request('http://localhost/api/linways/details', { method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'demo@example.com', password: 'short' }) });
  expect((await POST(request('http://other.example'))).status).toBe(403);
  expect(mocked).not.toHaveBeenCalled();
  const response = await POST(request('http://localhost'));
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  expect(await response.json()).toMatchObject({ source: 'Linways', profile: { summary: { name: 'Demo Student' } } });
});

it('reads the full Profile and history for only the student ID issued by Linways', async () => {
  const token = `header.${Buffer.from(JSON.stringify({ data: { userId: 'own-student', userType: 'STUDENT' } })).toString('base64url')}.signature`;
  const mocked = vi.spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(Response.json({ success: true, data: { validLogin: true, accessToken: token } }))
    .mockResolvedValueOnce(Response.json({ success: true, data: { name: 'Demo Student', rollNo: 'DEMO001' } }))
    .mockResolvedValueOnce(Response.json({ success: true, data: { name: ' Demo  Student ', birthday: '2006-05-11', fatherName: '&lt;b&gt;Demo Parent&lt;/b&gt;', gender: null, currentAddress: { address: 'Road&nbsp; 1<br>Town', zip: '123456' } } }))
    .mockResolvedValueOnce(Response.json({ success: true, data: { PreviousEducation: [{ schoolName: 'Test School', year: '2024' }] } }));
  const result = await fetchStudentDetails('demo@example.com', 'short-pass');
  expect(mocked.mock.calls[2][0]).toBe('https://kec.linways.com/academics/api/v1/student/get-student-detailed/own-student');
  expect(JSON.parse(mocked.mock.calls[3][1]!.body as string)).toEqual({ request: { studentId: 'own-student', showPreviousEducation: true } });
  expect(result.sections.find((section) => section.title === 'Personal information')?.fields).toContainEqual({ label: 'Date of birth', value: '11 May 2006' });
  expect(result.sections.find((section) => section.title === 'Family & guardian')?.fields).toContainEqual({ label: 'Father’s name', value: 'Demo Parent' });
  expect(result.notes).toEqual([]);
});
