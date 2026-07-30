import type { ProfileData, SessionResult } from './types';
import { streakFrom } from './metrics';
import { masteryOf, globalMedianMs } from './adaptive';
import { layoutGroups } from './keyboard';

export interface BadgeDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  cat: 'First Steps' | 'Accuracy' | 'Speed' | 'Consistency' | 'Endurance' | 'Technique' | 'Exploration' | 'Competition' | 'Streaks' | 'Comebacks' | 'Specialist' | 'Secret';
  secret?: boolean;
  /** returns progress 0..1 given data (and optionally the session that just ended) */
  check: (d: ProfileData, r?: SessionResult) => number;
}

const totalChars = (d: ProfileData) => d.sessions.reduce((a, s) => a + s.typed, 0);
const totalMinutes = (d: ProfileData) => d.sessions.reduce((a, s) => a + s.seconds, 0) / 60;
const bestWpm = (d: ProfileData) => Math.max(0, ...d.sessions.map((s) => (s.acc >= 90 ? s.wpm : 0)));
const cleanSessions = (d: ProfileData, acc: number) => d.sessions.filter((s) => s.acc >= acc && s.typed >= 40).length;

export const BADGES: BadgeDef[] = [
  { id: 'first-keys', name: 'First Keys', desc: 'Complete your first session.', icon: 'key', cat: 'First Steps', check: (d) => Math.min(1, d.sessions.length / 1) },
  { id: 'first-lesson', name: 'Trailhead', desc: 'Finish your first lesson.', icon: 'footprints', cat: 'First Steps', check: (d) => Math.min(1, Object.keys(d.lessons).length / 1) },
  { id: 'assessed', name: 'Mapped', desc: 'Complete the placement assessment.', icon: 'map', cat: 'First Steps', check: (d) => (d.assessment ? 1 : 0) },
  { id: 'ten-sessions', name: 'Regular', desc: 'Complete 10 sessions.', icon: 'calendar-check', cat: 'First Steps', check: (d) => Math.min(1, d.sessions.length / 10) },

  { id: 'clean-95', name: 'Steady Hand', desc: 'Finish a session at 95%+ accuracy (40+ chars).', icon: 'target', cat: 'Accuracy', check: (d) => Math.min(1, cleanSessions(d, 95)) },
  { id: 'clean-98', name: 'Surgeon', desc: 'Finish a session at 98%+ accuracy.', icon: 'stethoscope', cat: 'Accuracy', check: (d) => Math.min(1, cleanSessions(d, 98)) },
  { id: 'flawless', name: 'Flawless', desc: 'A perfect 100% session of 40+ characters.', icon: 'gem', cat: 'Accuracy', check: (d) => Math.min(1, cleanSessions(d, 100)) },
  { id: 'lab-rat', name: 'Precision Artist', desc: 'Complete 5 Accuracy Lab sessions.', icon: 'microscope', cat: 'Accuracy', check: (d) => Math.min(1, d.sessions.filter((s) => s.mode === 'accuracy').length / 5) },

  { id: 'wpm-25', name: 'Breeze', desc: 'Reach 25 WPM at 90%+ accuracy.', icon: 'leaf', cat: 'Speed', check: (d) => Math.min(1, bestWpm(d) / 25) },
  { id: 'wpm-40', name: 'Glider', desc: 'Reach 40 WPM at 90%+ accuracy.', icon: 'feather', cat: 'Speed', check: (d) => Math.min(1, bestWpm(d) / 40) },
  { id: 'wpm-60', name: 'Falcon', desc: 'Reach 60 WPM at 90%+ accuracy.', icon: 'bird', cat: 'Speed', check: (d) => Math.min(1, bestWpm(d) / 60) },
  { id: 'wpm-80', name: 'Tempest', desc: 'Reach 80 WPM at 90%+ accuracy.', icon: 'tornado', cat: 'Speed', check: (d) => Math.min(1, bestWpm(d) / 80) },
  { id: 'wpm-100', name: 'Lightning Hands', desc: 'Reach 100 WPM at 90%+ accuracy.', icon: 'zap', cat: 'Speed', check: (d) => Math.min(1, bestWpm(d) / 100) },

  { id: 'smooth-70', name: 'Metronome', desc: 'Score 70+ consistency in a session.', icon: 'music', cat: 'Consistency', check: (d) => Math.min(1, Math.max(0, ...d.sessions.map((s) => s.consistency)) / 70) },
  { id: 'rhythm-5', name: 'Groove Keeper', desc: 'Complete 5 Rhythm sessions.', icon: 'drum', cat: 'Consistency', check: (d) => Math.min(1, d.sessions.filter((s) => s.mode === 'rhythm').length / 5) },

  { id: 'chars-10k', name: 'Ten Thousand Steps', desc: 'Type 10,000 characters in total.', icon: 'milestone', cat: 'Endurance', check: (d) => Math.min(1, totalChars(d) / 10000) },
  { id: 'chars-50k', name: 'Letter Marathon', desc: 'Type 50,000 characters in total.', icon: 'route', cat: 'Endurance', check: (d) => Math.min(1, totalChars(d) / 50000) },
  { id: 'hours-5', name: 'Five Hours Deep', desc: 'Practise for 5 hours in total.', icon: 'hourglass', cat: 'Endurance', check: (d) => Math.min(1, totalMinutes(d) / 300) },
  { id: 'long-walk', name: 'The Long Walk', desc: 'Finish an Endurance session.', icon: 'signpost', cat: 'Endurance', check: (d) => Math.min(1, d.sessions.filter((s) => s.mode === 'endurance').length) },

  { id: 'home-hero', name: 'Heartlands Hero', desc: 'Every home-row key reliable or better.', icon: 'wheat', cat: 'Technique', check: (d) => {
    const med = globalMedianMs(d.keyStats);
    const home = layoutGroups(d.profile.layout).homeAll;
    const ok = home.filter((k) => ['reliable', 'mastered'].includes(masteryOf(d.keyStats[k], med))).length;
    return home.length ? ok / home.length : 0;
  } },
  { id: 'alphabet-lit', name: 'Alphabet Aglow', desc: '20 letters at Improving or better.', icon: 'sun', cat: 'Technique', check: (d) => {
    const med = globalMedianMs(d.keyStats);
    const ok = 'abcdefghijklmnopqrstuvwxyz'.split('').filter((k) => ['improving', 'reliable', 'mastered'].includes(masteryOf(d.keyStats[k], med))).length;
    return Math.min(1, ok / 20);
  } },
  { id: 'blind-faith', name: 'Blind Faith', desc: 'Complete a Lights Out (blind keyboard) session.', icon: 'eye-off', cat: 'Technique', check: (d) => Math.min(1, d.sessions.filter((s) => s.mode === 'blind').length) },

  { id: 'mode-explorer', name: 'Mode Explorer', desc: 'Try 6 different training modes.', icon: 'compass', cat: 'Exploration', check: (d) => Math.min(1, new Set(d.sessions.map((s) => s.mode)).size / 6) },
  { id: 'gamer-3', name: 'Arcade Cartographer', desc: 'Play four different arcade games.', icon: 'gamepad', cat: 'Exploration', check: (d) => Math.min(1, Object.keys(d.gameBests).length / 4) },
  { id: 'zen-10', name: 'Still Waters', desc: 'Spend 10 minutes in Zen mode.', icon: 'flower', cat: 'Exploration', check: (d) => Math.min(1, d.sessions.filter((s) => s.mode === 'zen').reduce((a, s) => a + s.seconds, 0) / 600) },
  { id: 'forge-5', name: 'Apprentice Smith', desc: 'Forge 5 items in Keyforge.', icon: 'hammer', cat: 'Exploration', check: (d) => Math.min(1, d.forge.length / 5) },

  { id: 'first-race', name: 'Off the Line', desc: 'Finish your first race.', icon: 'flag', cat: 'Competition', check: (d) => Math.min(1, d.race.races) },
  { id: 'race-win', name: 'Comet Catcher', desc: 'Win a race.', icon: 'rocket', cat: 'Competition', check: (d) => Math.min(1, d.race.wins) },
  { id: 'race-10', name: 'Circuit Regular', desc: 'Finish 10 races.', icon: 'gauge', cat: 'Competition', check: (d) => Math.min(1, d.race.races / 10) },
  { id: 'daily-1', name: 'Challenger', desc: 'Complete a Daily Challenge.', icon: 'calendar', cat: 'Competition', check: (d) => Math.min(1, Object.keys(d.daily).length) },

  { id: 'streak-3', name: 'Kindling', desc: 'A 3-day practice streak.', icon: 'lamp', cat: 'Streaks', check: (d) => Math.min(1, streakFrom(d.days) / 3) },
  { id: 'streak-7', name: 'Week of Flow', desc: 'A 7-day practice streak.', icon: 'flame', cat: 'Streaks', check: (d) => Math.min(1, streakFrom(d.days) / 7) },
  { id: 'streak-30', name: 'Eternal Flame', desc: 'A 30-day practice streak.', icon: 'sparkles', cat: 'Streaks', check: (d) => Math.min(1, streakFrom(d.days) / 30) },

  { id: 'comeback', name: 'The Return', desc: 'Practise again after a week away.', icon: 'rainbow', cat: 'Comebacks', check: (d) => {
    for (let i = 1; i < d.sessions.length; i++) {
      if (d.sessions[i].endedAt - d.sessions[i - 1].endedAt > 7 * 86400_000) return 1;
    }
    return 0;
  } },

  { id: 'coder', name: 'Bracket Whisperer', desc: 'Complete 3 code-typing sessions.', icon: 'braces', cat: 'Specialist', check: (d) => Math.min(1, d.sessions.filter((s) => s.mode === 'code').length / 3) },
  { id: 'numerist', name: 'Peak Bagger', desc: 'Complete 3 number sessions.', icon: 'peaks', cat: 'Specialist', check: (d) => Math.min(1, d.sessions.filter((s) => s.mode === 'numbers').length / 3) },
  { id: 'listener', name: 'Golden Ear', desc: 'Complete a dictation session.', icon: 'headphones', cat: 'Specialist', check: (d) => Math.min(1, d.sessions.filter((s) => s.mode === 'dictation').length) },

  { id: 'night-echo', name: 'The Quiet Hour', desc: '???', icon: 'moon', cat: 'Secret', secret: true, check: (d) => Math.min(1, d.sessions.filter((s) => s.mode === 'zen' && s.seconds >= 180).length) },
  { id: 'century', name: 'The Century Line', desc: '???', icon: 'stamp', cat: 'Secret', secret: true, check: (d) => Math.min(1, d.sessions.filter((s) => s.typed >= 100 && s.acc === 100).length) },
];

export function badgeProgress(d: ProfileData): Record<string, number> {
  const out: Record<string, number> = {};
  for (const b of BADGES) {
    try { out[b.id] = Math.max(0, Math.min(1, b.check(d))); } catch { out[b.id] = 0; }
  }
  return out;
}

export function newlyUnlocked(d: ProfileData): string[] {
  const out: string[] = [];
  for (const b of BADGES) {
    if (d.badges[b.id]) continue;
    try { if (b.check(d) >= 1) out.push(b.id); } catch { /* skip */ }
  }
  return out;
}

export const BADGE_CATS = ['First Steps', 'Accuracy', 'Speed', 'Consistency', 'Endurance', 'Technique', 'Exploration', 'Competition', 'Streaks', 'Comebacks', 'Specialist', 'Secret'] as const;
