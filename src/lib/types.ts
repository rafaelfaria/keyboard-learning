export type AgeGroup = 'kid' | 'teen' | 'adult';
export type Goal = 'basics' | 'school' | 'work' | 'speed' | 'accuracy' | 'fun' | 'code';
export type CoachStyle = 'calm' | 'energetic' | 'teacher' | 'competitive' | 'minimal';
export type LayoutId = 'qwerty' | 'qwertz' | 'azerty' | 'dvorak' | 'colemak';
export type GuideStyle = 'hands' | 'zones' | 'plain' | 'hidden';
export type CaretStyle = 'bar' | 'block' | 'under';
export type Correction = 'standard' | 'strict';
export type ThemeId =
  | 'porcelain' | 'midnight' | 'neon' | 'ocean' | 'wildwood' | 'terminal'
  | 'paper' | 'pastel' | 'contrast' | 'meadow' | 'cosmos' | 'ember';

export type SessionMode =
  | 'lesson' | 'adaptive' | 'weakkeys' | 'speed' | 'accuracy' | 'rhythm' | 'zen'
  | 'endurance' | 'realworld' | 'code' | 'numbers' | 'dictation' | 'copy'
  | 'blind' | 'recovery' | 'checkpoint' | 'game' | 'race' | 'challenge' | 'assessment';

export interface Profile {
  id: string;
  name: string;
  avatar: string;
  ageGroup: AgeGroup;
  goal: Goal;
  looksAtKeyboard: 'always' | 'sometimes' | 'rarely';
  experience: 'new' | 'some' | 'confident';
  layout: LayoutId;
  competitive: boolean;
  coach: CoachStyle;
  createdAt: number;
}

export interface Settings {
  theme: ThemeId;
  fontScale: number;            // 0.9 | 1 | 1.15 | 1.3
  reducedMotion: boolean;
  dyslexiaFont: boolean;
  soundOn: boolean;
  volume: number;               // 0..1
  guide: GuideStyle;
  showKeyboard: boolean;
  showHands: boolean;
  caret: CaretStyle;
  correction: Correction;
  focusMode: boolean;
  speakTargets: boolean;
  untimed: boolean;
  unlockAll: boolean;
  hideLeaderboards: boolean;
  coachFreq: 'high' | 'normal' | 'low' | 'off';
  showLiveWpm: boolean;
  kidWorld?: boolean;
}

export interface KeyStat { a: number; e: number; ms: number; n: number }

export type KeyMastery = 'new' | 'learning' | 'improving' | 'reliable' | 'mastered' | 'review';

export interface StrokeT { t: number; key: string; ok: boolean }

export interface SessionResult {
  id: string;
  mode: SessionMode;
  label: string;
  endedAt: number;
  seconds: number;
  typed: number;
  correct: number;
  errors: number;
  corrected: number;
  uncorrected: number;
  backspaces: number;
  words: number;
  wpm: number;
  raw: number;
  acc: number;                  // 0..100
  adjusted: number;
  consistency: number;          // 0..100
  rhythm: number;               // 0..100
  hesitations: number;
  keyAgg: Record<string, KeyStat>;
  slowPairs: [string, number][];
  errorPairs: [string, number][];
  timeline?: StrokeT[];
  ikis?: number[];
  seeded?: boolean;
  extra?: Record<string, number | string | boolean>;
}

export interface LessonProgress { stars: number; wpm: number; acc: number; t: number }

export interface AssessmentResult {
  wpm: number; raw: number; acc: number; consistency: number; rhythm: number;
  reactionMs: number; backspaceRate: number; hesitationRate: number;
  weakKeys: string[]; slowKeys: string[]; weakPairs: string[];
  likelyLooking: boolean; level: number; rank: string;
  insight: string; t: number;
}

export interface Mission {
  id: string; label: string; goal: number; progress: number; done: boolean; icon: string;
}

export interface ForgeItem { id: string; name: string; rarity: number; icon: string; t: number }

export interface RaceRecord { races: number; wins: number; podiums: number; bestWpm: number }

export interface GhostRun { wpm: number; acc: number; curve: number[]; t: number }

export interface ProfileData {
  profile: Profile;
  settings: Settings;
  keyStats: Record<string, KeyStat>;
  sessions: SessionResult[];
  records: Record<string, { v: number; t: number }>;
  xp: number;
  days: Record<string, number>;            // dayKey -> minutes
  dailyGoalMin: number;
  lessons: Record<string, LessonProgress>;
  badges: Record<string, number>;          // badgeId -> unlockedAt
  missions: { week: string; list: Mission[] };
  daily: Record<string, { wpm: number; acc: number; rank: number }>;
  unlockedThemes: ThemeId[];
  unlockedAvatars: string[];
  forge: ForgeItem[];
  gameBests: Record<string, { score: number; level: number }>;
  race: RaceRecord;
  ghost: GhostRun | null;
  assessment: AssessmentResult | null;
  planStage: number;
  customTexts: string[];
  seedCleared?: boolean;
  /** Journey cosmetics only — world unlock/completion is derived from `lessons`. */
  journey?: { lastWorld?: string };
  /** Per-section last-write stamps for the future sync layer (plan §8). Missing = 0. */
  touched?: Record<string, number>;
}

export interface Rewards {
  xp: number;
  levelUp: number | null;
  badges: string[];
  records: string[];
  missionsDone: string[];
}
