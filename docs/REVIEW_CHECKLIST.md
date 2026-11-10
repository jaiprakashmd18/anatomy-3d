# Manual anatomical review checklist (for a qualified anatomist/educator)

All content is currently `validation: "unreviewed"`. For each structure record in `src/data/structures.ts` verify against a standard text, then set `validation` to `review-requested`/`validated` and record the reviewer.

- [ ] Nomenclature matches Terminologia Anatomica (English/Latin).
- [ ] Origin / insertion / innervation (with root values) / blood supply / action for every muscle.
- [ ] Median nerve: roots, crossing of brachial artery (usual anterior, variants), relation to bicipital aponeurosis, pronator teres heads, no arm branches.
- [ ] Brachial artery: start/end points, branches, relations; ulnar nerve relations in the arm.
- [ ] Musculocutaneous nerve pierces coracobrachialis; lateral antebrachial cutaneous continuation.
- [ ] Cephalic / basilic veins: courses, piercing points (basilic hiatus), median cubital vein pattern variants.
- [ ] Cubital fossa boundaries/contents (TOPICS in `src/data/topics.ts`).
- [ ] Schematic centreline positions (`CURVES` in `pipeline/limb-config.mjs`): θ (angle about the limb axis, + medial) and fractional level (f=0 humeral head → 1 elbow → 2 wrist) agree with a reference atlas. Adjust and rebuild assets.
- [ ] Lesson ordering and rationale (`src/data/lesson.ts`) match your dissection manual (e.g. Grant's Dissector).
- [ ] Clinical statements and viva questions.
- [ ] Skin/fascia incision pattern is acceptable for teaching (T/H‑shaped skin incision; midline fascial incisions are *simplifications*).
- [ ] Quiz answers (`src/data/quiz.ts`).
