import { create } from 'zustand';
import * as D from '../engine/dissection';
import type { ActionResult, FlapSide, LayerId, ToolId, Vec3, Pin } from '../engine/types';
import { STRUCTURE_BY_ID } from '../data/structures';
import { LESSON } from '../data/lesson';
import { saveCloudSession, deleteCloudSession, pushUserState } from '../cloud/sync';
import type { Plan } from '../shared/plan';

export type Mode = 'cadaver' | 'atlas' | 'xray';
export type VisKey = 'skin' | 'fascia' | 'muscle' | 'bone' | 'nerve' | 'artery' | 'vein';
export type CameraPreset = 'anterior' | 'posterior' | 'medial' | 'lateral' | 'shoulder' | 'arm' | 'elbow' | 'forearm' | 'hand';
export type Quality = 'low' | 'medium' | 'high' | 'ultra';
export const VIS_KEYS: VisKey[] = ['skin', 'fascia', 'muscle', 'bone', 'nerve', 'artery', 'vein'];

export interface SavedSession { id: string; name: string; savedAt: string; history: D.History }
export interface Toast { text: string; ok: boolean; nonce: number }

const LS = 'anatomyverse.v1';
const safe = {
  get<T>(k: string, d: T): T { try { const v = localStorage.getItem(`${LS}.${k}`); return v ? (JSON.parse(v) as T) : d; } catch { return d; } },
  set(k: string, v: unknown) { try { localStorage.setItem(`${LS}.${k}`, JSON.stringify(v)); } catch { /* storage unavailable */ } },
};

interface UIState {
  hist: D.History;
  tool: ToolId;
  mode: Mode;
  xrayOpacity: number;
  selected: string | null;
  hovered: string | null;
  isolate: boolean;
  layerVisible: Record<VisKey, boolean>;
  layerOpacity: Record<VisKey, number>;
  layerLocked: Record<VisKey, boolean>;
  cutProgress: Record<string, boolean[]>; // cumulative stroke coverage per authored cut (transient, not part of undo history)
  preview: Record<string, number>; // `${layer}.${side}` -> live forceps amount (not in history)
  toast: Toast | null;
  cameraRequest: { preset: CameraPreset; nonce: number } | null;
  cameraVisits: CameraPreset[];
  focusRequest: { id: string; nonce: number } | null;
  orientation: 'anatomical' | 'table';
  lightIntensity: number;
  quality: Quality;
  showFps: boolean;
  theme: 'dark' | 'light';
  landmarksOn: boolean;
  clickedLandmarks: string[];
  identified: string[];
  lessonActive: boolean;
  lessonStep: number;
  lessonQuizDone: boolean;
  leftTab: 'regions' | 'structures' | 'layers' | 'lessons';
  rightTab: 'info' | 'lesson' | 'tutor' | 'study' | 'history';
  modal: 'coverage' | 'sessions' | 'auth' | 'account' | 'legal' | null;
  user: { id: string; email: string } | null;
  plan: Plan;
  authReady: boolean;
  bookmarks: string[];
  notes: Record<string, string>;
  sessions: SavedSession[];
  progress: { lessonDone: Record<string, boolean>; quizBest: number; viewed: string[] };
  loadError: string | null;
  fps: number;
}

interface Actions {
  setTool(t: ToolId): void;
  setMode(m: Mode): void;
  select(id: string | null, identify?: boolean): void;
  setHovered(id: string | null): void;
  apply(r: ActionResult): ActionResult;
  perform(fn: (s: D.History['present']) => ActionResult): ActionResult;
  setPreview(key: string, v: number | null): void;
  undo(): void; redo(): void; reset(): void;
  say(text: string, ok?: boolean): void;
  requestCamera(p: CameraPreset): void;
  focus(id: string): void;
  patch(p: Partial<UIState>): void;
  setLayerVisible(k: VisKey, v: boolean): void;
  setLayerOpacity(k: VisKey, v: number): void;
  toggleLock(k: VisKey): void;
  toggleBookmark(id: string): void;
  setNote(id: string, text: string): void;
  clickLandmark(id: string): void;
  saveSession(name: string): void;
  loadSession(id: string): void;
  deleteSession(id: string): void;
  startLesson(): void;
  stopLesson(): void;
  addPin(p: Vec3, structureId: string): void;
  recordQuiz(score: number): void;
}

