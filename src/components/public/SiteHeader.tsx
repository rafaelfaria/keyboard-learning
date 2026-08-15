/**
 * The one header, used by the landing page and every public page.
 *
 * There used to be two, and they disagreed about almost everything: one centred
 * its links and the other right-aligned them, one marked the current page with
 * an underline and the other had no active state at all, one wrapped a route in
 * an outline pill while its neighbours were plain text, and the two call-to-
 * action buttons were different colours. Same brand, two design systems.
 *
 * The links are the same on every page on purpose. The landing used to carry
 * five in-page section anchors here as well, which is ten items in one bar, and
 * jumping to an anchor skips past the scroll-driven sections so they arrive
 * half-revealed. Wayfinding on the landing is the scroll itself.
 *
 * SSR-safe: no store, no account, no browser globals. These pages are
 * prerendered in Node, which is also why the call to action is a prop — the
 * landing passes an account-aware one, and the prerendered pages fall back to
 * the version that is true for a stranger.
 */

import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { LogoMark } from '../Brand';
import { SITE_NAME } from '../../lib/seo/site';

const LINKS: { to: string; label: string }[] = [
  { to: '/typing-test', label: 'Typing test' },
  { to: '/learn-to-type', label: 'Learn to type' },
  { to: '/curriculum', label: 'Curriculum' },
  { to: '/typing-games', label: 'Games' },
  { to: '/faq', label: 'FAQ' },
];

export function SiteHeader({ cta }: { cta?: ReactNode }) {
  return (
    <header className="site-head">
      <div className="site-head-inner">
        <Link to="/" className="site-head-brand" aria-label={`${SITE_NAME} home`}>
          <LogoMark size={28} idPrefix="sitehead" flat />
          <span>{SITE_NAME}</span>
        </Link>

        <nav className="site-head-nav" aria-label="Main">
          {LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) => (isActive ? 'is-on' : undefined)}
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="site-head-cta">
          {cta ?? <Link className="btn btn-primary" to="/onboarding">Start free</Link>}
        </div>
      </div>
    </header>
  );
}
