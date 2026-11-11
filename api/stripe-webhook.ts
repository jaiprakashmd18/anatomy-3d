import { createHmac, timingSafeEqual } from 'node:crypto';
import { handle, json, db, env, stripe, HttpError } from './_lib';

/** Verify a Stripe-Signature header (v1 HMAC-SHA256, 5 minute tolerance). Exported for unit tests. */
export function verifyStripeSignature(raw: string, header: string, secret: string, now = Date.now()): boolean {
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=') as [string, string])); const t = parts.t; const sigs = header.split(',').filter((p) => p.startsWith('v1=')).map((p) => p.slice(3));
  if (!t || !sigs.length || Math.abs(now / 1000 - Number(t)) > 300) return false;
  const expected = createHmac('sha256', secret).update(`${t}.${raw}`).digest('hex');
  return sigs.some((s) => s.length === expected.length && timingSafeEqual(Buffer.from(s), Buffer.from(expected)));
}

async function upsertSub(userId: string, sub: { id: string; status: string; customer: string; current_period_end?: number }) {
  await db('subscriptions?on_conflict=user_id', { method: 'POST', prefer: 'resolution=merge-duplicates', body: JSON.stringify({ user_id: userId, status: sub.status, stripe_customer_id: sub.customer, stripe_subscription_id: sub.id, current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null, updated_at: new Date().toISOString() }) });
}
export const POST = handle(async (req) => {
  const raw = await req.text();
  if (!verifyStripeSignature(raw, req.headers.get('stripe-signature') ?? '', env('STRIPE_WEBHOOK_SECRET'))) throw new HttpError(400, 'Bad signature');
  const ev = JSON.parse(raw) as { type: string; data: { object: Record<string, any> } }; const o = ev.data.object;
  if (ev.type === 'checkout.session.completed' && o.subscription && o.client_reference_id) {
    const sub = await stripe(`subscriptions/${o.subscription}`, undefined, 'GET'); await upsertSub(o.client_reference_id, sub);
  } else if (ev.type === 'customer.subscription.updated' || ev.type === 'customer.subscription.deleted') {
    const uid = o.metadata?.user_id as string | undefined; if (uid) await upsertSub(uid, o as never);
  }
  return json({ received: true });
});
