import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData, useStore, levelInfo } from '../lib/store';
import { Ic } from '../components/icons';
import { CharacterSprite } from '../components/avatars';
import { Bar, Btn, Card } from '../components/ui';
import {
  COLLECTIONS, FACES, HAIR_COLORS, OUTFIT_COLORS, SKINS,
  applyKind, collectionProgress, decodeCharacter, describeCharacter, encodeCharacter,
  isPartOpen, isSwatchOpen, partsFor, randomCharacter, unlockedCount, unlocksAt,
  type Character, type Collection, type Expression, type PartDef, type Swatch, type SwatchKey,
} from '../lib/character';

const PART_SLOTS = ['hair', 'eyes', 'mouth', 'gear', 'outfit', 'aura'] as const;
type PartSlot = typeof PART_SLOTS[number];

type Tab = 'character' | 'face' | PartSlot | 'colour';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'character', label: 'Character', icon: 'users' },
  { id: 'face', label: 'Face', icon: 'smile' },
  { id: 'hair', label: 'Hair', icon: 'feather' },
  { id: 'eyes', label: 'Eyes', icon: 'eye' },
  { id: 'mouth', label: 'Mouth', icon: 'chat' },
  { id: 'gear', label: 'Gear', icon: 'crown' },
  { id: 'outfit', label: 'Outfit', icon: 'backpack' },
  { id: 'aura', label: 'Aura', icon: 'sparkles' },
  { id: 'colour', label: 'Colour', icon: 'palette' },
];

const EXPRESSIONS: { id: Expression; label: string }[] = [
  { id: 'happy', label: 'Happy' },
  { id: 'focused', label: 'Focused' },
  { id: 'excited', label: 'Excited' },
  { id: 'chill', label: 'Chill' },
  { id: 'oops', label: 'Oops!' },
];

