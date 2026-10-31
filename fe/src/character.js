// Composable chibi pixel character (20×27 grid, auto outline). Original artwork drawn in code.
const W = 20, H = 27, TOP = 3; // the top 3 rows are reserved for a bun or antenna
const BOB_TOP = [
  '.......HHHHHH.......',
  '.....HHHHHHHHHH.....',
  '....HHHHHLLLHHHH....',
  '...HHHHLLHHHHHHHH...',
  '...HHHHHHHHHHHHHH...',
  '..HHHHHHHHHHHHHHHH..',
  '..HHHHHHsHHHHsHHHH..',
];
// Upper-case hair sits in front; lower-case `h` only fills empty space (behind the body).
// An optional first array is drawn in the reserved rows above the head.
export const HAIR_STYLES = [
  { key: 'bob', name: '단발', rows: [...BOB_TOP, '..HHH..........HHH..', '..HHH..........HHH..', '..HHH..........HHH..', '..HHH..........HHH..', '..HHG..........GHH..', '..GGG..........GGG..', '...G............G...'] },
  { key: 'bun', name: '올림머리', above: ['........GHHG........', '.......HHLLHH.......', '........HHHH........'], rows: [...BOB_TOP, '..HHH..........HHH..', '...HH..........HH...', '...H............H...'] },
  { key: 'wavy', name: '웨이브', rows: [...BOB_TOP, '..HHH..........HHH..', '.HHHH..........HHHH.', '.HHHH..........HHHH.', '.HHH............HHH.', '.HHHH..........HHHH.', '..GHH..........HHG..', '.hGGH..........HGGh.', '.hhGh..........hGhh.', '..hGh..........hGh..', '.hhG............Ghh.', '.hG..............Gh.'] },
  { key: 'short', name: '짧은 머리', rows: ['....................', '.....HHHHHHHHHH.....', '....HHHHHLLLHHHH....', '...HHHHHHHHHHHHHH...', '...HHHHHHHHHHHHHH...', '...HHHHHHHHHHHHHH...', '...HHsHHHHHHHHsHH...', '...HH..........HH...', '...G............G...'] },
  { key: 'straight', name: '긴 생머리', rows: [...BOB_TOP, '..HHH..........HHH..', '..HHH..........HHH..', '..HHH..........HHH..', '..HHH..........HHH..', '..HHH..........HHH..', '..HHG..........GHH..', '..HGG..........GGH..', '..hhh..........hhh..', '..hGh..........hGh..', '..hhh..........hhh..', '..GGG..........GGG..'] },
  { key: 'braids', name: '땋은 머리', rows: [...BOB_TOP, '..HHH..........HHH..', '..HHH..........HHH..', '..HHH..........HHH..', '..HHG..........GHH..', '.HHG............GHH.', '.GHH............HHG.', '.HHG............GHH.', '..rr............rr..', '.HHG............GHH.', '..G..............G..'] },
];
export const HAIR_COLORS = [
  { name: '브라운', hex: '#6b4632' }, { name: '다크 브라운', hex: '#4a3226' }, { name: '블론드', hex: '#e8c27a' },
  { name: '블랙', hex: '#2c2b3a' }, { name: '오번', hex: '#a2503f' }, { name: '라이트 브라운', hex: '#8e6342' },
  { name: '핑크', hex: '#ec9fb1' }, { name: '애쉬 그레이', hex: '#b7b4c0' },
];
export const EYE_COLORS = [
  { name: '블랙', hex: '#2b2433' }, { name: '브라운', hex: '#6a4330' }, { name: '블루', hex: '#3f6fb5' },
  { name: '그린', hex: '#3f8a5c' }, { name: '퍼플', hex: '#6d4fa3' }, { name: '그레이', hex: '#6f7480' },
];
export const OUTFITS = [
  { key: 'tee', name: '티셔츠' }, { key: 'collar', name: '카라 셔츠' }, { key: 'cardigan', name: '카디건' },
  { key: 'hoodie', name: '후드' }, { key: 'vest', name: '조끼' }, { key: 'overall', name: '멜빵' },
];
export const OUTFIT_PALETTES = [
  { name: '블루', colors: ['#4f86c9', '#a9c4e0', '#f3f0ea', '#5a5a70'] },
  { name: '레드', colors: ['#cf4a5b', '#e48c84', '#f2d9c3', '#d9b49a'] },
  { name: '그린', colors: ['#8fb98a', '#5fa36a', '#cfcbbd', '#3c3f52'] },
  { name: '브라운', colors: ['#dcb88a', '#b9773f', '#a0623a', '#7a4a35'] },
  { name: '퍼플', colors: ['#a18ad6', '#7a5fcf', '#eaa7cf', '#d6d3d0'] },
];
export const OUTFIT_COLORS = OUTFIT_PALETTES.flatMap(p => p.colors);
export const SKINS = [
  { key: 'red', name: '빨강', hex: '#e04a43', antenna: ['........CCCC........', '........C..C........', '.........CC.........'] },
  { key: 'yellow', name: '노랑', hex: '#f3c63f', antenna: ['...........CC.......', '..........C.........', '.........CC.........'] },
  { key: 'green', name: '연두', hex: '#83c44c', antenna: ['.........CC.........', '.........CC.........', '.........CC.........'] },
  { key: 'purple', name: '보라', hex: '#7652c0', antenna: ['.........CC.........', '........C..C........', '........CCCC........'] },
];
export const GENDERS = { f: '여자', m: '남자' };
export const DEFAULT_CHARACTER = Object.freeze({ hair: 0, hairColor: 0, eye: 0, gender: 'f', outfit: 0, color: 0, skin: null });

