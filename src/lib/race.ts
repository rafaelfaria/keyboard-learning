import type { RacerSpec } from './challenge';

export interface RaceSetup {
  kind: 'cpu' | 'ghost' | 'room';
  label: string;
  racers: RacerSpec[];
  text: string;
  withGhost: boolean;
  roomCode?: string;
}

let current: RaceSetup | null = null;

export function setRaceSetup(s: RaceSetup): void { current = s; }
export function getRaceSetup(): RaceSetup | null { return current; }
export function clearRaceSetup(): void { current = null; }
