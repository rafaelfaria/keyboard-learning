import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useData, useStore, useUi } from '../lib/store';
import { buildModeText } from '../lib/adaptive';
import type { Rewards, SessionMode, SessionResult } from '../lib/types';
import { GhostInput, LiveStats, TypingText, useTypingSession } from '../components/typing';
import { KeyboardVisual } from '../components/KeyboardVisual';
import { Btn, Chip, Seg } from '../components/ui';
import { PauseModal, ResultsPanel } from '../components/ResultsPanel';
import { nextAction, sessionInsight } from '../lib/coach';
import { snd, speak, startZen, stopSpeak, stopZen } from '../lib/sound';
import { recentAvgWpm } from '../lib/challenge';
import { Ic } from '../components/icons';

interface ModeMeta {
  id: SessionMode;
  name: string;
  icon: string;
  desc: string;
  skill: string;
  pre?: 'duration' | 'copy' | 'dictation';
  precisionFirst?: boolean;
  untimedOk?: boolean;
}

export const MODES: ModeMeta[] = [
  { id: 'adaptive', name: 'Adaptive practice', icon: 'brain', desc: 'Every set is generated from your Mastery Map. Weak keys and slow transitions get extra reps without feeling repetitive.', skill: 'Personal weak spots' },
  { id: 'weakkeys', name: 'Weak-key workout', icon: 'dumbbell', desc: 'A short, concentrated session on your single weakest key and its neighbourhood.', skill: 'Targeted repair' },
  { id: 'speed', name: 'Speed sprint', icon: 'zap', desc: 'A classic timed test on common words. Choose your distance and fly.', skill: 'Raw speed', pre: 'duration' },
  { id: 'accuracy', name: 'Accuracy Lab', icon: 'target', desc: 'Precision-first scoring: errors cost everything, speed counts for little. Slow down and paint clean lines.', skill: 'Error-free control', precisionFirst: true, untimedOk: true },
  { id: 'rhythm', name: 'Rhythm studio', icon: 'waves', desc: 'A gentle pulse marks your target pace. Try to land every keystroke on the beat: smooth beats fast.', skill: 'Consistent timing' },
  { id: 'zen', name: 'Zen typing', icon: 'flower', desc: 'Ambient sound, soft words, no rankings, statistics hidden until the end. Just you and the keys.', skill: 'Calm & flow', untimedOk: true },
  { id: 'endurance', name: 'The long walk', icon: 'route', desc: 'A long passage that rewards a sustainable pace from first line to last.', skill: 'Stamina & focus' },
  { id: 'realworld', name: 'Real-world desk', icon: 'clipboard', desc: 'Emails, meeting notes and updates. The typing you actually do at school and work.', skill: 'Practical writing' },
  { id: 'code', name: 'Code forge', icon: 'braces', desc: 'JavaScript, Python, HTML, CSS, SQL and shell. Brackets, symbols and indentation included.', skill: 'Symbols & syntax' },
  { id: 'numbers', name: 'Numeral Peaks', icon: 'peaks', desc: 'Quantities, times and decimals. Long reaches, steady returns.', skill: 'Number row' },
  { id: 'dictation', name: 'Dictation booth', icon: 'headphones', desc: 'Listen and type what you hear. Replay as often as you like.', skill: 'Ear-to-finger recall', pre: 'dictation' },
  { id: 'copy', name: 'Copy desk', icon: 'file', desc: 'Paste any text of your own and practise typing it. It never leaves this device.', skill: 'Your own material', pre: 'copy' },
  { id: 'blind', name: 'Lights out', icon: 'eye-off', desc: 'The on-screen keyboard fades as you progress. Learn to trust your fingers.', skill: 'Typing without looking' },
  { id: 'recovery', name: 'Recovery training', icon: 'lifebuoy', desc: 'Tricky words are planted on purpose. Practise staying calm after a miss and rebuilding rhythm fast.', skill: 'Composure after errors' },
  { id: 'checkpoint', name: 'Camp checkpoint', icon: 'tent', desc: 'A calm mixed review of everything you\'ve learned so far. Optional, badge-worthy, never a gate.', skill: 'Retention & recall' },
];

