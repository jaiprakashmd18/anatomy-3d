import React, { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html, Line, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { LimbModel, updateAppearance } from './limb';
import { useStore, CameraPreset } from '../store/useStore';
import * as D from '../engine/dissection';
import { bestPartial, mergeBits, fraction, COMPLETE_AT } from '../engine/cuts';
import { flapPoint } from '../engine/flap';
import { resample } from '../engine/cuts';
import type { FlapSide, LayerId, Vec3 } from '../engine/types';
import { STRUCTURE_BY_ID } from '../data/structures';
import { LESSON } from '../data/lesson';
import { registry } from './testHooks';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const V = (p: Vec3) => new THREE.Vector3(...p);

// ------------------------------------------------------------------ camera rig
const DIRS: Record<string, Vec3> = { anterior: [0, 0, 1], posterior: [0, 0, -1], lateral: [-1, 0, 0], medial: [1, 0, 0] };
function presetPose(p: CameraPreset, m: LimbModel): { pos: THREE.Vector3; target: THREE.Vector3 } {
  const pts = m.meta.frame.points.map(V);
  const mid = (a: THREE.Vector3, b: THREE.Vector3, t = 0.5) => a.clone().lerp(b, t);
  if (p in DIRS) return { pos: V(DIRS[p]).multiplyScalar(120), target: new THREE.Vector3(0, 0, 0) };
  const front = new THREE.Vector3(8, 4, 1).normalize();
  const spec: Record<string, [THREE.Vector3, number]> = {
    shoulder: [pts[0], 40], arm: [mid(pts[0], pts[1]), 50], elbow: [pts[1], 34], forearm: [mid(pts[1], pts[2]), 48], hand: [pts[3], 30],
  };
  const [t, d] = spec[p]; return { pos: t.clone().add(new THREE.Vector3(0, 0, 1).multiplyScalar(d)), target: t };
  void front;
}

function Rig({ model }: { model: LimbModel }) {
  const { camera } = useThree(); const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3; update(): void } | null;
  const req = useStore((s) => s.cameraRequest); const anim = useRef<{ t: number; fromP: THREE.Vector3; toP: THREE.Vector3; fromT: THREE.Vector3; toT: THREE.Vector3 } | null>(null);
  useEffect(() => {
    if (!req || !controls) return;
    const pose = presetPose(req.preset, model);
    anim.current = { t: 0, fromP: camera.position.clone(), toP: pose.pos, fromT: controls.target.clone(), toT: pose.target };
  }, [req, controls, camera, model]);
  const fr = useStore((s) => s.focusRequest);
  useEffect(() => {
    if (!fr || !controls) return;
    const meshes = model.structureMeshes.get(fr.id) ?? model.sheetMeshes[fr.id as LayerId]; if (!meshes?.length) return;
    const box = new THREE.Box3(); meshes.forEach((m) => box.expandByObject(m));
    const c = box.getCenter(new THREE.Vector3()); model.root.localToWorld(c); const r = Math.max(4, box.getSize(new THREE.Vector3()).length() * 0.7);
    const dir = camera.position.clone().sub(controls.target).normalize();
    anim.current = { t: 0, fromP: camera.position.clone(), toP: c.clone().addScaledVector(dir, r * 2.2 + 8), fromT: controls.target.clone(), toT: c };
  }, [fr, controls, camera, model]);
  useFrame((_, dt) => {
    const a = anim.current; if (!a || !controls) return;
    a.t = Math.min(1, a.t + dt / 0.7); const e = a.t * a.t * (3 - 2 * a.t);
    camera.position.lerpVectors(a.fromP, a.toP, e); controls.target.lerpVectors(a.fromT, a.toT, e); controls.update();
    if (a.t >= 1) anim.current = null;
  });
  return null;
}

