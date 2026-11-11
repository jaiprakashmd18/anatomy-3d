#!/usr/bin/env node
// ANATOMYVERSE asset pipeline: BodyParts3D STL -> optimised right-upper-limb GLB + metadata.
// Usage: BP3D_DIR=/path/to/stl node pipeline/build-assets.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readSTL, readTris, weld, normals, cluster, decimateTo, compact, bbox } from './stl.mjs';
import { writeGLB } from './glb.mjs';
import { makeFrame, radialGrid, wrap } from './limb-frame.mjs';
import { SOURCE, MESH_STRUCTURES, LIMB_TISSUE, HULL_MUSCLES, SKIN_FMA, WINDOW, HINGE_THETA_DEG, REFLECT_ANGLE_DEG, CURVES } from './limb-config.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = process.env.BP3D_DIR;
if (!SRC) { console.error('Set BP3D_DIR to the folder containing FMA*.stl'); process.exit(1); }
const OUT = path.join(ROOT, 'public', 'assets');
fs.mkdirSync(OUT, { recursive: true });
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);

// ---------- 1. load + decimate structure meshes ----------
const parts = []; // {sid, fma, layer, mesh, nor, srcTris}
for (const [sid, name, fmas, layer, budget] of MESH_STRUCTURES) {
  for (const fma of fmas) {
    const raw = readSTL(path.join(SRC, `FMA${fma}.stl`));
    const mesh = decimateTo(raw, Math.round((budget * Number(process.env.DETAIL ?? 4)) / fmas.length));
    parts.push({ sid, fma, layer, mesh, nor: normals(mesh), srcTris: raw.idx.length / 3 });
  }
}
log(`loaded ${parts.length} meshes`);

// ---------- 2. limb frame ----------
const centroidOf = (pts) => { const c = [0, 0, 0]; for (const p of pts) for (let k = 0; k < 3; k++) c[k] += p[k]; return c.map((x) => x / pts.length); };
const verts = (sid) => { const out = []; for (const p of parts.filter((q) => q.sid === sid)) for (let i = 0; i < p.mesh.pos.length; i += 3) out.push([p.mesh.pos[i], p.mesh.pos[i + 1], p.mesh.pos[i + 2]]); return out; };
const hum = verts('humerus'), rad = verts('radius'), uln = verts('ulna');
const zmax = (v) => Math.max(...v.map((p) => p[2])), zmin = (v) => Math.min(...v.map((p) => p[2]));
const P0 = centroidOf(hum.filter((p) => p[2] > zmax(hum) - 28));
const P1 = centroidOf(hum.filter((p) => p[2] < zmin(hum) + 22));
const wristPts = [...rad, ...uln];
const P2 = centroidOf(wristPts.filter((p) => p[2] < zmin(wristPts) + 14));
const P3 = centroidOf(['metacarpal_2', 'metacarpal_3', 'metacarpal_4', 'metacarpal_5'].flatMap(verts));
const frame = makeFrame([P0, P1, P2, P3]);
log('frame', { L0: frame.L0.toFixed(0), L1: frame.L1.toFixed(0), total: frame.total.toFixed(0) });
const uTop = frame.U(WINDOW.fTop), uBot = frame.U(WINDOW.fBot), thetaH = (HINGE_THETA_DEG * Math.PI) / 180;

const uLo = -20, uHi = frame.total;
const hullPts = HULL_MUSCLES.flatMap(verts).concat(['humerus', 'radius', 'ulna'].flatMap(verts));
const Rhull = radialGrid(frame, uLo, uHi, 4, 90, hullPts, 'max');
const Rbrach = radialGrid(frame, uLo, uHi, 4, 90, verts('brachialis').concat(verts('humerus')), 'max');

