import { Link } from "react-router-dom";

function Mark() {
  return <svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M16 2.8 27 7.4v7.8c0 6.7-4.4 11.9-11 14-6.6-2.1-11-7.3-11-14V7.4l11-4.6Z" fill="currentColor" /><path d="m10.8 16.2 3.2 3.1 7.2-7.2" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="nova-mark-cut" /></svg>;
}
const Arrow = () => <span aria-hidden="true">→</span>;

export default function LandingPage() {
  return (
    <div className="nova-page">
      <header className="nova-header">
        <Link to="/" className="nova-brand"><span className="nova-brand-mark"><Mark /></span><span>ShieldHer</span></Link>
        <nav className="nova-nav" aria-label="Primary navigation"><a href="#how">How it works</a><a href="#privacy">Privacy</a><Link to="/reviewer">For advocates</Link></nav>
        <div className="nova-nav-actions"><Link to="/login" className="nova-login">Sign in</Link><Link to="/intake" className="nova-top-cta">Open workspace <Arrow /></Link></div>
      </header>
      <main>
        <section className="nova-hero">
          <div className="nova-grid" aria-hidden="true" />
          <div className="nova-hero-copy"><div className="nova-eyebrow"><i /> PRIVATE DIGITAL EVIDENCE SUPPORT</div><h1>Find clarity.<br /><span>Keep control.</span></h1><p>ShieldHer is a private workspace for documenting digital evidence, understanding what you are seeing, and deciding your next move with confidence.</p><div className="nova-hero-actions"><Link to="/intake" className="nova-primary">Start a protected case <Arrow /></Link><a href="#how" className="nova-secondary">Explore the process <span>↓</span></a></div><div className="nova-proof"><span className="nova-proof-dot" /> Your evidence remains yours. You decide when to continue.</div></div>
          <div className="nova-hero-art"><div className="nova-art-halo nova-halo-one" /><div className="nova-art-halo nova-halo-two" /><div className="nova-hero-image"><img src="/images/shieldher-orbit.png" alt="Abstract illuminated orb representing protected evidence" /><div className="nova-image-glow" /></div><div className="nova-signal-card"><div className="nova-signal-icon">✦</div><div><small>PRIVATE BY DESIGN</small><strong>Your next step<br />is your choice.</strong></div></div><div className="nova-system-pill"><span /> System protected</div></div>
          <div className="nova-hero-meta"><b>01</b><span>SHIELDHER / DIGITAL SUPPORT</span></div>
        </section>
        <section className="nova-flow" id="how"><div className="nova-section-heading"><div><span className="nova-section-no">01</span><small>THE PROCESS</small></div><h2>A clear path through<br />a difficult moment.</h2><p>You do not need to have all the answers. ShieldHer lets you move from evidence to understanding, one controlled step at a time.</p></div><div className="nova-flow-grid"><article className="nova-flow-card"><div className="nova-card-top"><span>01</span><i>↗</i></div><h3>Preserve</h3><p>Add an image to create a secure evidence record with its original file details.</p><div className="nova-card-line" /></article><article className="nova-flow-card"><div className="nova-card-top"><span>02</span><i>◌</i></div><h3>Understand</h3><p>Review image quality, synthetic media checks, and forensic signals in one place.</p><div className="nova-card-line" /></article><article className="nova-flow-card"><div className="nova-card-top"><span>03</span><i>✦</i></div><h3>Decide</h3><p>Choose whether to search further or prepare a draft for your own review.</p><div className="nova-card-line" /></article></div></section>
        <section className="nova-privacy" id="privacy"><div className="nova-privacy-visual"><div className="nova-privacy-rings" /><div className="nova-vault-card"><span className="nova-vault-mark"><Mark /></span><small>SHIELDHER VAULT</small><strong>Designed around<br />your consent.</strong><div><i /><i /><i /></div></div><span className="nova-orbit-dot nova-dot-a" /><span className="nova-orbit-dot nova-dot-b" /></div><div className="nova-privacy-copy"><div className="nova-eyebrow"><i /> YOUR CONTROL, BUILT IN</div><h2>Private by default.<br /><span>Transparent by design.</span></h2><p>Every optional action is visible before it happens. You review results, choose whether to search, and approve a complaint draft before it goes anywhere.</p><ul><li><b>✓</b> Review your evidence record at any time</li><li><b>✓</b> Choose before any external lookup</li><li><b>✓</b> No automatic report submission</li></ul><Link to="/intake" className="nova-text-link">Enter the private workspace <Arrow /></Link></div></section>
        <section className="nova-cta"><div className="nova-cta-orb" /><div className="nova-eyebrow"><i /> BEGIN WHEN YOU FEEL READY</div><h2>One small action<br />can create <span>clarity.</span></h2><p>Open a private workspace and begin with the evidence you have.</p><Link to="/intake" className="nova-primary">Begin securely <Arrow /></Link></section>
      </main>
      <footer className="nova-footer"><Link to="/" className="nova-brand"><span className="nova-brand-mark"><Mark /></span><span>ShieldHer</span></Link><span>A private evidence workspace</span><nav><Link to="/intake">Workspace</Link><Link to="/reviewer">Reviewer portal</Link><Link to="/health">System status</Link></nav><small>© {new Date().getFullYear()} ShieldHer</small></footer>
    </div>
  );
}
