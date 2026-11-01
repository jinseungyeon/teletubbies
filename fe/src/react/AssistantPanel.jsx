import React, { useCallback, useEffect, useRef, useState } from 'react';
import { QUICK_STATUS } from '../data.js';
import { isDemoMode } from '../api.js';

// AI 비서 "센비". 대화로 상태·메시지·알림·예약을 바꾼다.
// 실제 로그인에서는 sensory-assistant Edge Function(LLM)이 초안을 만들고,
// 사용자가 [예약]을 눌렀을 때만 서버가 등록한다. 데모 모드는 로컬 파서로 안내한다.

// 상태 키 -> FE 근태 상태(api.status) 매핑
const STO = {
  meeting: { label: '미팅 중', status: 'away', reason: '미팅' },
  focus: { label: '집중 근무 중', status: 'working', reason: '' },
  meal: { label: '식사', status: 'away', reason: '점심' },
  outside: { label: '외근', status: 'away', reason: '외근' },
  short: { label: '잠깐 자리 비움', status: 'away', reason: '' },
  work: { label: '근무 중', status: 'working', reason: '' },
  off: { label: '퇴근', status: 'offline', reason: '' },
};
// 알림 그룹 -> senspace.notif.items 키
const NG = {
  msg: { label: '상태 메시지', keys: ['meetup', 'sense', 'help'] },
  state: { label: '상태 변경', keys: ['attend', 'back'] },
  space: { label: '공간 감각 변화', keys: ['space'] },
};
const NOTIF_BASE = {
  master: true,
  items: { sense: true, meetup: true, help: true, attend: false, back: false, space: false },
  scope: 'team',
  quiet: true,
};

const pad2 = n => String(n).padStart(2, '0');
const isoDate = d => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
const tAt = (date, hm) => new Date(date + 'T' + hm + ':00').getTime();
const planWhen = p => { const pr = p.date.split('-'); return (+pr[1]) + '월 ' + (+pr[2]) + '일 ' + p.start + (p.end ? '–' + p.end : ''); };
const addH = (hm, n) => { const a = hm.split(':').map(Number); return pad2(Math.min(23, a[0] + n)) + ':' + pad2(a[1]); };
const shortMessage = value => [...String(value || '')].slice(0, 20).join('');
const taskSummary = t => [
  t.status && STO[t.status] ? STO[t.status].label + '(으)로 상태 변경' : null,
  t.message ? '상태 메시지 "' + t.message + '"' : null,
  t.notif ? '알림 ' + Object.keys(t.notif).map(g => NG[g].label + ' ' + (t.notif[g] ? '켬' : '끔')).join(', ') : null,
].filter(Boolean).join(' · ');

// 서버(Edge Function)가 돌려준 초안·예약 표시용.
const REASON_LABEL = { lunch: '점심', meeting: '회의', outside: '외출' };
const EMOJI_LABEL = Object.fromEntries(QUICK_STATUS.map(([id, text]) => [id, text]));
const RES_STATE = {
  queued: ['실행 대기', '#3a4170', '#dbddea'],
  running: ['실행 중', '#2f8a52', '#e3f3e8'],
  completed: ['완료', '#2f8a52', '#e3f3e8'],
  completed_conflict: ['일부만 복원', '#b8701a', '#fdf0da'],
  failed: ['실패', '#a33b3b', '#fbe6e6'],
  cancelled: ['취소됨', '#8a8499', '#ecebf1'],
  expired: ['만료', '#8a8499', '#ecebf1'],
};
const kstDate = iso => new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', weekday: 'short' }).format(new Date(iso));
const kstTime = iso => new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
const proposalWhen = p => `${kstDate(p.starts_at)} ${kstTime(p.starts_at)}~${kstTime(p.ends_at)}`;
const reservationWhen = r => `${kstDate(r.starts_at)} ${kstTime(r.starts_at)}~${kstTime(r.ends_at)}`;
const attendanceText = a => {
  if (!a) return '';
  if (a.status === 'working') return '업무 중';
  const detail = a.away_reason ? REASON_LABEL[a.away_reason] : a.away_reason_text || '';
  return '자리비움' + (detail ? ' · ' + detail : '');
};
const changeLines = changes => {
  const c = changes || {};
  const out = [];
  if (c.attendance) out.push('업무 상태: ' + attendanceText(c.attendance));
  if ('status_message' in c) out.push(c.status_message ? `상태 메시지: “${c.status_message}”` : '상태 메시지 지우기');
  if ('quick_emoji_id' in c) out.push(c.quick_emoji_id ? '빠른 이모티콘: ' + (EMOJI_LABEL[c.quick_emoji_id] || c.quick_emoji_id) : '빠른 이모티콘 선택 해제');
  if (c.notifications) out.push('본인 좌석 배정 변경 알림 ' + (c.notifications.seat_changed_enabled ? '켜기' : '끄기'));
  return out;
};
const restoreText = restore => (restore === 'keep' ? '종료 후 변경한 설정 유지' : '종료 후 변경 전 설정으로 복원');
const reservationLabel = r => {
  if (!r) return '실행 대기 중';
  const base = (RES_STATE[r.state] || ['알 수 없음'])[0];
  if (r.state === 'completed' && r.result?.mode === 'keep') return base + ' · 변경 유지';
  return base;
};
// 서버 응답(초안/질문)을 메시지에 붙일 형태로 정리한다.
const serverMessage = res => {
  const draft = res.draft || {};
  if (res.kind === 'clarification') {
    return {
      text: draft.reply || '추가 정보를 확인해 주세요. 아직 예약되지 않았어요.',
      server: { draftId: draft.id, version: draft.version, draft, token: null, state: 'clarification', questions: draft.questions || [], reservation: null, pendingKey: null },
    };
  }
  return {
    text: draft.reply || '다음 내용으로 예약할까요? 아직 예약되지 않았어요.',
    server: { draftId: draft.id, version: draft.version, draft, token: res.confirmation_token || null, state: 'preview', questions: [], reservation: null, pendingKey: null },
  };
};

