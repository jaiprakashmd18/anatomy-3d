import { describe, it, expect } from 'vitest';
import * as D from '../src/engine/dissection';

const cutAll = (s: D.History['present'], layer: 'skin' | 'superficial_fascia' | 'deep_fascia', tool: 'scalpel' | 'scissors' = 'scalpel') => {
  let h = { ...D.newHistory(), present: s };
  for (const c of D.LAYER_RULES[layer].requiredCuts) h = D.commit(h, D.incise(h.present, layer, c, tool));
  return h.present;
};

describe('dissection state machine', () => {
  it('starts intact and activates skin first', () => {
    const s = D.initialState();
    expect(D.layerStatus(s, 'skin')).toBe('intact');
    expect(D.activeLayer(s)).toBe('skin');
  });
  it('rejects wrong tool and deeper-layer cuts', () => {
    const s = D.initialState();
    expect(D.incise(s, 'skin', 'skin.longitudinal', 'scissors').ok).toBe(false);
    const r = D.incise(s, 'deep_fascia', 'deep_fascia.longitudinal', 'scalpel');
    expect(r.ok).toBe(false); expect(r.message).toMatch(/must be reflected/);
  });
  it('requires all incisions before lifting; supports partial lift then reflect', () => {
    let s = D.initialState();
    expect(D.setFlap(s, 'skin', 'medial', 0.5, 'forceps').ok).toBe(false);
    s = cutAll(s, 'skin');
    expect(D.layerStatus(s, 'skin')).toBe('incised');
    s = D.setFlap(s, 'skin', 'medial', 0.4, 'forceps').state;
    expect(D.layerStatus(s, 'skin')).toBe('lifted');
    s = D.reflectLayer(s, 'skin', 'reflect').state;
    expect(D.layerStatus(s, 'skin')).toBe('reflected');
  });
  it('does not invent tissue planes: peel is refused for deep fascia', () => {
    let s = D.initialState();
    s = D.reflectLayer(cutAll(s, 'skin'), 'skin', 'reflect').state;
    s = D.reflectLayer(cutAll(s, 'superficial_fascia'), 'superficial_fascia', 'peel').state;
    s = cutAll(s, 'deep_fascia', 'scissors');
    expect(D.reflectLayer(s, 'deep_fascia', 'peel').ok).toBe(false);
    expect(D.reflectLayer(s, 'deep_fascia', 'retractor').ok).toBe(true);
  });
  it('removal needs scissors and a reflected layer; retraction needs exposure', () => {
    let s = D.reflectLayer(cutAll(D.initialState(), 'skin'), 'skin', 'reflect').state;
    expect(D.removeLayer(s, 'skin', 'scalpel').ok).toBe(false);
    expect(D.removeLayer(s, 'skin', 'scissors').ok).toBe(true);
    expect(D.retract(s, 'biceps_brachii', 1, ['skin', 'superficial_fascia', 'deep_fascia'], 'retractor').ok).toBe(false);
    expect(D.retract(s, 'median_nerve', 1, ['skin'], 'retractor').ok).toBe(false);
  });
  it('removing a structure requires an authored removable muscle', () => {
    const all = ['skin', 'superficial_fascia', 'deep_fascia'] as const;
    let s = D.initialState();
    s.layers.skin.removed = s.layers.superficial_fascia.removed = s.layers.deep_fascia.removed = true;
    expect(D.removeStructure(s, 'median_nerve', [...all], 'scissors').ok).toBe(false);
    expect(D.removeStructure(s, 'biceps_brachii', [...all], 'scissors').ok).toBe(true);
  });
});

describe('history', () => {
  it('undo/redo restore anatomical state exactly', () => {
    let h = D.newHistory();
    h = D.commit(h, D.incise(h.present, 'skin', 'skin.longitudinal', 'scalpel'));
    const afterOne = JSON.stringify(h.present);
    h = D.commit(h, D.incise(h.present, 'skin', 'skin.proximal', 'scalpel'));
    h = D.undo(h);
    expect(JSON.stringify(h.present)).toBe(afterOne);
    h = D.redo(h);
    expect(h.present.layers.skin.cuts).toHaveLength(2);
    h = D.undo(D.undo(h));
    expect(JSON.stringify(h.present)).toBe(JSON.stringify(D.initialState()));
  });
  it('a new action clears redo; reset is undoable', () => {
    let h = D.commit(D.newHistory(), D.incise(D.initialState(), 'skin', 'skin.longitudinal', 'scalpel'));
    h = D.undo(h);
    h = D.commit(h, D.incise(h.present, 'skin', 'skin.distal', 'scalpel'));
    expect(h.future).toHaveLength(0);
    const before = JSON.stringify(h.present);
    h = D.reset(h);
    expect(h.present.layers.skin.cuts).toHaveLength(0);
    expect(JSON.stringify(D.undo(h).present)).toBe(before);
  });
  it('redundant reflect is refused and creates no history entry', () => {
    let h = D.newHistory();
    for (const c of D.LAYER_RULES.skin.requiredCuts) h = D.commit(h, D.incise(h.present, 'skin', c, 'scalpel'));
    h = D.commit(h, D.reflectLayer(h.present, 'skin', 'reflect'));
    const n = h.past.length; const again = D.reflectLayer(h.present, 'skin', 'reflect');
    expect(again.ok).toBe(false); expect(D.commit(h, again).past.length).toBe(n);
  });
  it('failed actions do not alter history', () => {
    const h = D.newHistory();
    expect(D.commit(h, D.incise(h.present, 'skin', 'nope', 'scalpel'))).toBe(h);
  });
});
