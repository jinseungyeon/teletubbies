import { currentSenses, SEATS, MAP_SIZE, FLOOR, FLOOR_PATH, onFloor } from './data.js';

export const HEATMAP_VIEWS = [
  { key: 'noise', name: '청각', icon: 'noise' },
  { key: 'smell', name: '후각', icon: 'smell' },
  { key: 'temperature', name: '온도', icon: 'temp' },
  { key: 'humidity', name: '습도', icon: 'humid' },
];
export const HEAT_COLORS = ['#519ee5', '#62bdab', '#e6cc61', '#e99a60', '#d96577'];
// Larger values blend neighbours more; ~half a desk keeps each seat its own.
const SMOOTHING = 40 ** 2;
// Colour only where someone actually shared: full colour within NEAR of a
// reading, fading to neutral grey by FAR. Unreported floor stays grey.
const NEAR = 70, FAR = 210;
const UNSHARED = '#a7a9b4';
const OPACITY = { shared: 0.6, unshared: 0.28 };
const CELL = 16;

export function heatSamples(people, floor, sense, now = new Date()) {
  if (!HEATMAP_VIEWS.some(v => v.key === sense)) return [];
  return people.flatMap(person => {
    if (person.floor !== floor) return [];
    const value = currentSenses(person, now)[sense];
    const seat = SEATS.find(s => s.id === person.seat);
    if (!seat || !Number.isInteger(value) || value < 1 || value > 5) return [];
    return [{ x: seat.x, y: seat.y + 36, value }];
  });
}

// Value: inverse-distance weighting, so readings blend smoothly and more people
// never means a "hotter" colour. Coverage: how close the nearest reading is;
// it decides how much of that colour shows over the grey base.
export function heatAt(samples, x, y) {
  if (!samples.length || !onFloor(x, y)) return null;
  const coverage = coverageAt(samples, x, y);
  return { value: fieldAt(samples, x, y), coverage, opacity: OPACITY.unshared + (OPACITY.shared - OPACITY.unshared) * coverage };
}
function coverageAt(samples, x, y) {
  const nearest = Math.min(...samples.map(s => Math.hypot(x - s.x, y - s.y)));
  const t = Math.max(0, Math.min(1, (nearest - NEAR) / (FAR - NEAR)));
  return 1 - t * t * (3 - 2 * t); // smoothstep fade
}
// Blend two colours given as #rrggbb or rgb(r,g,b).
function mix(from, to, amount) {
  const channels = c => c.startsWith('#') ? c.slice(1).match(/../g).map(v => parseInt(v, 16)) : c.match(/\d+/g).map(Number);
  const a = channels(from), b = channels(to);
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * amount)).join(',')})`;
}
function fieldAt(samples, x, y) {
  let weightSum = 0, valueSum = 0;
  for (const sample of samples) {
    const weight = 1 / ((x - sample.x) ** 2 + (y - sample.y) ** 2 + SMOOTHING);
    weightSum += weight;
    valueSum += weight * sample.value;
  }
  return valueSum / weightSum;
}

export function heatColor(value) {
  const level = Math.max(1, Math.min(5, value)) - 1;
  const lo = Math.floor(level), hi = Math.min(4, lo + 1), fraction = level - lo;
  const channels = hex => hex.slice(1).match(/../g).map(c => parseInt(c, 16));
  const a = channels(HEAT_COLORS[lo]), b = channels(HEAT_COLORS[hi]);
  return `rgb(${a.map((c, i) => Math.round(c + (b[i] - c) * fraction)).join(',')})`;
}

export function heatmapSVG(samples) {
  if (!samples.length) return '';
  const { left, right, top, bottom } = FLOOR, cells = [];
  for (let y = top; y < bottom; y += CELL) {
    for (let x = left; x < right; x += CELL) {
      const cx = Math.min(x + CELL / 2, right), cy = Math.min(y + CELL / 2, bottom);
      const coverage = coverageAt(samples, cx, cy), alpha = OPACITY.unshared + (OPACITY.shared - OPACITY.unshared) * coverage;
      const fill = mix(UNSHARED, heatColor(fieldAt(samples, cx, cy)), coverage);
      // +1 overlap hides hairline seams between cells before the blur.
      cells.push(`<rect x="${x}" y="${y}" width="${Math.min(CELL, right - x) + 1}" height="${Math.min(CELL, bottom - y) + 1}" fill="${fill}" fill-opacity="${alpha.toFixed(2)}"/>`);
    }
  }
  // Blur the cell grid into a smooth field, clipped to the floor outline so it
  // never bleeds past the walls or into the entrance notch.
  return `<svg class="mini-heatmap" viewBox="0 0 ${MAP_SIZE.width} ${MAP_SIZE.height}" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><defs><filter id="heat-blur" x="0" y="0" width="100%" height="100%"><feGaussianBlur stdDeviation="14" edgeMode="duplicate"/></filter><clipPath id="heat-clip"><path d="${FLOOR_PATH}"/></clipPath></defs><g clip-path="url(#heat-clip)"><g filter="url(#heat-blur)">${cells.join('')}</g></g></svg>`;
}
