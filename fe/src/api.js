import { supabase } from './supabase.js';
import {
  createAdapter, QUICK_STATUS, setCompanyFloors, setCompanyName, validateProfile,
} from './data.js';
import {
  EYE_COLORS, HAIR_COLORS, OUTFIT_COLORS, normalizeCharacter, validateCharacter,
} from './character.js';

// FE status / reason / sense names -> database values.
const STATUS_FROM_DB = { working: 'working', away: 'away', off_work: 'offline' };
const STATUS_TO_DB = { working: 'working', away: 'away', offline: 'off_work' };
const REASON_FROM_DB = { lunch: '점심', meeting: '미팅', outside: '외근' };
const REASON_TO_DB = { 점심: 'lunch', 미팅: 'meeting', 외근: 'outside' };
const SENSE_FROM_DB = {
  temperature_level: 'temperature', humidity_level: 'humidity', noise_level: 'noise',
  odor_level: 'smell', discomfort_level: 'lighting', crowd_level: 'crowding',
};
const SENSE_TO_DB = Object.fromEntries(Object.entries(SENSE_FROM_DB).map(([db, fe]) => [fe, db]));
const SENSI_FROM_DB = {
  visual_sensitivity: 'visual', auditory_sensitivity: 'auditory', olfactory_sensitivity: 'olfactory',
};
const SENSI_TO_DB = Object.fromEntries(Object.entries(SENSI_FROM_DB).map(([db, fe]) => [fe, db]));

const DEMO_KEY = 'senspace.demo-mode';
const PENDING_KEY = 'senspace.pending-join';
const PAGE_SIZE = 200;

const BUSINESS_MESSAGES = {
  LOGIN_REQUIRED: '로그인이 필요해요. 다시 로그인해 주세요.',
  NOT_YOUR_EMPLOYEE: '내 직원 정보만 변경할 수 있어요.',
  INVALID_STATUS: '근태 상태를 확인해 주세요.',
  INVALID_AWAY_REASON: '자리 비움 사유를 확인해 주세요.',
  INVALID_STATUS_TRANSITION: '퇴근 상태에서는 자리 비움으로 바로 바꿀 수 없어요. 먼저 출근해 주세요.',
  EMPLOYEE_NOT_WORKING: '퇴근 상태에서는 입력할 수 없어요. 먼저 출근해 주세요.',
  INVALID_STATUS_MESSAGE: '상태 메시지는 공백 포함 20자까지 입력할 수 있어요.',
  INVALID_SENSATIONS: '감각은 1~5단계로 선택해 주세요.',
  INVALID_AWAY_REASON_TEXT: '자리 비움 사유는 20자까지 입력할 수 있어요.',
  SEAT_TAKEN: '이미 사용 중인 자리예요. 다른 자리를 선택해 주세요.',
  INVALID_SEAT: '등록되지 않은 자리예요.',
  USE_RETURN_TO_SEAT: '원래 자리로 돌아가려면 복귀를 사용해 주세요.',
  RETURN_REQUIRED: '이동 중에는 자리를 바꿀 수 없어요. 먼저 복귀해 주세요.',
  EMPLOYEE_NOT_AWAY: '자리 비움 상태에서만 사유를 적을 수 있어요.',
  EMPLOYEE_NOT_WORKING_TRANSITION: '지금 상태에서는 이 작업을 할 수 없어요.',
  INVALID_CHARACTER: '캐릭터 설정을 확인해 주세요.',
  INVALID_AVATAR_ITEM: '캐릭터 항목을 다시 선택해 주세요.',
  INVALID_COMPANY_CODE: '초대 코드가 올바르지 않거나 만료됐어요. 코드를 확인한 뒤 로그인 화면에서 다시 시도해 주세요.',
  ALREADY_JOINED_COMPANY: '이미 회사에 가입되어 있어요.',
  INVALID_NAME: '이름을 확인해 주세요.',
  INVALID_JOB_TITLE: '직책을 확인해 주세요.',
  LINK_INVALID: '초대 링크가 올바르지 않아요. 링크를 다시 확인해 주세요.',
  LINK_EXPIRED: '초대 링크가 만료됐어요. 회사 관리자에게 새 링크를 요청해 주세요.',
  LINK_REVOKED: '사용할 수 없는 초대 링크예요. 회사 관리자에게 문의해 주세요.',
  LINK_ALREADY_BOUND: '이미 다른 계정에 연결된 링크예요. 관리자에게 문의해 주세요.',
};

