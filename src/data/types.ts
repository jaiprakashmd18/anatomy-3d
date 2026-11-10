import type { LayerId, Fidelity, Validation } from '../engine/types';

export type Kind = 'skin' | 'fascia' | 'muscle' | 'bone' | 'nerve' | 'artery' | 'vein';
export type Compartment = 'shoulder' | 'anterior arm' | 'posterior arm' | 'anterior forearm' | 'posterior forearm' | 'cubital fossa' | 'carpus' | 'hand' | 'girdle' | 'integument';

export interface StructureInfo {
  id: string; name: string; latin?: string; kind: Kind; region: string; compartment: Compartment; system: string;
  covers: LayerId[]; fidelity: Fidelity; validation: Validation;
  description: string; position: string; relations: string[]; function?: string;
  bloodSupply?: string; innervation?: string; origin?: string; insertion?: string; action?: string;
  clinical: string[]; injuries: string[]; tips: string[]; viva: string[]; refs: string[];
  aliases?: string[]; fma?: number[];
}
export const ALL_LAYERS: LayerId[] = ['skin', 'superficial_fascia', 'deep_fascia'];
