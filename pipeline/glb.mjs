// Tiny glTF 2.0 binary writer: one node+mesh per entry, POSITION/NORMAL float32, indices uint32.
export function writeGLB(entries /* [{name, extras, pos, nor, idx}] */) {
  const chunks = []; let off = 0;
  const views = [], accessors = [], meshes = [], nodes = [];
  const push = (buf) => { const pad = (4 - (buf.byteLength % 4)) % 4; const o = off; chunks.push(Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength)); if (pad) chunks.push(Buffer.alloc(pad)); off += buf.byteLength + pad; return o; };
  for (const e of entries) {
    const minmax = (() => { const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]; for (let i = 0; i < e.pos.length; i += 3) for (let k = 0; k < 3; k++) { const v = e.pos[i + k]; if (v < mn[k]) mn[k] = v; if (v > mx[k]) mx[k] = v; } return { mn, mx }; })();
    const vp = views.push({ buffer: 0, byteOffset: push(e.pos), byteLength: e.pos.byteLength, target: 34962 }) - 1;
    const vn = views.push({ buffer: 0, byteOffset: push(e.nor), byteLength: e.nor.byteLength, target: 34962 }) - 1;
    const vi = views.push({ buffer: 0, byteOffset: push(e.idx), byteLength: e.idx.byteLength, target: 34963 }) - 1;
    const ap = accessors.push({ bufferView: vp, componentType: 5126, count: e.pos.length / 3, type: 'VEC3', min: minmax.mn, max: minmax.mx }) - 1;
    const an = accessors.push({ bufferView: vn, componentType: 5126, count: e.nor.length / 3, type: 'VEC3' }) - 1;
    const ai = accessors.push({ bufferView: vi, componentType: 5125, count: e.idx.length, type: 'SCALAR' }) - 1;
    const m = meshes.push({ name: e.name, primitives: [{ attributes: { POSITION: ap, NORMAL: an }, indices: ai, mode: 4 }] }) - 1;
    nodes.push({ name: e.name, mesh: m, extras: e.extras });
  }
  const json = { asset: { version: '2.0', generator: 'anatomyverse-pipeline' }, scene: 0, scenes: [{ nodes: nodes.map((_, i) => i) }], nodes, meshes, accessors, bufferViews: views, buffers: [{ byteLength: off }] };
  let js = Buffer.from(JSON.stringify(json)); const jp = (4 - (js.length % 4)) % 4; js = Buffer.concat([js, Buffer.alloc(jp, 0x20)]);
  const bin = Buffer.concat(chunks);
  const header = Buffer.alloc(12); header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(12 + 8 + js.length + 8 + bin.length, 8);
  const jh = Buffer.alloc(8); jh.writeUInt32LE(js.length, 0); jh.writeUInt32LE(0x4e4f534a, 4);
  const bh = Buffer.alloc(8); bh.writeUInt32LE(bin.length, 0); bh.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, jh, js, bh, bin]);
}
