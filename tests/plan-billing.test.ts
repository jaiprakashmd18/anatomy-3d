import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { planOf, tutorAllowed, validateQuestion, TUTOR_DAILY_LIMIT, todayUtc } from '../src/shared/plan';
import { verifyStripeSignature } from '../api/stripe-webhook';

describe('plans and quotas', () => {
  it('maps subscription status to plan, honouring paid period after cancellation', () => {
    const now = Date.parse('2026-11-11T00:00:00Z');
    expect(planOf(null)).toBe('free'); expect(planOf({ status: 'active' })).toBe('pro'); expect(planOf({ status: 'trialing' })).toBe('pro');
    expect(planOf({ status: 'past_due' })).toBe('free'); expect(planOf({ status: 'incomplete' })).toBe('free');
    expect(planOf({ status: 'canceled', current_period_end: '2026-12-01T00:00:00Z' }, now)).toBe('pro');
    expect(planOf({ status: 'canceled', current_period_end: '2026-10-01T00:00:00Z' }, now)).toBe('free');
  });
  it('gates the tutor: free blocked, pro limited per day', () => {
    expect(tutorAllowed('free', 0).ok).toBe(false); expect(tutorAllowed('free', 0).reason).toMatch(/Pro/);
    expect(tutorAllowed('pro', 0).ok).toBe(true); expect(tutorAllowed('pro', TUTOR_DAILY_LIMIT.pro - 1).ok).toBe(true);
    expect(tutorAllowed('pro', TUTOR_DAILY_LIMIT.pro).ok).toBe(false);
  });
  it('validates questions', () => { expect(validateQuestion('')).toBeTruthy(); expect(validateQuestion(5)).toBeTruthy(); expect(validateQuestion('x'.repeat(601))).toBeTruthy(); expect(validateQuestion('Explain the median nerve')).toBeNull(); });
  it('formats the usage day in UTC', () => expect(todayUtc(new Date('2026-11-11T23:59:00Z'))).toBe('2026-11-11'));
});

describe('Stripe webhook signature', () => {
  const secret = 'whsec_test', raw = '{"type":"x"}', t = 1_800_000_000;
  const sig = (body: string, ts = t) => `t=${ts},v1=${createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex')}`;
  it('accepts a valid signature', () => expect(verifyStripeSignature(raw, sig(raw), secret, t * 1000)).toBe(true));
  it('rejects tampered body, wrong secret, stale timestamp, malformed header', () => {
    expect(verifyStripeSignature(raw + ' ', sig(raw), secret, t * 1000)).toBe(false);
    expect(verifyStripeSignature(raw, sig(raw), 'other', t * 1000)).toBe(false);
    expect(verifyStripeSignature(raw, sig(raw), secret, (t + 1000) * 1000)).toBe(false);
    expect(verifyStripeSignature(raw, '', secret, t * 1000)).toBe(false);
  });
});
