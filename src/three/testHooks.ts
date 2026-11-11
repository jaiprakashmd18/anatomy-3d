// Debug/E2E helpers: project scene points to screen pixels so automated tests can drive real mouse input.
import * as THREE from 'three';
import type { LimbModel } from './limb';

export const registry: { model: LimbModel | null; camera: THREE.Camera | null; el: HTMLCanvasElement | null; root: THREE.Object3D | null } = { model: null, camera: null, el: null, root: null };

const toScreen = (v: THREE.Vector3) => {
  const r = registry.el!.getBoundingClientRect(); const p = v.clone().project(registry.camera!);
  return [r.left + ((p.x + 1) / 2) * r.width, r.top + ((1 - p.y) / 2) * r.height];
};
export const testHooks = {
  guideScreen(layer: string, cutId: string) {
    const cut = registry.model?.meta.sheets[layer]?.cuts.find((c) => c.id === cutId); if (!cut || !registry.root) return null;
    registry.root.updateMatrixWorld(true);
    return cut.pts.map((p) => toScreen(new THREE.Vector3(...p).applyMatrix4(registry.model!.root.matrixWorld)));
  },
  meshScreen(name: string) {
    const m = registry.model?.all.find((x) => x.name === name); if (!m) return null; m.geometry.computeBoundingBox();
    registry.model!.root.updateMatrixWorld(true);
    // sample vertices; return one that is the nearest to the camera (so a ray hits it)
    const pos = m.geometry.attributes.position; let best: THREE.Vector3 | null = null, bd = Infinity;
    for (let i = 0; i < pos.count; i += 7) { const v = new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld); const d = v.distanceTo(registry.camera!.position); if (d < bd) { bd = d; best = v; } }
    return best ? toScreen(best.add(registry.camera!.position.clone().sub(best).normalize().multiplyScalar(0.0))) : null;
  },
  structureScreen(id: string) {
    const ms = registry.model?.structureMeshes.get(id); if (!ms) return null; registry.model!.root.updateMatrixWorld(true);
    const box = new THREE.Box3(); ms.forEach((m) => box.expandByObject(m)); return toScreen(box.getCenter(new THREE.Vector3()));
  },
};

export const cameraHooks = {
  setCamera(pos: [number, number, number], target: [number, number, number]) {
    const c = registry.camera as THREE.PerspectiveCamera | null; if (!c) return; c.position.set(...pos);
    const ctl = (window as unknown as { __controls?: { target: THREE.Vector3; update(): void } }).__controls; if (ctl) { ctl.target.set(...target); ctl.update(); } else c.lookAt(...target);
  },
};

export const hitHooks = {
  /** Which structure/layer would a ray through these screen pixels hit first? (E2E debugging) */
  hitAt(x: number, y: number) {
    const m = registry.model; if (!m || !registry.camera || !registry.el) return null;
    const r = registry.el.getBoundingClientRect(); const ray = new THREE.Raycaster(); ray.layers.set(0);
    ray.setFromCamera(new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1), registry.camera);
    const h = ray.intersectObjects(m.all.filter((o) => o.visible), false)[0]; return h ? `${h.object.userData.structure}:${h.object.userData.group ?? ''}` : null;
  },
};
