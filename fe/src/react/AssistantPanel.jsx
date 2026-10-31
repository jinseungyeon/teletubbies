import React, { useCallback, useEffect, useRef, useState } from 'react';
import { QUICK_STATUS } from '../data.js';

// AI 비서 "센비". 대화로 상태·메시지·알림·예약을 바꾼다.
// 지금은 LLM이 연결되지 않아 askLLM()이 null을 돌려주고, 로컬 파서가 대신 답한다.
// LLM을 연결할 때는 askLLM()만 실제 API 호출로 바꾸면 된다.

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
  const sref = useRef(state);
  sref.current = state;
  const busyRef = useRef(false);
  const runningRef = useRef(new Set());
  const ctx = useRef({ me, people, api, refresh, toast, onNotifChange });
  ctx.current = { me, people, api, refresh, toast, onNotifChange };

  const setAI = patch => setState(st => ({ ...st, ...(typeof patch === 'function' ? patch(st) : patch) }));
  const setInput = value => setAI({ input: value });
  const setTab = tab => setAI({ tab });
  const markRead = () => { if (sref.current.unread) setAI({ unread: false }); };

  const pushBot = useCallback((text, plan) => {
    const m = { id: 'b' + Date.now() + Math.round(Math.random() * 1e4), role: 'bot', text, plan: plan || null };
    setState(st => ({ ...st, msgs: st.msgs.concat(m), unread: true }));
  }, []);

  const updPlan = (id, patch) => setState(st => ({
    ...st,
    msgs: st.msgs.map(m => (m.id === id ? { ...m, plan: { ...m.plan, ...patch } } : m)),
  }));
  const updTask = (id, patch) => setState(st => ({ ...st, tasks: st.tasks.map(t => (t.id === id ? { ...t, ...patch } : t)) }));

  // LLM 연결 지점. 지금은 연결이 없어 항상 null을 돌려주고 parseLocal이 대신 답한다.
  const askLLM = useCallback(async () => {
    const bridge = window.claude;
    if (!bridge || typeof bridge.complete !== 'function') return null;
    return null;
  }, []);

  const send = useCallback(async text => {
    const t = String(text || '').trim();
    if (!t || busyRef.current) return;
    busyRef.current = true;
    const hist = sref.current.msgs.slice(-6);
    setState(st => ({ ...st, msgs: st.msgs.concat({ id: 'u' + Date.now(), role: 'user', text: t }), input: '', busy: true, tab: 'chat' }));
    let res = null;
    try { res = await askLLM(t, hist); } catch (error) { res = null; }
    if (!res || typeof res !== 'object') res = answerLocal(t, ctx.current.people) || parseLocal(t);
    const plan = normPlan(res.plan);
    const m = {
      id: 'b' + Date.now(),
      role: 'bot',
      text: String(res.reply || (plan ? '알겠습니다. 아래와 같이 설정할까요?' : '조금 더 자세히 말씀해 주시겠어요?')),
      plan: plan ? { ...plan, state: 'proposed', editing: false } : null,
    };
    setState(st => ({ ...st, busy: false, msgs: st.msgs.concat(m), unread: true }));
    busyRef.current = false;
  }, [askLLM]);

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

export function AssistantPanel({ ai, me, onClose }) {
  const listRef = useRef(null);
  const count = ai.msgs.length + (ai.busy ? 1 : 0);
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [count]);
  const canSend = !!ai.input.trim() && !ai.busy;

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
          <button onClick={() => ai.setTab('tasks')} style={SEG(ai.tab === 'tasks')}>예약 작업 {ai.taskCount || ''}</button>
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
      ) : (
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
      )}
    </div>
  );
}
