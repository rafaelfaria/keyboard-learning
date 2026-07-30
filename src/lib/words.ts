// All content in this file is original, written for KeyTopia.

export const COMMON_WORDS = (
  'the and for are but not you all any can had her was one our out day get has him his how man new now old see two way who ' +
  'boy did its let put say she too use dad mom end far few fun got job lot map mix net own pay run sea sit sky ten top try win yes ' +
  'about after again air also always animal answer around ask away back because been before begin below between big book both bring ' +
  'call came change children city close cold come could country cover cross cut different does down draw drink early earth eat end ' +
  'enough even ever every example eye face family farm fast father feel feet find fire first fish five follow food form found four ' +
  'friend from give good great green group grow hand hard have head hear help here high hold home hope house idea important into ' +
  'just keep kind know land large last later learn leave left letter life light like line list listen little live long look made ' +
  'make many mean might mile more morning most mother mountain move much music must name near need never next night number often ' +
  'only open other over page paper part people picture place plant play point pull question quick rain read real right river road ' +
  'rock room said same school second seem sentence set ship short should show side simple since sing small snow some song soon ' +
  'sound spell stand start state still stop story study such take talk tell than that them then there these they thing think this ' +
  'those thought three through time together took tree turn under until upon very walk want warm watch water week well went were ' +
  'what when where which while white will wind with word work world would write year young your ' +
  'above across add almost alone along already although among angle apple area arrive attention autumn bank base beach bear ' +
  'beautiful become bed begin behind believe bell best better bird black blue board boat body bone bottom box branch brave bread ' +
  'break bright brother brown build burn busy buy cake care carry catch cause cell center certain chair chance check chief child ' +
  'choose circle class clean clear climb clock cloud coast coat color common company complete cook cool copy corn corner correct ' +
  'cost cotton count course crowd crop dance dark decide deep desert design desk dictionary died direct distance divide doctor ' +
  'dog dollar done door double dress drive drop dry duck during dust each ear east easy edge effect egg eight either electric ' +
  'else energy engine enjoy enter equal evening event exact except exercise expect experience explain fact fall famous fair fell ' +
  'field fight figure fill final fine finger finish flat floor flow flower fly force forest forget forward free fresh front fruit ' +
  'full game garden gas gather gave general gentle glass gold gone grand grass gray ground guess half hair happen happy heard ' +
  'heart heat heavy held hill history hole hot hour huge human hundred hunt hurry ice inch indicate insect instrument interest ' +
  'iron island joy jump key kill king kitchen knew lady lake language laugh lay lead leg length less level lift log lost loud ' +
  'love low machine mail main major march mark master match material matter may measure meat meet melody metal method middle ' +
  'milk million mind mine minute miss modern moment money month moon mount mouth music nation natural nature neck neighbor nest ' +
  'nine noise north nose note nothing notice noun object observe ocean offer office oil once order organ paint pair paragraph ' +
  'pass past pattern person phrase pick piece pitch plain plan plane planet please plural poem pond poor position possible pound ' +
  'power practice present press pretty print probably problem process produce product proper prove provide push quart quiet quite ' +
  'race radio raise ran reach reason receive record region remember repeat reply represent rest result rich ride ring rise roll ' +
  'root rope rose round row rule safe sail salt sand save scale science score search season seat section seed sell send sense ' +
  'serve settle seven shape share sharp sheet shell shine shoe shop shore shoulder shout sign silent silver similar sister size ' +
  'skill sleep slip slow smell smile soft soil soldier solution solve south space speak special speech speed spend spot spread ' +
  'spring square star stay steam steel step stick stone stood store storm straight strange stream street stretch string strong ' +
  'subject substance subtract success sudden sugar summer sun supply support sure surface surprise swim symbol system table tail ' +
  'teach team temperature term test thick thin third thousand throw tie tiny tone tool total touch toward town track trade train ' +
  'travel trip trouble truck true tube type unit usual valley value verb view village visit voice vowel wait wall wash wave wear ' +
  'weather weight west wheel whole wide wife wild window wing winter wire wish woman wonder wood wrote yard yellow yet'
).split(/\s+/).filter((w, i, a) => w && a.indexOf(w) === i);

