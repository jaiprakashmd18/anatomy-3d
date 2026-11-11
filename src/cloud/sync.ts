import { supabase } from './client';
import type { SavedSession } from '../store/useStore';
import { planOf, Plan } from '../shared/plan';

export interface UserState { bookmarks: string[]; notes: Record<string, string>; progress: unknown; revision: unknown }

export async function fetchPlan(): Promise<Plan> {
  if (!supabase) return 'free';
  const { data } = await supabase.from('subscriptions').select('status,current_period_end').maybeSingle();
  return planOf(data);
}
export async function listCloudSessions(): Promise<SavedSession[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('saved_dissections').select('id,name,history,updated_at').order('updated_at', { ascending: false }).limit(50);
  if (error) throw error;
  return (data ?? []).map((r) => ({ id: r.id as string, name: r.name as string, savedAt: r.updated_at as string, history: r.history as SavedSession['history'] }));
}
export async function saveCloudSession(s: SavedSession, userId: string) {
  if (!supabase) return; const { error } = await supabase.from('saved_dissections').upsert({ id: s.id, user_id: userId, name: s.name, module: 'upper-limb-right', state: s.history.present, history: s.history, updated_at: s.savedAt });
  if (error) throw error;
}
export async function deleteCloudSession(id: string) { if (supabase) await supabase.from('saved_dissections').delete().eq('id', id); }
export async function pullUserState(): Promise<UserState | null> {
  if (!supabase) return null; const { data } = await supabase.from('user_state').select('bookmarks,notes,progress,revision').maybeSingle(); return (data as UserState) ?? null;
}
export async function pushUserState(userId: string, s: UserState) { if (supabase) await supabase.from('user_state').upsert({ user_id: userId, ...s, updated_at: new Date().toISOString() }); }
