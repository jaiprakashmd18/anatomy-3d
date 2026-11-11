import React from 'react';
import { useStore } from '../store/useStore';
import { FEATURES, SYSTEMS } from '../data/coverage';
import type { LimbMeta } from '../three/limb';

export function Modals({ meta }: { meta: LimbMeta }) {
  const s = useStore(); const [name, setName] = React.useState('');
  if (s.modal !== 'sessions' && s.modal !== 'coverage') return null;
  const close = () => s.patch({ modal: null });
  return (
    <div className="modal-bg" onClick={close} role="presentation">
      <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <button className="x" onClick={close} aria-label="Close">✕</button>
        {s.modal === 'sessions' && (<>
          <h3>Save & resume dissection</h3>{s.user ? <small className="muted">Synced to your account.</small> : <small className="muted">Saved on this device only — <button className="link" onClick={() => s.patch({ modal: 'auth' })}>sign in</button> to sync across devices.</small>}
          <form className="row-form" onSubmit={(e) => { e.preventDefault(); s.saveSession(name); setName(''); }}><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Session name" /><button className="primary">Save current dissection</button></form>
          {s.sessions.length === 0 ? <p className="muted">No saved sessions yet. Saves stay on this device until you sign in; then they sync to your account.</p> : <ul className="sessions">{s.sessions.map((x) => (<li key={x.id}><div><b>{x.name}</b><small>{new Date(x.savedAt).toLocaleString()} · {x.history.log.length} actions</small></div><div><button onClick={() => s.loadSession(x.id)}>Restore</button><button onClick={() => s.deleteSession(x.id)}>Delete</button></div></li>))}</ul>}
        </>)}
        {s.modal === 'coverage' && (<>
          <h3>Coverage, status & honesty report</h3>
          <p className="muted">Every feature and structure group is labelled <b>Fully working</b>, <b>Partially implemented</b>, <b>Demonstration only</b>, <b>Blocked by missing assets</b> or <b>Planned</b>. Nothing here has been medically validated.</p>
          <h4>Features</h4><ul className="cov">{FEATURES.map((r) => (<li key={r.name}><b>{r.name}</b><span className={`tag ${r.status.split(' ')[0].toLowerCase()}`}>{r.status}</span><small>{r.note}</small></li>))}</ul>
          <h4>Anatomy coverage</h4><ul className="cov">{SYSTEMS.map((r) => (<li key={r.name}><b>{r.name}</b><span className={`tag ${r.status.split(' ')[0].toLowerCase()}`}>{r.status}</span><small>{r.note}</small></li>))}</ul>
          <h4>Asset source & licence</h4>
          <p>{meta.source.attribution}. {meta.source.version}. Licence: {meta.source.license} — derived meshes in this app are shared under the same licence.</p>
          <p className="muted">{meta.source.citation}</p>
          <ul>{meta.notes.map((n) => <li key={n}>{n}</li>)}</ul>
          <p className="muted">Generated {meta.generated}. Meshes: {meta.meshes.length} · triangles: {meta.meshes.reduce((a, m) => a + m.triangles, 0).toLocaleString()}.</p>
        </>)}
      </div>
    </div>
  );
}
