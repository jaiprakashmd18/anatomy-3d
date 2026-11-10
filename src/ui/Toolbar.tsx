import React from 'react';
import { useStore } from '../store/useStore';
import type { ToolId } from '../engine/types';
import { Icons } from './icons';

const TOOLS: { id: ToolId; label: string; key: string; tip: string }[] = [
  { id: 'scalpel', label: 'Scalpel', key: '1', tip: 'Drag along a dashed guide to incise (skin, fascia).' },
  { id: 'scissors', label: 'Scissors', key: '2', tip: 'Incise fascia along a guide; click a reflected layer or a muscle to divide/remove it.' },
  { id: 'forceps', label: 'Forceps', key: '3', tip: 'Press on an incised flap edge and drag to lift it.' },
  { id: 'retractor', label: 'Retractor', key: '4', tip: 'Click an incised layer to hold it open, or biceps to retract it.' },
  { id: 'probe', label: 'Probe', key: '5', tip: 'Click to identify any exposed structure.' },
  { id: 'peel', label: 'Peel', key: '6', tip: 'Blunt dissection along authored planes (skin, superficial fascia).' },
  { id: 'reflect', label: 'Reflect', key: '7', tip: 'Click an incised layer to reflect both flaps.' },
  { id: 'pin', label: 'Pin', key: '8', tip: 'Place a named pin on a structure.' },
];

export function Toolbar() {
  const s = useStore();
  const [xr, setXr] = React.useState(false);
  const canUndo = s.hist.past.length > 0, canRedo = s.hist.future.length > 0;
  return (
    <div className="toolbar" role="toolbar" aria-label="Dissection instruments">
      {TOOLS.map((t) => (
        <button key={t.id} className={`tool ${s.tool === t.id ? 'on' : ''}`} onClick={() => s.setTool(t.id)} title={`${t.label} (${t.key}) — ${t.tip}`} aria-pressed={s.tool === t.id}>
          {Icons[t.id]}<span>{t.label}</span><kbd>{t.key}</kbd>
        </button>
      ))}
      <span className="sep" />
      <button className={`tool ${s.isolate ? 'on' : ''}`} disabled={!s.selected} onClick={() => s.patch({ isolate: !s.isolate })} title="Isolate selected structure (I)" aria-pressed={s.isolate}>{Icons.isolate}<span>Isolate</span><kbd>I</kbd></button>
      <div className="pop-wrap">
        <button className={`tool ${xr ? 'on' : ''}`} onClick={() => setXr(!xr)} title="Transparency / opacity" aria-expanded={xr}>{Icons.transparency}<span>Transparency</span></button>
        {xr && (
          <div className="pop" role="dialog" aria-label="Transparency">
            <label>X-ray opacity<input type="range" min={0.1} max={1} step={0.05} value={s.xrayOpacity} onChange={(e) => s.patch({ xrayOpacity: +e.target.value, mode: 'xray' })} /></label>
            <small>Moves to X-ray mode (visualisation only). Per-layer opacity is in Layers.</small>
          </div>
        )}
      </div>
      <span className="sep" />
      <button className="tool" disabled={!canUndo} onClick={s.undo} title="Undo (Ctrl+Z)">{Icons.undo}<span>Undo</span></button>
      <button className="tool" disabled={!canRedo} onClick={s.redo} title="Redo (Ctrl+Y)">{Icons.redo}<span>Redo</span></button>
      <button className="tool danger" onClick={s.reset} title="Reset region (Shift+R)">{Icons.reset}<span>Reset</span></button>
    </div>
  );
}
