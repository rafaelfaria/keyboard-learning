import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type {
  AgeGroup, AssessmentResult, ProfileData, Profile, Rewards, SessionResult, Settings, ThemeId,
} from './types';
import { dayKey, levelFromXp, streakFrom, weekKey } from './metrics';
import { mergeKeyStats } from './adaptive';
import { newlyUnlocked } from './badges';
import { rollMissions } from './challenge';
import { mulberry32, hashStr, pick, uid } from './rng';
import { buildStages } from './curriculum';
import { COMMON_WORDS, FORGE_ITEMS, FORGE_MATERIALS, FORGE_SUFFIX } from './words';
import { THEMES } from './themes';

function defaultSettings(age: AgeGroup): Settings {
  return {
    theme: age === 'kid' ? 'meadow' : 'midnight',
    fontScale: age === 'kid' ? 1.15 : 1,
    reducedMotion: false,
    dyslexiaFont: false,
    soundOn: true,
    volume: 0.6,
    guide: age === 'kid' ? 'hands' : 'zones',
    showKeyboard: true,
    showHands: age === 'kid',
    caret: 'bar',
    correction: 'standard',
    focusMode: false,
    speakTargets: false,
    untimed: false,
    unlockAll: false,
    hideLeaderboards: false,
    coachFreq: age === 'kid' ? 'high' : 'normal',
    showLiveWpm: age !== 'kid',
    kidWorld: age === 'kid',
  };
}

export function freshData(profile: Profile): ProfileData {
  return {
    profile,
    settings: defaultSettings(profile.ageGroup),
    keyStats: {},
    sessions: [],
    records: {},
    xp: 0,
    days: {},
    dailyGoalMin: profile.ageGroup === 'kid' ? 8 : profile.goal === 'speed' ? 15 : 10,
    lessons: {},
    badges: {},
    missions: rollMissions(profile.ageGroup),
    daily: {},
    unlockedThemes: THEMES.filter((t) => t.level === 0).map((t) => t.id),
    unlockedAvatars: [],
    forge: [],
    gameBests: {},
    race: { races: 0, wins: 0, podiums: 0, bestWpm: 0 },
    ghost: null,
    assessment: null,
    planStage: 0,
    customTexts: [],
    journey: {},
    touched: {},
  };
}

/** Stamp a profile section as changed — the future sync layer diffs on these (plan §8). */
export function touch(d: ProfileData, ...sections: string[]): void {
  d.touched ??= {};
  const now = Date.now();
  for (const s of sections) d.touched[s] = now;
}

// Brand rename migration: carry data saved under the old Typerra key into KeyTopia's.
const STORE_KEY = 'keytopia-v1';
try {
  if (typeof localStorage !== 'undefined' && !localStorage.getItem(STORE_KEY)) {
    const legacy = localStorage.getItem('typerra-v1');
    if (legacy) localStorage.setItem(STORE_KEY, legacy);
  }
} catch { /* private mode etc. */ }

export interface RootState {
  activeId: string | null;
  profiles: Record<string, ProfileData>;
  createProfile: (profile: Omit<Profile, 'id' | 'createdAt'>) => string;
  switchProfile: (id: string) => void;
  deleteProfile: (id: string) => void;
  signOut: () => void;
  patch: (fn: (d: ProfileData) => void) => void;
  recordSession: (r: SessionResult) => Rewards;
  finishAssessment: (a: AssessmentResult, planStage: number, seed: boolean) => void;
  clearSeeded: () => void;
}

function xpFor(r: SessionResult, extraStars: number): number {
  let xp = Math.round((r.seconds / 60) * 12 + r.correct / 22);
  if (r.acc >= 98) xp = Math.round(xp * 1.35);
  else if (r.acc >= 95) xp = Math.round(xp * 1.2);
  if (r.mode === 'lesson') xp += extraStars * 15;
  if (r.mode === 'challenge') xp += 40;
  if (r.mode === 'race') xp += 12;
  return Math.max(2, Math.min(220, xp));
}

