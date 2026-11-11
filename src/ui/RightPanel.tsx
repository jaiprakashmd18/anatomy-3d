import React from 'react';
import { useStore } from '../store/useStore';
import { STRUCTURE_BY_ID, STRUCTURES } from '../data/structures';
import { LESSON } from '../data/lesson';
import { MCQS } from '../data/quiz';
import { TOPICS } from '../data/topics';
import { tutorAnswer, TutorCtx } from '../engine/tutor';
import * as D from '../engine/dissection';
import { visibilityOf, coveringLabels, FID_LABEL } from './util';
import { askTutor, cloudEnabled } from '../cloud/client';

const Field = ({ label, children }: { label: string; children?: React.ReactNode }) => (children ? <div className="field"><h5>{label}</h5><div>{children}</div></div> : null);
const Bul = ({ items }: { items: string[] }) => (items.length ? <ul>{items.map((i, k) => <li key={k}>{i}</li>)}</ul> : null);

function Info() {
  const s = useStore(); const d = s.hist.present; const info = s.selected ? STRUCTURE_BY_ID[s.selected] : null;
  const [show, setShow] = React.useState<number | null>(null);
  if (!info) return <div className="empty"><h4>Nothing selected</h4><p>Use the Probe (5) and click an exposed structure, or pick one from the Structures list. Structures only become clickable once the layers covering them are dissected.</p></div>;
  const v = visibilityOf(info.id, d); const [fl, fc] = FID_LABEL[info.fidelity]; const marked = s.bookmarks.includes(info.id);
  return (
    <div className="info">
      <header><h3>{info.name}</h3>{info.latin && <i>{info.latin}</i>}</header>
      <div className="badges"><span className={`tag ${fc}`}>{fl}</span><span className="tag muted">Content: {info.validation === 'unreviewed' ? 'draft · unreviewed' : info.validation}</span><span className={`tag ${v === 'exposed' ? 'ok' : 'muted'}`}>{v === 'exposed' ? 'exposed' : v === 'covered' ? `covered by ${coveringLabels(info.id, d).join(', ')}` : v}</span></div>
      <div className="actions">
        <button onClick={() => s.focus(info.id)} disabled={v === 'not-modelled'}>Focus</button>
        <button className={s.isolate ? 'on' : ''} onClick={() => s.patch({ isolate: !s.isolate })} disabled={v === 'not-modelled'}>Isolate</button>
        <button className={marked ? 'on' : ''} onClick={() => s.toggleBookmark(info.id)}>{marked ? '★ Bookmarked' : '☆ Bookmark'}</button>
        {D.RETRACTABLE.has(info.id) && v === 'exposed' && <button onClick={() => s.apply(D.retract(d, info.id, (d.retracted[info.id] ?? 0) > 0.5 ? 0 : 1, info.covers, 'retractor'))}>{(d.retracted[info.id] ?? 0) > 0.5 ? 'Release' : 'Retract'}</button>}
      </div>
      <Field label="Region / system">{info.region} · {info.compartment} · {info.system}</Field>
      <Field label="Description">{info.description}</Field>
      <Field label="Position">{info.position}</Field>
      <Field label="Relationships"><Bul items={info.relations} /></Field>
      <Field label="Function">{info.function}</Field>
      <Field label="Origin">{info.origin}</Field><Field label="Insertion">{info.insertion}</Field><Field label="Action">{info.action}</Field>
      <Field label="Blood supply">{info.bloodSupply}</Field><Field label="Innervation">{info.innervation}</Field>
      <Field label="Clinical anatomy"><Bul items={info.clinical} /></Field>
      <Field label="Common injuries / disorders"><Bul items={info.injuries} /></Field>
      <Field label="Dissection identification tips"><Bul items={info.tips} /></Field>
      <Field label="Viva questions">{info.viva.map((q, i) => (<div key={i} className="viva"><button onClick={() => setShow(show === i ? null : i)}>{q}</button></div>))}{show !== null && <small className="muted">Answer from the content above — try before reading.</small>}</Field>
      <Field label="Reference sources"><Bul items={info.refs} /></Field>
      <Field label="Personal note"><textarea value={s.notes[info.id] ?? ''} onChange={(e) => s.setNote(info.id, e.target.value)} placeholder="Your notes (saved in this browser)" rows={3} /></Field>
    </div>
  );
}

