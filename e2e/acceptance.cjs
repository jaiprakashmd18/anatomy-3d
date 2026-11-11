// End-to-end acceptance driver: real mouse strokes along the guide paths.
const { chromium } = require('playwright');
const OUT = process.argv[2] || 'e2e';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1500, height: 900 } });
  p.on('console', (m) => { if (['error'].includes(m.type())) console.log('console', m.type(), m.text().slice(0, 300)); });
  p.on('pageerror', (e) => console.log('pageerror', e.message.slice(0, 400)));
  await p.goto('http://127.0.0.1:5173/'); await p.waitForTimeout(5000);
  const st = () => p.evaluate(() => { const s = window.__av.useStore.getState(); return { layers: Object.fromEntries(Object.entries(s.hist.present.layers).map(([k, v]) => [k, { cuts: v.cuts.length, m: +v.flap.medial.toFixed(2), l: +v.flap.lateral.toFixed(2) }])), sel: s.selected, toast: s.toast && s.toast.text, log: s.hist.log, retracted: s.hist.present.retracted }; });
  const shot = async (n, wait = 1800) => { await p.waitForTimeout(wait); await p.screenshot({ path: `${OUT}-${n}.png` }); };
  const key = (k) => p.keyboard.press(k);
  // helper: project model-local point -> screen using the app's camera through window hook
  const project = (pts) => p.evaluate((pts) => window.__av.project(pts), pts);
  await p.evaluate(() => window.__av.useStore.getState().requestCamera('anterior')); await shot('0-anterior');
  // trace the guide for a cut using actual mouse events
  const trace = async (layer, cutId, tool) => {
    await key(tool);
    const px = await p.evaluate(([layer, cutId]) => window.__av.guideScreen(layer, cutId), [layer, cutId]);
    if (!px) { console.log('no guide for', cutId); return; }
    const trim = cutId.includes('skin.p') || cutId.includes('skin.d') ? 6 : layer !== 'skin' ? 3 : 0; const pts = px.slice(trim, px.length - trim);
    await p.mouse.move(pts[0][0], pts[0][1]); await p.mouse.down();
    for (const q of pts) await p.mouse.move(q[0], q[1], { steps: 2 });
    await p.mouse.up(); await p.waitForTimeout(300);
    console.log(cutId, JSON.stringify((await st()).toast));
  };
  await trace('skin', 'skin.longitudinal', '1'); await shot('1-longitudinal');
  console.log('RESULT cut1', (await st()).layers.skin.cuts === 1 ? 'PASS' : 'FAIL');
  await trace('skin', 'skin.proximal', '1'); await trace('skin', 'skin.distal', '1'); await shot('2-incised');
  // forceps: grab the lateral flap edge and drag it away; expect a partial lift, then undo it
  await key('3');
  { const g = await p.evaluate(() => window.__av.guideScreen('skin', 'skin.longitudinal')); const mid = g[Math.floor(g.length / 2)];
    await p.mouse.move(mid[0] - 7, mid[1]); await p.mouse.down(); for (let i = 1; i <= 12; i++) await p.mouse.move(mid[0] - 7 - i * 14, mid[1] - i * 2); await p.mouse.up(); await p.waitForTimeout(400);
    const s1 = await st(); console.log('RESULT forceps lift', s1.layers.skin.l > 0.1 || s1.layers.skin.m > 0.1 ? 'PASS' : 'FAIL', JSON.stringify(s1.layers.skin));
    if (s1.layers.skin.l > 0.1 || s1.layers.skin.m > 0.1) { await key('Control+z'); await p.waitForTimeout(500); const s2 = await st(); console.log('RESULT forceps undo', s2.layers.skin.l === 0 && s2.layers.skin.m === 0 && s2.layers.skin.cuts === 3 ? 'PASS' : 'FAIL'); } }
  // reflect with the reflect tool (click on a flap)
  await key('7');
  for (const side of ['skin.medial', 'skin.lateral']) { const c = await p.evaluate((n) => window.__av.meshScreen(n), side); if (c) { await p.mouse.click(c[0], c[1]); await p.waitForTimeout(400); } }
  await shot('3-skin-reflected', 2500); console.log(JSON.stringify(await st())); { const x = await st(); console.log('RESULT skin reflected', x.layers.skin.m === 1 && x.layers.skin.l === 1 ? 'PASS' : 'FAIL'); }
  // ---- superficial fascia
  await trace('superficial_fascia', 'superficial_fascia.longitudinal', '2'); await shot('4-sf-incised');
  await key('6'); { const c = await p.evaluate(() => window.__av.meshScreen('superficial_fascia.medial')); if (c) await p.mouse.click(c[0], c[1]); await p.waitForTimeout(300); const c2 = await p.evaluate(() => window.__av.meshScreen('superficial_fascia.lateral')); if (c2) await p.mouse.click(c2[0], c2[1]); }
  await shot('5-sf-peeled', 2500); console.log('after peel', JSON.stringify((await st()).layers));
  // ---- veins identification
  await key('5'); { const c = await p.evaluate(() => window.__av.meshScreen('cephalic_vein')); if (c) { await p.mouse.click(c[0], c[1]); await p.waitForTimeout(300); console.log('selected', (await st()).sel); } }
  await trace('deep_fascia', 'deep_fascia.longitudinal', '1'); await key('7');
  for (const side of ['deep_fascia.medial', 'deep_fascia.lateral']) { const c = await p.evaluate((n) => window.__av.meshScreen(n), side); if (c) { await p.mouse.click(c[0], c[1]); await p.waitForTimeout(400); } }
  await shot('6-deep-reflected', 2500); console.log('deep', JSON.stringify((await st()).layers));
  await key('5'); { await p.evaluate(() => window.__av.setCamera([42, 4, 46], [2, 5, 0])); await p.waitForTimeout(2500); const c = await p.evaluate(() => window.__av.meshScreen('median_nerve')); if (c) { await p.mouse.click(c[0], c[1]); await p.waitForTimeout(500); console.log('RESULT select median_nerve', (await st()).sel === 'median_nerve' ? 'PASS' : 'FAIL ' + (await st()).sel); } }
  await p.evaluate(() => window.__av.useStore.getState().patch({ rightTab: 'info' })); await shot('7-median-selected', 1200);
  // retract biceps
  await key('4'); { const c = await p.evaluate(() => window.__av.meshScreen('biceps_brachii#37686')); if (c) { await p.mouse.click(c[0], c[1]); await p.waitForTimeout(600); } } await shot('8-biceps-retracted', 2000); console.log('RESULT retract', (await st()).retracted.biceps_brachii === 1 ? 'PASS' : 'FAIL');
  // undo last, save, reset, restore
  await key('Control+z'); await p.waitForTimeout(300); console.log('RESULT undo', JSON.stringify((await st()).retracted) === '{}' ? 'PASS' : 'FAIL');
  await p.evaluate(() => window.__av.useStore.getState().saveSession('e2e'));
  await p.evaluate(() => window.__av.useStore.getState().reset()); { const x = await st(); console.log('RESULT reset', x.layers.skin.cuts === 0 ? 'PASS' : 'FAIL'); }
  await p.evaluate(() => { const s = window.__av.useStore.getState(); s.loadSession(s.sessions[0].id); }); await shot('9-restored', 2500); { const x = await st(); console.log('RESULT restore', x.layers.skin.cuts === 3 && x.layers.deep_fascia.m === 1 ? 'PASS' : 'FAIL'); }
  await b.close();
})();
