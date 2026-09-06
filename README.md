# Building The End (Signs)

A unified novel-building platform. It consolidates the non-overlapping strengths of
Scrivener, Campfire, Dabble, Slima, Plottr, World Anvil, NovelPad, Bibisco, yWriter,
Fictionary, The Novel Factory, Aeon Timeline and Plot Factory into one coherent product —
plus a **Synastry Engine** that uses real relational astrology to generate character
dynamics, tension maps and plot beats.

**It runs with zero setup.** No database, no API keys, no build config. Clone, `npm install`,
`npm run dev`. Deploy to Vercel by importing the repo.

---

## Quick start

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # 55 tests: ephemeris accuracy, synastry, continuity, graph
npm run build      # production build
```

### Deploy to Vercel

1. Push this directory to a GitHub repo.
2. On vercel.com → **Add New → Project** → import the repo.
3. Accept every default. Framework is auto-detected as Next.js; there is nothing to configure.
4. Deploy.

No environment variables are required. The app is fully functional without them.

### Optional: enable LLM prose synthesis

The AI surfaces (beta reader, editorial letters) work out of the box using the deterministic
analysis engine. Adding a key upgrades them to LLM-written prose grounded in the same evidence:

```bash
cp .env.example .env.local
# then set one of:
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
```

On Vercel, add the same variable under **Settings → Environment Variables**. The status pill in
the top-right of the app shows `AI: local` or `AI: live`.

---

## What is in the box

### The sixteen modules

| Module | Consolidated from | Where it lives |
|---|---|---|
| Manuscript drafting engine | Scrivener (binder, split-screen, snapshots) | Manuscript tab |
| Scene & chapter manager | yWriter (scene-centric workflow) | Binder + Inspector |
| Plot grid + beat mapping | Dabble (grid), Plot Factory (beat-linked drafting) | Plot Grid tab |
| Series timeline engine | Plottr (visual timelines) | Timeline tab |
| Multi-book dependency manager | Aeon Timeline (constraints, chronology) | Timeline + Series |
| Character psychology | Bibisco (depth fields), The Novel Factory (guided development) | Characters tab |
| Ensemble manager | Campfire (relationship webs) | Relations tab |
| Worldbuilding encyclopedia | World Anvil (nested structures, cosmology) | World tab |
| Knowledge graph | World Anvil + Aeon (auto-crosslinking, validation) | World tab, `lib/analysis.ts` |
| Continuity & contradiction checker | Slima | Insights tab |
| AI beta reader + pacing analyzer | Slima | Insights tab |
| Emotional & thematic tracking | NovelPad | Inspector + Insights |
| Scene structural diagnostics | Fictionary | Inspector → scene audit |
| Card-based reorganisation | NovelPad (card chapter management) | Cards tab |
| Revision traceability | Plot Factory, Scrivener snapshots | Inspector → History |
| **Synastry Engine** | *new* | Synastry tab |

Each module reads and writes one normalised project graph (`lib/types.ts`), which is what
prevents the duplication the source tools suffer from — there is exactly one Scene record,
and the timeline, plot grid, card board and continuity checker are all views over it.

### The Synastry Engine

A real ephemeris, not decoration. `lib/astro.ts` computes geocentric positions from
Standish/JPL approximate Keplerian elements and an abbreviated ELP lunar series, with
Meeus formulations for sidereal time, obliquity, Ascendant and Midheaven. Validated in
`tests/astro.test.mjs` against published worked examples and physical invariants
(Mercury's ≤28° elongation, Venus's ≤47°, sidereal period recovery over 60 years).

On top of that, `lib/synastry.ts` produces:

- **Birth chart generator** — placements, houses, aspects, retrogrades, element/modality balance
- **Archetype profiles** — twelve full narrative archetypes, modulated by Moon, Ascendant, Mars, Venus and Saturn
- **Synastry report cards** — harmony, tension, volatility, intimacy, intellect, karmic weight, and a signed power-imbalance index
- **Relational tension maps** — an ensemble heatmap across the whole cast
- **Destiny arc forecasts** — node, Saturn and Pluto contact read as series-level structure
- **Plot beat recommendations** — act-positioned beats, each citing the aspect that produced it, pushable straight into the Plot Grid
- **Composite midpoints** — the relationship as its own entity
- **Fictional zodiac support** — custom cosmologies that map onto the tropical wheel so the maths still applies

Interpretation is **compositional, not a lookup table**: every one of ~1,200 body × body ×
aspect combinations produces specific prose (actor role × aspect verb × target site ×
dramatic consequence × staging instruction). A regression test asserts that no contact
falls back to filler.

---

## Architecture

```
app/
  page.tsx              App shell: ribbon nav, three-pane layout, view routing
  layout.tsx            Root layout + metadata
  globals.css           Design system (single source of visual truth)
  api/
    chart/              POST — natal chart + archetype
    synastry/           POST — full synastry report + composite
    ensemble/           POST — cast-wide relational matrix
    analysis/           POST — continuity, chronology, structure, graph, pacing
    beta-reader/        POST — editorial letter (LLM or deterministic)
    health/             GET  — service + module manifest
