/**
 * Signs — Astronomy Core
 * -------------------------------------------------------------------------
 * Dependency-free geocentric ephemeris. Deterministic: identical input always
 * yields identical output, which is what makes the Synastry Engine testable.
 *
 * Sources of the underlying math:
 *  - Julian Day / sidereal time / obliquity: Meeus, "Astronomical Algorithms" 2e
 *  - Planetary positions: Standish (JPL) approximate Keplerian elements,
 *    valid 1800-2050 to roughly arcminute accuracy.
 *  - Moon: abbreviated ELP-2000/82 series (Meeus ch. 47, principal terms).
 *
 * Accuracy is far beyond what narrative astrology requires (<0.05 deg for the
 * Sun, ~0.2 deg for the Moon, arcminutes for planets). No network, no license
 * files, no native bindings — it deploys to a serverless function unchanged.
 */

export const SIGNS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
] as const;
export type SignName = (typeof SIGNS)[number];

export const SIGN_GLYPHS: Record<SignName, string> = {
  Aries: '♈', Taurus: '♉', Gemini: '♊', Cancer: '♋',
  Leo: '♌', Virgo: '♍', Libra: '♎', Scorpio: '♏',
  Sagittarius: '♐', Capricorn: '♑', Aquarius: '♒', Pisces: '♓',
};

export const PLANETS = [
  'Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter',
  'Saturn', 'Uranus', 'Neptune', 'Pluto', 'NorthNode', 'Chiron',
] as const;
export type PlanetName = (typeof PLANETS)[number];

export const PLANET_GLYPHS: Record<string, string> = {
  Sun: '☉', Moon: '☽', Mercury: '☿', Venus: '♀', Mars: '♂',
  Jupiter: '♃', Saturn: '♄', Uranus: '♅', Neptune: '♆',
  Pluto: '♇', NorthNode: '☊', Chiron: '⚷', ASC: 'Asc', MC: 'MC',
};

export const ELEMENTS = ['Fire', 'Earth', 'Air', 'Water'] as const;
export type Element = (typeof ELEMENTS)[number];
export const MODALITIES = ['Cardinal', 'Fixed', 'Mutable'] as const;
export type Modality = (typeof MODALITIES)[number];

export function signElement(sign: SignName): Element {
  return ELEMENTS[SIGNS.indexOf(sign) % 4];
}
export function signModality(sign: SignName): Modality {
  return MODALITIES[SIGNS.indexOf(sign) % 3];
}
export function signPolarity(sign: SignName): 'Yang' | 'Yin' {
  return SIGNS.indexOf(sign) % 2 === 0 ? 'Yang' : 'Yin';
}

/* ------------------------------------------------------------------ utils */

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

export function norm360(x: number): number {
  const v = x % 360;
  return v < 0 ? v + 360 : v;
}
/** Shortest signed separation, in (-180, 180]. */
export function angleDelta(a: number, b: number): number {
  let d = norm360(a - b);
  if (d > 180) d -= 360;
  return d;
}
export function angularDistance(a: number, b: number): number {
  return Math.abs(angleDelta(a, b));
}
const sin = (d: number) => Math.sin(d * DEG);
const cos = (d: number) => Math.cos(d * DEG);

/** Julian Day from a UTC calendar date. Gregorian calendar assumed. */
export function julianDay(
  year: number, month: number, day: number,
  hour = 0, minute = 0, second = 0,
): number {
  let y = year;
  let m = month;
  if (m <= 2) { y -= 1; m += 12; }
  const a = Math.floor(y / 100);
  const b = 2 - a + Math.floor(a / 4);
  const dayFrac = day + (hour + minute / 60 + second / 3600) / 24;
  return (
    Math.floor(365.25 * (y + 4716)) +
    Math.floor(30.6001 * (m + 1)) +
    dayFrac + b - 1524.5
  );
}

/** Julian centuries from J2000.0 */
export const centuriesJ2000 = (jd: number) => (jd - 2451545.0) / 36525;

/** Mean obliquity of the ecliptic (Laskar), degrees. */
export function obliquity(jd: number): number {
  const t = centuriesJ2000(jd);
  return 23.439291 - 0.0130042 * t - 1.64e-7 * t * t + 5.04e-7 * t * t * t;
}