function readNotif() {
  try {
    const n = JSON.parse(localStorage.getItem('senspace.notif') || 'null');
    if (n && n.items) return { ...NOTIF_BASE, ...n, items: { ...NOTIF_BASE.items, ...n.items } };
  } catch (error) { /* ignore broken storage */ }
  return JSON.parse(JSON.stringify(NOTIF_BASE));
}
function writeNotif(next) {
  try { localStorage.setItem('senspace.notif', JSON.stringify(next)); } catch (error) { /* ignore */ }
}
const groupOn = (notif, group) => NG[group].keys.every(key => !!notif.items[key]);

const normPlan = raw => {
  if (!raw || typeof raw !== 'object') return null;
  const now = new Date();
  const okT = v => (typeof v === 'string' && /^\d{1,2}:\d{2}$/.test(v) ? pad2(+v.split(':')[0]) + ':' + v.split(':')[1] : null);
  const p = {
    date: typeof raw.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.date) ? raw.date : isoDate(now),
    start: okT(raw.start) || pad2(now.getHours()) + ':' + pad2(now.getMinutes()),
    end: okT(raw.end),
    status: STO[raw.status] ? raw.status : null,
    message: typeof raw.message === 'string' && raw.message.trim() ? shortMessage(raw.message.trim()) : null,
    notif: null,
  };
  if (raw.notif && typeof raw.notif === 'object') {
    const nn = {};
    Object.keys(NG).forEach(k => { if (typeof raw.notif[k] === 'boolean') nn[k] = raw.notif[k]; });
    if (Object.keys(nn).length) p.notif = nn;
  }
  if (!p.status && !p.message && !p.notif) return null;
  if (!p.end && p.status === 'meeting') p.end = addH(p.start, 1);
  return p;
};

