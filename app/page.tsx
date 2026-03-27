import { Suspense } from 'react';
import ShowcasePage from '@/app/showcase-page';

function LoadingState() {
  return (
    <main className="page-shell">
      <section className="hero-card">
        <div className="hero-copy">
          <span className="eyebrow">README-safe contributor collage</span>
          <h1>Preparing your contributor preview…</h1>
          <p className="muted">Loading the client-side controls.</p>
        </div>
      </section>
    </main>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <ShowcasePage />
    </Suspense>
  );
}
