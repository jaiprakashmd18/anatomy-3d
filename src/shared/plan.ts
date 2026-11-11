// Shared (client + server) plan/quota rules. Pure and unit-tested.
export type Plan = 'free' | 'pro';
export interface Subscription { status: string; current_period_end?: string | null }
export const TUTOR_DAILY_LIMIT: Record<Plan, number> = { free: 0, pro: 100 };
const ACTIVE = new Set(['active', 'trialing']);

export function planOf(sub: Subscription | null | undefined, now = Date.now()): Plan {
  if (!sub) return 'free';
  if (ACTIVE.has(sub.status)) return 'pro';
  // keep access until the paid period ends after a cancellation / failed renewal grace
  if (sub.status === 'canceled' && sub.current_period_end && new Date(sub.current_period_end).getTime() > now) return 'pro';
  return 'free';
}
export function tutorAllowed(plan: Plan, usedToday: number): { ok: boolean; reason?: string } {
  const lim = TUTOR_DAILY_LIMIT[plan];
  if (lim === 0) return { ok: false, reason: 'The AI tutor is part of the Pro plan.' };
  if (usedToday >= lim) return { ok: false, reason: `Daily limit of ${lim} tutor questions reached. It resets at midnight UTC.` };
  return { ok: true };
}
export const todayUtc = (d = new Date()) => d.toISOString().slice(0, 10);

export const MAX_QUESTION_CHARS = 600;
export function validateQuestion(q: unknown): string | null {
  if (typeof q !== 'string' || !q.trim()) return 'Empty question.';
  if (q.length > MAX_QUESTION_CHARS) return `Question too long (max ${MAX_QUESTION_CHARS} characters).`;
  return null;
}