const parseLocal = t => {
  const now = new Date();
  let start = null, end = null;
  const fix = (hh, ap) => (ap === '오후' && hh < 12 ? hh + 12 : !ap && hh >= 1 && hh <= 7 ? hh + 12 : hh);
  const m = t.match(/(오전|오후)?\s*(\d{1,2})\s*시\s*(반|\d{1,2}\s*분)?/);
  if (m) start = pad2(fix(+m[2], m[1])) + ':' + pad2(m[3] === '반' ? 30 : m[3] ? parseInt(m[3], 10) : 0);
  const r = t.match(/(\d{1,2})\s*시\s*(?:부터|~|-|에서)\s*(\d{1,2})\s*시/);
  if (r) end = pad2(fix(+r[2])) + ':00';
  let status = null;
  if (/회의|미팅/.test(t)) status = 'meeting';
  else if (/집중/.test(t)) status = 'focus';
  else if (/점심|식사|밥/.test(t)) status = 'meal';
  else if (/외근|출장/.test(t)) status = 'outside';
  else if (/퇴근/.test(t)) status = 'off';
  else if (/자리\s*비/.test(t)) status = 'short';
  let notif = null;
  if (/알림/.test(t)) {
    if (/(끄|꺼|끕|off|무음|멈)/i.test(t)) notif = { msg: false, state: false, space: false };
    else if (/(켜|on)/i.test(t)) notif = { msg: true, state: true, space: true };
  }
  const mq = t.match(/메시지[를는은]?\s*["'“‘](.+?)["'”’]/);
  const plan = status || notif || mq ? { date: isoDate(now), start, end, status, message: mq ? mq[1] : null, notif } : null;
  return {
    reply: plan ? '알겠습니다. 아래와 같이 설정할까요?' : '상태 변경, 알림 설정, 시간 예약을 도와드릴 수 있어요. "2시에 회의 있으니까 알림 다 끄고 미팅 중으로 바꿔줘"처럼 말씀해 주세요.',
    plan,
  };
};

// LLM이 없을 때 사무실 데이터로 답할 수 있는 질문만 로컬에서 처리한다.
const answerLocal = (t, people) => {
  if (/조용|소음|시끄/.test(t)) {
    const by = {};
    (people || []).forEach(p => {
      const v = p.senses && p.senses.noise;
      if (!Number.isInteger(v) || !Number.isInteger(p.floor) || p.status === 'offline') return;
      (by[p.floor] = by[p.floor] || []).push(v);
    });
    const rows = Object.entries(by)
      .map(([floor, arr]) => ({ floor: Number(floor), n: arr.length, avg: arr.reduce((a, b) => a + b, 0) / arr.length }))
      .sort((a, b) => a.avg - b.avg);
    if (!rows.length) return { reply: '아직 동료들이 공유한 소음 데이터가 없어서 어느 곳이 조용한지 알기 어려워요. 감각 정보를 공유하면 더 정확하게 알려드릴 수 있어요.', plan: null };
    const [best, next] = rows;
    return {
      reply: `${best.floor}층이 평균 소음 ${best.avg.toFixed(1)}(1~5)으로 가장 조용해요.` +
        (next ? ` ${next.floor}층은 ${next.avg.toFixed(1)}이에요.` : '') +
        ` 지금 감각을 공유한 동료 ${rows.reduce((a, r) => a + r.n, 0)}명 기준이에요.`,
      plan: null,
    };
  }
  return null;
};

export function useAssistant({ me, people, api, refresh, toast, onNotifChange }) {
  const [state, setState] = useState({ tab: 'chat', msgs: [], input: '', busy: false, unread: false, tasks: [] });
  const [demo] = useState(() => isDemoMode());
  const [remoteTasks, setRemoteTasks] = useState([]);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const sref = useRef(state);
  sref.current = state;
  const busyRef = useRef(false);
  const confirmingRef = useRef(new Set());
  const runningRef = useRef(new Set());
  // 아직 예약되지 않은 질문형 초안. 다음 채팅 입력은 새 interpret 대신 revise로 보낸다.
  const draftRef = useRef(null);
  const ctx = useRef({ me, people, api, refresh, toast, onNotifChange });
  ctx.current = { me, people, api, refresh, toast, onNotifChange };

  const setAI = patch => setState(st => ({ ...st, ...(typeof patch === 'function' ? patch(st) : patch) }));
  const setInput = value => setAI({ input: value });
  const setTab = tab => { setAI({ tab }); if (tab === 'tasks') refreshReservations(); };
  const markRead = () => { if (sref.current.unread) setAI({ unread: false }); };

  const pushBot = useCallback((text, plan) => {
    const m = { id: 'b' + Date.now() + Math.round(Math.random() * 1e4), role: 'bot', text, plan: plan || null };
    setState(st => ({ ...st, msgs: st.msgs.concat(m), unread: true }));
  }, []);

  const updPlan = (id, patch) => setState(st => ({
    ...st,
    msgs: st.msgs.map(m => (m.id === id ? { ...m, plan: { ...m.plan, ...patch } } : m)),
  }));
  const updServer = (id, patch) => setState(st => ({
    ...st,
    msgs: st.msgs.map(m => (m.id === id && m.server ? { ...m, server: { ...m.server, ...patch } } : m)),
  }));
  const updTask = (id, patch) => setState(st => ({ ...st, tasks: st.tasks.map(t => (t.id === id ? { ...t, ...patch } : t)) }));

  const refreshReservations = useCallback(async () => {
    if (demo) return;
    setRemoteLoading(true);
    try {
      const res = await ctx.current.api.assistant({ action: 'list_reservations' });
      if (res && Array.isArray(res.reservations)) setRemoteTasks(res.reservations);
    } catch (error) {
      // 목록 조회 실패는 대화·예약 자체를 막지 않는다.
    } finally {
      setRemoteLoading(false);
    }
  }, [demo]);

  useEffect(() => { refreshReservations(); }, [refreshReservations]);

  const send = useCallback(async text => {
    const t = String(text || '').trim();
    if (!t || busyRef.current) return;
    busyRef.current = true;
    setState(st => ({ ...st, msgs: st.msgs.concat({ id: 'u' + Date.now(), role: 'user', text: t }), input: '', busy: true, tab: 'chat' }));
    try {
      // 사무실 데이터로 바로 답할 수 있는 질문은 LLM을 거치지 않는다.
      const localAnswer = answerLocal(t, ctx.current.people);
      if (localAnswer) { pushBot(localAnswer.reply); return; }
      if (!demo) {
        const pending = draftRef.current;
        const res = await ctx.current.api.assistant(pending
          ? { action: 'revise', draft_id: pending.id, version: pending.version, text: t }
          : { action: 'interpret', text: t });
        if (res && (res.kind === 'clarification' || res.kind === 'preview')) {
          const next = serverMessage(res);
          draftRef.current = next.server.state === 'clarification' && next.server.draftId
            ? { id: next.server.draftId, version: next.server.version } : null;
          setState(st => ({ ...st, msgs: st.msgs.concat({ id: 'b' + Date.now(), role: 'bot', text: next.text, server: next.server }), unread: true }));
          return;
        }
        // 응답을 해석하지 못한 경우 예약 성공으로 표시하지 않는다.
        pushBot('비서 응답을 받지 못했어요. 잠시 뒤 다시 시도해 주세요.');
        return;
      }
      // 데모 모드: 서버 세션이 없으므로 로컬 파서가 안내한다.
      const res = parseLocal(t);
      const plan = normPlan(res.plan);
      draftRef.current = null;
      const m = {
        id: 'b' + Date.now(),
        role: 'bot',
        text: String(res.reply || (plan ? '알겠습니다. 아래와 같이 설정할까요?' : '조금 더 자세히 말씀해 주시겠어요?')),
        plan: plan ? { ...plan, state: 'proposed', editing: false } : null,
      };
      setState(st => ({ ...st, msgs: st.msgs.concat(m), unread: true }));
    } catch (error) {
      // 수정 중 LLM 오류가 나면 DB 버전만 먼저 올라갔을 수 있다.
      if (error.draftId && error.version) draftRef.current = { id: error.draftId, version: error.version };
      pushBot(error.message || '비서 요청을 처리하지 못했어요. 잠시 뒤 다시 시도해 주세요.');
    } finally {
      busyRef.current = false;
      setState(st => ({ ...st, busy: false }));
    }
  }, [pushBot, demo]);

  // [예약] 버튼을 눌렀을 때만 confirm을 보낸다. 같은 확인의 재시도는 같은 멱등키를 쓴다.
  const confirmServer = useCallback(async id => {
    const m = sref.current.msgs.find(x => x.id === id);
    if (!m || !m.server || m.server.state !== 'preview' || !m.server.token || confirmingRef.current.has(id) || busyRef.current) return;
    confirmingRef.current.add(id);
    const s = m.server;
    const key = s.pendingKey || crypto.randomUUID();
    updServer(id, { state: 'busy', pendingKey: key });
    try {
      const res = await ctx.current.api.assistant({
        action: 'confirm', draft_id: s.draftId, version: s.version,
        confirmation_token: s.token, idempotency_key: key, confirmed: true,
      });
      draftRef.current = null;
      updServer(id, { state: 'reserved', reservation: res?.reservation || null, pendingKey: null });
      ctx.current.toast('예약했어요.');
      pushBot('예약했어요. 아직 상태는 바뀌지 않았고, 예약된 시각에 서버가 실행해요. 예약 작업 탭에서 상태를 확인할 수 있어요.');
      refreshReservations();
    } catch (error) {
      if (error.code === 'NETWORK' || error.code === 'UPSTREAM_UNAVAILABLE') {
        // 같은 초안·토큰·멱등키로 다시 확인하면 중복 예약을 만들지 않는다.
        updServer(id, { state: 'preview' });
        ctx.current.toast(error.message);
      } else if (error.code === 'ASSISTANT_VERSION_CONFLICT' || error.code === 'ASSISTANT_DRAFT_EXPIRED') {
        draftRef.current = null;
        updServer(id, { state: 'stale', token: null, error: error.message + ' 채팅에 같은 요청을 다시 입력해 주세요.' });
        pushBot(error.message);
      } else {
        updServer(id, { state: 'preview' });
        ctx.current.toast(error.message);
      }
    } finally {
      confirmingRef.current.delete(id);
    }
  }, [pushBot, refreshReservations]);

  // [수정]: 자연어로 revise를 요청하고 같은 카드의 초안을 갱신한다.
  const reviseServer = useCallback(async (id, text) => {
    const t = String(text || '').trim();
    const m = sref.current.msgs.find(x => x.id === id);
    if (!t || !m || !m.server || busyRef.current) return;
    busyRef.current = true;
    const s = m.server;
    setState(st => ({ ...st, busy: true, msgs: st.msgs.concat({ id: 'u' + Date.now(), role: 'user', text: t }) }));
    updServer(id, { state: 'busy' });
    try {
      const res = await ctx.current.api.assistant({ action: 'revise', draft_id: s.draftId, version: s.version, text: t });
      const next = serverMessage(res);
      draftRef.current = next.server.state === 'clarification' && next.server.draftId
        ? { id: next.server.draftId, version: next.server.version } : null;
      setState(st => ({ ...st, msgs: st.msgs.map(x => (x.id === id ? { ...x, text: next.text, server: next.server } : x)) }));
    } catch (error) {
      if (error.draftId && error.version && error.version !== s.version) {
        // 버전이 올라가면 이전 확인 토큰은 쓸 수 없다.
        draftRef.current = null;
        updServer(id, { state: 'stale', version: error.version, token: null, error: error.message + ' 채팅에 같은 요청을 다시 입력해 주세요.' });
      } else {
        updServer(id, { state: s.state === 'clarification' ? 'clarification' : 'preview' });
      }
      ctx.current.toast(error.message);
    } finally {
      busyRef.current = false;
      setState(st => ({ ...st, busy: false }));
    }
  }, []);

  const cancelServer = useCallback(async id => {
    const m = sref.current.msgs.find(x => x.id === id);
    if (!m || !m.server || m.server.state === 'busy' || busyRef.current) return;
    const s = m.server;
    if (!s.draftId) { updServer(id, { state: 'cancelled' }); return; }
    try {
      await ctx.current.api.assistant({ action: 'cancel_draft', draft_id: s.draftId, version: s.version });
      draftRef.current = null;
      updServer(id, { state: 'cancelled', token: null });
      pushBot('취소했어요. 다른 도움이 필요하면 말씀해 주세요.');
    } catch (error) {
      ctx.current.toast(error.message);
    }
  }, [pushBot]);

  const cancelReservation = useCallback(async reservationId => {
    try {
      await ctx.current.api.assistant({ action: 'cancel_reservation', reservation_id: reservationId });
      ctx.current.toast('예약 취소를 요청했어요.');
      refreshReservations();
    } catch (error) {
      ctx.current.toast(error.message);
    }
  }, [refreshReservations]);

  const bookPlan = useCallback(id => {
    const m = sref.current.msgs.find(x => x.id === id);
    if (!m || !m.plan) return;
    const p = m.plan;
    if (!p.status && !p.message && !p.notif) { ctx.current.toast('바꿀 항목을 하나 이상 골라주세요'); return; }
    if (!p.date || !p.start) { ctx.current.toast('날짜와 시작 시간을 확인해 주세요'); return; }
    const task = { id: 't' + Date.now(), date: p.date, start: p.start, end: p.end || null, status: p.status, message: p.message, notif: p.notif, phase: 'wait', prev: null };
    updPlan(id, { state: 'booked', editing: false });
    setState(st => ({ ...st, tasks: st.tasks.concat(task) }));
    pushBot(planWhen(task) + ' 예약을 저장했어요. ' + (task.end ? task.start + '에 적용하고 ' + task.end + '에 원래대로 되돌릴게요.' : task.start + '에 적용할게요.'));
    setTimeout(() => tickRef.current(), 60);
  }, [pushBot]);

  const runTask = useCallback(async id => {
    const t = sref.current.tasks.find(x => x.id === id);
    if (!t || t.phase !== 'wait' || runningRef.current.has(id)) return;
    runningRef.current.add(id);
    const { me: meNow, api: apiNow, refresh: refreshNow, toast: toastNow, onNotifChange: onNotif } = ctx.current;
    const notifNow = readNotif();
    const prev = { status: meNow.status, reason: meNow.reason || '', message: meNow.message || '', messageIcon: meNow.messageIcon || '', notif: notifNow };
    updTask(id, { phase: 'run', prev });
    try {
      if (t.status) await apiNow.status(STO[t.status].status, STO[t.status].reason);
      if (t.message) {
        const preset = QUICK_STATUS.find(([, text]) => text === t.message);
        await apiNow.message(t.message, preset ? preset[0] : '');
      }
      if (t.status || t.message) await refreshNow();
      if (t.notif) {
        const next = { ...notifNow, items: { ...notifNow.items } };
        Object.keys(t.notif).forEach(g => NG[g].keys.forEach(k => { next.items[k] = t.notif[g]; }));
        writeNotif(next);
        if (onNotif) onNotif();
      }
      const txt = '예약 작업을 실행했어요 · ' + taskSummary(t);
      toastNow(txt);
      pushBot(txt);
    } catch (error) {
      updTask(id, { phase: 'done', prev: null });
      toastNow(error.message);
      pushBot('예약 작업을 실행하지 못했어요 · ' + error.message);
    } finally {
      runningRef.current.delete(id);
    }
  }, [pushBot]);

  const stopTask = useCallback(async id => {
    const t = sref.current.tasks.find(x => x.id === id);
    if (!t || t.phase !== 'run' || runningRef.current.has(id)) return;
    runningRef.current.add(id);
    const pv = t.prev;
    if (pv) {
      try {
        if (pv.message) await ctx.current.api.message(pv.message, pv.messageIcon);
        await ctx.current.api.status(pv.status, pv.reason);
        await ctx.current.refresh();
      } catch (error) { /* 되돌리기 실패는 상태만 남긴다 */ }
      if (pv.notif) {
        writeNotif(pv.notif);
        if (ctx.current.onNotifChange) ctx.current.onNotifChange();
      }
    }
    updTask(id, { phase: 'done' });
    runningRef.current.delete(id);
    const txt = '예약 작업이 끝나 원래 상태와 알림 설정으로 되돌렸어요';
    ctx.current.toast(txt);
    pushBot(txt);
  }, [pushBot]);

  const tick = useCallback(() => {
    const now = Date.now();
    sref.current.tasks.forEach(t => {
      const st = tAt(t.date, t.start);
      const en = t.end ? tAt(t.date, t.end) : null;
      if (t.phase === 'wait' && now >= st) {
        if (en && now >= en) updTask(t.id, { phase: 'done' });
        else runTask(t.id);
      } else if (t.phase === 'run' && en && now >= en) {
        stopTask(t.id);
      }
    });
  }, [runTask, stopTask]);
  const tickRef = useRef(tick);
  tickRef.current = tick;

  useEffect(() => {
    const timer = setInterval(() => tickRef.current(), 10000);
    return () => clearInterval(timer);
  }, []);

  const delTask = id => setState(st => ({ ...st, tasks: st.tasks.filter(t => t.id !== id) }));

  return {
    ...state,
    demo,
    remoteTasks,
    remoteLoading,
    taskCount: state.tasks.filter(t => t.phase !== 'done').length,
    setInput,
    setTab,
    markRead,
    send,
    pushBot,
    updPlan,
    bookPlan,
    runTask,
    stopTask,
    delTask,
    confirmServer,
    reviseServer,
    cancelServer,
    cancelReservation,
    refreshReservations,
  };
}

const TOG = on => ({ position: 'relative', width: 46, height: 24, borderRadius: 12, border: 'none', padding: 0, cursor: 'pointer', background: on ? '#3fae6a' : '#d8d0c0', flexShrink: 0, boxShadow: 'inset 0 2px 0 rgba(0,0,0,.12)' });
const KNOB = on => ({ position: 'absolute', top: 3, left: on ? 25 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', boxShadow: '0 2px 0 rgba(0,0,0,.18)', transition: 'left .15s' });
const SEG = on => ({ height: 30, border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 800, padding: '0 12px', whiteSpace: 'nowrap', background: on ? '#fff' : 'transparent', color: on ? '#2b2d55' : '#9a9384', boxShadow: on ? '0 2px 0 #dccdb2' : 'none' });
const inputStyle = { height: 34, border: '1.5px solid #e2d6c2', borderRadius: 9, padding: '0 10px', fontSize: 13, outline: 'none', background: '#fff', boxSizing: 'border-box', flex: 1, minWidth: 0 };
const SUGGESTIONS = [
  '2시에 회의 있으니까 알림 다 끄고, 미팅 중으로 바꿔줘',
  '3시부터 5시까지 집중 근무 중으로 해줘',
  '지금 제일 조용한 공간이 어디야?',
  "점심 먹으러 가요. 상태 메시지는 '1시에 돌아와요'로 해줘",
];
const PHASE = { wait: ['대기 중', '#3a4170', '#dbddea'], run: ['실행 중', '#2f8a52', '#e3f3e8'], done: ['완료', '#8a8499', '#ecebf1'] };

function BotMark() {
  return <span style={{ width: 28, height: 28, borderRadius: 9, background: '#2b2d55', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, font: '13px Galmuri11', color: '#f5c542', boxShadow: 'inset 0 -2px 0 #17183a' }}>✦</span>;
}

function PlanCard({ plan, onPatch, onBook, onCancel }) {
  const live = plan.state === 'proposed';
  const nk = plan.notif ? Object.keys(plan.notif) : [];
  const up = onPatch;
  return (
    <div style={{ background: '#fff', border: '1.5px solid #e2d6c2', borderRadius: 14, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10, boxShadow: '0 2px 0 #ece2cf' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13.5, fontWeight: 800, color: '#2b2d55' }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
        {planWhen(plan)} 예약 작업
      </div>
      {!(plan.editing && live) && (
        <>
          {plan.status && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5, flexWrap: 'wrap' }}>
              <span style={{ color: '#a39c8e' }}>·</span>
              <span style={{ padding: '3px 9px', borderRadius: 7, background: '#fdf0da', border: '1.5px solid #f0c04a', fontWeight: 800, color: '#8a5a12' }}>{STO[plan.status].label}</span>(으)로 상태 변경
            </div>
          )}
          {plan.message && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5, flexWrap: 'wrap' }}>
              <span style={{ color: '#a39c8e' }}>·</span>상태 메시지 <b>“{plan.message}”</b>
            </div>
          )}
          {nk.length > 0 && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5 }}><span style={{ color: '#a39c8e' }}>·</span>알림 설정</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, padding: '2px 0 2px 12px', marginLeft: 4, borderLeft: '2px solid #e2d6c2' }}>
                {nk.map(k => (
                  <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                    <span style={{ flex: 1 }}>{NG[k].label}</span>
                    <span style={{ font: '11px Galmuri11', color: '#8a8499', width: 26, textAlign: 'right' }}>{plan.notif[k] ? 'ON' : 'OFF'}</span>
                    <button onClick={() => { if (live) up({ notif: { ...plan.notif, [k]: !plan.notif[k] } }); }} style={{ ...TOG(plan.notif[k]), cursor: live ? 'pointer' : 'default' }}>
                      <span style={KNOB(plan.notif[k])} />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
          {plan.end && <div style={{ fontSize: 12, color: '#8a8499' }}>{plan.end}에 원래 상태와 알림 설정으로 되돌려요</div>}
        </>
      )}
      {plan.editing && live && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, fontSize: 12.5, fontWeight: 700, color: '#5d5870' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 56 }}>날짜</span>
              <input type="date" value={plan.date} onChange={e => up({ date: e.target.value })} style={inputStyle} />
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 56 }}>시간</span>
              <input type="time" value={plan.start} onChange={e => up({ start: e.target.value })} style={inputStyle} />
              <span>~</span>
              <input type="time" value={plan.end || ''} onChange={e => up({ end: e.target.value || null })} style={inputStyle} />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 56 }}>상태</span>
              <select value={plan.status || ''} onChange={e => up({ status: e.target.value || null })} style={{ ...inputStyle, cursor: 'pointer' }}>
                <option value="">변경 안 함</option>
                {Object.keys(STO).map(k => <option key={k} value={k}>{STO[k].label}</option>)}
              </select>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 56 }}>메시지</span>
              <input value={plan.message || ''} onChange={e => up({ message: e.target.value ? shortMessage(e.target.value) : null })} maxLength={20} placeholder="변경 안 함" style={inputStyle} />
            </label>
            {Object.keys(NG).map(g => {
              const cur = !plan.notif || plan.notif[g] == null ? 'keep' : plan.notif[g] ? 'on' : 'off';
              return (
                <div key={g} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ flex: 1, fontWeight: 600 }}>알림 · {NG[g].label}</span>
                  <span style={{ display: 'flex', background: '#efe6d5', borderRadius: 8, padding: 2 }}>
                    {[['keep', '유지'], ['on', '켬'], ['off', '끔']].map(([v, label]) => (
                      <button key={v} onClick={() => {
                        const nn = { ...(plan.notif || {}) };
                        if (v === 'keep') delete nn[g]; else nn[g] = v === 'on';
                        up({ notif: Object.keys(nn).length ? nn : null });
                      }} style={{ height: 26, padding: '0 9px', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700, background: cur === v ? '#2b2d55' : 'transparent', color: cur === v ? '#fff' : '#6e6a84' }}>{label}</button>
                    ))}
                  </span>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={onBook} style={{ height: 34, padding: '0 12px', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', flex: 1, border: 'none', background: '#2b2d55', color: '#fff', boxShadow: 'inset 0 -3px 0 #17183a' }}>이대로 예약</button>
            <button onClick={() => up({ editing: false })} style={{ height: 34, padding: '0 12px', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: '1.5px solid #e2d6c2', background: '#fff', color: '#4a4560' }}>미리보기</button>
          </div>
        </>
      )}
      {live && !plan.editing && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
          <button onClick={onBook} style={{ height: 34, padding: '0 12px', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none', background: '#2b2d55', color: '#fff', boxShadow: 'inset 0 -3px 0 #17183a' }}>예약</button>
          <button onClick={() => up({ editing: true })} style={{ height: 34, padding: '0 12px', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: '1.5px solid #e2d6c2', background: '#fff', color: '#2b2d55', boxShadow: 'inset 0 -2px 0 #efe6d5' }}>수정</button>
          <button onClick={onCancel} style={{ height: 34, padding: '0 12px', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: '1.5px solid #e2d6c2', background: '#fff', color: '#8a8499', boxShadow: 'inset 0 -2px 0 #efe6d5' }}>취소</button>
        </div>
      )}
      {plan.state === 'booked' && <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 800, color: '#2f8a52', background: '#e3f3e8', padding: '7px 10px', borderRadius: 9 }}>✓ 예약됨 · '예약 작업' 탭에서 관리할 수 있어요</div>}
      {plan.state === 'cancelled' && <div style={{ fontSize: 12.5, fontWeight: 700, color: '#8a8499', background: '#ecebf1', padding: '7px 10px', borderRadius: 9 }}>취소된 제안이에요</div>}
    </div>
  );
}

