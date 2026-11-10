import { DissectionState, LAYER_ORDER, LayerId, LayerRule, LayerStatus, ToolId, FlapSide, ActionResult, Pin } from './types';

/**
 * Dissection rules for the right-upper-limb module. Tools/cuts are *authored and validated* supported actions:
 * nothing here simulates arbitrary tissue cutting.
 */
export const LAYER_RULES: Record<LayerId, LayerRule> = {
  skin: { label: 'Skin', requiredCuts: ['skin.longitudinal', 'skin.proximal', 'skin.distal'], cutTools: ['scalpel'], reflectTools: ['reflect', 'retractor', 'peel'] },
  superficial_fascia: { label: 'Superficial fascia', requiredCuts: ['superficial_fascia.longitudinal'], cutTools: ['scalpel', 'scissors'], reflectTools: ['reflect', 'retractor', 'peel'] },
  deep_fascia: { label: 'Deep (brachial) fascia', requiredCuts: ['deep_fascia.longitudinal'], cutTools: ['scalpel', 'scissors'], reflectTools: ['reflect', 'retractor'] },
};

/** Structures that can be removed with scissors once exposed (muscles only; neurovascular structures are preserved). */
export const REMOVABLE_MUSCLES = new Set(['biceps_brachii', 'brachialis', 'coracobrachialis', 'brachioradialis', 'pronator_teres', 'flexor_carpi_radialis', 'palmaris_longus', 'deltoid', 'pectoralis_major', 'pectoralis_minor', 'triceps_brachii']);
/** Structures that support retraction, with the layers that must be open first. */
export const RETRACTABLE = new Set(['biceps_brachii']);

export const FLAP_DONE = 0.985;

export function initialState(): DissectionState {
  const l = () => ({ cuts: [] as string[], flap: { medial: 0, lateral: 0 }, removed: false });
  return { layers: { skin: l(), superficial_fascia: l(), deep_fascia: l() }, retracted: {}, removed: [], pins: [] };
}

export const clone = (s: DissectionState): DissectionState => JSON.parse(JSON.stringify(s));

export function layerStatus(s: DissectionState, id: LayerId): LayerStatus {
  const L = s.layers[id];
  if (L.removed) return 'removed';
  const rule = LAYER_RULES[id];
  const incised = rule.requiredCuts.every((c) => L.cuts.includes(c));
  if (!incised) return 'intact';
  const m = L.flap.medial, l = L.flap.lateral;
  if (m >= FLAP_DONE && l >= FLAP_DONE) return 'reflected';
  if (m > 0.001 || l > 0.001) return 'lifted';
  return 'incised';
}

export const isOpen = (s: DissectionState, id: LayerId) => ['reflected', 'removed'].includes(layerStatus(s, id));

/** The outermost layer that is still closed (the one the scalpel acts on). */
export function activeLayer(s: DissectionState): LayerId | null {
  for (const id of LAYER_ORDER) if (!isOpen(s, id)) return id;
  return null;
}

export function layersAbove(id: LayerId): LayerId[] { return LAYER_ORDER.slice(0, LAYER_ORDER.indexOf(id)); }

function fail(s: DissectionState, message: string): ActionResult { return { ok: false, state: s, message }; }

export function canActOnLayer(s: DissectionState, id: LayerId): string | null {
  const blocked = layersAbove(id).find((l) => !isOpen(s, l));
  if (blocked) return `${LAYER_RULES[blocked].label} must be reflected before working on ${LAYER_RULES[id].label}.`;
  if (s.layers[id].removed) return `${LAYER_RULES[id].label} has already been removed.`;
  return null;
}

export function incise(s: DissectionState, layer: LayerId, cutId: string, tool: ToolId): ActionResult {
  const rule = LAYER_RULES[layer];
  if (!rule.cutTools.includes(tool)) return fail(s, `${rule.label} is divided with: ${rule.cutTools.join(' / ')} (not ${tool}).`);
  const block = canActOnLayer(s, layer);
  if (block) return fail(s, block);
  if (!rule.requiredCuts.includes(cutId)) return fail(s, `"${cutId}" is not a supported incision for ${rule.label}.`);
  if (s.layers[layer].cuts.includes(cutId)) return fail(s, 'That incision has already been made.');
  const n = clone(s); n.layers[layer].cuts.push(cutId);
  const done = rule.requiredCuts.every((c) => n.layers[layer].cuts.includes(c));
  return { ok: true, state: n, label: `Incise ${rule.label}`, message: done ? `${rule.label} incised. Lift the flaps with forceps or reflect them.` : `Incision made (${n.layers[layer].cuts.length}/${rule.requiredCuts.length}).` };
}

/** Set a flap's lift amount. Used for interactive forceps dragging (preview) and for reflect/retract. */
export function setFlap(s: DissectionState, layer: LayerId, side: FlapSide, amount: number, tool: ToolId): ActionResult {
  const rule = LAYER_RULES[layer];
  const allowed: ToolId[] = ['forceps', ...rule.reflectTools];
  if (!allowed.includes(tool)) return fail(s, `${tool} cannot manipulate ${rule.label}.`);
  const block = canActOnLayer(s, layer);
  if (block) return fail(s, block);
  const st = layerStatus(s, layer);
  if (st === 'intact') return fail(s, `Make the ${rule.requiredCuts.length} supported incision(s) in the ${rule.label.toLowerCase()} first.`);
  const next = Math.max(0, Math.min(1, amount));
  if (Math.abs(s.layers[layer].flap[side] - next) < 0.001) return fail(s, next >= 1 ? `${rule.label} (${side}) is already reflected.` : `${rule.label} (${side}) is already in place.`);
  const n = clone(s); n.layers[layer].flap[side] = next;
  const after = layerStatus(n, layer);
  return { ok: true, state: n, label: `${amount >= FLAP_DONE ? 'Reflect' : 'Lift'} ${rule.label} (${side})`, message: after === 'reflected' ? `${rule.label} reflected.` : `${rule.label} ${side} flap lifted to ${(amount * 100).toFixed(0)}%.` };
}