// ---------- 3. skin crop ----------
const tissue = LIMB_TISSUE.flatMap(verts).filter((_, i) => i % 2 === 0);
const CELL = 40, NEAR = 30;
const hash = new Map();
for (const p of tissue) { const k = `${Math.floor(p[0] / CELL)},${Math.floor(p[1] / CELL)},${Math.floor(p[2] / CELL)}`; (hash.get(k) ?? hash.set(k, []).get(k)).push(p); }
const near = (c) => {
  const cx = Math.floor(c[0] / CELL), cy = Math.floor(c[1] / CELL), cz = Math.floor(c[2] / CELL);
  for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
    const l = hash.get(`${cx + x},${cy + y},${cz + z}`); if (!l) continue;
    for (const p of l) { const dx = p[0] - c[0], dy = p[1] - c[1], dz = p[2] - c[2]; if (dx * dx + dy * dy + dz * dz < NEAR * NEAR) return true; }
  }
  return false;
};
const uHandEnd = frame.total + 12;
// Pass 1: candidates near the limb tissue (no normal test: the source skin mixes outer and inner surfaces).
const candFn = (c) => {
  const q = frame.project(c);
  if (q.u < -22 || q.u > uHandEnd || q.r > (q.u < 90 ? 82 : 140)) return false;
  if (q.u > uLo && q.u < uHi && q.r > Rhull.at(q.u, q.theta) + 16) return false; // reject trunk skin standing off the limb envelope
  return near(c);
};
const cand = readTris(path.join(SRC, `FMA${SKIN_FMA}.stl`), candFn);
// Pass 2: keep only the outermost shell per (u, theta) bin.
const BU = 5, BT = 72; const binMax = new Map();
const binKey = (c) => { const q = frame.project(c); return { k: `${Math.round(q.u / BU)}_${Math.round(((q.theta + Math.PI) / (2 * Math.PI)) * BT)}`, r: q.r }; };
const cen = (t, i) => [(t[i] + t[i + 3] + t[i + 6]) / 3, (t[i + 1] + t[i + 4] + t[i + 7]) / 3, (t[i + 2] + t[i + 5] + t[i + 8]) / 3];
for (let i = 0; i < cand.length; i += 9) { const { k, r } = binKey(cen(cand, i)); if (r > (binMax.get(k) ?? -1)) binMax.set(k, r); }
const keepTris = [];
for (let i = 0; i < cand.length; i += 9) { const { k, r } = binKey(cen(cand, i)); if (r >= binMax.get(k) - 2.2) for (let j = 0; j < 9; j++) keepTris.push(cand[i + j]); }
log(`skin candidates ${cand.length / 9}; outer-shell kept ${keepTris.length / 9}`);
const skinPts = []; for (let i = 0; i < keepTris.length; i += 3) skinPts.push([keepTris[i], keepTris[i + 1], keepTris[i + 2]]);

// ---------- 4. radial grids ----------
const uSkinMax = frame.segs[2].u0 + 28; // skin is resampled up to just beyond the wrist; the hand is left unskinned
const Rskin = radialGrid(frame, uLo, uSkinMax, 2.0, 216, skinPts, 'p90', 9);
const SUPF_DEPTH = 4.0, DEEP_OFF = 0.8;
const Rsupf = (u, t) => Rskin.at(u, t) - SUPF_DEPTH;
const Rdeep = (u, t) => Math.min(Rhull.at(u, t) + DEEP_OFF, Rsupf(u, t) - 0.5);

// ---------- 5. layer sheets ----------
function subMesh(mesh, nor, tris) {
  const idx = new Uint32Array(tris.length * 3);
  tris.forEach((t, i) => { idx[i * 3] = mesh.idx[t * 3]; idx[i * 3 + 1] = mesh.idx[t * 3 + 1]; idx[i * 3 + 2] = mesh.idx[t * 3 + 2]; });
  const used = new Map(); const pos = []; const nn = []; const out = new Uint32Array(idx.length);
  for (let i = 0; i < idx.length; i++) {
    const v = idx[i]; let k = used.get(v);
    if (k === undefined) { k = pos.length / 3; used.set(v, k); pos.push(mesh.pos[v * 3], mesh.pos[v * 3 + 1], mesh.pos[v * 3 + 2]); nn.push(nor[v * 3], nor[v * 3 + 1], nor[v * 3 + 2]); }
    out[i] = k;
  }
  return { pos: Float32Array.from(pos), nor: Float32Array.from(nn), idx: out };
}
/** Cylindrical sheet resampled on a (u, theta) grid. Rows are aligned so uTop/uBot and theta = 0, +-hinge lie on grid lines;
 *  triangle groups: 0 fixed, 1 medial flap, 2 lateral flap (decided per quad, so flap borders are exact). */
