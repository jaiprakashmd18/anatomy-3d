import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { LAYER_ORDER, FlapSide, LayerId, Vec3 } from '../engine/types';
import { applyFlap, makeFlap, FlapSetup, retractWeight } from '../engine/flap';
import { STRUCTURE_BY_ID } from '../data/structures';
import { exposed as isExposed, layerStatus } from '../engine/dissection';
import type { DissectionState } from '../engine/types';
import { lookFor } from './palette';
import type { Mode, VisKey } from '../store/useStore';

export interface LimbMeta {
  generated: string; unit: string; source: { name: string; version: string; license: string; attribution: string; citation: string };
  frame: { points: Vec3[]; L0: number; L1: number; uTop: number; uBot: number; hingeThetaDeg: number; reflectAngleDeg: number };
  meshes: { name: string; structure: string; fma?: number; layer: string; sourceTriangles?: number; triangles: number; synthetic?: boolean }[];
  sheets: Record<string, { groups: Record<string, { triangles: number }>; cuts: { id: string; label: string; pts: Vec3[] }[]; hinges: { medial: Vec3[]; lateral: Vec3[] } }>;
  curves: { id: string; kind: 'nerve' | 'artery' | 'vein'; radius: number; points: Vec3[]; mode: string }[];
  landmarks: { id: string; label: string; position: Vec3; method: string }[];
  retract: Record<string, { dir: Vec3; distance: number; axisA: Vec3; axisB: Vec3 }>;
  notes: string[];
}

interface FlapRT { mesh: THREE.Mesh; orig: Float32Array; origN: Float32Array; setup: FlapSetup; cur: number }
interface RetractRT { meshes: { mesh: THREE.Mesh; orig: Float32Array; w: Float32Array }[]; dir: Vec3; distance: number; cur: number }

export const KIND_TO_VIS = (k: string): VisKey => (k === 'fascia' ? 'fascia' : (k as VisKey));

export class LimbModel {
  root = new THREE.Group();
  structureMeshes = new Map<string, THREE.Mesh[]>();
  sheetMeshes: Record<LayerId, THREE.Mesh[]> = { skin: [], superficial_fascia: [], deep_fascia: [] };
  flaps: Record<LayerId, Partial<Record<FlapSide, FlapRT>>> = { skin: {}, superficial_fascia: {}, deep_fascia: {} };
  retract: Record<string, RetractRT> = {};
  incisions = new Map<string, THREE.Mesh>();
  mats = new Map<THREE.Mesh, THREE.MeshStandardMaterial>();
  all: THREE.Mesh[] = [];
  curveMeshes: THREE.Mesh[] = [];
  /** Back-face companions for sheets (dermal / inner surface seen when a flap is reflected). */
  inner = new Map<THREE.Mesh, THREE.Mesh>();

