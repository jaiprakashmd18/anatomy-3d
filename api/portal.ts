import { handle, json, requireUser, stripe, siteUrl, db, HttpError } from './_lib';
export const POST = handle(async (req) => {
  const user = await requireUser(req);
  const cid = (await db(`subscriptions?user_id=eq.${user.id}&select=stripe_customer_id`))?.[0]?.stripe_customer_id as string | undefined;
  if (!cid) throw new HttpError(404, 'No billing account yet.');
  const s = await stripe('billing_portal/sessions', { customer: cid, return_url: siteUrl() }); return json({ url: s.url });
});