function applySession(d: ProfileData, r: SessionResult): Rewards {
  const rewards: Rewards = { xp: 0, levelUp: null, badges: [], records: [], missionsDone: [] };
  const beforeLevel = levelFromXp(d.xp).level;

  // History (cap; keep timelines only on the most recent few)
  d.sessions.push(r);
  if (d.sessions.length > 400) d.sessions.splice(0, d.sessions.length - 400);
  let withTimeline = 0;
  for (let i = d.sessions.length - 1; i >= 0; i--) {
    if (d.sessions[i].timeline) {
      withTimeline++;
      if (withTimeline > 8) delete d.sessions[i].timeline;
    }
    if (d.sessions[i].ikis && withTimeline > 8) delete d.sessions[i].ikis;
  }

  mergeKeyStats(d.keyStats, r.keyAgg);

  const dk = dayKey(r.endedAt);
  d.days[dk] = (d.days[dk] ?? 0) + r.seconds / 60;

  // Records
  const rec = (key: string, v: number, min = 0) => {
    if (v <= min) return;
    const cur = d.records[key]?.v ?? 0;
    if (v > cur) {
      d.records[key] = { v: Math.round(v * 10) / 10, t: r.endedAt };
      if (cur > 0) rewards.records.push(key);
    }
  };
  if (r.acc >= 90 && r.typed >= 30) rec('wpm', r.wpm);
  if (r.typed >= 40) rec('acc', r.acc);
  if (r.typed >= 60) rec('consistency', r.consistency);
  if (r.mode === 'speed' && r.extra?.duration) rec(`sprint${r.extra.duration}`, r.wpm);
  if (r.mode === 'race') {
    d.race.races++;
    if (r.extra?.place === 1) d.race.wins++;
    if (typeof r.extra?.place === 'number' && (r.extra.place as number) <= 3) d.race.podiums++;
    if (r.wpm > d.race.bestWpm && r.acc >= 88) d.race.bestWpm = Math.round(r.wpm * 10) / 10;
  }

  // Missions
  const wk = weekKey(r.endedAt);
  if (d.missions.week !== wk) d.missions = rollMissions(d.profile.ageGroup, new Date(r.endedAt));
  const daysThisWeek = Object.keys(d.days).filter((k) => weekKey(new Date(k + 'T12:00:00')) === wk && d.days[k] > 0).length;
  for (const m of d.missions.list) {
    if (m.done) continue;
    if (m.id === 'days') m.progress = daysThisWeek;
    if (m.id === 'minutes') m.progress += r.seconds / 60;
    if (m.id === 'cleanwords' && r.acc >= 95) m.progress += r.words;
    if (m.id === 'lessons' && r.mode === 'lesson') m.progress += 1;
    if (m.id === 'race' && r.mode === 'race') m.progress += 1;
    if (m.id === 'game' && r.mode === 'game') m.progress += 1;
    if (m.id === 'weak' && r.mode === 'weakkeys') m.progress += 1;
    if (m.progress >= m.goal) {
      m.done = true;
      m.progress = m.goal;
      rewards.missionsDone.push(m.label);
      d.xp += 30;
    }
  }

  // XP + level
  const stars = typeof r.extra?.stars === 'number' ? (r.extra.stars as number) : 0;
  const gained = xpFor(r, stars);
  d.xp += gained;
  rewards.xp = gained;

  // Badges
  const unlocked = newlyUnlocked(d);
  for (const id of unlocked) {
    d.badges[id] = r.endedAt;
    d.xp += 20;
  }
  rewards.badges = unlocked;

  const afterLevel = levelFromXp(d.xp).level;
  if (afterLevel > beforeLevel) rewards.levelUp = afterLevel;

  // Theme unlocks by level
  for (const t of THEMES) {
    if (t.level > 0 && afterLevel >= t.level && !d.unlockedThemes.includes(t.id)) {
      d.unlockedThemes.push(t.id);
    }
  }
  touch(d, 'sessions', 'keyStats', 'xp', 'records', 'days', 'missions', 'badges');
  return rewards;
}

