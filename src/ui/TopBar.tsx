import React from 'react';
import { useStore, CameraPreset, Mode } from '../store/useStore';

const VIEWS: CameraPreset[] = ['anterior', 'posterior', 'lateral', 'medial'];
const MODES: [Mode, string, string][] = [['cadaver', 'Realistic cadaver', 'Cadaver'], ['atlas', 'Anatomical atlas', 'Atlas'], ['xray', 'Transparent X-ray', 'X-ray']];
const cap = (v: string) => v[0].toUpperCase() + v.slice(1);

/** Secondary controls: shown inline on wide screens, inside the "⋯" menu on narrow ones. */
function Extras() {
  const s = useStore();
  const fs = () => { if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen?.(); };
  return (<>
    <button className="chip" onClick={() => s.patch({ orientation: s.orientation === 'anatomical' ? 'table' : 'anatomical' })} title="Lay the specimen on the dissection table">{s.orientation === 'anatomical' ? 'Place on table' : 'Anatomical position'}</button>
    <label className="chip light"><span>Light</span><input type="range" min={0.4} max={1.8} step={0.1} value={s.lightIntensity} onChange={(e) => s.patch({ lightIntensity: +e.target.value })} aria-label="Lighting" /></label>
    <select className="chip" value={s.quality} onChange={(e) => s.patch({ quality: e.target.value as never })} aria-label="Graphics quality"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="ultra">Ultra (4K)</option></select>
    <button className="chip" onClick={() => s.patch({ showFps: !s.showFps })} aria-pressed={s.showFps}>FPS</button>
    <button className="chip" onClick={() => s.patch({ modal: 'sessions' })}>Save / Resume</button>
    <button className="chip" onClick={() => s.patch({ modal: 'coverage' })}>Coverage</button>
    <button className="chip" onClick={() => s.patch({ theme: s.theme === 'dark' ? 'light' : 'dark' })} aria-label="Toggle theme">{s.theme === 'dark' ? '☀ Light mode' : '☾ Dark mode'}</button>
    <button className="chip" onClick={fs} aria-label="Fullscreen">⛶ Fullscreen</button>
  </>);
}

export function TopBar({ onToggleLeft, onToggleRight }: { onToggleLeft(): void; onToggleRight(): void }) {
  const s = useStore(); const [menu, setMenu] = React.useState(false);
  React.useEffect(() => { if (!menu) return; const h = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(false); window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [menu]);
  return (
    <header className="topbar">
      <button className="icon-btn nav-only" onClick={onToggleLeft} aria-label="Open navigation panel">☰</button>
      <div className="brand"><span className="logo">◈</span><b>ANATOMYVERSE</b><span className="brand-sub">3D · Virtual Dissection Lab</span></div>

      <div className="group wide-only" role="group" aria-label="View"><span className="lbl">View</span>{VIEWS.map((v) => <button key={v} className="chip" onClick={() => s.requestCamera(v)}>{cap(v)}</button>)}</div>
      <div className="group wide-only" role="group" aria-label="Visual mode">{MODES.map(([m, l]) => <button key={m} className={`chip ${s.mode === m ? 'on' : ''}`} onClick={() => s.setMode(m)} aria-pressed={s.mode === m}>{l}</button>)}</div>

      <div className="spacer" />
      {s.showFps && <span className={`fps ${s.fps < 30 ? 'bad' : ''}`}>{s.fps} fps</span>}

      <select className="chip narrow-only" aria-label="View" value="" onChange={(e) => e.target.value && s.requestCamera(e.target.value as CameraPreset)}><option value="">View…</option>{VIEWS.map((v) => <option key={v} value={v}>{cap(v)}</option>)}</select>
      <select className="chip narrow-only" aria-label="Visual mode" value={s.mode} onChange={(e) => s.setMode(e.target.value as Mode)}>{MODES.map(([m, , short]) => <option key={m} value={m}>{short}</option>)}</select>

      <button className={`chip ${s.user ? 'on' : ''}`} onClick={() => s.patch({ modal: s.user ? 'account' : 'auth' })} aria-label="Account">{s.user ? `${s.plan === 'pro' ? '★ ' : ''}${s.user.email.split('@')[0]}` : 'Sign in'}</button>
      <div className="pop-wrap">
        <button className="icon-btn" onClick={() => setMenu(!menu)} aria-label="More options" aria-expanded={menu}>⋯</button>
        {menu && <><div className="menu-bg" onClick={() => setMenu(false)} /><div className="menu" role="menu" onClick={() => setMenu(false)}><Extras /></div></>}
      </div>
      <button className="icon-btn nav-only" onClick={onToggleRight} aria-label="Open details panel">ℹ</button>
    </header>
  );
}