export default function TrainSession() {
  const { mode: modeParam } = useParams();
  const nav = useNavigate();
  const data = useData();
  const recordSession = useStore((s) => s.recordSession);
  const patch = useStore((s) => s.patch);
  const celebrate = useUi((s) => s.celebrate);
  const pushToast = useUi((s) => s.pushToast);

  const meta = MODES.find((m) => m.id === modeParam) ?? MODES[0];
  const [phase, setPhase] = useState<'pre' | 'run' | 'done'>('pre');
  const [duration, setDuration] = useState(60);
  const [customText, setCustomText] = useState('');
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const [finished, setFinished] = useState<{ result: SessionResult; rewards: Rewards } | null>(null);
  const [paused, setPaused] = useState(false);
  const [pulse, setPulse] = useState(false);

  useEffect(() => { setPhase('pre'); setFinished(null); setSeed(Math.floor(Math.random() * 1e9)); }, [modeParam]);

  const gen = useMemo(
    () => (data ? buildModeText(meta.id, data, { seconds: duration, seed, custom: customText }) : null),
    [data?.profile.id, meta.id, duration, seed, phase === 'run' ? 1 : 0],
  );

  const timeLimit = meta.id === 'speed' && !data?.settings.untimed ? duration : undefined;

  const session = useTypingSession(
    {
      text: gen?.text || ' ',
      mode: meta.id,
      label: gen?.label ?? meta.name,
      correction: meta.id === 'accuracy' ? 'standard' : data?.settings.correction ?? 'standard',
      timeLimitSec: timeLimit,
      stopOnComplete: true,
      keepTimeline: true,
    },
    {
      soundOn: data?.settings.soundOn && meta.id !== 'zen',
      disabled: phase !== 'run' || paused,
      onEscape: () => setPaused(true),
      onFinish: (r) => {
        if (meta.id === 'speed') r.extra = { duration };
        if (!data) return;
        stopZen();
        const rewards = recordSession(r);
        if (meta.id === 'copy' === false) void 0;
        if (data.settings.soundOn) snd.done();
        if (rewards.levelUp) celebrate({ kind: 'level', icon: 'party', title: `Level ${rewards.levelUp}!`, body: 'New themes and avatars may be waiting in Settings.' });
        else if (rewards.badges.length) pushToast({ kind: 'badge', icon: 'medal', title: 'Badge unlocked!', body: 'See it in your collection.' });
        if (rewards.records.length) pushToast({ kind: 'record', icon: 'trophy', title: 'New personal record!' });
        setFinished({ result: r, rewards });
        setPhase('done');
      },
    },
  );

  // Rhythm metronome
  const targetIki = data ? Math.max(140, Math.min(420, 12000 / Math.max(10, recentAvgWpm(data)))) : 250;
  useEffect(() => {
    if (meta.id !== 'rhythm' || phase !== 'run' || paused) return;
    const int = window.setInterval(() => {
      setPulse(true);
      if (data?.settings.soundOn) snd.tick();
      setTimeout(() => setPulse(false), 140);
    }, targetIki * 2);
    return () => window.clearInterval(int);
  }, [meta.id, phase, paused, targetIki, data?.settings.soundOn]);

  // Zen ambience
  useEffect(() => {
    if (meta.id === 'zen' && phase === 'run' && data?.settings.soundOn) startZen();
    return () => stopZen();
  }, [meta.id, phase, data?.settings.soundOn]);

  useEffect(() => () => { stopSpeak(); stopZen(); }, []);

  if (!data) return null;

  const blindHide = meta.id === 'blind' && session.engine.text.length > 0 && session.engine.pos / session.engine.text.length > 0.3;

  const start = () => {
    if (meta.id === 'copy' && customText.trim().length < 12) return;
    setSeed(Math.floor(Math.random() * 1e9));
    setPhase('run');
    setTimeout(session.focus, 60);
    if (meta.id === 'dictation') setTimeout(() => speak(gen?.text ?? '', 0.92), 300);
  };

  if (phase === 'pre') {
    return (
      <div className="train-page">
        <div className="mode-intro">
          <span className="mode-ic"><Ic n={meta.icon} size={46} /></span>
          <h1>{meta.name}</h1>
          <p>{meta.desc}</p>
          <Chip tone="accent">Trains: {meta.skill}</Chip>
          {meta.pre === 'duration' && (
            <div className="duration-row" role="radiogroup" aria-label="Test duration">
              {[15, 30, 60, 120, 300].map((d) => (
                <button key={d} type="button" className={`btn ${duration === d ? 'btn-primary' : 'btn-soft'}`} onClick={() => setDuration(d)} aria-pressed={duration === d}>
                  {d < 60 ? `${d}s` : `${d / 60}min`}
                </button>
              ))}
            </div>
          )}
          {meta.pre === 'copy' && (
            <div style={{ width: '100%', textAlign: 'left' }}>
              <label className="small muted" htmlFor="copy-in">Paste or write your text (12–2000 characters)</label>
              <textarea id="copy-in" className="copy-input" value={customText} maxLength={2000} onChange={(e) => setCustomText(e.target.value)} placeholder="Paste an article paragraph, your study notes, song-free lyrics of your own…" />
              <p className="small muted" style={{ marginTop: 6 }}>Privacy: this text is processed only in your browser. It is not uploaded or stored unless you tap "Save to my library".</p>
              {customText.trim().length >= 12 && (
                <Btn kind="ghost" onClick={() => { patch((d) => { if (!d.customTexts.includes(customText.trim())) d.customTexts.push(customText.trim()); }); pushToast({ kind: 'info', icon: 'save', title: 'Saved to your library' }); }}><Ic n="save" size={15} /> Save to my library</Btn>
              )}
              {data.customTexts.length > 0 && (
                <div className="row gap wrap" style={{ marginTop: 8 }}>
                  {data.customTexts.slice(-4).map((t, i) => (
                    <button key={i} type="button" className="chip" onClick={() => setCustomText(t)}>{t.slice(0, 28)}…</button>
                  ))}
                </div>
              )}
            </div>
          )}
          {meta.pre === 'dictation' && (
            <p className="small muted">{'speechSynthesis' in window ? 'Your browser can speak the text aloud. Use the Replay button anytime.' : 'Your browser does not support speech. The text will be shown instead.'}</p>
          )}
          {meta.id === 'accuracy' && <p className="small muted">Scoring: accuracy × 10 + a small speed bonus. A 100% run beats any fast messy one.</p>}
          {meta.id === 'rhythm' && <p className="small muted">Your pulse is set near your recent pace ({Math.round(60000 / targetIki / 5)} wpm). Land keystrokes evenly: the bar flashes on each beat.</p>}
          <div className="row gap">
            <Btn big onClick={start} disabled={meta.pre === 'copy' && customText.trim().length < 12}>Start →</Btn>
            <Btn kind="ghost" to="/app/practice">← All modes</Btn>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'done' && finished) {
    return (
      <div className="train-page">
        <div className="train-top"><h1><Ic n={meta.icon} size={20} /> {meta.name}: result</h1></div>
        {meta.id === 'accuracy' && (
          <p className="center" style={{ fontSize: '1.1rem' }}>
            Lab score: <strong style={{ color: 'var(--accent)' }}>{Math.round(finished.result.acc * 10 + Math.min(finished.result.wpm, 40))}</strong>
            {finished.result.acc === 100 && <Chip tone="gold" className="chip"> Flawless!</Chip>}
          </p>
        )}
        <ResultsPanel
          result={finished.result}
          rewards={finished.rewards}
          insight={sessionInsight(data, finished.result)}
          next={nextAction(data, finished.result)}
          onRetry={() => { setFinished(null); setPhase('pre'); }}
          precisionFirst={meta.precisionFirst}
          soundOn={data.settings.soundOn}
          extraActions={<Btn kind="ghost" to="/app/practice">All modes</Btn>}
        />
      </div>
    );
  }

  const stageClass = meta.id === 'zen' ? 'zen-stage' : 'train-stage';
  return (
    <div className="train-page" onClick={session.focus}>
      <div className="train-top">
        <Btn kind="ghost" onClick={() => nav('/app/practice')} ariaLabel="Exit session">←</Btn>
        <h1><Ic n={meta.icon} size={20} /> {gen?.label ?? meta.name}</h1>
        {meta.id === 'dictation' && <Btn kind="soft" onClick={() => speak(gen?.text ?? '', 0.92)}><Ic n="volume" size={15} /> Replay</Btn>}
        {meta.id === 'dictation' && <Btn kind="ghost" onClick={() => speak(gen?.text ?? '', 0.7)}><Ic n="turtle" size={15} /> Slower</Btn>}
        <Btn kind="ghost" onClick={() => setPaused(true)} ariaLabel="Pause"><Ic n="pause" size={17} /></Btn>
      </div>

      {(meta.id === 'adaptive' || meta.id === 'weakkeys') && gen && (
        <div className="why-box"><strong>Why this set:</strong> {gen.why}</div>
      )}

      <div className={stageClass} style={{ position: 'relative' }}>
        {meta.id === 'zen' && <div className="zen-breath" aria-hidden />}
        <TypingText
          engine={session.engine}
          caret={data.settings.caret}
          big={data.profile.ageGroup === 'kid'}
          focused={session.focused}
          onClick={session.focus}
          masked={meta.id === 'dictation' && 'speechSynthesis' in window}
        />
        <GhostInput bind={session.bindInput} />
        {meta.id !== 'zen' ? (
          <LiveStats engine={session.engine} showWpm={data.settings.showLiveWpm && !meta.precisionFirst} untimed={data.settings.untimed && meta.id !== 'speed'} />
        ) : (
          <p className="center muted small">stats are waiting quietly at the end · esc to pause</p>
        )}
        {meta.id === 'rhythm' && <div className={`rhythm-pulse ${pulse ? 'pulse-on' : ''}`} aria-hidden />}
        {data.settings.showKeyboard && meta.id !== 'zen' && data.settings.guide !== 'hidden' && (
          <div className="train-kbd">
            <KeyboardVisual
              layout={data.profile.layout}
              guide={data.settings.guide === 'hands' ? 'zones' : data.settings.guide}
              nextChar={meta.id === 'blind' ? undefined : session.engine.text[session.engine.pos]}
              lastPress={session.engine.lastPress}
              hiddenLabels={blindHide ? 'all' : undefined}
              compact={meta.id === 'blind'}
            />
            {meta.id === 'blind' && blindHide && <p className="center muted small" style={{ marginTop: 6 }}>Labels off. Your fingers remember.</p>}
          </div>
        )}
      </div>

      <PauseModal
        open={paused}
        onResume={() => { setPaused(false); setTimeout(session.focus, 50); }}
        onRestart={() => { setPaused(false); setPhase('pre'); }}
        onExit={() => nav('/app/practice')}
      />
    </div>
  );
}