function LessonPanel() {
  const s = useStore();
  const ctx = { d: s.hist.present, identified: s.identified, landmarks: s.clickedLandmarks, camera: s.cameraVisits, selected: s.selected };
  if (!s.lessonActive) return <div className="empty"><h4>No lesson running</h4><p>Open the <b>Lessons</b> tab on the left and start the guided anterior-arm dissection, or continue in free dissection.</p><button className="primary" onClick={() => s.startLesson()}>Start anterior arm lesson</button></div>;
  const steps = LESSON.steps; const done = steps.map((st) => (st.id === 'quiz' ? s.lessonQuizDone : st.done(ctx)));
  const cur = steps[s.lessonStep]; const curDone = cur.id === 'quiz' ? s.lessonQuizDone : cur.done(ctx);
  return (
    <div className="lesson">
      <h4>{LESSON.title}</h4>
      <div className="bar"><i style={{ width: `${(done.filter(Boolean).length / steps.length) * 100}%` }} /></div>
      <small className="muted">{done.filter(Boolean).length} of {steps.length} steps verified against the dissection state</small>
      <div className={`step ${curDone ? 'done' : ''}`}>
        <h5>Step {s.lessonStep + 1}/{steps.length}: {cur.title} {curDone && <span className="tag ok">complete</span>}</h5>
        <p>{cur.instruction}</p><p className="why"><b>Why it matters:</b> {cur.why}</p>
        {cur.tool && <p className="muted">Suggested tool: <b>{cur.tool}</b></p>}<p className="muted">Hint: {cur.hint}</p>
        {cur.id === 'quiz' && <button className="primary" onClick={() => s.patch({ rightTab: 'study' })}>Open quiz</button>}
        <div className="actions"><button disabled={s.lessonStep === 0} onClick={() => s.patch({ lessonStep: s.lessonStep - 1 })}>← Back</button><button className={curDone ? 'primary' : ''} disabled={s.lessonStep === steps.length - 1} onClick={() => s.patch({ lessonStep: s.lessonStep + 1 })}>{curDone ? 'Next →' : 'Skip →'}</button></div>
      </div>
      <ol className="steps">{steps.map((st, i) => <li key={st.id} className={`${done[i] ? 'done' : ''} ${i === s.lessonStep ? 'cur' : ''}`}><button onClick={() => s.patch({ lessonStep: i })}>{st.title}</button></li>)}</ol>
    </div>
  );
}

