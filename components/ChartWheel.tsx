'use client';

import React from 'react';
import {
  Chart, PLANET_GLYPHS, SIGNS, SIGN_GLYPHS, norm360, signElement, formatLongitude, findAspect,
} from '@/lib/astro';

const ELEMENT_COLOR: Record<string, string> = {
  Fire: '#f87171', Earth: '#86efac', Air: '#fcd34d', Water: '#7dd3fc',
};

const ASPECT_COLOR: Record<string, string> = {
  Conjunction: '#e6c07b', Opposition: '#fb7185', Square: '#fb7185',
  Trine: '#6ee7b7', Sextile: '#6ee7b7', Quincunx: '#a78bfa',
  Semisquare: '#8b5f6b', Sesquiquadrate: '#8b5f6b', Quintile: '#7dd3fc',
};

interface Props {
  chart: Chart;
  /** optional second chart drawn on an outer ring (synastry bi-wheel) */
  outer?: Chart;
  size?: number;
  showAspects?: boolean;
  innerColor?: string;
  outerColor?: string;
}

/**
 * Astrological chart wheel. Pure SVG, no libraries — renders identically in
 * the sandboxed preview iframe and in a deployed browser.
 */
export default function ChartWheel({
  chart, outer, size = 380, showAspects = true,
  innerColor = '#7dd3fc', outerColor = '#f0abfc',
}: Props) {
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - 6;

  // Rotate so the Ascendant sits at the 9 o'clock position (astrological convention).
  const asc = chart.ascendant ?? 0;
  const toAngle = (lon: number) => norm360(180 - (lon - asc));
  const pt = (lon: number, r: number) => {
    const a = toAngle(lon) * (Math.PI / 180);
    return [cx + r * Math.cos(a), cy - r * Math.sin(a)] as const;
  };

  const rSignOuter = R;
  const rSignInner = R * 0.855;
  const rOuterPlanets = outer ? R * 0.795 : R * 0.775;
  const rHouseRing = outer ? R * 0.70 : R * 0.735;
  const rInnerPlanets = outer ? R * 0.615 : R * 0.775;
  const rAspect = R * 0.55;

  const cusps = chart.cusps ?? Array.from({ length: 12 }, (_, i) => norm360(asc + i * 30));

  /** Spread overlapping glyphs so they stay legible. */
  const layout = (lons: number[], minSep = 7) => {
    const idx = lons.map((l, i) => ({ i, a: toAngle(l) })).sort((x, y) => x.a - y.a);
    for (let pass = 0; pass < 24; pass++) {
      let moved = false;
      for (let k = 0; k < idx.length; k++) {
        const cur = idx[k];
        const nxt = idx[(k + 1) % idx.length];
        let gap = nxt.a - cur.a;
        if (gap < 0) gap += 360;
        if (gap < minSep) {
          const push = (minSep - gap) / 2;
          cur.a -= push; nxt.a += push; moved = true;
        }
      }
      if (!moved) break;
    }
    const out: number[] = new Array(lons.length).fill(0);
    for (const e of idx) out[e.i] = e.a;
    return out;
  };

  const innerBodies = chart.placements;
  const innerAngles = layout(innerBodies.map((p) => p.longitude));
  const outerBodies = outer?.placements ?? [];

  // Significant cross-chart contacts, drawn as chords in the bi-wheel.
  const GENERATIONAL = new Set(['Jupiter', 'Uranus', 'Neptune', 'Pluto', 'Chiron', 'NorthNode']);
  const crossAspects = outer
    ? chart.placements.flatMap((a) =>
        outer.placements.flatMap((b) => {
          if (GENERATIONAL.has(a.body) && GENERATIONAL.has(b.body)) return [];
          const hit = findAspect(a.longitude, b.longitude, a.body, b.body);
          if (!hit || hit.weight < 0.3) return [];
          return [{ lonA: a.longitude, lonB: b.longitude, aspect: hit.aspect, exactness: hit.exactness }];
        }))
    : [];
  const outerAngles = outer ? layout(outerBodies.map((p) => p.longitude)) : [];

  const atAngle = (deg: number, r: number) => {
    const a = deg * (Math.PI / 180);
    return [cx + r * Math.cos(a), cy - r * Math.sin(a)] as const;
  };

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img"
         aria-label="Astrological chart wheel">
      <defs>
        <radialGradient id="wheelbg" cx="50%" cy="50%">
          <stop offset="0%" stopColor="#12142099" />
          <stop offset="100%" stopColor="#0a0b12" />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={R} fill="url(#wheelbg)" />

      {/* sign ring */}
      {SIGNS.map((sign, i) => {
        const start = i * 30;
        const a0 = toAngle(start) * (Math.PI / 180);
        const a1 = toAngle(start + 30) * (Math.PI / 180);
        const p0 = [cx + rSignOuter * Math.cos(a0), cy - rSignOuter * Math.sin(a0)];
        const p1 = [cx + rSignOuter * Math.cos(a1), cy - rSignOuter * Math.sin(a1)];
        const q0 = [cx + rSignInner * Math.cos(a0), cy - rSignInner * Math.sin(a0)];
        const q1 = [cx + rSignInner * Math.cos(a1), cy - rSignInner * Math.sin(a1)];
        const color = ELEMENT_COLOR[signElement(sign)];
        const mid = pt(start + 15, (rSignOuter + rSignInner) / 2);
        return (
          <g key={sign}>
            <path
              d={`M ${p0[0]} ${p0[1]} A ${rSignOuter} ${rSignOuter} 0 0 1 ${p1[0]} ${p1[1]} L ${q1[0]} ${q1[1]} A ${rSignInner} ${rSignInner} 0 0 0 ${q0[0]} ${q0[1]} Z`}
              fill={color} fillOpacity={0.09} stroke="#2a2f45" strokeWidth={0.6}
            />
            <text x={mid[0]} y={mid[1]} fill={color} fontSize={14} textAnchor="middle"
                  dominantBaseline="central" opacity={0.95}>
              {SIGN_GLYPHS[sign]}
            </text>
          </g>
        );
      })}

      {/* house cusps */}
      {cusps.map((c, i) => {
        const [x1, y1] = pt(c, rAspect);
        const [x2, y2] = pt(c, rSignInner);
        const angular = i === 0 || i === 3 || i === 6 || i === 9;
        const [lx, ly] = pt(norm360(c + 15), rHouseRing * 0.93);
        return (
          <g key={`cusp${i}`}>
            <line x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke={angular ? '#5b6486' : '#272c40'}
                  strokeWidth={angular ? 1.3 : 0.7} />
            <text x={lx} y={ly} fill="#5a6080" fontSize={8.5} textAnchor="middle"
                  dominantBaseline="central">{i + 1}</text>
          </g>
        );
      })}

      <circle cx={cx} cy={cy} r={rAspect} fill="none" stroke="#242940" strokeWidth={0.8} />
      <circle cx={cx} cy={cy} r={rSignInner} fill="none" stroke="#2a2f45" strokeWidth={0.9} />
      {outer && <circle cx={cx} cy={cy} r={rHouseRing} fill="none" stroke="#242940" strokeWidth={0.7} strokeDasharray="2 3" />}

      {/* aspect lines (inner chart only, to keep the bi-wheel readable) */}
      {showAspects && !outer && chart.aspects
        .filter((a) => a.weight > 0.18 && a.a !== 'ASC' && a.a !== 'MC' && a.b !== 'ASC' && a.b !== 'MC')
        .map((a, i) => {
          const pa = chart.placements.find((p) => p.body === a.a);
          const pb = chart.placements.find((p) => p.body === a.b);
          if (!pa || !pb) return null;
          const [x1, y1] = pt(pa.longitude, rAspect);
          const [x2, y2] = pt(pb.longitude, rAspect);
          return (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke={ASPECT_COLOR[a.aspect] ?? '#555'}
                  strokeWidth={0.4 + a.exactness * 1.5}
                  strokeOpacity={0.2 + a.exactness * 0.45} />
          );
        })}

      {/* cross-chart aspect lines (bi-wheel) */}
      {showAspects && outer && crossAspects.map((c, i) => {
        const [x1, y1] = pt(c.lonA, rAspect);
        const [x2, y2] = pt(c.lonB, rAspect);
        return (
          <line key={`x${i}`} x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={ASPECT_COLOR[c.aspect] ?? '#555'}
                strokeWidth={0.4 + c.exactness * 1.6}
                strokeOpacity={0.25 + c.exactness * 0.5} />
        );
      })}

      {/* angles */}
      {chart.ascendant !== null && (() => {
        const [x, y] = pt(chart.ascendant, R * 0.90);
        return <text x={x} y={y} fill="#e6c07b" fontSize={9} textAnchor="middle" dominantBaseline="central" fontWeight={600}>AC</text>;
      })()}
      {chart.midheaven !== null && (() => {
        const [x, y] = pt(chart.midheaven, R * 0.90);
        return <text x={x} y={y} fill="#e6c07b" fontSize={9} textAnchor="middle" dominantBaseline="central" fontWeight={600}>MC</text>;
      })()}

      {/* inner chart planets */}
      {innerBodies.map((p, i) => {
        const a = innerAngles[i];
        const [gx, gy] = atAngle(a, rInnerPlanets);
        const [t0x, t0y] = pt(p.longitude, rHouseRing + (outer ? 2 : 4));
        const [t1x, t1y] = atAngle(a, rInnerPlanets + (outer ? 10 : 12));
        return (
          <g key={p.body}>
            <line x1={t0x} y1={t0y} x2={t1x} y2={t1y} stroke={innerColor} strokeOpacity={0.3} strokeWidth={0.6} />
            <text x={gx} y={gy} fill={innerColor} fontSize={12.5} textAnchor="middle" dominantBaseline="central">
              {PLANET_GLYPHS[p.body] ?? p.body.slice(0, 2)}
            </text>
            {p.retrograde && (
              <text x={gx + 8} y={gy + 6} fill={innerColor} fontSize={7} opacity={0.75}>R</text>
            )}
          </g>
        );
      })}

      {/* outer chart planets (synastry) */}
      {outer && outerBodies.map((p, i) => {
        const a = outerAngles[i];
        const [gx, gy] = atAngle(a, rOuterPlanets);
        return (
          <g key={`o${p.body}`}>
            <text x={gx} y={gy} fill={outerColor} fontSize={12.5} textAnchor="middle" dominantBaseline="central">
              {PLANET_GLYPHS[p.body] ?? p.body.slice(0, 2)}
            </text>
          </g>
        );
      })}

      <circle cx={cx} cy={cy} r={2} fill="#3a4160" />
    </svg>
  );
}

/** Compact textual position list beside a wheel. */
export function PlacementTable({ chart }: { chart: Chart }) {
  return (
    <table className="data">
      <thead>
        <tr><th>Body</th><th>Position</th><th>Hse</th></tr>
      </thead>
      <tbody>
        {chart.placements.map((p) => (
          <tr key={p.body}>
            <td>
              <span style={{ opacity: 0.7, marginRight: 6 }}>{PLANET_GLYPHS[p.body]}</span>
              {p.body === 'NorthNode' ? 'N. Node' : p.body}
              {p.retrograde && <span style={{ color: 'var(--rose)', fontSize: 10, marginLeft: 4 }}>R</span>}
              {p.approximate && <span className="muted" style={{ fontSize: 9, marginLeft: 4 }} title="approximate ephemeris">~</span>}
            </td>
            <td className="mono">{formatLongitude(p.longitude)}</td>
            <td className="muted">{p.house ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