function buildSheet(radiusFn, uMin, uMax, nT = 216) {
  const N = Math.round((uBot - uTop) / 2.3); const du = (uBot - uTop) / N;
  const i0 = -Math.floor((uTop - uMin) / du), i1 = N + Math.floor((uMax - uBot) / du);
  const rows = i1 - i0 + 1; const pos = [];
  for (let r = 0; r < rows; r++) for (let j = 0; j < nT; j++) {
    const u = uTop + (i0 + r) * du, th = -Math.PI + (j * 2 * Math.PI) / nT;
    pos.push(...frame.pointAt(u, th, radiusFn(u, th)));
  }
  const idx = [], grp = [];
  for (let r = 0; r < rows - 1; r++) for (let j = 0; j < nT; j++) {
    const a = r * nT + j, b = r * nT + (j + 1) % nT, c = (r + 1) * nT + j, d = (r + 1) * nT + (j + 1) % nT;
    const um = uTop + (i0 + r + 0.5) * du, tm = -Math.PI + ((j + 0.5) * 2 * Math.PI) / nT;
    const g = um > uTop && um < uBot && Math.abs(tm) < thetaH ? (tm >= 0 ? 1 : 2) : 0;
    idx.push(a, c, b, b, c, d); grp.push(g, g);
  }
  return { mesh: { pos: Float32Array.from(pos), idx: Uint32Array.from(idx) }, grp };
}
const sk = buildSheet((u, t) => Rskin.at(u, t), uLo, uSkinMax);
const supf = buildSheet(Rsupf, uTop, uBot), deep = buildSheet(Rdeep, uTop, uBot);
const sheets = {
  skin: { mesh: sk.mesh, nor: normals(sk.mesh), grp: sk.grp },
  superficial_fascia: { mesh: supf.mesh, nor: normals(supf.mesh), grp: supf.grp },
  deep_fascia: { mesh: deep.mesh, nor: normals(deep.mesh), grp: deep.grp },
};
const classify = (sheet) => { const groups = [[], [], []]; sheet.grp.forEach((g, t) => groups[g].push(t)); return groups; };

const radiusFnFor = { skin: (u, t) => Rskin.at(u, t) + 0.5, superficial_fascia: (u, t) => Rsupf(u, t) + 0.4, deep_fascia: (u, t) => Rdeep(u, t) + 0.4 };
const poly = (pts) => pts.map((p) => p);
function cutPaths(layer) {
  const R = radiusFnFor[layer]; const out = [];
  const longi = []; for (let u = uTop; u <= uBot + 1e-6; u += 4) longi.push(frame.pointAt(u, 0, R(u, 0) + 0.9));
  out.push({ id: `${layer}.longitudinal`, label: 'Longitudinal anterior midline', pts: longi });
  if (layer === 'skin') {
    for (const [id, label, u] of [['proximal', 'Proximal transverse', uTop], ['distal', 'Distal transverse (below cubital fossa)', uBot]]) {
      const pts = []; for (let th = -thetaH; th <= thetaH + 1e-6; th += (3 * Math.PI) / 180) pts.push(frame.pointAt(u, th, R(u, th) + 0.9));
      out.push({ id: `skin.${id}`, label, pts });
    }
  }
  return out;
}
const hinge = (layer, side) => { // side +1 medial, -1 lateral
  const R = radiusFnFor[layer]; const th = side * thetaH;
  return [frame.pointAt(uTop, th, R(uTop, th) - 0.5), frame.pointAt(uBot, th, R(uBot, th) - 0.5)];
};

// ---------- 6. coordinates -> three.js (cm, y-up, centred) ----------
const S = 0.1; // mm -> cm
const C0 = [(P0[0] + P3[0]) / 2, (P0[1] + P3[1]) / 2, (P0[2] + P3[2]) / 2];
const cvp = (p) => [(p[0] - C0[0]) * S, (p[2] - C0[2]) * S, (-(p[1]) + C0[1]) * S];
const cvn = (n) => [n[0], n[2], -n[1]];
const cvPosArr = (pos) => { const o = new Float32Array(pos.length); for (let i = 0; i < pos.length; i += 3) { const p = cvp([pos[i], pos[i + 1], pos[i + 2]]); o[i] = p[0]; o[i + 1] = p[1]; o[i + 2] = p[2]; } return o; };
const cvNorArr = (nor) => { const o = new Float32Array(nor.length); for (let i = 0; i < nor.length; i += 3) { const n = cvn([nor[i], nor[i + 1], nor[i + 2]]); o[i] = n[0]; o[i + 1] = n[1]; o[i + 2] = n[2]; } return o; };
const flipWinding = (idx) => { const o = new Uint32Array(idx); return o; }; // proper rotation: no flip

const entries = []; const meshMeta = [];
for (const p of parts) {
  const name = `${p.sid}#${p.fma}`;
  entries.push({ name, extras: { structure: p.sid, fma: p.fma, layer: p.layer }, pos: cvPosArr(p.mesh.pos), nor: cvNorArr(p.nor), idx: flipWinding(p.mesh.idx) });
  meshMeta.push({ name, structure: p.sid, fma: p.fma, layer: p.layer, sourceTriangles: p.srcTris, triangles: p.mesh.idx.length / 3 });
}
const sheetMeta = {};
for (const [layer, sheet] of Object.entries(sheets)) {
  const { mesh, nor } = sheet; const g = classify(sheet);
  const names = ['fixed', 'medial', 'lateral'];
  sheetMeta[layer] = { groups: {}, cuts: cutPaths(layer).map((c) => ({ ...c, pts: c.pts.map(cvp) })), hinges: { medial: hinge(layer, 1).map(cvp), lateral: hinge(layer, -1).map(cvp) } };
  g.forEach((tris, i) => {
    if (!tris.length) return;
    const sm = subMesh(mesh, nor, tris);
    const name = `${layer}.${names[i]}`;
    entries.push({ name, extras: { layer, group: names[i] }, pos: cvPosArr(sm.pos), nor: cvNorArr(sm.nor), idx: sm.idx });
    sheetMeta[layer].groups[names[i]] = { triangles: tris.length };
    meshMeta.push({ name, structure: layer, layer, triangles: tris.length, synthetic: layer !== 'skin' });
  });
}
log('sheet groups', Object.fromEntries(Object.entries(sheetMeta).map(([k, v]) => [k, v.groups])));