// LLM 예약 비서(sensory-assistant Edge Function) 오류 코드 -> 사용자 안내.
const ASSISTANT_MESSAGES = {
  AUTH_REQUIRED: '로그인 세션이 만료됐어요. 다시 로그인해 주세요.',
  ASSISTANT_MEMBERSHIP_REQUIRED: '회사 직원 연결이 끝난 계정에서만 비서를 쓸 수 있어요.',
  ORIGIN_NOT_ALLOWED: '이 주소에서는 비서를 사용할 수 없어요. 관리자에게 문의해 주세요.',
  ASSISTANT_VERSION_CONFLICT: '초안이 다른 곳에서 수정됐어요. 최신 내용으로 다시 확인해 주세요.',
  ASSISTANT_DRAFT_EXPIRED: '초안 유효 시간이 지났어요. 다시 요청해 주세요.',
  ASSISTANT_INVALID_TIME: '시간을 다시 확인해 주세요.',
  ASSISTANT_OVERLAP: '이미 예약된 시간과 겹쳐요. 다른 시간으로 수정해 주세요.',
  ASSISTANT_EMPLOYEE_OFF_WORK: '지금은 퇴근 상태예요. 직접 출근한 뒤 다시 요청해 주세요.',
  ASSISTANT_RETURN_REQUIRED: '임시 이동 중이에요. 복귀한 뒤 다시 요청해 주세요.',
  ASSISTANT_RATE_LIMITED: '요청이 너무 잦아요. 잠시 뒤 다시 시도해 주세요.',
  LLM_NOT_CONFIGURED: '비서 서버 설정이 끝나지 않았어요. 관리자에게 알려 주세요.',
  BACKEND_NOT_CONFIGURED: '비서 서버 설정이 끝나지 않았어요. 관리자에게 알려 주세요.',
  LLM_UNAVAILABLE: 'AI 해석을 지금 할 수 없어요. 잠시 뒤 다시 시도해 주세요.',
  UPSTREAM_UNAVAILABLE: 'AI 해석을 지금 할 수 없어요. 잠시 뒤 다시 시도해 주세요.',
  LLM_INVALID_OUTPUT: 'AI 답변을 이해하지 못했어요. 조금 다르게 다시 말씀해 주세요.',
  LLM_MODEL_NOT_AVAILABLE: 'AI 모델 연결을 확인해야 해요. 관리자에게 알려 주세요.',
  CONFIRMATION_REQUIRED: '확인 정보가 올바르지 않아요. 초안을 다시 확인해 주세요.',
  NOT_FOUND: '초안이나 예약을 찾을 수 없어요.',
};

function linkMessage(data) {
  return BUSINESS_MESSAGES[data?.error_code] || '초대 링크를 사용할 수 없어요. 링크를 확인해 주세요.';
}

function businessMessage(error) {
  const raw = String(error?.message || error?.details || error?.hint || error || '');
  const code = Object.keys(BUSINESS_MESSAGES)
    .sort((a, b) => b.length - a.length)
    .find(name => raw.includes(name));
  if (code) return BUSINESS_MESSAGES[code];
  if (/row-level security|permission denied/i.test(raw)) return '이 작업을 수행할 권한이 없어요.';
  if (/failed to fetch|networkerror|fetch failed/i.test(raw)) return '서버에 연결하지 못했어요. 네트워크를 확인해 주세요.';
  return '요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.';
}

