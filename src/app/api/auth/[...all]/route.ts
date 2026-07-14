import { toNextJsHandler } from 'better-auth/next-js';

import { getAuth } from '@/core/auth';
import { isCloudflareWorker } from '@/shared/lib/env';
import { enforceMinIntervalRateLimit } from '@/shared/lib/rate-limit';

function maybeRateLimitGetSession(request: Request): Response | null {
  const url = new URL(request.url);
  // better-auth session endpoint is served under this catch-all route.
  if (isCloudflareWorker || !url.pathname.endsWith('/api/auth/get-session')) {
    return null;
  }

  const intervalMs =
    Number(process.env.AUTH_GET_SESSION_MIN_INTERVAL_MS) ||
    // default: 800ms (enough to stop request storms but still responsive)
    800;

  return enforceMinIntervalRateLimit(request, {
    intervalMs,
    keyPrefix: 'auth-get-session',
  });
}

export async function POST(request: Request) {
  const limited = maybeRateLimitGetSession(request);
  if (limited) {
    return limited;
  }

  return handleAuthRequest(request, 'POST');
}

export async function GET(request: Request) {
  const limited = maybeRateLimitGetSession(request);
  if (limited) {
    return limited;
  }

  return handleAuthRequest(request, 'GET');
}

async function handleAuthRequest(request: Request, method: 'GET' | 'POST') {
  const auth = await getAuth();
  const handler = toNextJsHandler(auth.handler);
  try {
    const response = await handler[method](request);
    return normalizeGetSessionResponse(request, response);
  } catch (error) {
    const url = new URL(request.url);
    if (url.pathname.endsWith('/api/auth/get-session')) {
      console.warn(
        'auth get-session failed, returning unauthenticated response:',
        error
      );
      return Response.json(null, {
        headers: buildClearAuthCookieHeaders(request),
      });
    }

    throw error;
  }
}

function normalizeGetSessionResponse(
  request: Request,
  response: Response
): Response {
  const url = new URL(request.url);
  if (
    url.pathname.endsWith('/api/auth/get-session') &&
    response.status >= 500
  ) {
    console.warn(
      'auth get-session returned an error response, returning unauthenticated response instead.'
    );
    return Response.json(null, {
      headers: buildClearAuthCookieHeaders(request),
    });
  }

  return response;
}

function buildClearAuthCookieHeaders(request: Request): Headers {
  const headers = new Headers();
  const cookieHeader = request.headers.get('cookie') || '';
  const cookieNames = new Set([
    'better-auth.session_token',
    'better-auth.session_data',
    '__Secure-better-auth.session_token',
    '__Secure-better-auth.session_data',
  ]);

  for (const cookie of cookieHeader.split(';')) {
    const name = cookie.split('=')[0]?.trim();
    if (name?.toLowerCase().includes('better-auth')) {
      cookieNames.add(name);
    }
  }

  for (const name of cookieNames) {
    headers.append(
      'Set-Cookie',
      `${name}=; Path=/; Max-Age=0; SameSite=Lax`
    );
  }

  return headers;
}
