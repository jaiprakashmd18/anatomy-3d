// Minimal binary-STL reader + geometry helpers (no dependencies).
import fs from 'node:fs';

/** Read a binary STL and return welded positions/indices (units: mm, as source). */
export function readSTL(path) {
  const b = fs.readFileSync(path);
  const n = b.readUInt32LE(80);
  if (84 + n * 50 !== b.length) throw new Error(`${path}: not a binary STL (${n} tris, ${b.length} bytes)`);
  const map = new Map();
  const pos = [];
  const idx = new Uint32Array(n * 3);
  for (let t = 0; t < n; t++) {
    const o = 84 + t * 50 + 12;
    for (let v = 0; v < 3; v++) {
      const x = b.readFloatLE(o + v * 12), y = b.readFloatLE(o + v * 12 + 4), z = b.readFloatLE(o + v * 12 + 8);
      const key = `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
      let i = map.get(key);
      if (i === undefined) { i = pos.length / 3; map.set(key, i); pos.push(x, y, z); }
      idx[t * 3 + v] = i;
    }
  }
  return { pos: Float32Array.from(pos), idx };
}

/** Vertex-clustering decimation. Returns a new welded mesh with degenerate tris removed. */
export function cluster(mesh, cell) {
  const { pos, idx } = mesh;
  const map = new Map();
  const acc = []; // sums + count
  const remap = new Uint32Array(pos.length / 3);
  for (let i = 0; i < remap.length; i++) {
    const kx = Math.floor(pos[i * 3] / cell), ky = Math.floor(pos[i * 3 + 1] / cell), kz = Math.floor(pos[i * 3 + 2] / cell);
    const key = kx + ',' + ky + ',' + kz;
    let c = map.get(key);
    if (c === undefined) { c = acc.length / 4; map.set(key, c); acc.push(0, 0, 0, 0); }
    acc[c * 4] += pos[i * 3]; acc[c * 4 + 1] += pos[i * 3 + 1]; acc[c * 4 + 2] += pos[i * 3 + 2]; acc[c * 4 + 3]++;
    remap[i] = c;
  }
  const np = new Float32Array(acc.length / 4 * 3);
  for (let c = 0; c < acc.length / 4; c++) for (let k = 0; k < 3; k++) np[c * 3 + k] = acc[c * 4 + k] / acc[c * 4 + 3];
  const out = [];
  const seen = new Set();
  for (let t = 0; t < idx.length; t += 3) {
    const a = remap[idx[t]], b = remap[idx[t + 1]], c = remap[idx[t + 2]];
    if (a === b || b === c || a === c) continue;
    const k = [a, b, c].sort((x, y) => x - y).join('_');
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(a, b, c);
  }
  return compact({ pos: np, idx: Uint32Array.from(out) });
}

/** Drop unreferenced vertices. */
export function compact(mesh) {
  const used = new Int32Array(mesh.pos.length / 3).fill(-1);
  let n = 0;
  const idx = new Uint32Array(mesh.idx.length);
  const keep = [];
  for (let i = 0; i < mesh.idx.length; i++) {
    const v = mesh.idx[i];
    if (used[v] < 0) { used[v] = n++; keep.push(v); }
    idx[i] = used[v];
  }
  const pos = new Float32Array(n * 3);
  keep.forEach((v, i) => { pos[i * 3] = mesh.pos[v * 3]; pos[i * 3 + 1] = mesh.pos[v * 3 + 1]; pos[i * 3 + 2] = mesh.pos[v * 3 + 2]; });
  return { pos, idx };
}

export function centroid(mesh) {
  const c = [0, 0, 0];
  const n = mesh.pos.length / 3;
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) c[k] += mesh.pos[i * 3 + k];
  return c.map((x) => x / n);
}

export function bbox(mesh) {
  const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (let i = 0; i < mesh.pos.length; i += 3) for (let k = 0; k < 3; k++) {
    const v = mesh.pos[i + k]; if (v < mn[k]) mn[k] = v; if (v > mx[k]) mx[k] = v;
  }
  return { mn, mx };
}

/** Read raw triangles (Float32Array of 9 floats per tri) with an optional centroid predicate (fast, unwelded). */
export function readTris(path, keep) {
  const b = fs.readFileSync(path);
  const n = b.readUInt32LE(80);
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const out = [];
  const t9 = new Float32Array(9);
  for (let t = 0; t < n; t++) {
    const o = 84 + t * 50 + 12;
    for (let k = 0; k < 9; k++) t9[k] = dv.getFloat32(o + k * 4, true);
    if (keep) {
      const c = [(t9[0] + t9[3] + t9[6]) / 3, (t9[1] + t9[4] + t9[7]) / 3, (t9[2] + t9[5] + t9[8]) / 3];
      const nx = (t9[4] - t9[1]) * (t9[8] - t9[2]) - (t9[5] - t9[2]) * (t9[7] - t9[1]);
      const ny = (t9[5] - t9[2]) * (t9[6] - t9[0]) - (t9[3] - t9[0]) * (t9[8] - t9[2]);
      const nz = (t9[3] - t9[0]) * (t9[7] - t9[1]) - (t9[4] - t9[1]) * (t9[6] - t9[0]);
      if (!keep(c, [nx, ny, nz])) continue;
    }
    for (let k = 0; k < 9; k++) out.push(t9[k]);
  }
  return Float32Array.from(out);
}

/** Weld a triangle soup into an indexed mesh. */
export function weld(tris) {
  const map = new Map(); const pos = []; const idx = new Uint32Array(tris.length / 3);
  for (let i = 0; i < tris.length; i += 3) {
    const key = tris[i].toFixed(3) + ',' + tris[i + 1].toFixed(3) + ',' + tris[i + 2].toFixed(3);
    let v = map.get(key); if (v === undefined) { v = pos.length / 3; map.set(key, v); pos.push(tris[i], tris[i + 1], tris[i + 2]); }
    idx[i / 3] = v;
  }
  return { pos: Float32Array.from(pos), idx };
}

/** Area-weighted vertex normals. */
export function normals(mesh) {
  const { pos, idx } = mesh; const nor = new Float32Array(pos.length);
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const i of [a, b, c]) { nor[i] += nx; nor[i + 1] += ny; nor[i + 2] += nz; }
  }
  for (let i = 0; i < nor.length; i += 3) { const l = Math.hypot(nor[i], nor[i + 1], nor[i + 2]) || 1; nor[i] /= l; nor[i + 1] /= l; nor[i + 2] /= l; }
  return nor;
}

/** Cluster-decimate until triangle count <= target. */
export function decimateTo(mesh, target) {
  const tris = mesh.idx.length / 3;
  if (tris <= target) return mesh;
  let cell = Math.sqrt(1 / 1) * 0.8, m = mesh;
  for (let i = 0; i < 40; i++) { m = cluster(mesh, cell); if (m.idx.length / 3 <= target) return m; cell *= 1.15; }
  return m;
}

/** Taubin (lambda|mu) smoothing: removes clustering lumpiness without shrinking the volume. Boundary vertices are held. */
export function taubin(mesh, iters = 8, lambda = 0.5, mu = -0.53) {
  const n = mesh.pos.length / 3; const nbr = Array.from({ length: n }, () => new Set());
  const edgeCount = new Map();
  for (let t = 0; t < mesh.idx.length; t += 3) for (let k = 0; k < 3; k++) {
    const a = mesh.idx[t + k], b = mesh.idx[t + (k + 1) % 3]; nbr[a].add(b); nbr[b].add(a);
    const key = a < b ? `${a}_${b}` : `${b}_${a}`; edgeCount.set(key, (edgeCount.get(key) ?? 0) + 1);
  }
  const boundary = new Uint8Array(n); for (const [k, c] of edgeCount) if (c === 1) { const [a, b] = k.split('_').map(Number); boundary[a] = boundary[b] = 1; }
  const lists = nbr.map((s) => [...s]); let p = Float32Array.from(mesh.pos); const q = new Float32Array(p.length);
  const step = (f) => {
    for (let i = 0; i < n; i++) {
      const l = lists[i]; if (!l.length || boundary[i]) { q[i * 3] = p[i * 3]; q[i * 3 + 1] = p[i * 3 + 1]; q[i * 3 + 2] = p[i * 3 + 2]; continue; }
      let x = 0, y = 0, z = 0; for (const j of l) { x += p[j * 3]; y += p[j * 3 + 1]; z += p[j * 3 + 2]; } x /= l.length; y /= l.length; z /= l.length;
      q[i * 3] = p[i * 3] + f * (x - p[i * 3]); q[i * 3 + 1] = p[i * 3 + 1] + f * (y - p[i * 3 + 1]); q[i * 3 + 2] = p[i * 3 + 2] + f * (z - p[i * 3 + 2]);
    }
    const t = p; p = Float32Array.from(q); void t;
  };
  for (let it = 0; it < iters; it++) { step(lambda); step(mu); }
  return { pos: p, idx: mesh.idx };
}
