import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { activeData, useData, useStore, useUi } from '../lib/store';
import { buildLessonPlan, buildStages, lessonById, nextLesson, starsFor, worldOfLesson, worldProgress } from '../lib/curriculum';
import { worldDef } from '../lib/worlds';
import { GhostInput, LiveStats, TypingText, combineResults, useTypingSession } from '../components/typing';
import { KeyboardVisual, HandsVisual } from '../components/KeyboardVisual';
import { Btn, Chip } from '../components/ui';
import { PauseModal, ResultsPanel } from '../components/ResultsPanel';
import { sessionInsight, nextAction, encouragement } from '../lib/coach';
import type { Rewards, SessionResult } from '../lib/types';
import { snd, speak, stopSpeak } from '../lib/sound';
import { Ic } from '../components/icons';

export default function LessonPlayer() {
  const { id } = useParams();
  const nav = useNavigate();
  const data = useData();
  const recordSession = useStore((s) => s.recordSession);
  const patch = useStore((s) => s.patch);
  const celebrate = useUi((s) => s.celebrate);
  const pushToast = useUi((s) => s.pushToast);

  const lesson = data && id ? lessonById(data.profile.layout, id) : undefined;
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const plan = useMemo(
    () => (data && lesson ? buildLessonPlan(data.profile.layout, lesson, data.profile.ageGroup, seed) : null),
    [data?.profile.layout, lesson?.id, seed],
  );
  const [stepIdx, setStepIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [finished, setFinished] = useState<{ result: SessionResult; rewards: Rewards; stars: number } | null>(null);
  const parts = useRef<SessionResult[]>([]);

  const step = plan?.steps[stepIdx];
  const stages = data ? buildStages(data.profile.layout) : [];
  const stage = lesson ? stages[lesson.stage] : null;

  const session = useTypingSession(
    {
      text: step?.text ?? ' ',
      mode: 'lesson',
      label: lesson?.title ?? 'Lesson',
      correction: data?.settings.correction ?? 'standard',
      stopOnComplete: true,
      keepTimeline: stepIdx === (plan ? plan.steps.length - 1 : 0),
    },
    {
      soundOn: data?.settings.soundOn,
      disabled: paused || !!finished,
      onEscape: () => setPaused(true),
      onFinish: (r) => {
        parts.current.push(r);
        if (plan && stepIdx < plan.steps.length - 1) {
          snd.step();
          setStepIdx((i) => i + 1);
        } else if (plan && lesson && data) {
          const combined = combineResults(parts.current, 'lesson', lesson.title);
          combined.extra = { lessonId: lesson.id };
          const stars = starsFor(plan, combined.wpm, combined.acc);
          combined.extra.stars = stars;
          const world = worldOfLesson(lesson.id, data.profile.layout);
          const wasComplete = worldProgress(data, world.id).complete;
          const rewards = recordSession(combined);
          patch((d) => {
            const prev = d.lessons[lesson.id];
            if (!prev || stars > prev.stars || (stars === prev.stars && combined.wpm > prev.wpm)) {
              d.lessons[lesson.id] = { stars, wpm: combined.wpm, acc: combined.acc, t: Date.now() };
            }
          });
          if (data.settings.soundOn) (stars >= 3 ? snd.badge() : snd.done());
          // World completion beats every other celebration — the plan's "finish the finish"
          const after = activeData();
          const nowComplete = after ? worldProgress(after, world.id).complete : false;
          const kid = data.profile.ageGroup === 'kid' && data.settings.kidWorld !== false;
          const wd = worldDef(world.id);
          if (!wasComplete && nowComplete) {
            celebrate({
              kind: 'level',
              icon: kid ? 'rocket' : 'flag',
              title: kid ? `${wd.kid.kidName} explored!` : `${wd.adult.adultName} — complete!`,
              body: kid
                ? `${wd.kid.landmark} lights up for you. A new island rises on the sea chart…`
                : 'Flag planted. The next leg of the ascent is open.',
            });
          } else if (rewards.levelUp) celebrate({ kind: 'level', icon: 'party', title: `Level ${rewards.levelUp}!`, body: 'New themes and avatars may be waiting in Settings.' });
          else if (rewards.badges.length) pushToast({ kind: 'badge', icon: 'medal', title: 'Badge unlocked!', body: 'See it in your collection.' });
          setFinished({ result: combined, rewards, stars });
        }
      },
    },
  );

  useEffect(() => { session.focus(); }, [stepIdx, seed]);
  useEffect(() => () => stopSpeak(), []);

  // Speak target letters for accessibility / kids
  const posRef = useRef(-1);
  useEffect(() => {
    if (!data?.settings.speakTargets || !step) return;
    const ch = session.engine.text[session.engine.pos];
    if (session.engine.pos !== posRef.current && ch && ch !== ' ') {
      posRef.current = session.engine.pos;
      speak(ch === '\n' ? 'enter' : ch, 1.2);
    }
  });

  if (!data || !lesson || !plan) {
    return <div className="empty"><div className="empty-icon">🧭</div><h3>Lesson not found</h3><p>This trail doesn't exist on your map.</p><Btn to="/app">Back to the map</Btn></div>;
  }

  const kidView = data.profile.ageGroup === 'kid' && data.settings.kidWorld !== false;
  const wd = worldDef(worldOfLesson(lesson.id, data.profile.layout).id);
  const placeName = kidView ? wd.kid.kidName : wd.adult.adultName;

  if (finished) {
    const nextL = nextLesson(data);
    return (
      <div className="train-page">
        <div className="train-top">
          <h1><Ic n={stage?.icon ?? 'map'} size={20} /> {lesson.title} — complete</h1>
          <Chip tone="accent">{placeName}</Chip>
        </div>
        <ResultsPanel
          result={finished.result}
          rewards={finished.rewards}
          stars={finished.stars}
          targets={{ wpm: plan.targetWpm, acc: plan.targetAcc }}
          insight={sessionInsight(data, finished.result)}
          next={finished.stars >= 1 && nextL ? { label: `${kidView ? 'Next stop' : 'Next waypoint'}: ${nextL.title}`, to: `/app/lesson/${nextL.id}` } : nextAction(data, finished.result)}
          onRetry={() => { parts.current = []; setFinished(null); setStepIdx(0); setSeed(Math.floor(Math.random() * 1e9)); }}
          extraActions={<Btn kind="ghost" to="/app"><Ic n="map" size={15} /> {kidView ? 'My World' : 'The trail'}</Btn>}
          soundOn={data.settings.soundOn}
        />
      </div>
    );
  }

  const nextChar = session.engine.text[session.engine.pos];

  return (
    <div className="train-page" onClick={session.focus}>
      <div className="train-top">
        <Btn kind="ghost" onClick={() => nav('/app')} ariaLabel="Exit lesson">←</Btn>
        <h1><Ic n={stage?.icon ?? 'map'} size={20} /> {lesson.title}</h1>
        <div className="step-dots" aria-label={`Step ${stepIdx + 1} of ${plan.steps.length}`}>
          {plan.steps.map((_, i) => <span key={i} className={`step-dot ${i < stepIdx ? 'done' : i === stepIdx ? 'cur' : ''}`} />)}
        </div>
        <Btn kind="ghost" onClick={() => setPaused(true)} ariaLabel="Pause"><Ic n="pause" size={17} /></Btn>
      </div>

      {stepIdx === 0 && !session.engine.started && (
        <div className="lesson-tip">
          <Ic n="bulb" size={22} style={{ color: 'var(--gold)', flex: 'none' }} />
          <p>{lesson.tip} <em className="muted">{encouragement(data.profile.coach, 'start')}</em></p>
        </div>
      )}

      {lesson.newKeys.length > 0 && (
        <div className="row gap wrap" style={{ justifyContent: 'center' }}>
          <span className="small muted">New keys:</span>
          {lesson.newKeys.map((k) => <Chip key={k} tone="accent">{k === ' ' ? 'Space' : k.toUpperCase()}</Chip>)}
        </div>
      )}

      <div className="train-stage">
        <div className="train-label">{step?.label} · step {stepIdx + 1} of {plan.steps.length}</div>
        <TypingText engine={session.engine} caret={data.settings.caret} big={data.profile.ageGroup === 'kid'} focused={session.focused} onClick={session.focus} />
        <GhostInput bind={session.bindInput} />
        <LiveStats engine={session.engine} showWpm={data.settings.showLiveWpm} untimed={data.settings.untimed} />
        {data.settings.showKeyboard && data.settings.guide !== 'hidden' && (
          <div className="train-kbd">
            <KeyboardVisual
              layout={data.profile.layout}
              guide={data.settings.guide === 'hands' ? 'zones' : data.settings.guide}
              nextChar={nextChar}
              lastPress={session.engine.lastPress}
            />
            {(data.settings.guide === 'hands' || data.settings.showHands) && <HandsVisual layout={data.profile.layout} nextChar={nextChar} />}
          </div>
        )}
      </div>

      <PauseModal
        open={paused}
        onResume={() => { setPaused(false); setTimeout(session.focus, 50); }}
        onRestart={() => { parts.current = []; setPaused(false); setStepIdx(0); setSeed(Math.floor(Math.random() * 1e9)); }}
        onExit={() => nav('/app')}
      />
    </div>
  );
}
