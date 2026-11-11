# Accounts, cloud save, subscription and AI tutor — setup

Everything below is **written but only unit-tested** (plan rules, quota, Stripe signature check). The live Supabase/Stripe/Anthropic calls could not be exercised in the
build sandbox (no keys, restricted network) — run the checklist at the end on a test deployment before charging anyone.

## 1. Supabase (auth + database) — free tier is enough to start
1. Create a project at supabase.com. Run `docs/supabase-schema.sql` in the SQL editor.
2. Authentication → Providers: keep Email on; optionally enable Google (create OAuth credentials in Google Cloud, paste client id/secret).
3. Authentication → URL configuration: set Site URL to your Vercel URL and add it (and `http://localhost:5173`) to Redirect URLs.
4. Copy **Project URL** and **anon key** → `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. The **service_role key** goes only in the server variable `SUPABASE_SERVICE_ROLE_KEY`.

## 2. Stripe (subscription)
1. Create a Product with a recurring monthly Price → `STRIPE_PRICE_ID`. Start in **test mode** (`sk_test_…`).
2. Developers → Webhooks → add endpoint `https://YOUR-APP.vercel.app/api/stripe-webhook` with events `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`; copy the signing secret → `STRIPE_WEBHOOK_SECRET`.
3. Settings → Billing → Customer portal: enable it (cancel/update card).
4. Set the price so it covers AI cost: each Pro user may ask up to 100 questions/day (`TUTOR_DAILY_LIMIT` in `src/shared/plan.ts`). Check Anthropic's current pricing and tune the cap.

## 3. Anthropic (AI tutor)
Create a key at console.anthropic.com (separate from a Claude Pro chat plan), add prepaid credit and a spend limit → `ANTHROPIC_API_KEY`. Optional `TUTOR_MODEL`.

## 4. Vercel
Import the repo, add every variable from `.env.example` (Production + Preview), set `SITE_URL` to the deployed URL, deploy. Functions live in `api/`.

## How it behaves
* No keys → local-only mode (browser storage, built-in grounded tutor). Sign-in dialog explains accounts aren't configured.
* Signed in → saved dissections, notes, bookmarks, progress sync to Supabase (RLS: users can only read/write their own rows).
* Pro (active/trialing, or cancelled but still inside the paid period) → AI tutor via `/api/tutor`. The server verifies the JWT, checks plan and daily quota, **builds the grounding itself from the app's records** (the client cannot inject facts), calls Claude, then increments usage. Any failure falls back to the local tutor.
* Subscription state is written only by the Stripe webhook (signature-verified, service role). Clients cannot grant themselves Pro (RLS allows read only).
* Account deletion cancels the subscription, deletes the auth user, and cascades all rows.

## Pre-launch checklist (do on a test deployment)
- [ ] Sign up → confirm email → sign in; Google sign-in.
- [ ] Save a dissection on device A, restore on device B.
- [ ] Stripe test card `4242 4242 4242 4242`: checkout → webhook → Plan shows Pro → tutor answers.
- [ ] Cancel in portal → access remains until period end → then Free.
- [ ] Exceed the daily limit → friendly error; free user → upgrade prompt.
- [ ] Delete account removes data; Stripe subscription cancelled.
- [ ] Legal text (Terms/Privacy in `src/ui/AuthModal.tsx`) reviewed by a lawyer; anatomical content reviewed by an anatomist.
- [ ] Add rate limiting/bot protection (e.g. Vercel Firewall, Turnstile on sign-up) before a public launch.