/** Convert coverage bits back to polyline runs (for drawing partially completed incisions). */
function cutRuns(c: { pts: Vec3[] }, bits?: boolean[]): Vec3[][] {
  if (!bits) return [];
  const pts = resample(c.pts, 0.45); const runs: Vec3[][] = []; let cur: Vec3[] = [];
  pts.forEach((p, i) => { if (bits[i]) cur.push(p); else { if (cur.length > 1) runs.push(cur); cur = []; } }); if (cur.length > 1) runs.push(cur); return runs;
}
// ------------------------------------------------------------------ specimen
function Specimen({ model }: { model: LimbModel }) {
  const s = useStore();
  const group = useRef<THREE.Group>(null);
  const [lm, setLm] = React.useState<string | null>(null);
  const t0 = useRef(0);
  const highlight = useMemo(() => (s.lessonActive ? LESSON.steps[s.lessonStep]?.highlight ?? [] : []), [s.lessonActive, s.lessonStep]);
  useFrame((st, dt) => {
    const state = useStore.getState();
    model.update(Math.min(dt, 0.05), state.hist.present, state.preview);
    const hl = state.lessonActive ? LESSON.steps[state.lessonStep]?.highlight ?? [] : [];
    updateAppearance(model, { d: state.hist.present, mode: state.mode, xrayOpacity: state.xrayOpacity, layerVisible: state.layerVisible, layerOpacity: state.layerOpacity, selected: state.selected, hovered: state.hovered, isolate: state.isolate, highlight: hl, pulse: 0.5 + 0.5 * Math.sin(st.clock.elapsedTime * 4) });
    if (group.current) {
      const target = state.orientation === 'table' ? -Math.PI / 2 : 0; group.current.rotation.x += (target - group.current.rotation.x) * Math.min(1, dt * 6);
      const ty = state.orientation === 'table' ? -2 : 0; group.current.position.y += (ty - group.current.position.y) * Math.min(1, dt * 6);
    }
    t0.current = st.clock.elapsedTime;
  });
  void highlight;
  const d = s.hist.present;
  const tool = s.tool; const active = D.activeLayer(d);
  const guideCuts = useMemo(() => {
    if (!(tool === 'scalpel' || tool === 'scissors') || !active) return [];
    const rule = D.LAYER_RULES[active]; if (!rule.cutTools.includes(tool) || D.canActOnLayer(d, active)) return [];
    return model.meta.sheets[active].cuts.filter((c) => !d.layers[active].cuts.includes(c.id));
  }, [tool, active, d, model]);
  return (
    <group ref={group}>
      <primitive object={model.root} />
      {guideCuts.map((c) => cutRuns(c, s.cutProgress[c.id]).map((run, i) => (<Line key={`${c.id}-p${i}`} points={run.map(V)} color="#ff3b30" lineWidth={4} />)))}
      {guideCuts.map((c) => (<Line key={c.id} points={c.pts.map(V)} color="#ffd166" lineWidth={3} dashed dashSize={0.7} gapSize={0.45} />))}
      {s.landmarksOn && model.meta.landmarks.map((l) => (
        <group key={l.id} position={l.position as Vec3}>
          <mesh onPointerOver={() => setLm(l.id)} onPointerOut={() => setLm(null)} onPointerDown={(e) => { if (e.button === 0) { e.stopPropagation(); useStore.getState().clickLandmark(l.id); useStore.getState().say(`${l.label}${s.clickedLandmarks.includes(l.id) ? '' : ' — identified'}.`); } }}>
            <sphereGeometry args={[0.45, 12, 12]} /><meshBasicMaterial color={s.clickedLandmarks.includes(l.id) ? '#3ddc97' : '#ff4d8d'} depthTest={false} transparent opacity={0.9} />
          </mesh>
          {(lm === l.id) && <Html center distanceFactor={60} style={{ pointerEvents: 'none' }} position={[0, 1.1, 0]}><span className="lm-label">{l.label.replace(/ \(.*\)/, '')}</span></Html>}
        </group>
      ))}
      {d.pins.map((p, i) => (
        <group key={p.id} position={p.position as Vec3}>
          <mesh><sphereGeometry args={[0.32, 10, 10]} /><meshBasicMaterial color="#ffe14d" depthTest={false} /></mesh>
          <Html center distanceFactor={60} position={[0, 0.9, 0]} style={{ pointerEvents: 'none' }}><span className="pin-label">{i + 1}. {p.label}</span></Html>
        </group>
      ))}
    </group>
  );
}