function seedHistory(d: ProfileData, a: AssessmentResult): void {
  const rng = mulberry32(hashStr(d.profile.id));
  const beginner = a.wpm < 12;
  const daysBack = beginner ? 4 : 26;
  const activity = beginner ? 0.5 : 0.62;
  const modes: SessionResult['mode'][] = ['lesson', 'adaptive', 'speed', 'accuracy', 'lesson', 'game', 'race', 'rhythm'];
  const now = Date.now();

  for (let back = daysBack; back >= 1; back--) {
    if (rng() > activity) continue;
    const nSessions = rng() > 0.72 ? 2 : 1;
    for (let s = 0; s < nSessions; s++) {
      const progress = 1 - back / daysBack;
      const wpm = Math.max(6, a.wpm * (0.74 + 0.26 * progress) + (rng() - 0.5) * 6);
      const acc = Math.min(99.4, Math.max(87, a.acc - 3 + progress * 4 + (rng() - 0.5) * 5));
      const seconds = 100 + Math.floor(rng() * 360);
      const typed = Math.round((wpm * 5 * seconds) / 60);
      const endedAt = now - back * 86400_000 + Math.floor(rng() * 8) * 3600_000 - 4 * 3600_000;
      const mode = pick(rng, modes);
      const r: SessionResult = {
        id: uid(), mode, label: 'Practice', endedAt, seconds,
        typed, correct: Math.round(typed * (acc / 100)), errors: Math.round(typed * (1 - acc / 100)),
        corrected: Math.round(typed * (1 - acc / 100) * 0.6), uncorrected: Math.round(typed * (1 - acc / 100) * 0.4),
        backspaces: Math.round(typed * 0.05), words: Math.round(typed / 5),
        wpm: Math.round(wpm * 10) / 10, raw: Math.round(wpm * 1.08 * 10) / 10,
        acc: Math.round(acc * 10) / 10, adjusted: Math.round(wpm * (acc / 100) * 10) / 10,
        consistency: Math.round(42 + progress * 22 + rng() * 14), rhythm: Math.round(40 + progress * 24 + rng() * 14),
        hesitations: Math.floor(rng() * 6), keyAgg: {}, slowPairs: [], errorPairs: [], seeded: true,
      };
      applySession(d, r);
    }
  }

  // Key stats consistent with assessment weaknesses
  const freq = 'etaoinshrdlcumwfgypbvkjxqz';
  const scale = beginner ? 6 : 30;
  for (let i = 0; i < freq.length; i++) {
    const c = freq[i];
    const n = Math.max(0, Math.round((freq.length - i) * scale * (0.6 + rng() * 0.8)));
    if (n < 4) continue;
    const weak = a.weakKeys.includes(c) || a.slowKeys.includes(c);
    const err = weak ? 0.12 + rng() * 0.1 : 0.015 + rng() * 0.05;
    d.keyStats[c] = {
      a: n, e: Math.round(n * err),
      ms: Math.round((weak ? 460 : 300) + (rng() - 0.4) * 90 + i * 5), n,
    };
  }
  if (!beginner) {
    d.keyStats[' '] = { a: scale * 24, e: Math.round(scale * 24 * 0.01), ms: 240, n: scale * 24 };
  }

  // Curriculum progress up to the plan stage
  const stages = buildStages(d.profile.layout);
  for (const st of stages) {
    if (st.id >= d.planStage) break;
    for (const l of st.lessons) {
      d.lessons[l.id] = {
        stars: rng() > 0.35 ? 3 : 2,
        wpm: Math.round(a.wpm * (0.8 + rng() * 0.3)),
        acc: Math.round(92 + rng() * 7),
        t: now - Math.floor(rng() * daysBack) * 86400_000,
      };
    }
  }

  if (!beginner) {
    const forgeCount = 1 + Math.floor(rng() * 2);
    for (let i = 0; i < forgeCount; i++) {
      d.forge.push({
        id: uid(),
        name: `${pick(rng, FORGE_MATERIALS)} ${pick(rng, FORGE_ITEMS)} ${pick(rng, FORGE_SUFFIX)}`,
        rarity: 1 + Math.floor(rng() * 3),
        icon: pick(rng, ['feather', 'compass', 'lamp', 'key', 'bell']),
        t: now - Math.floor(rng() * 10) * 86400_000,
      });
    }
    d.gameBests['wordfall'] = { score: Math.round(400 + rng() * 900), level: 1 + Math.floor(rng() * 3) };
    if (d.race.races === 0) {
      d.race = { races: 2, wins: rng() > 0.5 ? 1 : 0, podiums: 1, bestWpm: Math.round(a.wpm * 0.95) };
    }
    d.ghost = {
      wpm: Math.round(a.wpm * 0.92), acc: Math.round(a.acc - 1),
      curve: Array.from({ length: 20 }, (_, i) => (i + 1) / 20), t: now - 3 * 86400_000,
    };
  }

  // Ensure today shows a warm streak (yesterday + day before active)
  const y1 = dayKey(now - 86400_000);
  const y2 = dayKey(now - 2 * 86400_000);
  if (!beginner) {
    d.days[y1] = Math.max(d.days[y1] ?? 0, 6);
    d.days[y2] = Math.max(d.days[y2] ?? 0, 5);
  }
}

