import test from 'node:test';
import assert from 'node:assert/strict';
import { HAIR_STYLES, SKINS, OUTFITS, OUTFIT_COLORS, HAIR_COLORS, DEFAULT_CHARACTER, composeGrid, characterSVG, validateCharacter, normalizeCharacter, legacyCharacter, randomCharacter, characterFromPixels } from '../src/character.js';

test('every hair style row fits the 20-column grid', () => {
  for (const style of HAIR_STYLES) for (const row of [...style.rows, ...(style.above||[])]) assert.equal(row.length, 20, style.name);
  for (const skin of SKINS) for (const row of skin.antenna) assert.equal(row.length, 20, skin.name);
});

test('every combination composes an outlined 20×27 grid with visible eyes', () => {
  for (let hair = 0; hair < HAIR_STYLES.length; hair++) for (let outfit = 0; outfit < OUTFITS.length; outfit++) for (const gender of ['f', 'm']) {
    const grid = composeGrid({ ...DEFAULT_CHARACTER, hair, outfit, gender });
    assert.equal(grid.length, 27);
    assert.ok(grid.every(r => r.length === 20));
    assert.equal(grid.flat().filter(c => c === 'E').length, 6);
    assert.equal(grid.flat().filter(c => c === 'W').length, 2);
    assert.ok(grid.flat().includes('O'));
  }
});

test('special skins replace the outfit with a suit and keep the face', () => {
  for (const { key } of SKINS) {
    const flat = composeGrid({ ...DEFAULT_CHARACTER, skin: key }).flat();
    assert.ok(flat.includes('C') && flat.includes('g'));
    assert.ok(!flat.includes('w') && !flat.includes('H'));
    assert.equal(flat.filter(c => c === 'E').length, 6);
  }
  assert.match(characterSVG({ ...DEFAULT_CHARACTER, skin: 'red' }), /fill="#e04a43"/);
});

test('validation rejects out-of-range or unknown choices', () => {
  validateCharacter({ ...DEFAULT_CHARACTER });
  validateCharacter({ ...DEFAULT_CHARACTER, skin: 'purple' });
  for (const bad of [{ hair: 99 }, { color: -1 }, { gender: 'x' }, { skin: 'blue' }, { eye: 1.5 }])
    assert.throws(() => validateCharacter({ ...DEFAULT_CHARACTER, ...bad }));
  assert.deepEqual(normalizeCharacter({ hair: 99, skin: 'nope' }), DEFAULT_CHARACTER);
});

test('legacy avatar numbers and random characters are always valid', () => {
  for (let i = -3; i < 12; i++) validateCharacter(legacyCharacter(i));
  for (let i = 0; i < 50; i++) validateCharacter(randomCharacter());
});

test('photo sampling picks hair colour from the top of the picture', () => {
  const size = 20, data = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const o = (y * size + x) * 4, [r, g, b] = y < 4 ? [224, 184, 106] : [240, 220, 200];
    data.set([r, g, b, 255], o);
  }
  const look = characterFromPixels(data, size);
  validateCharacter(look);
  assert.equal(HAIR_COLORS[look.hairColor].name, '블론드');
  assert.ok(look.color >= 0 && look.color < OUTFIT_COLORS.length);
});