export const KID_WORDS = (
  'cat dog sun fox hat bug cup pig bee owl ant egg jam kit map nap pen pot red run sit six toy van wig zip ' +
  'ball bear bird boat cake corn dino duck fish frog goat kite lamb leaf lion milk moon nest park play pond puppy rain ' +
  'sand seal snail snow sock star swim tent tree whale wolf wave jump hop skip clap sing dance giggle happy silly cozy ' +
  'apple banana carrot cookie candy honey pizza berry melon mango grape peach lemon'
).split(/\s+/).filter((w, i, a) => w && a.indexOf(w) === i);

export const SENTENCES = [
  'The quiet library kept a map of every road in the valley.',
  'A steady hand finds the right key without looking down.',
  'She packed a lamp, a rope, and three days of bread.',
  'Morning light moved slowly across the harbor wall.',
  'Practice a little every day and the letters will follow.',
  'The old bridge hummed each time the wind picked up.',
  'He wrote the whole letter without lifting his eyes once.',
  'Small habits, repeated daily, become quiet superpowers.',
  'The garden gate opened onto a field of blue flowers.',
  'Keep your wrists light and let your fingers do the walking.',
  'A good sentence lands like a stone skipped across water.',
  'They traded stories until the fire burned down to coals.',
  'The train left at noon and the platform fell silent.',
  'Accuracy first, speed second, style always.',
  'Rain tapped the window in a rhythm she almost recognized.',
  'The baker knew every customer by their morning order.',
  'Slow is smooth, and smooth becomes fast.',
  'A single lantern guided the boats back to shore.',
  'He measured twice, cut once, and smiled at the result.',
  'The mountain path narrowed just before the summit.',
  'Every expert was once a beginner who refused to quit.',
  'The notebook filled with ideas faster than she could sort them.',
  'Wind carried the smell of pine down into the town square.',
  'Type the word you see, not the word you fear.',
  'The lighthouse keeper counted ships instead of sheep.',
  'Deep focus is a place you can learn to visit on purpose.',
  'The market opened early and sold out of plums by nine.',
  'His fingers found the home row like birds returning to a wire.',
  'A calm mind makes fewer errors than a hurried one.',
  'The map was old, but the river had kept its promise.',
  'She solved the puzzle by looking away from it for a while.',
  'Good tools are quiet; great skills are quieter.',
  'The city glowed like a circuit board after dark.',
  'One clean line of work beats ten tangled ones.',
  'The choir practiced until the hall itself seemed to sing.',
  'Let each keystroke land softly, like a footstep on moss.',
  'The last mile of any journey is mostly a conversation with yourself.',
  'A kettle, a chair, and a long book: her whole evening plan.',
  'The young engineer labeled every wire twice.',
  'Courage is often just patience wearing boots.',
];

export const KID_SENTENCES = [
  'The red fox naps in the tall grass.',
  'My dog can jump over the little log.',
  'We made a sand castle with two towers.',
  'A frog sat on a leaf in the pond.',
  'The moon is a lamp for the night sky.',
  'I like jam and toast for breakfast.',
  'The kite flew up and up and up.',
  'Six ducks swim in a happy line.',
  'The owl blinks and the stars come out.',
  'My robot friend beeps when it is glad.',
  'We planted seeds and waited for rain.',
  'The snail took all day to cross the path.',
  'A bee did a wiggle dance by the flowers.',
  'The train goes clack clack over the hill.',
  'I can hop on one foot ten times.',
  'The whale sang a long slow song.',
  'Our cat hides in the paper bag again.',
  'The dino in my book has tiny arms.',
  'Snowflakes landed on my blue mitten.',
  'The lion cub practiced a big brave roar.',
];