function authMessage(error) {
  const raw = String(error?.message || error || '');
  if (/invalid login credentials/i.test(raw)) return '이메일 또는 비밀번호가 맞지 않아요.';
  if (/email not confirmed/i.test(raw)) return '이메일 인증을 완료한 뒤 로그인해 주세요.';
  if (/user already registered/i.test(raw)) return '이미 가입된 이메일이에요. 로그인해 주세요.';
  if (/password should be at least|password is too short/i.test(raw)) return '비밀번호는 8자 이상이어야 해요.';
  if (/rate limit|security purposes|too many/i.test(raw)) return '시도가 너무 잦아요. 잠시 후 다시 시도해 주세요.';
  if (/anonymous sign-ins are disabled|anonymous_provider_disabled/i.test(raw)) return '링크 입장이 아직 설정되지 않았어요. 회사 관리자에게 문의해 주세요.';
  if (/failed to fetch|networkerror/i.test(raw)) return '서버에 연결하지 못했어요. 네트워크를 확인해 주세요.';
  return '인증 요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.';
}

function joinMessage(data) {
  if (data?.error_code === 'RATE_LIMITED') {
    const seconds = Number(data.retry_after_seconds);
    return Number.isFinite(seconds) && seconds > 0
      ? `시도가 너무 잦아요. ${Math.ceil(seconds)}초 후 다시 시도해 주세요.`
      : '시도가 너무 잦아요. 잠시 후 다시 시도해 주세요.';
  }
  return BUSINESS_MESSAGES[data?.error_code] || '회사 가입을 완료하지 못했어요.';
}

const normalizeSeatLabel = value => {
  const text = String(value || '').trim().toUpperCase();
  const match = text.match(/^([A-Z]+)-0*(\d+)$/);
  return match ? `${match[1]}-${String(Number(match[2])).padStart(2, '0')}` : text;
};
// The reference map uses A-1 style labels; the database stores A-01.
const mapSeatKey = label => normalizeSeatLabel(label).replace(/-0+(\d+)$/, '-$1');

const shelf = () => (typeof localStorage !== 'undefined' ? localStorage : window.localStorage);
const readPending = () => { try { return JSON.parse(shelf().getItem(PENDING_KEY) || 'null'); } catch { return null; } };
const writePending = value => { try { shelf().setItem(PENDING_KEY, JSON.stringify(value)); } catch { /* private mode */ } };
const clearPending = () => { try { shelf().removeItem(PENDING_KEY); } catch { /* private mode */ } };
const isDemo = () => { try { return shelf().getItem(DEMO_KEY) === '1'; } catch { return false; } };
const setDemo = on => { try { on ? shelf().setItem(DEMO_KEY, '1') : shelf().removeItem(DEMO_KEY); } catch { /* private mode */ } };

function clearSeatMap() {
  if (typeof window !== 'undefined' && window.SenspaceSession) window.SenspaceSession.seatMap = null;
}

const hexToRgb = hex => {
  const n = parseInt(String(hex || '').replace('#', ''), 16);
  return Number.isFinite(n) ? [(n >> 16) & 255, (n >> 8) & 255, n & 255] : [0, 0, 0];
};
const colorDistance = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
const nearestSwatch = (hex, list) => {
  const target = hexToRgb(hex);
  return list.reduce((best, item, index) => (
    colorDistance(target, hexToRgb(item.hex)) < colorDistance(target, hexToRgb(list[best].hex)) ? index : best
  ), 0);
};
const nearestHex = (hex, list) => {
  const target = hexToRgb(hex);
  return list.reduce((best, item, index) => (
    colorDistance(target, hexToRgb(item)) < colorDistance(target, hexToRgb(list[best])) ? index : best
  ), 0);
};

// 참조 에디터(sprites.js)의 피부 톤 색. 저장 스키마(007)가 허용하는 값과 같다.
const SKIN_TONES = ['#ffe2c6', '#ffd4b0', '#eab48a', '#c98a5e'];