export default function ExplorerBuilder() {
  const data = useData();
  const nav = useNavigate();
  const patch = useStore((s) => s.patch);
  const saved = data?.profile.avatar ?? '';
  /** Old "bk:" avatars decode to a real character, so compare like for like. */
  const baseline = encodeCharacter(decodeCharacter(saved));
  const [draft, setDraft] = useState<Character>(() => decodeCharacter(saved));
  const [tab, setTab] = useState<Tab>('character');
  const [expr, setExpr] = useState<Expression>('happy');
  if (!data) return null;

  const lvl = levelInfo(data.xp);
  const level = lvl.level;
  const dirty = encodeCharacter(draft) !== baseline;
  const unlocked = unlockedCount(level);

  const set = (p: Partial<Character>) => setDraft((d) => ({ ...d, ...p }));
  const setKind = (kindId: string) => setDraft((d) => applyKind(d, kindId, level));
  const save = () => {
    patch((d) => { d.profile.avatar = encodeCharacter(draft); });
    nav('/app/profile');
  };

  /** The next level that opens something new, and what it opens. */
  const nextUnlock = useMemo(() => {
    for (let l = level + 1; l <= 40; l++) {
      const items = unlocksAt(l);
      if (items.length) return { level: l, items };
    }
    return null;
  }, [level]);

  return (
    <div className="xb">
      <div className="page-head">
        <div>
          <h1>Build your explorer</h1>
          <p className="muted">Create a character that's uniquely you. New parts unlock as you level up.</p>
        </div>
        <div className="xb-level">
          <div className="row gap" style={{ alignItems: 'baseline' }}>
            <strong>Level {level}</strong>
            <span className="small muted">{lvl.into} / {lvl.need} xp</span>
          </div>
          <Bar value={lvl.into / lvl.need} height={7} />
          <span className="small muted">{unlocked.have} of {unlocked.total} parts unlocked</span>
        </div>
      </div>

      <div className="xb-grid">
        <div className="xb-stage">
          <Card className="xb-preview">
            <div className="xb-preview-art">
              <CharacterSprite ch={draft} size={200} expr={expr} />
            </div>
            <div className="xb-expr" role="group" aria-label="Preview expression">
              {EXPRESSIONS.map((e) => (
                <button
                  key={e.id} type="button"
                  className={`xb-expr-btn ${expr === e.id ? 'on' : ''}`}
                  onClick={() => setExpr(e.id)} aria-pressed={expr === e.id}
                  aria-label={`Preview the ${e.label.toLowerCase()} face`}
                >
                  <CharacterSprite ch={draft} size={38} expr={e.id} title={`${e.label} face`} />
                  <small>{e.label}</small>
                </button>
              ))}
            </div>
            <p className="small muted xb-desc">{describeCharacter(draft)}</p>
            <div className="xb-actions">
              <Btn kind="soft" onClick={() => setDraft(randomCharacter(level))}>
                <Ic n="dice" size={15} /> Surprise me
              </Btn>
              <Btn onClick={save} disabled={!dirty}>
                {dirty ? 'Save explorer' : 'Saved'}
              </Btn>
            </div>
            {dirty && (
              <button type="button" className="xb-revert" onClick={() => setDraft(decodeCharacter(saved))}>
                Undo my changes
              </button>
            )}
          </Card>

          {nextUnlock && (
            <Card className="xb-next">
              <h3><Ic n="lock" size={15} /> Next unlock</h3>
              <p className="small muted">
                Reach <strong>level {nextUnlock.level}</strong> to open{' '}
                {nextUnlock.items.slice(0, 3).map((i) => i.name).join(', ')}
                {nextUnlock.items.length > 3 ? ` and ${nextUnlock.items.length - 3} more` : ''}.
              </p>
            </Card>
          )}
        </div>

        <Card className="xb-panel">
          <div className="xb-tabs" role="tablist" aria-label="Character parts">
            {TABS.map((t) => (
              <button
                key={t.id} type="button" role="tab" id={`xb-tab-${t.id}`}
                aria-selected={tab === t.id} aria-controls="xb-tabpanel"
                className={`xb-tab ${tab === t.id ? 'on' : ''}`}
                onClick={() => setTab(t.id)}
              >
                <Ic n={t.icon} size={18} />
                <small>{t.label}</small>
              </button>
            ))}
          </div>

          <div className="xb-tabpanel" id="xb-tabpanel" role="tabpanel" aria-labelledby={`xb-tab-${tab}`}>
            {tab === 'character' && <KindPicker draft={draft} level={level} onPick={setKind} />}
            {tab === 'face' && (
              <OptionGrid
                title="Choose a face shape"
                items={FACES.map((f) => ({ id: f.id, name: f.name, level: f.level }))}
                current={draft.face} level={level} draft={draft}
                preview={(id) => ({ ...draft, face: id })}
                onPick={(id) => set({ face: id })}
              />
            )}
            {PART_SLOTS.includes(tab as PartSlot) && (
              <SlotPicker slot={tab as PartSlot} draft={draft} level={level} onPick={set} />
            )}
            {tab === 'colour' && <ColourPicker draft={draft} level={level} onPick={set} />}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ pickers

function KindPicker({ draft, level, onPick }: { draft: Character; level: number; onPick: (id: string) => void }) {
  return (
    <div className="col" style={{ gap: 20 }}>
      {COLLECTIONS.map((col) => {
        const prog = collectionProgress(col.id as Collection, level);
        return (
          <section key={col.id}>
            <div className="xb-sec-head">
              <div>
                <h4>{col.name}</h4>
                <p className="small muted">{col.blurb}</p>
              </div>
              <span className="chip small">{prog.have} / {prog.total} unlocked</span>
            </div>
            <div className="xb-opts">
              {prog.kinds.map((k) => {
                const locked = k.level > level;
                const preview = applyKind(draft, k.id, Math.max(level, k.level));
                return (
                  <button
                    key={k.id} type="button"
                    className={`xb-opt ${draft.kind === k.id ? 'on' : ''} ${locked ? 'locked' : ''}`}
                    disabled={locked} onClick={() => onPick(k.id)}
                    aria-pressed={draft.kind === k.id}
                    aria-label={locked ? `${k.name}, unlocks at level ${k.level}` : `${k.name}. ${k.blurb}`}
                    title={locked ? `Unlocks at level ${k.level}` : k.blurb}
                  >
                    <CharacterSprite ch={preview} size={52} title="" />
                    <small>{k.name}</small>
                    {locked && <span className="xb-lock"><Ic n="lock" size={9} /> Lv {k.level}</span>}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

const SLOT_TITLE: Record<PartSlot, string> = {
  hair: 'Choose a hairstyle', eyes: 'Choose the eyes', mouth: 'Choose the mouth',
  gear: 'Choose the gear', outfit: 'Choose an outfit', aura: 'Choose an aura',
};

function SlotPicker({ slot, draft, level, onPick }: {
  slot: PartSlot; draft: Character; level: number; onPick: (p: Partial<Character>) => void;
}) {
  const parts: PartDef[] = partsFor(slot, draft.kind);
  return (
    <OptionGrid
      title={SLOT_TITLE[slot]}
      items={parts.map((p) => ({
        id: p.id, name: p.name, level: p.level, open: isPartOpen(draft, slot, p, level),
      }))}
      current={draft[slot]} level={level} draft={draft}
      preview={(id) => ({ ...draft, [slot]: id })}
      onPick={(id) => onPick({ [slot]: id } as Partial<Character>)}
    />
  );
}

interface Option { id: string; name: string; level: number; open?: boolean }

function OptionGrid({ title, items, current, level, preview, onPick }: {
  title: string;
  items: Option[];
  current: string; level: number; draft: Character;
  preview: (id: string) => Character;
  onPick: (id: string) => void;
}) {
  const isOpen = (i: Option) => i.open ?? i.level <= level;
  const open = items.filter(isOpen);
  const locked = items.filter((i) => !isOpen(i));
  const tile = (i: Option, isLocked: boolean) => (
    <button
      key={i.id} type="button"
      className={`xb-opt ${current === i.id ? 'on' : ''} ${isLocked ? 'locked' : ''}`}
      disabled={isLocked} onClick={() => onPick(i.id)} aria-pressed={current === i.id}
      aria-label={isLocked ? `${i.name}, unlocks at level ${i.level}` : i.name}
      title={isLocked ? `Unlocks at level ${i.level}` : i.name}
    >
      <CharacterSprite ch={preview(i.id)} size={52} title="" />
      <small>{i.name}</small>
      {isLocked && <span className="xb-lock"><Ic n="lock" size={9} /> Lv {i.level}</span>}
    </button>
  );
  return (
    <div className="col" style={{ gap: 18 }}>
      <section>
        <h4 className="xb-h4">{title}</h4>
        <div className="xb-opts">{open.map((i) => tile(i, false))}</div>
      </section>
      {locked.length > 0 && (
        <section>
          <h4 className="xb-h4 muted">Unlock more</h4>
          <div className="xb-opts">{locked.map((i) => tile(i, true))}</div>
        </section>
      )}
    </div>
  );
}

function ColourPicker({ draft, level, onPick }: {
  draft: Character; level: number; onPick: (p: Partial<Character>) => void;
}) {
  const rows: { label: string; list: Swatch[]; value: number; key: SwatchKey }[] = [
    { label: 'Skin, fur and scales', list: SKINS, value: draft.skin, key: 'skin' },
    { label: 'Hair, feathers and manes', list: HAIR_COLORS, value: draft.hairColor, key: 'hairColor' },
    { label: 'Outfit', list: OUTFIT_COLORS, value: draft.outfitColor, key: 'outfitColor' },
  ];
  return (
    <div className="col" style={{ gap: 18 }}>
      {rows.map((r) => (
        <section key={r.label}>
          <h4 className="xb-h4">{r.label}</h4>
          <div className="xb-swatches">
            {r.list
              .map((s, i) => ({ s, i }))
              .sort((a, b) => Number(!isSwatchOpen(draft, r.key, a.i, level)) - Number(!isSwatchOpen(draft, r.key, b.i, level)))
              .map(({ s, i }) => {
              const locked = !isSwatchOpen(draft, r.key, i, level);
              return (
                <button
                  key={s.id} type="button"
                  className={`xb-swatch ${r.value === i ? 'on' : ''} ${locked ? 'locked' : ''}`}
                  style={{ background: s.c, borderColor: s.s }}
                  disabled={locked} onClick={() => onPick({ [r.key]: i } as Partial<Character>)}
                  aria-pressed={r.value === i}
                  aria-label={locked ? `${s.name}, unlocks at level ${s.level}` : s.name}
                  title={locked ? `${s.name} — unlocks at level ${s.level}` : s.name}
                >
                  {locked && <span className="xb-swatch-lock">{s.level}</span>}
                  {r.value === i && !locked && <Ic n="check" size={14} />}
                </button>
              );
            })}
          </div>
        </section>
      ))}
      <p className="small muted">
        A creature's own colours come with it, so a frog is green from the start. The rest
        of the palette opens as you level up.
      </p>
    </div>
  );
}
