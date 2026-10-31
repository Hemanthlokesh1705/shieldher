import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <main className="not-found-page">
      <div className="not-found-art" aria-hidden="true"><span>✦</span></div>
      <p className="not-found-kicker">A little off the path</p>
      <h1>We can’t find this page.</h1>
      <p>The link may have changed, but your safe space is still here.</p>
      <Link to="/" className="btn-primary">Return to ShieldHer <span aria-hidden="true">→</span></Link>
    </main>
  );
}