// ------------------------------------------------------------------ interaction
function Interaction({ model }: { model: LimbModel }) {
  const { gl, camera } = useThree(); const controls = useThree((s) => s.controls) as unknown as { enabled: boolean } | null;
  const ray = useMemo(() => { const r = new THREE.Raycaster(); r.layers.set(0); return r; }, []);
  useEffect(() => { (window as unknown as { __controls?: unknown }).__controls = controls; }, [controls]);
  useEffect(() => { registry.model = model; registry.camera = camera; registry.el = gl.domElement; registry.root = model.root; }, [model, camera, gl]);
  const stroke = useRef<{ pts: Vec3[]; layer: LayerId; line: THREE.Line } | null>(null);
  const grab = useRef<{ layer: LayerId; side: FlapSide; start: number; samples: THREE.Vector2[]; startPx: THREE.Vector2; pid: number } | null>(null);
  const down = useRef<{ x: number; y: number; id: number } | null>(null);
  const pointers = useRef(new Set<number>());
  const lastHover = useRef(0);

  useEffect(() => {
    const el = gl.domElement;
    const ndc = (e: PointerEvent) => { const r = el.getBoundingClientRect(); return new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); };
    const pick = (e: PointerEvent, only?: (m: THREE.Mesh) => boolean) => {
      ray.setFromCamera(ndc(e), camera);
      const meshes = model.all.filter((m) => m.visible && (!only || only(m)));
      let hits = ray.intersectObjects(meshes, false);
      const st = useStore.getState();
      if (st.mode === 'xray' && !only) { const deep = hits.filter((h) => !['skin', 'superficial_fascia', 'deep_fascia'].includes(h.object.userData.structure)); if (deep.length) hits = deep; }
      return hits[0] ?? null;
    };
    const local = (p: THREE.Vector3): Vec3 => { const q = model.root.worldToLocal(p.clone()); return [q.x, q.y, q.z]; };
    const enableCtl = (v: boolean) => { if (controls) controls.enabled = v; };

    const onDown = (e: PointerEvent) => {
      pointers.current.add(e.pointerId);
      if (pointers.current.size > 1) { cancelDrag(); return; }
      if (e.button !== 0) return;
      const st = useStore.getState(); down.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
      const d = st.hist.present;
      if (st.tool === 'scalpel' || st.tool === 'scissors') {
        const layer = D.activeLayer(d); if (!layer) return;
        const hit = pick(e, (m) => m.userData.layer === layer);
        if (!hit) return; // let the camera move
        const rule = D.LAYER_RULES[layer];
        const blockedLocked = st.layerLocked[layer === 'skin' ? 'skin' : 'fascia'];
        if (blockedLocked) { st.say(`${rule.label} is locked — unlock it in the Layers panel.`, false); return; }
        if (!rule.cutTools.includes(st.tool)) { st.say(`${rule.label} is divided with the ${rule.cutTools.join(' or ')}, not the ${st.tool}.`, false); return; }
        const block = D.canActOnLayer(d, layer); if (block) { st.say(block, false); return; }
        enableCtl(false); el.setPointerCapture(e.pointerId);
        const geom = new THREE.BufferGeometry().setFromPoints(Array.from({ length: 800 }, () => new THREE.Vector3()));
        geom.setDrawRange(0, 0);
        const line = new THREE.Line(geom, new THREE.LineBasicMaterial({ color: '#ff3b30', depthTest: false })); line.frustumCulled = false; line.renderOrder = 10; line.raycast = () => {};
        model.root.add(line); stroke.current = { pts: [local(hit.point)], layer, line };
      } else if (st.tool === 'forceps') {
        const hit = pick(e, (m) => m.userData.kind === 'sheet' && (m.userData.group === 'medial' || m.userData.group === 'lateral'));
        if (!hit) return;
        const layer = hit.object.userData.layer as LayerId, side = hit.object.userData.group as FlapSide;
        const cur = d.layers[layer].flap[side]; const probe = D.setFlap(d, layer, side, cur > 0.5 ? cur - 0.01 : cur + 0.01, 'forceps'); // permission/prerequisite probe (setFlap refuses no-ops)
        if (!probe.ok) { st.say(probe.message, false); return; }
        const f = model.flaps[layer][side]!; const lp = model.root.worldToLocal(hit.point.clone());
        let bi = 0, bd = Infinity; for (let i = 0; i < f.orig.length; i += 3) { const dd = (f.orig[i] - lp.x) ** 2 + (f.orig[i + 1] - lp.y) ** 2 + (f.orig[i + 2] - lp.z) ** 2; if (dd < bd) { bd = dd; bi = i; } }
        const base: Vec3 = [f.orig[bi], f.orig[bi + 1], f.orig[bi + 2]];
        const r = el.getBoundingClientRect(); const samples: THREE.Vector2[] = [];
        for (let k = 0; k <= 16; k++) { const w = model.root.localToWorld(V(flapPoint(base, f.setup, k / 16))).project(camera); samples.push(new THREE.Vector2(((w.x + 1) / 2) * r.width + r.left, ((1 - w.y) / 2) * r.height + r.top)); }
        enableCtl(false); el.setPointerCapture(e.pointerId);
        grab.current = { layer, side, start: d.layers[layer].flap[side], samples, startPx: new THREE.Vector2(e.clientX, e.clientY), pid: e.pointerId };
      }
    };

    const onMove = (e: PointerEvent) => {
      const st = useStore.getState();
      if (stroke.current && e.pointerId === down.current?.id) {
        const s = stroke.current; const hit = pick(e, (m) => m.userData.layer === s.layer);
        if (hit) {
          const p = local(hit.point); const last = s.pts[s.pts.length - 1];
          if (Math.hypot(p[0] - last[0], p[1] - last[1], p[2] - last[2]) > 0.25 && s.pts.length < 790) {
            s.pts.push(p); const attr = s.line.geometry.attributes.position as THREE.BufferAttribute; attr.setXYZ(s.pts.length - 1, ...p); attr.needsUpdate = true; s.line.geometry.setDrawRange(0, s.pts.length);
          }
        }
        return;
      }
      if (grab.current && e.pointerId === grab.current.pid) {
        const g = grab.current; const p = new THREE.Vector2(e.clientX, e.clientY);
        // project the pointer onto the handle's screen path (poly-line through sampled lift positions)
        let best = g.start, bd = Infinity;
        for (let i = 0; i < g.samples.length - 1; i++) {
          const a = g.samples[i], b = g.samples[i + 1]; const ab = b.clone().sub(a); const t = Math.max(0, Math.min(1, p.clone().sub(a).dot(ab) / (ab.lengthSq() || 1)));
          const dd = a.clone().addScaledVector(ab, t).distanceTo(p); if (dd < bd) { bd = dd; best = (i + t) / (g.samples.length - 1); }
        }
        st.setPreview(`${g.layer}.${g.side}`, best); return;
      }
      if (e.buttons === 0 && performance.now() - lastHover.current > 40) {
        lastHover.current = performance.now(); const hit = pick(e); const id = hit ? (hit.object.userData.structure as string) : null; st.setHovered(id);
        el.style.cursor = st.tool === 'probe' ? (id ? 'pointer' : 'grab') : id ? 'crosshair' : 'grab';
      }
    };

    const cancelDrag = () => {
      if (stroke.current) { model.root.remove(stroke.current.line); stroke.current.line.geometry.dispose(); stroke.current = null; }
      if (grab.current) { useStore.getState().setPreview(`${grab.current.layer}.${grab.current.side}`, null); grab.current = null; }
      enableCtl(true);
    };

    const onUp = (e: PointerEvent) => {
      pointers.current.delete(e.pointerId);
      const st = useStore.getState(); const dn = down.current; down.current = null;
      if (stroke.current) {
        const s = stroke.current; stroke.current = null; model.root.remove(s.line); s.line.geometry.dispose(); enableCtl(true);
        const d = st.hist.present; const cands = model.meta.sheets[s.layer].cuts.filter((c) => !d.layers[s.layer].cuts.includes(c.id)).map((c) => ({ id: c.id, points: c.pts }));
        if (!cands.length) { st.say('All supported incisions for this layer are already made.', false); return; }
        const sc = bestPartial(s.pts, cands);
        if (!sc) { st.say('That stroke does not follow a supported incision (or is too short). Trace one of the dashed guides.', false); return; }
        const bits = mergeBits(st.cutProgress[sc.cutId], sc.bits); const frac = fraction(bits);
        if (frac < COMPLETE_AT) { useStore.setState({ cutProgress: { ...st.cutProgress, [sc.cutId]: bits } }); st.say(`Incision ${(frac * 100).toFixed(0)}% complete — continue along the guide (you can rotate the camera and draw the rest).`); return; }
        st.apply(D.incise(d, s.layer, sc.cutId, st.tool)); return;
      }
      if (grab.current) {
        const g = grab.current; grab.current = null; enableCtl(true);
        const p = st.preview[`${g.layer}.${g.side}`] ?? g.start; st.setPreview(`${g.layer}.${g.side}`, null);
        if (Math.abs(p - g.start) < 0.01) return;
        st.apply(D.setFlap(st.hist.present, g.layer, g.side, p > 0.97 ? 1 : p < 0.03 ? 0 : p, 'forceps')); return;
      }
      if (!dn || dn.id !== e.pointerId || e.button !== 0) return;
      if (Math.hypot(e.clientX - dn.x, e.clientY - dn.y) > 6) return; // was a camera drag
      clickAction(e);
    };

    const clickAction = (e: PointerEvent) => {
      const st = useStore.getState(); const d = st.hist.present; const hit = pick(e);
      if (!hit) { if (st.tool === 'probe') st.select(null); return; }
      const ud = hit.object.userData as { kind: string; structure: string; layer?: LayerId };
      const sid = ud.structure; const info = STRUCTURE_BY_ID[sid];
      const isSheet = ud.kind === 'sheet';
      // Clicking an already-open sheet (e.g. a reflected skin flap) acts on the layer currently being worked on.
      const act = D.activeLayer(d); const hitLayer = ud.layer;
      const layer = hitLayer && ['incised', 'lifted'].includes(D.layerStatus(d, hitLayer)) ? hitLayer : act && ['incised', 'lifted'].includes(D.layerStatus(d, act)) ? act : hitLayer;
      const lockedKey = info ? (info.kind === 'skin' || info.kind === 'fascia' ? (info.kind === 'skin' ? 'skin' : 'fascia') : info.kind) : null;
      if (lockedKey && st.layerLocked[lockedKey as keyof typeof st.layerLocked] && st.tool !== 'probe' && st.tool !== 'pin') { st.say(`${info.name} is in a locked layer — unlock it in the Layers panel.`, false); return; }
      switch (st.tool) {
        case 'probe': st.select(sid); break;
        case 'pin': st.addPin(local(hit.point), sid); st.select(sid); break;
        case 'scalpel': case 'scissors':
          if (st.tool === 'scissors' && isSheet && layer && D.layerStatus(d, layer) === 'reflected') { st.apply(D.removeLayer(d, layer, 'scissors')); break; }
          if (st.tool === 'scissors' && !isSheet && D.REMOVABLE_MUSCLES.has(sid)) { st.apply(D.removeStructure(d, sid, info.covers, 'scissors')); break; }
          if (isSheet || !D.REMOVABLE_MUSCLES.has(sid)) { st.say(isSheet && layer && D.activeLayer(d) === layer ? 'Drag along a dashed guide to incise (click does not cut).' : 'Nothing to cut here with this tool — drag along a guide, or select another tool.', false); st.select(sid); }
          break;
        case 'forceps': case 'retractor':
          if (D.RETRACTABLE.has(sid) && info) { const cur = d.retracted[sid] ?? 0; st.apply(D.retract(d, sid, cur > 0.5 ? 0 : 1, info.covers, st.tool)); break; }
          if (st.tool === 'retractor' && isSheet && layer) { st.apply(D.reflectLayer(d, layer, 'retractor')); break; }
          if (st.tool === 'forceps' && isSheet) { st.say('With the forceps, press on a flap edge and drag to lift it.', false); break; }
          st.select(sid); break;
        case 'peel': case 'reflect':
          if (isSheet && layer) { st.apply(D.reflectLayer(d, layer, st.tool)); break; }
          st.say(`${st.tool === 'peel' ? 'Peel (blunt dissection)' : 'Reflect'} applies to incised skin and fascial layers, not to ${info?.name ?? 'this structure'}.`, false); st.select(sid); break;
      }
    };

    el.addEventListener('pointerdown', onDown, { capture: true });
    el.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    const onCancel = (e: PointerEvent) => { pointers.current.delete(e.pointerId); cancelDrag(); };
    window.addEventListener('pointercancel', onCancel);
    return () => { cancelDrag(); el.removeEventListener('pointerdown', onDown, { capture: true }); el.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); window.removeEventListener('pointercancel', onCancel); };
  }, [gl, camera, controls, model, ray]);
  return null;
}

