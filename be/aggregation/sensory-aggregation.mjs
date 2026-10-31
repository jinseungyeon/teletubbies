/**
 * Space-level aggregation only. No I/O, wall-clock timers, alerts or inferred data.
 * Inputs must come from an authorised, consistent BE snapshot, not arbitrary FE data.
 */
export const SENSORY_DIMENSIONS = Object.freeze([
  'temperature_level', 'humidity_level', 'noise_level',
  'odor_level', 'discomfort_level', 'crowd_level',
]);

export const DEFAULT_AGGREGATION_CONFIG = Object.freeze({
  bucketMinutes: 30,
  halfLivesHours: Object.freeze({
    noise_level: 2,
    odor_level: 3,
    temperature_level: 4,
    humidity_level: 4,
    discomfort_level: 2,
    crowd_level: 2,
  }),
});

const HOUR_MS = 3_600_000;
const DIMENSIONS = new Set(SENSORY_DIMENSIONS);
function nonempty(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${label} must be a nonempty string`);
  return value;
}
function timestamp(value, label) {
  if (!(value instanceof Date) && (typeof value !== 'string' || !/(Z|[+-]\d{2}:\d{2})$/i.test(value))) {
    throw new TypeError(`${label} must be an explicit-offset ISO timestamp or Date`);
  }
  const ms = value instanceof Date ? value.getTime() : Date.parse(value);
  if (!Number.isFinite(ms)) throw new TypeError(`${label} is invalid`);
  return ms;
}
function revision(value) {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return BigInt(value);
  if (typeof value === 'string' && /^\d+$/.test(value)) return BigInt(value);
  throw new TypeError('revision must be a nonnegative safe integer or decimal integer string');
}
function settings(overrides = {}) {
  const bucketMinutes = overrides.bucketMinutes ?? DEFAULT_AGGREGATION_CONFIG.bucketMinutes;
  if (!Number.isFinite(bucketMinutes) || bucketMinutes <= 0 || !Number.isFinite(bucketMinutes * 60_000)) {
    throw new RangeError('bucketMinutes must be finite and positive');
  }
  const halfLivesHours = { ...DEFAULT_AGGREGATION_CONFIG.halfLivesHours, ...overrides.halfLivesHours };
  for (const [key, hours] of Object.entries(halfLivesHours)) {
    if (!DIMENSIONS.has(key)) throw new TypeError(`Unknown sensory dimension: ${key}`);
    if (!Number.isFinite(hours) || hours <= 0 || !Number.isFinite(hours * HOUR_MS)) {
      throw new RangeError(`Invalid half-life for ${key}`);
    }
  }
  return { bucketMs: bucketMinutes * 60_000, halfLivesHours };
}

/**
 * Stage 1: current company/space/workday/session/visit; then latest per person/item.
 * NULL clears are selected BEFORE NULL removal, so old values cannot reappear.
 * work_session_id is an attendance period, NOT a Supabase login session.
 * observation_epoch_id changes when the existing NULL-reset rules invalidate inputs.
 */
export function selectLatestValidObservations({
  companyId, spaceId, workdayId, asOf, presence = [], observations = [],
}) {
  nonempty(companyId, 'companyId'); nonempty(spaceId, 'spaceId'); nonempty(workdayId, 'workdayId');
  const snapshotMs = timestamp(asOf, 'asOf');
  if (!Array.isArray(presence) || !Array.isArray(observations)) throw new TypeError('presence and observations must be arrays');
  const active = new Map();
  for (const person of presence) {
    if (person.company_id !== companyId || person.space_id !== spaceId || person.workday_id !== workdayId) continue;
    if (person.status === 'off_work') continue;
    if (!['working', 'away'].includes(person.status)) throw new TypeError('Unknown attendance status');
    nonempty(person.employee_id, 'presence.employee_id');
    nonempty(person.work_session_id, 'presence.work_session_id');
    nonempty(person.observation_epoch_id, 'presence.observation_epoch_id');
    const epochStartMs = timestamp(person.epoch_started_at, 'presence.epoch_started_at');
    if (epochStartMs > snapshotMs) throw new RangeError('Presence epoch starts after asOf');
    if (active.has(person.employee_id)) throw new TypeError('Duplicate current presence');
    active.set(person.employee_id, { person, epochStartMs });
  }

  const latest = new Map();
  for (const row of observations) {
    if (row.company_id !== companyId || row.space_id !== spaceId || row.workday_id !== workdayId) continue;
    if (!DIMENSIONS.has(row.dimension)) continue;
    const current = active.get(row.employee_id);
    if (!current || row.work_session_id !== current.person.work_session_id ||
        row.observation_epoch_id !== current.person.observation_epoch_id) continue;
    const time = timestamp(row.observed_at, 'observation.observed_at');
    if (time < current.epochStartMs || time > snapshotMs) continue;
    if (row.value !== null && (!Number.isInteger(row.value) || row.value < 1 || row.value > 5)) {
      throw new RangeError('Observation value must be an integer from 1 to 5 or NULL');
    }
    const seq = revision(row.revision);
    const key = JSON.stringify([row.employee_id, row.dimension]);
    const previous = latest.get(key);
    if (previous && time === previous.time && seq === previous.seq && row.value !== previous.value) {
      throw new TypeError('Conflicting values for the same observation revision');
    }
    if (!previous || time > previous.time || (time === previous.time && seq > previous.seq)) {
      latest.set(key, { employee_id: row.employee_id, dimension: row.dimension, value: row.value, time, seq });
    }
  }
  return [...latest.values()].filter(row => row.value !== null)
    .sort((a, b) => a.dimension.localeCompare(b.dimension) || a.employee_id.localeCompare(b.employee_id))
    .map(({ seq: _seq, ...row }) => row);
}

function kahanSum(values) {
  let sum = 0, compensation = 0;
  for (const value of values) {
    const adjusted = value - compensation;
    const next = sum + adjusted;
    compensation = (next - sum) - adjusted;
    sum = next;
  }
  return sum;
}

function aggregateDimension(rows, dimension, config) {
  if (!rows.length) return { score: null, response_count: 0, last_input_at: null };
  const buckets = new Map();
  // Fixed epoch-aligned buckets, not sliding windows. No cross-item/space counts.
  for (const row of rows) {
    const bucket = Math.floor(row.time / config.bucketMs);
    buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
  }
  const anchor = Math.max(...rows.map(row => row.time));
  const halfLifeMs = config.halfLivesHours[dimension] * HOUR_MS;
  // Same-item elapsed wall time is a common factor and cancels in the mean.
  // Anchor at the latest valid input, then normalise in log space for stability.
  const logWeights = rows.map(row =>
    -Math.LN2 * ((anchor - row.time) / halfLifeMs)
    -0.5 * Math.log(buckets.get(Math.floor(row.time / config.bucketMs))));
  const maxLogWeight = Math.max(...logWeights);
  const weights = logWeights.map(logWeight => Math.exp(logWeight - maxLogWeight));
  const numerator = kahanSum(rows.map((row, i) => weights[i] * row.value));
  const denominator = kahanSum(weights);
  // Bound floating-point round-off only. Do not round the score for presentation.
  const score = Math.max(1, Math.min(5, numerator / denominator));
  return { score, response_count: rows.length, last_input_at: new Date(anchor).toISOString() };
}

/** Stages 1-3 only: latest valid inputs -> weights -> per-dimension mean. */
export function aggregateSpaceSensations(input, overrides = {}) {
  const config = settings(overrides);
  const latest = selectLatestValidObservations(input);
  const sensations = Object.fromEntries(SENSORY_DIMENSIONS.map(dimension => [
    dimension, aggregateDimension(latest.filter(row => row.dimension === dimension), dimension, config),
  ]));
  return { company_id: input.companyId, space_id: input.spaceId, workday_id: input.workdayId, sensations };
}
