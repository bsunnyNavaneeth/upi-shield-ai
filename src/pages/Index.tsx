import { useEffect, useRef, useState, type FormEvent } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';
import { Activity, ArrowRight, Bell, Check, ChevronDown, CircleHelp, Clock3, ExternalLink, FileImage, Globe2, History, Link2, LockKeyhole, LogOut, Menu, MessageSquareWarning, ScanLine, Shield, ShieldAlert, ShieldCheck, Sparkles, Upload, X } from 'lucide-react';

type Risk = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
type Analysis = { id: string; input_type: 'text' | 'url' | 'image'; risk_score: number; risk_level: Risk; summary: string; indicators: string[]; created_at: string };
const apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '');

function localSignals(value: string) {
  const lower = value.toLowerCase();
  const signals: string[] = [];
  if (/\b(otp|upi pin|cvv|password|verify account|urgent|immediately|refund|reward|prize)\b/.test(lower)) signals.push('Message uses urgency or requests sensitive information');
  if (/\b(send|scan|pay)\b.{0,35}\b(receive|refund|cashback|reward)\b/.test(lower)) signals.push('Payment request is framed as a way to receive money');
  const urls = value.match(/https?:\/\/[^\s)]+/gi) ?? [];
  for (const raw of urls) {
    try {
      const url = new URL(raw);
      if (url.protocol !== 'https:') signals.push('Link does not use HTTPS');
      if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(url.hostname)) signals.push('Link uses a numeric IP address');
      if (url.hostname.startsWith('xn--')) signals.push('Domain uses punycode encoding');
      if (url.hostname.split('.').length > 4) signals.push('Link has an unusually deep subdomain');
      if (/login|verify|wallet|payment|secure|claim/i.test(url.hostname) && /[a-z0-9-]{12,}/i.test(url.hostname)) signals.push('Domain combines account-related terms with an unusual name');
    } catch { signals.push('A link could not be parsed safely'); }
  }
  const distinct = [...new Set(signals)];
  const score = Math.min(96, distinct.length * 27 + (urls.length ? 8 : 0));
  return { score, signals: distinct };
}

const levelFor = (score: number): Risk => score <= 30 ? 'LOW' : score <= 60 ? 'MEDIUM' : score <= 80 ? 'HIGH' : 'CRITICAL';
const recommendations: Record<Risk, string> = {
  LOW: 'No major suspicious signals detected. Continue standard safety practices.',
  MEDIUM: 'Review the message and recipient carefully before taking action.',
  HIGH: 'Pause and independently verify the sender through a trusted channel.',
  CRITICAL: 'Do not proceed until the request has been independently verified.'
};
const riskClass: Record<Risk, string> = { LOW: 'low', MEDIUM: 'medium', HIGH: 'high', CRITICAL: 'critical' };

