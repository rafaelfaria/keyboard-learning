// Auth seam.
//
// Today KeyTopia is local-first: "signing in" activates a locally stored profile and
// "signing out" simply deactivates it. Every UI call-site goes through this adapter,
// so hooking up a real backend later means changing ONLY this file:
//
//   signIn(id)  -> POST /auth/session (exchange credentials, hydrate profile from DB)
//   signOut()   -> DELETE /auth/session (clear cookie/token, flush pending sync)
//   currentUserId() -> read from the server-backed session instead of local state
//
// The functions are async on purpose so network implementations slot in unchanged.

import { useStore } from './store';

export const auth = {
  currentUserId(): string | null {
    return useStore.getState().activeId;
  },

  async signIn(profileId: string): Promise<void> {
    useStore.getState().switchProfile(profileId);
  },

  async signOut(): Promise<void> {
    useStore.getState().signOut();
  },
};
