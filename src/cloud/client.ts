import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
/** True when Supabase env vars are configured; otherwise the app runs in local-only mode. */
export const cloudEnabled = !!(url && key);
export const supabase: SupabaseClient | null = cloudEnabled ? createClient(url!, key!, { auth: { persistSession: true, autoRefreshToken: true } }) : null;

export async function accessToken(): Promise<string | null> {
  if (!supabase) return null; const { data } = await supabase.auth.getSession(); return data.session?.access_token ?? null;
}
async function api<T>(path: string, body?: unknown): Promise<T> {
  const token = await accessToken(); if (!token) throw new Error('Please sign in.');
  const r = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify(body ?? {}) });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error((j as { error?: string }).error ?? `Request failed (${r.status})`); return j as T;
}
export const startCheckout = () => api<{ url: string }>('/api/checkout');
export const openPortal = () => api<{ url: string }>('/api/portal');
export const deleteAccount = () => api<{ ok: true }>('/api/delete-account');
export const askTutor = (payload: unknown) => api<{ answer: string }>('/api/tutor', payload);
