import React from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { LimbModel, LimbMeta } from './three/limb';
import { Scene } from './three/Scene';
import { useStore } from './store/useStore';
import { TopBar } from './ui/TopBar';
import { LeftPanel } from './ui/LeftPanel';
import { RightPanel } from './ui/RightPanel';
import { Toolbar } from './ui/Toolbar';
import { Modals } from './ui/Modals';
import { AuthModal, LegalModal } from './ui/AuthModal';
import { useAuthBootstrap } from './cloud/useAuth';
import { STRUCTURE_BY_ID } from './data/structures';
import type { ToolId } from './engine/types';

const base = import.meta.env.BASE_URL;
async function loadModel(onProgress: (p: number) => void): Promise<LimbModel> {
  const metaRes = await fetch(`${base}assets/limb-meta.json`); if (!metaRes.ok) throw new Error(`limb-meta.json: HTTP ${metaRes.status}`);
  const meta = (await metaRes.json()) as LimbMeta;
  const gltf = await new GLTFLoader().loadAsync(`${base}assets/limb.glb`, (e) => e.total && onProgress(e.loaded / e.total));
  return new LimbModel(gltf.scene as THREE.Group, meta);
}

export function App() {
  const [model, setModel] = React.useState<LimbModel | null>(null); const [prog, setProg] = React.useState(0); const [err, setErr] = React.useState<string | null>(null);
  useAuthBootstrap();
  const s = useStore(); const [lOpen, setL] = React.useState(false); const [rOpen, setR] = React.useState(false);
  React.useEffect(() => { loadModel(setProg).then(setModel).catch((e) => setErr(String(e?.message ?? e))); }, []);
  React.useEffect(() => { document.documentElement.dataset.theme = s.theme; }, [s.theme]);
  React.useEffect(() => { // mobile drawers start below the (wrapping) header
    const h = document.querySelector('header.topbar'); if (!h) return; const set = () => document.documentElement.style.setProperty('--hdr', `${h.getBoundingClientRect().height}px`);
    set(); const ro = new ResizeObserver(set); ro.observe(h); return () => ro.disconnect();
  }, []);
  React.useEffect(() => {
    const keys: Record<string, ToolId> = { '1': 'scalpel', '2': 'scissors', '3': 'forceps', '4': 'retractor', '5': 'probe', '6': 'peel', '7': 'reflect', '8': 'pin' };
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement; if (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return;
      const st = useStore.getState();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? st.redo() : st.undo(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); st.redo(); }
      else if (keys[e.key] && !e.ctrlKey) st.setTool(keys[e.key]);
      else if (e.key.toLowerCase() === 'i' && st.selected) st.patch({ isolate: !st.isolate });
      else if (e.key === 'R' && e.shiftKey) st.reset();
      else if (e.key === 'Escape') { st.select(null); st.patch({ isolate: false, tool: 'probe' }); }
      else if (e.key.toLowerCase() === 'f') { if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen?.(); }
    };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, []);
  React.useEffect(() => { if (!s.toast) return; const t = setTimeout(() => useStore.setState({ toast: null }), 5200); return () => clearTimeout(t); }, [s.toast]);
  const hover = s.hovered ? STRUCTURE_BY_ID[s.hovered]?.name : null;
  const [mouse, setMouse] = React.useState({ x: 0, y: 0 });
  return (
    <div className={`app ${lOpen ? 'l-open' : ''} ${rOpen ? 'r-open' : ''}`} onPointerMove={(e) => setMouse({ x: e.clientX, y: e.clientY })}>
      <TopBar onToggleLeft={() => { setL(!lOpen); setR(false); }} onToggleRight={() => { setR(!rOpen); setL(false); }} />
      <LeftPanel />
      <main className="stage" aria-label="3D dissection view">
        {err && <div className="load error" role="alert"><h3>Could not load anatomy assets</h3><p>{err}</p><p>Run <code>npm run assets</code> (see README) or check that <code>public/assets/limb.glb</code> is deployed. The app will not substitute a placeholder model.</p><button className="primary" onClick={() => location.reload()}>Retry</button></div>}
        {!model && !err && <div className="load"><div className="spin" /><p>Loading specimen… {Math.round(prog * 100)}%</p></div>}
        {model && <Scene model={model} />}
        {model && <Toolbar />}
        {s.toast && <div key={s.toast.nonce} className={`toast ${s.toast.ok ? '' : 'err'}`} role="status">{s.toast.text}</div>}
        {hover && s.tool !== 'scalpel' && <div className="tip" style={{ left: mouse.x + 14, top: mouse.y + 14 }}>{hover}</div>}
        <div className="hint hint-desktop">Left-drag: rotate (or cut/lift with an instrument) · right-drag: pan · wheel: zoom</div>
        <div className="touch-hint hint-touch">1 finger: rotate / use instrument · 2 fingers: zoom &amp; pan</div>
        {s.selected && STRUCTURE_BY_ID[s.selected] && <div className="sel-chip"><b>{STRUCTURE_BY_ID[s.selected].name}</b><button onClick={() => { s.patch({ rightTab: 'info' }); setR(true); setL(false); }}>Details</button></div>}
        <div className="attr">BodyParts3D © DBCLS, CC BY-SA 2.1 JP · Educational use · unreviewed content</div>
      </main>
      <div className="backdrop" onClick={() => { setL(false); setR(false); }} />
      <RightPanel />
      {model && <Modals meta={model.meta} />}
      {(s.modal === 'auth' || s.modal === 'account') && <AuthModal />}
      {s.modal === 'legal' && <LegalModal />}
    </div>
  );
}
