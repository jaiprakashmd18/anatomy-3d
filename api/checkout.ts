import { handle, json, requireUser, stripe, env, siteUrl, db } from './_lib';
export const POST = handle(async (req) => {
  const user = await requireUser(req);
  const existing = (await db(`subscriptions?user_id=eq.${user.id}&select=stripe_customer_id`))?.[0]?.stripe_customer_id as string | undefined;
  const params: Record<string, string> = {
    mode: 'subscription', 'line_items[0][price]': env('STRIPE_PRICE_ID'), 'line_items[0][quantity]': '1', client_reference_id: user.id,
    'subscription_data[metadata][user_id]': user.id, success_url: `${siteUrl()}/?billing=success`, cancel_url: `${siteUrl()}/?billing=cancel`, allow_promotion_codes: 'true',
  };
  if (existing) params.customer = existing; else if (user.email) params.customer_email = user.email;
  const s = await stripe('checkout/sessions', params); return json({ url: s.url });
});
