import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateSpaceSensations, selectLatestValidObservations,
  DEFAULT_AGGREGATION_CONFIG, SENSORY_DIMENSIONS } from '../aggregation/sensory-aggregation.mjs';

const T09 = '2026-11-01T09:00:00+09:00';
const T13 = '2026-11-01T13:00:00+09:00';
const near = (actual, expected, epsilon = 1e-12) => assert.ok(Math.abs(actual - expected) < epsilon, `${actual} != ${expected}`);
const person = (id, extra = {}) => ({ company_id:'A',space_id:'room',employee_id:id,
  workday_id:'D',work_session_id:`shift-${id}`,observation_epoch_id:`visit-${id}`,
  epoch_started_at:'2026-11-01T08:00:00+09:00',status:'working',...extra });
const row = (id, value, observed_at = T09, extra = {}) => ({ ...person(id),
  dimension:'noise_level',value,observed_at,revision:1,...extra });
function input(presence = [], observations = [], extra = {}) {
  return { companyId:'A',spaceId:'room',workdayId:'D',asOf:T13,presence,observations,...extra };
}
const noise = data => aggregateSpaceSensations(data).sensations.noise_level;
function example() {
  const ids=Array.from({length:10},(_,i)=>`old-${i}`);
  return input([...ids.map(id=>person(id)),person('new')],
    [...ids.map(id=>row(id,2)),row('new',5,T13)]);
}

