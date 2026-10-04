import { getIdentityProvider } from '../../../../lib/auth/current-user';
import { errorResponse, HttpError, readCredentials, sessionResponse } from '../../../../lib/auth/http';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const credentials = await readCredentials(request);
    const issued = await getIdentityProvider().login(credentials);
    if (!issued) throw new HttpError(401, 'invalid_credentials', 'Email or password is incorrect.');
    return sessionResponse(issued, 200, request);
  } catch (error) { return errorResponse(error); }
}
