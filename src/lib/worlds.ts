import { WORLD_SPINE, type WorldSpine } from './curriculum';

/**
 * Presentation registry for the two journeys (docs/two-worlds-plan.md §3–4).
 * The spine (curriculum.ts) says what a world *is*; this file says what it
 * *looks like* — an island for kids, an expedition leg for grown-ups.
 * Adding a future world (w6+) = one spine entry + one skin entry.
 */

export interface IslandSkin {
  kidName: string;
  landmark: string;
  guardian: number;               // PIXEL_PALS index
  sky: [string, string];
  sea: [string, string];
  grass: string;
  grassLight: string;
  sand: string;
  road: string;                   // dirt-trail colour on this terrain
  decor: 'meadow' | 'forest' | 'harbor' | 'cavern' | 'sky';
  blurb: string;                  // one kid-worded line for the sea chart
}

export interface LegSkin {
  adultName: string;
  blurb: string;                  // one line for the elevation strip / guide
}

export interface WorldDef extends WorldSpine {
  kid: IslandSkin;
  adult: LegSkin;
}

/** Bright node colours cycled along every road. */
export const LAND_COLORS = ['#ff8fa3', '#ffb26b', '#ffd166', '#7dd8a0', '#5fc9e0', '#8b9cf5', '#c99cf5', '#f59cd8', '#66d9c2'];

const KID_SKINS: Record<string, IslandSkin> = {
  w1: {
    kidName: 'Meadow Isle', landmark: 'The Great Oak', guardian: 0,
    sky: ['#aee3f7', '#d9f2fb'], sea: ['#9edbf2', '#7fc9e8'],
    grass: '#97d67f', grassLight: '#b1e39b', sand: '#eddc9e', road: '#e7d5a4',
    decor: 'meadow', blurb: 'Where every explorer begins',
  },
  w2: {
    kidName: 'Treetop Isle', landmark: 'The Canopy Bridge', guardian: 1,
    sky: ['#93cfae', '#d3eedd'], sea: ['#77c0ab', '#58a893'],
    grass: '#5fae6a', grassLight: '#7dc487', sand: '#d9c98f', road: '#cdb98a',
    decor: 'forest', blurb: 'A forest with letters in its leaves',
  },
  w3: {
    kidName: 'Lantern Harbor', landmark: 'The Lighthouse', guardian: 2,
    sky: ['#ffd9a8', '#ffbfa8'], sea: ['#7fa8e8', '#5f88c8'],
    grass: '#a8c97f', grassLight: '#c0db97', sand: '#f0dcae', road: '#e8d3a2',
    decor: 'harbor', blurb: 'A seaside town of words and lights',
  },
  w4: {
    kidName: 'Crystal Caverns', landmark: 'The Geode Gate', guardian: 3,
    sky: ['#4d4670', '#6a6094'], sea: ['#4f6aa8', '#3d5488'],
    grass: '#8a7fb8', grassLight: '#a598cc', sand: '#6d6494', road: '#8d84ad',
    decor: 'cavern', blurb: 'Numbers and glyphs glow in the dark',
  },
  w5: {
    kidName: 'Cloud Castle', landmark: 'The Cloud Castle', guardian: 4,
    sky: ['#9ed4fa', '#ffe9c4'], sea: ['#ffffff', '#dceefa'],
    grass: '#b3e39b', grassLight: '#cdeeb5', sand: '#ffe9b8', road: '#f0dcae',
    decor: 'sky', blurb: 'The island above the clouds',
  },
};

const ADULT_SKINS: Record<string, LegSkin> = {
  w1: { adultName: 'The Valley', blurb: 'Trailhead by the river — anchors and the home row' },
  w2: { adultName: 'The Forest', blurb: 'Switchbacks under tall trees — the full alphabet' },
  w3: { adultName: 'The Ridgeline', blurb: 'Open views — capitals, punctuation, real sentences' },
  w4: { adultName: 'The Glacier', blurb: 'Technical terrain — numbers, symbols and code' },
  w5: { adultName: 'The Summit Push', blurb: 'Thin air — rhythm, endurance and mastery' },
};

export const WORLDS: WorldDef[] = WORLD_SPINE.map((w) => ({
  ...w,
  kid: KID_SKINS[w.id],
  adult: ADULT_SKINS[w.id],
}));

export function worldDef(id: string): WorldDef {
  return WORLDS.find((w) => w.id === id) ?? WORLDS[0];
}