test('specified half-lives and fixed 30-minute default',()=>{
  assert.equal(DEFAULT_AGGREGATION_CONFIG.bucketMinutes,30);
  assert.deepEqual(DEFAULT_AGGREGATION_CONFIG.halfLivesHours,{
    noise_level:2,odor_level:3,temperature_level:4,humidity_level:4,discomfort_level:2,crowd_level:2,
  });
});
test('9am ten noise=2 inputs and 1pm one noise=5 input yield 3.6754446797',()=>{
  const result=noise(example());
  near(result.score,3.6754446796632414);
  assert.equal(result.response_count,11);
  assert.equal(result.last_input_at,'2026-11-01T04:00:00.000Z');
});
test('empty input returns NULL for all six items, not 0 or 3',()=>{
  for(const result of Object.values(aggregateSpaceSensations(input()).sensations))
    assert.deepEqual(result,{score:null,response_count:0,last_input_at:null});
});
test('latest employee/item value only; repeated source rows do not inflate bucket counts',()=>{
  const data=example();
  data.observations.unshift(...Array.from({length:100},(_,i)=>row('old-0',1,T09,{revision:0})));
  data.observations.push({...data.observations.find(r=>r.employee_id==='new')});
  const result=noise(data);
  near(result.score,3.6754446796632414);
  assert.equal(result.response_count,11);
});
test('latest explicit NULL clears an earlier value before response/bucket counting',()=>{
  const data=example();
  data.observations.push(row('old-0',null,T09,{revision:2}));
  const result=noise(data);
  assert.equal(result.response_count,10);
  near(result.score,(.75*2+5)/1.75);
  assert.ok(!selectLatestValidObservations(data).some(r=>r.employee_id==='old-0'));
});
test('all NULL input is no data, not an old-value fallback',()=>{
  const data=input([person('p')],[row('p',4),row('p',null,T13,{revision:2})]);
  assert.deepEqual(noise(data),{score:null,response_count:0,last_input_at:null});
});
test('no clock-only changes or input timestamp mutation, including far-future reads',()=>{
  const data=example(),original=structuredClone(data),first=aggregateSpaceSensations(data);
  for(const asOf of ['2026-11-02T00:00:00Z','2100-01-01T00:00:00Z'])
    assert.deepEqual(aggregateSpaceSensations({...data,asOf}),first);
  assert.deepEqual(data,original);
});
test('a new changed observation recalculates the score',()=>{
  const data=example(),old=noise(data).score;
  data.observations.push(row('old-0',5,T13,{revision:2}));
  assert.ok(noise(data).score>old);
  assert.equal(noise(data).response_count,11);
});
test('fixed 09:00/09:30 buckets, not a rolling 30-minute neighbourhood',()=>{
  const data=input(['a','b','c'].map(id=>person(id)),[
    row('a',1),row('b',1,'2026-11-01T09:29:59+09:00'),row('c',5,'2026-11-01T09:30:00+09:00'),
  ]);
  const wa=2**(-.5/2)/Math.sqrt(2),wb=2**(-(1/3600)/2)/Math.sqrt(2);
  near(noise(data).score,(wa+wb+5)/(wa+wb+1));
});
test('same timestamp with different offset representations belongs to the same bucket',()=>{
  const data=example(),expected=noise(data);
  data.observations[0].observed_at='2026-11-01T00:00:00Z';
  assert.deepEqual(noise(data),expected);
});
test('companies and spaces never mix',()=>{
  const data=example(),expected=noise(data);
  for(let i=0;i<50;i++) {
    data.presence.push(person(`foreign-${i}`,{company_id:'B'}),person(`elsewhere-${i}`,{space_id:'elsewhere'}));
    data.observations.push(row(`foreign-${i}`,1,T13,{company_id:'B'}),row(`elsewhere-${i}`,1,T13,{space_id:'elsewhere'}));
  }
  assert.deepEqual(noise(data),expected);
});
test('items have independent bucket counts and input timestamps',()=>{
  const data=example(),expected=noise(data);
  data.observations.push(row('new',1,T13,{dimension:'humidity_level'}));
  const result=aggregateSpaceSensations(data).sensations;
  assert.deepEqual(result.noise_level,expected);
  assert.equal(result.humidity_level.score,1);
  assert.equal(result.humidity_level.response_count,1);
  assert.equal(result.temperature_level.score,null);
});
test('each item applies its own half-life including discomfort, temperature and humidity',()=>{
  for(const dimension of SENSORY_DIMENSIONS) {
    const data=example();
    data.observations=data.observations.map(r=>({...r,dimension}));
    const hours=DEFAULT_AGGREGATION_CONFIG.halfLivesHours[dimension];
    const totalOld=Math.sqrt(10)*2**(-4/hours);
    near(aggregateSpaceSensations(data).sensations[dimension].score,(2*totalOld+5)/(totalOld+1));
  }
});
test('checked-out people and old workday observations are excluded',()=>{
  const data=input([person('out',{status:'off_work'}),person('old'),person('active')],[
    row('out',5,T13),row('old',5,T13,{workday_id:'yesterday'}),row('active',2,T13),
  ]);
  assert.equal(noise(data).score,2);
  assert.equal(noise(data).response_count,1);
});
test('new attendance session excludes pre-checkout data even on the same workday',()=>{
  const data=input([person('p',{work_session_id:'new-shift'})],[row('p',5,T13)]);
  assert.equal(noise(data).score,null);
});
test('returning to the same space does not revive data from an earlier visit',()=>{
  const data=input([person('p',{observation_epoch_id:'returned'})],[row('p',5,T13)]);
  assert.equal(noise(data).score,null);
  data.observations.push(row('p',2,T13,{observation_epoch_id:'returned',revision:2}));
  assert.equal(noise(data).score,2);
});
test('moved away employees contribute only at their current space, not their home ghost',()=>{
  const data=input([person('p',{status:'away'}),person('ghost',{space_id:'other'})],
    [row('p',4,T13),row('ghost',1,T13)]);
  assert.equal(noise(data).score,4);
  assert.equal(noise(data).response_count,1);
});
test('future observations and input before the current reset epoch are excluded',()=>{
  const data=input([person('p',{epoch_started_at:'2026-11-01T12:00:00+09:00'})],
    [row('p',1,T09),row('p',5,'2026-11-01T14:00:00+09:00',{revision:2})]);
  assert.equal(noise(data).score,null);
});
test('very old but still valid observations are not discarded by a hard horizon',()=>{
  const data=input([person('p',{epoch_started_at:'2000-01-01T00:00:00Z'})],
    [row('p',4,'2000-01-01T00:00:00Z')]);
  assert.equal(noise(data).score,4);
  assert.equal(noise(data).response_count,1);
});
test('log-normalisation avoids all-zero denominators for enormous age differences',()=>{
  const data=input([person('old',{epoch_started_at:'2000-01-01T00:00:00Z'}),person('new')],
    [row('old',1,'2000-01-01T00:00:00Z'),row('new',5,T13)]);
  const result=noise(data);
  assert.equal(result.score,5);
  assert.equal(result.response_count,2);
  assert.ok(Number.isFinite(result.score));
});
test('half-lives and fixed bucket duration are configurable without mutating defaults',()=>{
  const data=example();
  const changed=aggregateSpaceSensations(data,{halfLivesHours:{noise_level:4}}).sensations.noise_level;
  const oldTotal=Math.sqrt(10)*.5;
  near(changed.score,(oldTotal*2+5)/(oldTotal+1));
  assert.equal(DEFAULT_AGGREGATION_CONFIG.halfLivesHours.noise_level,2);
  const concentrated=input(['a','b','c'].map(id=>person(id)),[
    row('a',1),row('b',1),row('c',5,'2026-11-01T09:20:00+09:00'),
  ]);
  assert.notEqual(noise(concentrated).score,
    aggregateSpaceSensations(concentrated,{bucketMinutes:15}).sensations.noise_level.score);
});
test('no presentation rounding and all returned scores stay within 1..5',()=>{
  const result=noise(example());
  assert.notEqual(result.score,Number(result.score.toFixed(2)));
  for(const value of [1,2,3,4,5]) assert.equal(noise(input([person('p')],[row('p',value)])).score,value);
});
test('64-bit revision strings order same-time writes without Number precision loss',()=>{
  const data=input([person('p')],[row('p',1,T09,{revision:'9007199254740992'}),
    row('p',5,T09,{revision:'9007199254740993'})]);
  assert.equal(noise(data).score,5);
});
test('invalid values, ambiguous timestamps, duplicate presence and bad config fail explicitly',()=>{
  for(const value of [0,6,2.5,'5',undefined])
    assert.throws(()=>noise(input([person('p')],[row('p',value)])),/Observation value/);
  assert.throws(()=>noise(input([person('p')],[row('p',3,'2026-11-01T09:00:00')])),/explicit-offset/);
  assert.throws(()=>noise(input([person('p'),person('p')],[row('p',3)])),/Duplicate/);
  assert.throws(()=>aggregateSpaceSensations(example(),{bucketMinutes:0}),/bucketMinutes/);
  assert.throws(()=>aggregateSpaceSensations(example(),{halfLivesHours:{noise_level:0}}),/half-life/);
  assert.throws(()=>aggregateSpaceSensations(example(),{halfLivesHours:{light:1}}),/Unknown/);
  assert.throws(()=>noise(input([person('p')],[row('p',1),row('p',2)])),/Conflicting/);
});
