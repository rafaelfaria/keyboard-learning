import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom';
import '@fontsource-variable/manrope';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/600.css';
import '@fontsource/atkinson-hyperlegible/400.css';
import '@fontsource/atkinson-hyperlegible/700.css';
import './styles/base.css';
import './styles/app.css';
import './styles/landing.css';
import './styles/public.css';
import './styles/mock.css';
import './styles/classroom.css';
import { AppShell, ThemeSync } from './components/Shell';
import Landing from './pages/Landing';
import Onboarding from './pages/Onboarding';
import ProfilePicker from './pages/ProfilePicker';
import { HomeGate } from './pages/KidHome';
import Learn from './pages/Learn';
import LessonPlayer from './pages/LessonPlayer';
import PracticeHub from './pages/PracticeHub';
import TrainSession from './pages/TrainSession';
import Games from './pages/Games';
import WordfallGame from './pages/WordfallGame';
import KeyforgeGame from './pages/KeyforgeGame';
import WordflightGame from './pages/WordflightGame';
import DuelGame from './pages/DuelGame';
import CipherGame from './pages/CipherGame';
import StackGame from './pages/StackGame';
import SurvivorGame from './pages/SurvivorGame';
import RaceHub from './pages/RaceHub';
import RaceLive from './pages/RaceLive';
import Challenge from './pages/Challenge';
import ProgressHub from './pages/ProgressHub';
import BadgesPage from './pages/BadgesPage';
import Family from './pages/Family';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import {
  AdaptivePracticePage, AnalyticsPage, CurriculumPage, FaqPage, GlossaryPage,
  KidsPage, LearnToTypePage, PracticeModesPage, PrivacyPage, RacesPage,
  SchoolsPage, TermsPage, TypingGamesPage,
} from './pages/public/pages';
import { TypingTestPage } from './pages/public/TypingTest';
import { AuthCallback, RequireAccount } from './components/Account';
import SignIn from './pages/SignIn';
import CreateProfile from './pages/CreateProfile';
import JoinClass from './pages/JoinClass';
import { startSync } from './lib/syncEngine';
import { startClassroomWatch } from './lib/classroom';

class Boundary extends React.Component<{ children: React.ReactNode }, { err: Error | null }> {
  state = { err: null as Error | null };
  static getDerivedStateFromError(err: Error) { return { err }; }
  render() {
    if (this.state.err) {
      return (
        <div style={{ padding: 40, fontFamily: 'sans-serif' }}>
          <h1>Something went off the map</h1>
          <p>{String(this.state.err)}</p>
          <button onClick={() => { this.setState({ err: null }); location.href = '/'; }}>Back to safety</button>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <Boundary>
    <BrowserRouter>
      <ThemeSync />
      <Routes>
        <Route path="/" element={<Landing />} />

        {/* Public, crawlable pages. Each is prerendered to static HTML at build
            time (scripts/prerender.mjs) and registered in src/lib/seo/site.ts —
            adding one here means also adding it there, which is what feeds the
            sitemap, robots.txt, llms.txt and the OG-image generator. */}
        <Route path="/typing-test" element={<TypingTestPage />} />
        <Route path="/learn-to-type" element={<LearnToTypePage />} />
        <Route path="/curriculum" element={<CurriculumPage />} />
        <Route path="/typing-games" element={<TypingGamesPage />} />
        <Route path="/adaptive-practice" element={<AdaptivePracticePage />} />
        <Route path="/typing-practice-modes" element={<PracticeModesPage />} />
        <Route path="/typing-races" element={<RacesPage />} />
        <Route path="/typing-analytics" element={<AnalyticsPage />} />
        <Route path="/typing-for-kids" element={<KidsPage />} />
        <Route path="/typing-for-schools" element={<SchoolsPage />} />
        <Route path="/faq" element={<FaqPage />} />
        <Route path="/typing-glossary" element={<GlossaryPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />

        {/* --- the account boundary -------------------------------------
            Everything above this line is open to anyone and prerendered for
            search engines. Everything below owns saved progress, so it needs a
            session: a profile can never exist outside an account, which is what
            keeps "whose progress is this?" from ever being a question. */}
        <Route path="/signin" element={<SignIn />} />
        {/* Where Google and email sign-in links come back to. Must match the
            redirect allowlist in the Supabase dashboard. */}
        <Route path="/auth/callback" element={<AuthCallback />} />

        <Route path="/welcome" element={<RequireAccount><CreateProfile /></RequireAccount>} />
        <Route path="/who" element={<RequireAccount><ProfilePicker /></RequireAccount>} />
        {/* Joining a class needs an account, but never an email: the sign-in
            page offers a device-bound anonymous seat for students. */}
        <Route path="/join" element={<RequireAccount><JoinClass /></RequireAccount>} />
        {/* The full guided setup with the placement test. Reachable from inside
            the app; no longer the front door. */}
        <Route path="/onboarding" element={<RequireAccount><Onboarding /></RequireAccount>} />
        <Route path="/app" element={<RequireAccount><AppShell /></RequireAccount>}>
          <Route index element={<HomeGate />} />
          <Route path="learn" element={<Learn />} />
          <Route path="lesson/:id" element={<LessonPlayer />} />
          <Route path="practice" element={<PracticeHub />} />
          <Route path="train/:mode" element={<TrainSession />} />
          <Route path="games" element={<Games />} />
          <Route path="arena" element={<Games />} />
          <Route path="games/wordfall" element={<WordfallGame />} />
          <Route path="games/keyforge" element={<KeyforgeGame />} />
          <Route path="games/wordflight" element={<WordflightGame />} />
          <Route path="games/duel" element={<DuelGame />} />
          <Route path="games/cipher" element={<CipherGame />} />
          <Route path="games/stack" element={<StackGame />} />
          <Route path="games/survivor" element={<SurvivorGame />} />
          <Route path="race" element={<RaceHub />} />
          <Route path="race/live" element={<RaceLive />} />
          <Route path="challenge" element={<Challenge />} />
          <Route path="progress" element={<ProgressHub />} />
          <Route path="badges" element={<BadgesPage />} />
          <Route path="family" element={<Family />} />
          <Route path="profile" element={<Profile />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </Boundary>,
);

// Sync starts *after* the first render, never before it: the app must paint
// from localStorage without waiting on any network call (plan §8, instant bar).
// A timeout rather than requestAnimationFrame on purpose — rAF never fires in a
// background tab, which would strand a restored session with sync switched off.
// With no Supabase project configured this is a no-op.
setTimeout(startSync, 0);
// Same contract for the classroom mirror: it watches the store from outside and
// pushes finished daily-challenge runs to class boards in the background, so no
// classroom code sits on the typing path (docs/classrooms-plan.md §2.5).
setTimeout(startClassroomWatch, 0);
