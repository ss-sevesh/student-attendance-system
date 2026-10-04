import { getIdentityProvider } from '../../../../lib/auth/current-user';
import { errorResponse, HttpError, readCredentials, sessionResponse } from '../../../../lib/auth/http';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const credentials = await readCredentials(request);
    try {
      const issued = await getIdentityProvider().signup(credentials);
      return sessionResponse(issued, 201, request);
    } catch (error) {
      if (error instanceof Error && error.message.includes('UNIQUE constraint failed: users.email')) {
        throw new HttpError(409, 'duplicate_email', 'An account with this email already exists.');
      }
      throw error;
    }
  } catch (error) { return errorResponse(error); }
}