function toNativeCharacter(cfg, withTone = false) {
  const hair = { bob: 0, bun: 1, long: 2, twin: 5, short: 3 }[cfg?.hair] ?? 0;
  const outfit = { shirt: 0, cardigan: 2, hoodie: 3, suit: 4 }[cfg?.outfit] ?? 0;
  const skin = String(cfg?.special || '').replace(/^a_/, '');
  const tone = String(cfg?.skin || '').toLowerCase();
  const native = normalizeCharacter({
    hair,
    hairColor: nearestSwatch(cfg?.hairColor || HAIR_COLORS[0].hex, HAIR_COLORS),
    eye: nearestSwatch(cfg?.eye || EYE_COLORS[0].hex, EYE_COLORS),
    gender: cfg?.bottom === 'skirt' ? 'f' : 'm',
    outfit,
    color: nearestHex(cfg?.top || OUTFIT_COLORS[0], OUTFIT_COLORS),
    skin: ['red', 'yellow', 'green', 'purple'].includes(skin) ? skin : null,
  });
  // 피부 톤은 선택 키다. 007 이전 DB는 8번째 키를 거부하므로 지원 여부를 먼저 확인한다.
  return withTone && SKIN_TONES.includes(tone) ? { ...native, skinTone: tone } : native;
}

function mapCard(card) {
  const status = card?.status || {};
  const profile = card?.profile || {};
  const sensations = card?.sensations || {};
  const seat = card?.seat || null;
  const sensitivity = {};
  for (const [dbKey, feKey] of Object.entries(SENSI_FROM_DB)) {
    sensitivity[feKey] = Number.isInteger(profile[dbKey]) ? profile[dbKey] : null;
  }
  const senses = {};
  for (const [dbKey, feKey] of Object.entries(SENSE_FROM_DB)) {
    if (Number.isInteger(sensations[dbKey])) senses[feKey] = sensations[dbKey];
  }
  const message = status.status_message || '';
  const preset = QUICK_STATUS.find(([, text]) => text === message);
  return {
    id: card.employee_id,
    name: card.name || '',
    role: card.job_title || '',
    email: '',
    avatar: 0,
    character: card.avatar?.character || null,
    status: STATUS_FROM_DB[status.status] || 'offline',
    reason: REASON_FROM_DB[status.away_reason] || '',
    awayNote: status.away_reason_text || '',
    message,
    messageIcon: preset ? preset[0] : '',
    // Before a seat is chosen, the invite's floor (when the card carries one)
    // decides which floor the seat picker opens on.
    floor: Number.isInteger(seat?.floor_number) ? seat.floor_number
      : Number.isInteger(card.floor_number) ? card.floor_number : 1,
    seat: seat?.label || '',
    seatId: seat?.id || null,
    team: card.team?.name || '',
    complete: Boolean(seat),
    sensitivity,
    description: profile.description || '',
    senses,
    sensesAt: sensations.updated_at || null,
    statusAt: status.updated_at || null,
  };
}