const FACE = [
  '.....ssssssssss.....',
  '....ssssssssssss....',
  '....ssssssssssss....',
  '....ssWEssssWEss....',
  '....ssEEssssEEss....',
  '....sbbssmmssbbs....',
  '.....ssssssssss.....',
  '......ssssssss......',
  '........tttt........',
];
const TORSO = [
  '......wwwwwwww......',
  '.....wwwwwwwwww.....',
  '....wwwwwwwwwwww....',
  '...wwawwwwwwwwaww...',
  '...wwawwwwwwwwaww...',
  '...sswwwwwwwwwwss...',
];
const PANTS = ['.....pppppppppp.....', '.....pppp..pppp.....', '.....pppp..pppp.....', '....ddddd..ddddd....'];
const SKIRT = ['....kkkkkkkkkkkk....', '....kkkkkkkkkkkk....', '......ss....ss......', '.....ddd....ddd.....'];
const DETAILS = {
  tee: ['.......tttttt.......'],
  collar: ['......iiiwwiii......', '.........ww.........', '.........aw.........', '.........ww.........', '.........aw.........'],
  cardigan: ['.......iiiiii.......', '........iiii........', '........iiii........', '........iaai........', '........iiii........'],
  hoodie: ['....aawwwwwwwwaa....', '.......a....a.......', '.......a....a.......', '......aaaaaaaa......', '......awwwwwwa......'],
  vest: ['......iiiiiiii......', '.....iiwwiiwwii.....', '....iiwwwiiwwwii....', '...iiawwwwwwwwaii...', '...iiawwwwwwwwaii...'],
  overall: ['.......tttttt.......', '....................', '......a......a......', '......aaaaaaaa......', '......aaaaaaaa......'],
};
const SUIT = [
  '......CCCCCCCC......', '....CCCCCCCCCCCC....', '...CCCCCLLLCCCCCC...', '..CCCCCCCCCCCCCCCC..', '..CCCCCCCCCCCCCCCC..', '..CCCCCCCCCCCCCCCC..',
  '..CCC..........CCC..', '..CCC..........CCC..', '..CCC..........CCC..', '..CCC..........CCC..', '..CCC..........CCC..', '..CCC..........CCC..', '..CCCC........CCCC..', '...CCCCCCCCCCCCCC...',
  '......CCCCCCCC......', '.....CCCCCCCCCC.....', '....CCCCCCCCCCCC....', '...CCDCCggggCCDCC...', '...CCDCCggggCCDCC...', '...ssCCCCCCCCCCss...',
  '.....CCCCCCCCCC.....', '.....CCCC..CCCC.....', '.....CCCC..CCCC.....', '....DDDDD..DDDDD....',
];

