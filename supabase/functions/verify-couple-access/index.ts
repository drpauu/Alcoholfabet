// No service role key or access-code secret is shipped to the function or browser.
// PostgreSQL stores the hash in a non-exposed schema and checks each authenticated intent.
const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173')
  .split(',').map((value) => value.trim());

function headers(request: Request): Record<string, string> {
  const origin = request.headers.get('Origin') ?? '';
  return {
    'Access-Control-Allow-Origin': allowedOrigins.includes(origin) || allowedOrigins.includes('*') ? origin || '*' : allowedOrigins[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    Vary: 'Origin',
  };
}
function json(request: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: headers(request) });
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: headers(request) });
  if (request.method !== 'POST') return json(request, { error: 'METHOD_NOT_ALLOWED' }, 405);
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_ANON_KEY');
  const authorization = request.headers.get('Authorization');
  if (!url || !key) return json(request, { error: 'SERVER_MISCONFIGURED' }, 503);
  if (!authorization?.startsWith('Bearer ')) return json(request, { error: 'NOT_AUTHENTICATED' }, 401);
  let body: unknown;
  try { body = await request.json(); } catch { return json(request, { error: 'INVALID_CODE' }, 400); }
  const code = typeof body === 'object' && body !== null && 'code' in body ? (body as { code: unknown }).code : null;
  if (typeof code !== 'string' || code.length < 6 || code.length > 128) return json(request, { error: 'INVALID_CODE' }, 400);
  try {
    // Auth service verifies the token even when Edge gateway JWT verification is disabled.
    const auth = await fetch(`${url}/auth/v1/user`, { headers: { apikey: key, Authorization: authorization } });
    if (!auth.ok) return json(request, { error: 'NOT_AUTHENTICATED' }, 401);
    const response = await fetch(`${url}/rest/v1/rpc/authorize_private_code`, {
      method: 'POST',
      headers: { apikey: key, Authorization: authorization, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_code: code.normalize('NFKC').trim() }),
    });
    if (!response.ok) return json(request, { error: 'AUTHORIZATION_FAILED' }, response.status === 401 ? 401 : 503);
    const result = await response.json() as { authorized: boolean; error?: string };
    const status = result.authorized ? 200 : result.error === 'ACCESS_RATE_LIMITED' ? 429 : result.error === 'ACCESS_NOT_CONFIGURED' ? 503 : 403;
    return json(request, result, status);
  } catch { return json(request, { error: 'CONNECTION_REQUIRED' }, 503); }
});
