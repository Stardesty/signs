'use client';

import React, { useMemo, useState } from 'react';
import { useProject } from '@/lib/store';
import { Character } from '@/lib/types';
import type { BirthData } from '@/lib/astro';
import { computeChart, bigThree, PLANET_GLYPHS } from '@/lib/astro';
import { buildArchetype, computeSynastry, ensembleMatrix } from '@/lib/synastry';
import ChartWheel, { PlacementTable } from './ChartWheel';

/* ------------------------------------------------------------ characters */

export function CharactersView() {
  const { project, dispatch } = useProject();
  const [selId, setSelId] = useState(project.characters[0]?.id ?? null);
  const [editBirth, setEditBirth] = useState(false);
  const sel = project.characters.find((c) => c.id === selId);

  return (
    <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
      <div style={{ width: 210, borderRight: '1px solid var(--line)', overflowY: 'auto', flexShrink: 0 }}>
        <div className="pane-head">
          <span>Cast</span>
          <button className="btn" style={{ padding: '2px 7px' }} onClick={() => dispatch({ t: 'char.add' })}>+</button>
        </div>
        {project.characters.map((c) => (
          <div key={c.id} className={`binder-row${selId === c.id ? ' active' : ''}`} onClick={() => setSelId(c.id)}>
            <span className="binder-dot" style={{ background: c.color }} />
            <span className="binder-title">{c.name}</span>
            <span className="binder-count">{c.role.slice(0, 4)}</span>
          </div>
        ))}
      </div>

      <div className="pane-scroll pane-pad" style={{ flex: 1 }}>
        {!sel ? <div className="empty">No character selected.</div> : (
          <CharacterDetail c={sel} onEditBirth={() => setEditBirth(true)} />
        )}
      </div>

      {editBirth && sel && (
        <BirthModal character={sel} onClose={() => setEditBirth(false)} />
      )}
    </div>
  );
}

