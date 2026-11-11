import { useEffect } from 'react';
import { supabase } from './client';
import { useStore } from '../store/useStore';
import { fetchPlan, listCloudSessions, pullUserState, saveCloudSession } from './sync';

/** Bootstraps the Supabase session, loads plan + cloud data on sign-in, and clears account state on sign-out. */
export function useAuthBootstrap() {
  useEffect(() => {
    if (!supabase) { useStore.setState({ authReady: true }); return; }
    const apply = async (u: { id: string; email?: string } | null) => {
      if (!u) { useStore.setState({ user: null, plan: 'free', authReady: true }); return; }
      useStore.setState({ user: { id: u.id, email: u.email ?? '' }, authReady: true });
      try {
        const [plan, cloud, state] = await Promise.all([fetchPlan(), listCloudSessions(), pullUserState()]);
        const local = useStore.getState().sessions; const ids = new Set(cloud.map((c) => c.id));
        for (const l of local) if (!ids.has(l.id)) void saveCloudSession(l, u.id).catch(() => undefined); // upload device-only saves once
        const merged = [...cloud, ...local.filter((l) => !ids.has(l.id))].sort((a, b) => b.savedAt.localeCompare(a.savedAt));
        const patch: Record<string, unknown> = { plan, sessions: merged };
        if (state) { if (state.bookmarks?.length) patch.bookmarks = [...new Set([...useStore.getState().bookmarks, ...state.bookmarks])]; if (state.notes) patch.notes = { ...state.notes, ...useStore.getState().notes }; }
        useStore.setState(patch);
      } catch { useStore.getState().say('Signed in, but loading your cloud data failed.', false); }
    };
    void supabase.auth.getSession().then(({ data }) => apply(data.session?.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => { void apply(session?.user ?? null); });
    const q = new URLSearchParams(location.search).get('billing');
    if (q === 'success') { useStore.getState().say('Thanks! Your subscription is being activated…'); setTimeout(() => void fetchPlan().then((plan) => useStore.setState({ plan })), 3000); history.replaceState({}, '', location.pathname); }
    return () => sub.subscription.unsubscribe();
  }, []);
}
