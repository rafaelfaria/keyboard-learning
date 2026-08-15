import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';

/**
 * Private rooms for The Lightstream.
 *
 * A room is a Supabase Realtime channel and nothing else: no table, no row, no
 * cleanup job. Presence is the lobby (who is here, who is ready) and broadcast
 * is the race (start, progress, finish). A room therefore exists exactly as
 * long as somebody is standing in it, which is the correct lifetime for a
 * thing whose whole purpose is "type this with my friend right now".
 *
 * Two deliberate constraints, both about children:
 *
 *   No discovery. You reach a room by holding its code. Nothing enumerates
 *   rooms, so a stranger cannot wander into one.
 *   No free text. The only strings that cross the wire are the display name and
 *   avatar already on the profile, plus the race text, which the host picks
 *   from the bundled sentence list. There is no chat channel to moderate.
 *
 * With no Supabase project configured the module reports `roomsLive() === false`
 * and the caller falls back to a practice room against simulated friends, the
 * same degrade-rather-than-fail rule the leaderboards follow.
 */

export interface RoomPlayer {
  id: string;
  name: string;
  avatar: string;
  ready: boolean;
  /** Epoch ms. Earliest player in the room is the host. */
  joinedAt: number;
  you?: boolean;
}

export type RoomPhase = 'connecting' | 'open' | 'empty' | 'racing' | 'error';

/**
 * The countdown, not a shared clock, is what lines the racers up: three seconds
 * of 3-2-1 absorbs the message latency, and it needs no agreement between
 * machines whose wall clocks can differ by whole seconds.
 */
export interface RoomStartPayload {
  text: string;
}

export interface RoomListeners {
  onPlayers?: (players: RoomPlayer[]) => void;
  onPhase?: (phase: RoomPhase, error?: string) => void;
  onStart?: (p: RoomStartPayload) => void;
  onProgress?: (id: string, progress: number, wpm: number) => void;
  onFinish?: (id: string, wpm: number, acc: number) => void;
}