export function reflectLayer(s: DissectionState, layer: LayerId, tool: ToolId): ActionResult {
  const rule = LAYER_RULES[layer];
  if (!rule.reflectTools.includes(tool)) return fail(s, `${tool === 'peel' ? 'Blunt dissection is not a supported plane' : tool + ' cannot reflect'} for ${rule.label}.`);
  const gate = setFlap(s, layer, 'medial', s.layers[layer].flap.medial, tool); // permission/prerequisite check (no-change is reported below)
  if (!gate.ok && !/already/.test(gate.message)) return gate;
  if (layerStatus(s, layer) === 'reflected') return fail(s, `${rule.label} is already reflected.`);
  const n = clone(s); n.layers[layer].flap.medial = 1; n.layers[layer].flap.lateral = 1;
  return { ok: true, state: n, label: `Reflect ${rule.label}`, message: `${rule.label} reflected.` };
}

export function removeLayer(s: DissectionState, layer: LayerId, tool: ToolId): ActionResult {
  if (tool !== 'scissors') return fail(s, 'Use the scissors to divide the remaining attachments and remove a reflected layer.');
  if (layerStatus(s, layer) !== 'reflected') return fail(s, `${LAYER_RULES[layer].label} must be reflected before it can be removed.`);
  const n = clone(s); n.layers[layer].removed = true;
  return { ok: true, state: n, label: `Remove ${LAYER_RULES[layer].label}`, message: `${LAYER_RULES[layer].label} removed.` };
}

/** Layers that cover a structure; it is exposed once all are reflected/removed. */
export function exposed(s: DissectionState, covers: LayerId[]): boolean { return covers.every((l) => isOpen(s, l)); }

export function retract(s: DissectionState, structureId: string, amount: number, covers: LayerId[], tool: ToolId): ActionResult {
  if (!RETRACTABLE.has(structureId)) return fail(s, 'Retraction is not authored for this structure in this build.');
  if (tool !== 'retractor' && tool !== 'forceps') return fail(s, 'Use the retractor (or forceps) to retract a muscle.');
  if (!exposed(s, covers)) return fail(s, 'Reflect the overlying layers before retracting this muscle.');
  if (s.removed.includes(structureId)) return fail(s, 'That muscle has been removed.');
  const n = clone(s); n.retracted[structureId] = Math.max(0, Math.min(1, amount));
  return { ok: true, state: n, label: amount > 0 ? `Retract ${structureId}` : `Release ${structureId}`, message: amount > 0 ? 'Muscle retracted laterally (authored retraction path).' : 'Muscle released.' };
}

export function removeStructure(s: DissectionState, structureId: string, covers: LayerId[], tool: ToolId): ActionResult {
  if (tool !== 'scissors') return fail(s, 'Use the scissors to divide and remove a muscle.');
  if (!REMOVABLE_MUSCLES.has(structureId)) return fail(s, 'Removal is not supported for this structure (neurovascular structures are preserved; other tissues are not yet authored).');
  if (!exposed(s, covers)) return fail(s, 'Reflect the overlying layers first.');
  if (s.removed.includes(structureId)) return fail(s, 'Already removed.');
  const n = clone(s); n.removed.push(structureId); delete n.retracted[structureId];
  return { ok: true, state: n, label: `Remove ${structureId}`, message: 'Muscle divided and removed.' };
}

export function addPin(s: DissectionState, pin: Pin): ActionResult {
  const n = clone(s); n.pins.push(pin);
  return { ok: true, state: n, label: `Pin ${pin.label}`, message: `Pin ${n.pins.length} placed on ${pin.label}.` };
}
export function removePin(s: DissectionState, id: string): ActionResult {
  const n = clone(s); n.pins = n.pins.filter((p) => p.id !== id);
  return { ok: true, state: n, label: 'Remove pin', message: 'Pin removed.' };
}

// ---------------- history ----------------
export interface History { past: { state: DissectionState; label: string }[]; present: DissectionState; future: { state: DissectionState; label: string }[]; log: string[] }
export const newHistory = (): History => ({ past: [], present: initialState(), future: [], log: [] });
export function commit(h: History, r: ActionResult): History {
  if (!r.ok) return h;
  return { past: [...h.past, { state: h.present, label: r.label ?? 'Action' }], present: r.state, future: [], log: [...h.log, r.label ?? 'Action'] };
}
export function undo(h: History): History {
  const last = h.past[h.past.length - 1]; if (!last) return h;
  return { past: h.past.slice(0, -1), present: last.state, future: [{ state: h.present, label: last.label }, ...h.future], log: h.log.slice(0, -1) };
}
export function redo(h: History): History {
  const nx = h.future[0]; if (!nx) return h;
  return { past: [...h.past, { state: h.present, label: nx.label }], present: nx.state, future: h.future.slice(1), log: [...h.log, nx.label] };
}
export function reset(h: History): History {
  if (!h.past.length && !JSON.stringify(h.present).includes('"cuts":["')) return { ...h, present: initialState() };
  return { past: [...h.past, { state: h.present, label: 'Reset region' }], present: initialState(), future: [], log: [...h.log, 'Reset region'] };
}