/** Greenwich mean sidereal time in degrees. */
export function gmst(jd: number): number {
  const t = centuriesJ2000(jd);
  return norm360(
    280.46061837 + 360.98564736629 * (jd - 2451545.0) +
    0.000387933 * t * t - (t * t * t) / 38710000,
  );
}

/* --------------------------------------------------- planetary elements */

type Elem = {
  a: number; aDot: number;      // semi-major axis, au
  e: number; eDot: number;      // eccentricity
  i: number; iDot: number;      // inclination, deg
  L: number; LDot: number;      // mean longitude, deg
  wbar: number; wbarDot: number;// longitude of perihelion, deg
  Om: number; OmDot: number;    // longitude of ascending node, deg
};

/** JPL approximate elements, epoch J2000, rates per Julian century. */
const ELEMS: Record<string, Elem> = {
  Earth:   { a: 1.00000261, aDot: 0.00000562, e: 0.01671123, eDot: -0.00004392, i: -0.00001531, iDot: -0.01294668, L: 100.46457166, LDot: 35999.37244981, wbar: 102.93768193, wbarDot: 0.32327364, Om: 0, OmDot: 0 },
  Mercury: { a: 0.38709927, aDot: 0.00000037, e: 0.20563593, eDot: 0.00001906, i: 7.00497902, iDot: -0.00594749, L: 252.25032350, LDot: 149472.67411175, wbar: 77.45779628, wbarDot: 0.16047689, Om: 48.33076593, OmDot: -0.12534081 },
  Venus:   { a: 0.72333566, aDot: 0.00000390, e: 0.00677672, eDot: -0.00004107, i: 3.39467605, iDot: -0.00078890, L: 181.97909950, LDot: 58517.81538729, wbar: 131.60246718, wbarDot: 0.00268329, Om: 76.67984255, OmDot: -0.27769418 },
  Mars:    { a: 1.52371034, aDot: 0.00001847, e: 0.09339410, eDot: 0.00007882, i: 1.84969142, iDot: -0.00813131, L: -4.55343205, LDot: 19140.30268499, wbar: -23.94362959, wbarDot: 0.44441088, Om: 49.55953891, OmDot: -0.29257343 },
  Jupiter: { a: 5.20288700, aDot: -0.00011607, e: 0.04838624, eDot: -0.00013253, i: 1.30439695, iDot: -0.00183714, L: 34.39644051, LDot: 3034.74612775, wbar: 14.72847983, wbarDot: 0.21252668, Om: 100.47390909, OmDot: 0.20469106 },
  Saturn:  { a: 9.53667594, aDot: -0.00125060, e: 0.05386179, eDot: -0.00050991, i: 2.48599187, iDot: 0.00193609, L: 49.95424423, LDot: 1222.49362201, wbar: 92.59887831, wbarDot: -0.41897216, Om: 113.66242448, OmDot: -0.28867794 },
  Uranus:  { a: 19.18916464, aDot: -0.00196176, e: 0.04725744, eDot: -0.00004397, i: 0.77263783, iDot: -0.00242939, L: 313.23810451, LDot: 428.48202785, wbar: 170.95427630, wbarDot: 0.40805281, Om: 74.01692503, OmDot: 0.04240589 },
  Neptune: { a: 30.06992276, aDot: 0.00026291, e: 0.00859048, eDot: 0.00005105, i: 1.77004347, iDot: 0.00035372, L: -55.12002969, LDot: 218.45945325, wbar: 44.96476227, wbarDot: -0.32241464, Om: 131.78422574, OmDot: -0.00508664 },
  Pluto:   { a: 39.48211675, aDot: -0.00031596, e: 0.24882730, eDot: 0.00005170, i: 17.14001206, iDot: 0.00004818, L: 238.92903833, LDot: 145.20780515, wbar: 224.06891629, wbarDot: -0.04062942, Om: 110.30393684, OmDot: -0.01183482 },
};