// ------------------------------------------------------------------ misc
function Lights() {
  const k = useStore((s) => s.lightIntensity);
  return (<>
    <hemisphereLight args={['#dfe8ff', '#2b2320', 0.32 * k]} />
    <directionalLight position={[30, 50, 70]} intensity={1.05 * k} color="#fff4e6" castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.05} shadow-camera-left={-45} shadow-camera-right={45} shadow-camera-top={45} shadow-camera-bottom={-45} shadow-camera-near={10} shadow-camera-far={220} />
    <directionalLight position={[-50, 10, 40]} intensity={0.35 * k} color="#bcd0ff" />
    <directionalLight position={[0, 20, -80]} intensity={0.45 * k} color="#ffffff" />
  </>);
}

/** Procedural studio environment (no network) for soft reflections on wet tissue. */
function Env() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pm = new THREE.PMREMGenerator(gl); const tex = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = tex; (scene as THREE.Scene & { environmentIntensity: number }).environmentIntensity = 0.5;
    return () => { scene.environment = null; tex.dispose(); pm.dispose(); };
  }, [gl, scene]);
  return null;
}

function FpsProbe() {
  const acc = useRef({ f: 0, t: 0 });
  useFrame((_, dt) => { const a = acc.current; a.f++; a.t += dt; if (a.t >= 0.5) { useStore.setState({ fps: Math.round(a.f / a.t) }); a.f = 0; a.t = 0; } });
  return null;
}

