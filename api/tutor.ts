import { handle, json, requireUser, db, env, HttpError } from './_lib';
import { planOf, tutorAllowed, todayUtc, validateQuestion } from '../src/shared/plan';
import { tutorAnswer, TutorCtx } from '../src/engine/tutor';
import { STRUCTURE_BY_ID } from '../src/data/structures';

const SYSTEM = `You are an anatomy tutor inside a virtual-dissection teaching app for medical students.
Answer ONLY from the GROUNDING text. If it does not contain the answer, say what is missing; never invent anatomy.
Never say a structure is visible/exposed unless the grounding says it is currently exposed. Say when a structure is schematic, synthetic or not modelled.
Keep answers concise and exam-oriented, and end with one short self-test question. This is unreviewed teaching material, not clinical advice.`;

export const POST = handle(async (req) => {
  const user = await requireUser(req);
  const body = (await req.json()) as { question?: string; selected?: string | null; exposed?: string[]; covering?: Record<string, string[]>; removed?: string[] };
  const bad = validateQuestion(body.question); if (bad) throw new HttpError(400, bad);
  const sub = (await db(`subscriptions?user_id=eq.${user.id}&select=status,current_period_end`))?.[0];
  const day = todayUtc(); const used = ((await db(`tutor_usage?user_id=eq.${user.id}&day=eq.${day}&select=count`))?.[0]?.count as number | undefined) ?? 0;
  const gate = tutorAllowed(planOf(sub), used); if (!gate.ok) throw new HttpError(gate.reason?.includes('Pro') ? 402 : 429, gate.reason!);
  // Build grounding server-side from the app's own records (the client cannot inject facts).
  const exposed = new Set((body.exposed ?? []).filter((i) => STRUCTURE_BY_ID[i])); const removed = new Set(body.removed ?? []);
  const ctx: TutorCtx = {
    selected: body.selected && STRUCTURE_BY_ID[body.selected] ? body.selected : null, lessonStep: null, mode: 'cadaver', exposedIds: [...exposed],
    layersCovering: (id) => (body.covering?.[id] ?? []).slice(0, 4).map(String),
    visibility: (id) => (STRUCTURE_BY_ID[id]?.fidelity === 'info-only' ? 'not-modelled' : removed.has(id) ? 'removed' : exposed.has(id) ? 'exposed' : 'covered'),
  };
  const grounded = tutorAnswer(body.question!, ctx);
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', headers: { 'x-api-key': env('ANTHROPIC_API_KEY'), 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: process.env.TUTOR_MODEL ?? 'claude-sonnet-5-5', max_tokens: 700, system: SYSTEM, messages: [{ role: 'user', content: `GROUNDING:\n${grounded.text}\n\nSTUDENT QUESTION: ${body.question}` }] }),
  });
  if (!r.ok) throw new HttpError(502, 'The tutor model is unavailable right now.');
  const j = (await r.json()) as { content?: { type: string; text?: string }[] }; const answer = j.content?.filter((c) => c.type === 'text').map((c) => c.text).join('\n') ?? '';
  await db('tutor_usage?on_conflict=user_id,day', { method: 'POST', prefer: 'resolution=merge-duplicates', body: JSON.stringify({ user_id: user.id, day, count: used + 1 }) });
  return json({ answer: `${answer}\n\n(Unreviewed teaching content — verify with your textbook.)` });
});