/** Solve Kepler's equation by Newton-Raphson. Returns eccentric anomaly (deg). */
function kepler(M: number, e: number): number {
  const Mr = norm360(M) * DEG;
  let E = Mr + e * Math.sin(Mr);
  for (let k = 0; k < 30; k++) {
    const dM = Mr - (E - e * Math.sin(E));
    const dE = dM / (1 - e * Math.cos(E));
    E += dE;
    if (Math.abs(dE) < 1e-12) break;
  }
  return E * RAD;
}

/** Heliocentric ecliptic rectangular coordinates (au) of a planet at jd. */
function heliocentric(name: string, jd: number): [number, number, number] {
  const el = ELEMS[name];
  const t = centuriesJ2000(jd);
  const a = el.a + el.aDot * t;
  const e = el.e + el.eDot * t;
  const i = el.i + el.iDot * t;
  const L = el.L + el.LDot * t;
  const wbar = el.wbar + el.wbarDot * t;
  const Om = el.Om + el.OmDot * t;
  const w = wbar - Om;
  const M = L - wbar;
  const E = kepler(M, e);

  // Position in the orbital plane
  const xp = a * (cos(E) - e);
  const yp = a * Math.sqrt(1 - e * e) * sin(E);

  const cw = cos(w), sw = sin(w);
  const cO = cos(Om), sO = sin(Om);
  const ci = cos(i), si = sin(i);

  const x = (cw * cO - sw * sO * ci) * xp + (-sw * cO - cw * sO * ci) * yp;
  const y = (cw * sO + sw * cO * ci) * xp + (-sw * sO + cw * cO * ci) * yp;
  const z = (sw * si) * xp + (cw * si) * yp;
  return [x, y, z];
}

/** Apparent geocentric ecliptic longitude of the Sun (deg). Meeus ch. 25. */
export function sunLongitude(jd: number): number {
  const t = centuriesJ2000(jd);
  const L0 = 280.46646 + 36000.76983 * t + 0.0003032 * t * t;
  const M = 357.52911 + 35999.05029 * t - 0.0001537 * t * t;
  const C =
    (1.914602 - 0.004817 * t - 0.000014 * t * t) * sin(M) +
    (0.019993 - 0.000101 * t) * sin(2 * M) +
    0.000289 * sin(3 * M);
  const trueLong = L0 + C;
  const omega = 125.04 - 1934.136 * t;
  return norm360(trueLong - 0.00569 - 0.00478 * sin(omega));
}

/** Geocentric ecliptic longitude of the Moon (deg). Abbreviated ELP. */
export function moonLongitude(jd: number): number {
  const t = centuriesJ2000(jd);
  const Lp = 218.3164477 + 481267.88123421 * t - 0.0015786 * t * t;
  const D = 297.8501921 + 445267.1114034 * t - 0.0018819 * t * t;
  const M = 357.5291092 + 35999.0502909 * t - 0.0001536 * t * t;
  const Mp = 134.9633964 + 477198.8675055 * t + 0.0087414 * t * t;
  const F = 93.2720950 + 483202.0175233 * t - 0.0036539 * t * t;

  // Principal periodic terms in longitude, units of 1e-6 degrees.
  const terms: [number, number, number, number, number][] = [
    [6288774, 0, 0, 1, 0], [1274027, 2, 0, -1, 0], [658314, 2, 0, 0, 0],
    [213618, 0, 0, 2, 0], [-185116, 0, 1, 0, 0], [-114332, 0, 0, 0, 2],
    [58793, 2, 0, -2, 0], [57066, 2, -1, -1, 0], [53322, 2, 0, 1, 0],
    [45758, 2, -1, 0, 0], [-40923, 0, 1, -1, 0], [-34720, 1, 0, 0, 0],
    [-30383, 0, 1, 1, 0], [15327, 2, 0, 0, -2], [-12528, 0, 0, 1, 2],
    [10980, 0, 0, 1, -2], [10675, 4, 0, -1, 0], [10034, 0, 0, 3, 0],
    [8548, 4, 0, -2, 0], [-7888, 2, 1, -1, 0], [-6766, 2, 1, 0, 0],
    [-5163, 1, 0, -1, 0], [4987, 1, 1, 0, 0], [4036, 2, -1, 1, 0],
    [3994, 2, 0, 2, 0], [3861, 4, 0, 0, 0], [3665, 2, 0, -3, 0],
    [-2689, 0, 1, -2, 0], [-2602, 2, 0, -1, 2], [2390, 2, -1, -2, 0],
    [-2348, 1, 0, 1, 0], [2236, 2, -2, 0, 0], [-2120, 0, 1, 2, 0],
    [-2069, 0, 2, 0, 0], [2048, 2, -2, -1, 0], [-1773, 2, 0, 1, -2],
    [-1595, 2, 0, 0, 2], [1215, 4, -1, -1, 0], [-1110, 0, 0, 2, 2],
  ];
  const e = 1 - 0.002516 * t - 0.0000074 * t * t;
  let sum = 0;
  for (const [coef, dD, dM, dMp, dF] of terms) {
    let f = coef;
    if (Math.abs(dM) === 1) f *= e;
    if (Math.abs(dM) === 2) f *= e * e;
    sum += f * sin(dD * D + dM * M + dMp * Mp + dF * F);
  }
  return norm360(Lp + sum / 1e6);
}

