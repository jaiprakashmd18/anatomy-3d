// Limb coordinate frame: maps world points <-> (u, theta, r) around a bent axis polyline.
//   u     arc length along the axis (mm), 0 at the humeral-head centre (P0)
//   theta angle around the axis; 0 = anterior, + toward medial (radians)
//   r     radial distance from the axis (mm)
// Source model axes (BodyParts3D): +x = subject's left (medial for the right limb), -y = anterior, +z = superior.

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => mul(a, 1 / (len(a) || 1));

export const ANTERIOR = [0, -1, 0];
export const MEDIAL_RIGHT = [1, 0, 0];

export function makeFrame(P /* [P0,P1,P2,P3] */, anterior = ANTERIOR, medial = MEDIAL_RIGHT) {
  const segs = [];
  let cum = 0;
  for (let k = 0; k < 3; k++) {
    const a = norm(sub(P[k + 1], P[k]));
    let n = sub(anterior, mul(a, dot(anterior, a)));
    n = norm(n);
    let m = sub(sub(medial, mul(a, dot(medial, a))), mul(n, dot(medial, n)));
    m = norm(m);
    const L = len(sub(P[k + 1], P[k]));
    segs.push({ P0: P[k], a, n, m, L, u0: cum });
    cum += L;
  }
  // Bisector planes at the elbow (P1) and wrist (P2) choose which segment owns a point.
  const b1 = norm(add(segs[0].a, segs[1].a));
  const b2 = norm(add(segs[1].a, segs[2].a));
  const segFor = (p) => {
    if (dot(sub(p, P[2]), b2) >= 0) return 2;
    if (dot(sub(p, P[1]), b1) >= 0) return 1;
    return 0;
  };
  const segForU = (u) => (u >= segs[2].u0 ? 2 : u >= segs[1].u0 ? 1 : 0);
  return {
    P, segs, total: cum, L0: segs[0].L, L1: segs[1].L,
    /** world point -> {u, theta, r, axis} */
    project(p) {
      const s = segs[segFor(p)];
      const d = sub(p, s.P0);
      const t = dot(d, s.a);
      const rad = sub(d, mul(s.a, t));
      const r = len(rad);
      const theta = Math.atan2(dot(rad, s.m), dot(rad, s.n));
      return { u: s.u0 + t, theta, r, seg: s };
    },
    axisPoint(u) {
      const s = segs[segForU(u)];
      return add(s.P0, mul(s.a, u - s.u0));
    },
    dir(u, theta) {
      const s = segs[segForU(u)];
      return add(mul(s.n, Math.cos(theta)), mul(s.m, Math.sin(theta)));
    },
    pointAt(u, theta, r) {
      const s = segs[segForU(u)];
      return add(add(s.P0, mul(s.a, u - s.u0)), mul(add(mul(s.n, Math.cos(theta)), mul(s.m, Math.sin(theta))), r));
    },
    /** U for fractional position: f in [0,1] = arm (0..elbow); f in [1,2] = forearm (elbow..wrist). */
    U(f) { return f <= 1 ? f * segs[0].L : segs[0].L + (f - 1) * segs[1].L; },
  };
}

/** Wrap angle to (-PI, PI]. */
export function wrap(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a <= -Math.PI) a += 2 * Math.PI; return a; }

/** Radial-envelope grid over (u, theta). `agg` = 'max' | 'mean'. Missing bins are filled by neighbour interpolation. */
export function radialGrid(frame, uMin, uMax, du, nTheta, samples, agg = 'max', smoothPasses = 2) {
  const nU = Math.ceil((uMax - uMin) / du) + 1;
  const sum = new Float64Array(nU * nTheta), cnt = new Uint32Array(nU * nTheta);
  const best = new Float64Array(nU * nTheta).fill(-1);
  const lists = agg === 'p90' ? new Map() : null;
  for (const p of samples) {
    const q = frame.project(p);
    if (q.u < uMin || q.u > uMax) continue;
    const i = Math.round((q.u - uMin) / du);
    const j = ((Math.round(((q.theta + Math.PI) / (2 * Math.PI)) * nTheta) % nTheta) + nTheta) % nTheta;
    const k = i * nTheta + j;
    sum[k] += q.r; cnt[k]++; if (q.r > best[k]) best[k] = q.r;
    if (lists) (lists.get(k) ?? lists.set(k, []).get(k)).push(q.r);
  }
  const g = new Float64Array(nU * nTheta);
  const has = new Uint8Array(nU * nTheta);
  for (let k = 0; k < g.length; k++) if (cnt[k]) {
    if (agg === 'p90') { const l = lists.get(k).sort((a, b) => a - b); g[k] = l[Math.min(l.length - 1, Math.floor(l.length * 0.9))]; }
    else g[k] = agg === 'max' ? best[k] : sum[k] / cnt[k];
    has[k] = 1;
  }
  // iterative fill
  for (let pass = 0; pass < 200; pass++) {
    let missing = 0;
    const g2 = g.slice(), h2 = has.slice();
    for (let i = 0; i < nU; i++) for (let j = 0; j < nTheta; j++) {
      const k = i * nTheta + j;
      if (has[k]) continue;
      let s = 0, c = 0;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ii = i + di; if (ii < 0 || ii >= nU) continue;
        const kk = ii * nTheta + ((j + dj + nTheta) % nTheta);
        if (has[kk]) { s += g[kk]; c++; }
      }
      if (c) { g2[k] = s / c; h2[k] = 1; } else missing++;
    }
    g.set(g2); has.set(h2);
    if (!missing) break;
  }
  // light smoothing (3x3 box, wrapped in theta) keeping max-envelope semantics when agg === 'max'
  const raw = g.slice();
  for (let it = 0; it < smoothPasses; it++) {
    const s = g.slice();
    for (let i = 0; i < nU; i++) for (let j = 0; j < nTheta; j++) {
      let acc = 0, c = 0;
      for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
        const ii = i + di; if (ii < 0 || ii >= nU) continue;
        acc += s[ii * nTheta + ((j + dj + nTheta) % nTheta)]; c++;
      }
      g[i * nTheta + j] = acc / c;
    }
  }
  if (agg === 'max') for (let k = 0; k < g.length; k++) g[k] = Math.max(g[k], raw[k]);
  void raw;
  return {
    uMin, du, nU, nTheta,
    at(u, theta) {
      const fi = Math.min(nU - 1, Math.max(0, (u - uMin) / du));
      let fj = ((theta + Math.PI) / (2 * Math.PI)) * nTheta; fj = ((fj % nTheta) + nTheta) % nTheta;
      const i0 = Math.floor(fi), i1 = Math.min(nU - 1, i0 + 1), j0 = Math.floor(fj) % nTheta, j1 = (j0 + 1) % nTheta;
      const ti = fi - i0, tj = fj - Math.floor(fj);
      const v = (i, j) => g[i * nTheta + j];
      return (v(i0, j0) * (1 - tj) + v(i0, j1) * tj) * (1 - ti) + (v(i1, j0) * (1 - tj) + v(i1, j1) * tj) * ti;
    },
  };
}
