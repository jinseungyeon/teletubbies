import { currentSenses, SEATS, MAP_SIZE, FLOOR, FLOOR_PATH, onFloor } from './data.js';

export const HEATMAP_VIEWS = [
  { key: 'noise', name: '청각', icon: 'sound' },
  { key: 'smell', name: '후각', icon: 'leaf' },
  { key: 'temperature', name: '온도', icon: 'thermometer' },
  { key: 'humidity', name: '습도', icon: 'drop' },
];
export const HEAT_COLORS = ['#519ee5', '#62bdab', '#e6cc61', '#e99a60', '#d96577'];
// Larger values blend neighbours more; ~half a desk keeps each seat its own.
const SMOOTHING = 40 ** 2;
const OPACITY = 0.72;
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

// Inverse-distance weighting: every point on the floor blends all readings, so
// the map reads as one continuous gradient. Nearby people dominate, and the
// result is a weighted mean, so more people never means a "hotter" colour.
// The field covers the whole open-plan floor and stops at the building walls.
export function heatAt(samples, x, y) {
  if (!samples.length || !onFloor(x, y)) return null;
  return { value: fieldAt(samples, x, y), opacity: OPACITY };
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
      const value = fieldAt(samples, Math.min(x + CELL / 2, right), Math.min(y + CELL / 2, bottom));
      // +1 overlap hides hairline seams between cells before the blur.
      cells.push(`<rect x="${x}" y="${y}" width="${Math.min(CELL, right - x) + 1}" height="${Math.min(CELL, bottom - y) + 1}" fill="${heatColor(value)}"/>`);
    }
  }
  // Blur the cell grid into a smooth field, clipped to the floor outline so it
  // never bleeds past the walls or into the entrance notch.
  return `<svg class="mini-heatmap" viewBox="0 0 ${MAP_SIZE.width} ${MAP_SIZE.height}" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><defs><filter id="heat-blur" x="0" y="0" width="100%" height="100%"><feGaussianBlur stdDeviation="14" edgeMode="duplicate"/></filter><clipPath id="heat-clip"><path d="${FLOOR_PATH}"/></clipPath></defs><g clip-path="url(#heat-clip)" opacity="${OPACITY}"><g filter="url(#heat-blur)">${cells.join('')}</g></g></svg>`;
}
