import test from 'node:test';
import assert from 'node:assert/strict';
import { heatSamples, heatAt, heatColor, heatmapSVG, HEATMAP_VIEWS } from '../src/heatmap.js';

const now = new Date('2026-10-31T05:00:00Z');
const person = overrides => ({ floor:3, seat:'A-01', status:'working', sensesAt:now.toISOString(), senses:{noise:5,smell:1,temperature:4,humidity:2}, ...overrides });

test('each sensory map selects its own current value', () => {
  const expected = { noise:5, smell:1, temperature:4, humidity:2 };
  for (const {key} of HEATMAP_VIEWS) assert.deepEqual(heatSamples([person()],3,key,now),[{x:402,y:162,value:expected[key]}]);
});

test('only clocked-in people on the selected floor with a known seat contribute', () => {
  const people = [person(),person({floor:2}),person({status:'away'}),person({status:'offline'}),person({sensesAt:'2026-10-29T05:00:00Z'}),person({sensesAt:null}),person({senses:{}}),person({seat:'unknown'}),person({senses:{noise:0}}),person({senses:{noise:6}})];
  assert.equal(heatSamples(people,3,'noise',now).length,2); // working + away; offline never counts
  assert.equal(heatSamples(people,2,'noise',now).length,1);
  assert.equal(heatSamples(people,3,'discomfort',now).length,0);
});

test('Korea midnight expires yesterday’s readings', () => {
  const before=person({sensesAt:'2026-10-30T14:59:59Z'});
  assert.equal(heatSamples([before],3,'noise',new Date('2026-10-30T15:00:00Z')).length,0);
});

test('one person colours only their surroundings; unreported floor stays grey', () => {
  const samples=[{x:402,y:162,value:5}];
  assert.deepEqual(heatAt(samples,402,162),{value:5,coverage:1,opacity:.6});
  const far=heatAt(samples,1100,560);
  assert.equal(far.coverage,0);
  assert.equal(far.opacity,.28);
  const mid=heatAt(samples,402+140,162).coverage;
  assert.ok(mid>0&&mid<1);
  assert.equal(heatAt([],402,162),null);
  assert.equal(heatmapSVG([]),'');
  const svg=heatmapSVG(samples);
  assert.ok(svg.includes('fill="rgb(167,169,180)"'), 'far cells are the neutral grey');
  // Between a calm and a loud desk the value changes smoothly, without jumps.
  const pair=[{x:402,y:162,value:1},{x:1050,y:162,value:5}];
  const line=[];for(let x=402;x<=1050;x+=8)line.push(heatAt(pair,x,162).value);
  assert.ok(line.every((v,i)=>i===0||v>=line[i-1]-1e-9));
  assert.ok(Math.max(...line.slice(1).map((v,i)=>v-line[i]))<0.25);
});

test('overlapping readings are a weighted mean, not a sum of intensity', () => {
  const samples=[{x:402,y:162,value:1},{x:486,y:162,value:5}];
  const mid=heatAt(samples,444,162),near=heatAt(samples,402,162);
  assert.ok(Math.abs(mid.value-3)<1e-10);
  assert.ok(near.value<2);
  assert.equal(heatAt([{x:402,y:162,value:3},{x:402,y:162,value:3}],402,162).value,3);
});

test('heat stays inside the building outline', () => {
  const samples=[{x:402,y:162,value:5}];
  assert.equal(heatAt(samples,10,300),null);
  assert.equal(heatAt(samples,600,20),null);
  assert.equal(heatAt(samples,140,80),null);
  assert.ok(heatAt(samples,140,200));
  assert.ok(heatmapSVG(samples).includes('clip-path="url(#heat-clip)"'));
});

test('the five levels produce distinct bounded colors and valid overlay', () => {
  assert.equal(new Set([1,2,3,4,5].map(heatColor)).size,5);
  assert.equal(heatColor(0),heatColor(1));
  assert.equal(heatColor(6),heatColor(5));
  const svg=heatmapSVG([{x:402,y:162,value:5}]);
  assert.match(svg,/viewBox="0 0 1200 640"/);
  assert.match(svg,/<rect /);
  assert.doesNotMatch(svg,/NaN|undefined/);
});
