import { STRUCTURES, STRUCTURE_BY_ID } from '../data/structures';
import { TOPICS } from '../data/topics';
import type { StructureInfo } from '../data/types';

export type Visibility = 'exposed' | 'covered' | 'removed' | 'not-modelled';
export interface TutorCtx {
  selected: string | null; lessonStep: string | null; mode: string; layersCovering: (id: string) => string[];
  visibility: (id: string) => Visibility; exposedIds: string[];
}
export interface TutorReply { text: string; sources: string[]; uncertain: boolean }

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

export function findStructure(q: string, selected: string | null): StructureInfo | null {
  const n = ` ${norm(q)} `;
  let best: { s: StructureInfo; score: number } | null = null;
  for (const s of STRUCTURES) {
    const names = [s.name, s.latin ?? '', ...(s.aliases ?? [])].map(norm).filter(Boolean);
    const short = norm(s.name.replace(/\(.*\)/, ''));
    for (const nm of [...names, short]) {
      if (nm && n.includes(` ${nm} `)) { const score = nm.length; if (!best || score > best.score) best = { s, score }; }
    }
    // single-word muscle shorthand, e.g. "biceps", "brachialis"
    const first = norm(s.name).split(' ')[0];
    if (first.length > 5 && n.includes(` ${first} `) && (!best || best.score < first.length)) best = { s, score: first.length - 1 };
  }
  if (best) return best.s;
  if (/\b(this|it|selected|here)\b/.test(n) && selected) return STRUCTURE_BY_ID[selected] ?? null;
  return null;
}

function visLine(s: StructureInfo, ctx: TutorCtx): string {
  const v = ctx.visibility(s.id);
  if (v === 'not-modelled') return `Note: ${s.name} is NOT modelled in 3D in this build — this answer comes from reference content only, so I cannot point to it in the viewer.`;
  const fid = s.fidelity === 'schematic-course' ? ' Its 3D course is schematic (authored, not segmented anatomy).' : s.fidelity === 'synthetic-sheet' ? ' Its 3D sheet is synthetic (generated), not segmented tissue.' : '';
  if (v === 'removed') return `It has been removed in your current dissection.${fid}`;
  if (v === 'covered') return `It is loaded but not yet exposed — still covered by: ${ctx.layersCovering(s.id).join(', ')}. Dissect those layers to see it.${fid}`;
  return `It is loaded and currently exposed in the viewer.${fid}`;
}

const list = (a: string[]) => a.map((x) => `• ${x}`).join('\n');
const FOOT = '\n\n(Content is draft educational material pending review by a qualified anatomist; verify against your textbook.)';

export function tutorAnswer(question: string, ctx: TutorCtx): TutorReply {
  const q = norm(question);
  const topic = TOPICS.find((t) => t.aliases.some((a) => q.includes(a)));
  const s = findStructure(question, ctx.selected);
  const wantsViva = /(viva|quiz me|test me|ask me)/.test(q);
  const nMatch = q.match(/\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b/); const words: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
  const nQ = nMatch ? (words[nMatch[1]] ?? parseInt(nMatch[1], 10)) : 5;

  if (wantsViva) {
    if (topic) return { text: `Viva questions — ${topic.name}:\n${list(topic.viva.slice(0, nQ))}\n\nTry answering aloud first, then ask me "explain ${topic.name}".${FOOT}`, sources: topic.refs, uncertain: true };
    if (s) return { text: `Viva questions — ${s.name}:\n${list(s.viva.slice(0, nQ))}${s.viva.length < nQ ? `\n\n(Only ${s.viva.length} authored question(s) exist for this structure.)` : ''}${FOOT}`, sources: s.refs, uncertain: true };
    return { text: 'Tell me the structure or region (e.g. "five viva questions on the cubital fossa") or select a structure first.', sources: [], uncertain: false };
  }
  if (topic && !s) return { text: `${topic.text}${FOOT}`, sources: topic.refs, uncertain: true };
  if (!s) {
    return { text: `I answer only from the anatomy content loaded in this app, and I couldn't match a structure in your question${ctx.selected ? '' : ' (and nothing is selected)'}. Try the structure name (e.g. "median nerve") or select one first. Currently exposed: ${ctx.exposedIds.slice(0, 8).map((i) => STRUCTURE_BY_ID[i]?.name).join(', ') || 'nothing yet — start dissecting'}.`, sources: [], uncertain: true };
  }
  const v = visLine(s, ctx);
  const src = s.refs;
  if (/(beneath|deep to|under|below|underlying|what lies)/.test(q)) {
    const rel = s.relations.filter((r) => /(deep|beneath|lies on|floor|under)/i.test(r));
    return { text: `Relations of ${s.name} — ${rel.length ? 'deep/underlying structures noted in the content:\n' + list(rel) : 'no explicit "deep to" relation is authored; all relations:\n' + list(s.relations)}\n\n${v}${FOOT}`, sources: src, uncertain: true };
  }
  if (/(blood supply|artery|arterial|vascular supply|supplied by.*artery)/.test(q) && s.bloodSupply) return { text: `Blood supply of ${s.name}: ${s.bloodSupply}\n\n${v}${FOOT}`, sources: src, uncertain: true };
  if (/(nerve supply|innervat|supplied by|which nerve)/.test(q) && s.innervation) return { text: `Innervation of ${s.name}: ${s.innervation}\n\n${v}${FOOT}`, sources: src, uncertain: true };
  if (/(origin|insertion|attach)/.test(q) && (s.origin || s.insertion)) return { text: `${s.name}\nOrigin: ${s.origin ?? 'n/a'}\nInsertion: ${s.insertion ?? 'n/a'}\n\n${v}${FOOT}`, sources: src, uncertain: true };
  if (/(action|function|does it do|movement)/.test(q) && (s.action || s.function)) return { text: `${s.name} — ${s.action ?? s.function}\n\n${v}${FOOT}`, sources: src, uncertain: true };
  if (/(clinical|important|injur|lesion|palsy|fracture|disorder|damage|why)/.test(q)) return { text: `Clinical anatomy — ${s.name}:\n${list([...s.clinical, ...s.injuries.map((i) => `Common injuries/disorders: ${i}`)])}\n\n${v}${FOOT}`, sources: src, uncertain: true };
  if (/(identify|find|locate|recogni[sz]e|how do i|tips)/.test(q)) return { text: `Identifying ${s.name}:\n${list(s.tips)}\nPosition: ${s.position}\n\n${v}${FOOT}`, sources: src, uncertain: true };
  const head = `${s.name}${s.latin ? ` (${s.latin})` : ''} — ${s.description}\nPosition: ${s.position}${s.relations.length ? '\nRelations:\n' + list(s.relations) : ''}${s.function ? `\nFunction: ${s.function}` : ''}`;
  return { text: `${head}\n\n${v}${FOOT}`, sources: src, uncertain: true };
}