export const PARAGRAPHS = [
  'The workshop opened before sunrise. Rows of unfinished chairs waited in the half light, each one a promise somebody had made with their hands. Mara walked the aisle slowly, touching a joint here, a curve there, listening to the building settle. Good work, her grandfather used to say, is mostly showing up again. She tied back her hair, chose the smallest plane on the wall, and began.',
  'Nobody remembers who first mapped the archipelago, but every sailor knows the rule: learn the near islands before you chase the far ones. The near islands teach your hands the tiller and your eyes the weather. Then, one morning, the horizon stops being a wall and becomes a door. Skill is like that everywhere. You practice the close things until the distant things quietly move closer.',
  'The observatory kept two logbooks. The first recorded the sky: meteor counts, cloud cover, the slow waltz of planets. The second recorded the observers: who stayed late, who brought soup, who laughed at whose terrible jokes. Years later, researchers found the second book far more useful. Instruments explained what was seen. People explained why anyone kept looking.',
  'A city is a keyboard of streets. Locals type across it without thinking, their feet finding shortcuts the way fingers find letters. Visitors move one key at a time, reading every sign. Neither way is wrong. But there is a moment, weeks or months in, when the map dissolves and the city becomes muscle memory. After that, you are not navigating anymore. You are simply going home.',
  'The apprentice complained that her progress had stalled. The old calligrapher nodded and asked to see her practice sheets. He flipped past the elegant pages and stopped at the messy ones, the ones full of crossed-out strokes. These, he said, tapping the ugliest sheet, are where the learning lives. The beautiful pages are just receipts.',
  'Deep in the server room, the night technician kept a ritual. Before every maintenance window she typed one slow, perfect sentence into an empty file: a line from a poem, a note to her future self, once just a list of birds she had seen that week. It calmed her hands and cleared her head. Then she deleted it and got to work. Precision, she believed, was a mood you could summon.',
  'The long-distance swimmers had a saying: the water rewards the relaxed. Fight the sea and it doubles in weight; settle into it and it carries you. New typists learn the same physics on a smaller ocean. Tension slows the fingers and steals the rhythm. Ease is not laziness. Ease is technique that has finally been paid for.',
  'When the festival ended, the lantern makers gathered the unsold frames and taught anyone who stayed behind. Fold here, they said. Leave room for the flame to breathe. A lantern is mostly empty space and patience. By midnight the plaza glowed with wobbly, imperfect, wonderful light, and forty new lantern makers walked home warm.',
];

export const WORK_TEXTS = [
  'Hi Priya, thanks for the quick turnaround on the onboarding document. I added two comments about the second section and proposed a shorter version of the checklist. Could you review the changes before Thursday? If it looks good, I will share it with the wider team on Friday morning. Best, Alex',
  'Summary of the planning meeting: the team agreed to move the release to the second week of June. Rosa will update the timeline, Ken will confirm the vendor quote, and I will draft the customer announcement. Open risks: the translation review is still unassigned, and we need a decision on pricing by Monday.',
  'Dear Ms. Alvarez, thank you for contacting support. I have reset the sync service on your account and confirmed that your files are available again. As a precaution, please update the desktop application to the latest version. If anything still looks wrong, reply to this message and we will investigate right away.',
  'Agenda for the quarterly review: 1. Results against targets. 2. Customer feedback themes. 3. Budget adjustments. 4. Hiring plan. Please add your discussion topics to the shared document by Wednesday and keep each item under five minutes so we finish on time.',
  'Note to self: follow up with the print shop about the banner size, send the invoice for the March workshop, book the meeting room for the training session, and draft three interview questions about problem solving. Do the invoice first; it is overdue and only takes ten minutes.',
  'Project update: the migration finished without downtime. We moved 4,800 records, verified the checksums, and archived the old database. Two minor issues remain: the weekly report template still points at the old source, and one dashboard needs new credentials. Both are scheduled for tomorrow.',
];

export const CODE_SNIPPETS: { lang: string; label: string; text: string }[] = [
  {
    lang: 'js', label: 'JavaScript · function',
    text: 'function scoreRun(hits, misses) {\n  const total = hits + misses;\n  if (total === 0) return 0;\n  const acc = hits / total;\n  return Math.round(acc * 100);\n}',
  },
  {
    lang: 'js', label: 'JavaScript · array work',
    text: "const fast = runs.filter((r) => r.wpm > 40).map((r) => ({ id: r.id, wpm: r.wpm }));\nconsole.log(`kept ${fast.length} runs`);",
  },
  {
    lang: 'py', label: 'Python · loop & dict',
    text: 'def tally(words):\n    counts = {}\n    for w in words:\n        counts[w] = counts.get(w, 0) + 1\n    return sorted(counts.items(), key=lambda kv: -kv[1])',
  },
  {
    lang: 'html', label: 'HTML · structure',
    text: '<section class="card">\n  <h2 id="title">Daily report</h2>\n  <ul>\n    <li data-id="1">Speed: 42 wpm</li>\n    <li data-id="2">Accuracy: 97%</li>\n  </ul>\n</section>',
  },
  {
    lang: 'css', label: 'CSS · rules',
    text: '.panel {\n  display: flex;\n  gap: 1rem;\n  padding: 12px 16px;\n  border-radius: 12px;\n}\n.panel:hover { transform: translateY(-2px); }',
  },
  {
    lang: 'sql', label: 'SQL · query',
    text: "SELECT name, AVG(wpm) AS avg_wpm\nFROM sessions\nWHERE created_at > '2026-01-01'\nGROUP BY name\nHAVING AVG(wpm) > 35\nORDER BY avg_wpm DESC;",
  },
  {
    lang: 'json', label: 'JSON · config',
    text: '{\n  "theme": "midnight",\n  "goals": { "daily_minutes": 10, "target_wpm": 55 },\n  "modes": ["accuracy", "rhythm", "zen"]\n}',
  },
  {
    lang: 'sh', label: 'Terminal · commands',
    text: 'git status\ngit add src/engine.ts\ngit commit -m "tune rhythm scoring"\nnpm run build && npm test -- --watch=false',
  },
];