const flags = <T,>(v: T): Record<VisKey, T> => ({ skin: v, fascia: v, muscle: v, bone: v, nerve: v, artery: v, vein: v });
let nonce = 0;

export const useStore = create<UIState & Actions>((set, get) => ({
  hist: D.newHistory(), tool: 'probe', mode: 'cadaver', xrayOpacity: 0.35, selected: null, hovered: null, isolate: false,
  layerVisible: flags(true), layerOpacity: flags(1), layerLocked: flags(false), cutProgress: {}, preview: {}, toast: null, cameraRequest: null, cameraVisits: [], focusRequest: null,
  orientation: 'anatomical', lightIntensity: 1, quality: safe.get<Quality>('quality', 'medium'), showFps: false, theme: safe.get('theme', 'dark'), landmarksOn: true, clickedLandmarks: [],
  identified: [], lessonActive: false, lessonStep: 0, lessonQuizDone: false, leftTab: 'structures', rightTab: 'info', modal: null,
  bookmarks: safe.get('bookmarks', []), notes: safe.get('notes', {}), sessions: safe.get('sessions', []),
  progress: safe.get('progress', { lessonDone: {}, quizBest: 0, viewed: [] }), loadError: null, fps: 0, user: null, plan: 'free', authReady: false,

  setTool: (tool) => set({ tool, preview: {} }),
  setMode: (mode) => set({ mode }),
  select: (id, identify = true) => set((s) => {
    const identified = id && identify && !s.identified.includes(id) ? [...s.identified, id] : s.identified;
    const viewed = id && !s.progress.viewed.includes(id) ? [...s.progress.viewed, id] : s.progress.viewed;
    const progress = { ...s.progress, viewed }; safe.set('progress', progress);
    return { selected: id, identified, progress, rightTab: id && !s.lessonActive ? 'info' : s.rightTab };
  }),
  setHovered: (hovered) => set((s) => (s.hovered === hovered ? s : { hovered })),
  say: (text, ok = true) => set({ toast: { text, ok, nonce: ++nonce } }),
  apply(r) {
    if (r.ok) set((s) => ({ hist: D.commit(s.hist, r), preview: {}, cutProgress: {} }));
    set({ toast: { text: r.message, ok: r.ok, nonce: ++nonce } });
    return r;
  },
  perform(fn) { return get().apply(fn(get().hist.present)); },
  setPreview: (key, v) => set((s) => { const p = { ...s.preview }; if (v === null) delete p[key]; else p[key] = v; return { preview: p }; }),
  undo: () => { set((s) => ({ hist: D.undo(s.hist), preview: {}, cutProgress: {} })); get().say('Undid last dissection action.'); },
  redo: () => { set((s) => ({ hist: D.redo(s.hist), preview: {}, cutProgress: {} })); get().say('Redid dissection action.'); },
  reset: () => { set((s) => ({ hist: D.reset(s.hist), preview: {}, cutProgress: {}, isolate: false })); get().say('Region reset to the intact specimen (undo restores the dissection).'); },
  requestCamera: (preset) => set((s) => ({ cameraRequest: { preset, nonce: ++nonce }, cameraVisits: s.cameraVisits.includes(preset) ? s.cameraVisits : [...s.cameraVisits, preset] })),
  focus: (id) => set({ focusRequest: { id, nonce: ++nonce } }),
  patch: (p) => { set(p as never); if ('theme' in p) safe.set('theme', p.theme); if ('quality' in p) safe.set('quality', p.quality); },
  setLayerVisible: (k, v) => set((s) => ({ layerVisible: { ...s.layerVisible, [k]: v } })),
  setLayerOpacity: (k, v) => set((s) => ({ layerOpacity: { ...s.layerOpacity, [k]: v } })),
  toggleLock: (k) => set((s) => ({ layerLocked: { ...s.layerLocked, [k]: !s.layerLocked[k] } })),
  toggleBookmark: (id) => set((s) => { const bookmarks = s.bookmarks.includes(id) ? s.bookmarks.filter((b) => b !== id) : [...s.bookmarks, id]; safe.set('bookmarks', bookmarks); queueMicrotask(syncUserState); return { bookmarks }; }),
  setNote: (id, text) => set((s) => { const notes = { ...s.notes, [id]: text }; safe.set('notes', notes); queueMicrotask(syncUserState); return { notes }; }),
  clickLandmark: (id) => set((s) => ({ clickedLandmarks: s.clickedLandmarks.includes(id) ? s.clickedLandmarks : [...s.clickedLandmarks, id] })),
  saveSession(name) {
    const s = get(); const sess: SavedSession = { id: `s${Date.now()}`, name: name || `Dissection ${s.sessions.length + 1}`, savedAt: new Date().toISOString(), history: JSON.parse(JSON.stringify(s.hist)) };
    const sessions = [sess, ...s.sessions].slice(0, 20); safe.set('sessions', sessions); set({ sessions });
    if (s.user) saveCloudSession(sess, s.user.id).then(() => get().say(`Saved "${sess.name}" to your account.`)).catch(() => get().say(`Saved "${sess.name}" on this device; cloud save failed.`, false));
    else get().say(`Saved "${sess.name}" on this device (sign in to keep it in the cloud).`);
  },
  loadSession(id) {
    const sess = get().sessions.find((x) => x.id === id); if (!sess) return get().say('Saved session not found.', false);
    set({ hist: JSON.parse(JSON.stringify(sess.history)), preview: {}, cutProgress: {}, modal: null }); get().say(`Restored "${sess.name}".`);
  },
  deleteSession: (id) => { if (get().user) void deleteCloudSession(id); set((s) => { const sessions = s.sessions.filter((x) => x.id !== id); safe.set('sessions', sessions); return { sessions }; }); },
  startLesson: () => set({ lessonActive: true, lessonStep: 0, lessonQuizDone: false, rightTab: 'lesson', identified: [], clickedLandmarks: [], cameraVisits: [], hist: D.newHistory(), selected: null }),
  stopLesson: () => set({ lessonActive: false }),
  addPin(p, structureId) {
    const s = get(); const name = STRUCTURE_BY_ID[structureId]?.name ?? structureId;
    const pin: Pin = { id: `p${Date.now()}`, structureId, position: p, label: name };
    get().apply(D.addPin(s.hist.present, pin));
  },
  recordQuiz: (score) => set((s) => { const progress = { ...s.progress, quizBest: Math.max(s.progress.quizBest, score) }; safe.set('progress', progress); queueMicrotask(syncUserState); return { progress, lessonQuizDone: s.lessonActive ? true : s.lessonQuizDone }; }),
}));

// ---------- derived helpers ----------
export const dissection = () => useStore.getState().hist.present;
export const lessonStepsDone = (s: UIState) => LESSON.steps.filter((st) => st.done({ d: s.hist.present, identified: s.identified, landmarks: s.clickedLandmarks, camera: s.cameraVisits, selected: s.selected })).length;
export type { LayerId, FlapSide };

let syncTimer: ReturnType<typeof setTimeout> | undefined;
/** Debounced push of bookmarks/notes/progress to the signed-in user's cloud row. */
export function syncUserState() {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    const s = useStore.getState(); if (!s.user) return;
    let revision: unknown = {}; try { revision = JSON.parse(localStorage.getItem('anatomyverse.v1.revision') ?? '{}'); } catch { /* ignore */ }
    void pushUserState(s.user.id, { bookmarks: s.bookmarks, notes: s.notes, progress: s.progress, revision }).catch(() => undefined);
  }, 1500);
}
