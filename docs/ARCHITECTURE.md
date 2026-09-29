# Architecture

## Design position

The brief asked for sixteen modules built from thirteen source tools. The failure mode of
that request is a suite of loosely-federated micro-apps that each own a copy of "a scene".
Every tool in the source list suffers from some version of this internally — Scrivener's
outliner and corkboard are genuinely different objects, Campfire's modules barely know
about each other.

The organising decision here is the opposite: **one normalised project graph, many views.**
`lib/types.ts` defines exactly one `Scene`, one `Character`, one `Beat`. The Plot Grid, the
card corkboard, the timeline, the continuity checker and the Synastry Engine are all
projections over it. Adding a seventeenth module means adding a view and possibly a
checker — never a new copy of the manuscript.

This is what makes the "no redundant features" constraint enforceable rather than
aspirational. It is checked in `tests/analysis.test.mjs` ("seed project is internally
consistent"), which walks every cross-reference in the graph.

## Deployed topology (what ships in this repo)

```
┌───────────────────────────────────────────────┐
│ Browser                                       │
│  React 19 · Next 15 App Router                │
│  ProjectProvider (useReducer) ── localStorage │
└────────────────┬──────────────────────────────┘
                 │ fetch
┌────────────────▼──────────────────────────────┐
│ Vercel serverless functions (Node runtime)    │
│  /api/chart  /api/synastry  /api/ensemble     │
│  /api/analysis  /api/beta-reader  /api/health │
│                                               │
│  lib/astro.ts     — ephemeris (no deps)       │
│  lib/synastry.ts  — relational analysis       │
│  lib/analysis.ts  — six deterministic checks  │
│  lib/ai.ts        — optional LLM, hard fallback│
└────────────────┬──────────────────────────────┘
                 │ optional
        ┌────────▼─────────┐
        │ Anthropic/OpenAI │
        └──────────────────┘
```

Total runtime dependencies: `next`, `react`, `react-dom`. No database driver, no astronomy
library, no charting library, no state library, no CSS framework. This is a deliberate
constraint, not minimalism for its own sake — it is what makes "paste into Vercel and it
works" literally true, and it removes the licence and native-binding problems that Swiss
Ephemeris bindings introduce.

### Why no database in the shipped build

The brief specified Postgres + Neo4j. That is the correct production answer and it is
specified below. It is the wrong answer for a deliverable that must run on first import
with no provisioning step. The compromise: the schema is already relational and
graph-shaped, and persistence is isolated to a single effect in `lib/store.tsx`.

```ts
// lib/store.tsx — the entire persistence surface
useEffect(() => {
  localStorage.setItem(KEY, JSON.stringify(project));
}, [project, ready]);
```

Replacing that with `await api.saveProject(project)` is the whole migration on the client
side.

## Production topology (the scaling path)

```
Browser ──── Vercel Edge (Next.js SSR + static)
                │
                ├── REST/tRPC ──► API service (Node or FastAPI)
                │                    │
                │                    ├── PostgreSQL  — manuscript, scenes, snapshots,
                │                    │                 users, revisions, billing
                │                    ├── Neo4j       — entity graph, lore constraints,
                │                    │                 relationship edges, chronology DAG
                │                    ├── Redis       — presence, doc locks, job queue
                │                    └── S3          — attachments, exports
                │
                └── WebSocket (y-websocket) ──► CRDT collaboration layer
```

### Storage split

**PostgreSQL** owns anything with a strong schema and transactional integrity requirements:
`scenes`, `snapshots`, `chapters`, `books`, `characters`, `beats`, `users`, `permissions`.
Scene content is a `text` column; snapshots are append-only rows with a `reason` field
(this is already modelled — see `Snapshot` in `lib/types.ts`).

**Neo4j** owns the traversal-heavy parts, where recursive SQL becomes the bottleneck:

```cypher
(:Character)-[:APPEARS_IN {pov: bool}]->(:Scene)
(:Character)-[:RELATES_TO {kind, status, intensity, sinceBook}]->(:Character)
(:Character)-[:HAS_CHART]->(:NatalChart)-[:PLACEMENT {sign, house, degree}]->(:Body)
(:NatalChart)-[:ASPECTS {type, orb, weight, category}]->(:NatalChart)
(:WorldEntry)-[:PART_OF]->(:WorldEntry)
(:WorldEntry)-[:ASSERTS]->(:CanonFact)-[:ESTABLISHED_IN|SUPERSEDED_IN]->(:Scene)
(:Event)-[:BEFORE|AFTER|DURING]->(:Event)
(:Beat)-[:REALISED_BY]->(:Scene)
(:Beat)-[:DERIVED_FROM]->(:Aspect)
```

The queries that justify the second database:

- *"Which canon facts are contradicted after scene X?"* — variable-depth traversal from
  `CanonFact` through `SUPERSEDED_IN` against the chronology DAG.
- *"Which chronology constraints does moving this event violate?"* — transitive closure over
  `BEFORE`/`AFTER`. This is the Aeon Timeline feature, and it is a graph problem.
- *"Which high-charge pairings never share a scene?"* — anti-join between `ASPECTS` weight
  and `APPEARS_IN` co-occurrence. Currently `checkSynastryCoherence()` in `lib/analysis.ts`.

All three are implemented today as in-memory traversals over the project graph. They are
correct and fast at single-author scale (the test suite asserts full analysis completes in
under three seconds); they become Cypher when a project outgrows a single process.

### Real-time collaboration

Yjs CRDT per scene, transported over `y-websocket`. Scene content is the only genuinely
concurrent surface; metadata edits are low-frequency and can use last-write-wins with a
version column. Presence and cursors ride the same socket. Redis pub/sub fans out across
serverless instances.

CRDT rather than OT because the merge semantics for prose are forgiving and the offline
story matters — novelists work on planes.

### Authentication

OAuth2 (GitHub, Google) → short-lived JWT access token + rotating refresh token in an
httpOnly cookie. Project-level RBAC: `owner`, `editor`, `beta-reader`, `viewer`. The
`beta-reader` role is a real product requirement, not a generic tier: it grants read access
to manuscript text and comment creation, but hides the plot grid, the outline and the
synastry beat recommendations — a beta reader who has seen the midpoint reversal is no
longer a beta reader.

## The AI pipeline

```
                    ┌──────────────────────────┐
  Project graph ───►│ lib/analysis.ts          │
                    │ six deterministic checks │
                    └────────────┬─────────────┘
                                 │ Finding[] with evidence ids
                                 ▼
                    ┌──────────────────────────┐
                    │ Evidence bundle assembly │
                    │ (beta-reader/route.ts)   │
                    │ cast · scenes · pacing · │
                    │ synastry · findings      │
                    └────────────┬─────────────┘
                                 │
                  ┌──────────────┴───────────────┐
       key set    │                              │  no key
                  ▼                              ▼
        ┌───────────────────┐         ┌────────────────────┐
        │ LLM, temp 0.2     │         │ Template letter    │
        │ system: use ONLY  │         │ built from the     │
        │ the context       │         │ same evidence      │
        └─────────┬─────────┘         └─────────┬──────────┘
                  │                              │
                  ▼                              │
        ┌───────────────────┐                    │
        │ stripUncited()    │                    │
        │ drop paragraphs   │                    │
        │ citing unknown ids│                    │
        └─────────┬─────────┘                    │
                  └──────────────┬───────────────┘
                                 ▼
                            Editorial letter
```

Three properties follow from this shape:

1. **The model cannot invent a character.** It never retrieves; it receives a fixed bundle
   and is told to say "not in the manuscript" otherwise.
2. **Uncited claims are mechanically removed**, not merely discouraged by prompt.
3. **The feature has no hard dependency on the model.** Both branches terminate in a
   complete letter. This is why the app ships with `AI: local` as a supported state rather
   than a degraded one.

The same discipline applies to the Synastry Engine: interpretation is generated by code
from computed aspects, so a reading always corresponds to an actual planetary geometry with
a stated orb. There is no path by which the app asserts a relationship dynamic that the
ephemeris does not support.

### Long-context strategy at scale

The current bundle is whole-manuscript for a 4-scene sample. For a 120k-word series:

- **Tier 1 (always sent):** series premise, themes, cast psychology, synastry matrix,
  current findings — roughly 4k tokens, and it is the part that produces specificity.
- **Tier 2 (retrieved):** scene synopses for the whole book, full text for the focus scene
  and its two neighbours.
- **Tier 3 (embedded):** per-scene embeddings in pgvector for "where else does this
  contradiction appear" queries, feeding candidate scene ids back into Tier 2.

Findings always travel in Tier 1. The model's job is never to *find* the problem.

## Frontend component architecture

State is a single `useReducer` over the project graph, exposed by `ProjectProvider`. Every
mutation is a typed action (`scene.update`, `beat.add`, `char.update`, `scene.snapshot`),
which means the undo stack, the collaboration layer and the revision-traceability engine
can all be built by intercepting one dispatch function rather than by instrumenting
components.

Views are pure projections and hold only ephemeral UI state (which tab, which selection).
No view owns domain data. `ChartWheel` is fully derived from a `Chart` object and has no
awareness of the project at all, which is why it serves both the natal wheel and the
synastry bi-wheel from the same code path.

Styling is one CSS file of custom properties. No framework, no CSS-in-JS runtime, no
class-name explosion — and it renders correctly inside a sandboxed iframe with no network,
which a CDN-loaded framework would not.

## Development roadmap

**Phase 1 — MVP (shipped in this repo)**
Binder drafting with snapshots · scene metadata and structural audit · card reorganisation ·
plot grid with beat mapping · series chronology with dependency constraints · character
psychology and archetypes · relationship web · worldbuilding encyclopedia with
auto-crosslinking · six-checker analysis engine · pacing and emotion tracking · full
Synastry Engine · beta reader with LLM-optional pipeline · JSON and Markdown export.

**Phase 2 — Persistence and accounts**
Postgres migration behind the existing store interface · OAuth2 + JWT · project sharing and
the four-role RBAC model · server-side snapshot history with diffing · S3 attachments.

**Phase 3 — Collaboration**
Yjs CRDT on scene content · presence and cursors · inline comments scoped by role ·
the beta-reader view with outline redaction.

**Phase 4 — Graph and scale**
Neo4j for lore constraints and chronology closure · pgvector scene embeddings ·
cross-book contradiction detection over the full series · incremental analysis
(re-check only the subgraph a change touched).

**Phase 5 — Craft depth**
Higher-precision ephemeris behind the same interface (the `planetLongitude` signature does
not change) · progressions and transits for "what is happening to this character in Book 3"
· custom fictional zodiacs with independent geometry rather than tropical mapping ·
manuscript compile to EPUB/DOCX with per-format styling · revision diffing across snapshots.

## Known limits

Stated plainly, because a specification that hides them is not implementation-ready.

- **Chiron is approximate** (~2°). It has no compact analytic series. It is flagged
  `approximate: true` in the API and down-weighted in scoring.
- **House systems** are Whole Sign, Equal and Porphyry. Placidus requires iterative
  solution of the semi-arc equation and fails near the polar circles; Whole Sign is the
  default because it is also the most robust for characters with uncertain birth times.
- **Planetary accuracy** is arcminute-class for 1800–2050 (the JPL approximate element set's
  stated validity window). Outside that range results degrade gracefully rather than
  failing, which is correct for fiction set in 2231.
- **localStorage has a ~5MB ceiling**, roughly a 500k-word manuscript with metadata. Phase 2
  removes this.
- **Single-user.** No concurrency control ships in Phase 1; two tabs will last-write-wins
  each other.
  