  constructor(public gltfScene: THREE.Group, public meta: LimbMeta) {
    const limbAxis: [Vec3, Vec3] = [meta.frame.points[0], meta.frame.points[3]];
    const maxAngle = (meta.frame.reflectAngleDeg * Math.PI) / 180;
    const nodes: THREE.Mesh[] = [];
    gltfScene.traverse((o) => { if ((o as THREE.Mesh).isMesh) nodes.push(o as THREE.Mesh); });
    for (const m of nodes) {
      const ex = (m.userData ?? {}) as { structure?: string; layer?: string; group?: string };
      m.geometry.computeBoundingSphere();
      const mat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.7, metalness: 0.0 });
      m.material = mat; this.mats.set(m, mat); m.castShadow = false; m.receiveShadow = false;
      // glTF loaders strip '.' and similar characters from node names, so identify meshes by node extras.
      if (ex.structure && (ex as { fma?: number }).fma !== undefined) {
        const sid = ex.structure; m.name = `${sid}#${(ex as { fma?: number }).fma}`; m.userData = { kind: 'structure', structure: sid };
        (this.structureMeshes.get(sid) ?? this.structureMeshes.set(sid, []).get(sid)!).push(m);
      } else if (ex.group && ex.layer) {
        const layer = ex.layer as LayerId, grp = ex.group; m.name = `${layer}.${grp}`; m.userData = { kind: 'sheet', layer, group: grp, structure: layer };
        this.sheetMeshes[layer].push(m);
        const imat = new THREE.MeshStandardMaterial({ side: THREE.BackSide, roughness: 0.8 }); const inner = new THREE.Mesh(m.geometry, imat);
        inner.raycast = () => {}; inner.userData = { kind: 'inner' }; this.inner.set(m, inner); this.root.add(inner); this.mats.set(inner, imat);
        if (grp === 'medial' || grp === 'lateral') {
          const pos = m.geometry.attributes.position as THREE.BufferAttribute; const nor = m.geometry.attributes.normal as THREE.BufferAttribute;
          const hinge = meta.sheets[layer].hinges[grp] as [Vec3, Vec3];
          const orig = Float32Array.from(pos.array as Float32Array);
          this.flaps[layer][grp] = { mesh: m, orig, origN: Float32Array.from(nor.array as Float32Array), setup: makeFlap(orig, hinge, limbAxis, maxAngle), cur: 0 };
          (pos as THREE.BufferAttribute).setUsage(THREE.DynamicDrawUsage); nor.setUsage(THREE.DynamicDrawUsage);
        }
      }
      this.all.push(m); this.root.add(m);
    }
    // schematic neurovascular tubes
    for (const c of meta.curves) {
      const curve = new THREE.CatmullRomCurve3(c.points.map((p) => new THREE.Vector3(...p)), false, 'centripetal');
      const g = new THREE.TubeGeometry(curve, 64, c.radius, 10, false);
      const mat = new THREE.MeshStandardMaterial({ roughness: 0.4 });
      const m = new THREE.Mesh(g, mat); m.name = c.id; m.userData = { kind: 'structure', structure: c.id };
      this.mats.set(m, mat); this.structureMeshes.set(c.id, [m]); this.all.push(m); this.curveMeshes.push(m); this.root.add(m);
    }
    // incision lines
    for (const layer of LAYER_ORDER) for (const cut of meta.sheets[layer].cuts) {
      const curve = new THREE.CatmullRomCurve3(cut.pts.map((p) => new THREE.Vector3(...p)));
      const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(16, cut.pts.length * 2), 0.09, 6, false), new THREE.MeshBasicMaterial({ color: '#3a0906' }));
      mesh.visible = false; mesh.raycast = () => {}; mesh.userData = { kind: 'incision', cut: cut.id, layer };
      this.incisions.set(cut.id, mesh); this.root.add(mesh);
    }
    // retraction
    for (const [sid, r] of Object.entries(meta.retract)) {
      const meshes = (this.structureMeshes.get(sid) ?? []).map((mesh) => {
        const a = mesh.geometry.attributes.position as THREE.BufferAttribute; const orig = Float32Array.from(a.array as Float32Array);
        const w = new Float32Array(orig.length / 3);
        for (let i = 0; i < w.length; i++) w[i] = retractWeight([orig[i * 3], orig[i * 3 + 1], orig[i * 3 + 2]], r.axisA, r.axisB);
        a.setUsage(THREE.DynamicDrawUsage); return { mesh, orig, w };
      });
      this.retract[sid] = { meshes, dir: r.dir, distance: r.distance, cur: 0 };
    }
  }

  /** Smoothly advance deformation toward targets; returns true if anything changed. */
  update(dt: number, d: DissectionState, preview: Record<string, number>): boolean {
    let changed = false;
    for (const layer of LAYER_ORDER) for (const side of ['medial', 'lateral'] as FlapSide[]) {
      const f = this.flaps[layer][side]; if (!f) continue;
      const key = `${layer}.${side}`; const target = key in preview ? preview[key] : d.layers[layer].flap[side];
      const rate = key in preview ? 24 : 7; const diff = target - f.cur;
      if (Math.abs(diff) > 0.0008) {
        f.cur = Math.abs(diff) < 0.003 ? target : f.cur + diff * Math.min(1, dt * rate);
        const pos = f.mesh.geometry.attributes.position as THREE.BufferAttribute, nor = f.mesh.geometry.attributes.normal as THREE.BufferAttribute;
        applyFlap(f.orig, pos.array as Float32Array, f.setup, f.cur, f.origN, nor.array as Float32Array);
        pos.needsUpdate = true; nor.needsUpdate = true; f.mesh.geometry.computeBoundingSphere(); changed = true;
      }
    }
    for (const [sid, r] of Object.entries(this.retract)) {
      const target = d.retracted[sid] ?? 0; const diff = target - r.cur;
      if (Math.abs(diff) > 0.0008) {
        r.cur = Math.abs(diff) < 0.003 ? target : r.cur + diff * Math.min(1, dt * 7);
        for (const { mesh, orig, w } of r.meshes) {
          const a = mesh.geometry.attributes.position as THREE.BufferAttribute; const out = a.array as Float32Array;
          for (let i = 0; i < w.length; i++) { const k = r.distance * w[i] * r.cur; out[i * 3] = orig[i * 3] + r.dir[0] * k; out[i * 3 + 1] = orig[i * 3 + 1] + r.dir[1] * k; out[i * 3 + 2] = orig[i * 3 + 2] + r.dir[2] * k; }
          a.needsUpdate = true; mesh.geometry.computeVertexNormals(); mesh.geometry.computeBoundingSphere();
        }
        changed = true;
      }
    }
    return changed;
  }

  /** Current lift of a flap (for forceps grab handle). */
  flapAmount(layer: LayerId, side: FlapSide) { return this.flaps[layer][side]?.cur ?? 0; }
}

