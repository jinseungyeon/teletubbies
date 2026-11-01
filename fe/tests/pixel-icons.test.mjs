import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PIXEL_ICONS, ICON_PALETTE, IMAGE_ICONS, iconGrid, pixelIconSVG, iconHTML } from '../src/pixel-icons.js';
import { QUICK_STATUS, SENSES, TRAITS } from '../src/data.js';

test('every sprite is 16x16 and only uses palette colours', () => {
  for (const [name, rows] of Object.entries(PIXEL_ICONS)) {
    assert.equal(rows.length, 16, name);
    for (const row of rows) {
      assert.equal(row.length, 16, `${name}: ${row}`);
      for (const ch of row) assert.ok(ch === '.' || ICON_PALETTE[ch], `${name} uses unknown colour ${ch}`);
    }
  }
});

test('every icon the app asks for has a sprite', () => {
  const reactDir = new URL('../src/react/', import.meta.url);
  const views = readdirSync(reactDir).filter(f => f.endsWith('.jsx')).map(f => readFileSync(new URL(f, reactDir), 'utf8')).join('\n');
  const src = views
    + readFileSync(new URL('../src/react/helpers.js', import.meta.url), 'utf8')
    + readFileSync(new URL('../src/data.js', import.meta.url), 'utf8');
  const used = new Set([...src.matchAll(/<Icon\s+name="([a-z]+)"|\bicon\('([a-z]+)'|\bicon:\s*'([a-z]+)'/g)].map(m => m[1] || m[2] || m[3]));
  for (const list of [QUICK_STATUS.map(([key]) => key), SENSES.map(s => s.icon), TRAITS.map(t => t.icon)]) list.forEach(n => used.add(n));
  const missing = [...used].filter(n => !PIXEL_ICONS[n] && !IMAGE_ICONS[n]);
  assert.deepEqual(missing, []);
});

test('filled icons get a dark outline; ink glyphs follow the text colour', () => {
  const heart = iconGrid('heart');
  assert.equal(heart[3][2], 'k'); // left of the first red pixel
  assert.match(pixelIconSVG('close'), /fill="currentColor"/);
  assert.doesNotMatch(pixelIconSVG('heart'), /currentColor/);
});

test('recolouring swaps palette keys and output stays crisp', () => {
  const svg = pixelIconSVG('shirt', 16, { b: '#123456' });
  assert.match(svg, /fill="#123456"/);
  assert.match(svg, /shape-rendering="crispEdges"/);
  assert.match(pixelIconSVG('home', 32), /width="32"/);
});

test('design PNG icons exist, match their recorded size and scale by whole pixels', () => {
  for (const [name, [w, h]] of Object.entries(IMAGE_ICONS)) {
    const png = readFileSync(new URL(`../public/icons/${name}.png`, import.meta.url));
    assert.equal(png.readUInt32BE(16), w, name);
    assert.equal(png.readUInt32BE(20), h, name);
  }
  const [w, h] = IMAGE_ICONS.coffee;
  assert.ok(iconHTML('coffee', 16).includes(`width="${w}" height="${h}"`));
  assert.ok(iconHTML('coffee', 24).includes(`width="${w * 2}"`));
  assert.match(iconHTML('close'), /^<svg/); // no PNG for it: drawn sprite
});
