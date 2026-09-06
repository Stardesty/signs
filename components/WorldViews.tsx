'use client';

import React, { useMemo, useState } from 'react';
import { useProject } from '@/lib/store';
import { WorldEntry, uid, wordCount } from '@/lib/types';
import { fullAnalysis, Finding } from '@/lib/analysis';
import { EmotionStrip } from './PlotViews';

/* ----------------------------------------------------------- world view */

const TYPE_GLYPH: Record<string, string> = {
  location: '⌂', faction: '⚑', item: '◈', 'magic-system': '✧', religion: '☩',
  species: '❋', event: '⌁', concept: '◉', cosmology: '☄', language: '⌇',
};

export function WorldView() {
  const { project, dispatch } = useProject();
  const [selId, setSelId] = useState(project.world[0]?.id ?? null);
  const [q, setQ] = useState('');
  const sel = project.world.find((w) => w.id === selId);

  const filtered = project.world.filter((w) =>
    !q || w.name.toLowerCase().includes(q.toLowerCase()) || w.summary.toLowerCase().includes(q.toLowerCase()));

  const roots = filtered.filter((w) => !w.parentId || !project.world.some((p) => p.id === w.parentId));
  const kids = (id: string) => filtered.filter((w) => w.parentId === id);

  /** Automatic cross-linking: any entity whose name appears in this entry's body. */
  const autoLinks = useMemo(() => {
    if (!sel) return [];
    const hay = `${sel.body} ${sel.summary}`.toLowerCase();
    return [
      ...project.characters.filter((c) => hay.includes(c.name.toLowerCase()) || hay.includes(c.name.split(' ')[0].toLowerCase()))
        .map((c) => ({ id: c.id, name: c.name, kind: 'character' })),
      ...project.world.filter((w) => w.id !== sel.id && hay.includes(w.name.toLowerCase()))
        .map((w) => ({ id: w.id, name: w.name, kind: w.type })),
    ];
  }, [sel, project]);

  const mentions = useMemo(
    () => (sel ? project.scenes.filter((s) => s.locationId === sel.id || s.content.includes(sel.name)) : []),
    [sel, project.scenes]);

  const row = (w: WorldEntry, depth: number): React.ReactNode => (
    <div key={w.id}>
      <div className={`binder-row${selId === w.id ? ' active' : ''}`}
           style={{ paddingLeft: 10 + depth * 13 }} onClick={() => setSelId(w.id)}>
        <span className="binder-icon">{TYPE_GLYPH[w.type] ?? '·'}</span>
        <span className="binder-title">{w.name}</span>
      </div>
      {kids(w.id).map((k) => row(k, depth + 1))}
    </div>
  );

  return (
    <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
      <div style={{ width: 236, borderRight: '1px solid var(--line)', overflowY: 'auto', flexShrink: 0 }}>
        <div className="pane-head">
          <span>Encyclopedia</span>
          <button className="btn" style={{ padding: '2px 7px' }} onClick={() => {
            const entry: WorldEntry = {
              id: uid('wld'), seriesId: project.series.id, type: 'concept',
              name: 'New Entry', summary: '', body: '', parentId: null,
              tags: [], links: [], canonFacts: [],
            };
            dispatch({ t: 'world.add', entry }); setSelId(entry.id);
          }}>+</button>
        </div>
        <div style={{ padding: 8 }}>
          <input className="inp" style={{ width: '100%' }} placeholder="Search…"
                 value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {roots.map((w) => row(w, 0))}
      </div>

      <div className="pane-scroll pane-pad" style={{ flex: 1 }}>
        {!sel ? <div className="empty">Select an entry.</div> : (
          <>
            <div className="flex-wrap" style={{ marginBottom: 12 }}>
              <input className="editor-title" style={{ flex: 'none', width: 300 }} value={sel.name}
                     onChange={(e) => dispatch({ t: 'world.update', id: sel.id, patch: { name: e.target.value } })} />
              <select className="sel" value={sel.type}
                      onChange={(e) => dispatch({ t: 'world.update', id: sel.id, patch: { type: e.target.value as WorldEntry['type'] } })}>
                {Object.keys(TYPE_GLYPH).map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <textarea className="synopsis-in" rows={2} placeholder="Summary" value={sel.summary}
                      onChange={(e) => dispatch({ t: 'world.update', id: sel.id, patch: { summary: e.target.value } })} />
            <textarea className="synopsis-in" rows={9} placeholder="Body" value={sel.body}
                      onChange={(e) => dispatch({ t: 'world.update', id: sel.id, patch: { body: e.target.value } })} />

            <div className="split">
              <div>
                <div className="section-title">Canon facts</div>
                {sel.canonFacts.length === 0
                  ? <div className="muted" style={{ fontSize: 12 }}>No asserted facts. Canon facts are what the continuity checker validates against.</div>
                  : sel.canonFacts.map((f) => (
                    <div key={f.id} className="meta-row">
                      <span className="meta-k">{f.confidence}</span>
                      <span className="meta-v">{f.statement}</span>
                    </div>
                  ))}
                <button className="btn" style={{ marginTop: 8 }} onClick={() => {
                  const statement = prompt('Canon fact:');
                  if (!statement) return;
                  dispatch({ t: 'world.update', id: sel.id, patch: {
                    canonFacts: [...sel.canonFacts, {
                      id: uid('cf'), statement, establishedInSceneId: null,
                      supersededInSceneId: null, confidence: 'canon' as const,
                    }],
                  } });
                }}>+ Fact</button>
              </div>
              <div>
                <div className="section-title">Knowledge graph — auto-detected links</div>
                {autoLinks.length === 0
                  ? <div className="muted" style={{ fontSize: 12 }}>No entities referenced in this text.</div>
                  : autoLinks.map((l) => (
                    <span key={l.id} className="tag" style={{ cursor: l.kind === 'character' ? 'default' : 'pointer' }}
                          onClick={() => l.kind !== 'character' && setSelId(l.id)}>
                      {l.name} <span className="muted">· {l.kind}</span>
                    </span>
                  ))}
                <div className="section-title">Declared links</div>
                {sel.links.length === 0 ? <div className="muted" style={{ fontSize: 12 }}>None.</div>
                  : sel.links.map((l, i) => (
                    <div key={i} className="meta-row">
                      <span className="meta-k">{l.relation}</span>
                      <span className="meta-v">
                        {project.characters.find((c) => c.id === l.targetId)?.name
                          ?? project.world.find((w) => w.id === l.targetId)?.name
                          ?? <span style={{ color: 'var(--red)' }}>broken: {l.targetId}</span>}
                      </span>
                    </div>
                  ))}
                <div className="section-title">Appears in</div>
                {mentions.length === 0 ? <div className="muted" style={{ fontSize: 12 }}>No scenes reference this entry.</div>
                  : mentions.map((s) => <span key={s.id} className="tag">{s.title}</span>)}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Minimal inline markdown: **bold** only. Avoids pulling in a parser. */
function renderInlineMd(text: string): React.ReactNode {
  return text.split(/(\*\*[^*]+\*\*)/g).map((chunk, i) =>
    chunk.startsWith('**') && chunk.endsWith('**')
      ? <strong key={i}>{chunk.slice(2, -2)}</strong>
      : <React.Fragment key={i}>{chunk}</React.Fragment>);
}

/* --------------------------------------------------------- insights hub */

export function InsightsView() {
  const { project } = useProject();
  const [filter, setFilter] = useState<string>('all');
  const [letter, setLetter] = useState<{ text: string; mode: string; warning?: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const report = useMemo(() => fullAnalysis(project), [project]);
  const shown = report.findings.filter((f) => filter === 'all' || f.module === filter || f.severity === filter);

  const runBetaReader = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/beta-reader', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ project }),
      });
      const json = await res.json();
      setLetter(json.error ? { text: `Error: ${json.error}`, mode: 'heuristic' } : json);
    } catch (e) {
      setLetter({ text: `Request failed: ${(e as Error).message}`, mode: 'heuristic' });
    }
    setLoading(false);
  };

  const modules = Object.keys(report.byModule);
  const scenes = [...project.scenes].sort((a, b) => (a.storyDate ?? '').localeCompare(b.storyDate ?? ''));

  return (
    <div className="pane-scroll pane-pad">
      <div className="flex-wrap" style={{ marginBottom: 18 }}>
        <div className="card" style={{ minWidth: 130 }}>
          <div className="stat-n" style={{
            color: report.health > 80 ? 'var(--green)' : report.health > 55 ? 'var(--amber)' : 'var(--red)',
          }}>{report.health}</div>
          <div className="stat-l">Manuscript health</div>
        </div>
        <div className="card" style={{ minWidth: 110 }}>
          <div className="stat-n" style={{ color: 'var(--red)' }}>{report.counts.critical}</div>
          <div className="stat-l">Critical</div>
        </div>
        <div className="card" style={{ minWidth: 110 }}>
          <div className="stat-n" style={{ color: 'var(--amber)' }}>{report.counts.warning}</div>
          <div className="stat-l">Warnings</div>
        </div>
        <div className="card" style={{ minWidth: 110 }}>
          <div className="stat-n" style={{ color: 'var(--accent-2)' }}>{report.counts.info}</div>
          <div className="stat-l">Notes</div>
        </div>
        <div className="card" style={{ minWidth: 130 }}>
          <div className="stat-n">{report.pacing.totalWords.toLocaleString()}</div>
          <div className="stat-l">Words · avg {report.pacing.averageSceneLength}</div>
        </div>
        <div className="card" style={{ minWidth: 130 }}>
          <div className="stat-n">{(report.pacing.povBalance * 100).toFixed(0)}%</div>
          <div className="stat-l">POV balance</div>
        </div>
      </div>

      <div className="section-title">Emotional & tension track</div>
      <div className="card" style={{ marginBottom: 6 }}>
        <EmotionStrip scenes={scenes} />
        <div className="flex" style={{ justifyContent: 'space-between', fontSize: 10, color: 'var(--text-3)' }}>
          <span>{scenes[0]?.title}</span>
          <span>bars = valence · line = tension</span>
          <span>{scenes[scenes.length - 1]?.title}</span>
        </div>
      </div>

      <div className="section-title">AI beta reader</div>
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="flex" style={{ marginBottom: 10 }}>
          <button className="btn primary" onClick={runBetaReader} disabled={loading}>
            {loading ? 'Reading…' : 'Generate editorial letter'}
          </button>
          {letter && (
            <span className={`pill ${letter.mode === 'llm' ? 'good' : ''}`}>
              {letter.mode === 'llm' ? 'LLM synthesis' : 'deterministic engine'}
            </span>
          )}
        </div>
        {letter ? (
          <>
            {letter.warning && <div className="finding info"><div className="finding-d">{letter.warning}</div></div>}
            <div className="prose" style={{ whiteSpace: 'pre-wrap' }}>{renderInlineMd(letter.text)}</div>
          </>
        ) : (
          <div className="muted" style={{ fontSize: 12 }}>
            The beta reader assembles an evidence bundle from the deterministic engine — findings, pacing curve,
            cast psychology, synastry scores — and writes an editorial letter grounded in it. Every claim must cite
            a scene or entity id; uncited paragraphs are stripped before display.
          </div>
        )}
      </div>

      <div className="section-title">Findings</div>
      <div className="flex-wrap" style={{ marginBottom: 12 }}>
        <button className={`tab${filter === 'all' ? ' active' : ''}`} onClick={() => setFilter('all')}>
          All ({report.findings.length})
        </button>
        {(['critical', 'warning', 'info'] as const).map((s) => (
          <button key={s} className={`tab${filter === s ? ' active' : ''}`} onClick={() => setFilter(s)}>
            {s} ({report.counts[s]})
          </button>
        ))}
        {modules.map((m) => (
          <button key={m} className={`tab${filter === m ? ' active' : ''}`} onClick={() => setFilter(m)}>
            {m} ({report.byModule[m]})
          </button>
        ))}
      </div>
      {shown.length === 0 ? <div className="muted" style={{ fontSize: 12 }}>Nothing to report.</div>
        : shown.map((f: Finding) => (
          <div key={f.id} className={`finding ${f.severity}`}>
            <div className="finding-mod">{f.module} · {f.severity}</div>
            <div className="finding-t">{f.title}</div>
            <div className="finding-d">{f.detail}</div>
            <div className="finding-fix">→ {f.suggestion}</div>
            <div style={{ marginTop: 6 }}>
              {f.evidence.map((e, i) => <span key={i} className="tag">{e.label}</span>)}
            </div>
          </div>
        ))}
    </div>
  );
}

/* -------------------------------------------------------- series view */

export function SeriesView() {
  const { project, dispatch } = useProject();
  const report = useMemo(() => fullAnalysis(project), [project]);

  return (
    <div className="pane-scroll pane-pad">
      <h2 style={{ margin: '0 0 6px', fontSize: 20 }}>{project.series.title}</h2>
      <div className="prose" style={{ maxWidth: 720, marginBottom: 10 }}>{project.series.premise}</div>
      <div style={{ marginBottom: 20 }}>
        {project.series.themes.map((t) => <span key={t} className="tag">{t}</span>)}
      </div>

      <div className="section-title">Books</div>
      <div className="grid-auto" style={{ marginBottom: 22 }}>
        {project.books.map((b) => {
          const scenes = project.scenes.filter((s) => s.bookId === b.id);
          const words = scenes.reduce((a, s) => a + wordCount(s.content), 0);
          const pct = Math.min(100, (words / b.targetWordCount) * 100);
          return (
            <div key={b.id} className="card">
              <div className="flex" style={{ justifyContent: 'space-between' }}>
                <div className="card-title">{b.title}</div>
                <span className="pill">{b.status}</span>
              </div>
              <div className="card-sub" style={{ minHeight: 36 }}>{b.logline}</div>
              <div className="flex" style={{ fontSize: 10.5, color: 'var(--text-3)', margin: '10px 0 5px' }}>
                <span>{scenes.length} scenes</span>
                <span style={{ marginLeft: 'auto' }}>{words.toLocaleString()} / {b.targetWordCount.toLocaleString()}</span>
              </div>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${pct}%`, background: 'var(--accent)' }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="split">
        <div>
          <div className="section-title">Multi-book dependencies</div>
          <div className="prose" style={{ marginBottom: 10 }}>
            Cross-book constraints validated by the chronology engine. A violation here is a series-level plot hole.
          </div>
          {project.events.filter((e) => e.dependsOn.length).map((e) => (
            <div key={e.id} className="meta-row">
              <span className="meta-k">{e.title}</span>
              <span className="meta-v">
                {e.dependsOn.map((d) => `${d.relation} ${project.events.find((x) => x.id === d.eventId)?.title}`).join('; ')}
              </span>
            </div>
          ))}
          <div className="section-title">POV distribution</div>
          {report.pacing.povDistribution.map((p) => (
            <div key={p.characterId} className="flex" style={{ marginBottom: 5, fontSize: 11.5 }}>
              <span style={{ width: 120, color: 'var(--text-3)' }}>{p.name}</span>
              <div className="bar-track" style={{ flex: 1 }}>
                <div className="bar-fill" style={{
                  width: `${(p.scenes / report.pacing.points.length) * 100}%`,
                  background: project.characters.find((c) => c.id === p.characterId)?.color ?? 'var(--accent)',
                }} />
              </div>
              <span className="mono">{p.scenes}</span>
            </div>
          ))}
        </div>
        <div>
          <div className="section-title">Guided novel blueprint</div>
          <div className="prose" style={{ marginBottom: 10 }}>
            Structural completeness across the framework you selected. Unfilled slots are prompts, not errors.
          </div>
          {['Opening Image', 'Catalyst', 'Debate', 'Break Into Two', 'Midpoint', 'All Is Lost', 'Finale'].map((slot) => {
            const beat = project.beats.find((b) => b.frameworkSlot === slot);
            return (
              <div key={slot} className="meta-row">
                <span className="meta-k" style={{ color: beat ? (beat.fulfilled ? 'var(--green)' : 'var(--amber)') : 'var(--red)' }}>
                  {beat ? (beat.fulfilled ? '●' : '◐') : '○'} {slot}
                </span>
                <span className="meta-v">{beat ? beat.title : 'not planned'}</span>
              </div>
            );
          })}
          <div className="section-title">Project data</div>
          <div className="flex-wrap">
            <button className="btn" onClick={() => {
              const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = 'signs-project.json'; a.click();
            }}>Export JSON</button>
            <button className="btn" onClick={() => {
              const md = project.books.map((b) => {
                const ss = project.scenes.filter((s) => s.bookId === b.id);
                return `# ${b.title}\n\n${ss.map((s) => `## ${s.title}\n\n${s.content}`).join('\n\n')}`;
              }).join('\n\n');
              const blob = new Blob([md], { type: 'text/markdown' });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = 'manuscript.md'; a.click();
            }}>Export manuscript</button>
            <button className="btn" onClick={() => {
              if (confirm('Reset to the seeded sample project? Your local changes will be lost.')) {
                dispatch({ t: 'reset' });
              }
            }}>Reset project</button>
          </div>
        </div>
      </div>
    </div>
  );
}