export interface AppearanceCtx {
  d: DissectionState; mode: Mode; xrayOpacity: number; layerVisible: Record<VisKey, boolean>; layerOpacity: Record<VisKey, number>;
  selected: string | null; hovered: string | null; isolate: boolean; highlight: string[]; pulse: number;
}

const sel = new THREE.Color('#2f6bff'), hov = new THREE.Color('#7aa8ff'), hl = new THREE.Color('#ffc247'), none = new THREE.Color('#000000');

/** Push dissection + UI state into materials/visibility/raycast layers. Cheap; safe to call every frame. */
export function updateAppearance(model: LimbModel, c: AppearanceCtx) {
  const isolated = c.isolate && c.selected;
  const setMesh = (m: THREE.Mesh, id: string, kind: string, comp: string, visible: boolean, sheetId?: string) => {
    const mat = model.mats.get(m)!; const look = lookFor(kind as never, comp as never, c.mode, sheetId);
    const vk = KIND_TO_VIS(kind);
    let show = visible && c.layerVisible[vk];
    if (isolated && id !== c.selected) show = false;
    m.visible = show; m.layers.set(show ? 0 : 1);
    const inner = model.inner.get(m); if (inner) { inner.visible = show; inner.layers.set(show ? 0 : 1); }
    if (!show) return;
    const op = look.opacity * (c.mode === 'xray' ? Math.min(1, c.xrayOpacity / 0.35) : 1) * c.layerOpacity[vk];
    mat.color.set(look.color); mat.roughness = look.roughness; mat.opacity = Math.min(1, op);
    const transparent = op < 0.999; if (mat.transparent !== transparent) { mat.transparent = transparent; mat.needsUpdate = true; }
    mat.depthWrite = !(transparent && (c.mode === 'xray' || kind === 'fascia'));
    mat.side = THREE.FrontSide;
    if (inner) {
      const im = model.mats.get(inner)!; const dermis = kind === 'skin' ? (c.mode === 'atlas' ? '#f2b49a' : c.mode === 'xray' ? '#9db7e8' : '#c98e7f') : look.color;
      im.color.set(dermis); im.opacity = mat.opacity; im.transparent = mat.transparent; im.depthWrite = mat.depthWrite; im.roughness = 0.85;
      im.emissive.copy(none); im.emissiveIntensity = 0;
    }
    const isSel = c.selected === id, isHov = c.hovered === id, isHl = c.highlight.includes(id);
    if (isSel) { mat.emissive.copy(sel); mat.emissiveIntensity = 0.55; }
    else if (isHl) { mat.emissive.copy(hl); mat.emissiveIntensity = 0.25 + 0.3 * c.pulse; }
    else if (isHov) { mat.emissive.copy(hov); mat.emissiveIntensity = 0.28; }
    else { mat.emissive.copy(none); mat.emissiveIntensity = 0; }
  };
  for (const [sid, meshes] of model.structureMeshes) {
    const info = STRUCTURE_BY_ID[sid]; if (!info) { meshes.forEach((m) => (m.visible = false)); continue; }
    const vis = !c.d.removed.includes(sid) && (c.mode === 'xray' || isExposed(c.d, info.covers));
    for (const m of meshes) setMesh(m, sid, info.kind, info.compartment, vis);
  }
  for (const layer of LAYER_ORDER) {
    const st = layerStatus(c.d, layer); const info = STRUCTURE_BY_ID[layer];
    const vis = st !== 'removed' && (c.mode === 'xray' || LAYER_ORDER.slice(0, LAYER_ORDER.indexOf(layer)).every((l) => ['reflected', 'removed'].includes(layerStatus(c.d, l))));
    for (const m of model.sheetMeshes[layer]) setMesh(m, layer, info.kind, info.compartment, vis, layer);
    // incision grooves: show while the flaps are still closed
    const f = model.flaps[layer]; const closed = (f.medial?.cur ?? 0) < 0.04 && (f.lateral?.cur ?? 0) < 0.04;
    for (const cut of model.meta.sheets[layer].cuts) {
      const line = model.incisions.get(cut.id)!; const done = c.d.layers[layer].cuts.includes(cut.id);
      const show = done && closed && st !== 'removed' && c.layerVisible[layer === 'skin' ? 'skin' : 'fascia'] && vis;
      line.visible = show;
    }
  }
}
