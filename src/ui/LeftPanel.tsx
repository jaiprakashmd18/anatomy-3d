import React from 'react';
import { useStore, VIS_KEYS, VisKey, CameraPreset } from '../store/useStore';
import { STRUCTURES } from '../data/structures';
import { LESSON } from '../data/lesson';
import { SYSTEMS } from '../data/coverage';
import * as D from '../engine/dissection';
import { visibilityOf, FID_LABEL } from './util';
import type { StructureInfo } from '../data/types';

const REGIONS: { id: CameraPreset; label: string }[] = [{ id: 'shoulder', label: 'Shoulder' }, { id: 'arm', label: 'Arm (brachium)' }, { id: 'elbow', label: 'Elbow / cubital fossa' }, { id: 'forearm', label: 'Forearm' }, { id: 'hand', label: 'Wrist & hand' }];
const PLANNED = ['Lower limb', 'Thorax', 'Abdomen', 'Pelvis', 'Head & neck', 'Back', 'Brain & spinal cord'];

function matches(s: StructureInfo, q: string) {
  if (!q) return true; const n = q.toLowerCase();
  return [s.name, s.latin ?? '', s.region, s.system, s.compartment, s.kind, ...(s.aliases ?? []), ...(s.fma ?? []).map((f) => `fma${f}`)].some((x) => x.toLowerCase().includes(n));
}

function Structures() {
  const s = useStore(); const d = s.hist.present; const [q, setQ] = React.useState('');
  const groups: [string, (x: StructureInfo) => boolean][] = [
    ['Integument & fascia', (x) => x.kind === 'skin' || x.kind === 'fascia'], ['Muscles', (x) => x.kind === 'muscle'], ['Bones', (x) => x.kind === 'bone'],
    ['Arteries', (x) => x.kind === 'artery'], ['Veins', (x) => x.kind === 'vein'], ['Nerves', (x) => x.kind === 'nerve'],
  ];
  const hits = STRUCTURES.filter((x) => matches(x, q));
  return (
    <div>
      <input className="search" placeholder="Search terminology (e.g. median, brachial, FMA…)" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search anatomical terminology" />
      <small className="muted">{hits.length} of {STRUCTURES.length} records</small>
      {groups.map(([title, f]) => { const items = hits.filter(f); if (!items.length) return null; return (
        <details key={title} open={!!q || title === 'Integument & fascia' || title === 'Nerves'}>
          <summary>{title} <span className="count">{items.length}</span></summary>
          <ul className="tree">{items.map((x) => { const v = visibilityOf(x.id, d); return (
            <li key={x.id}><button className={`row ${s.selected === x.id ? 'on' : ''} v-${v}`} onClick={() => { s.select(x.id); if (v === 'exposed') s.focus(x.id); }} title={`${FID_LABEL[x.fidelity][0]} · ${v}`}>
              <i className={`dot ${FID_LABEL[x.fidelity][1]}`} /><span className="nm">{x.name}</span>
              <span className="vis">{v === 'exposed' ? '●' : v === 'covered' ? '◌' : v === 'removed' ? '✕' : '—'}</span>
            </button></li>); })}</ul>
        </details>); })}
      <p className="legend"><i className="dot ok" /> real mesh <i className="dot warn" /> schematic/synthetic <i className="dot muted" /> info only · ● exposed ◌ covered ✕ removed</p>
    </div>
  );
}