/** Mean lunar North Node (true node approximated by mean + principal term). */
export function northNodeLongitude(jd: number): number {
  const t = centuriesJ2000(jd);
  const mean = 125.0445479 - 1934.1362891 * t + 0.0020754 * t * t;
  const D = 297.8501921 + 445267.1114034 * t;
  const M = 357.5291092 + 35999.0502909 * t;
  const Mp = 134.9633964 + 477198.8675055 * t;
  const F = 93.2720950 + 483202.0175233 * t;
  const corr =
    -1.4979 * sin(2 * (D - F)) - 0.1500 * sin(M) - 0.1226 * sin(2 * D) +
    0.1176 * sin(2 * F) - 0.0801 * sin(2 * (Mp - F));
  return norm360(mean + corr);
}

/**
 * Chiron. No compact analytic series exists; we use a mean-motion model fitted
 * to its ~50.4y orbit with an epoch anchor. Accuracy ~2 deg — flagged as
 * `approximate` in the API so downstream interpretation can weight it lower.
 */
export function chironLongitude(jd: number): number {
  const daysFromEpoch = jd - 2451545.0;              // J2000
  const meanLongAtEpoch = 28.0;                       // deg, ~Sagittarius 28
  const period = 50.42 * 365.25;
  const M = norm360(meanLongAtEpoch + (360 / period) * daysFromEpoch);
  // First-order equation of centre for e = 0.3831
  const e = 0.3831;
  const c = (2 * e - e ** 3 / 4) * RAD * sin(M) + 1.25 * e * e * RAD * sin(2 * M);
  return norm360(M + c);
}

/** Geocentric ecliptic longitude of a classical/outer planet (deg). */
export function planetLongitude(name: string, jd: number): number {
  if (name === 'Sun') return sunLongitude(jd);
  if (name === 'Moon') return moonLongitude(jd);
  if (name === 'NorthNode') return northNodeLongitude(jd);
  if (name === 'Chiron') return chironLongitude(jd);
  const [xe, ye, ze] = heliocentric('Earth', jd);
  const [xp, yp, zp] = heliocentric(name, jd);
  // Light-time correction: one iteration is ample at this precision.
  const dx0 = xp - xe, dy0 = yp - ye, dz0 = zp - ze;
  const dist = Math.sqrt(dx0 * dx0 + dy0 * dy0 + dz0 * dz0);
  const lightDays = dist * 0.0057755183;
  const [xp2, yp2, zp2] = heliocentric(name, jd - lightDays);
  return norm360(Math.atan2(yp2 - ye, xp2 - xe) * RAD);
}

/** Retrograde test by finite difference of apparent longitude. */
export function isRetrograde(name: string, jd: number): boolean {
  if (name === 'Sun' || name === 'Moon') return false;
  if (name === 'NorthNode') return true; // mean node is always retrograde
  const d = angleDelta(planetLongitude(name, jd + 1), planetLongitude(name, jd - 1));
  return d < 0;
}

/* ------------------------------------------------------------ angles/houses */

/** Local sidereal time in degrees. */
export function lst(jd: number, longitudeEast: number): number {
  return norm360(gmst(jd) + longitudeEast);
}

