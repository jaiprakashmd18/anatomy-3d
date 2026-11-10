import { describe, it, expect } from 'vitest';
import { scoreStroke, bestCut, resample } from '../src/engine/cuts';
import { makeFlap, applyFlap } from '../src/engine/flap';
import type { Vec3 } from '../src/engine/types';

const line = (n: number): Vec3[] => Array.from({ length: n + 1 }, (_, i) => [0, i * 1, 0] as Vec3);

describe('cut validation', () => {
  const path = line(30);
  it('accepts a close trace', () => {
    const stroke = resample(path, 0.7).map((p) => [p[0] + 0.3, p[1], p[2]] as Vec3);
    expect(scoreStroke(stroke, 'a', path).ok).toBe(true);
  });
  it('rejects partial and off-path strokes', () => {
    expect(scoreStroke(resample(line(12), 0.7), 'a', path).ok).toBe(false);
    expect(scoreStroke(resample(path, 0.7).map((p) => [p[0] + 4, p[1], p[2]] as Vec3), 'a', path).ok).toBe(false);
  });
  it('picks the best candidate', () => {
    const other: Vec3[] = Array.from({ length: 31 }, (_, i) => [i, 0, 0] as Vec3);
    expect(bestCut(resample(path, 0.7), [{ id: 'x', points: other }, { id: 'y', points: path }])!.cutId).toBe('y');
  });
});

describe('flap deformation', () => {
  it('keeps hinge fixed and swings the edge outward, preserving distance to hinge', () => {
    const hinge: [Vec3, Vec3] = [[0, 0, 0], [0, 10, 0]];
    const pts: number[] = []; for (let x = 0; x <= 6; x += 1) for (let y = 0; y <= 10; y += 2) pts.push(x, y, 0);
    const orig = Float32Array.from(pts), out = new Float32Array(orig.length);
    const f = makeFlap(orig, hinge, [[-5, 0, 0], [-5, 10, 0]], Math.PI * 0.7); // limb axis lies at x=-5 => outward is +x
    applyFlap(orig, out, f, 0); expect(Array.from(out)).toEqual(Array.from(orig));
    applyFlap(orig, out, f, 1);
    for (let i = 0; i < orig.length; i += 3) {
      const d0 = Math.hypot(orig[i], orig[i + 2]), d1 = Math.hypot(out[i], out[i + 2]);
      expect(d1).toBeCloseTo(d0, 3); expect(out[i + 1]).toBeCloseTo(orig[i + 1], 3);
    }
    expect(Math.abs(out[36 * 3 + 2])).toBeGreaterThan(1); // far edge left the plane
    expect(out[0]).toBeCloseTo(0, 5); // hinge-point untouched
  });
});