const btnBase = { height: 34, padding: '0 12px', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer' };
const BTN_PRIMARY = { ...btnBase, border: 'none', background: '#2b2d55', color: '#fff', boxShadow: 'inset 0 -3px 0 #17183a' };
const BTN_SECOND = { ...btnBase, border: '1.5px solid #e2d6c2', background: '#fff', color: '#2b2d55', boxShadow: 'inset 0 -2px 0 #efe6d5' };
const BTN_GHOST = { ...btnBase, border: '1.5px solid #e2d6c2', background: '#fff', color: '#8a8499', boxShadow: 'inset 0 -2px 0 #efe6d5' };

// 서버가 만든 초안 카드. [예약]을 눌렀을 때만 confirm을 보내고,
// [수정]은 자연어 revise로 같은 초안의 새 버전을 받는다.
function ServerPlanCard({ server, onConfirm, onRevise, onCancel }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const p = server.draft?.proposal;
  const live = server.state === 'preview';
  const busy = server.state === 'busy';
  const lines = p ? changeLines(p.changes) : [];
  const sendRevise = () => {
    const value = text.trim();
    if (!value) return;
    onRevise(value);
    setText('');
    setEditing(false);
  };
  return (
    <div style={{ background: '#fff', border: '1.5px solid #e2d6c2', borderRadius: 14, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10, boxShadow: '0 2px 0 #ece2cf' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13.5, fontWeight: 800, color: '#2b2d55' }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
        {p ? proposalWhen(p) + ' 예약 작업' : '추가 정보가 필요해요'}
      </div>
      {server.state === 'clarification' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13.5, lineHeight: 1.5 }}>
          {(server.questions || []).map((q, i) => (
            <div key={i} style={{ display: 'flex', gap: 7 }}>
              <b style={{ color: '#b8701a' }}>?</b><span>{q}</span>
            </div>
          ))}
          <div style={{ fontSize: 12, color: '#8a8499' }}>아래 채팅에 답변을 입력해 주세요. 아직 예약되지 않았어요.</div>
        </div>
      )}
      {p && (
        <>
          {lines.map((line, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5, flexWrap: 'wrap' }}>
              <span style={{ color: '#a39c8e' }}>·</span><span>{line}</span>
            </div>
          ))}
          <div style={{ fontSize: 12, color: '#8a8499' }}>{restoreText(p.restore)}</div>
        </>
      )}
      {editing && live && (
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); sendRevise(); } }}
            placeholder="예: 3시로 바꾸고 알림도 켜줘"
            maxLength={2000}
            style={inputStyle}
          />
          <button onClick={sendRevise} style={{ ...BTN_PRIMARY, flexShrink: 0 }}>보내기</button>
          <button onClick={() => { setEditing(false); setText(''); }} style={{ ...BTN_GHOST, flexShrink: 0, padding: '0 10px' }}>닫기</button>
        </div>
      )}
      {live && !editing && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
          <button onClick={onConfirm} style={BTN_PRIMARY}>예약</button>
          <button onClick={() => setEditing(true)} style={BTN_SECOND}>수정</button>
          <button onClick={onCancel} style={BTN_GHOST}>취소</button>
        </div>
      )}
      {live && !server.token && <div style={{ fontSize: 12, color: '#b8701a' }}>확인 정보가 없어 예약할 수 없어요. [수정]에서 다시 요청해 주세요.</div>}
      {busy && <div style={{ fontSize: 12.5, fontWeight: 700, color: '#5d6594', background: '#eef0f7', padding: '7px 10px', borderRadius: 9 }}>처리 중이에요…</div>}
      {server.state === 'reserved' && <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 800, color: '#2f8a52', background: '#e3f3e8', padding: '7px 10px', borderRadius: 9 }}>✓ 예약됨 · {reservationLabel(server.reservation)}</div>}
      {server.state === 'cancelled' && <div style={{ fontSize: 12.5, fontWeight: 700, color: '#8a8499', background: '#ecebf1', padding: '7px 10px', borderRadius: 9 }}>취소된 제안이에요</div>}
      {server.state === 'stale' && <div style={{ fontSize: 12.5, fontWeight: 700, color: '#b8701a', background: '#fdf0da', padding: '7px 10px', borderRadius: 9 }}>{server.error || '초안이 만료됐어요. 다시 요청해 주세요.'}</div>}
    </div>
  );
}

