export type Vec3 = [number, number, number];
export type LayerId = 'skin' | 'superficial_fascia' | 'deep_fascia';
export const LAYER_ORDER: LayerId[] = ['skin', 'superficial_fascia', 'deep_fascia'];
export type ToolId = 'probe' | 'scalpel' | 'scissors' | 'forceps' | 'retractor' | 'peel' | 'reflect' | 'pin';
export type FlapSide = 'medial' | 'lateral';
export type LayerStatus = 'intact' | 'incised' | 'lifted' | 'reflected' | 'removed';

/** How trustworthy the 3D representation + content of a structure is. */
export type Fidelity = 'segmented-source' | 'synthetic-sheet' | 'schematic-course' | 'info-only';
export type Validation = 'unreviewed' | 'review-requested' | 'validated';

export interface Pin { id: string; structureId: string; position: Vec3; label: string }

export interface LayerState {
  cuts: string[];
  flap: Record<FlapSide, number>; // 0 = in place, 1 = fully reflected
  removed: boolean;
}

export interface DissectionState {
  layers: Record<LayerId, LayerState>;
  retracted: Record<string, number>;
  removed: string[];
  pins: Pin[];
}

export interface CutDef { id: string; layer: LayerId; label: string; points: Vec3[]; tools: ToolId[] }

export interface LayerRule {
  requiredCuts: string[];
  cutTools: ToolId[];
  reflectTools: ToolId[];
  label: string;
}

export interface ActionResult { ok: boolean; state: DissectionState; message: string; label?: string }
