// OPTIONAL server-side LLM tutor (Vercel serverless function). UNTESTED in this repository: it needs ANTHROPIC_API_KEY.
// The client never holds the key. The model receives ONLY the grounding text assembled by the app and must refuse to go beyond it.
export const config = { runtime: 'edge' };

const SYSTEM = `You are an anatomy tutor inside a virtual-dissection app. Answer ONLY from the GROUNDING provided.
If the grounding does not contain the answer, say so and state what is missing. Never claim a structure is visible unless the
VISIBILITY section says it is exposed. Mark schematic/synthetic structures as such. This content is unreviewed teaching material.`;

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response('POST only', { status: 405 });
  const key = process.env.ANTHROPIC_API_KEY; if (!key) return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }), { status: 503 });
  const { question, grounding } = (await req.json()) as { question: string; grounding: string };
  if (!question || !grounding || grounding.length > 20000) return new Response('bad request', { status: 400 });
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: process.env.TUTOR_MODEL ?? 'claude-sonnet-5-5', max_tokens: 700, system: SYSTEM, messages: [{ role: 'user', content: `GROUNDING:\n${grounding}\n\nQUESTION: ${question}` }] }),
  });
  return new Response(await r.text(), { status: r.status, headers: { 'content-type': 'application/json' } });
}
