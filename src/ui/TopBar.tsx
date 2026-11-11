import React from 'react';
import { useStore, CameraPreset, Mode } from '../store/useStore';

const VIEWS: CameraPreset[] = ['anterior', 'posterior', 'lateral', 'medial'];
export function TopBar({ onToggleLeft, onToggleRight }: { onToggleLeft(): void; onToggleRight(): void }) {
  const s = useStore();
  const fs = () => { if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen?.(); };
  return (
    <header className="topbar">
      <button className="icon-btn mobile-only" onClick={onToggleLeft} aria-label="Toggle left panel">☰</button>
      <div className="brand"><span className="logo">◈</span><b>ANATOMYVERSE</b><span className="brand-sub">3D · Virtual Dissection Lab</span></div>
      <div className="group" role="group" aria-label="View">
        <span className="lbl">View</span>
        {VIEWS.map((v) => <button key={v} className="chip" onClick={() => s.requestCamera(v)}>{v[0].toUpperCase() + v.slice(1)}</button>)}
      </div>
      <div className="group" role="group" aria-label="Visual mode">
        {([['cadaver', 'Realistic cadaver'], ['atlas', 'Anatomical atlas'], ['xray', 'Transparent X-ray']] as [Mode, string][]).map(([m, l]) => (
          <button key={m} className={`chip ${s.mode === m ? 'on' : ''}`} onClick={() => s.setMode(m)} aria-pressed={s.mode === m}>{l}</button>))}
      </div>
      <div className="group hide-sm">
        <button className="chip" onClick={() => s.patch({ orientation: s.orientation === 'anatomical' ? 'table' : 'anatomical' })} title="Lay the specimen on the dissection table">{s.orientation === 'anatomical' ? 'Place on table' : 'Anatomical position'}</button>
        <label className="chip light"><span>Light</span><input type="range" min={0.4} max={1.8} step={0.1} value={s.lightIntensity} onChange={(e) => s.patch({ lightIntensity: +e.target.value })} aria-label="Lighting" /></label>
      </div>
      <div className="spacer" />
      {s.showFps && <span className={`fps ${s.fps < 30 ? 'bad' : ''}`}>{s.fps} fps</span>}
      <select className="chip" value={s.quality} onChange={(e) => s.patch({ quality: e.target.value as never })} aria-label="Graphics quality"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="ultra">Ultra (4K)</option></select>
      <button className="chip" onClick={() => s.patch({ showFps: !s.showFps })} aria-pressed={s.showFps}>FPS</button>
      <button className="chip" onClick={() => s.patch({ modal: 'sessions' })}>Save / Resume</button>
      <button className="chip" onClick={() => s.patch({ modal: 'coverage' })}>Coverage</button>
      <button className="chip" onClick={() => s.patch({ theme: s.theme === 'dark' ? 'light' : 'dark' })} aria-label="Toggle theme">{s.theme === 'dark' ? '☀' : '☾'}</button>
      <button className="chip" onClick={fs} aria-label="Fullscreen">⛶</button>
      <button className="icon-btn mobile-only" onClick={onToggleRight} aria-label="Toggle right panel">ℹ</button>
    </header>
  );
}
