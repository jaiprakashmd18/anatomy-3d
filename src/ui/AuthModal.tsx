import React from 'react';
import { useStore } from '../store/useStore';
import { supabase, cloudEnabled, startCheckout, openPortal, deleteAccount } from '../cloud/client';

export function AuthModal() {
  const s = useStore(); const [mode, setMode] = React.useState<'in' | 'up' | 'reset'>('in'); const [email, setEmail] = React.useState(''); const [pw, setPw] = React.useState('');
  const [agree, setAgree] = React.useState(false); const [msg, setMsg] = React.useState<{ t: string; ok: boolean } | null>(null); const [busy, setBusy] = React.useState(false);
  const close = () => s.patch({ modal: null });
  const run = async (fn: () => Promise<void>) => { setBusy(true); setMsg(null); try { await fn(); } catch (e) { setMsg({ t: (e as Error).message, ok: false }); } finally { setBusy(false); } };

  const submit = (e: React.FormEvent) => { e.preventDefault(); void run(async () => {
    if (!supabase) throw new Error('Accounts are not configured on this deployment.');
    if (mode === 'up') {
      if (!agree) throw new Error('Please accept the Terms and Privacy Policy.'); if (pw.length < 8) throw new Error('Use a password of at least 8 characters.');
      const { data, error } = await supabase.auth.signUp({ email, password: pw, options: { emailRedirectTo: location.origin } }); if (error) throw error;
      if (data.session) close(); else setMsg({ t: 'Check your email to confirm your account, then sign in.', ok: true });
    } else if (mode === 'in') { const { error } = await supabase.auth.signInWithPassword({ email, password: pw }); if (error) throw error; close(); }
    else { const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: location.origin }); if (error) throw error; setMsg({ t: 'If that email exists, a reset link is on its way.', ok: true }); }
  }); };
  const google = () => run(async () => { const { error } = await supabase!.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin } }); if (error) throw error; });

  return (
    <div className="modal-bg" onClick={close} role="presentation"><div className="modal narrow" role="dialog" aria-modal="true" aria-label="Account" onClick={(e) => e.stopPropagation()}>
      <button className="x" onClick={close} aria-label="Close">✕</button>
      {s.user ? (<>
        <h3>Your account</h3><p>{s.user.email}</p>
        <p>Plan: <span className={`tag ${s.plan === 'pro' ? 'ok' : 'muted'}`}>{s.plan === 'pro' ? 'Pro' : 'Free'}</span></p>
        <ul className="plan"><li>Free: full dissection lab, lessons, quizzes, local AI-free tutor, cloud-saved dissections</li><li>Pro: AI tutor (grounded, up to 100 questions/day) and priority features</li></ul>
        <div className="actions">
          {s.plan === 'free' ? <button className="primary" disabled={busy} onClick={() => run(async () => { window.location.href = (await startCheckout()).url; })}>Upgrade to Pro</button>
            : <button disabled={busy} onClick={() => run(async () => { window.location.href = (await openPortal()).url; })}>Manage billing</button>}
          <button onClick={() => { void supabase?.auth.signOut(); close(); }}>Sign out</button>
        </div>
        <details><summary>Delete my account</summary><p className="muted">Permanently deletes your account, saved dissections, notes and cancels any subscription.</p>
          <button className="danger-btn" disabled={busy} onClick={() => { if (confirm('Delete your account and all cloud data? This cannot be undone.')) void run(async () => { await deleteAccount(); await supabase?.auth.signOut(); close(); s.say('Account deleted.'); }); }}>Delete account</button></details>
        {msg && <p className={msg.ok ? 'ok-t' : 'bad-t'}>{msg.t}</p>}
      </>) : (<>
        <h3>{mode === 'in' ? 'Sign in' : mode === 'up' ? 'Create your account' : 'Reset password'}</h3>
        {!cloudEnabled && <p className="bad-t">Accounts aren't configured on this deployment (missing Supabase keys). You can keep using the app locally.</p>}
        <form onSubmit={submit}>
          <input type="email" required placeholder="Email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          {mode !== 'reset' && <input type="password" required placeholder="Password" autoComplete={mode === 'up' ? 'new-password' : 'current-password'} value={pw} onChange={(e) => setPw(e.target.value)} />}
          {mode === 'up' && <label className="check"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} /> I accept the <button type="button" className="link" onClick={() => s.patch({ modal: 'legal' })}>Terms & Privacy Policy</button></label>}
          <button className="primary" disabled={busy || !cloudEnabled}>{mode === 'in' ? 'Sign in' : mode === 'up' ? 'Create account' : 'Send reset link'}</button>
        </form>
        {mode !== 'reset' && <button className="google" disabled={busy || !cloudEnabled} onClick={google}>Continue with Google</button>}
        <p className="muted small">{mode === 'in' ? (<>New here? <button className="link" onClick={() => setMode('up')}>Create an account</button> · <button className="link" onClick={() => setMode('reset')}>Forgot password?</button></>) : (<>Already registered? <button className="link" onClick={() => setMode('in')}>Sign in</button></>)}</p>
        {msg && <p className={msg.ok ? 'ok-t' : 'bad-t'}>{msg.t}</p>}
      </>)}
    </div></div>
  );
}

export function LegalModal() {
  const s = useStore(); const close = () => s.patch({ modal: null });
  return (
    <div className="modal-bg" onClick={close} role="presentation"><div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
      <button className="x" onClick={close} aria-label="Close">✕</button>
      <h3>Terms & privacy (template — have a lawyer review before launch)</h3>
      <h4>Educational use only</h4><p>ANATOMYVERSE is a study aid. Content is unreviewed teaching material, parts of the 3D model are schematic or synthetic, and nothing here is medical advice or for clinical decisions.</p>
      <h4>Your data</h4><p>If you create an account we store your email, saved dissections, notes, bookmarks, study progress and (for subscribers) a billing reference. Payments are handled by Stripe; we never see card numbers. Tutor questions are sent to an AI provider to generate answers and are not used to build your profile. You can delete your account and data at any time from Account → Delete account.</p>
      <h4>Subscriptions</h4><p>Pro renews monthly until cancelled in Manage billing; access continues to the end of the paid period.</p>
      <h4>Open-data attribution</h4><p>3D meshes: BodyParts3D, © The Database Center for Life Science, CC BY-SA 2.1 Japan.</p>
    </div></div>
  );
}
