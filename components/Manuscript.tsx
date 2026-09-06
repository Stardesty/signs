'use client';

import React, { useMemo, useState } from 'react';
import { useProject } from '@/lib/store';
import { BinderNode, Scene, wordCount } from '@/lib/types';
import { computeChart, bigThree } from '@/lib/astro';
import { buildArchetype, computeSynastry } from '@/lib/synastry';
import { checkContinuity } from '@/lib/analysis';

const ICON: Record<string, string> = {
  book: '◆', part: '◇', chapter: '▤', scene: '□',
  folder: '▸', note: '•', research: '☷',
};

const STATUS_COLOR: Record<string, string> = {
  outline: '#6f7590', draft: '#7dd3fc', revised: '#fbbf24', final: '#6ee7b7',
};

/* ------------------------------------------------------------------ binder */

export function Binder({ selected, onSelect }: { selected: string | null; onSelect: (sceneId: string) => void }) {
  const { project, dispatch } = useProject();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const children = (parentId: string | null) =>
    project.binder.filter((b) => b.parentId === parentId).sort((a, b) => a.order - b.order);

  const totalWords = (node: BinderNode): number => {
    if (node.sceneId) {
      const s = project.scenes.find((x) => x.id === node.sceneId);
      return s ? wordCount(s.content) : 0;
    }
    return children(node.id).reduce((sum, c) => sum + totalWords(c), 0);
  };

  const render = (parentId: string | null, depth = 0): React.ReactNode =>
    children(parentId).map((node) => {
      const kids = children(node.id);
      const isOpen = !collapsed[node.id];
      const scene = node.sceneId ? project.scenes.find((s) => s.id === node.sceneId) : null;
      const words = totalWords(node);
      return (
        <div key={node.id}>
          <div
            className={`binder-row${selected === node.sceneId ? ' active' : ''}`}
            style={{ paddingLeft: 10 + depth * 13 }}
            onClick={() => {
              if (node.sceneId) onSelect(node.sceneId);
              else setCollapsed((c) => ({ ...c, [node.id]: !c[node.id] }));
            }}
          >
            <span className="binder-caret">{kids.length ? (isOpen ? '▾' : '▸') : ''}</span>
            <span className="binder-icon">{ICON[node.type]}</span>
            <span className="binder-title">{scene?.title ?? node.title}</span>
            {scene && <span className="binder-dot" style={{ background: STATUS_COLOR[scene.status] }} />}
            {words > 0 && <span className="binder-count">{words > 999 ? `${(words / 1000).toFixed(1)}k` : words}</span>}
          </div>
          {isOpen && render(node.id, depth + 1)}
        </div>
      );
    });

  const total = project.scenes.reduce((a, s) => a + wordCount(s.content), 0);
  const target = project.books.reduce((a, b) => a + b.targetWordCount, 0);

  return (
    <>
      <div className="pane-head">
        <span>Binder</span>
        <button className="btn" style={{ padding: '2px 7px' }}
                onClick={() => dispatch({ t: 'scene.add', chapterId: null, bookId: project.books[0].id })}>
          + Scene
        </button>
      </div>
      <div className="pane-scroll" style={{ paddingTop: 6 }}>{render(null)}</div>
      <div style={{ padding: '9px 12px', borderTop: '1px solid var(--line)', fontSize: 11, color: 'var(--text-3)' }}>
        <div className="flex" style={{ justifyContent: 'space-between', marginBottom: 5 }}>
          <span>{total.toLocaleString()} words</span>
          <span>{((total / target) * 100).toFixed(1)}% of {(target / 1000).toFixed(0)}k</span>
        </div>
        <div className="bar-track">
          <div className="bar-fill" style={{ width: `${Math.min(100, (total / target) * 100)}%`, background: 'var(--accent)' }} />
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ editor */

export function Editor({ sceneId, split, onToggleSplit }: {
  sceneId: string | null; split: string | null; onToggleSplit: () => void;
}) {
  const { project, dispatch } = useProject();
  const scene = project.scenes.find((s) => s.id === sceneId);
  const splitScene = project.scenes.find((s) => s.id === split);

  if (!scene) return <div className="empty">Select a scene from the binder to begin drafting.</div>;

  const words = wordCount(scene.content);
  const patch = (p: Partial<Scene>) => dispatch({ t: 'scene.update', id: scene.id, patch: p });

  const Pane = ({ s, editable }: { s: Scene; editable: boolean }) => (
    <div className="editor-wrap" style={{ borderLeft: editable ? undefined : '1px solid var(--line)' }}>
      <div className="editor-col">
        {editable && (
          <textarea
            className="synopsis-in" rows={2} placeholder="One-line synopsis — what changes in this scene?"
            value={s.synopsis} onChange={(e) => patch({ synopsis: e.target.value })}
          />
        )}
        <textarea
          className="editor-area" value={s.content} readOnly={!editable}
          placeholder="Begin. Enter the scene as late as you can."
          onChange={(e) => editable && patch({ content: e.target.value })}
        />
      </div>
    </div>
  );

  return (
    <>
      <div className="editor-bar">
        <input className="editor-title" value={scene.title}
               onChange={(e) => patch({ title: e.target.value })} />
        <select className="sel" value={scene.status}
                onChange={(e) => patch({ status: e.target.value as Scene['status'] })}>
          <option value="outline">Outline</option>
          <option value="draft">Draft</option>
          <option value="revised">Revised</option>
          <option value="final">Final</option>
        </select>
        <span className="pill">{words} / {scene.wordTarget}w</span>
        <button className="btn" onClick={() => dispatch({
          t: 'scene.snapshot', id: scene.id,
          label: `Snapshot ${new Date().toLocaleString()}`,
          reason: 'Manual snapshot before revision',
        })}>Snapshot</button>
        <button className={`btn${split ? ' primary' : ''}`} onClick={onToggleSplit}>
          {split ? 'Close split' : 'Split'}
        </button>
      </div>
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <Pane s={scene} editable />
        {splitScene && splitScene.id !== scene.id && <Pane s={splitScene} editable={false} />}
      </div>
    </>
  );
}

/* -------------------------------------------------------------- right pane */

type Tab = 'meta' | 'psych' | 'synastry' | 'checks' | 'history';

export function Inspector({ sceneId }: { sceneId: string | null }) {
  const { project, dispatch } = useProject();
  const [tab, setTab] = useState<Tab>('meta');
  const scene = project.scenes.find((s) => s.id === sceneId);

  const findings = useMemo(
    () => checkContinuity(project).filter((f) => f.evidence.some((e) => e.sceneId === sceneId)),
    [project, sceneId]);

  if (!scene) return <div className="pane-pad empty">No scene selected.</div>;
  const patch = (p: Partial<Scene>) => dispatch({ t: 'scene.update', id: scene.id, patch: p });
  const cast = project.characters.filter((c) => scene.characterIds.includes(c.id));

  return (
    <>
      <div className="pane-head" style={{ gap: 4, padding: '6px 8px' }}>
        {(['meta', 'psych', 'synastry', 'checks', 'history'] as Tab[]).map((t) => (
          <button key={t} className={`tab${tab === t ? ' active' : ''}`}
                  style={{ padding: '3px 7px', fontSize: 11 }} onClick={() => setTab(t)}>
            {t === 'psych' ? 'Psych' : t === 'synastry' ? 'Signs' : t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      <div className="pane-scroll pane-pad">
        {tab === 'meta' && <MetaTab scene={scene} patch={patch} />}
        {tab === 'psych' && <PsychTab cast={cast} scene={scene} />}
        {tab === 'synastry' && <SceneSynastryTab cast={cast} />}
        {tab === 'checks' && (
          findings.length === 0
            ? <div className="muted" style={{ fontSize: 12 }}>No continuity issues detected in this scene.</div>
            : findings.map((f) => (
              <div key={f.id} className={`finding ${f.severity}`}>
                <div className="finding-mod">{f.module}</div>
                <div className="finding-t">{f.title}</div>
                <div className="finding-d">{f.detail}</div>
                <div className="finding-fix">→ {f.suggestion}</div>
              </div>
            ))
        )}
        {tab === 'history' && (
          scene.snapshots.length === 0
            ? <div className="muted" style={{ fontSize: 12 }}>No snapshots yet. Take one before a major revision — every version stays restorable and diffable.</div>
            : scene.snapshots.slice().reverse().map((s) => (
              <div key={s.id} className="card" style={{ marginBottom: 9 }}>
                <div className="card-title" style={{ fontSize: 12 }}>{s.label}</div>
                <div className="card-sub">{s.wordCount} words · {new Date(s.takenAt).toLocaleDateString()}</div>
                <div className="card-sub" style={{ marginTop: 5, fontStyle: 'italic' }}>{s.reason}</div>
                <button className="btn" style={{ marginTop: 8 }}
                        onClick={() => dispatch({ t: 'scene.restore', id: scene.id, snapshotId: s.id })}>
                  Restore
                </button>
              </div>
            ))
        )}
      </div>
    </>
  );
}

function MetaTab({ scene, patch }: { scene: Scene; patch: (p: Partial<Scene>) => void }) {
  const { project } = useProject();
  const toggleCast = (id: string) => patch({
    characterIds: scene.characterIds.includes(id)
      ? scene.characterIds.filter((x) => x !== id)
      : [...scene.characterIds, id],
  });

  return (
    <>
      <div className="section-title">Point of view</div>
      <select className="sel" style={{ width: '100%', marginBottom: 6 }}
              value={scene.povCharacterId ?? ''}
              onChange={(e) => patch({ povCharacterId: e.target.value || null })}>
        <option value="">— no POV set —</option>
        {project.characters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <div className="row2">
        <select className="sel" value={scene.povPerson}
                onChange={(e) => patch({ povPerson: e.target.value as Scene['povPerson'] })}>
          <option value="first">First</option>
          <option value="second">Second</option>
          <option value="third-limited">Third limited</option>
          <option value="third-omniscient">Third omniscient</option>
        </select>
        <select className="sel" value={scene.povTense}
                onChange={(e) => patch({ povTense: e.target.value as Scene['povTense'] })}>
          <option value="past">Past</option>
          <option value="present">Present</option>
        </select>
      </div>

      <div className="section-title">Cast</div>
      <div>
        {project.characters.map((c) => (
          <span key={c.id} className="tag"
                style={{
                  cursor: 'pointer',
                  borderColor: scene.characterIds.includes(c.id) ? c.color : undefined,
                  color: scene.characterIds.includes(c.id) ? c.color : undefined,
                }}
                onClick={() => toggleCast(c.id)}>
            {c.name}
          </span>
        ))}
      </div>

      <div className="section-title">Emotional track</div>
      <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 3 }}>
        Tension {scene.tensionLevel}/10
      </div>
      <input className="range" type="range" min={0} max={10} value={scene.tensionLevel}
             onChange={(e) => patch({ tensionLevel: +e.target.value })} />
      <div style={{ fontSize: 11, color: 'var(--text-3)', margin: '6px 0 3px' }}>
        Valence {scene.emotionalValence > 0 ? '+' : ''}{scene.emotionalValence}
      </div>
      <input className="range" type="range" min={-5} max={5} value={scene.emotionalValence}
             onChange={(e) => patch({ emotionalValence: +e.target.value })} />

      <div className="section-title">Scene audit</div>
      {([
        ['hasGoal', 'POV goal is clear'],
        ['hasConflict', 'Opposition present'],
        ['hasOutcome', 'Outcome or shift'],
        ['changesPlotState', 'Changes plot state'],
        ['revealsCharacter', 'Reveals character'],
        ['entersLate', 'Enters late'],
        ['exitsEarly', 'Exits early'],
      ] as const).map(([k, label]) => (
        <label key={k} className="flex" style={{ fontSize: 12, padding: '3px 0', cursor: 'pointer' }}>
          <input type="checkbox" checked={scene.diagnostics[k]}
                 onChange={(e) => patch({ diagnostics: { ...scene.diagnostics, [k]: e.target.checked } })} />
          <span style={{ color: scene.diagnostics[k] ? 'var(--text-2)' : 'var(--red)' }}>{label}</span>
        </label>
      ))}

      <div className="section-title">Chronology</div>
      <input className="inp" style={{ width: '100%' }} placeholder="Story date e.g. 2231-04-02T09:00"
             value={scene.storyDate ?? ''} onChange={(e) => patch({ storyDate: e.target.value || null })} />
      <div className="section-title">Location</div>
      <select className="sel" style={{ width: '100%' }} value={scene.locationId ?? ''}
              onChange={(e) => patch({ locationId: e.target.value || null })}>
        <option value="">— none —</option>
        {project.world.filter((w) => w.type === 'location')
          .map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
      </select>

      <div className="section-title">Notes</div>
      <textarea className="synopsis-in" rows={4} value={scene.notes}
                onChange={(e) => patch({ notes: e.target.value })} />
    </>
  );
}

function PsychTab({ cast, scene }: { cast: ReturnType<typeof useProject>['project']['characters']; scene: Scene }) {
  if (!cast.length) return <div className="muted" style={{ fontSize: 12 }}>Add characters to the cast to see their psychology here.</div>;
  return (
    <>
      {cast.map((c) => (
        <div key={c.id} style={{ marginBottom: 18 }}>
          <div className="flex" style={{ marginBottom: 7 }}>
            <span className="binder-dot" style={{ background: c.color, width: 8, height: 8 }} />
            <strong style={{ fontSize: 13 }}>{c.name}</strong>
            {scene.povCharacterId === c.id && <span className="pill">POV</span>}
          </div>
          <div className="meta-row"><span className="meta-k">Wants</span><span className="meta-v">{c.psychology.want || '—'}</span></div>
          <div className="meta-row"><span className="meta-k">Needs</span><span className="meta-v">{c.psychology.need || '—'}</span></div>
          <div className="meta-row"><span className="meta-k">Believes</span><span className="meta-v">{c.psychology.lie || '—'}</span></div>
          <div className="meta-row"><span className="meta-k">Fears</span><span className="meta-v">{c.psychology.fear || '—'}</span></div>
          <div className="meta-row"><span className="meta-k">Arc</span><span className="meta-v">{c.psychology.arcType}</span></div>
        </div>
      ))}
    </>
  );
}

function SceneSynastryTab({ cast }: { cast: ReturnType<typeof useProject>['project']['characters'] }) {
  const charted = cast.filter((c) => c.birth);
  const pairs = useMemo(() => {
    const out: { a: string; b: string; rep: ReturnType<typeof computeSynastry> }[] = [];
    for (let i = 0; i < charted.length; i++) {
      for (let j = i + 1; j < charted.length; j++) {
        out.push({
          a: charted[i].name, b: charted[j].name,
          rep: computeSynastry(
            computeChart(charted[i].id, charted[i].birth!),
            computeChart(charted[j].id, charted[j].birth!),
            charted[i].name, charted[j].name),
        });
      }
    }
    return out.sort((x, y) => y.rep.scores.overall - x.rep.scores.overall);
  }, [charted]);

  if (charted.length === 0)
    return <div className="muted" style={{ fontSize: 12 }}>No cast member in this scene has birth data. Add it in the Characters view to activate the Synastry Engine.</div>;
  if (charted.length === 1) {
    const c = charted[0];
    const chart = computeChart(c.id, c.birth!);
    const big = bigThree(chart);
    const arch = buildArchetype(chart);
    return (
      <>
        <div className="section-title">{c.name} — {arch.title}</div>
        <div className="meta-row"><span className="meta-k">Sun</span><span className="meta-v">{big.sun}</span></div>
        <div className="meta-row"><span className="meta-k">Moon</span><span className="meta-v">{big.moon}</span></div>
        <div className="meta-row"><span className="meta-k">Rising</span><span className="meta-v">{big.rising ?? '—'}</span></div>
        <div className="prose" style={{ marginTop: 10 }}>{arch.privateNeed}</div>
      </>
    );
  }

  return (
    <>
      <div className="section-title">Relational charge in this scene</div>
      {pairs.map((p, i) => (
        <div key={i} className="card" style={{ marginBottom: 10 }}>
          <div className="card-title" style={{ fontSize: 12 }}>{p.a} ↔ {p.b}</div>
          <div className="card-sub" style={{ marginBottom: 7 }}>{p.rep.headline}</div>
          <div className="flex" style={{ fontSize: 10, marginBottom: 4 }}>
            <span style={{ width: 52, color: 'var(--text-3)' }}>Tension</span>
            <div className="bar-track" style={{ flex: 1 }}>
              <div className="bar-fill" style={{ width: `${p.rep.scores.tension}%`, background: 'var(--red)' }} />
            </div>
            <span className="mono">{p.rep.scores.tension}</span>
          </div>
          <div className="flex" style={{ fontSize: 10 }}>
            <span style={{ width: 52, color: 'var(--text-3)' }}>Harmony</span>
            <div className="bar-track" style={{ flex: 1 }}>
              <div className="bar-fill" style={{ width: `${p.rep.scores.harmony}%`, background: 'var(--green)' }} />
            </div>
            <span className="mono">{p.rep.scores.harmony}</span>
          </div>
          {p.rep.aspects[0] && (
            <div className="prose" style={{ marginTop: 8, fontSize: 11.5 }}>
              {p.rep.aspects[0].interpretation}
            </div>
          )}
        </div>
      ))}
    </>
  );
}