function createSupabaseAdapter() {
  let cached = null;
  let pending = null;

  async function currentUser() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw new Error(authMessage(error));
    return data.session?.user || null;
  }

  async function loadContext(options = {}) {
    const user = await currentUser();
    if (!user) { cached = null; clearSeatMap(); return null; }
    if (cached && cached.userId === user.id && !options.force) return cached;
    // me() and list() load together; share the first round of lookups.
    if (!pending) pending = buildContext(user).finally(() => { pending = null; });
    return pending;
  }

  async function buildContext(user) {
    const { data: membership, error } = await supabase.rpc('get_my_membership');
    if (error) throw new Error(businessMessage(error));
    if (!membership) {
      cached = { userId: user.id, email: user.email || '', membership: null };
      clearSeatMap();
      return cached;
    }

    const { data: floors, error: floorsError } = await supabase.from('floors')
      .select('id,company_id,floor_number,map_path,map_width,map_height')
      .eq('company_id', membership.company_id)
      .order('floor_number');
    if (floorsError) throw new Error(businessMessage(floorsError));

    const seats = [];
    for (let from = 0; ; from += 1000) {
      const { data, error: seatsError } = await supabase.from('seats')
        .select('id,company_id,floor_id,label,x_ratio,y_ratio')
        .eq('company_id', membership.company_id)
        .order('id')
        .range(from, from + 999);
      if (seatsError) throw new Error(businessMessage(seatsError));
      seats.push(...data);
      if (data.length < 1000) break;
    }

    const seatsById = {};
    const seatsByLabel = {};
    const seatMap = {};
    for (const seat of seats) {
      seatsById[seat.id] = seat;
      seatsByLabel[String(seat.label).toUpperCase()] = seat.id;
      seatsByLabel[normalizeSeatLabel(seat.label)] = seat.id;
      seatMap[mapSeatKey(seat.label)] = seat.id;
    }
    setCompanyFloors((floors || []).map(floor => floor.floor_number));
    setCompanyName(membership.company_name);
    if (typeof window !== 'undefined' && window.SenspaceSession) window.SenspaceSession.seatMap = seatMap;

    cached = {
      userId: user.id,
      email: user.email || '',
      membership,
      floors: floors || [],
      seats,
      seatsById,
      seatsByLabel,
    };
    return cached;
  }

  async function myCard(ctx) {
    const { data, error } = await supabase.rpc('get_sensory_cards', {
      p_company_id: ctx.membership.company_id,
      p_employee_id: ctx.membership.employee_id,
      p_limit: 1,
    });
    if (error) throw new Error(businessMessage(error));
    return Array.isArray(data) ? data[0] || null : null;
  }

  async function allCards(ctx) {
    const cards = [];
    let after = null;
    for (;;) {
      const { data, error } = await supabase.rpc('get_sensory_cards', {
        p_company_id: ctx.membership.company_id,
        p_after: after,
        p_limit: PAGE_SIZE,
      });
      if (error) throw new Error(businessMessage(error));
      const page = Array.isArray(data) ? data : [];
      cards.push(...page);
      if (page.length < PAGE_SIZE) break;
      after = page[page.length - 1].employee_id;
    }
    return cards;
  }

  async function memberContext() {
    const ctx = await loadContext();
    if (!ctx?.membership) throw new Error('다시 로그인해 주세요.');
    return ctx;
  }

  async function joinCompany(code, name, jobTitle = '') {
    const cleanCode = String(code || '').trim();
    const cleanName = String(name || '').trim();
    if (!cleanCode) throw new Error('기업 초대 코드를 입력해 주세요.');
    if (!cleanName) throw new Error('이름을 입력해 주세요.');
    const { data, error } = await supabase.rpc('join_company', {
      p_code: cleanCode,
      p_name: cleanName,
      p_job_title: String(jobTitle || ''),
    });
    if (error) throw new Error(businessMessage(error));
    if (data?.error_code) throw new Error(joinMessage(data));
    clearPending();
    return data?.employee_id || null;
  }

  async function chooseSeat(ctx, label) {
    const normalized = normalizeSeatLabel(label);
    const seatId = ctx.seatsByLabel[normalized];
    if (!seatId) throw new Error('등록되지 않은 자리예요.');
    const { error } = await supabase.rpc('choose_seat', {
      p_employee_id: ctx.membership.employee_id,
      p_seat_id: seatId,
    });
    if (error) throw new Error(businessMessage(error));
    ctx.membership.seat_id = seatId;
    return seatId;
  }

  const api = {
    async me() {
      const ctx = await loadContext();
      if (!ctx?.membership) return null;
      const card = await myCard(ctx);
      if (!card) return null;
      return { ...mapCard(card), email: ctx.email };
    },

    async list() {
      const ctx = await loadContext();
      if (!ctx?.membership) return [];
      return (await allCards(ctx)).map(mapCard);
    },

    // Each person receives one private link. Opening it signs the browser in
    // anonymously and redeems the token for that employee's membership.
    async enter(token) {
      setDemo(false);
      const clean = String(token || '').trim();
      if (!clean) throw new Error(BUSINESS_MESSAGES.LINK_INVALID);
      const redeem = () => supabase.rpc('redeem_employee_link', { p_token: clean });
      const signIn = async () => {
        const { error: authError } = await supabase.auth.signInAnonymously();
        if (authError) throw new Error(authMessage(authError));
      };
      const existing = await currentUser();
      if (!existing) await signIn();
      let { data, error } = await redeem();
      if (error) throw new Error(businessMessage(error));
      // A browser that is already signed in as someone else simply switches to
      // this link's person: start a fresh anonymous session and try once more.
      if (data?.error_code === 'LINK_ALREADY_BOUND') {
        await supabase.auth.signOut();
        await signIn();
        ({ data, error } = await redeem());
        if (error) throw new Error(businessMessage(error));
      }
      if (data?.error_code) throw new Error(linkMessage(data));
      cached = null;
      clearSeatMap();
      return api.me();
    },

    async login(email, password, code = '') {
      setDemo(false);
      const { data, error } = await supabase.auth.signInWithPassword({
        email: String(email || '').trim().toLowerCase(),
        password: String(password || ''),
      });
      if (error) throw new Error(authMessage(error));
      cached = null;
      let ctx = await loadContext();
      if (!ctx?.membership) {
        const pending = readPending();
        const joinCode = String(code || '').trim() || pending?.code || '';
        if (joinCode) {
          await joinCompany(joinCode, pending?.name || data.user?.user_metadata?.name || '', pending?.jobTitle || '');
          ctx = await loadContext({ force: true });
        }
      }
      if (!ctx?.membership) throw new Error('아직 회사에 가입되지 않았어요. 로그인 화면의 초대 코드를 입력해 다시 시도해 주세요.');
      return api.me();
    },

    async signup({ name, email, password, code }) {
      setDemo(false);
      const cleanName = String(name || '').trim();
      if (!cleanName) throw new Error('이름을 입력해 주세요.');
      if (!String(code || '').trim()) throw new Error('기업 초대 코드를 입력해 주세요.');
      const { data, error } = await supabase.auth.signUp({
        email: String(email || '').trim().toLowerCase(),
        password: String(password || ''),
        options: { data: { name: cleanName } },
      });
      if (error) throw new Error(authMessage(error));
      if (Array.isArray(data.user?.identities) && data.user.identities.length === 0) {
        throw new Error('이미 가입된 이메일이에요. 로그인해 주세요.');
      }
      if (!data.session) {
        writePending({ code: String(code).trim(), name: cleanName });
        throw new Error('가입 확인 메일을 확인한 뒤 로그인해 주세요. 로그인하면 회사 가입이 자동으로 진행돼요.');
      }
      cached = null;
      await joinCompany(code, cleanName, '');
      cached = null;
      await loadContext({ force: true });
      return api.me();
    },

    async logout() {
      const demo = isDemo();
      setDemo(false);
      cached = null;
      clearSeatMap();
      if (demo) {
        const local = createAdapter(shelf());
        await local.logout();
      }
      await supabase.auth.signOut();
    },

    async demo() {
      setDemo(true);
      setCompanyFloors([1, 2]);
      setCompanyName('InThon 컴퍼니');
      clearSeatMap();
      cached = null;
      const local = createAdapter(shelf());
      return local.demo();
    },

    async completeOnboarding({ name, role }) {
      const ctx = await memberContext();
      if (!String(name || '').trim() || !String(role || '').trim()) throw new Error('이름과 직무를 입력해 주세요.');
      const { error } = await supabase.from('employees')
        .update({ name: String(name).trim(), job_title: String(role).trim() })
        .eq('id', ctx.membership.employee_id)
        .select('id,name,job_title,updated_at')
        .single();
      if (error) throw new Error(businessMessage(error));
      return api.me();
    },

    async referenceCharacter(cfg) {
      const ctx = await memberContext();
      const save = character => supabase.rpc('save_character', {
        p_employee_id: ctx.membership.employee_id,
        p_character: character,
      });
      // 피부 톤을 먼저 보낸다. 카탈로그 조회가 막혀 있어도 톤은 저장되고,
      // 007 이전 DB가 8번째 키를 거부할 때만 톤 없이 한 번 더 저장한다.
      const toned = toNativeCharacter(cfg, true);
      let { error } = await save(toned);
      if (error && toned.skinTone) {
        ({ error } = await save(toNativeCharacter(cfg, false)));
      }
      if (error) throw new Error(businessMessage(error));
      return api.me();
    },

    async referenceSeat(seat) {
      const ctx = await memberContext();
      await chooseSeat(ctx, seat);
      return api.me();
    },

    async profile(changes) {
      validateProfile(changes);
      const ctx = await memberContext();
      const current = ctx.membership.seat_id ? ctx.seatsById[ctx.membership.seat_id] : null;
      if (!current || normalizeSeatLabel(current.label) !== normalizeSeatLabel(changes.seat)) {
        await chooseSeat(ctx, changes.seat);
      }

      const { error: employeeError } = await supabase.from('employees')
        .update({ name: String(changes.name).trim(), job_title: String(changes.role).trim() })
        .eq('id', ctx.membership.employee_id)
        .select('id,name,job_title,updated_at')
        .single();
      if (employeeError) throw new Error(businessMessage(employeeError));

      const sensitivity = changes.sensitivity || {};
      const profile = { description: String(changes.description || '') };
      for (const [feKey, dbKey] of Object.entries(SENSI_TO_DB)) profile[dbKey] = sensitivity[feKey];
      const { error: profileError } = await supabase.from('sensory_profiles')
        .update(profile)
        .eq('employee_id', ctx.membership.employee_id)
        .select('employee_id,visual_sensitivity,auditory_sensitivity,olfactory_sensitivity,description,updated_at')
        .single();
      if (profileError) throw new Error(businessMessage(profileError));

      return api.me();
    },

    // 온보딩 감각 단계: 좌석 배정 전에 민감도·설명만 저장한다.
    async sensitivity(values, description = '') {
      const ctx = await memberContext();
      const profile = { description: String(description || '') };
      for (const [feKey, dbKey] of Object.entries(SENSI_TO_DB)) profile[dbKey] = values?.[feKey];
      const { error } = await supabase.from('sensory_profiles')
        .update(profile)
        .eq('employee_id', ctx.membership.employee_id)
        .select('employee_id,visual_sensitivity,auditory_sensitivity,olfactory_sensitivity,description,updated_at')
        .single();
      if (error) throw new Error(businessMessage(error));
      return api.me();
    },

    async character(look) {
      validateCharacter(look);
      const ctx = await memberContext();
      const { error } = await supabase.rpc('save_character', {
        p_employee_id: ctx.membership.employee_id,
        p_character: normalizeCharacter(look),
      });
      if (error) throw new Error(businessMessage(error));
      return api.me();
    },

    async status(status, reason = '') {
      const dbStatus = STATUS_TO_DB[status];
      if (!dbStatus) throw new Error('근태 상태를 확인해 주세요.');
      const dbReason = status === 'away' ? (REASON_TO_DB[reason] || null) : null;
      const ctx = await memberContext();
      const { error } = await supabase.rpc('set_employee_status', {
        p_employee_id: ctx.membership.employee_id,
        p_status: dbStatus,
        p_away_reason: dbReason,
      });
      if (error) throw new Error(businessMessage(error));
      return api.me();
    },

    async awayNote(value) {
      const text = String(value || '').trim();
      if ([...text].length > 20) throw new Error('자리 비움 사유는 20자까지 입력할 수 있어요.');
      const ctx = await memberContext();
      const { error } = await supabase.rpc('set_away_reason_text', {
        p_employee_id: ctx.membership.employee_id,
        p_reason_text: text || null,
      });
      if (error) throw new Error(businessMessage(error));
      return api.me();
    },

    async message(value, icon = '') {
      const text = String(value || '').trim();
      if ([...text].length > 20) throw new Error('상태 메시지는 공백 포함 20자까지 입력할 수 있어요.');
      const ctx = await memberContext();
      const { error } = await supabase.rpc('set_status_message', {
        p_employee_id: ctx.membership.employee_id,
        p_status_message: text,
      });
      if (error) throw new Error(businessMessage(error));
      return api.me();
    },

    async senses(values) {
      const patch = {};
      for (const [feKey, level] of Object.entries(values || {})) {
        const dbKey = SENSE_TO_DB[feKey];
        if (!dbKey) continue;
        if (level === null || level === undefined) { patch[dbKey] = null; continue; }
        if (!Number.isInteger(level) || level < 1 || level > 5) throw new Error('감각은 1~5단계로 선택해 주세요.');
        patch[dbKey] = level;
      }
      if (!Object.keys(patch).length) throw new Error('감각은 1~5단계로 선택해 주세요.');
      const ctx = await memberContext();
      const { error } = await supabase.rpc('set_current_sensations', {
        p_employee_id: ctx.membership.employee_id,
        p_patch: patch,
      });
      if (error) throw new Error(businessMessage(error));
      return api.me();
    },

    // LLM 예약 비서. 로그인 세션으로 Edge Function을 호출하고,
    // 초안/예약 확인은 모두 서버가 검증한다. FE는 확인 UI만 담당한다.
    async assistant(body) {
      const { data, error } = await supabase.functions.invoke('sensory-assistant', { body });
      if (error) {
        let payload = null;
        try { payload = await error.context?.json?.(); } catch { /* 게이트웨이/CORS 오류는 JSON body가 없을 수 있다 */ }
        const code = payload?.error_code || '';
        const failure = new Error(ASSISTANT_MESSAGES[code]
          || (payload ? '비서 요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.'
            : '비서 서버에 연결하지 못했어요. 네트워크를 확인해 주세요.'));
        failure.code = code || 'NETWORK';
        failure.draftId = payload?.draft_id || null;
        failure.version = payload?.version || null;
        throw failure;
      }
      return data;
    },
  };
  return api;
}

