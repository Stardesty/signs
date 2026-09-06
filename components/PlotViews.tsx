'use client';

import React, { useMemo, useState } from 'react';
import { useProject } from '@/lib/store';
import { wordCount, Scene } from '@/lib/types';

const STATUS_COLOR: Record<string, string> = {
  outline: '#6f7590', draft: '#7dd3fc', revised: '#fbbf24', final: '#6ee7b7',
};

/* ------------------------------------------------------- card corkboard */

export function CardsView({ onOpen }: { onOpen: (id: string) => void }) {
  const { project, dispatch } = useProject();
  const [bookId, setBookId] = useState(project.books[0].id);
  const [drag, setDrag] = useState<string | null>(null);

  const scenes = project.scenes.filter((s) => s.bookId === bookId);

  const move = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    const from = project.binder.find((b) => b.sceneId === fromId);
    const to = project.binder.find((b) => b.sceneId === toId);
    if (!from || !to) return;
    dispatch({ t: 'load', project: {
      ...project,
      binder: project.binder.map((b) =>
        b.id === from.id ? { ...b, order: to.order, parentId: to.parentId }
        : b.id === to.id ? { ...b, order: from.order, parentId: from.parentId } : b),
    } });
  };

  return (
    <div className="pane-scroll pane-pad">
      <div className="flex-wrap" style={{ marginBottom: 14 }}>
        <select className="sel" value={bookId} onChange={(e) => setBookId(e.target.value)}>
          {project.books.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
        </select>
        <span className="muted" style={{ fontSize: 12 }}>
          Drag a card onto another to swap positions. Colour = status; bar = tension.
        </span>
      </div>
      <div className="grid-auto">
        {scenes.map((s) => (
          <div
            key={s.id} className="card click" draggable
            onDragStart={() => setDrag(s.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => { if (drag) move(drag, s.id); setDrag(null); }}
            onClick={() => onOpen(s.id)}
          >
            <div className="card-strip" style={{ background: STATUS_COLOR[s.status] }} />
            <div className="card-title">{s.title}</div>
            <div className="card-sub" style={{ minHeight: 34 }}>{s.synopsis || 'No synopsis yet.'}</div>
            <div className="flex" style={{ marginTop: 10, fontSize: 10, color: 'var(--text-3)' }}>
              <span>{wordCount(s.content)}w</span>
              <span>·</span>
              <span>{s.status}</span>
              <span style={{ marginLeft: 'auto' }}>
                {s.emotionalValence > 0 ? '+' : ''}{s.emotionalValence}
              </span>
            </div>
            <div className="bar-track" style={{ marginTop: 6 }}>
              <div className="bar-fill" style={{
                width: `${s.tensionLevel * 10}%`,
                background: s.tensionLevel > 7 ? 'var(--red)' : s.tensionLevel > 4 ? 'var(--amber)' : 'var(--accent-2)',
              }} />
            </div>
            <div style={{ marginTop: 8 }}>
              {project.characters.filter((c) => s.characterIds.includes(c.id)).map((c) => (
                <span key={c.id} className="tag" style={{ borderColor: c.color, color: c.color }}>
                  {c.name.split(' ')[0]}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- plot grid */

export function PlotGridView({ onOpen }: { onOpen: (id: string) => void }) {
  const { project, dispatch } = useProject();
  const [bookId, setBookId] = useState(project.books[0].id);
  const columns = 10;

  const beatsFor = (lineId: string, col: number) =>
    project.beats.filter((b) =>
      b.plotLineId === lineId && b.bookId === bookId &&
      Math.min(columns - 1, Math.floor(b.position * columns)) === col);

  const label = (i: number) => {
    const pct = i / columns;
    if (pct < 0.1) return 'Hook';
    if (pct < 0.25) return 'Setup';
    if (pct < 0.5) return 'Rising';
    if (pct < 0.6) return 'Midpoint';
    if (pct < 0.8) return 'Complication';
    if (pct < 0.9) return 'Crisis';
    return 'Resolution';
  };

  return (
    <div className="pgrid pane-scroll">
      <div className="flex-wrap" style={{ marginBottom: 14 }}>
        <select className="sel" value={bookId} onChange={(e) => setBookId(e.target.value)}>
          {project.books.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
        </select>
        <span className="muted" style={{ fontSize: 12 }}>
          Rows are plot lines, columns are narrative position. Purple left-edge = beat authored by the Synastry Engine.
        </span>
      </div>
      <table className="pgrid-table">
        <thead>
          <tr>
            <th className="pgrid-th pgrid-rowhead" style={{ top: 0 }}>Plot line</th>
            {Array.from({ length: columns }, (_, i) => (
              <th key={i} className="pgrid-th">
                {(i * 10)}%<div style={{ fontSize: 9, color: 'var(--text-3)' }}>{label(i)}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {project.plotLines.map((line) => (
            <tr key={line.id}>
              <td className="pgrid-rowhead">
                <div className="flex" style={{ gap: 6 }}>
                  <span className="binder-dot" style={{ background: line.color, width: 8, height: 8 }} />
                  <strong style={{ fontSize: 12 }}>{line.title}</strong>
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 3 }}>{line.kind}</div>
              </td>
              {Array.from({ length: columns }, (_, col) => (
                <td key={col} className="pgrid-cell">
                  {beatsFor(line.id, col).map((b) => (
                    <div key={b.id}
                         className={`beat-chip ${b.fulfilled ? 'done' : 'open'}${b.source === 'synastry' ? ' synastry' : ''}`}
                         style={{ marginBottom: 5 }}
                         onClick={() => {
                           if (b.sceneIds[0]) onOpen(b.sceneIds[0]);
                           else dispatch({ t: 'beat.update', id: b.id, patch: { fulfilled: !b.fulfilled } });
                         }}
                         title={b.description}>
                      <strong>{b.title}</strong>
                      <div style={{ color: 'var(--text-3)', fontSize: 10.5, marginTop: 2 }}>
                        {b.frameworkSlot ?? b.source}
                      </div>
                    </div>
                  ))}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* -------------------------------------------------------------- timeline */

export function TimelineView({ onOpen }: { onOpen: (id: string) => void }) {
  const { project } = useProject();
  const [scope, setScope] = useState<'series' | string>('series');

  const events = useMemo(() => {
    const list = scope === 'series'
      ? project.events
      : project.events.filter((e) => e.bookId === scope || e.bookId === null);
    return [...list].sort((a, b) => a.storyDate.localeCompare(b.storyDate));
  }, [project.events, scope]);

  const years = events.map((e) => parseInt(e.storyDate.slice(0, 4), 10));
  const minY = Math.min(...years);
  const maxY = Math.max(...years);
  const span = Math.max(1, maxY - minY);

  const KIND_COLOR: Record<string, string> = {
    scene: '#7dd3fc', backstory: '#6f7590', offscreen: '#a78bfa',
    historical: '#e6c07b', prophecy: '#f472b6',
  };

  return (
    <div className="pane-scroll pane-pad">
      <div className="flex-wrap" style={{ marginBottom: 16 }}>
        <select className="sel" value={scope} onChange={(e) => setScope(e.target.value)}>
          <option value="series">Whole series chronology</option>
          {project.books.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
        </select>
        <span className="muted" style={{ fontSize: 12 }}>
          {events.length} events · {minY}–{maxY} · dependency constraints enforced by the chronology checker
        </span>
      </div>

      {/* compressed decade ruler */}
      <div style={{ position: 'relative', height: 44, marginBottom: 20, borderBottom: '1px solid var(--line)' }}>
        {events.map((e) => {
          const y = parseInt(e.storyDate.slice(0, 4), 10);
          const left = ((y - minY) / span) * 100;
          return (
            <div key={e.id} title={`${e.title} — ${e.storyDate}`}
                 style={{
                   position: 'absolute', left: `${left}%`, bottom: 0,
                   width: 2, height: 22, background: KIND_COLOR[e.kind], opacity: 0.85,
                 }} />
          );
        })}
        <div style={{ position: 'absolute', left: 0, top: 0, fontSize: 10, color: 'var(--text-3)' }}>{minY}</div>
        <div style={{ position: 'absolute', right: 0, top: 0, fontSize: 10, color: 'var(--text-3)' }}>{maxY}</div>
      </div>

      <div style={{ position: 'relative', paddingLeft: 18 }}>
        <div style={{ position: 'absolute', left: 4, top: 6, bottom: 6, width: 1, background: 'var(--line)' }} />
        {events.map((e) => (
          <div key={e.id} style={{ position: 'relative', marginBottom: 14 }}>
            <div style={{
              position: 'absolute', left: -18, top: 5, width: 9, height: 9,
              borderRadius: '50%', background: KIND_COLOR[e.kind], border: '2px solid var(--bg)',
            }} />
            <div className={`card${e.sceneId ? ' click' : ''}`}
                 onClick={() => e.sceneId && onOpen(e.sceneId)}>
              <div className="flex" style={{ justifyContent: 'space-between' }}>
                <div className="card-title">{e.title}</div>
                <span className="mono muted">{e.storyDate.replace('T', ' ')}</span>
              </div>
              <div className="card-sub">{e.description}</div>
              <div className="flex-wrap" style={{ marginTop: 8 }}>
                <span className="tag">{e.kind}</span>
                {e.durationMinutes !== null && <span className="tag">{e.durationMinutes} min</span>}
                {project.characters.filter((c) => e.characterIds.includes(c.id)).map((c) => (
                  <span key={c.id} className="tag" style={{ borderColor: c.color, color: c.color }}>
                    {c.name.split(' ')[0]}
                  </span>
                ))}
                {e.dependsOn.map((d, i) => (
                  <span key={i} className="tag" style={{ borderStyle: 'dashed' }}>
                    {d.relation} “{project.events.find((x) => x.id === d.eventId)?.title ?? '?'}”
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* --------------------------------------------------- emotional / pacing */

export function EmotionStrip({ scenes }: { scenes: Scene[] }) {
  const w = 100 / Math.max(1, scenes.length);
  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" style={{ width: '100%', height: 90 }}>
      <line x1="0" y1="20" x2="100" y2="20" stroke="#2a2f45" strokeWidth="1"
            vectorEffect="non-scaling-stroke" />
      {scenes.map((s, i) => {
        const h = Math.abs(s.emotionalValence) * 3.6;
        const y = s.emotionalValence >= 0 ? 20 - h : 20;
        return (
          <rect key={s.id} x={i * w + w * 0.15} y={y} width={w * 0.7} height={Math.max(0.6, h)}
                fill={s.emotionalValence >= 0 ? '#6ee7b7' : '#fb7185'} opacity={0.75} />
        );
      })}
      <polyline
        fill="none" stroke="#a78bfa" strokeWidth="2" vectorEffect="non-scaling-stroke"
        points={scenes.map((s, i) => `${i * w + w / 2},${40 - s.tensionLevel * 3.6}`).join(' ')}
      />
      {scenes.map((s, i) => (
        <circle key={`d${s.id}`} cx={i * w + w / 2} cy={40 - s.tensionLevel * 3.6} r={1.2}
                fill="#a78bfa" vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );
}
