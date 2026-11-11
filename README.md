# ANATOMYVERSE 3D — virtual dissection lab (right upper limb vertical slice)

A web application for studying anatomy by *dissecting* a 3D specimen layer by layer: incise, lift and reflect skin and fascia, retract muscle, expose and
identify structures, read their anatomy, undo/reset, and save/resume. Built on **real, separated anatomical meshes (BodyParts3D)**.

> **Honest status.** This is the Phase‑1/2 foundation: one module (right upper limb), a real dissection engine, a guided anterior‑arm practical and study tools.
> It is **not** a full‑body atlas, **not** medically validated, and uses **schematic** nerve/vessel courses and **synthetic** fascia because the open source
> meshes contain none. Everything is labelled in the UI (**Coverage** button) and below.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # 33 unit/integration tests (engine, content↔asset integrity, tutor grounding)
npm run build        # type-check + production build into dist/
```

The processed assets (`public/assets/limb.glb` ~17 MB, `limb-meta.json`) are committed, so no Blender or downloads are needed to run the app.

### Rebuild the assets from source (optional)
```bash
# BodyParts3D STL mirror (CC BY-SA 2.1 JP). Only the FMA*.stl files listed in pipeline/limb-config.mjs are needed.
git clone --filter=blob:none --no-checkout https://github.com/Kevin-Mattheus-Moerman/BodyParts3D.git bp3d
# check out assets/BodyParts3D_data/stl/FMA<ids>.stl (see limb-config.mjs), then:
BP3D_DIR=/path/to/bp3d/assets/BodyParts3D_data/stl npm run assets
```
The pipeline (`pipeline/`): reads STL → vertex‑cluster decimation → defines the limb coordinate frame from the humerus/radius/ulna/metacarpals → resamples skin
as a radial height‑field from the real skin shell → generates fascia sleeves → splits each sheet into *fixed / medial flap / lateral flap* meshes → anchors
schematic neurovascular curves → writes GLB + metadata (licence, provenance, cut paths, hinges).

### Deploy
Static site: `npm run build`, then deploy `dist/` to Vercel/Netlify/GitHub Pages (`base` is `./`). Serve `assets/limb.glb` with gzip/brotli (the CDN does this).
`api/tutor.ts` is an **optional, untested** Vercel edge function for an LLM tutor (needs `ANTHROPIC_API_KEY`); without it the built‑in grounded tutor is used.

## Using it (acceptance walk‑through)
1. Rotate: left‑drag; zoom: wheel/pinch; pan: right‑drag/two fingers. **View** buttons: anterior/posterior/lateral/medial; **Regions** tab for shoulder…hand.
2. **Scalpel (1)**: dashed yellow guides appear on the layer being worked on. Drag along a guide; the stroke is validated against the authored path
   (precision ≥ 85 %, cumulative coverage ≥ 80 %; long cuts can be drawn in several strokes while you orbit). Drags that start off the tissue move the camera, so you cannot cut by accident.
3. **Forceps (3)**: press on an incised flap and drag to lift; release to hold. **Reflect (7)** / **Retractor (4)** / **Peel (6, blunt, skin & superficial fascia only)** reflect a whole layer. **Scissors (2)** divides fascia, and removes reflected layers / designated muscles.
4. Repeat for superficial fascia and deep fascia; **Retractor** on biceps retracts it (authored lateral path) to show brachialis and the musculocutaneous nerve.
5. **Probe (5)** (or the Structures list) selects a structure → *Anatomy* tab shows name, relations, innervation, clinical notes, viva questions, references and fidelity badge.
6. **Undo/Redo** (Ctrl+Z / Ctrl+Y), **Reset** (Shift+R, itself undoable), **Save / Resume** (browser localStorage).
7. **Lessons → Start guided dissection**: 17 steps, each auto‑verified against the real dissection state, with *why it matters* explanations and highlighting.

Keyboard: 1‑8 tools · I isolate · Esc deselect · F fullscreen · Ctrl+Z/Y · Shift+R.

## Feature status
| Feature | Status |
|---|---|
| 3D viewer, camera presets, touch, fullscreen, quality settings, FPS counter | **Fully working** |
| Selection / highlight / info panel / search / bookmarks / notes | **Fully working** (content is *draft, unreviewed*) |
| Guided incision (scalpel/scissors on authored paths, multi‑stroke) | **Fully working** — *not* freeform cutting |
| Flap lift / reflection (forceps, reflect, retractor, peel) | **Fully working** (kinematic hinge deformation, not physics) |
| Undo / redo / reset / save‑resume | **Fully working** (localStorage only) |
| Layer visibility / opacity / locking / isolation; realistic, atlas, X‑ray modes | **Fully working** |
| Guided anterior‑arm practical | **Fully working** (neurovascular steps use schematic courses) |
| Muscle retraction / removal | **Partially implemented** (biceps retraction; removal for listed muscles) |
| MCQ, spotter, viva with spaced revision, progress | **Partially implemented** (14 MCQs; local storage) |
| AI tutor | **Partially implemented** (local grounded retrieval; LLM endpoint untested) |
| Median/ulnar/musculocutaneous/cutaneous nerves, brachial artery, cephalic/basilic/median cubital veins | **Demonstration only** — schematic centrelines anchored to the muscle envelope |
| Superficial & deep fascia | **Demonstration only** — synthetic sleeves |
| Radial nerve, lymphatics, ligaments, capsules, septa, compartments | **Blocked by missing assets** |
| Full‑body cadaver on a table | **Blocked by missing assets** (cropped limb specimen; "Place on table" just re‑orients it) |
| Freeform volumetric cutting, soft‑tissue physics (PBD/FEM), suction/irrigation | **Planned** |
| Other regions/systems (lower limb, thorax, abdomen, head & neck, back, pelvis, CNS, viscera, 206 bones) | **Planned** |
| Accounts / Supabase sync / offline cache / LODs / Draco | **Planned** (`docs/supabase-schema.sql` is a draft) |

## What the 3D data really is
* **Real BodyParts3D meshes (CC BY‑SA 2.1 JP)**: 5 bones of the shoulder girdle/arm/forearm, 8 carpals, 5 metacarpals, ~36 muscles (shoulder, arm, forearm; trunk muscles are context only). Decimated by vertex clustering.
* **Skin**: radial height‑field resampled from the outer shell of the real skin mesh over arm+forearm (the source skin mixes inner/outer surfaces and cannot be flapped directly). The hand is not skinned.
* **Synthetic**: superficial and deep fascia sleeves; incision/hinge geometry.
* **Schematic**: all nerves and vessels (positions follow textbook descriptions, anchored to the muscle envelope; courses truncated at the proximal forearm). **They are not segmented anatomy and have not been validated.**
* Absolute scale follows BodyParts3D (adult male); anatomical landmark markers are approximate, derived from mesh extremities.

See `docs/ASSET_EVALUATION.md` (sources, licences, what to evaluate next, paid items) and `docs/REVIEW_CHECKLIST.md` (manual anatomical review).

## Architecture
```
pipeline/   STL → GLB asset pipeline (Node, no deps): limb frame, sheets, curves, GLB writer
src/engine/ pure, tested logic: dissection state machine + history, cut validation, flap math, tutor
src/data/   structure records, lesson, quiz, topics, coverage manifest
src/three/  React‑Three‑Fiber scene, LimbModel (deformation, appearance), pointer/tool interaction
src/ui/     panels, toolbar, modals;  src/store/ Zustand UI + session state
tests/      Vitest (dissection rules, undo/redo, cut validation, flap kinematics, content↔asset integrity, tutor grounding)
e2e/        Playwright acceptance driver (real mouse strokes); needs `playwright` installed
```
Stack deviation: **Vite + React + TypeScript** (static, Vercel‑compatible) instead of Next.js — nothing here needs SSR. Tailwind was replaced by plain CSS variables. Physics: a rigid‑body engine
(Rapier) cannot model deformable tissue or cutting; flaps use authored kinematics, and PBD/FEM are the researched next step for Phase 3.

## Licences
App code: MIT (add a `LICENSE` file before publishing). Derived meshes in `public/assets/`: **CC BY‑SA 2.1 JP** (BodyParts3D) — share‑alike; attribution is displayed in the app.