function RemoteTaskCard({ item, onCancel }) {
  const ph = RES_STATE[item.state] || ['알 수 없음', '#8a8499', '#ecebf1'];
  const lines = changeLines(item.proposal?.changes);
  const active = item.state === 'queued' || item.state === 'running';
  return (
    <div style={{ background: '#fff', border: '1px solid #ece2cf', borderRadius: 14, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8, boxShadow: '0 2px 0 #ece2cf' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2b2d55" strokeWidth="2.4" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
        <b style={{ fontSize: 14, flex: 1 }}>{reservationWhen(item)}</b>
        <span style={{ fontSize: 11.5, fontWeight: 800, color: ph[1], background: ph[2], padding: '3px 8px', borderRadius: 6, whiteSpace: 'nowrap' }}>{ph[0]}</span>
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.55, color: '#5d5870' }}>{lines.length ? lines.join(' · ') : '변경 항목을 불러오지 못했어요.'}</div>
      {item.proposal && <div style={{ fontSize: 12, color: '#8a8499' }}>{restoreText(item.proposal.restore)}</div>}
      {item.cancel_requested && item.state === 'running' && <div style={{ fontSize: 12, color: '#b8701a' }}>취소 요청됨 · 다음 실행에서 승인한 종료 규칙을 처리해요</div>}
      {item.error_code && <div style={{ fontSize: 12, color: '#a33b3b' }}>오류: {item.error_code}</div>}
      {active && !item.cancel_requested && (
        <div><button onClick={() => onCancel(item.id)} style={{ height: 30, padding: '0 12px', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: '1.5px solid #e2d6c2', background: '#fff', color: '#8a8499' }}>예약 취소</button></div>
      )}
    </div>
  );
}

