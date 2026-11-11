import { handle, json, requireUser, env, db, stripe } from './_lib';
export const POST = handle(async (req) => {
  const user = await requireUser(req);
  const sub = (await db(`subscriptions?user_id=eq.${user.id}&select=stripe_subscription_id,status`))?.[0];
  if (sub?.stripe_subscription_id && ['active', 'trialing', 'past_due'].includes(sub.status)) { try { await stripe(`subscriptions/${sub.stripe_subscription_id}`, undefined, 'DELETE'); } catch { /* already gone */ } }
  const r = await fetch(`${env('SUPABASE_URL')}/auth/v1/admin/users/${user.id}`, { method: 'DELETE', headers: { apikey: env('SUPABASE_SERVICE_ROLE_KEY'), authorization: `Bearer ${env('SUPABASE_SERVICE_ROLE_KEY')}` } });
  if (!r.ok) throw new Error('delete failed'); return json({ ok: true }); // rows cascade via foreign keys
});