function CharacterDetail({ c, onEditBirth }: { c: Character; onEditBirth: () => void }) {
  const { project, dispatch } = useProject();
  const patch = (p: Partial<Character>) => dispatch({ t: 'char.update', id: c.id, patch: p });
  const chart = useMemo(() => (c.birth ? computeChart(c.id, c.birth) : null), [c.id, c.birth]);
  const arch = chart ? buildArchetype(chart) : null;
  const scenes = project.scenes.filter((s) => s.characterIds.includes(c.id));

  const P = ({ k, field }: { k: string; field: keyof Character['psychology'] }) => (
    <div className="field">
      <label>{k}</label>
      <input className="inp" value={c.psychology[field] as string}
             onChange={(e) => patch({ psychology: { ...c.psychology, [field]: e.target.value } })} />
    </div>
  );

  return (
    <>
      <div className="flex-wrap" style={{ marginBottom: 14 }}>
        <input className="editor-title" style={{ flex: 'none', width: 260 }} value={c.name}
               onChange={(e) => patch({ name: e.target.value })} />
        <select className="sel" value={c.role} onChange={(e) => patch({ role: e.target.value as Character['role'] })}>
          {['protagonist', 'antagonist', 'deuteragonist', 'foil', 'mentor', 'supporting', 'minor']
            .map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <span className="pill">{scenes.length} scenes</span>
        {chart && (
          <span className="pill" style={{ color: 'var(--gold)', borderColor: '#5c4a1e' }}>
            {bigThree(chart).sun} ☉ · {bigThree(chart).moon} ☽ · {bigThree(chart).rising ?? '—'} ↑
          </span>
        )}
        <button className="btn" onClick={onEditBirth} style={{ marginLeft: 'auto' }}>
          {c.birth ? 'Edit birth data' : 'Add birth data'}
        </button>
      </div>

      <div className="split">
        <div>
          <div className="section-title">Psychology</div>
          <P k="Temperament" field="temperament" />
          <P k="Core wound" field="coreWound" />
          <P k="The lie they believe" field="lie" />
          <P k="The truth that frees them" field="truth" />
          <P k="External want" field="want" />
          <P k="Internal need" field="need" />
          <P k="Ghost (backstory)" field="ghost" />
          <P k="Fear" field="fear" />
          <P k="Coping mechanism" field="copingMechanism" />
          <div className="field">
            <label>Arc type</label>
            <select className="sel" value={c.psychology.arcType}
                    onChange={(e) => patch({ psychology: { ...c.psychology, arcType: e.target.value as Character['psychology']['arcType'] } })}>
              {['positive', 'negative', 'flat', 'disillusionment', 'corruption']
                .map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div className="section-title">Arc stages</div>
          {c.psychology.arcStages.map((s, i) => (
            <div key={i} className="meta-row">
              <span className="meta-k">{i + 1}</span><span className="meta-v">{s}</span>
            </div>
          ))}
          <div className="section-title">Voice</div>
          <textarea className="synopsis-in" rows={3} value={c.voiceNotes}
                    onChange={(e) => patch({ voiceNotes: e.target.value })} />
        </div>

        <div>
          {chart && arch ? (
            <>
              <div className="section-title">Archetype — {arch.title}</div>
              <div className="prose" style={{ marginBottom: 10 }}>{arch.coreDrive}</div>
              <ChartWheel chart={chart} size={320} />
              <div className="section-title">Signature</div>
              <div className="meta-row"><span className="meta-k">Surface</span><span className="meta-v">{arch.surface}</span></div>
              <div className="meta-row"><span className="meta-k">Private need</span><span className="meta-v">{arch.privateNeed}</span></div>
              <div className="meta-row"><span className="meta-k">Conflict style</span><span className="meta-v">{arch.conflictStyle}</span></div>
              <div className="meta-row"><span className="meta-k">Desire</span><span className="meta-v">{arch.desireStyle}</span></div>
              <div className="meta-row"><span className="meta-k">Shadow</span><span className="meta-v">{arch.shadowContract}</span></div>
              <div className="section-title">Elemental balance</div>
              {Object.entries(chart.elementBalance).map(([el, v]) => (
                <div key={el} className="flex" style={{ marginBottom: 4, fontSize: 11 }}>
                  <span style={{ width: 46, color: 'var(--text-3)' }}>{el}</span>
                  <div className="bar-track" style={{ flex: 1 }}>
                    <div className="bar-fill" style={{
                      width: `${(v / 22) * 100}%`,
                      background: { Fire: '#f87171', Earth: '#86efac', Air: '#fcd34d', Water: '#7dd3fc' }[el],
                    }} />
                  </div>
                  <span className="mono">{v}</span>
                </div>
              ))}
              <div className="prose" style={{ marginTop: 8 }}>{arch.imbalanceNote}</div>
              <div className="section-title">Placements</div>
              <PlacementTable chart={chart} />
            </>
          ) : (
            <div className="card">
              <div className="card-title">No birth data</div>
              <div className="card-sub">
                Add a birth date, time, and place to generate this character&rsquo;s natal chart. The Synastry Engine
                will then map them into the relational tension matrix and start suggesting plot beats.
              </div>
              <button className="btn primary" style={{ marginTop: 10 }} onClick={onEditBirth}>Add birth data</button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

const PRESETS: { label: string; lat: number; lon: number; tz: number }[] = [
  { label: 'Seattle, US', lat: 47.6062, lon: -122.3321, tz: -8 },
  { label: 'New York, US', lat: 40.7128, lon: -74.006, tz: -5 },
  { label: 'London, UK', lat: 51.5074, lon: -0.1278, tz: 0 },
  { label: 'Lagos, NG', lat: 6.5244, lon: 3.3792, tz: 1 },
  { label: 'Moscow, RU', lat: 55.7558, lon: 37.6173, tz: 3 },
  { label: 'Mumbai, IN', lat: 19.076, lon: 72.8777, tz: 5.5 },
  { label: 'Tokyo, JP', lat: 35.6895, lon: 139.6917, tz: 9 },
  { label: 'Sydney, AU', lat: -33.8688, lon: 151.2093, tz: 10 },
  { label: 'São Paulo, BR', lat: -23.5505, lon: -46.6333, tz: -3 },
];

function BirthModal({ character, onClose }: { character: Character; onClose: () => void }) {
  const { dispatch } = useProject();
  const b = character.birth;
  const [form, setForm] = useState<BirthData>(b ?? {
    year: 1990, month: 6, day: 15, hour: 12, minute: 0,
    tzOffset: -8, longitude: -122.3321, latitude: 47.6062,
    placeName: 'Seattle, US', timeUnknown: false,
  });

  const randomise = () => {
    const y = 1960 + Math.floor(Math.random() * 50);
    const p = PRESETS[Math.floor(Math.random() * PRESETS.length)];
    setForm({
      year: y, month: 1 + Math.floor(Math.random() * 12), day: 1 + Math.floor(Math.random() * 28),
      hour: Math.floor(Math.random() * 24), minute: Math.floor(Math.random() * 60),
      tzOffset: p.tz, longitude: p.lon, latitude: p.lat, placeName: p.label, timeUnknown: false,
    });
  };

  const set = (p: Partial<BirthData>) => setForm((prev: BirthData) => ({ ...prev, ...p }));

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="flex" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
          <strong>Birth data — {character.name}</strong>
          <button className="btn" onClick={onClose}>Close</button>
        </div>
        <div className="row3">
          <div className="field"><label>Year</label>
            <input className="inp" type="number" value={form.year} onChange={(e) => set({ year: +e.target.value })} /></div>
          <div className="field"><label>Month</label>
            <input className="inp" type="number" min={1} max={12} value={form.month} onChange={(e) => set({ month: +e.target.value })} /></div>
          <div className="field"><label>Day</label>
            <input className="inp" type="number" min={1} max={31} value={form.day} onChange={(e) => set({ day: +e.target.value })} /></div>
        </div>
        <div className="row3">
          <div className="field"><label>Hour (local)</label>
            <input className="inp" type="number" min={0} max={23} value={form.hour} onChange={(e) => set({ hour: +e.target.value })} /></div>
          <div className="field"><label>Minute</label>
            <input className="inp" type="number" min={0} max={59} value={form.minute} onChange={(e) => set({ minute: +e.target.value })} /></div>
          <div className="field"><label>UTC offset</label>
            <input className="inp" type="number" step={0.5} value={form.tzOffset} onChange={(e) => set({ tzOffset: +e.target.value })} /></div>
        </div>
        <div className="field">
          <label>Place</label>
          <select className="sel" value={form.placeName ?? ''} onChange={(e) => {
            const p = PRESETS.find((x) => x.label === e.target.value);
            if (p) set({ placeName: p.label, latitude: p.lat, longitude: p.lon, tzOffset: p.tz });
          }}>
            {PRESETS.map((p) => <option key={p.label} value={p.label}>{p.label}</option>)}
          </select>
        </div>
        <div className="row2">
          <div className="field"><label>Latitude (N+)</label>
            <input className="inp" type="number" step={0.0001} value={form.latitude} onChange={(e) => set({ latitude: +e.target.value })} /></div>
          <div className="field"><label>Longitude (E+)</label>
            <input className="inp" type="number" step={0.0001} value={form.longitude} onChange={(e) => set({ longitude: +e.target.value })} /></div>
        </div>
        <label className="flex" style={{ fontSize: 12, marginBottom: 14 }}>
          <input type="checkbox" checked={!!form.timeUnknown} onChange={(e) => set({ timeUnknown: e.target.checked })} />
          Birth time unknown (suppresses houses, Ascendant and MC)
        </label>
        <div className="flex">
          <button className="btn" onClick={randomise}>Suggest random</button>
          <button className="btn primary" style={{ marginLeft: 'auto' }}
                  onClick={() => { dispatch({ t: 'char.update', id: character.id, patch: { birth: form } }); onClose(); }}>
            Generate chart
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------- relationship web */

export function RelationshipView() {
  const { project } = useProject();
  const [mode, setMode] = useState<'web' | 'heatmap'>('web');
  const chars = project.characters;

  const edges = useMemo(() => {
    const charted = chars.filter((c) => c.birth)
      .map((c) => ({ id: c.id, name: c.name, chart: computeChart(c.id, c.birth!) }));
    return ensembleMatrix(charted);
  }, [chars]);

  const size = 540;
  const cx = size / 2, cy = size / 2, R = size / 2 - 78;
  const pos = chars.map((c, i) => {
    const a = (i / chars.length) * Math.PI * 2 - Math.PI / 2;
    return { c, x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) };
  });
  const find = (id: string) => pos.find((p) => p.c.id === id)!;

  return (
    <div className="pane-scroll pane-pad">
      <div className="flex-wrap" style={{ marginBottom: 14 }}>
        <button className={`btn${mode === 'web' ? ' primary' : ''}`} onClick={() => setMode('web')}>Relationship web</button>
        <button className={`btn${mode === 'heatmap' ? ' primary' : ''}`} onClick={() => setMode('heatmap')}>Synastry heatmap</button>
        <span className="muted" style={{ fontSize: 12 }}>
          {mode === 'web'
            ? 'Authored relationships. Line weight = recorded intensity; colour = status.'
            : 'Computed from natal charts. Red = relational tension, green = harmony — independent of what you have written.'}
        </span>
      </div>

      {mode === 'web' ? (
        <div className="split">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {project.relationships.map((r, ri) => {
              const a = find(r.fromId), b = find(r.toId);
              if (!a || !b) return null;
              // Stagger labels along the edge so chords crossing the centre
              // do not stack their text on the same point.
              const t = ri % 2 === 0 ? 0.3 : 0.7;
              const lx = a.x + (b.x - a.x) * t;
              const ly = a.y + (b.y - a.y) * t;
              const color = { stable: '#6ee7b7', strained: '#fbbf24', broken: '#fb7185', evolving: '#7dd3fc', secret: '#a78bfa' }[r.status];
              return (
                <g key={r.id}>
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color}
                        strokeWidth={0.6 + r.intensity * 0.32} strokeOpacity={0.5}
                        strokeDasharray={r.status === 'secret' ? '4 3' : undefined} />
                  <text x={lx} y={ly - 5} fontSize={9} fill="#8890ab" textAnchor="middle"
                        style={{ paintOrder: 'stroke' }} stroke="#0a0b12" strokeWidth={3}>
                    {r.kind.split(' / ')[0]}
                  </text>
                </g>
              );
            })}
            {pos.map(({ c, x, y }) => (
              <g key={c.id}>
                <circle cx={x} cy={y} r={22} fill="#141724" stroke={c.color} strokeWidth={1.6} />
                <text x={x} y={y} fill={c.color} fontSize={11} textAnchor="middle" dominantBaseline="central">
                  {c.name.split(' ').map((w) => w[0]).join('')}
                </text>
                <text x={x} y={y + 34} fill="#a4a9c0" fontSize={10} textAnchor="middle">{c.name.split(' ')[0]}</text>
              </g>
            ))}
          </svg>
          <div>
            <div className="section-title">Recorded relationships</div>
            {project.relationships.map((r) => (
              <div key={r.id} className="card" style={{ marginBottom: 8 }}>
                <div className="card-title" style={{ fontSize: 12 }}>
                  {project.characters.find((c) => c.id === r.fromId)?.name} → {project.characters.find((c) => c.id === r.toId)?.name}
                </div>
                <div className="card-sub">{r.kind} · {r.status} · intensity {r.intensity}/10</div>
                <div className="card-sub" style={{ marginTop: 5 }}>{r.description}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="scroll-x">
          <table className="data" style={{ minWidth: 520 }}>
            <thead>
              <tr>
                <th></th>
                {chars.map((c) => <th key={c.id}>{c.name.split(' ')[0]}</th>)}
              </tr>
            </thead>
            <tbody>
              {chars.map((a) => (
                <tr key={a.id}>
                  <td style={{ color: a.color, fontWeight: 600 }}>{a.name.split(' ')[0]}</td>
                  {chars.map((b) => {
                    if (a.id === b.id) return <td key={b.id} style={{ background: 'var(--bg-2)' }}></td>;
                    const e = edges.find((x) => (x.a === a.id && x.b === b.id) || (x.a === b.id && x.b === a.id));
                    if (!e) return <td key={b.id} className="muted">—</td>;
                    const t = e.tension / 100;
                    return (
                      <td key={b.id}
                          title={`${e.headline} · tension ${e.tension}% · harmony ${e.harmony}% · intensity ${e.overall}`}
                          style={{
                            background: `rgba(${Math.round(251 * t + 110 * (1 - t))}, ${Math.round(113 * t + 231 * (1 - t))}, ${Math.round(133 * t + 183 * (1 - t))}, ${0.14 + (e.overall / 100) * 0.5})`,
                            textAlign: 'center', fontVariantNumeric: 'tabular-nums',
                          }}>
                        {e.tension.toFixed(0)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="section-title">Pairings ranked by relational charge</div>
          {[...edges].sort((x, y) => y.overall - x.overall).map((e, i) => (
            <div key={i} className="meta-row">
              <span className="meta-k">
                {project.characters.find((c) => c.id === e.a)?.name} ↔ {project.characters.find((c) => c.id === e.b)?.name}
              </span>
              <span className="meta-v">{e.headline} · {e.dominant} · charge {e.overall}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
