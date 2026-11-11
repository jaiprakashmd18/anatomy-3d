// Shared server helpers (Vercel Node functions, Web-standard Request/Response). Files starting with "_" are not routes.
export const env = (k: string) => { const v = process.env[k]; if (!v) throw new HttpError(503, `Server not configured: ${k}`); return v; };
export class HttpError extends Error { constructor(public status: number, msg: string) { super(msg); } }
export const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
export const handle = (fn: (req: Request) => Promise<Response>) => async (req: Request) => {
  try { return await fn(req); } catch (e) { if (e instanceof HttpError) return json({ error: e.message }, e.status); console.error(e); return json({ error: 'Internal error' }, 500); }
};

/** Verify the Supabase access token and return the user. */
export async function requireUser(req: Request): Promise<{ id: string; email?: string }> {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer /i, ''); if (!token) throw new HttpError(401, 'Sign in required.');
  const r = await fetch(`${env('SUPABASE_URL')}/auth/v1/user`, { headers: { authorization: `Bearer ${token}`, apikey: env('SUPABASE_SERVICE_ROLE_KEY') } });
  if (!r.ok) throw new HttpError(401, 'Invalid or expired session.'); const u = (await r.json()) as { id: string; email?: string }; return u;
}
/** Service-role PostgREST call (bypasses RLS: server-side only). */
export async function db(path: string, init: RequestInit & { prefer?: string } = {}) {
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  const r = await fetch(`${env('SUPABASE_URL')}/rest/v1/${path}`, { ...init, headers: { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json', ...(init.prefer ? { prefer: init.prefer } : {}), ...(init.headers ?? {}) } });
  if (!r.ok) throw new Error(`db ${path}: ${r.status} ${await r.text()}`); const t = await r.text(); return t ? JSON.parse(t) : null;
}
export async function stripe(path: string, params?: Record<string, string>, method = 'POST') {
  const r = await fetch(`https://api.stripe.com/v1/${path}`, { method, headers: { authorization: `Bearer ${env('STRIPE_SECRET_KEY')}`, 'content-type': 'application/x-www-form-urlencoded' }, body: params && method !== 'GET' ? new URLSearchParams(params).toString() : undefined });
  const j = await r.json(); if (!r.ok) throw new Error(`stripe ${path}: ${JSON.stringify(j)}`); return j;
}
export const siteUrl = () => (process.env.SITE_URL ?? '').replace(/\/$/, '') || 'http://localhost:5173';
