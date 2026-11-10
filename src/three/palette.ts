import type { Compartment, Kind } from '../data/types';
import type { Mode } from '../store/useStore';

export interface Look { color: string; opacity: number; roughness: number; metalness?: number }

const MUSCLE_ATLAS: Record<Compartment, string> = {
  shoulder: '#c9574a', 'anterior arm': '#d9473c', 'posterior arm': '#b94d3f', 'anterior forearm': '#dd6a4b', 'posterior forearm': '#c9694f',
  'cubital fossa': '#d9473c', carpus: '#d9473c', hand: '#d9473c', girdle: '#c9574a', integument: '#c9574a',
};
const MUSCLE_CADAVER: Record<Compartment, string> = {
  shoulder: '#8a4639', 'anterior arm': '#94493c', 'posterior arm': '#7d4036', 'anterior forearm': '#9a5444', 'posterior forearm': '#86493c',
  'cubital fossa': '#94493c', carpus: '#94493c', hand: '#94493c', girdle: '#8a4639', integument: '#8a4639',
};

export function lookFor(kind: Kind, compartment: Compartment, mode: Mode, sheetId?: string): Look {
  if (mode === 'xray') {
    const c: Record<string, [string, number]> = { skin: ['#9db7e8', 0.1], fascia: ['#a7c4f2', 0.1], muscle: ['#6f9bd8', 0.3], bone: ['#f4f7ff', 0.65], nerve: ['#ffe066', 0.9], artery: ['#ff6b6b', 0.9], vein: ['#6b9bff', 0.9] };
    const [color, opacity] = c[kind]; return { color, opacity, roughness: 0.6 };
  }
  const atlas = mode === 'atlas';
  switch (kind) {
    case 'skin': return { color: atlas ? '#e9c1a6' : '#b69b88', opacity: 1, roughness: atlas ? 0.6 : 0.8 };
    case 'fascia': return sheetId === 'deep_fascia' ? { color: atlas ? '#f3efe2' : '#cfc7b4', opacity: 0.62, roughness: 0.5 } : { color: atlas ? '#f6e39a' : '#c9b57c', opacity: 0.6, roughness: 0.7 };
    case 'muscle': return { color: (atlas ? MUSCLE_ATLAS : MUSCLE_CADAVER)[compartment], opacity: 1, roughness: atlas ? 0.55 : 0.7 };
    case 'bone': return { color: atlas ? '#f4eed9' : '#d6cdb4', opacity: 1, roughness: 0.6 };
    case 'nerve': return { color: atlas ? '#ffd21f' : '#e9dd9c', opacity: 1, roughness: 0.4 };
    case 'artery': return { color: atlas ? '#e02424' : '#b5382b', opacity: 1, roughness: 0.4 };
    case 'vein': return { color: atlas ? '#2563eb' : '#4a64ad', opacity: 1, roughness: 0.4 };
  }
}