/** Rooms only carry real people when there is a project to carry them. */
export function roomsLive(): boolean {
  return Boolean(supabase);
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no O/0, I/1
export function makeRoomCode(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const body = Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
  return `TYP-${body}`;
}

export function normalizeCode(raw: string): string {
  const cleaned = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const body = cleaned.startsWith('TYP') ? cleaned.slice(3) : cleaned;
  return body ? `TYP-${body.slice(0, 6)}` : '';
}

/** How long a joiner waits for somebody else's presence before calling the code dead. */
const EMPTY_ROOM_GRACE_MS = 2200;

export class Room {
  readonly code: string;
  readonly me: RoomPlayer;
  players: RoomPlayer[] = [];
  phase: RoomPhase = 'connecting';
  error: string | null = null;

  private channel: RealtimeChannel | null = null;
  private listeners: RoomListeners = {};
  private graceTimer = 0;
  private lastProgressSent = 0;

  private constructor(code: string, me: RoomPlayer) {
    this.code = code;
    this.me = me;
  }

  /**
   * `expectOthers` separates the two doors into a room. A host is alone on
   * purpose; a joiner alone means the code was wrong, and saying so beats
   * leaving a child staring at an empty lobby that will never fill.
   */
  static open(
    code: string,
    me: { id: string; name: string; avatar: string },
    opts: { expectOthers: boolean },
  ): Room {
    const room = new Room(code, { ...me, ready: !opts.expectOthers ? true : false, joinedAt: Date.now(), you: true });
    room.connect(opts.expectOthers);
    current = room;
    return room;
  }

  private connect(expectOthers: boolean) {
    if (!supabase) { this.setPhase('error', 'Rooms need an internet connection.'); return; }

    const ch = supabase.channel(`ktroom:${this.code}`, {
      config: { presence: { key: this.me.id }, broadcast: { self: true } },
    });
    this.channel = ch;

    ch.on('presence', { event: 'sync' }, () => this.syncPresence());
    ch.on('broadcast', { event: 'start' }, ({ payload }) => {
      this.setPhase('racing');
      this.listeners.onStart?.(payload as RoomStartPayload);
    });
    ch.on('broadcast', { event: 'progress' }, ({ payload }) => {
      const p = payload as { id: string; p: number; wpm: number };
      if (p.id !== this.me.id) this.listeners.onProgress?.(p.id, p.p, p.wpm);
    });
    ch.on('broadcast', { event: 'finish' }, ({ payload }) => {
      const p = payload as { id: string; wpm: number; acc: number };
      if (p.id !== this.me.id) this.listeners.onFinish?.(p.id, p.wpm, p.acc);
    });

    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        void ch.track({ name: this.me.name, avatar: this.me.avatar, ready: this.me.ready, joinedAt: this.me.joinedAt });
        this.setPhase('open');
        if (expectOthers) {
          this.graceTimer = window.setTimeout(() => {
            if (this.players.length <= 1 && this.phase === 'open') {
              this.setPhase('empty', `Nobody is in room ${this.code} right now. Check the code, or ask your friend to create the room first.`);
            }
          }, EMPTY_ROOM_GRACE_MS);
        }
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        this.setPhase('error', 'Lost the connection to the room.');
      }
    });
  }

  private syncPresence() {
    if (!this.channel) return;
    const state = this.channel.presenceState<{ name: string; avatar: string; ready: boolean; joinedAt: number }>();
    const players: RoomPlayer[] = Object.entries(state).flatMap(([id, entries]) => {
      const e = entries[0];
      if (!e) return [];
      return [{ id, name: e.name, avatar: e.avatar, ready: Boolean(e.ready), joinedAt: e.joinedAt, you: id === this.me.id }];
    });
    // Stable order, and the same order on every screen: joined-at, then id.
    players.sort((a, b) => (a.joinedAt - b.joinedAt) || a.id.localeCompare(b.id));
    this.players = players;
    if (players.length > 1 && this.phase === 'empty') this.setPhase('open');
    this.listeners.onPlayers?.(players);
  }

  private setPhase(phase: RoomPhase, error?: string) {
    this.phase = phase;
    this.error = error ?? null;
    this.listeners.onPhase?.(phase, error);
  }

  on(listeners: RoomListeners): void {
    this.listeners = { ...this.listeners, ...listeners };
    // A late subscriber still needs the state that arrived before it existed.
    if (this.players.length) listeners.onPlayers?.(this.players);
  }

  /** Host is whoever has been here longest, so it survives the creator leaving. */
  get isHost(): boolean {
    return this.players.length === 0 || this.players[0]?.id === this.me.id;
  }

  get allReady(): boolean {
    return this.players.length >= 2 && this.players.every((p) => p.ready);
  }

  setReady(ready: boolean): void {
    this.me.ready = ready;
    void this.channel?.track({ name: this.me.name, avatar: this.me.avatar, ready, joinedAt: this.me.joinedAt });
  }

  start(text: string): void {
    void this.channel?.send({ type: 'broadcast', event: 'start', payload: { text } });
  }

  /** Throttled: lanes are drawn at 25fps, so 10 messages a second is plenty. */
  sendProgress(progress: number, wpm: number): void {
    const now = Date.now();
    if (now - this.lastProgressSent < 100) return;
    this.lastProgressSent = now;
    void this.channel?.send({ type: 'broadcast', event: 'progress', payload: { id: this.me.id, p: progress, wpm } });
  }

  sendFinish(wpm: number, acc: number): void {
    void this.channel?.send({ type: 'broadcast', event: 'finish', payload: { id: this.me.id, wpm, acc } });
  }

  /** Back to the lobby after a race, so a rematch keeps the same friends. */
  reopen(): void {
    if (this.phase === 'racing') this.setPhase('open');
    this.setReady(this.isHost);
  }

  leave(): void {
    window.clearTimeout(this.graceTimer);
    this.listeners = {};
    void this.channel?.unsubscribe();
    this.channel = null;
    if (current === this) current = null;
  }
}

/**
 * The room outlives the hub screen: navigating into the race must not drop the
 * connection, and coming back should land in the lobby you were already in.
 */
let current: Room | null = null;
export function currentRoom(): Room | null { return current; }
