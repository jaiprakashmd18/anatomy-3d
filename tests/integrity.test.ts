import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { STRUCTURES, STRUCTURE_BY_ID } from '../src/data/structures';
import { LESSON } from '../src/data/lesson';
import { MCQS } from '../src/data/quiz';
import { tutorAnswer, findStructure, TutorCtx } from '../src/engine/tutor';
import * as D from '../src/engine/dissection';
import { visibilityOf, coveringLabels } from '../src/ui/util';

const meta = JSON.parse(fs.readFileSync('public/assets/limb-meta.json', 'utf8'));
const meshStructures = new Set<string>(meta.meshes.map((m: { structure: string }) => m.structure));
const curveIds = new Set<string>(meta.curves.map((c: { id: string }) => c.id));

describe('content ↔ asset integrity', () => {
  it('every loaded mesh/curve has a structure record', () => {
    for (const id of meshStructures) expect(STRUCTURE_BY_ID[id], `missing content for mesh ${id}`).toBeTruthy();
    for (const id of curveIds) expect(STRUCTURE_BY_ID[id], `missing content for curve ${id}`).toBeTruthy();
  });
  it('every non-info-only record is backed by a mesh or curve; info-only ones are not', () => {
    for (const s of STRUCTURES) {
      const loaded = meshStructures.has(s.id) || curveIds.has(s.id);
      if (s.fidelity === 'info-only') expect(loaded, `${s.id} claims info-only but is loaded`).toBe(false);
      else expect(loaded, `${s.id} has no 3D asset`).toBe(true);
    }
  });
  it('schematic / synthetic assets are labelled as such', () => {
    for (const id of curveIds) expect(STRUCTURE_BY_ID[id].fidelity).toBe('schematic-course');
    expect(STRUCTURE_BY_ID.superficial_fascia.fidelity).toBe('synthetic-sheet');
    expect(STRUCTURE_BY_ID.deep_fascia.fidelity).toBe('synthetic-sheet');
    expect(STRUCTURE_BY_ID.biceps_brachii.fidelity).toBe('segmented-source');
  });
  it('nothing claims to be validated', () => { for (const s of STRUCTURES) expect(s.validation).not.toBe('validated'); });
  it('records have the key fields for their kind', () => {
    for (const s of STRUCTURES) {
      expect(s.refs.length, s.id).toBeGreaterThan(0); expect(s.viva.length, s.id).toBeGreaterThan(0); expect(s.description.length, s.id).toBeGreaterThan(20);
      if (s.kind === 'muscle') for (const f of ['origin', 'insertion', 'innervation', 'bloodSupply', 'action'] as const) expect(s[f], `${s.id}.${f}`).toBeTruthy();
    }
  });
  it('median nerve, brachial artery and cephalic vein are exposed only after the right layers open', () => {
    let st = D.initialState();
    expect(visibilityOf('median_nerve', st)).toBe('covered'); expect(visibilityOf('cephalic_vein', st)).toBe('covered');
    st.layers.skin.removed = true;
    expect(visibilityOf('cephalic_vein', st)).toBe('exposed'); expect(visibilityOf('median_nerve', st)).toBe('covered');
    st.layers.superficial_fascia.removed = true; st.layers.deep_fascia.removed = true;
    expect(visibilityOf('median_nerve', st)).toBe('exposed'); expect(visibilityOf('radial_nerve', st)).toBe('not-modelled');
  });
  it('lesson steps reference real structures and every step has instruction + rationale', () => {
    for (const st of LESSON.steps) { expect(st.instruction.length).toBeGreaterThan(10); expect(st.why.length).toBeGreaterThan(10); for (const h of st.highlight) expect(STRUCTURE_BY_ID[h], `${st.id} → ${h}`).toBeTruthy(); }
  });
  it('quiz answers are in range and reference known structures', () => { for (const q of MCQS) { expect(q.answer).toBeLessThan(q.options.length); expect(STRUCTURE_BY_ID[q.structure]).toBeTruthy(); } });
  it('cut definitions in the asset match the engine rules', () => {
    for (const layer of ['skin', 'superficial_fascia', 'deep_fascia'] as const) {
      const ids = meta.sheets[layer].cuts.map((c: { id: string }) => c.id).sort();
      expect(ids).toEqual([...D.LAYER_RULES[layer].requiredCuts].sort());
    }
  });
  it('flap groups exist for each sheet', () => { for (const l of Object.keys(meta.sheets)) { expect(meta.sheets[l].groups.medial.triangles).toBeGreaterThan(100); expect(meta.sheets[l].groups.lateral.triangles).toBeGreaterThan(100); } });
  it('asset metadata records licence & attribution', () => { expect(meta.source.license).toMatch(/CC BY-SA/); expect(meta.source.attribution).toMatch(/BodyParts3D/); });
});

describe('AI tutor grounding', () => {
  const mk = (d = D.initialState(), selected: string | null = null): TutorCtx => ({
    selected, lessonStep: null, mode: 'cadaver', layersCovering: (id) => coveringLabels(id, d), visibility: (id) => visibilityOf(id, d),
    exposedIds: STRUCTURES.filter((s) => visibilityOf(s.id, d) === 'exposed').map((s) => s.id),
  });
  it('matches structure names and shorthand', () => { expect(findStructure('Explain the median nerve', null)?.id).toBe('median_nerve'); expect(findStructure('what does biceps do', null)?.id).toBe('biceps_brachii'); });
  it('never claims a covered structure is visible', () => {
    const r = tutorAnswer('Explain the median nerve', mk());
    expect(r.text).toMatch(/not yet exposed/); expect(r.text).not.toMatch(/currently exposed in the viewer/);
  });
  it('states exposure when actually exposed, and flags schematic courses', () => {
    const d = D.initialState(); d.layers.skin.removed = d.layers.superficial_fascia.removed = d.layers.deep_fascia.removed = true;
    const r = tutorAnswer('Explain the median nerve', mk(d)); expect(r.text).toMatch(/currently exposed/); expect(r.text).toMatch(/schematic/i);
  });
  it('says plainly when a structure is not modelled (radial nerve)', () => {
    const r = tutorAnswer('Why is the radial nerve clinically important?', mk()); expect(r.text).toMatch(/NOT modelled in 3D/); expect(r.text).toMatch(/wrist drop/i);
  });
  it('uses the selected structure for "this muscle" and answers blood supply', () => { const r = tutorAnswer('What is the blood supply of this muscle?', mk(D.initialState(), 'biceps_brachii')); expect(r.text).toMatch(/brachial artery/i); });
  it('generates viva questions for a topic and refuses to invent for unknown input', () => {
    expect(tutorAnswer('Ask me five viva questions about the cubital fossa', mk()).text).toMatch(/boundaries of the cubital fossa/i);
    expect(tutorAnswer('tell me about quantum physics', mk()).text).toMatch(/couldn't match a structure/);
  });
});