lib/
  astro.ts              Ephemeris, houses, aspects, chart computation
  synastry.ts           Archetypes, cross-chart analysis, beat derivation
  analysis.ts           All six deterministic checkers + pacing
  ai.ts                 Provider-agnostic LLM layer with hard fallback
  types.ts              The project graph schema
  seed.ts               Seeded sample project
  store.tsx             Reducer + localStorage persistence
components/
  Manuscript.tsx        Binder, editor, inspector
  PlotViews.tsx         Cards, plot grid, timeline, emotion strip
  CharacterViews.tsx    Character detail, birth data, relationship web
  WorldViews.tsx        Encyclopedia, insights hub, series dashboard
  SynastryView.tsx      Synastry dashboard
  ChartWheel.tsx        SVG chart wheel and bi-wheel
tests/                  55 tests, node:test via tsx
```

### Persistence

The client store persists the whole project graph to `localStorage`. This is deliberate:
it makes the deployment target zero-infrastructure. `lib/types.ts` is already normalised for
a relational store, so moving to Postgres means replacing the `persist()` effect in
`lib/store.tsx` with API calls — no other file changes. See `docs/ARCHITECTURE.md` for the
production topology (Postgres + Neo4j + WebSocket collaboration).

### Why the AI cannot hallucinate your manuscript

Three enforced constraints:

1. **The model never retrieves.** `app/api/beta-reader/route.ts` assembles an evidence
   bundle from the deterministic engine and instructs the model to use nothing else.
2. **Citations are mandatory and validated.** `stripUncited()` drops any paragraph that
   cites an id which does not exist in the project.
3. **Findings come from code, not the model.** Every continuity error, constraint violation
   and pacing problem is located by `lib/analysis.ts`. The LLM only writes them up.

Consequence: with no API key at all, every AI surface still returns a complete, specific,
correct answer. The model is an upgrade, never a dependency.

---

## Testing

```bash
npm test
```

| Suite | Covers |
|---|---|
| `tests/astro.test.mjs` | Julian Day, obliquity, GMST, Sun/Moon against Meeus worked examples; planetary positions; retrograde detection; elongation limits; sidereal periods; house systems; aspect orbs; determinism |
| `tests/synastry.test.mjs` | Archetype completeness; score bounds and calibration; power-imbalance mirror symmetry; beat structure; interpretation specificity and variety; generational-noise exclusion; no template leakage |
| `tests/analysis.test.mjs` | Seed integrity; every finding actionable; POV/cast detection; tense drift; Aeon constraint violations; bilocation; structural audit; broken graph edges; orphan detection; synastry/text divergence; pacing; health scoring; determinism; performance |

---

## Documentation

- `docs/ARCHITECTURE.md` — production topology, data model, scaling path, roadmap
- `docs/API.md` — endpoint reference with request/response examples

## Licence

MIT.
