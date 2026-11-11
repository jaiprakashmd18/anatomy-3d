// Fast acceptance subset (no screenshots): retract, undo, reset, save/restore, from a pre-dissected state.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } }); p.setDefaultTimeout(180000);
  await p.goto('http://127.0.0.1:5173/'); await p.waitForTimeout(8000);
  const st = () => p.evaluate(() => { const s = window.__av.useStore.getState(); return { l: s.hist.present.layers, r: s.hist.present.retracted, sel: s.selected, n: s.hist.past.length, sessions: s.sessions.length }; });
  await p.evaluate(() => { const store = window.__av.useStore; const s = store.getState(); const d = JSON.parse(JSON.stringify(s.hist.present));
    for (const [k, cuts] of Object.entries({ skin: ['skin.longitudinal', 'skin.proximal', 'skin.distal'], superficial_fascia: ['superficial_fascia.longitudinal'], deep_fascia: ['deep_fascia.longitudinal'] })) { d.layers[k].cuts = cuts; d.layers[k].flap = { medial: 1, lateral: 1 }; }
    store.setState({ hist: { ...s.hist, present: d } }); window.__av.setCamera([42, 4, 46], [2, 5, 0]); });
  await p.waitForTimeout(2500); await p.keyboard.press('4');
  const c = await p.evaluate(() => window.__av.meshScreen('biceps_brachii#37686')); await p.mouse.click(c[0], c[1]); await p.waitForTimeout(800);
  console.log('RESULT retract biceps', (await st()).r.biceps_brachii === 1 ? 'PASS' : 'FAIL');
  await p.keyboard.press('Control+z'); await p.waitForTimeout(400); console.log('RESULT undo retract', JSON.stringify((await st()).r) === '{}' ? 'PASS' : 'FAIL');
  await p.keyboard.press('Control+y'); await p.waitForTimeout(400); console.log('RESULT redo retract', (await st()).r.biceps_brachii === 1 ? 'PASS' : 'FAIL');
  await p.evaluate(() => window.__av.useStore.getState().saveSession('acc'));
  await p.evaluate(() => window.__av.useStore.getState().reset()); await p.waitForTimeout(300); let x = await st();
  console.log('RESULT reset', x.l.skin.cuts.length === 0 && JSON.stringify(x.r) === '{}' ? 'PASS' : 'FAIL');
  await p.keyboard.press('Control+z'); await p.waitForTimeout(300); x = await st(); console.log('RESULT undo reset', x.l.skin.cuts.length === 3 ? 'PASS' : 'FAIL');
  await p.evaluate(() => window.__av.useStore.getState().reset());
  await p.evaluate(() => { const s = window.__av.useStore.getState(); s.loadSession(s.sessions[0].id); }); await p.waitForTimeout(500); x = await st();
  console.log('RESULT restore saved session', x.l.skin.cuts.length === 3 && x.l.deep_fascia.flap.medial === 1 && x.r.biceps_brachii === 1 ? 'PASS' : 'FAIL');
  // persistence across a page reload (localStorage)
  await p.reload(); await p.waitForTimeout(6000); console.log('RESULT session persists after reload', (await st()).sessions >= 1 ? 'PASS' : 'FAIL');
  console.log('DONE'); await b.close();
})();
