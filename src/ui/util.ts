import { STRUCTURE_BY_ID } from '../data/structures';
import * as D from '../engine/dissection';
import type { DissectionState, LayerId } from '../engine/types';
import type { Visibility } from '../engine/tutor';
import { LAYER_RULES } from '../engine/dissection';

export function visibilityOf(id: string, d: DissectionState): Visibility {
  const s = STRUCTURE_BY_ID[id]; if (!s || s.fidelity === 'info-only') return 'not-modelled';
  if (d.removed.includes(id)) return 'removed';
  if (s.kind === 'skin') return D.layerStatus(d, 'skin') === 'removed' ? 'removed' : 'exposed';
  if (s.kind === 'fascia') { const l = id as LayerId; if (D.layerStatus(d, l) === 'removed') return 'removed'; return D.exposed(d, s.covers) ? 'exposed' : 'covered'; }
  return D.exposed(d, s.covers) ? 'exposed' : 'covered';
}
export const coveringLabels = (id: string, d: DissectionState) => (STRUCTURE_BY_ID[id]?.covers ?? []).filter((l) => !D.isOpen(d, l)).map((l) => LAYER_RULES[l].label.toLowerCase());
export const FID_LABEL: Record<string, [string, string]> = {
  'segmented-source': ['Real mesh (BodyParts3D)', 'ok'], 'synthetic-sheet': ['Synthetic sheet', 'warn'], 'schematic-course': ['Schematic course', 'warn'], 'info-only': ['Not modelled in 3D', 'muted'],
};