// ---------- 7. schematic neurovascular curves ----------
const ref = { hull: (u, t) => Rhull.at(u, t), brach: (u, t) => Rbrach.at(u, t), supf: (u, t) => Rsupf(u, t) };
const curves = CURVES.map((c) => {
  const pts = c.pts.map(([f, deg]) => { const u = frame.U(f), th = (deg * Math.PI) / 180; return cvp(frame.pointAt(u, th, ref[c.mode](u, th) + c.off)); });
  return { id: c.id, kind: c.kind, radius: c.radius * S * 1.5, points: pts, mode: c.mode };
});

// ---------- 8. landmarks (approximate, derived from mesh extremities) ----------
const extreme = (v, f) => v.reduce((b, p) => (f(p) > f(b) ? p : b));
const sc = verts('scapula'), hdist = hum.filter((p) => p[2] < zmin(hum) + 30);
const landmarks = [
  { id: 'acromion', label: 'Acromion (lateral tip, approx.)', p: extreme(sc.filter((p) => p[2] > zmax(sc) - 70), (p) => -p[0]) },
  { id: 'lateral_epicondyle', label: 'Lateral epicondyle of humerus (approx.)', p: extreme(hdist, (p) => -p[0]) },
  { id: 'medial_epicondyle', label: 'Medial epicondyle of humerus (approx.)', p: extreme(hdist, (p) => p[0]) },
  { id: 'radial_styloid', label: 'Radial styloid process (approx.)', p: extreme(rad, (p) => -p[2] * 1 + -p[0] * 0.2) },
  { id: 'ulnar_styloid', label: 'Ulnar styloid process (approx.)', p: extreme(uln, (p) => -p[2]) },
  { id: 'cubital_fossa', label: 'Cubital fossa (centre, derived)', p: frame.pointAt(frame.U(1.0), 0, Rhull.at(frame.U(1.0), 0) + 4) },
].map((l) => ({ id: l.id, label: l.label, position: cvp(l.p), method: 'mesh-extremity/derived' }));

// ---------- 9. muscle retraction metadata ----------
const bicepsMidU = frame.U(0.5);
const retract = {
  biceps_brachii: {
    dir: (() => { const a = cvp(frame.pointAt(bicepsMidU, (-90 * Math.PI) / 180, 1)), b = cvp(frame.axisPoint(bicepsMidU)); return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; })(),
    distance: 2.6, axisA: cvp(frame.axisPoint(frame.U(0.1))), axisB: cvp(frame.axisPoint(frame.U(1.05))),
  },
};

// ---------- 10. write ----------
const glb = writeGLB(entries);
fs.writeFileSync(path.join(OUT, 'limb.glb'), glb);
const meta = {
  generated: new Date().toISOString(), source: SOURCE, unit: 'cm',
  coordinateSystem: 'three.js: +Y superior, +Z anterior, +X subject left (medial for the right limb)',
  frame: { points: [P0, P1, P2, P3].map(cvp), L0: frame.L0 * S, L1: frame.L1 * S, uTop: uTop * S, uBot: uBot * S, hingeThetaDeg: HINGE_THETA_DEG, reflectAngleDeg: REFLECT_ANGLE_DEG },
  meshes: meshMeta, sheets: sheetMeta, curves, landmarks, retract,
  notes: [
    'skin: radial height-field (2.5 mm x 2.5 deg) resampled from the outer shell of the real BodyParts3D skin mesh over the arm and forearm (90th-percentile radius per bin); hand and fingers are not skinned.',
    'superficial_fascia and deep_fascia are SYNTHETIC sleeves generated from the limb frame; they are not segmented tissue.',
    'curves are SCHEMATIC authored courses anchored to the muscle envelope; not segmented anatomy and not medically validated.',
  ],
};
fs.writeFileSync(path.join(OUT, 'limb-meta.json'), JSON.stringify(meta));
const tri = meshMeta.reduce((s, m) => s + m.triangles, 0);
log(`wrote limb.glb ${(glb.length / 1048576).toFixed(1)} MB, ${tri} triangles, ${meshMeta.length} meshes`);
