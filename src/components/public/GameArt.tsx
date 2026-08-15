/**
 * The animated art for each game, and the racing lanes.
 *
 * This lived inline in Landing.tsx, which meant /typing-games — the page
 * actually about the games, and the one search sends people to — showed seven
 * paragraphs in plain boxes while the home page showed the game moving. The
 * art is now shared, so the two pages cannot drift apart again.
 *
 * Pure markup and CSS keyframes: no canvas, no library, no measurement. That is
 * what makes it safe on the prerendered pages, where this renders to static
 * HTML in Node and simply starts animating when a browser picks it up. Every
 * animation is switched off under `prefers-reduced-motion` in gameart.css,
 * where each piece also gets a sensible resting pose rather than freezing
 * mid-gesture.
 */

import { Ic } from '../icons';

/** Keyed by the slug used in `GAMES` (src/lib/seo/content.ts). */
export function GameArt({ slug }: { slug: string }) {
  switch (slug) {
    case 'wordfall':
      return (
        <div className="play-art pa-wordfall" aria-hidden>
          <span>w</span><span>o</span><span>r</span><span>d</span><span>s</span>
        </div>
      );
    case 'keyforge':
      return (
        <div className="play-art pa-forge" aria-hidden>
          <Ic n="hammer" size={40} /><i>✦</i><i>✦</i><i>✦</i>
        </div>
      );
    case 'wordflight':
      return <div className="play-art pa-flight" aria-hidden><Ic n="send" size={40} /></div>;
    case 'duel':
      return (
        <div className="play-art pa-duel" aria-hidden>
          <span className="pd-lane"><i className="pd-fill pd-you" /></span>
          <span className="pd-badge"><Ic n="swords" size={17} /></span>
          <span className="pd-lane"><i className="pd-fill pd-foe" /></span>
        </div>
      );
    case 'survivor':
      return (
        <div className="play-art pa-sprint" aria-hidden>
          <span className="ps-finish"><Ic n="crown" size={16} /></span>
          <i className="ps-dot" /><i className="ps-dot" /><i className="ps-dot" /><i className="ps-dot" />
        </div>
      );
    case 'cipher':
      return (
        <div className="play-art pa-cipher" aria-hidden>
          {([['h', 'c'], ['p', 'i'], ['c', 'p'], ['i', 'h'], ['r', 'e'], ['e', 'r']] as const).map(([a, b], i) => (
            <span className="pc-tile" key={i} style={{ animationDelay: `${i * 0.22}s` }}><b>{a}</b><i>{b}</i></span>
          ))}
        </div>
      );
    case 'stack':
      return (
        <div className="play-art pa-stack" aria-hidden>
          <span className="pst-col">
            <i className="pst-drop" />
            <i className="pst-b" style={{ width: 58 }} />
            <i className="pst-b" style={{ width: 42 }} />
            <i className="pst-b" style={{ width: 66 }} />
          </span>
        </div>
      );
    default:
      return null;
  }
}

/**
 * The race lanes. Takes its avatars as a render prop because the landing draws
 * real BlockAvatars from the profile system, which pulls in the store and so
 * cannot be imported by anything the prerenderer touches.
 */
export function RaceArt({ marker }: { marker?: (preset: number, i: number) => React.ReactNode }) {
  return (
    <div className="play-art pa-race" aria-hidden>
      {[2, 5, 8, 11].map((p, i) => (
        <span className="pr-lane" key={p}>
          <i className="pr-trail" />
          <span className="pr-comet" style={{ animationDelay: `${i * 0.55}s` }}>
            {marker ? marker(p, i) : <i className="pr-dot" />}
          </span>
        </span>
      ))}
    </div>
  );
}