// The demo office keeps working from this browser only. Real accounts and the
// demo share the same adapter surface, so the UI never has to know the source.
export const isDemoMode = isDemo;

export function createApi() {
  const local = createAdapter(shelf());
  const remote = createSupabaseAdapter();
  const useLocal = () => isDemo();
  // The demo office is laid out over floors 1 and 2; a real login replaces them.
  if (isDemo()) { setCompanyFloors([1, 2]); setCompanyName('InThon 컴퍼니'); }

  return {
    me: () => (useLocal() ? local.me() : remote.me()),
    list: () => (useLocal() ? local.list() : remote.list()),
    demo: () => remote.demo(),
    enter: async token => {
      // Only demo links use this browser's local office; a real personal link
      // always leaves demo mode.
      if (/^demo-/i.test(String(token || ''))) {
        setDemo(true);
        // A first visit through a demo link never ran the load-time setup above.
        setCompanyFloors([1, 2]);
        setCompanyName('InThon 컴퍼니');
        const user = await local.enter(token);
        // Entering the office starts the workday right away.
        try { await local.status('working'); } catch { /* entry must still succeed */ }
        return user;
      }
      setDemo(false);
      const user = await remote.enter(token);
      try { await remote.status('working'); } catch { /* entry must still succeed */ }
      return user;
    },
    login: (email, password, code) => {
      setDemo(false);
      return remote.login(email, password, code);
    },
    signup: values => {
      setDemo(false);
      return remote.signup(values);
    },
    logout: () => remote.logout(),
    completeOnboarding: values => (useLocal() ? local.completeOnboarding(values) : remote.completeOnboarding(values)),
    referenceCharacter: cfg => (useLocal() ? local.referenceCharacter(cfg) : remote.referenceCharacter(cfg)),
    referenceSeat: seat => (useLocal() ? local.referenceSeat(seat) : remote.referenceSeat(seat)),
    profile: changes => (useLocal() ? local.profile(changes) : remote.profile(changes)),
    sensitivity: (values, description) => (useLocal() ? local.sensitivity(values, description) : remote.sensitivity(values, description)),
    character: look => (useLocal() ? local.character(look) : remote.character(look)),
    status: (status, reason) => (useLocal() ? local.status(status, reason) : remote.status(status, reason)),
    awayNote: value => (useLocal() ? local.awayNote(value) : remote.awayNote(value)),
    message: (value, icon) => (useLocal() ? local.message(value, icon) : remote.message(value, icon)),
    senses: values => (useLocal() ? local.senses(values) : remote.senses(values)),
    // 데모 모드는 서버 세션이 없으므로 null을 돌려주고, 비서 화면이 로컬 안내로 대체한다.
    assistant: body => (useLocal() ? Promise.resolve(null) : remote.assistant(body)),
  };
}
