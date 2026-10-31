import React, { useEffect, useMemo, useState } from 'react';
import { COMPANY, FLOORS, MAP_SIZE, SEATS, SENSITIVITY, TRAITS } from '../data.js';
import { SKINS } from '../character.js';
import { avatar, officeSVG } from '../map.js';
import { Brand, Raw, Icon } from './Shared.jsx';
import { look } from './helpers.js';

const clone = value => JSON.parse(JSON.stringify(value));
const seatPos = (seat, dy = 28) => ({ left: `${seat.x / MAP_SIZE.width * 100}%`, top: `${(seat.y + dy) / MAP_SIZE.height * 100}%` });
const SENSI_COLORS = ['#7b94bb', '#cd8294', '#79a78a'];

function ChoiceRow({ name, label, icon, labels, value, color, onChange }) {
  return (
    <fieldset className="choice-row" style={{ '--sense': color || '#8b7cb0' }}>
      <legend><Icon name={icon} size={18} />{label}</legend>
      <div className="five-options">
        {labels.map((label, i) => (
          <label className="choice" key={label}>
            <input type="radio" name={name} value={i + 1} checked={value === i + 1} onChange={() => onChange(i + 1)} />
            <span><i /><small>{label}</small></span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export default function ProfilePage({ api, me, people, onboarding, profileStash, onConsumeStash, navigate, toast, onLogout, onEditCharacter }) {
  const initial = useMemo(() => {
    const base = profileStash ? { ...profileStash, character: me.character } : clone(me);
    return base;
  }, []);
  const [draft, setDraft] = useState(initial);
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');

  useEffect(() => { onConsumeStash(); }, []);

  const set = patch => setDraft(current => ({ ...current, ...patch }));
  const setSensitivity = (key, level) => setDraft(current => ({ ...current, sensitivity: { ...current.sensitivity, [key]: level } }));

  const skin = me.character?.skin ? SKINS.find(s => s.key === me.character.skin) : null;

  async function submit(event) {
    event.preventDefault();
    setError('');
    try {
      if (onboarding && step === 1) {
        if (!draft.seat) throw new Error('지도에서 내 자리를 선택해 주세요.');
        setStep(2);
        window.scrollTo(0, 0);
        return;
      }
      await api.profile({ ...draft, floor: Number(draft.floor), avatar: Number(draft.avatar) });
      await navigate('/office');
      toast('나의 프로필을 저장했어요.');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="settings-page">
      <header className="topbar">
        <Brand onNavigate={navigate} />
        <span className="company">{COMPANY}</span>
        <div className="topbar-right">
          <span className="demo-label">LOCAL DEMO</span>
          {!onboarding && (
            <button className="text-button" onClick={() => navigate('/office')}>사무실로 돌아가기 <Icon name="arrow" size={16} /></button>
          )}
        </div>
      </header>
      <main className="settings-main">
        <div className="settings-heading">
          <span className="eyebrow">{onboarding ? 'MAKE YOURSELF AT HOME' : 'MY LITTLE PROFILE'}</span>
          <h1>{onboarding ? '우리 사무실에 오신 걸 환영해요' : '나를 조금 더 알아가기'}</h1>
          <p className="muted">{onboarding ? '내 자리와 감각을 알려 주시면, 함께할 준비가 끝나요.' : '동료에게 보여줄 나의 모습과 감각을 설정해요.'}</p>
        </div>
        {onboarding && (
          <div className="steps">
            <span className={step === 1 ? 'current' : 'done'}><b>{step === 2 ? '✓' : '1'}</b>프로필과 내 자리</span>
            <i />
            <span className={step === 2 ? 'current' : ''}><b>2</b>나의 감각 소개</span>
          </div>
        )}
        <form id="profile-form" data-onboarding={String(onboarding)} onSubmit={submit}>
          <div className="settings-card">
            {(!onboarding || step === 1) && (
              <div className="profile-columns">
                <section className="profile-fields">
                  <h3><span className="section-number">01</span> 기본 정보</h3>
                  <label>이름<input name="name" value={draft.name || ''} required maxLength={30} autoComplete="name" onChange={e => set({ name: e.target.value })} /></label>
                  <label>직책<input name="role" value={draft.role || ''} required maxLength={40} placeholder="예: 프로덕트 디자이너" onChange={e => set({ role: e.target.value })} /></label>
                  <label>회사 이메일<input value={me.email || ''} disabled /></label>
                  <h3 className="avatar-title"><span className="section-number">02</span> 나를 닮은 캐릭터</h3>
                  <div className="character-summary">
                    <span className="character-summary-art"><Raw html={avatar(look(me), 46)} /></span>
                    <span><strong>{skin ? `${skin.name} 특별 스킨` : '기본 의상'}</strong><small>머리, 눈, 옷을 바꿀 수 있어요.</small></span>
                    <button type="button" className="secondary small" onClick={() => onEditCharacter(draft)}><Icon name="edit" size={15} />꾸미기</button>
                  </div>
                </section>
                <section className="seat-section">
                  <h3><span className="section-number">03</span> 내 자리 지정</h3>
                  <div className="seat-top">
                    <p>실제로 앉는 자리를 선택해 주세요.</p>
                    <select id="profile-floor" name="floor" aria-label="내 자리 층" value={draft.floor} onChange={e => set({ floor: Number(e.target.value), seat: '' })}>
                      {FLOORS.map(f => <option key={f} value={f}>{f}층</option>)}
                    </select>
                  </div>
                  <div id="seat-map">
                    <div className="seat-map-art">
                      <Raw html={officeSVG()} />
                      {SEATS.map(s => {
                        const taken = people.some(p => p.id !== me.id && p.floor === Number(draft.floor) && p.seat === s.id);
                        const chosen = draft.seat === s.id;
                        return (
                          <button
                            key={s.id}
                            type="button"
                            className={`seat-choice ${chosen ? 'chosen' : ''}`}
                            style={seatPos(s)}
                            disabled={taken}
                            aria-label={`${s.id} ${taken ? '사용 중' : '선택 가능'}`}
                            aria-pressed={chosen}
                            onClick={() => set({ seat: s.id })}
                          >{s.id}</button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="seat-legend">
                    <span><i />선택 가능</span>
                    <span><i className="occupied" />사용 중</span>
                    <span><i className="chosen" />내 자리</span>
                  </div>
                  <div className="selected-seat" id="selected-seat">
                    <Icon name="pin" size={17} />
                    {draft.seat ? `${draft.floor}층 · ${draft.seat} 자리` : '지도에서 내 자리를 선택해 주세요'}
                  </div>
                </section>
              </div>
            )}
            {!onboarding && <hr />}
            {(!onboarding || step === 2) && (
              <div className="sensitivity-form">
                <div className="intro-leaf"><Icon name="leaf" size={30} /></div>
                <h2>나를 이해하는 작은 힌트</h2>
                <p className="muted">평소 나의 감각은 어떤가요? 세 가지 모두 선택해 주세요.</p>
                {TRAITS.map((t, i) => (
                  <ChoiceRow
                    key={t.key}
                    name={t.key}
                    label={t.name + ' 민감도'}
                    icon={t.icon}
                    labels={SENSITIVITY}
                    value={draft.sensitivity?.[t.key]}
                    color={SENSI_COLORS[i]}
                    onChange={level => setSensitivity(t.key, level)}
                  />
                ))}
                <label className="description-label">추가 설명 <span className="optional">선택</span>
                  <textarea name="description" maxLength={300} rows={3} placeholder="예: 갑작스러운 큰 소리에 쉽게 놀라요." value={draft.description || ''} onChange={e => set({ description: e.target.value })} />
                  <small>동료가 나를 이해하는 데 도움이 되는 이야기를 적어 주세요.</small>
                </label>
                <div className="sharing-note"><Icon name="users" size={16} /> 입력한 정보는 같은 회사 동료에게 표시돼요.</div>
              </div>
            )}
          </div>
          <p className="form-error" role="alert">{error}</p>
          <div className="settings-actions">
            {onboarding && step === 2
              ? <button type="button" className="secondary" onClick={() => setStep(1)}>이전 단계</button>
              : !onboarding
                ? <button type="button" className="text-button" onClick={onLogout}>로그아웃</button>
                : <span>작은 배려의 시작, SENSPACE</span>}
            <button type="submit" className="primary">
              {onboarding ? (step === 1 ? '다음: 나의 감각 소개' : '우리 사무실 들어가기') : '변경 사항 저장'} <Icon name="arrow" size={18} />
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
