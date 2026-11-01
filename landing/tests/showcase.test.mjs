import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { hm } from '../src/showcase.js';

test('showcase can render on the server and every character asset is a PNG', async () => {
  assert.equal(hm.chars.length, 8);
  assert.equal(hm.bubbles.length, 3);
  const images = new Set([hm.minsu, hm.haeun, hm.seoyeon, hm.jihun, ...hm.chars.map(character => character.img)]);
  for (const image of images) {
    const bytes = await readFile(new URL('../public' + image, import.meta.url));
    assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
  }
});
