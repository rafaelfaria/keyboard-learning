/**
 * The one footer, used by the landing page and every public page.
 *
 * There used to be two: a hand-written set of columns in Landing.tsx and a
 * registry-driven one here, built at different times and drifting apart in
 * links, wording and styling. A visitor moving from `/` to `/typing-test` saw
 * the site change shape under them.
 *
 * Columns are derived from the PublicPage registry rather than typed out, so a
 * page added to `site.ts` appears in the footer of every page automatically and
 * the internal link graph cannot develop holes. The small registry groups are
 * merged into four readable columns; the mapping is the only hand-maintained
 * part, and an unmapped group would simply not render, so it is asserted
 * against the registry in one place below.
 *
 * SSR-safe: no store, no browser globals. This tree is prerendered in Node.
 */

import { Link } from 'react-router-dom';
import { LogoMark } from '../Brand';
import { PUBLIC_PAGES, SITE_NAME, type PublicPage as PageDef } from '../../lib/seo/site';

type Group = PageDef['group'];

/** Display column → the registry groups it absorbs. `Core` is the home page,
 *  which the brand mark already links to, so it is deliberately excluded. */
const COLUMNS: { label: string; groups: Group[] }[] = [
  { label: 'Product', groups: ['Product'] },
  { label: 'Learn', groups: ['Learn', 'Tools'] },
  { label: 'Who it is for', groups: ['Audiences'] },
  { label: 'More', groups: ['Reference', 'Legal'] },
];

export function SiteFooter() {
  const columns = COLUMNS.map((c) => ({
    label: c.label,
    pages: PUBLIC_PAGES.filter((p) => c.groups.includes(p.group)),
  })).filter((c) => c.pages.length > 0);

  return (
    <footer className="site-foot">
      <div className="site-foot-inner">
        <div className="site-foot-brand">
          {/* Mark plus wordmark, as in the header. The mark alone is a gradient
              SVG sitting on --logo-bg, which is a near-match for the footer's
              own ground, so on its own it reads as a smudge. */}
          <Link to="/" className="site-foot-mark" aria-label={`${SITE_NAME} home`}>
            <LogoMark size={30} idPrefix="sitefoot" flat />
            <span>{SITE_NAME}</span>
          </Link>
          <p>
            Every keyboard is a world. {SITE_NAME} is free, carries no advertising, and writes every
            keystroke to your own browser first, so practice never waits on the network.
          </p>
        </div>

        {columns.map((c) => (
          <nav className="site-foot-col" key={c.label} aria-label={c.label}>
            <strong>{c.label}</strong>
            {c.pages.map((p) => <Link key={p.path} to={p.path}>{p.label}</Link>)}
          </nav>
        ))}
      </div>
    </footer>
  );
}
