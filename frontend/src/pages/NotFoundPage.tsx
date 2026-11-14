import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-6 py-16">
      <div className="w-full max-w-lg rounded-2xl border border-ink-border bg-surface-pearl p-8 sm:p-10">
        <p className="text-sm font-medium text-brand-forest">Page not found</p>
        <h1 className="mt-3 text-3xl font-medium text-ink">
          We couldn’t find that page
        </h1>
        <p className="mt-3 text-base leading-relaxed text-ink-secondary">
          The link may have changed. You can return to ShieldHer and continue when you’re ready.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-forest px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Return to ShieldHer
        </Link>
      </div>
    </main>
  );
}
