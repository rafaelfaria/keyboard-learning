import type { CoachStyle, ProfileData, SessionResult } from './types';
import { weakKeys } from './adaptive';
import { streakFrom } from './metrics';

export const COACH_STYLES: Record<CoachStyle, { name: string; desc: string; emoji: string }> = {
  calm:        { name: 'Calm Guide',       desc: 'Quiet, steady, encouraging', emoji: 'moon' },
  energetic:   { name: 'Energetic Trainer', desc: 'High fives and momentum', emoji: 'zap' },
  teacher:     { name: 'Friendly Teacher', desc: 'Clear explanations, warm tone', emoji: 'apple' },
  competitive: { name: 'Competitive Coach', desc: 'Records, rivals, next targets', emoji: 'flag' },
  minimal:     { name: 'Minimal Coach',    desc: 'One short line, only when useful', emoji: 'minus' },
};

function tone(style: CoachStyle, calm: string, hype: string, teach: string, comp: string): string {
  switch (style) {
    case 'energetic': return hype;
    case 'teacher': return teach;
    case 'competitive': return comp;
    case 'minimal': return calm.split('.')[0] + '.';
    default: return calm;
  }
}

/** Insight for a finished session — layer 2 of the results feedback. */
export function sessionInsight(data: ProfileData, r: SessionResult): string {
  const style = data.profile.coach;
  const weak = weakKeys({ ...data.keyStats });
  const topPair = r.errorPairs[0];
  const slowPair = r.slowPairs[0];

  if (r.acc < 88) {
    const k = Object.entries(r.keyAgg).filter(([, s]) => s.e > 0).sort((a, b) => b[1].e - a[1].e)[0]?.[0];
    const kTxt = k ? ` Most misses landed on ${k === ' ' ? 'the space bar' : k.toUpperCase()}.` : '';
    return tone(style,
      `Accuracy slipped below 88%.${kTxt} Drop the pace by about ten percent — control first, speed will follow on its own.`,
      `Speed demon! Let's aim the power:${kTxt} ease off ~10% and watch accuracy jump right back.`,
      `When accuracy drops under 90%, errors start rehearsing themselves.${kTxt} Slow slightly until you hold 95%, then build back up.`,
      `That pace outran your control.${kTxt} Champions bank accuracy first — take the next run 10% slower and post a cleaner number.`);
  }
  if (r.acc >= 97 && r.consistency < 55 && r.typed > 60) {
    return tone(style,
      'Beautifully clean typing. Your next gain is rhythm — the gaps between keystrokes vary a lot. Try Rhythm mode and let the pulse even you out.',
      'Laser accurate! Now let\'s smooth the groove — your timing jumps around. One Rhythm ride and you\'ll feel the difference.',
      'Accuracy is excellent. Notice the rhythm score: uneven intervals cost speed without causing errors. A metronome session will translate that accuracy into pace.',
      'Clean sheet — but your split times are uneven. Smooth rhythm is free speed. Take a Rhythm session, then re-test.');
  }
  if (topPair && r.errors >= 3) {
    const [pair] = topPair;
    const nice = pair.replace(' ', '␣');
    return tone(style,
      `The ${nice.toUpperCase()} transition caused most of your misses. A two-minute focus drill on that movement will quietly fix it.`,
      `One villain today: the ${nice.toUpperCase()} move! Hit a weak-key workout and take it down.`,
      `Errors cluster on the ${nice.toUpperCase()} transition — usually a finger leaving home early. Practise that pair slowly, watching the guide hand stay anchored.`,
      `${nice.toUpperCase()} is stealing your accuracy. Drill it now, then rematch your best.`);
  }
  if (slowPair && r.wpm > 20) {
    const [pair, ms] = slowPair;
    return tone(style,
      `Smooth run. Your slowest link is ${pair.replace(' ', '␣').toUpperCase()} at about ${Math.round(ms)}ms — one focused drill will unstick it.`,
      `Solid pace! Biggest speed unlock: the ${pair.replace(' ', '␣').toUpperCase()} move (~${Math.round(ms)}ms). Drill it and fly.`,
      `Good control. The ${pair.replace(' ', '␣').toUpperCase()} transition is your slowest at ~${Math.round(ms)}ms; slow transitions usually mean the finger starts moving late. Anticipate the next letter as you press the current one.`,
      `~${Math.round(ms)}ms on ${pair.replace(' ', '␣').toUpperCase()} is your bottleneck. Shave it and your WPM moves.`);
  }
  if (weak.length) {
    const names = weak.slice(0, 3).map((w) => w.key.toUpperCase()).join(', ');
    return tone(style,
      `Nice work. Across recent sessions, ${names} remain your softest keys — the adaptive practice is already weighting them for you.`,
      `Great session! Next boss fight: ${names}. Adaptive practice has them loaded up.`,
      `Well done. Your longer-term pattern shows ${names} lagging the rest of the map; a weak-key workout twice this week will close the gap.`,
      `Good numbers. ${names} are still costing you — clear them and your rank climbs.`);
  }
  return tone(style,
    'A clean, balanced session. Keep this rhythm and the map keeps brightening.',
    'That was smooth! Keep stacking sessions like this one.',
    'A well-balanced session — accuracy, pace and rhythm all in healthy ranges. Consistency over days is now your main lever.',
    'Solid. Same again tomorrow — streaks win seasons.');
}