/** Midheaven ecliptic longitude. */
export function midheaven(jd: number, longitudeEast: number): number {
  const theta = lst(jd, longitudeEast);
  const eps = obliquity(jd);
  return norm360(Math.atan2(sin(theta), cos(theta) * cos(eps)) * RAD);
}

/** Ascendant ecliptic longitude. */
export function ascendant(jd: number, longitudeEast: number, latitude: number): number {
  const theta = lst(jd, longitudeEast);
  const eps = obliquity(jd);
  const y = -cos(theta);
  const x = sin(theta) * cos(eps) + Math.tan(latitude * DEG) * sin(eps);
  return norm360(Math.atan2(y, x) * RAD + 180);
}

export type HouseSystem = 'whole-sign' | 'equal' | 'porphyry';

/** Returns 12 cusp longitudes, index 0 = house 1. */
export function houseCusps(
  asc: number, mc: number, system: HouseSystem = 'whole-sign',
): number[] {
  if (system === 'whole-sign') {
    const start = Math.floor(asc / 30) * 30;
    return Array.from({ length: 12 }, (_, i) => norm360(start + i * 30));
  }
  if (system === 'equal') {
    return Array.from({ length: 12 }, (_, i) => norm360(asc + i * 30));
  }
  // Porphyry: trisect the quadrants formed by the four angles.
  const ic = norm360(mc + 180);
  const dsc = norm360(asc + 180);
  const q1 = norm360(mc - asc);      // house 10 cusp back to house 1
  const q2 = norm360(dsc - ic);
  const cusps = new Array<number>(12);
  cusps[0] = asc;
  cusps[1] = norm360(asc + (360 - q1) / 3 * 0 + (norm360(ic - asc)) / 3);
  cusps[2] = norm360(asc + (norm360(ic - asc)) * 2 / 3);
  cusps[3] = ic;
  cusps[4] = norm360(ic + q2 / 3);
  cusps[5] = norm360(ic + q2 * 2 / 3);
  cusps[6] = dsc;
  cusps[7] = norm360(dsc + norm360(mc - dsc) / 3);
  cusps[8] = norm360(dsc + norm360(mc - dsc) * 2 / 3);
  cusps[9] = mc;
  cusps[10] = norm360(mc + q1 / 3);
  cusps[11] = norm360(mc + q1 * 2 / 3);
  return cusps;
}

export function houseOf(longitude: number, cusps: number[]): number {
  for (let i = 0; i < 12; i++) {
    const a = cusps[i];
    const b = cusps[(i + 1) % 12];
    const span = norm360(b - a);
    const off = norm360(longitude - a);
    if (off < span) return i + 1;
  }
  return 1;
}

/* ------------------------------------------------------------------ aspects */

export type AspectName =
  | 'Conjunction' | 'Opposition' | 'Trine' | 'Square' | 'Sextile'
  | 'Quincunx' | 'Semisquare' | 'Sesquiquadrate' | 'Quintile';

export type AspectDef = {
  name: AspectName;
  angle: number;
  orb: number;
  nature: 'harmonious' | 'tense' | 'dynamic' | 'neutral';
  weight: number;   // narrative significance multiplier
};

export const ASPECTS: AspectDef[] = [
  { name: 'Conjunction',     angle: 0,    orb: 8, nature: 'dynamic',     weight: 1.0 },
  { name: 'Opposition',      angle: 180,  orb: 8, nature: 'tense',       weight: 1.0 },
  { name: 'Trine',           angle: 120,  orb: 7, nature: 'harmonious',  weight: 0.85 },
  { name: 'Square',          angle: 90,   orb: 7, nature: 'tense',       weight: 0.95 },
  { name: 'Sextile',         angle: 60,   orb: 5, nature: 'harmonious',  weight: 0.6 },
  { name: 'Quincunx',        angle: 150,  orb: 3, nature: 'dynamic',     weight: 0.55 },
  { name: 'Semisquare',      angle: 45,   orb: 2, nature: 'tense',       weight: 0.4 },
  { name: 'Sesquiquadrate',  angle: 135,  orb: 2, nature: 'tense',       weight: 0.4 },
  { name: 'Quintile',        angle: 72,   orb: 2, nature: 'neutral',     weight: 0.35 },
];

