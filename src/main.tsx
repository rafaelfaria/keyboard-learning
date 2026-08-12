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
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/who" element={<ProfilePicker />} />
        <Route path="/app" element={<AppShell />}>
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
