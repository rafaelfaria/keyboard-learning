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
import { PUBLIC_PAGES, SITE_NAME, type PublicPage as PageDef } from '../../lib/seo/site';
import { Seo } from '../../lib/seo/Seo';

function Nav() {
  return (
    <header className="pub-header">
      <div className="pub-wrap pub-header-inner">
        <Link to="/" className="pub-brand" aria-label={`${SITE_NAME} home`}>
          <LogoMark size={30} idPrefix="pubnav" flat />
          <span>{SITE_NAME}</span>
        </Link>
        <nav className="pub-nav" aria-label="Main">
          <Link to="/typing-test">Typing test</Link>
          <Link to="/learn-to-type">Learn to type</Link>
          <Link to="/curriculum">Curriculum</Link>
          <Link to="/typing-games">Games</Link>
          <Link to="/faq">FAQ</Link>
          <Link className="pub-cta" to="/onboarding">Start free</Link>
        </nav>
      </div>
    </header>
  );
}

const GROUP_ORDER: PageDef['group'][] = ['Core', 'Product', 'Tools', 'Learn', 'Audiences', 'Reference', 'Legal'];

function Footer() {
  const groups = GROUP_ORDER.map((g) => ({
    group: g,
    pages: PUBLIC_PAGES.filter((p) => p.group === g),
  })).filter((g) => g.pages.length > 0);

  return (
    <footer className="pub-footer">
      <div className="pub-wrap pub-footer-inner">
        <div className="pub-footer-brand">
          <LogoMark size={34} idPrefix="pubfoot" flat />
          <p>
            {SITE_NAME}. Every keyboard is a world. A free, local-first typing tutor: every keystroke
            is written to your own browser first, so practice never waits on the network. No adverts,
            no trackers, nothing sold to anyone.
          </p>
        </div>
        {groups.map(({ group, pages }) => (
          <div className="pub-foot-col" key={group}>
            <strong>{group}</strong>
            {pages.map((p) => (
              <Link key={p.path} to={p.path}>{p.label}</Link>
            ))}
          </div>
        ))}
        <div className="pub-foot-col">
          <strong>Start</strong>
          <Link to="/onboarding">Start learning</Link>
          <Link to="/onboarding?quick=1">60-second assessment</Link>
          <Link to="/app">Open the app</Link>
        </div>
      </div>
      <p className="pub-foot-legal">
        {SITE_NAME} · an original typing-learning world · accuracy before speed
      </p>
    </footer>
  );
}

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
  page, lede, children, wide,
}: {
  page: PageDef;
  /** The visible sub-heading. Distinct from the meta description on purpose. */
  lede: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="pub-root" data-page={page.path}>
      <Seo path={page.path} />
      <Nav />
      <main className={`pub-main${wide ? ' pub-main-wide' : ''}`} id="main">
        <div className="pub-wrap">
          <Breadcrumbs page={page} />
          <h1 className="pub-h1">{page.title.replace(/ \| .*$/, '')}</h1>
          <p className="pub-lede">{lede}</p>
          {children}
        </div>
      </main>
      <Footer />
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
