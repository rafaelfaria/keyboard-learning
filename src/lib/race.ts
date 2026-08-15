import type { RacerSpec } from './challenge';

export interface RemoteRacer { id: string; name: string; avatar: string }

export interface RaceSetup {
  kind: 'cpu' | 'ghost' | 'room';
  label: string;
  /** Simulated opponents, driven by the local clock. */
  racers: RacerSpec[];
  text: string;
  withGhost: boolean;
  roomCode?: string;
  /**
   * Real people in the room. Their lanes move only when their own browser says
   * so, which is why they are kept apart from `racers` rather than faked with a
   * RacerSpec that would drift away from the truth.
   */
  remotes?: RemoteRacer[];
  /** True when a live room is driving this race. */
  live?: boolean;
}

let current: RaceSetup | null = null;

export function setRaceSetup(s: RaceSetup): void { current = s; }
export function getRaceSetup(): RaceSetup | null { return current; }
export function clearRaceSetup(): void { current = null; }
