import { Vec3 } from './types';

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

export function distToSegment(p: Vec3, a: Vec3, b: Vec3): number {
  const ab = sub(b, a), ap = sub(p, a);
  const t = Math.max(0, Math.min(1, dot(ap, ab) / (dot(ab, ab) || 1)));
  return dist(p, [a[0] + ab[0] * t, a[1] + ab[1] * t, a[2] + ab[2] * t]);
}
export function distToPolyline(p: Vec3, pl: Vec3[]): number {
  let best = Infinity; for (let i = 0; i < pl.length - 1; i++) best = Math.min(best, distToSegment(p, pl[i], pl[i + 1])); return best;
}
export function polylineLength(pl: Vec3[]) { let l = 0; for (let i = 0; i < pl.length - 1; i++) l += dist(pl[i], pl[i + 1]); return l; }
/** Resample polyline at ~uniform spacing. */
export function resample(pl: Vec3[], step: number): Vec3[] {
  const out: Vec3[] = [pl[0]];
  for (let i = 0; i < pl.length - 1; i++) {
    const L = dist(pl[i], pl[i + 1]); const n = Math.max(1, Math.round(L / step));
    for (let k = 1; k <= n; k++) { const t = k / n; out.push([pl[i][0] + (pl[i + 1][0] - pl[i][0]) * t, pl[i][1] + (pl[i + 1][1] - pl[i][1]) * t, pl[i][2] + (pl[i + 1][2] - pl[i][2]) * t]); }
  }
  return out;
}

export interface StrokeScore { cutId: string; coverage: number; precision: number; ok: boolean; reason: string }

/**
 * Validate a drawn stroke (surface hit points, cm) against an authored cut path.
 *  coverage  = fraction of the authored path lying within `tol` of the stroke
 *  precision = fraction of stroke samples lying within `tol * 1.6` of the path
 */
export function scoreStroke(stroke: Vec3[], cutId: string, path: Vec3[], tol = 0.9): StrokeScore {
  if (stroke.length < 3) return { cutId, coverage: 0, precision: 0, ok: false, reason: 'Stroke too short.' };
  const dense = resample(stroke, tol / 3);
  const coverage = resample(path, tol / 2).filter((q) => distToPolyline(q, dense) <= tol).length / resample(path, tol / 2).length;
  const precision = dense.filter((p) => distToPolyline(p, path) <= tol * 1.6).length / dense.length;
  const ok = coverage >= 0.75 && precision >= 0.85;
  const reason = ok ? 'Matches the supported incision.' : coverage < 0.75 ? `Incision covers only ${(coverage * 100).toFixed(0)}% of the supported path — continue along the guide.` : `Stroke strays from the supported path (${(precision * 100).toFixed(0)}% on-path).`;
  return { cutId, coverage, precision, ok, reason };
}

/** Pick the best-scoring candidate cut. */
export function bestCut(stroke: Vec3[], candidates: { id: string; points: Vec3[] }[], tol = 0.9): StrokeScore | null {
  let best: StrokeScore | null = null;
  for (const c of candidates) { const s = scoreStroke(stroke, c.id, c.points, tol); if (!best || s.coverage * s.precision > best.coverage * best.precision) best = s; }
  return best;
}

/** Cumulative-coverage support: a long incision (e.g. a wrap-around transverse cut) may be drawn in several strokes while the camera is moved. */
export interface PartialScore { cutId: string; bits: boolean[]; precision: number; covered: number }
export function strokeBits(stroke: Vec3[], cutId: string, path: Vec3[], tol = 0.9): PartialScore {
  const dense = stroke.length >= 2 ? resample(stroke, tol / 3) : stroke;
  const samples = resample(path, tol / 2);
  const bits = samples.map((q) => dense.length > 0 && distToPolyline(q, dense) <= tol);
  const precision = dense.length ? dense.filter((p) => distToPolyline(p, path) <= tol * 1.6).length / dense.length : 0;
  return { cutId, bits, precision, covered: bits.filter(Boolean).length };
}
export function bestPartial(stroke: Vec3[], candidates: { id: string; points: Vec3[] }[], tol = 0.9): PartialScore | null {
  let best: PartialScore | null = null;
  for (const c of candidates) { const s = strokeBits(stroke, c.id, c.points, tol); if (s.precision >= 0.85 && s.covered >= 4 && (!best || s.covered > best.covered)) best = s; }
  return best;
}
export const mergeBits = (a: boolean[] | undefined, b: boolean[]) => b.map((v, i) => v || !!a?.[i]);
export const fraction = (bits: boolean[]) => (bits.length ? bits.filter(Boolean).length / bits.length : 0);
export const COMPLETE_AT = 0.8;