function Tutor() {
  const s = useStore(); const d = s.hist.present;
  const [log, setLog] = React.useState<{ who: 'me' | 'ai'; text: string; sources?: string[] }[]>([{ who: 'ai', text: 'I am a grounded anatomy tutor. I answer only from the loaded anatomy records, and I tell you whether a structure is actually exposed in your dissection. Ask e.g. "Explain the median nerve" or "Ask me five viva questions about the cubital fossa".' }]);
  const [q, setQ] = React.useState(''); const end = React.useRef<HTMLDivElement>(null);
  const ctx: TutorCtx = React.useMemo(() => ({
    selected: s.selected, lessonStep: s.lessonActive ? LESSON.steps[s.lessonStep].id : null, mode: s.mode,
    layersCovering: (id) => coveringLabels(id, d), visibility: (id) => visibilityOf(id, d),
    exposedIds: STRUCTURES.filter((x) => visibilityOf(x.id, d) === 'exposed').map((x) => x.id),
  }), [s.selected, s.lessonActive, s.lessonStep, s.mode, d]);
  const [busy, setBusy] = React.useState(false);
  const push = (m: { who: 'me' | 'ai'; text: string; sources?: string[] }[]) => { setLog((l) => [...l, ...m]); setTimeout(() => end.current?.scrollIntoView({ behavior: 'smooth' }), 30); };
  const ask = async (text: string) => {
    if (!text.trim() || busy) return; setQ('');
    const local = tutorAnswer(text, ctx);
    if (!(cloudEnabled && s.user && s.plan === 'pro')) { // free / signed-out: grounded local tutor (no LLM)
      push([{ who: 'me', text }, { who: 'ai', text: local.text, sources: local.sources }]); return;
    }
    setBusy(true); push([{ who: 'me', text }]);
    try {
      const covering = Object.fromEntries(STRUCTURES.map((x) => [x.id, coveringLabels(x.id, d)]));
      const r = await askTutor({ question: text, selected: s.selected, exposed: ctx.exposedIds, covering, removed: d.removed });
      push([{ who: 'ai', text: r.answer, sources: local.sources }]);
    } catch (e) { push([{ who: 'ai', text: `AI tutor unavailable (${(e as Error).message}). Grounded answer instead:\n\n${local.text}`, sources: local.sources }]); }
    finally { setBusy(false); }
  };
  const quick = ['What structure is beneath this muscle?', 'Explain the median nerve', 'Why is the radial nerve clinically important?', 'What is the blood supply of this muscle?', 'How do I identify the brachial artery?', 'Ask me five viva questions about the cubital fossa'];
  return (
    <div className="tutor">
      <div className="plan-note">{s.plan === 'pro' && s.user ? <small className="ok-t">★ Pro: AI tutor active (grounded in the app's anatomy records).</small> : <small className="muted">Using the built-in grounded tutor. {cloudEnabled ? <><button className="link" onClick={() => s.patch({ modal: s.user ? 'account' : 'auth' })}>{s.user ? 'Upgrade to Pro' : 'Sign in'}</button> for the AI tutor.</> : 'AI tutor needs a configured deployment.'}</small>}</div>
      <div className="ctx"><small>Context: {s.selected ? STRUCTURE_BY_ID[s.selected]?.name : 'no selection'} · layers: {['skin', 'superficial_fascia', 'deep_fascia'].map((l) => `${l.replace('_', ' ')} ${D.layerStatus(d, l as never)}`).join(', ')}{s.lessonActive ? ` · step: ${LESSON.steps[s.lessonStep].title}` : ''}</small></div>
      <div className="chat" aria-live="polite">{log.map((m, i) => (<div key={i} className={`msg ${m.who}`}><pre>{m.text}</pre>{m.sources && m.sources.length > 0 && <small>Sources: {m.sources.join(' · ')}</small>}</div>))}<div ref={end} /></div>
      <div className="quick">{quick.map((x) => <button key={x} className="chip" onClick={() => void ask(x)}>{x}</button>)}</div>
      <form onSubmit={(e) => { e.preventDefault(); void ask(q); }}><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask about a structure, region or step…" aria-label="Ask the tutor" /><button className="primary" disabled={busy}>{busy ? '…' : 'Ask'}</button></form>
    </div>
  );
}

// ------------------------------------------------ study
const REV = 'anatomyverse.v1.revision';
type Rev = Record<string, { due: string; interval: number }>;
const loadRev = (): Rev => { try { return JSON.parse(localStorage.getItem(REV) ?? '{}'); } catch { return {}; } };
const saveRev = (r: Rev) => { try { localStorage.setItem(REV, JSON.stringify(r)); } catch { /* ignore */ } };

function Study() {
  const s = useStore(); const d = s.hist.present;
  const [tab, setTab] = React.useState<'quiz' | 'spot' | 'viva' | 'marks' | 'progress'>('quiz');
  return (
    <div className="study">
      <nav className="subtabs">{(['quiz', 'spot', 'viva', 'marks', 'progress'] as const).map((t) => <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{{ quiz: 'MCQ', spot: 'Spotter', viva: 'Viva', marks: 'Bookmarks', progress: 'Progress' }[t]}</button>)}</nav>
      {tab === 'quiz' && <Quiz />}
      {tab === 'spot' && <Spotter d={d} />}
      {tab === 'viva' && <Viva />}
      {tab === 'marks' && (<div>{s.bookmarks.length ? s.bookmarks.map((id) => <button key={id} className="row" onClick={() => s.select(id)}>{STRUCTURE_BY_ID[id]?.name ?? id}</button>) : <p className="muted">Bookmark structures from the Info tab.</p>}</div>)}
      {tab === 'progress' && (<div><p>Structures viewed: <b>{s.progress.viewed.length}</b> / {STRUCTURES.length}</p><p>Best MCQ score: <b>{s.progress.quizBest}</b> / {MCQS.length}</p><p>Identified this lesson: <b>{s.identified.length}</b></p><p className="muted">Progress is stored in this browser only.</p></div>)}
    </div>
  );
}

function Quiz() {
  const s = useStore(); const [idx, setIdx] = React.useState(0); const [pick, setPick] = React.useState<number | null>(null); const [score, setScore] = React.useState(0); const [fin, setFin] = React.useState(false);
  const order = React.useMemo(() => [...MCQS].sort(() => Math.random() - 0.5).slice(0, 8), [fin]); // eslint-disable-line react-hooks/exhaustive-deps
  if (fin) return <div><h4>Score: {score} / {order.length}</h4><button className="primary" onClick={() => { s.recordQuiz(score); setIdx(0); setScore(0); setPick(null); setFin(false); }}>Save score & restart</button></div>;
  const q = order[idx];
  return (
    <div>
      <small className="muted">Question {idx + 1} of {order.length}</small><h4>{q.q}</h4>
      {q.options.map((o, i) => (<button key={i} className={`opt ${pick !== null ? (i === q.answer ? 'right' : i === pick ? 'wrong' : '') : ''}`} disabled={pick !== null} onClick={() => { setPick(i); if (i === q.answer) setScore(score + 1); }}>{o}</button>))}
      {pick !== null && <div className="explain"><p>{q.explain}</p><button className="primary" onClick={() => { if (idx + 1 >= order.length) setFin(true); else { setIdx(idx + 1); setPick(null); } }}>{idx + 1 >= order.length ? 'Finish' : 'Next'}</button></div>}
    </div>
  );
}

function Spotter({ d }: { d: ReturnType<typeof useStore.getState>['hist']['present'] }) {
  const s = useStore(); const pool = STRUCTURES.filter((x) => visibilityOf(x.id, d) === 'exposed' && x.fidelity !== 'info-only' && x.kind !== 'skin' && x.kind !== 'fascia');
  const [target, setTarget] = React.useState<string | null>(null); const [res, setRes] = React.useState('');
  if (pool.length < 3) return <p className="muted">Dissect further to unlock spotters — at least 3 exposed structures are needed (currently {pool.length}).</p>;
  const next = () => { setTarget(pool[Math.floor(Math.random() * pool.length)].id); setRes(''); s.select(null); };
  return (
    <div>
      <p>Click the named structure in the 3D view (Probe tool).</p>
      {target ? <h4>Find: {STRUCTURE_BY_ID[target].name}</h4> : <button className="primary" onClick={next}>Start spotter</button>}
      {target && <div className="actions"><button className="primary" onClick={() => setRes(s.selected === target ? '✓ Correct' : s.selected ? `✗ You selected ${STRUCTURE_BY_ID[s.selected]?.name}` : 'Select a structure first')}>Check</button><button onClick={next}>Next</button></div>}
      {res && <p className={res.startsWith('✓') ? 'ok-t' : 'bad-t'}>{res}</p>}
    </div>
  );
}

function Viva() {
  const [rev, setRev] = React.useState<Rev>(loadRev); const [show, setShow] = React.useState(false); const [k, setK] = React.useState(0);
  const items = React.useMemo(() => [...STRUCTURES.flatMap((s) => s.viva.map((q, i) => ({ key: `${s.id}:${i}`, q, id: s.id }))), ...TOPICS.flatMap((t) => t.viva.map((q, i) => ({ key: `${t.id}:${i}`, q, id: t.id })))], []);
  const now = Date.now(); const due = items.filter((it) => !rev[it.key] || new Date(rev[it.key].due).getTime() <= now);
  const cur = due[k % Math.max(1, due.length)];
  const rate = (g: 'again' | 'good' | 'easy') => {
    if (!cur) return; const prev = rev[cur.key]?.interval ?? 0; const interval = g === 'again' ? 1 : g === 'good' ? Math.max(3, prev * 2) : Math.max(7, prev * 3);
    const r = { ...rev, [cur.key]: { interval, due: new Date(now + interval * 86400000).toISOString() } }; setRev(r); saveRev(r); setShow(false); setK(k + 1);
  };
  if (!cur) return <p>No viva questions due. 🎉 Revisit later.</p>;
  const info = STRUCTURE_BY_ID[cur.id]; const topic = TOPICS.find((t) => t.id === cur.id);
  return (
    <div><small className="muted">{due.length} due · {items.length} total · {info?.name ?? topic?.name}</small><h4>{cur.q}</h4>
      {!show ? <button className="primary" onClick={() => setShow(true)}>Show reference answer</button> : (<div className="explain"><p>{topic ? topic.text : [info.description, info.relations.join(' '), info.clinical.join(' ')].join(' ')}</p><div className="actions"><button onClick={() => rate('again')}>Again (1d)</button><button onClick={() => rate('good')}>Good</button><button onClick={() => rate('easy')}>Easy</button></div></div>)}
    </div>
  );
}

function History() {
  const s = useStore(); const h = s.hist;
  return (<div><div className="actions"><button onClick={s.undo} disabled={!h.past.length}>Undo</button><button onClick={s.redo} disabled={!h.future.length}>Redo</button><button onClick={s.reset}>Reset region</button></div>
    <h4>Dissection history</h4>{h.log.length ? <ol className="log">{h.log.map((l, i) => <li key={i}>{l}</li>)}</ol> : <p className="muted">No actions yet.</p>}
    {h.future.length > 0 && <small className="muted">{h.future.length} action(s) available to redo.</small>}
    <h4>Pins</h4>{h.present.pins.length ? <ol>{h.present.pins.map((p) => <li key={p.id}>{p.label} <button className="link" onClick={() => s.apply(D.removePin(h.present, p.id))}>remove</button></li>)}</ol> : <p className="muted">Use the Pin tool (8).</p>}</div>);
}

export function RightPanel() {
  const s = useStore();
  const tabs = [['info', 'Anatomy'], ['lesson', 'Lesson'], ['tutor', 'AI tutor'], ['study', 'Study'], ['history', 'History']] as const;
  return (
    <aside className="panel right" aria-label="Details">
      <nav className="tabs">{tabs.map(([id, l]) => <button key={id} className={s.rightTab === id ? 'on' : ''} onClick={() => s.patch({ rightTab: id })}>{l}</button>)}</nav>
      <div className="panel-body">{s.rightTab === 'info' && <Info />}{s.rightTab === 'lesson' && <LessonPanel />}{s.rightTab === 'tutor' && <Tutor />}{s.rightTab === 'study' && <Study />}{s.rightTab === 'history' && <History />}</div>
    </aside>
  );
}