const clampIndex = (value, list, fallback = 0) => Number.isInteger(value) && value >= 0 && value < list.length ? value : fallback;
export function normalizeCharacter(c = {}) {
  return {
    hair: clampIndex(c.hair, HAIR_STYLES), hairColor: clampIndex(c.hairColor, HAIR_COLORS), eye: clampIndex(c.eye, EYE_COLORS),
    gender: c.gender === 'm' ? 'm' : 'f', outfit: clampIndex(c.outfit, OUTFITS), color: clampIndex(c.color, OUTFIT_COLORS),
    skin: SKINS.some(s => s.key === c.skin) ? c.skin : null,
  };
}
export function validateCharacter(c) {
  if (!c || typeof c !== 'object') throw new Error('캐릭터 정보를 확인해 주세요.');
  const checks = [[c.hair, HAIR_STYLES], [c.hairColor, HAIR_COLORS], [c.eye, EYE_COLORS], [c.outfit, OUTFITS], [c.color, OUTFIT_COLORS]];
  if (checks.some(([v, list]) => !Number.isInteger(v) || v < 0 || v >= list.length) || !GENDERS[c.gender] || (c.skin !== null && !SKINS.some(s => s.key === c.skin)))
    throw new Error('캐릭터 선택 항목을 다시 확인해 주세요.');
}
// Older profiles stored a single avatar number (0–7); map it to a full character.
export function legacyCharacter(index = 0) {
  const i = ((Number(index) || 0) % 8 + 8) % 8;
  return { hair: [0, 3, 1, 3, 4, 5, 2, 0][i], hairColor: [0, 3, 4, 1, 5, 0, 2, 5][i], eye: [0, 0, 1, 0, 1, 0, 2, 1][i], gender: [1, 3].includes(i) ? 'm' : 'f', outfit: i % 6, color: [0, 8, 5, 12, 16, 1, 9, 13][i], skin: null };
}
export function randomCharacter(rand = Math.random) {
  const pick = n => Math.floor(rand() * n);
  return { hair: pick(HAIR_STYLES.length), hairColor: pick(HAIR_COLORS.length), eye: pick(EYE_COLORS.length), gender: rand() < .5 ? 'f' : 'm', outfit: pick(OUTFITS.length), color: pick(OUTFIT_COLORS.length), skin: null };
}
export function shade(hex, amount = -0.25) {
  const n = parseInt(hex.slice(1), 16), f = v => Math.max(0, Math.min(255, Math.round(amount < 0 ? v * (1 + amount) : v + (255 - v) * amount)));
  return '#' + [n >> 16, (n >> 8) & 255, n & 255].map(v => f(v).toString(16).padStart(2, '0')).join('');
}
export function composeGrid(input) {
  const c = normalizeCharacter(input);
  const grid = Array.from({ length: H }, () => Array(W).fill('.'));
  const draw = (rows, top, rule = () => true) => rows.forEach((row, y) => [...row].forEach((ch, x) => { const r = top + y; if (ch !== '.' && r >= 0 && r < H && rule(ch, grid[r][x])) grid[r][x] = ch; }));
  draw(FACE, TOP + 5);
  if (c.skin) {
    draw(SUIT, TOP);
    draw(SKINS.find(s => s.key === c.skin).antenna, 0);
  } else {
    const hair = HAIR_STYLES[c.hair];
    draw(TORSO, TOP + 14);
    draw(c.gender === 'm' ? PANTS : SKIRT, TOP + 20);
    draw(DETAILS[OUTFITS[c.outfit].key], TOP + 14);
    if (hair.above) draw(hair.above, 0);
    draw(hair.rows, TOP, (ch, under) => ch !== 'h' || under === '.');
  }
  // Dark outline around the whole silhouette.
  const out = grid.map(row => [...row]);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
    if (grid[y][x] === '.' && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => (grid[y + dy]?.[x + dx] ?? '.') !== '.')) out[y][x] = 'O';
  return out;
}
export function characterColors(input) {
  const c = normalizeCharacter(input), shirt = OUTFIT_COLORS[c.color], hair = HAIR_COLORS[c.hairColor].hex;
  const suit = SKINS.find(s => s.key === c.skin)?.hex || '#999999';
  return {
    O: '#2a2438', H: hair, h: shade(hair, -0.12), G: shade(hair, -0.28), L: c.skin ? shade(suit, 0.3) : shade(hair, 0.22), r: '#e25d6e',
    s: '#f7caa6', t: '#e2a985', E: EYE_COLORS[c.eye].hex, W: '#ffffff', b: '#f4a3a0', m: '#c8685f',
    w: shirt, a: shade(shirt, -0.28), i: '#fbf7f0', p: '#4a4560', k: '#5b5476', d: '#3a3346', C: suit, D: shade(suit, -0.25), g: '#d8dbe3',
  };
}
// head: true crops to head and shoulders (used for face-style tiles).
export function characterSVG(input, size = 48, { head = false } = {}) {
  const grid = composeGrid(input), colors = characterColors(input);
  let pixels = '';
  grid.forEach((row, y) => row.forEach((ch, x) => { if (colors[ch]) pixels += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${colors[ch]}"/>`; }));
  const [box, ratio] = head ? ['0 0 20 19', 19 / 20] : [`0 0 ${W} ${H}`, H / W];
  return `<svg class="avatar-art" width="${size}" height="${Math.round(size * ratio)}" viewBox="${box}" shape-rendering="crispEdges" aria-hidden="true">${pixels}</svg>`;
}

// Photo → character (local demo, no upload). Samples colours from a square RGBA buffer.
const rgb = hex => { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const dist = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
export function nearestIndex(color, list) { let best = 0; list.forEach((item, i) => { if (dist(color, rgb(item.hex)) < dist(color, rgb(list[best].hex))) best = i; }); return best; }
function average(data, width, x0, y0, x1, y1) {
  const sum = [0, 0, 0]; let n = 0;
  for (let y = Math.floor(y0 * width); y < Math.floor(y1 * width); y++) for (let x = Math.floor(x0 * width); x < Math.floor(x1 * width); x++) { const o = (y * width + x) * 4; sum[0] += data[o]; sum[1] += data[o + 1]; sum[2] += data[o + 2]; n++; }
  return n ? sum.map(v => v / n) : [0, 0, 0];
}
export function characterFromPixels(data, width) {
  const hair = average(data, width, .3, .04, .7, .16);
  const side = average(data, width, .08, .5, .22, .8);
  const body = average(data, width, .3, .86, .7, .98);
  const long = dist(hair, side) < 2500;
  const hairColor = nearestIndex(hair, HAIR_COLORS);
  const color = OUTFIT_COLORS.reduce((best, hex, i) => dist(body, rgb(hex)) < dist(body, rgb(OUTFIT_COLORS[best])) ? i : best, 0);
  return { hair: long ? 4 : 0, hairColor, eye: [3, 1].includes(hairColor) ? 0 : 1, gender: 'f', outfit: 1, color, skin: null };
}
