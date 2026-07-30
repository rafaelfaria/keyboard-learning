import type { ThemeId } from './types';

export interface ThemeMeta {
  id: ThemeId;
  name: string;
  desc: string;
  level: number;          // level required (0 = free)
  dark: boolean;
  preview: [string, string, string]; // bg, accent, text
}

export const THEMES: ThemeMeta[] = [
  { id: 'midnight',  name: 'Midnight Focus',   desc: 'Deep space calm — the classic KeyTopia night.', level: 0, dark: true,  preview: ['#0b1020', '#14d8c4', '#eef1fb'] },
  { id: 'porcelain', name: 'Clean Light',      desc: 'Bright, airy and distraction-free.',           level: 0, dark: false, preview: ['#f6f7fc', '#0ea5a0', '#171b2e'] },
  { id: 'meadow',    name: 'Sunny Meadow',     desc: 'Warm and playful — a favourite with young explorers.', level: 0, dark: false, preview: ['#fdf6e9', '#2fa96b', '#2d2a26'] },
  { id: 'contrast',  name: 'High Contrast',    desc: 'Maximum legibility, WCAG-strong contrast.',    level: 0, dark: true,  preview: ['#000000', '#ffd400', '#ffffff'] },
  { id: 'paper',     name: 'Paper & Ink',      desc: 'A quiet writing desk, warm paper tones.',      level: 3, dark: false, preview: ['#f3ecdf', '#8a5a2b', '#2b2620'] },
  { id: 'neon',      name: 'Neon Circuit',     desc: 'Electric city lights for night sprinters.',    level: 4, dark: true,  preview: ['#0a0714', '#e34fd8', '#f2ecff'] },
  { id: 'ocean',     name: 'Deep Ocean',       desc: 'Slow currents and bioluminescent blues.',      level: 5, dark: true,  preview: ['#04141f', '#3ec6ff', '#e6f4fb'] },
  { id: 'pastel',    name: 'Soft Pastel',      desc: 'Gentle colours, gentle pace.',                 level: 6, dark: false, preview: ['#faf3f7', '#b46bd8', '#3a3342'] },
  { id: 'wildwood',  name: 'Enchanted Wildwood', desc: 'Moss, fireflies and old trees.',             level: 7, dark: true,  preview: ['#0c1710', '#7fd069', '#eaf6e6'] },
  { id: 'terminal',  name: 'Retro Terminal',   desc: 'Green phosphor and pure focus.',               level: 8, dark: true,  preview: ['#050b06', '#33ff66', '#c8ffd4'] },
  { id: 'cosmos',    name: 'Cosmic Academy',   desc: 'Nebulae, star maps and violet dusk.',          level: 10, dark: true, preview: ['#120a24', '#8b7cff', '#f0ebff'] },
  { id: 'ember',     name: 'Ember Forge',      desc: 'Warm coals for record-chasing nights.',        level: 12, dark: true, preview: ['#1a0d08', '#ff7a45', '#ffefe6'] },
];

export const AVATARS: { icon: string; level: number }[] = [
  { icon: '🦊', level: 0 }, { icon: '🐧', level: 0 }, { icon: '🦉', level: 0 }, { icon: '🐢', level: 0 },
  { icon: '🐱', level: 0 }, { icon: '🐼', level: 0 }, { icon: '🐬', level: 2 }, { icon: '🦜', level: 3 },
  { icon: '🐨', level: 4 }, { icon: '🦔', level: 5 }, { icon: '🐸', level: 6 }, { icon: '🦋', level: 7 },
  { icon: '🐙', level: 8 }, { icon: '🦩', level: 9 }, { icon: '🐲', level: 10 }, { icon: '🚀', level: 11 },
  { icon: '⚡', level: 12 }, { icon: '🌟', level: 14 }, { icon: '👑', level: 16 }, { icon: '🔮', level: 18 },
];

export function applyTheme(theme: ThemeId, opts?: { fontScale?: number; dyslexia?: boolean; reducedMotion?: boolean }): void {
  const root = document.documentElement;
  root.dataset.theme = theme;
  if (opts) {
    root.style.setProperty('--fscale', String(opts.fontScale ?? 1));
    root.dataset.dys = opts.dyslexia ? '1' : '0';
    root.dataset.rm = opts.reducedMotion ? '1' : '0';
  }
}
