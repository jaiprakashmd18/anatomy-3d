import { describe, it, expect } from 'vitest';
// @ts-expect-error plain .mjs pipeline module
import { makeFrame, wrap } from '../pipeline/limb-frame.mjs';

describe('limb frame (pipeline)', () => {
  const f = makeFrame([[0, 0, 100], [0, 0, 70], [0, 0, 40], [0, 0, 30]]);
  it('round-trips point <-> (u, theta, r)', () => {
    for (const [u, th, r] of [[10, 0.3, 20], [35, -1.2, 15], [50, 2.4, 22]]) {
      const q = f.project(f.pointAt(u, th, r)); expect(q.u).toBeCloseTo(u, 4); expect(wrap(q.theta - th)).toBeCloseTo(0, 4); expect(q.r).toBeCloseTo(r, 4);
    }
  });
  it('theta=0 is anterior (-y in source coordinates) and +theta is medial (+x)', () => {
    const a = f.pointAt(10, 0, 10), m = f.pointAt(10, Math.PI / 2, 10), ax = f.axisPoint(10);
    expect(a[1] - ax[1]).toBeCloseTo(-10, 5); expect(m[0] - ax[0]).toBeCloseTo(10, 5);
  });
});