export const EXPLORER_QUOTES = [
  { text: 'I stopped chasing speed and speed started chasing me.', by: 'Juno, Voyager II' },
  { text: 'The home row is not a place. It is a habit.', by: 'Old Marn, Falcon III' },
  { text: 'Every typo is a tiny map of where your attention went.', by: 'Sable, Pathfinder I' },
  { text: 'Type like you are laying bricks: one true letter at a time.', by: 'Ivo, Tempest I' },
  { text: 'My rhythm got smooth the week I stopped holding my breath.', by: 'Petra, Glider III' },
];

export const RACER_NAMES = [
  'SwiftFalcon', 'QuietComet', 'PixelOtter', 'NimbusFox', 'TurboSnail', 'LunarMoth',
  'BoldBadger', 'EchoHeron', 'ZippyLynx', 'CalmCoyote', 'NovaWren', 'DriftPanda',
  'MossRunner', 'SolarKoi', 'BreezyIbis', 'DuneHare', 'EmberTern', 'GlacierPup',
  'MapleMole', 'RiverRook', 'StaticSeal', 'VelvetHawk', 'WillowBat', 'ZenithElk',
];

export const CLASSMATE_NAMES = [
  'BrightMaple07', 'HappyComet12', 'CleverRobin03', 'SunnyDelta21', 'MerryFalcon09',
  'KindOtter15', 'SwiftClover08', 'JollyPine04', 'CalmMeadow17', 'WittyHarbor02',
];

export const FORGE_MATERIALS = ['Copper', 'Cedar', 'Glass', 'Iron', 'Silver', 'Amber', 'Marble', 'Obsidian', 'Starlight', 'Aurora'];
export const FORGE_ITEMS = ['Quill', 'Compass', 'Lantern', 'Key', 'Chime', 'Locket', 'Sextant', 'Prism', 'Crown', 'Astrolabe'];
export const FORGE_SUFFIX = ['of Dawn', 'of the Deep Wood', 'of Steady Hands', 'of the North Wind', 'of Quiet Focus', 'of the Long Road', 'of Bright Rivers', 'of Patient Fire', 'of the Star Map', 'of Gentle Storms'];

export const ZEN_LINES = [
  'breathe in through the fingertips',
  'each letter is a small stone placed well',
  'the river does not hurry and it arrives',
  'soft wrists quiet mind steady lines',
  'let the next word come to you',
  'type the way rain lands on leaves',
  'there is no clock in this room',
  'begin again as often as you like',
  'the pause is part of the music',
  'slow hands still cross the whole sea',
];

// Words that lean on specific fingers/rows — used by drills and the recovery mode.
export const TRICKY_WORDS = [
  'minimum', 'pumpkin', 'lollipop', 'quizzical', 'zigzag', 'awkward', 'sphinx',
  'rhythm', 'polymer', 'unopened', 'monopoly', 'aquarium', 'kayak', 'jukebox',
  'exceed', 'oblong', 'crypt', 'fjord', 'vortex', 'wizard', 'plaza', 'nozzle',
];

export function numberDrill(rng: () => number, count: number): string {
  const parts: string[] = [];
  for (let i = 0; i < count; i++) {
    const kind = Math.floor(rng() * 4);
    if (kind === 0) parts.push(String(Math.floor(rng() * 9000) + 1000));
    else if (kind === 1) parts.push(String(Math.floor(rng() * 90) + 10));
    else if (kind === 2) parts.push(`${Math.floor(rng() * 12) + 1}:${String(Math.floor(rng() * 60)).padStart(2, '0')}`);
    else parts.push(`${Math.floor(rng() * 99) + 1}.${Math.floor(rng() * 9)}${Math.floor(rng() * 9)}`);
  }
  return parts.join(' ');
}

export function textToWords(t: string): string[] {
  return t.split(/\s+/).filter(Boolean);
}
