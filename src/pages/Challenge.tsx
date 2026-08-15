import { useMemo, useState } from 'react';
import { useData, useStore, useUi } from '../lib/store';
import { dailyChallenge, scoreFor } from '../lib/challenge';
import { Leaderboard } from '../components/Leaderboard';
import { submitBestDailyScore } from '../lib/leaderboard';
import { GhostInput, LiveStats, TypingText, useTypingSession } from '../components/typing';
import { Btn, Card, Chip, Stat } from '../components/ui';
import { ResultsPanel } from '../components/ResultsPanel';
import { sessionInsight, nextAction } from '../lib/coach';
import type { Rewards, SessionResult } from '../lib/types';
import { snd } from '../lib/sound';
import { Ic } from '../components/icons';

export default function Challenge() {
  const data = useData();
  const recordSession = useStore((s) => s.recordSession);
  const patch = useStore((s) => s.patch);
  const pushToast = useUi((s) => s.pushToast);
  const [phase, setPhase] = useState<'view' | 'run' | 'done'>('view');
  const [finished, setFinished] = useState<{ result: SessionResult; rewards: Rewards } | null>(null);

  const spec = useMemo(() => (data ? dailyChallenge(data.profile.ageGroup) : null), [data?.profile.ageGroup]);
  const myResult = data && spec ? data.daily[spec.key] : undefined;

  const session = useTypingSession(
    { text: spec?.text ?? ' ', mode: 'challenge', label: spec?.title ?? 'Daily', correction: 'standard', stopOnComplete: true, keepTimeline: true },
    {
      soundOn: data?.settings.soundOn,
      disabled: phase !== 'run',
      onFinish: (r) => {
        if (!data || !spec) return;
        const rewards = recordSession(r);
        patch((d) => {
          const score = scoreFor(spec.mode, r.wpm, r.acc, r.rhythm);
          const prev = d.daily[spec.key];
          if (!prev || score > scoreFor(spec.mode, prev.wpm, prev.acc, 70)) {
            d.daily[spec.key] = { wpm: r.wpm, acc: r.acc, rank: 0 };
          }
        });
        // Publishing is deliberately not awaited: the score is already saved
        // locally, so a slow or absent network must not hold up the results
        // screen. The board reconciles on its next read.
        void submitBestDailyScore(data, spec, r);
        if (data.settings.soundOn) snd.done();
        if (rewards.badges.length) pushToast({ kind: 'badge', icon: 'medal', title: 'Badge unlocked!' });
        setFinished({ result: r, rewards });
        setPhase('done');
      },
    },
  );

  if (!data || !spec) return null;

  if (phase === 'run') {
    return (
      <div className="train-page" onClick={session.focus}>
        <div className="train-top">
          <Btn kind="ghost" onClick={() => setPhase('view')} ariaLabel="Exit challenge">←</Btn>
          <h1><Ic n={spec.icon} size={20} /> {spec.title}</h1>
          <Chip tone="accent">{spec.mode} scoring</Chip>
        </div>
        <div className="train-stage">
          <TypingText engine={session.engine} caret={data.settings.caret} focused={session.focused} onClick={session.focus} />
          <GhostInput bind={session.bindInput} />
          <LiveStats engine={session.engine} showWpm={spec.mode !== 'accuracy'} />
        </div>
      </div>
    );
  }

  if (phase === 'done' && finished) {
    return (
      <div className="train-page">
        <div className="train-top"><h1><Ic n={spec.icon} size={20} /> {spec.title} — submitted</h1></div>
        <p className="center">
          Today's score: <strong style={{ color: 'var(--accent)', fontSize: '1.3rem' }}>{scoreFor(spec.mode, finished.result.wpm, finished.result.acc, finished.result.rhythm)}</strong>
        </p>
        <ResultsPanel
          result={finished.result}
          rewards={finished.rewards}
          insight={sessionInsight(data, finished.result)}
          next={nextAction(data, finished.result)}
          onRetry={() => { setFinished(null); setPhase('run'); setTimeout(session.restart, 30); }}
          soundOn={data.settings.soundOn}
          extraActions={<Btn kind="ghost" onClick={() => setPhase('view')}>Today's board</Btn>}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1><Ic n="calendar" size={24} /> Daily Challenge</h1>
          <p>One fresh, fair test each day — same text for everyone in your division. Resets at midnight.</p>
        </div>
      </div>
      <div className="grid2">
        <Card className="dash-today">
          <div className="dash-kicker">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</div>
          <h2><Ic n={spec.icon} size={22} /> {spec.title}</h2>
          <p>{spec.desc}</p>
          {myResult && <Chip tone="good" className="chip">Your best today: {myResult.wpm} wpm · {myResult.acc}%</Chip>}
          <div style={{ marginTop: 14 }}>
            <Btn big onClick={() => { setPhase('run'); setTimeout(session.focus, 80); }}>{myResult ? '↻ Improve today\'s score' : 'Take the challenge →'}</Btn>
          </div>
        </Card>
        {data.settings.hideLeaderboards ? (
          <Card>
            <div className="row spread">
              <h3><Ic n="medal" size={17} /> Leaderboards</h3>
              <Chip>Hidden in your settings</Chip>
            </div>
            <p className="muted small" style={{ marginTop: 10 }}>
              You've chosen a board-free experience, so nothing is uploaded and no board is shown.
              Your daily results still count toward streaks and records. Change anytime in Settings.
            </p>
          </Card>
        ) : (
          <Leaderboard data={data} spec={spec} />
        )}
      </div>
    </div>
  );
}