const VIS_LABEL: Record<VisKey, string> = { skin: 'Skin', fascia: 'Fascia', muscle: 'Muscles', bone: 'Bones', nerve: 'Nerves', artery: 'Arteries', vein: 'Veins' };
function Layers() {
  const s = useStore(); const d = s.hist.present;
  return (
    <div>
      <h4>Dissection state</h4>
      <ul className="layerstate">{(['skin', 'superficial_fascia', 'deep_fascia'] as const).map((l) => (<li key={l}><span>{D.LAYER_RULES[l].label}</span><b className={`st-${D.layerStatus(d, l)}`}>{D.layerStatus(d, l)}</b></li>))}
        {Object.entries(d.retracted).filter(([, v]) => v > 0).map(([k]) => <li key={k}><span>{k.replace(/_/g, ' ')}</span><b className="st-lifted">retracted</b></li>)}
        {d.removed.map((k) => <li key={k}><span>{k.replace(/_/g, ' ')}</span><b className="st-removed">removed</b></li>)}</ul>
      <h4>Layer controls</h4>
      {VIS_KEYS.map((k) => (
        <div className="layer" key={k}>
          <label><input type="checkbox" checked={s.layerVisible[k]} onChange={(e) => s.setLayerVisible(k, e.target.checked)} /> {VIS_LABEL[k]}</label>
          <input type="range" min={0.1} max={1} step={0.05} value={s.layerOpacity[k]} onChange={(e) => s.setLayerOpacity(k, +e.target.value)} aria-label={`${VIS_LABEL[k]} opacity`} />
          <button className={`lock ${s.layerLocked[k] ? 'on' : ''}`} onClick={() => s.toggleLock(k)} title={s.layerLocked[k] ? 'Locked: dissection actions blocked' : 'Lock layer'} aria-pressed={s.layerLocked[k]}>{s.layerLocked[k] ? '🔒' : '🔓'}</button>
        </div>))}
      <small className="muted">Visibility/opacity are display settings only; they never change the dissection state. Locking blocks cutting and manipulating that layer.</small>
      <label className="check"><input type="checkbox" checked={s.landmarksOn} onChange={(e) => s.patch({ landmarksOn: e.target.checked })} /> Show surface landmarks</label>
    </div>
  );
}

function Lessons() {
  const s = useStore();
  return (
    <div>
      <div className="card">
        <h4>{LESSON.title}</h4><p>{LESSON.summary}</p>
        <p className="muted">Steps: {LESSON.steps.length} · Status: <b>Fully working</b> (nerve/vessel courses schematic)</p>
        <button className="primary" onClick={() => s.startLesson()}>{s.lessonActive ? 'Restart lesson' : 'Start guided dissection'}</button>
        {s.lessonActive && <button onClick={() => s.stopLesson()}>Exit to free dissection</button>}
      </div>
      <div className="card"><h4>Free dissection</h4><p>Choose any tool from the bottom bar. Supported incision paths appear as dashed guides; unsupported actions are refused with an explanation rather than faked.</p></div>
      <h4>Systemic & regional coverage</h4>
      <ul className="cov">{SYSTEMS.map((r) => (<li key={r.name}><b>{r.name}</b><span className={`tag ${r.status.split(' ')[0].toLowerCase()}`}>{r.status}</span><small>{r.note}</small></li>))}</ul>
    </div>
  );
}

function Regions() {
  const s = useStore();
  return (
    <div>
      <h4>Upper limb (right) — available</h4>
      <div className="stack">{REGIONS.map((r) => <button key={r.id} className="chip wide" onClick={() => s.requestCamera(r.id)}>{r.label}</button>)}</div>
      <h4>Other regions — planned</h4>
      <div className="stack">{PLANNED.map((r) => <button key={r} className="chip wide" disabled>{r} <small>planned</small></button>)}</div>
    </div>
  );
}

export function LeftPanel() {
  const s = useStore();
  const tabs = [['structures', 'Structures'], ['regions', 'Regions'], ['layers', 'Layers'], ['lessons', 'Lessons']] as const;
  return (
    <aside className="panel left" aria-label="Navigation">
      <nav className="tabs">{tabs.map(([id, l]) => <button key={id} className={s.leftTab === id ? 'on' : ''} onClick={() => s.patch({ leftTab: id })}>{l}</button>)}</nav>
      <div className="panel-body">{s.leftTab === 'structures' && <Structures />}{s.leftTab === 'regions' && <Regions />}{s.leftTab === 'layers' && <Layers />}{s.leftTab === 'lessons' && <Lessons />}</div>
    </aside>
  );
}
