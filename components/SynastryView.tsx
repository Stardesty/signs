'use client';

import React, { useMemo, useState } from 'react';
import { useProject } from '@/lib/store';
import { computeChart, PLANET_GLYPHS, formatLongitude } from '@/lib/astro';
import { computeSynastry, compositeMidpoints, buildArchetype, PlotBeatSuggestion } from '@/lib/synastry';
import { uid } from '@/lib/types';
import ChartWheel from './ChartWheel';

const ASPECT_GLYPH: Record<string, string> = {
  Conjunction: '☌', Opposition: '☍', Trine: '△', Square: '□', Sextile: '✶',
  Quincunx: '⚻', Semisquare: '∠', Sesquiquadrate: '⚼', Quintile: 'Q',
};

const NATURE_COLOR: Record<string, string> = {
  harmonious: 'var(--green)', tense: 'var(--red)',
  dynamic: 'var(--gold)', neutral: 'var(--text-3)',
};

export default function SynastryView() {
  const { project, dispatch } = useProject();
  const charted = project.characters.filter((c) => c.birth);
  const [aId, setAId] = useState(charted[0]?.id ?? '');
  const [bId, setBId] = useState(charted[1]?.id ?? '');
  const [tab, setTab] = useState<'report' | 'aspects' | 'beats' | 'composite' | 'cosmology'>('report');

  const a = project.characters.find((c) => c.id === aId);
  const b = project.characters.find((c) => c.id === bId);

  const data = useMemo(() => {
    if (!a?.birth || !b?.birth || a.id === b.id) return null;
    const chartA = computeChart(a.id, a.birth);
    const chartB = computeChart(b.id, b.birth);
    return {
      chartA, chartB,
      report: computeSynastry(chartA, chartB, a.name, b.name),
      composite: compositeMidpoints(chartA, chartB),
      archA: buildArchetype(chartA), archB: buildArchetype(chartB),
    };
  }, [a, b]);

  if (charted.length < 2) {
    return (
      <div className="empty">
        The Synastry Engine needs at least two characters with birth data.<br />
        Open <strong>Characters</strong> and add birth details to unlock relational analysis.
      </div>
    );
  }

  const addBeat = (sug: PlotBeatSuggestion) => {
    const line = project.plotLines.find((l) => l.kind === 'relationship') ?? project.plotLines[0];
    const posMap: Record<string, number> = {
      'Act I': 0.12, 'Act II-A': 0.3, Midpoint: 0.5, 'Act II-B': 0.68, 'Act III': 0.86, Resolution: 0.95,
    };
    dispatch({ t: 'beat.add', beat: {
      id: uid('bt'), plotLineId: line.id, bookId: project.books[0].id,
      title: `${sug.kind}: ${a!.name.split(' ')[0]} / ${b!.name.split(' ')[0]}`,
      description: sug.beat, position: posMap[sug.actPosition] ?? 0.5,
      framework: 'custom', frameworkSlot: sug.actPosition, sceneIds: [],
      fulfilled: false, source: 'synastry', sourceRef: sug.driver,
    } });
  };

  return (
    <div className="pane-scroll pane-pad">
      <div className="flex-wrap" style={{ marginBottom: 16 }}>
        <select className="sel" value={aId} onChange={(e) => setAId(e.target.value)}>
          {charted.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <span className="muted">↔</span>
        <select className="sel" value={bId} onChange={(e) => setBId(e.target.value)}>
          {charted.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div style={{ marginLeft: 'auto' }} className="flex">
          {(['report', 'aspects', 'beats', 'composite', 'cosmology'] as const).map((t) => (
            <button key={t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {!data ? <div className="empty">Select two different characters.</div> : (
        <>
          {tab === 'report' && (
            <>
              <div className="split" style={{ marginBottom: 18 }}>
                <div>
                  <div className="section-title">Bi-wheel — {a!.name} (inner) / {b!.name} (outer)</div>
                  <ChartWheel chart={data.chartA} outer={data.chartB} size={400}
                              innerColor={a!.color} outerColor={b!.color} />
                </div>
                <div>
                  <div className="section-title">Synastry report card</div>
                  <div className="card" style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 4 }}>{data.report.headline}</div>
                    <div className="card-sub">Dominant dynamic: {data.report.dominantDynamic} · {data.report.aspects.length} cross-chart contacts</div>
                  </div>
                  {([
                    ['Relational charge', data.report.scores.overall, 'var(--accent)'],
                    ['Harmony', data.report.scores.harmony, 'var(--green)'],
                    ['Tension', data.report.scores.tension, 'var(--red)'],
                    ['Volatility', data.report.scores.volatility, 'var(--amber)'],
                    ['Intimacy', data.report.scores.intimacy, 'var(--rose)'],
                    ['Intellectual', data.report.scores.intellectual, 'var(--accent-2)'],
                    ['Karmic weight', data.report.scores.karmic, 'var(--gold)'],
                  ] as const).map(([label, v, color]) => (
                    <div key={label} className="flex" style={{ marginBottom: 7, fontSize: 11.5 }}>
                      <span style={{ width: 108, color: 'var(--text-3)' }}>{label}</span>
                      <div className="bar-track" style={{ flex: 1 }}>
                        <div className="bar-fill" style={{ width: `${v}%`, background: color }} />
                      </div>
                      <span className="mono" style={{ width: 34, textAlign: 'right' }}>{v}</span>
                    </div>
                  ))}
                  <div className="section-title">Power balance</div>
                  <div style={{ position: 'relative', height: 26, background: 'var(--bg-3)', borderRadius: 13 }}>
                    <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'var(--line-2)' }} />
                    <div style={{
                      position: 'absolute', top: 4, bottom: 4,
                      left: data.report.scores.powerImbalance >= 0 ? '50%' : `${50 + data.report.scores.powerImbalance * 50}%`,
                      width: `${Math.abs(data.report.scores.powerImbalance) * 50}%`,
                      background: data.report.scores.powerImbalance >= 0 ? a!.color : b!.color,
                      borderRadius: 9, opacity: 0.8,
                    }} />
                    <div style={{ position: 'absolute', left: 9, top: 5, fontSize: 10.5, color: 'var(--text-3)' }}>{b!.name.split(' ')[0]}</div>
                    <div style={{ position: 'absolute', right: 9, top: 5, fontSize: 10.5, color: 'var(--text-3)' }}>{a!.name.split(' ')[0]}</div>
                  </div>
                </div>
              </div>

              <div className="section-title">Narrative interpretation</div>
              <div className="prose card" style={{ marginBottom: 14 }}>{data.report.summary}</div>

              <div className="split">
                <div>
                  <div className="section-title" style={{ color: 'var(--red)' }}>Friction to exploit</div>
                  {data.report.redFlags.length === 0
                    ? <div className="muted" style={{ fontSize: 12 }}>No significant hard contacts. This pairing will not generate conflict on its own — the plot must supply it.</div>
                    : data.report.redFlags.map((r, i) => (
                      <div key={i} className="finding warning"><div className="finding-d">{r}</div></div>
                    ))}
                </div>
                <div>
                  <div className="section-title" style={{ color: 'var(--green)' }}>Bonds that hold</div>
                  {data.report.strengths.length === 0
                    ? <div className="muted" style={{ fontSize: 12 }}>No significant soft contacts. Nothing here will keep them together once the plot stops forcing it.</div>
                    : data.report.strengths.map((r, i) => (
                      <div key={i} className="finding info"><div className="finding-d">{r}</div></div>
                    ))}
                </div>
              </div>

              <div className="section-title">Destiny arc forecast (series-level)</div>
              <div className="prose card">{data.report.destinyArc}</div>

              <div className="section-title">Element compatibility</div>
              <div className="prose">{data.report.elementCompatibility}</div>
            </>
          )}

          {tab === 'aspects' && (
            <>
              <div className="section-title">Aspect table — {data.report.aspects.length} contacts</div>
              <table className="data">
                <thead>
                  <tr>
                    <th>{a!.name}</th><th></th><th>{b!.name}</th>
                    <th>Orb</th><th>Nature</th><th>Category</th><th>Weight</th><th>Reading</th>
                  </tr>
                </thead>
                <tbody>
                  {data.report.aspects.map((x, i) => (
                    <tr key={i}>
                      <td style={{ color: a!.color, whiteSpace: 'nowrap' }}>
                        {PLANET_GLYPHS[x.a] ?? ''} {x.a}
                      </td>
                      <td style={{ color: NATURE_COLOR[x.nature], fontSize: 14, textAlign: 'center' }}
                          title={x.aspect}>{ASPECT_GLYPH[x.aspect]}</td>
                      <td style={{ color: b!.color, whiteSpace: 'nowrap' }}>
                        {PLANET_GLYPHS[x.b] ?? ''} {x.b}
                      </td>
                      <td className="mono">{x.orb.toFixed(2)}°</td>
                      <td style={{ color: NATURE_COLOR[x.nature] }}>{x.nature}</td>
                      <td className="muted">{x.category}</td>
                      <td className="mono">{x.weight.toFixed(2)}</td>
                      <td style={{ maxWidth: 380, color: 'var(--text-2)' }}>{x.interpretation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {tab === 'beats' && (
            <>
              <div className="section-title">Plot beat recommendations</div>
              <div className="prose" style={{ marginBottom: 14 }}>
                Derived from the cross-chart contacts above, not from a template. Each beat cites the aspect
                that produced it — push one to the Plot Grid and it appears with a purple edge, marked
                <span className="mono"> source: synastry</span>.
              </div>
              {data.report.plotBeats.map((s, i) => (
                <div key={i} className="card" style={{ marginBottom: 10 }}>
                  <div className="flex" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
                    <div className="flex">
                      <span className="pill">{s.actPosition}</span>
                      <span className="pill" style={{ color: 'var(--accent)' }}>{s.kind}</span>
                      <span className="pill" style={{
                        color: s.tensionDelta > 0 ? 'var(--red)' : 'var(--green)',
                      }}>
                        tension {s.tensionDelta > 0 ? '+' : ''}{s.tensionDelta.toFixed(2)}
                      </span>
                    </div>
                    <button className="btn" onClick={() => addBeat(s)}>Add to Plot Grid</button>
                  </div>
                  <div className="prose">{s.beat}</div>
                  <div className="mono muted" style={{ marginTop: 7 }}>driver: {s.driver}</div>
                </div>
              ))}
            </>
          )}

          {tab === 'composite' && (
            <>
              <div className="section-title">Composite midpoints — the relationship as its own entity</div>
              <div className="prose" style={{ marginBottom: 12 }}>
                Midpoints between the two charts. Read these as the personality of the <em>bond</em> rather than
                of either person — useful when the relationship itself functions as a character in the book.
              </div>
              <div className="split">
                <table className="data">
                  <thead><tr><th>Body</th><th>Composite position</th></tr></thead>
                  <tbody>
                    {data.composite.map((m) => (
                      <tr key={m.body}>
                        <td>{PLANET_GLYPHS[m.body] ?? ''} {m.body}</td>
                        <td className="mono">{m.label}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div>
                  <div className="section-title">Archetype pairing</div>
                  <div className="card" style={{ marginBottom: 10 }}>
                    <div className="card-title">{a!.name} — {data.archA.title}</div>
                    <div className="card-sub">{data.archA.coreDrive}</div>
                    <div className="card-sub" style={{ marginTop: 6 }}>{data.archA.narrativeFunction}</div>
                  </div>
                  <div className="card">
                    <div className="card-title">{b!.name} — {data.archB.title}</div>
                    <div className="card-sub">{data.archB.coreDrive}</div>
                    <div className="card-sub" style={{ marginTop: 6 }}>{data.archB.narrativeFunction}</div>
                  </div>
                </div>
              </div>
            </>
          )}

          {tab === 'cosmology' && <CosmologyPanel />}
        </>
      )}
    </div>
  );
}

/* ---------------------------------------------------- fictional zodiac */

function CosmologyPanel() {
  const { project } = useProject();
  const [sysId, setSysId] = useState(project.zodiacSystems[0]?.id ?? '');
  const sys = project.zodiacSystems.find((s) => s.id === sysId);

  if (!sys) return <div className="empty">No custom cosmology defined for this series.</div>;

  return (
    <>
      <div className="flex-wrap" style={{ marginBottom: 12 }}>
        <select className="sel" value={sysId} onChange={(e) => setSysId(e.target.value)}>
          {project.zodiacSystems.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <span className="pill" style={{ color: sys.derivedFromTropical ? 'var(--green)' : 'var(--amber)' }}>
          {sys.derivedFromTropical ? 'maps 1:1 to tropical — all synastry math applies' : 'independent system — computation approximated'}
        </span>
      </div>
      <div className="prose" style={{ marginBottom: 14 }}>{sys.description}</div>
      <div className="grid-auto">
        {sys.signs.map((s) => (
          <div key={s.name} className="card">
            <div className="flex" style={{ justifyContent: 'space-between' }}>
              <div className="card-title">{s.glyph} {s.name}</div>
              <span className="mono muted">{s.startDegree}°</span>
            </div>
            <div className="card-sub">{s.element} · {s.modality}{s.mapsTo ? ` · ≡ ${s.mapsTo}` : ''}</div>
            <div className="card-sub" style={{ marginTop: 6, fontStyle: 'italic' }}>{s.mythos}</div>
          </div>
        ))}
      </div>
    </>
  );
}
