import { Vec3 } from './types';

const smooth = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const ease = (p: number) => p * p * (3 - 2 * p);

export interface FlapSetup { A: Vec3; B: Vec3; maxAngle: number; sign: 1 | -1; dMax: number; ramp: number; lead: number }

function sub(a: Vec3, b: Vec3): Vec3 { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function cross(a: Vec3, b: Vec3): Vec3 { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: Vec3): Vec3 => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/** Choose rotation sign so the flap swings *outward* (away from the limb axis) and compute max hinge distance. */
export function makeFlap(positions: Float32Array, hinge: [Vec3, Vec3], limbAxis: [Vec3, Vec3], maxAngleRad: number, ramp = 2.4, lead = 0.55): FlapSetup {
  const [A, B] = hinge; const k = norm(sub(B, A));
  const ax = norm(sub(limbAxis[1], limbAxis[0]));
  let dMax = 0; let sx = 0, sy = 0, sz = 0; const n = positions.length / 3;
  for (let i = 0; i < n; i++) {
    const q: Vec3 = [positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]]; const v = sub(q, A);
    const along = dot(v, k); const perp = sub(v, [k[0] * along, k[1] * along, k[2] * along]);
    dMax = Math.max(dMax, Math.hypot(...perp)); sx += q[0]; sy += q[1]; sz += q[2];
  }
  const c: Vec3 = [sx / n, sy / n, sz / n];
  const v = sub(c, A); const tang = cross(k, v); // direction of +rotation at centroid
  const cr = sub(c, limbAxis[0]); const radial = sub(cr, [ax[0] * dot(cr, ax), ax[1] * dot(cr, ax), ax[2] * dot(cr, ax)]);
  const sign: 1 | -1 = dot(tang, radial) >= 0 ? 1 : -1;
  return { A, B, maxAngle: maxAngleRad, sign, dMax: dMax || 1, ramp, lead };
}

/** Write deformed positions (and optionally rotated normals) for a flap at lift amount P (0..1).
 *  Rotation about the hinge with a peel lead (cut edge lifts first) and a fold ramp (hinge-side vertices barely rotate, so no tearing). */
export function applyFlap(orig: Float32Array, out: Float32Array, f: FlapSetup, P: number, origN?: Float32Array, outN?: Float32Array) {
  const k = norm(sub(f.B, f.A)); const e = ease(P);
  for (let i = 0; i < orig.length; i += 3) {
    const px = orig[i] - f.A[0], py = orig[i + 1] - f.A[1], pz = orig[i + 2] - f.A[2];
    const along = px * k[0] + py * k[1] + pz * k[2];
    const rx = px - k[0] * along, ry = py - k[1] * along, rz = pz - k[2] * along;
    const d = Math.hypot(rx, ry, rz);
    const dn = Math.min(1, d / f.dMax);
    const p = Math.max(0, Math.min(1, e * (1 + f.lead) - f.lead * (1 - dn)));
    const alpha = f.sign * f.maxAngle * p * smooth(0, f.ramp, d);
    const c = Math.cos(alpha), s = Math.sin(alpha);
    const kx = k[1] * rz - k[2] * ry, ky = k[2] * rx - k[0] * rz, kz = k[0] * ry - k[1] * rx;
    out[i] = f.A[0] + k[0] * along + rx * c + kx * s;
    out[i + 1] = f.A[1] + k[1] * along + ry * c + ky * s;
    out[i + 2] = f.A[2] + k[2] * along + rz * c + kz * s;
    if (origN && outN) { // Rodrigues on the full normal vector
      const nx = origN[i], ny = origN[i + 1], nz = origN[i + 2];
      const kd = k[0] * nx + k[1] * ny + k[2] * nz;
      const cx = k[1] * nz - k[2] * ny, cy = k[2] * nx - k[0] * nz, cz = k[0] * ny - k[1] * nx;
      outN[i] = nx * c + cx * s + k[0] * kd * (1 - c);
      outN[i + 1] = ny * c + cy * s + k[1] * kd * (1 - c);
      outN[i + 2] = nz * c + cz * s + k[2] * kd * (1 - c);
    }
  }
}

/** Screen-space-free helper: position of a point at lift P, used for forceps handle tracking. */
export function flapPoint(p: Vec3, f: FlapSetup, P: number): Vec3 {
  const o = new Float32Array(p); const out = new Float32Array(3); applyFlap(o, out, f, P); return [out[0], out[1], out[2]];
}

/** Retraction displacement: belly moves most, ends fixed (sin profile along the muscle axis). */
export function retractWeight(pos: Vec3, axisA: Vec3, axisB: Vec3): number {
  const ab = sub(axisB, axisA); const t = dot(sub(pos, axisA), ab) / (dot(ab, ab) || 1);
  return t <= 0 || t >= 1 ? 0 : Math.sin(Math.PI * t);
}
