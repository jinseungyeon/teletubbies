import React, { useEffect, useRef, useState } from 'react';
import { SENSES, FLOORS, COMPANY, QUICK_STATUS, charCount, todaySenses } from '../data.js';
import { HEATMAP_VIEWS, HEAT_COLORS } from '../heatmap.js';
import { SESSION } from '../session.js';
import { MapView, MiniView, SettingsView, EditorView } from './ReferenceViews.jsx';
import { Brand, Icon, FaceAvatar } from './Shared.jsx';
import SenseCard from './SenseCard.jsx';
import { FLOOR_TEAMS, statusInfo } from './helpers.js';

const FLOOR_LIST = () => FLOORS.slice().sort((a, b) => b - a);
const JOB_OPTIONS = ['프로덕트 디자이너', 'UX 리서처', '그래픽 디자이너', 'UI 디자이너', 'BX 디자이너'];
const RANK_OPTIONS = ['팀원', '파트 리드', '팀장', '인턴'];

function Modal({ title, kind, wide = false, full = false, onClose, children }) {
  useEffect(() => {
    document.body.classList.add('modal-open');
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.classList.remove('modal-open');
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);
  return (
    <div className={`modal-backdrop${full ? ' full' : ''}`} onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <section className={`modal${wide ? ' wide' : ''}`} data-kind={kind} role="dialog" aria-modal="true" aria-label={full ? title : undefined} aria-labelledby={full ? undefined : 'modal-title'} tabIndex={-1}>
        {full ? (
          <>
            <button className="modal-full-close" onClick={onClose} aria-label="닫기"><Icon name="close" size={20} /></button>
            {children}
          </>
        ) : (
          <>
            <header className="modal-header">
              <h2 id="modal-title">{title}</h2>
              <button className="icon-button" onClick={onClose} aria-label="닫기"><Icon name="close" size={20} /></button>
            </header>
            {children}
          </>
        )}
      </section>
    </div>
  );
}

export default function OfficePage({ api, me, people, version, refresh, toast, navigate, onLogout }) {
  const [floor, setFloor] = useState(FLOORS.includes(me.floor) ? me.floor : (FLOOR_LIST()[0] || 1));
  const [filter, setFilter] = useState('team');
  const [countPop, setCountPop] = useState(null);
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [awayOpen, setAwayOpen] = useState(false);
  const [awayDraft, setAwayDraft] = useState(me.awayNote || '');
  const [message, setMessage] = useState(me.message || '');
  const [quickError, setQuickError] = useState('');
  const [miniView, setMiniView] = useState('noise');
  const [modal, setModal] = useState(null);
  const [settingsKey, setSettingsKey] = useState(0);
  const [pendingFocus, setPendingFocus] = useState(null);
  const [obScreen, setObScreen] = useState(me.complete ? null : 'welcome');
  const [obChar, setObChar] = useState(false);
  const [obName, setObName] = useState(me.name || '');
  const [obJob, setObJob] = useState(me.role || JOB_OPTIONS[0]);
  const [obRank, setObRank] = useState(RANK_OPTIONS[0]);
  const [obBusy, setObBusy] = useState(false);
  // Keep the job title the invitation already carries, even if it is not one of
  // the reference design's designer roles.
  const obJobs = me.role && !JOB_OPTIONS.includes(me.role) ? [me.role, ...JOB_OPTIONS] : JOB_OPTIONS;
  const mapRef = useRef(null);

  // The reference map reads the current floor from the session object while it
  // renders, so keep it in step with the floor picker.
  SESSION.floor = floor;

  useEffect(() => { setMessage(me.message || ''); }, [me.id, me.message]);
  useEffect(() => { setAwayDraft(me.awayNote || ''); }, [me.id, me.awayNote]);
  useEffect(() => { if (me.complete) setObScreen(null); }, [me.complete]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = e => { if (!e.target.closest('.hub-menu-wrap')) setMenuOpen(false); };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [menuOpen]);

  useEffect(() => {
    if (!pendingFocus) return;
    const timer = setTimeout(() => {
      mapRef.current?.focusPerson(pendingFocus);
      setPendingFocus(null);
    }, 0);
    return () => clearTimeout(timer);
  }, [pendingFocus, floor]);

  const clockedIn = me.status !== 'offline';
  const list = people.filter(u => (filter === 'all' || u.floor === me.floor) && `${u.name} ${u.role}`.includes(query));
  const sense = SENSES.find(s => s.key === miniView) || SENSES[0];
  const cardUser = modal?.kind === 'card' ? (people.find(u => u.id === modal.id) || (modal.id === me.id ? me : null)) : null;

  async function setStatus(status, reason = '') {
    try {
      await api.status(status, reason);
      await refresh();
      toast('동료에게 내 상태를 알려줬어요.');
    } catch (error) {
      toast(error.message);
    }
  }

  async function toggleAway() {
    try {
      if (!awayOpen && me.status !== 'away') { await api.status('away'); await refresh(); }
      else if (awayOpen && me.status === 'away') { await api.status('working'); await refresh(); }
      setAwayOpen(!awayOpen);
    } catch (error) {
      toast(error.message);
    }
  }

  async function returnSeat() {
    try {
      await api.status('working');
      await refresh();
      setAwayOpen(false);
      toast('자리로 복귀했어요.');
    } catch (error) {
      toast(error.message);
    }
  }

  function changeSeat() {
    setMenuOpen(false);
    mapRef.current?.startPickSeat();
  }

  async function saveAway(event) {
    event.preventDefault();
    try {
      await api.awayNote(awayDraft || '');
      await refresh();
      toast(awayDraft.trim() ? '자리 비움 상세를 남겼어요.' : '자리 비움 상세를 지웠어요.');
    } catch (error) {
      toast(error.message);
    }
  }

  async function saveMessage(text) {
    const preset = QUICK_STATUS.find(([, t]) => t === text);
    await api.message(text, preset ? preset[0] : '');
    await refresh();
  }

  async function submitMessage(event) {
    event.preventDefault();
    if (charCount(message) > 20) {
      setQuickError('상태 메시지는 20자까지 입력할 수 있어요.');
      return;
    }
    setQuickError('');
    try {
      await saveMessage(message.trim());
      toast(message.trim() ? '상태 메시지를 바꿨어요.' : '상태 메시지를 지웠어요.');
    } catch (error) {
      setQuickError(error.message);
    }
  }

  async function pickQuick(key) {
    const [, text] = QUICK_STATUS.find(([k]) => k === key);
    try {
      if (me.message === text) {
        await saveMessage('');
        toast('상태 메시지를 지웠어요.');
      } else {
        await saveMessage(text);
        toast(`상태 메시지를 바꿨어요 · ${text}`);
      }
    } catch (error) {
      setQuickError(error.message);
    }
  }

  async function saveSense(key, level) {
    try {
      try {
        await api.senses({ ...todaySenses(me), [key]: level });
      } catch (error) {
        if (me.status !== 'offline') throw error;
        await api.status('working');
        await api.senses({ ...todaySenses(me), [key]: level });
      }
      if (HEATMAP_VIEWS.some(v => v.key === key)) setMiniView(key);
      await refresh();
      toast('지금의 감각을 공유했어요.');
    } catch (error) {
      toast(error.message);
      await refresh();
    }
  }

  function focusUser(user) {
    setCountPop(null);
    if (user.floor !== floor) {
      setFloor(user.floor);
      setPendingFocus(user.id);
    } else {
      mapRef.current?.focusPerson(user.id);
    }
  }

  async function onMapHost(type, payload = {}) {
    if (type === 'card') setModal({ kind: 'card', id: payload.id });
    else if (type === 'expand') setModal({ kind: 'map-expand' });
    else if (type === 'saved') await refresh();
  }

  function openSettings() {
    setMenuOpen(false);
    setSettingsKey(k => k + 1);
    setModal({ kind: 'settings' });
  }

  // First entry: save name/job, customize the character, then pick a seat.
  async function saveBasicInfo(event) {
    event.preventDefault();
    if (!obName.trim()) { toast('이름을 입력해 주세요.'); return; }
    setObBusy(true);
    try {
      await api.completeOnboarding({ name: obName.trim(), role: obJob });
      await refresh();
      setObScreen(null);
      setObChar(true);
    } catch (error) {
      toast(error.message);
    } finally {
      setObBusy(false);
    }
  }

  // The character editor hands back here: save -> seat picker, previous -> info.
  async function onCharHost(type) {
    if (type === 'saved') {
      setObChar(false);
      await refresh();
      setTimeout(() => mapRef.current?.startPickSeat('onboard'), 0);
    } else if (type === 'close') {
      setObChar(false);
      setObScreen('info');
    }
  }

  const mapProps = {
    mode: 'map', me, people, floor, version, onHost: onMapHost, ref: mapRef,
  };

  return (
    <div className="hub">
      <header className="hub-top">
        <Brand onNavigate={navigate} />
        <label className="hub-pill hub-floor">
          <span className="sr-only">사무실 층</span>
          <select id="floor" value={floor} onChange={e => { setFloor(Number(e.target.value)); setMenuOpen(false); }}>
            {FLOOR_LIST().map(f => <option key={f} value={f}>{FLOOR_TEAMS[f] ? `${f}층 · ${FLOOR_TEAMS[f]}` : `${f}층`}</option>)}
          </select>
        </label>
        <div className="hub-pill hub-counts" id="hub-counts" aria-label="근무 현황">
          {[['all', '전체'], ['working', '출근'], ['away', '자리 비움'], ['offline', '퇴근']].map(([key, label]) => {
            const group = key === 'all' ? people : people.filter(u => u.status === key);
            return (
              <span key={key} className="hub-count" onMouseEnter={() => setCountPop(key)} onMouseLeave={() => setCountPop(null)}>
                <i className={`dot ${key}`} />{label} <b>{group.length}</b>
                {countPop === key && (
                  <div className="hub-count-pop" role="dialog" aria-label={`${label} 명단`}>
                    <div className="hub-count-pop-title">{label} · {group.length}명</div>
                    {group.map(u => {
                      const info = statusInfo(u);
                      return (
                        <button key={u.id} type="button" className="hub-count-person" onClick={() => focusUser(u)}>
                          <span className={`hub-count-avatar ${u.status}`}><FaceAvatar user={u} size={30} /></span>
                          <span className="hub-count-copy">
                            <strong>{u.name}{u.id === me.id ? ' (나)' : ''}</strong>
                            <small>{u.status === 'offline' ? `퇴근 · ${u.role}` : u.status === 'away' ? `${info.text} · ${u.floor}층 ${u.referenceSeat || u.seat}` : `${u.floor}층 ${u.referenceSeat || u.seat}`}</small>
                          </span>
                          <i className={`dot ${u.status === 'offline' ? 'offline' : u.status === 'away' ? 'away' : 'working'}`} />
                        </button>
                      );
                    })}
                    {!group.length && <span className="hub-count-empty">아무도 없어요</span>}
                  </div>
                )}
              </span>
            );
          })}
        </div>
        <div className="hub-top-right">
          <button className="hub-icon hub-bell" onClick={openSettings} aria-label="알림"><Icon name="bell" size={24} /></button>
          <div className="hub-menu-wrap">
            <button className="hub-me" onClick={() => setMenuOpen(!menuOpen)} aria-haspopup="menu" aria-expanded={menuOpen}>
              <FaceAvatar user={me} size={30} />
              <span><strong>{me.name}</strong><small>{me.role}</small></span>
              <Icon name="chevron" size={16} />
            </button>
            {menuOpen && (
              <div className="hub-menu" role="menu">
                <button role="menuitem" onClick={() => { setMenuOpen(false); navigate('/profile'); }}><Icon name="edit" size={16} />프로필 수정</button>
                <button role="menuitem" onClick={() => { setMenuOpen(false); navigate('/character'); }}><Icon name="spark" size={16} />캐릭터 꾸미기</button>
                <button role="menuitem" onClick={openSettings}><Icon name="bell" size={16} />설정 · 알림</button>
                <button role="menuitem" onClick={() => { setMenuOpen(false); onLogout(); }}><Icon name="logout" size={16} />로그아웃</button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="hub-main">
        <section className="hub-map reference-map-host" aria-label={`${floor}층 사무실 지도`}>
          <MapView key={`map-${floor}`} {...mapProps} />
        </section>

        <aside className="hub-side" aria-label="동료 목록">
          <div className="hub-side-head">
            <h2>동료 목록 <span id="colleague-count">({list.length})</span></h2>
            <div className="hub-scope" role="group" aria-label="명단 범위">
              <button type="button" className={filter === 'team' ? 'on' : ''} onClick={() => setFilter('team')} aria-pressed={filter === 'team'}>내 팀</button>
              <button type="button" className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')} aria-pressed={filter === 'all'}>전체</button>
            </div>
          </div>
          <label className="hub-search">
            <Icon name="search" size={17} />
            <span className="sr-only">동료 검색</span>
            <input id="search" type="search" placeholder="이름, 직책으로 찾기" value={query} onChange={e => setQuery(e.target.value)} />
          </label>
          <div id="colleague-list" className="hub-list">
            {list.length ? list.map(u => {
              const info = statusInfo(u);
              const att = u.status === 'offline' ? { icon: 'off', text: '퇴근', tone: 'offline' }
                : u.status === 'away' ? { icon: 'away', text: '자리 비움', tone: 'away' }
                  : { icon: 'work', text: '출근', tone: 'working' };
              // Attendance lives in the pill on the right; the line under the name
              // only carries the person's own status message.
              const note = u.status === 'offline' ? '' : u.status === 'away' ? (u.awayNote || '') : (u.message || '');
              return (
                <div key={u.id} className={`hub-row ${u.id === me.id ? 'selected' : ''}`}>
                  <button className="hub-row-main" onClick={() => focusUser(u)}>
                    <span className={`hub-row-avatar ${u.status}`}><FaceAvatar user={u} size={40} /></span>
                    <span className="hub-row-name">
                      <strong>{u.name}{u.id === me.id && <> <em>나</em></>}</strong>
                      {note && (
                        <small className={`hub-row-line ${u.status === 'working' && info.tone === 'alert' ? 'alert' : ''}`}><Icon name={u.status === 'away' ? 'away' : info.icon} size={13} /><span>{note}</span></small>
                      )}
                    </span>
                    <span className={`hub-row-status ${att.tone}`}><Icon name={att.icon} size={14} />{att.text}</span>
                  </button>
                  <button className="hub-more" onClick={() => setModal({ kind: 'card', id: u.id })} aria-label={`${u.name} 감각 카드 자세히 보기`}><Icon name="more" size={18} /></button>
                </div>
              );
            }) : (
              <div className="empty-state">
                <Icon name="search" size={28} />
                <strong>동료를 찾지 못했어요</strong>
                <p>이름이나 검색 조건을 바꿔 보세요.</p>
              </div>
            )}
          </div>
        </aside>

        <section className="hub-bottom">
          <article className="hub-card hub-profile" id="hub-profile">
            <div className="hub-profile-head">
              <span className="hub-profile-art"><FaceAvatar user={me} size={72} /></span>
              <div>
                <h2>{me.name}</h2>
                <p>{me.role}</p>
                <p className="hub-loc"><Icon name="pin" size={14} />{me.floor}층 {me.seat}</p>
              </div>
              <div className="hub-profile-actions">
                <button type="button" className="hub-seat-change" onClick={changeSeat} aria-label="자리 변경" title="자리 변경">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" /></svg>
                </button>
              </div>
            </div>
            <div className={`hub-clock ${me.status === 'away' ? 'idle' : ''}`} role="group" aria-label="근무 상태">
              <button data-status="working" className={me.status === 'working' ? 'active' : ''} aria-pressed={me.status === 'working'} onClick={() => setStatus('working')}><Icon name="check" size={15} />출근</button>
              <button data-status="offline" className={clockedIn ? '' : 'active'} aria-pressed={!clockedIn} onClick={() => setStatus('offline')}><Icon name="logout" size={15} />퇴근</button>
            </div>
            <div className="hub-away-row" role="group" aria-label="자리 비움">
              <button type="button" onClick={me.status === 'away' ? returnSeat : toggleAway} disabled={!clockedIn} className={me.status === 'away' ? 'active' : ''} aria-pressed={me.status === 'away'} aria-expanded={me.status === 'away' ? undefined : awayOpen} aria-controls={me.status === 'away' ? undefined : 'away-form'}><Icon name={me.status === 'away' ? 'check' : 'away'} size={15} />{me.status === 'away' ? '복귀' : '자리 비움'}</button>
            </div>
            {awayOpen ? (
              <form id="away-form" className="hub-away-note" onSubmit={saveAway}>
                <label className="sr-only" htmlFor="away-input">자리 비움 사유</label>
                <input id="away-input" name="note" value={awayDraft} onChange={e => setAwayDraft(e.target.value)} maxLength={20} placeholder="사유 입력 (예: 회의, 16시 복귀)" autoComplete="off" enterKeyHint="done" />
                <button type="submit" aria-label="자리 비움 사유 저장"><Icon name="check" size={16} /></button>
              </form>
            ) : <div className="hub-away-note-slot" aria-hidden="true" />}
          </article>

          <article className="hub-card hub-info" id="hub-info">
            <h2 className="hub-info-title">감각 정보</h2>
            <div className="hub-info-grid">
              <section className="hub-sense-col">
                <h3>현재 내 감각 상태</h3>
                <div className="hub-senses">
                  {SENSES.map(s => {
                    const v = todaySenses(me)[s.key];
                    return (
                      <div key={s.key} className="hub-sense" style={{ '--sense': s.color }}>
                        <span className="hub-sense-name"><Icon name={s.icon} size={24} />{s.name}</span>
                        <span className="hub-dots" role="radiogroup" aria-label={s.name}>
                          {[1, 2, 3, 4, 5].map(n => (
                            <button key={n} type="button" className={`hub-dot ${v && n <= v ? 'on' : ''}`} onClick={() => saveSense(s.key, n)} role="radio" aria-checked={v === n} aria-label={`${s.name} ${n}단계 · ${s.labels[n - 1]}`} />
                          ))}
                        </span>
                        <b className={v >= 4 ? 'high' : ''}>{v ? s.labels[v - 1] : '미공유'}</b>
                      </div>
                    );
                  })}
                </div>
                {!clockedIn && <p className="hub-note">퇴근 상태예요. 감각을 선택하면 출근 상태로 바뀌며 공유돼요.</p>}
              </section>
              <section className="hub-quick-col">
                <h3>빠른 상태 설정</h3>
                <div className="hub-quick" role="group" aria-label="빠른 상태">
                  {QUICK_STATUS.map(([key, text]) => {
                    const on = me.message === text;
                    return (
                      <button key={key} type="button" onClick={() => pickQuick(key)} className={on ? 'active' : ''} title={text} aria-label={text} aria-pressed={on}>
                        <Icon name={key} size={24} />
                      </button>
                    );
                  })}
                </div>
                <label className="hub-quick-label" htmlFor="quick-input">상태 메시지</label>
                <form id="quick-form" className="hub-quick-input" onSubmit={submitMessage}>
                  {me.messageIcon && <span className="hub-quick-icon"><Icon name={me.messageIcon} size={18} /></span>}
                  <input id="quick-input" name="message" value={message} onChange={e => setMessage(e.target.value)} placeholder="상태 메시지를 입력하고 Enter" autoComplete="off" enterKeyHint="done" />
                  <span id="quick-count" className={charCount(message) > 20 ? 'over' : ''}>{charCount(message)}/20</span>
                </form>
                <p className="form-error" role="alert">{quickError}</p>
              </section>
            </div>
          </article>

          <article className="hub-card hub-mini" id="hub-mini">
            <div className="hub-mini-head">
              <h3>감각 지도</h3>
              <div className="hub-mini-tools">
                <label className="hub-select">
                  <span className="sr-only">층 선택</span>
                  <select id="mini-floor" value={floor} onChange={e => setFloor(Number(e.target.value))}>
                    {FLOOR_LIST().map(f => <option key={f} value={f}>{f}층</option>)}
                  </select>
                </label>
                <label className="hub-select">
                  <span className="sr-only">감각 선택</span>
                  <select id="mini-sense" value={miniView} onChange={e => setMiniView(e.target.value)}>
                    {HEATMAP_VIEWS.map(v => <option key={v.key} value={v.key}>{SENSES.find(x => x.key === v.key).name}</option>)}
                  </select>
                </label>
                <button className="hub-icon small" onClick={() => setModal({ kind: 'mini' })} aria-label="감각 지도 크게 보기"><Icon name="expand" size={17} /></button>
              </div>
            </div>
            <div className="hub-mini-canvas" role="img" aria-label={`${floor}층 ${sense.name} 감각 지도`}>
              <MiniView key={`mini-${floor}`} mode="map" me={me} people={people} floor={floor} version={version} view={miniView} />
            </div>
            <div className="hub-legend">
              <span>{sense.labels[0]}</span>
              <i style={{ background: `linear-gradient(90deg,${HEAT_COLORS.join(',')})` }} />
              <span>{sense.labels[4]}</span>
            </div>
          </article>
        </section>
      </main>

      {modal?.kind === 'mini' && (
        <Modal title={`${floor}층 ${sense.name} 감각 지도`} kind="mini" wide onClose={() => setModal(null)}>
          <div className="hub-mini-large">
            <div className="hub-mini-canvas" role="img" aria-label={`${floor}층 ${sense.name} 감각 지도`}>
              <MiniView key={`mini-expand-${floor}`} mode="map" me={me} people={people} floor={floor} version={version} view={miniView} />
            </div>
          </div>
        </Modal>
      )}
      {modal?.kind === 'map-expand' && (
        <Modal title="사무실 지도 크게 보기" kind="map-expand" full onClose={() => setModal(null)}>
          <div className="map-expand">
            <MapView key={`expand-${floor}`} {...mapProps} ref={null} />
          </div>
        </Modal>
      )}
      {modal?.kind === 'card' && cardUser && (
        <SenseCard
          user={cardUser}
          me={me}
          api={api}
          refresh={refresh}
          toast={toast}
          onClose={() => setModal(null)}
          onEditCharacter={() => navigate('/character')}
        />
      )}
      {modal?.kind === 'settings' && (
        <SettingsView
          key={`settings-${settingsKey}`}
          mode="settings"
          me={me}
          people={people}
          floor={floor}
          version={version}
          onHost={(type) => { if (type === 'close') setModal(null); }}
        />
      )}

      {obScreen === 'welcome' && (
        <div className="ob-backdrop">
          <div className="ob-card ob-welcome">
            <div className="ob-heads">
              {people.filter(u => u.id !== me.id && u.complete).slice(0, 5).map(u => (
                <span key={u.id} className="ob-head"><FaceAvatar user={u} size={54} /></span>
              ))}
            </div>
            <span className="ob-place">{COMPANY} · {me.floor}층 사무실</span>
            <h2>안녕하세요, {me.name}님!</h2>
            <p>동료 {people.filter(u => u.id !== me.id && u.complete).length}명이 이미 사무실에 있어요.<br />프로필을 만들고 내 자리에 앉아볼까요?</p>
            <button type="button" className="ob-primary" onClick={() => setObScreen('info')}>프로필 설정하기</button>
          </div>
        </div>
      )}
      {obScreen === 'info' && (
        <div className="ob-backdrop">
          <form className="ob-card ob-info" onSubmit={saveBasicInfo}>
            <div className="ob-steps">
              <span className="ob-step on"><b>1</b><span>기본 정보</span></span>
              <i />
              <span className="ob-step"><b>2</b><span>캐릭터</span></span>
              <i />
              <span className="ob-step"><b>3</b><span>내 자리</span></span>
            </div>
            <div className="ob-title">기본 정보</div>
            <label className="ob-field">
              <span>이름<small>초대장에서 가져왔어요</small></span>
              <input value={obName} onChange={e => setObName(e.target.value)} maxLength={40} autoComplete="name" />
            </label>
            <div className="ob-row">
              <label className="ob-field">
                <span>직무</span>
                <select value={obJob} onChange={e => setObJob(e.target.value)}>
                  {obJobs.map(option => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label className="ob-field">
                <span>직책 (선택)</span>
                <select value={obRank} onChange={e => setObRank(e.target.value)}>
                  {RANK_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
            </div>
            <button type="submit" className="ob-primary" disabled={obBusy}>확인</button>
          </form>
        </div>
      )}
      {obChar && (
        <EditorView
          from="onboard"
          mode="editor"
          me={me}
          people={people}
          floor={floor}
          version={version}
          onHost={onCharHost}
        />
      )}
    </div>
  );
}
