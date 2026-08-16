/**
 * Shared chrome for every crawlable page.
 *
 * Deliberately dependency-light: no store, no Three.js, no GSAP, no browser
 * globals at module scope, because this tree is also rendered to static HTML in
 * Node by the prerenderer. Anything imported here must be SSR-safe.
 *
 * The footer is not decoration — it is the internal link graph. Every public
 * page links to every other, so a crawler that finds any one page finds them
 * all, and link equity is not stranded on orphan pages.
 */

import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { LogoMark } from '../Brand';
import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';
import { PublicHero } from './PublicHero';
import { usePublicMotion } from './usePublicMotion';
import { SITE_NAME, type PublicPage as PageDef } from '../../lib/seo/site';
import { Seo } from '../../lib/seo/Seo';

/** Breadcrumb trail, mirroring the BreadcrumbList JSON-LD on the same page. */
function Breadcrumbs({ page }: { page: PageDef }) {
  if (page.path === '/') return null;
  return (
    <nav className="pub-crumbs" aria-label="Breadcrumb">
      <ol>
        <li><Link to="/">Home</Link></li>
        <li aria-current="page">{page.label}</li>
      </ol>
    </nav>
  );
}

export function PublicPage({
  page, lede, children,
}: {
  page: PageDef;
  /** The visible sub-heading. Distinct from the meta description on purpose. */
  lede: ReactNode;
  children: ReactNode;
}) {
  // Both hooks are no-ops during prerender: effects do not run under
  // renderToStaticMarkup, so the static HTML is the finished page.
  usePublicMotion(page.path);

  return (
    <div className="pub-root" data-page={page.path}>
      <Seo path={page.path} />
      <SiteHeader />
      <main className="pub-main" id="main">
        <PublicHero path={page.path}>
          <Breadcrumbs page={page} />
          <h1 className="pub-h1">{page.title.replace(/ \| .*$/, '')}</h1>
          <p className="pub-lede">{lede}</p>
        </PublicHero>
        <div className="pub-wrap">
          {children}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

/** A cross-link block, so no page is a dead end for a crawler or a reader. */
export function NextSteps({ items }: { items: { path: string; label: string; note: string }[] }) {
  return (
    <section className="pub-next" aria-labelledby="next-steps">
      <h2 id="next-steps">Keep going</h2>
      <div className="pub-next-grid">
        {items.map((i) => (
          <Link className="pub-next-card" to={i.path} key={i.path}>
            <strong>{i.label}</strong>
            <span>{i.note}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function CtaBand({ title, body }: { title: string; body: string }) {
  return (
    <section className="pub-cta-band">
      <h2>{title}</h2>
      <p>{body}</p>
      <div className="pub-cta-row">
        <Link className="btn btn-primary btn-big" to="/onboarding">Start learning, it's free</Link>
        <Link className="btn btn-soft btn-big" to="/typing-test">Take the typing test</Link>
      </div>
    </section>
  );
}