export default function Index() {
  const [user, setUser] = useState<User | null>(null);
  const [content, setContent] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Analysis | null>(null);
  const [history, setHistory] = useState<Analysis[]>([]);
  const [authOpen, setAuthOpen] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) { setHistory([]); return; }
    supabase.from('analyses').select('*').order('created_at', { ascending: false }).limit(8)
      .then(({ data, error }) => { if (!error && data) setHistory(data as Analysis[]); });
  }, [user]);

  async function runAnalysis() {
    if (!content.trim() && !file) { setNotice('Paste a message or URL, or choose an image first.'); return; }
    if (content.length > 10000) { setNotice('Please keep pasted content under 10,000 characters.'); return; }
    if (file && (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024)) { setNotice('Choose an image under 5 MB.'); return; }
    setBusy(true); setNotice(''); setResult(null);
    try {
      let analysis: Analysis;
      if (apiBase) {
        const body = new FormData();
        body.append('text', content.trim());
        if (file) body.append('file', file);
        const response = await fetch(`${apiBase}/api/urls/analyze`, { method: 'POST', body });
        if (!response.ok) throw new Error('The analysis service could not process this request.');
        const data = await response.json();
        const score = Math.max(0, Math.min(100, Number(data.risk_score)));
        analysis = { id: crypto.randomUUID(), input_type: file ? 'image' : /https?:\/\//i.test(content) ? 'url' : 'text', risk_score: score, risk_level: levelFor(score), summary: data.summary ?? recommendations[levelFor(score)], indicators: Array.isArray(data.indicators) ? data.indicators : [], created_at: new Date().toISOString() };
      } else {
        if (file) throw new Error('Image analysis needs the connected AI service. Set VITE_API_BASE_URL to your FastAPI endpoint; the image will not be analyzed locally.');
        const { score, signals } = localSignals(content);
        const level = levelFor(score);
        analysis = { id: crypto.randomUUID(), input_type: /https?:\/\//i.test(content) ? 'url' : 'text', risk_score: score, risk_level: level, summary: recommendations[level], indicators: signals.length ? signals : ['No strong indicators matched the local checks'], created_at: new Date().toISOString() };
      }
      setResult(analysis);
      if (user) {
        const { error } = await supabase.from('analyses').insert({ user_id: user.id, input_type: analysis.input_type, risk_score: analysis.risk_score, risk_level: analysis.risk_level, summary: analysis.summary, indicators: analysis.indicators });
        if (error) setNotice('Result ready, but could not save to your account.');
        else setHistory(current => [analysis, ...current].slice(0, 8));
      }
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Analysis failed. Please try again.'); }
    finally { setBusy(false); }
  }

  async function authenticate(event: FormEvent) {
    event.preventDefault(); setAuthBusy(true); setAuthError('');
    const response = isRegister
      ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: new URL('/auth/callback', window.location.origin).href } })
      : await supabase.auth.signInWithPassword({ email, password });
    setAuthBusy(false);
    if (response.error) setAuthError(response.error.message);
    else if (isRegister && !response.data.session) setAuthError('Check your email to confirm your account, then sign in.');
    else setAuthOpen(false);
  }

  async function signOut() { await supabase.auth.signOut(); setNotice('You have signed out.'); }
  const scrollToScanner = () => document.getElementById('scanner')?.scrollIntoView({ behavior: 'smooth' });

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#top"><span className="brand-icon"><Shield size={22} strokeWidth={2.2}/><Check size={11} className="brand-check"/></span><span><b>UPI SHIELD</b><small>AI · PERSONAL PROTECTION</small></span></a>
      <div className="side-label">WORKSPACE</div>
      <a className="side-link active" href="#top"><Activity size={17}/> Overview</a>
      <button className="side-link" onClick={scrollToScanner}><ScanLine size={17}/> Analyze content</button>
      <a className="side-link" href="#history"><History size={17}/> Analysis history</a>
      <div className="side-label tools-label">PROTECTION</div>
      <a className="side-link" href="#safety"><ShieldCheck size={17}/> Safety center</a>
      <a className="side-link" href="#extension"><Globe2 size={17}/> Browser extension <span className="soon">SOON</span></a>
      <div className="sidebar-bottom"><div className="privacy-note"><LockKeyhole size={15}/><span>Your safety comes first. Never share your UPI PIN, OTP, or banking password.</span></div><button className="profile-button" onClick={() => user ? signOut() : setAuthOpen(true)}><span className="avatar">{user ? user.email?.slice(0,1).toUpperCase() : 'G'}</span><span className="profile-text"><b>{user ? user.email : 'Guest session'}</b><small>{user ? 'Personal workspace' : 'Sign in to sync history'}</small></span>{user ? <LogOut size={16}/> : <ChevronDown size={16}/>}</button></div>
    </aside>

    <main className="main-content" id="top">
      <header className="topbar"><button className="mobile-menu" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle navigation">{mobileOpen ? <X/> : <Menu/>}</button><div className="breadcrumb">Workspace <span>/</span> <b>Overview</b></div><div className="top-actions"><span className="status-pill"><i/> Protection ready</span><button className="icon-button" aria-label="Notifications"><Bell size={18}/><i/></button><button className="user-mini" onClick={() => user ? signOut() : setAuthOpen(true)}>{user ? user.email?.slice(0,1).toUpperCase() : 'G'}</button></div></header>
      {mobileOpen && <div className="mobile-nav"><a href="#top" onClick={() => setMobileOpen(false)}>Overview</a><a href="#scanner" onClick={() => setMobileOpen(false)}>Analyze content</a><a href="#history" onClick={() => setMobileOpen(false)}>History</a><a href="#safety" onClick={() => setMobileOpen(false)}>Safety center</a></div>}

      <section className="welcome-row"><div><p className="eyebrow"><span className="eyebrow-dot"/> YOUR DIGITAL SAFETY, AT A GLANCE</p><h1>Know the risk<br className="mobile-break"/> <span>before you pay.</span></h1><p className="welcome-copy">A little caution goes a long way. Check a message, link, or payment request before you act.</p></div><div className="welcome-shield"><div className="shield-ring ring-one"/><div className="shield-ring ring-two"/><div className="shield-core"><ShieldCheck size={41}/></div><span className="orbit-dot dot-a"/><span className="orbit-dot dot-b"/><span className="orbit-dot dot-c"/></div></section>

      <section className="stats-grid" aria-label="Account activity"><article className="stat-card"><div className="stat-top"><span>ANALYSES RUN</span><span className="stat-icon blue"><ScanLine size={17}/></span></div><strong>{user ? history.length : '—'}</strong><p>{user ? 'Saved in your account' : 'Sign in to keep your history'}</p></article><article className="stat-card"><div className="stat-top"><span>HIGH RISK FLAGS</span><span className="stat-icon amber"><MessageSquareWarning size={17}/></span></div><strong>{user ? history.filter(item => item.risk_score > 60).length : '—'}</strong><p>Based on your saved analyses</p></article><article className="stat-card"><div className="stat-top"><span>PROTECTION STATUS</span><span className="stat-icon green"><ShieldCheck size={17}/></span></div><strong className="status-word">Ready</strong><p>Manual checks are standing by</p></article></section>

      <section className="scanner-layout" id="scanner"><div className="scanner-card"><div className="section-heading"><div><div className="section-kicker"><Sparkles size={14}/> AI-POWERED CHECK</div><h2>What would you like to check?</h2><p>Paste a suspicious message, add a link, or upload a screenshot.</p></div><span className="private-badge"><LockKeyhole size={13}/> Private</span></div>
        <div className="input-label"><span>MESSAGE OR LINK</span><span>Never include PINs, OTPs, or passwords</span></div><textarea value={content} onChange={event => setContent(event.target.value)} maxLength={10000} placeholder={'Paste a message, payment request, or suspicious URL here…\n\nWe’ll look for common warning signs and explain what we find.'} aria-label="Message or URL to analyze"/>
        <div className={`upload-zone ${file ? 'has-file' : ''}`} onClick={() => fileRef.current?.click()} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); const dropped = event.dataTransfer.files[0]; if (dropped?.type.startsWith('image/')) setFile(dropped); else setNotice('Please drop an image file.'); }} role="button" tabIndex={0} onKeyDown={event => { if (event.key === 'Enter') fileRef.current?.click(); }}><input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={event => setFile(event.target.files?.[0] ?? null)}/><span className="upload-icon"><FileImage size={18}/></span><span className="upload-copy"><b>{file ? file.name : 'Drop a screenshot here, or browse'}</b><small>{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB · image selected` : 'PNG, JPG or WEBP · Up to 5 MB'}</small></span>{file ? <button className="remove-file" aria-label="Remove image" onClick={event => { event.stopPropagation(); setFile(null); }}><X size={16}/></button> : <Upload size={17} className="upload-arrow"/>}</div>
        <div className="scanner-footer"><p><LockKeyhole size={13}/> Your content is only checked when you choose Analyze.</p><button className="analyze-button" onClick={runAnalysis} disabled={busy}>{busy ? <><span className="spinner"/> Checking…</> : <><ScanLine size={16}/> Analyze safely <ArrowRight size={16}/></>}</button></div>
        {notice && <div className="notice" role="status"><CircleHelp size={15}/>{notice}<button onClick={() => setNotice('')} aria-label="Dismiss"><X size={14}/></button></div>}
      </div>
      <aside className="side-stack"><div className="how-card"><div className="side-card-title"><span className="side-card-icon"><Shield size={17}/></span><div><b>How it works</b><small>Simple, private, transparent</small></div></div><div className="how-step"><span>01</span><div><b>Share what feels off</b><small>A message, URL, or screenshot</small></div></div><div className="how-step"><span>02</span><div><b>We check for red flags</b><small>Patterns that may signal a scam</small></div></div><div className="how-step"><span>03</span><div><b>Get a clear next step</b><small>Understand the signals, not just a score</small></div></div></div><div className="gentle-card"><div className="gentle-icon"><ShieldAlert size={18}/></div><div><b>Keep your secrets yours</b><p>We will never ask for your UPI PIN, OTP, CVV, or banking password.</p></div></div></aside></section>

      {result && <section className={`result-card ${riskClass[result.risk_level]}`} aria-live="polite"><div className="result-top"><div><div className="section-kicker"><Sparkles size={14}/> CHECK COMPLETE · {new Date(result.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div><h2>Here’s what we noticed</h2></div><button className="close-result" onClick={() => setResult(null)} aria-label="Close result"><X size={18}/></button></div><div className="result-body"><div className="score-disc"><strong>{result.risk_score}</strong><span>/ 100</span></div><div className="result-summary"><span className={`risk-tag ${riskClass[result.risk_level]}`}>{result.risk_level} RISK</span><p>{result.summary}</p><small>Risk score is an estimate, not proof of fraud.</small></div></div><div className="signals"><b>Signals checked</b>{result.indicators.map((indicator, index) => <div key={`${indicator}-${index}`}><span className="signal-bullet"/>{indicator}</div>)}</div></section>}

      <section className="lower-grid" id="history"><div className="history-card"><div className="lower-heading"><div><h2>Recent checks</h2><p>{user ? 'Your latest saved analyses' : 'Sign in to save checks across sessions'}</p></div><button onClick={() => user ? setNotice('Your saved checks are listed below.') : setAuthOpen(true)}>{user ? 'View all' : 'Sign in'} <ArrowRight size={14}/></button></div>{history.length ? <div className="history-list">{history.slice(0,4).map(item => <button className="history-row" key={item.id} onClick={() => setResult(item)}><span className={`history-icon ${riskClass[item.risk_level]}`}>{item.input_type === 'url' ? <Link2 size={16}/> : item.input_type === 'image' ? <FileImage size={16}/> : <MessageSquareWarning size={16}/>}</span><span className="history-info"><b>{item.input_type === 'url' ? 'Website check' : item.input_type === 'image' ? 'Screenshot check' : 'Message check'}</b><small>{new Date(item.created_at).toLocaleString()}</small></span><span className={`history-risk ${riskClass[item.risk_level]}`}>{item.risk_level}</span><span className="history-score">{item.risk_score}</span><ArrowRight size={15} className="history-arrow"/></button>)}</div> : <div className="empty-history"><span><Clock3 size={19}/></span><div><b>No saved checks yet</b><p>{user ? 'Your completed analyses will appear here.' : 'Create a free account to keep your analysis history.'}</p></div>{!user && <button onClick={() => setAuthOpen(true)}>Create account <ArrowRight size={14}/></button>}</div>}</div>
        <div className="safety-card" id="safety"><div className="safety-art"><div className="art-orbit orbit-a"/><div className="art-orbit orbit-b"/><div className="art-shield"><ShieldCheck size={34}/></div><span className="art-spark spark-a">✦</span><span className="art-spark spark-b">✧</span></div><div className="safety-copy"><span>SAFETY CENTER</span><h3>Pause. Verify.<br/>Then decide.</h3><p>Learn to spot common payment scams and protect what matters.</p><a href="https://www.npci.org.in/what-we-do/upi/product-overview" target="_blank" rel="noreferrer">Explore UPI safety tips <ExternalLink size={13}/></a></div></div></section>

      <section className="extension-banner" id="extension"><span className="extension-icon"><Globe2 size={21}/></span><div><span className="extension-label">COMING SOON</span><b>Stay safer while you browse</b><p>Check suspicious links right from your browser. Scans only happen when you ask.</p></div><button onClick={() => setNotice('Chrome extension setup is included in the project source. Connect a deployed API to enable scans.')}>Explore extension <ArrowRight size={15}/></button></section>
      <footer><span>© {new Date().getFullYear()} UPI Shield AI</span><span><ShieldCheck size={13}/> Built for awareness, not payment processing</span><span className="demo-disclaimer">AI estimates are not proof of fraud.</span></footer>
    </main>

    {authOpen && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setAuthOpen(false); }}><section className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title"><button className="modal-close" onClick={() => setAuthOpen(false)} aria-label="Close"><X size={18}/></button><span className="auth-logo"><ShieldCheck size={26}/></span><p className="section-kicker">YOUR PERSONAL SAFETY SPACE</p><h2 id="auth-title">{isRegister ? 'Create your account' : 'Welcome back'}</h2><p className="auth-description">{isRegister ? 'Save your checks and keep your history close.' : 'Sign in to see your saved analysis history.'}</p><form onSubmit={authenticate}><label>Email address<input type="email" required autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com"/></label><label>Password<input type="password" required minLength={8} autoComplete={isRegister ? 'new-password' : 'current-password'} value={password} onChange={event => setPassword(event.target.value)} placeholder="At least 8 characters"/></label>{authError && <p className="auth-error">{authError}</p>}<button className="analyze-button auth-submit" disabled={authBusy}>{authBusy ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'} <ArrowRight size={16}/></button></form><p className="auth-switch">{isRegister ? 'Already have an account?' : 'New to UPI Shield?'} <button onClick={() => { setIsRegister(!isRegister); setAuthError(''); }}>{isRegister ? 'Sign in' : 'Create account'}</button></p><p className="auth-note"><LockKeyhole size={12}/> Your analyses are private to your account.</p></section></div>}
  </div>;
}
