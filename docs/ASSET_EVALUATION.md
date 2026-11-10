# 3D anatomy asset evaluation

Status of this document: **partially verified**. Network access in the build environment was limited to GitHub raw content and package registries, so
only BodyParts3D was inspected first-hand. Other entries are *candidates from general knowledge* and **must be verified (licence text, content, quality) before use**.

## Verified first-hand: BodyParts3D (used in this build)

| Item | Finding |
|---|---|
| Source | BodyParts3D 3.0 (20110915), Database Center for Life Science (DBCLS). STL mirror by K. M. Moerman (`Kevin-Mattheus-Moerman/BodyParts3D`, commit `f0eeb6e`), 925 FMA-named STL files plus `parts_list_e.txt`, `FMA.csv` |
| Coverage | One adult male. Skeleton, ~hundreds of muscles (heads/parts separate), skin, many viscera, vessels of the heart/aorta/abdomen, cranial structures. **No peripheral nerves (e.g. median nerve), no arm/forearm arteries or veins (brachial, cephalic, basilic), no fascia, no ligaments/capsules in the files imported** (checked against the parts list: only optic nerves, subclavian/brachiocephalic vessels and abdominal/cardiac vessels exist) |
| Segmentation | One mesh per FMA concept — suitable for identification and layer separation of bones/muscles. Skin is a single whole-body surface that **mixes outer and inner surfaces** (and intersects muscle in v4); it is not a dissection-ready flap mesh |
| Resolution | Variable. Skin 1.59 M triangles; muscles 2–25 k triangles; non-manifold triangles present |
| Format | STL (converted from OBJ by the mirror) |
| Licence | CC BY-SA 2.1 Japan. **Commercial use allowed; attribution required; derivatives must be shared under the same licence (share-alike)** |
| Attribution | "BodyParts3D, © The Database Center for Life Science licensed under CC Attribution-Share Alike 2.1 Japan" (shown in-app); cite Mitsuhashi et al., NAR 2009;37:D782 |
| Suitability for dissection | Good for bones and muscles. **Unsuitable as-is for skin flaps and for neurovascular dissection.** This build resamples the skin shell (see `pipeline/build-assets.mjs`) and draws nerves/vessels as *schematic* curves — both clearly labelled in the UI |
| Accuracy limitations | Muscles are individually modelled but vertex-clustered here (loss of fine detail); no tendon/aponeurosis detail; one body only; not medically validated by us |

## Candidates to evaluate next (NOT verified here)

| Candidate | Why interesting | What must be checked |
|---|---|---|
| Z-Anatomy (open atlas built on BodyParts3D, Blender-based) | Reported to add nerves, vessels, ligaments and extended labels, i.e. exactly what is missing for the arm | Exact licence (believed CC BY-SA family), segmentation of the brachial plexus/median nerve, export format, mesh quality |
| NIH 3D Print Exchange / NIH 3D | Public-domain or open models for some organs/bones | Per-model licence; coverage of limb soft tissue is likely poor |
| Visible Human Project / Visible Korean (segmentations) | Real cadaver cross-sections; high accuracy | Data-use terms, segmentation availability, effort to surface-reconstruct nerves |
| Open Anatomy Project / SPL atlases | Curated, labelled atlases | Licence is believed to be non-commercial (NC); body-part coverage |
| Commercial atlases (e.g. Complete Anatomy, Visible Body, 3D4Medical) | Best coverage | **Do not extract models.** Licensing for redistribution would require a paid agreement |

## Paid resources that may eventually be required
* Commercial-grade dissection-ready limb assets (neurovascular + fascia) if open sources cannot supply them.
* Object storage/CDN beyond free tiers once all regions are exported (est. hundreds of MB).
* Qualified anatomist review time (not a software cost but essential before any "validated" claim).