/** Next-action recommendation — layer 3 of the results feedback. */
export function nextAction(data: ProfileData, r: SessionResult): { label: string; to: string } {
  if (r.acc < 90) return { label: 'Run the Accuracy Lab', to: '/app/train/accuracy' };
  const weak = weakKeys(data.keyStats);
  if (weak.length && weak[0].err > 0.1) return { label: `Weak-key workout: ${weak[0].key.toUpperCase()}`, to: '/app/train/weakkeys' };
  if (r.consistency < 55 && r.typed > 60) return { label: 'Smooth it out in Rhythm mode', to: '/app/train/rhythm' };
  if (r.mode === 'lesson') return { label: 'Continue your journey', to: '/app/learn' };
  if (r.wpm >= 30 && r.acc >= 95) return { label: 'Take on a race', to: '/app/race' };
  return { label: 'Adaptive practice', to: '/app/train/adaptive' };
}

/** Short dashboard tip. */
export function dashboardTip(data: ProfileData): string {
  const style = data.profile.coach;
  const streak = streakFrom(data.days);
  const weak = weakKeys(data.keyStats);
  const recent = data.sessions.slice(-5);
  const today = new Date().toISOString().slice(0, 10);
  const practisedToday = (data.days[today] ?? 0) > 0;

  if (!recent.length) {
    return tone(style,
      'Welcome to KeyTopia. Start with today\'s recommended session — ten focused minutes beats an hour of rushing.',
      'Day one! Smash that first session — ten minutes is all it takes.',
      'Welcome! Begin with the recommended session below; short daily practice builds skill faster than long occasional bursts.',
      'New season starts now. First session sets your baseline — go.');
  }
  if (!practisedToday && streak >= 2) {
    return tone(style,
      `Your ${streak}-day streak is warm. A short session today keeps it alive — even five minutes counts.`,
      `${streak} days strong! Don't let the flame flicker — quick session, let's go!`,
      `You're on a ${streak}-day streak. Daily contact, even brief, is what turns technique into instinct.`,
      `${streak}-day streak on the line. Protect it.`);
  }
  const lastAcc = recent[recent.length - 1].acc;
  if (lastAcc >= 97) {
    return tone(style,
      'Your accuracy is in a lovely place. This is exactly when adding a little speed is safe — try a sprint.',
      'Accuracy: elite. Time to unleash some speed — 60-second sprint, right now!',
      'With accuracy above 97%, your technique can support more pace. A short sprint will show how much headroom you have.',
      'Accuracy locked. Cash it in — sprint and set a number.');
  }
  if (weak.length >= 2) {
    const names = weak.slice(0, 2).map((w) => w.key.toUpperCase()).join(' and ');
    return tone(style,
      `${names} are asking for attention. One weak-key workout today would brighten that corner of your map.`,
      `${names} think they're safe. Prove them wrong — weak-key workout!`,
      `${names} are your current limiters. Targeted reps on them pay off faster than general practice right now.`,
      `${names} are your gap to the next rank. Close it.`);
  }
  return tone(style,
    'Steady progress suits you. Today\'s recommendation is queued below whenever you\'re ready.',
    'Momentum looks great — keep it rolling with today\'s pick!',
    'Everything is trending well. Follow the recommended session to keep the balance of review and new material.',
    'Stay hungry. Today\'s session is queued — beat yesterday.');
}

export function encouragement(style: CoachStyle, kind: 'start' | 'mid' | 'comeback'): string {
  const lines: Record<string, Record<CoachStyle, string>> = {
    start: {
      calm: 'Settle in. Anchors first, then breathe.',
      energetic: 'Fingers ready — let\'s light up some keys!',
      teacher: 'Find your home keys, sit tall, and begin when ready.',
      competitive: 'Clock\'s waiting. Show it something.',
      minimal: 'Ready when you are.',
    },
    mid: {
      calm: 'Nice and steady — you\'re in the flow.',
      energetic: 'You\'re flying — keep that energy!',
      teacher: 'Good form. Keep your eyes on the text, not your hands.',
      competitive: 'Pace is good. Hold the line.',
      minimal: 'Good pace.',
    },
    comeback: {
      calm: 'Welcome back. The keys remembered you.',
      energetic: 'The return! Let\'s shake the rust off fast!',
      teacher: 'Good to see you again — a gentle warm-up first, then we rebuild.',
      competitive: 'Back in the arena. Rust is temporary.',
      minimal: 'Welcome back.',
    },
  };
  return lines[kind][style];
}