/** Luminaries and angles carry wider orbs. */
const ORB_BONUS: Record<string, number> = { Sun: 2, Moon: 2, ASC: 1.5, MC: 1.5 };

export type Aspect = {
  a: string;
  b: string;
  aspect: AspectName;
  angle: number;
  orb: number;         // deviation from exact, degrees
  exactness: number;   // 0..1, 1 = partile
  nature: AspectDef['nature'];
  weight: number;      // exactness * definition weight * body importance
  applying: boolean;
};

const BODY_IMPORTANCE: Record<string, number> = {
  Sun: 1.0, Moon: 1.0, ASC: 0.95, MC: 0.85, Venus: 0.85, Mars: 0.85,
  Mercury: 0.75, Saturn: 0.85, Jupiter: 0.7, Pluto: 0.7, Uranus: 0.65,
  Neptune: 0.65, NorthNode: 0.6, Chiron: 0.55,
};

export function findAspect(lonA: number, lonB: number, bodyA: string, bodyB: string): Aspect | null {
  const sep = angularDistance(lonA, lonB);
  const bonus = (ORB_BONUS[bodyA] ?? 0) / 2 + (ORB_BONUS[bodyB] ?? 0) / 2;
  let best: Aspect | null = null;
  for (const def of ASPECTS) {
    const maxOrb = def.orb + bonus;
    const orb = Math.abs(sep - def.angle);
    if (orb <= maxOrb) {
      const exactness = 1 - orb / maxOrb;
      const importance =
        ((BODY_IMPORTANCE[bodyA] ?? 0.5) + (BODY_IMPORTANCE[bodyB] ?? 0.5)) / 2;
      const cand: Aspect = {
        a: bodyA, b: bodyB, aspect: def.name, angle: def.angle,
        orb: Number(orb.toFixed(3)),
        exactness: Number(exactness.toFixed(3)),
        nature: def.nature,
        weight: Number((exactness * def.weight * importance).toFixed(4)),
        applying: false,
      };
      if (!best || cand.weight > best.weight) best = cand;
    }
  }
  return best;
}

/* -------------------------------------------------------------------- chart */

export type BirthData = {
  year: number; month: number; day: number;
  hour: number; minute: number;
  /** Offset from UTC in hours; e.g. -8 for PST. */
  tzOffset: number;
  /** Degrees east positive. */
  longitude: number;
  /** Degrees north positive. */
  latitude: number;
  placeName?: string;
  /** True when the birth time is unknown; angles/houses are then suppressed. */
  timeUnknown?: boolean;
};

export type Placement = {
  body: string;
  longitude: number;
  sign: SignName;
  degreeInSign: number;
  house: number | null;
  retrograde: boolean;
  element: Element;
  modality: Modality;
  approximate?: boolean;
};

export type Chart = {
  id: string;
  birth: BirthData;
  jd: number;
  placements: Placement[];
  ascendant: number | null;
  midheaven: number | null;
  cusps: number[] | null;
  aspects: Aspect[];
  elementBalance: Record<Element, number>;
  modalityBalance: Record<Modality, number>;
  polarityBalance: { Yang: number; Yin: number };
  dominantSign: SignName;
  chartRuler: string | null;
  houseSystem: HouseSystem;
};

export function signOf(longitude: number): SignName {
  return SIGNS[Math.floor(norm360(longitude) / 30)];
}
export function degreeInSign(longitude: number): number {
  return Number((norm360(longitude) % 30).toFixed(4));
}

export function formatLongitude(longitude: number): string {
  const d = degreeInSign(longitude);
  const deg = Math.floor(d);
  const min = Math.floor((d - deg) * 60);
  return `${deg}°${String(min).padStart(2, '0')}' ${signOf(longitude)}`;
}

const SIGN_RULERS: Record<SignName, string> = {
  Aries: 'Mars', Taurus: 'Venus', Gemini: 'Mercury', Cancer: 'Moon',
  Leo: 'Sun', Virgo: 'Mercury', Libra: 'Venus', Scorpio: 'Pluto',
  Sagittarius: 'Jupiter', Capricorn: 'Saturn', Aquarius: 'Uranus', Pisces: 'Neptune',
};