export function Scene({ model }: { model: LimbModel }) {
  const quality = useStore((s) => s.quality); const theme = useStore((s) => s.theme); const orientation = useStore((s) => s.orientation);
  const dpr = quality === 'low' ? 1 : quality === 'medium' ? Math.min(1.5, window.devicePixelRatio) : quality === 'high' ? Math.min(2, window.devicePixelRatio) : Math.min(3, Math.max(2, window.devicePixelRatio));
  return (
    <Canvas shadows={quality === 'high' || quality === 'ultra'} dpr={dpr} camera={{ position: [0, 0, 120], fov: 35, near: 1, far: 600 }} gl={{ antialias: quality !== 'low', stencil: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' }} style={{ touchAction: 'none' }}>
      <color attach="background" args={[theme === 'dark' ? '#10141b' : '#dfe4ec']} />
      <fog attach="fog" args={[theme === 'dark' ? '#10141b' : '#dfe4ec', 160, 420]} />
      <Lights /><Env />
      <Specimen model={model} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, orientation === 'table' ? -6.4 : -42, 0]} receiveShadow>
        <circleGeometry args={[orientation === 'table' ? 90 : 60, 64]} /><meshStandardMaterial color={theme === 'dark' ? '#1b2330' : '#b9c2cf'} metalness={0.55} roughness={0.45} />
      </mesh>
      <ContactShadows position={[0, orientation === 'table' ? -6.3 : -41.9, 0]} opacity={0.5} scale={120} blur={2.5} far={40} />
      <OrbitControls makeDefault enableDamping dampingFactor={0.12} minDistance={8} maxDistance={220} mouseButtons={{ LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }} touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }} />
      <Rig model={model} /><Interaction model={model} /><FpsProbe />
    </Canvas>
  );
}
