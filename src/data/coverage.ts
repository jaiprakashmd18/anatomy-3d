export type Status = 'Fully working' | 'Partially implemented' | 'Demonstration only' | 'Blocked by missing assets' | 'Planned';
export interface Row { name: string; status: Status; note: string }

export const FEATURES: Row[] = [
  { name: '3D viewer: rotate / zoom / pan, camera presets, touch', status: 'Fully working', note: 'Orbit controls; two-finger touch; region presets.' },
  { name: 'Structure selection, highlight, info panel, search', status: 'Fully working', note: 'Raycast picking on real meshes; ~55 structure records (draft, unreviewed).' },
  { name: 'Guided incision (scalpel / scissors)', status: 'Fully working', note: 'Stroke must follow an authored cut path (coverage ≥ 80 %, precision ≥ 85 %). Not freeform cutting.' },
  { name: 'Skin / fascia flap lift and reflection (forceps, reflect, peel, retractor)', status: 'Fully working', note: 'Per-vertex hinge deformation of split flap meshes; forceps drag maps to lift amount.' },
  { name: 'Blunt dissection (Peel)', status: 'Partially implemented', note: 'Only on skin and superficial-fascia planes that are authored; refused for deep fascia.' },
  { name: 'Muscle retraction / removal', status: 'Partially implemented', note: 'Biceps brachii retraction is authored; removal for selected muscles only.' },
  { name: 'Undo / redo / reset / saved sessions', status: 'Fully working', note: 'Snapshot history; sessions saved in browser localStorage (no cloud sync yet).' },
  { name: 'Visibility, opacity, layer locking, isolation', status: 'Fully working', note: 'Per layer-category controls; isolate selected structure.' },
  { name: 'Realistic / Atlas / X-ray modes', status: 'Fully working', note: 'Material presets; X-ray is a transparency visualisation, not radiographic physics.' },
  { name: 'Guided anterior-arm practical (16 steps)', status: 'Fully working', note: 'Each step is auto-checked against real dissection state or selections.' },
  { name: 'Study: MCQs, viva, spotters, bookmarks, notes, revision queue, progress', status: 'Partially implemented', note: '14 MCQs; viva from structure records; spaced revision is a simple interval schedule.' },
  { name: 'AI tutor (local grounded retrieval)', status: 'Partially implemented', note: 'Answers only from loaded content and reports whether a structure is exposed. Optional LLM endpoint (api/tutor.ts) is written but untested.' },
  { name: 'Freeform volumetric cutting', status: 'Planned', note: 'Not implemented; requires volumetric/remeshing pipeline. Not claimed.' },
  { name: 'Soft-tissue physics (PBD/FEM)', status: 'Planned', note: 'Flaps use authored kinematic deformation, not physics.' },
  { name: 'Suction & irrigation', status: 'Planned', note: 'Optional; deprioritised.' },
  { name: 'Accounts, cloud save, Supabase sync', status: 'Planned', note: 'Schema drafted in docs/; not wired.' },
  { name: 'Full-body cadaver on a table', status: 'Blocked by missing assets', note: 'BodyParts3D has a whole-body skeleton/muscle set, but no integrated, dissection-ready body; this build ships a cropped right upper-limb specimen.' },
  { name: 'Offline caching, LODs, mesh compression (Draco/meshopt)', status: 'Planned', note: 'Meshes are vertex-cluster decimated; GLB is uncompressed.' },
];

export const SYSTEMS: Row[] = [
  { name: 'Skin (right upper limb)', status: 'Partially implemented', note: 'Real BodyParts3D skin mesh, cropped; outer-facing triangles only.' },
  { name: 'Superficial & deep fascia', status: 'Demonstration only', note: 'Synthetic sleeves generated from the limb envelope — NOT segmented tissue.' },
  { name: 'Skeleton — shoulder girdle, arm, forearm, carpals, metacarpals', status: 'Partially implemented', note: 'Real meshes (clavicle, scapula, humerus, radius, ulna, 8 carpals, 5 metacarpals). Phalanges and the other ~180 bones are not imported yet.' },
  { name: 'Muscles — shoulder, arm, forearm', status: 'Partially implemented', note: '~36 real muscle meshes. Missing: ECU, hand intrinsics, many trunk muscles, supraspinatus etc. are context only.' },
  { name: 'Median, ulnar, musculocutaneous & cutaneous nerves', status: 'Demonstration only', note: 'Schematic authored courses anchored to the muscle envelope. BodyParts3D has no peripheral nerve meshes.' },
  { name: 'Brachial artery (+radial/ulnar stubs), cephalic, basilic, median cubital veins', status: 'Demonstration only', note: 'Schematic courses; BodyParts3D lacks arm/forearm vessels.' },
  { name: 'Radial nerve', status: 'Blocked by missing assets', note: 'Information record only; no 3D course (deep/posterior).' },
  { name: 'Lymphatics, ligaments, joint capsules, fascia septa, compartments', status: 'Blocked by missing assets', note: 'No segmented meshes available from the current source.' },
  { name: 'Lower limb, thorax, abdomen, head & neck, back, pelvis, brain', status: 'Planned', note: 'Phase 4+; BodyParts3D contains many of these meshes but they are not yet processed.' },
  { name: 'Cardiovascular, respiratory, digestive, urinary, reproductive, endocrine, sensory', status: 'Planned', note: 'Phase 4–5.' },
];