export const useStore = create<RootState>()(
  persist(
    immer((set, get) => ({
      activeId: null,
      profiles: {},

      createProfile(p) {
        const id = uid();
        const profile: Profile = { ...p, id, createdAt: Date.now() };
        set((s) => {
          s.profiles[id] = freshData(profile);
          s.activeId = id;
        });
        return id;
      },

      switchProfile(id) {
        set((s) => { if (s.profiles[id]) s.activeId = id; });
      },

      signOut() {
        set((s) => { s.activeId = null; });
      },

      deleteProfile(id) {
        set((s) => {
          delete s.profiles[id];
          if (s.activeId === id) s.activeId = Object.keys(s.profiles)[0] ?? null;
        });
      },

      patch(fn) {
        set((s) => {
          const d = s.activeId ? s.profiles[s.activeId] : null;
          if (d) fn(d);
        });
      },

      recordSession(r) {
        let rewards: Rewards = { xp: 0, levelUp: null, badges: [], records: [], missionsDone: [] };
        set((s) => {
          const d = s.activeId ? s.profiles[s.activeId] : null;
          if (d) rewards = applySession(d, r);
        });
        return rewards;
      },

      finishAssessment(a, planStage, seed) {
        set((s) => {
          const d = s.activeId ? s.profiles[s.activeId] : null;
          if (!d) return;
          d.assessment = a;
          d.planStage = planStage;
          if (seed && !d.sessions.some((x) => x.seeded)) seedHistory(d, a);
        });
      },

      clearSeeded() {
        set((s) => {
          const d = s.activeId ? s.profiles[s.activeId] : null;
          if (!d) return;
          d.sessions = d.sessions.filter((x) => !x.seeded);
          d.seedCleared = true;
        });
      },
    })),
    {
      name: STORE_KEY,
      version: 4,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ activeId: s.activeId, profiles: s.profiles }),
      migrate: (persisted) => {
        const s = persisted as { activeId: string | null; profiles: Record<string, ProfileData> };
        const iconMap: Record<string, string> = {
          '📅': 'calendar-check', '⏱': 'timer', '🎯': 'target', '📘': 'book',
          '🏁': 'rocket', '🕹': 'gamepad', '💪': 'dumbbell',
          '🪶': 'feather', '🧭': 'compass', '🏮': 'lamp', '🗝': 'key', '🎐': 'bell',
        };
        for (const d of Object.values(s?.profiles ?? {})) {
          if (d.profile && !d.profile.avatar?.startsWith('bk:')) {
            d.profile.avatar = `bk:${hashStr(d.profile.id + d.profile.avatar) % 14}`;
          }
          if (d.settings && d.settings.kidWorld === undefined) {
            d.settings.kidWorld = d.profile?.ageGroup === 'kid';
          }
          for (const m of d.missions?.list ?? []) if (iconMap[m.icon]) m.icon = iconMap[m.icon];
          for (const f of d.forge ?? []) if (iconMap[f.icon]) f.icon = iconMap[f.icon];
          // v4: journey cosmetics + sync stamps (world progress itself derives
          // from `lessons`, so old profiles land at the right stop untouched)
          d.journey ??= {};
          d.touched ??= {};
          for (const sess of d.sessions ?? []) sess.id ||= uid();
        }
        return s;
      },
    },
  ),
);

export function useData(): ProfileData | null {
  return useStore((s) => (s.activeId ? s.profiles[s.activeId] ?? null : null));
}

export function activeData(): ProfileData | null {
  const s = useStore.getState();
  return s.activeId ? s.profiles[s.activeId] ?? null : null;
}

export function levelInfo(xp: number) {
  return levelFromXp(xp);
}

export function currentStreak(d: ProfileData): number {
  return streakFrom(d.days);
}

// ---------- transient UI store ----------

export interface Toast { id: string; kind: 'badge' | 'record' | 'level' | 'info' | 'mission'; title: string; body?: string; icon?: string }

interface UiState {
  toasts: Toast[];
  celebration: { kind: 'level' | 'badge' | 'stars'; title: string; body: string; icon: string } | null;
  pushToast: (t: Omit<Toast, 'id'>) => void;
  dismissToast: (id: string) => void;
  celebrate: (c: UiState['celebration']) => void;
  clearCelebration: () => void;
}

export const useUi = create<UiState>((set) => ({
  toasts: [],
  celebration: null,
  pushToast(t) {
    const id = uid();
    set((s) => ({ toasts: [...s.toasts, { ...t, id }].slice(-4) }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), 5200);
  },
  dismissToast(id) {
    set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }));
  },
  celebrate(c) { set({ celebration: c }); },
  clearCelebration() { set({ celebration: null }); },
}));

export function randomKidName(): string {
  const rng = mulberry32(Math.floor(Math.random() * 1e9));
  const adj = ['Sunny', 'Brave', 'Merry', 'Swift', 'Clever', 'Happy', 'Bright', 'Kind', 'Jolly', 'Calm'];
  const noun = ['Maple', 'Comet', 'Robin', 'Otter', 'Clover', 'Pine', 'Meadow', 'Harbor', 'Falcon', 'Delta'];
  return `${pick(rng, adj)}${pick(rng, noun)}${String(Math.floor(rng() * 90) + 10)}`;
}

export function suggestWordSetLabel(): string {
  return pick(mulberry32(Date.now() % 100000), COMMON_WORDS);
}