export function AssistantPanel({ ai, me, onClose }) {
  const listRef = useRef(null);
  const count = ai.msgs.length + (ai.busy ? 1 : 0);
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [count]);
  const canSend = !!ai.input.trim() && !ai.busy;
  const taskBadge = ai.demo ? ai.taskCount : ai.remoteTasks.filter(r => r.state === 'queued' || r.state === 'running').length;

  return (
    <div className="ai-panel" style={{ position: 'fixed', right: 12, top: 74, bottom: 12, width: 396, maxWidth: 'calc(100vw - 24px)', zIndex: 150, background: '#fbf7ef', borderRadius: 18, boxShadow: '0 0 0 2px #2b2d55,0 24px 50px -16px rgba(23,24,58,.6)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '13px 14px', background: '#2b2d55', color: '#fff' }}>
        <span style={{ width: 36, height: 36, borderRadius: 11, background: '#fbf7ef', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '17px Galmuri11', color: '#e0a020', flexShrink: 0 }}>✦</span>
        <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <b style={{ fontSize: 15 }}>센비 · AI 비서</b>
          <span style={{ fontSize: 12, color: '#c9ccdf' }}>상태·알림·예약을 말로 설정해요</span>
        </span>
        <button onClick={onClose} title="닫기" style={{ width: 30, height: 30, borderRadius: 9, border: 'none', background: 'rgba(255,255,255,.14)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </div>
      <div style={{ padding: '10px 12px 0' }}>
        <span style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', background: '#efe6d5', borderRadius: 10, padding: 3 }}>
          <button onClick={() => ai.setTab('chat')} style={SEG(ai.tab === 'chat')}>대화</button>
          <button onClick={() => ai.setTab('tasks')} style={SEG(ai.tab === 'tasks')}>예약 작업 {taskBadge || ''}</button>
        </span>
      </div>
      {ai.tab === 'chat' ? (
        <>
          <div ref={listRef} style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {!ai.msgs.length && (
              <>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <BotMark />
                  <div style={{ alignSelf: 'flex-start', padding: '10px 13px', borderRadius: '14px 14px 14px 4px', background: '#fff', border: '1px solid #ece2cf', fontSize: 14, lineHeight: 1.55, whiteSpace: 'pre-wrap', color: '#2e2a44' }}>
                    안녕하세요, {me.name}님! 상태 변경이나 알림 설정, 시간 예약을 말로 부탁해 주세요. 지금 사무실 상황도 물어보실 수 있어요.
                  </div>
                </div>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#8a8499', margin: '4px 0 -4px 36px' }}>이렇게 말해 보세요</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 36 }}>
                  {SUGGESTIONS.map(text => (
                    <button key={text} onClick={() => ai.send(text)} style={{ textAlign: 'left', padding: '9px 12px', borderRadius: 11, border: '1.5px solid #e2d6c2', background: '#fff', fontSize: 13, lineHeight: 1.45, cursor: 'pointer', color: '#2e2a44' }}>{text}</button>
                  ))}
                </div>
              </>
            )}
            {ai.msgs.map(m => (m.role === 'user' ? (
              <div key={m.id} style={{ alignSelf: 'flex-end', maxWidth: '82%', padding: '10px 13px', borderRadius: '14px 14px 4px 14px', background: '#2b2d55', color: '#fff', fontSize: 14, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{m.text}</div>
            ) : (
              <div key={m.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <BotMark />
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ alignSelf: 'flex-start', padding: '10px 13px', borderRadius: '14px 14px 14px 4px', background: '#fff', border: '1px solid #ece2cf', fontSize: 14, lineHeight: 1.55, whiteSpace: 'pre-wrap', color: '#2e2a44' }}>{m.text}</div>
                  {m.plan && (
                    <PlanCard
                      plan={m.plan}
                      onPatch={patch => ai.updPlan(m.id, patch)}
                      onBook={() => ai.bookPlan(m.id)}
                      onCancel={() => { ai.updPlan(m.id, { state: 'cancelled' }); ai.pushBot('취소했어요. 다른 도움이 필요하면 말씀해 주세요.'); }}
                    />
                  )}
                  {m.server && (
                    <ServerPlanCard
                      server={m.server}
                      onConfirm={() => ai.confirmServer(m.id)}
                      onRevise={text => ai.reviseServer(m.id, text)}
                      onCancel={() => ai.cancelServer(m.id)}
                    />
                  )}
                </div>
              </div>
            )))}
            {ai.busy && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <BotMark />
                <span style={{ display: 'flex', gap: 5, padding: '12px 14px', borderRadius: 14, background: '#fff', border: '1px solid #ece2cf' }}>
                  <span className="ai-dot" style={{ width: 7, height: 7, borderRadius: 2, background: '#5d6594' }} />
                  <span className="ai-dot" style={{ width: 7, height: 7, borderRadius: 2, background: '#5d6594' }} />
                  <span className="ai-dot" style={{ width: 7, height: 7, borderRadius: 2, background: '#5d6594' }} />
                </span>
              </div>
            )}
          </div>
          <div style={{ padding: '10px 12px 12px', borderTop: '1px solid #efe6d5', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <textarea
              value={ai.input}
              onChange={e => ai.setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); ai.send(ai.input); } }}
              rows={2}
              placeholder="예: 2시에 회의 있으니까 알림 다 꺼줘"
              style={{ flex: 1, minWidth: 0, border: '1.5px solid #e2d6c2', borderRadius: 12, padding: '10px 12px', fontSize: 14, lineHeight: 1.45, outline: 'none', background: '#fff', resize: 'none', boxShadow: 'inset 0 2px 0 #f6f0e5' }}
            />
            <button onClick={() => ai.send(ai.input)} title="보내기" style={{ width: 44, height: 44, flexShrink: 0, border: 'none', borderRadius: 12, background: canSend ? '#2b2d55' : '#b9b7cc', color: '#fff', cursor: canSend ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: canSend ? 'inset 0 -3px 0 #17183a' : 'none' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </button>
          </div>
        </>
      ) : ai.demo ? (
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {!ai.tasks.length && (
            <div style={{ padding: '30px 16px', textAlign: 'center', fontSize: 13.5, lineHeight: 1.65, color: '#8a8499' }}>
              아직 예약된 작업이 없어요.<br />대화에서 "3시에 회의 있어"처럼 말하면<br />예약을 만들어 드려요.
            </div>
          )}
          {ai.tasks.slice().reverse().map(t => {
            const ph = PHASE[t.phase];
            return (
              <div key={t.id} style={{ background: '#fff', border: '1px solid #ece2cf', borderRadius: 14, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8, boxShadow: '0 2px 0 #ece2cf', opacity: t.phase === 'done' ? 0.6 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2b2d55" strokeWidth="2.4" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                  <b style={{ fontSize: 14, flex: 1 }}>{planWhen(t)}</b>
                  <span style={{ fontSize: 11.5, fontWeight: 800, color: ph[1], background: ph[2], padding: '3px 8px', borderRadius: 6, whiteSpace: 'nowrap' }}>{ph[0]}</span>
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.55, color: '#5d5870' }}>{taskSummary(t)}</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {t.phase === 'wait' && <button onClick={() => ai.runTask(t.id)} style={{ height: 30, padding: '0 12px', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none', background: '#2b2d55', color: '#fff' }}>지금 실행</button>}
                  {t.phase === 'run' && <button onClick={() => ai.stopTask(t.id)} style={{ height: 30, padding: '0 12px', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none', background: '#2b2d55', color: '#fff' }}>종료하고 되돌리기</button>}
                  {t.phase !== 'run' && <button onClick={() => ai.delTask(t.id)} style={{ height: 30, padding: '0 12px', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: '1.5px solid #e2d6c2', background: '#fff', color: '#8a8499' }}>삭제</button>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <b style={{ flex: 1, fontSize: 13.5, color: '#2b2d55' }}>서버 예약 내역</b>
            <button onClick={ai.refreshReservations} style={{ height: 28, padding: '0 10px', borderRadius: 8, border: '1.5px solid #e2d6c2', background: '#fff', fontSize: 12.5, fontWeight: 700, color: '#5d5870', cursor: 'pointer' }}>새로고침</button>
          </div>
          {ai.remoteLoading && !ai.remoteTasks.length && (
            <div style={{ padding: '30px 16px', textAlign: 'center', fontSize: 13.5, color: '#8a8499' }}>예약 내역을 불러오는 중이에요…</div>
          )}
          {!ai.remoteLoading && !ai.remoteTasks.length && (
            <div style={{ padding: '30px 16px', textAlign: 'center', fontSize: 13.5, lineHeight: 1.65, color: '#8a8499' }}>
              아직 예약이 없어요.<br />대화에서 "3시에 회의 있어"처럼 말하면<br />서버가 초안을 만들어 드려요.
            </div>
          )}
          {ai.remoteTasks.map(item => (
            <RemoteTaskCard key={item.id} item={item} onCancel={ai.cancelReservation} />
          ))}
        </div>
      )}
    </div>
  );
}
