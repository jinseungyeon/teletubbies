import React, { useEffect, useState } from 'react';
import { currentSenses, SENSITIVITY } from '../data.js';
import { look, faceAvatar } from './helpers.js';

const SENSI = [
  { key: 'visual', label: '시각 민감도', icon: 'eye', color: '#4a8fe0' },
  { key: 'auditory', label: '청각 민감도', icon: 'ear', color: '#e5534b' },
  { key: 'olfactory', label: '후각 민감도', icon: 'nose', color: '#5fb34f' },
];
const SENSI_TXT = ['', '낮음', '조금 낮음', '보통', '높음', '매우 높음'];
const SENSES = [
  { key: 'noise', label: '소음', icon: 'noise', color: '#e5534b', lo: '조용함', hi: '시끄러움' },
  { key: 'temperature', label: '온도', icon: 'temp', color: '#f08a3c', lo: '추움', hi: '더움' },
  { key: 'humidity', label: '습도', icon: 'humid', color: '#4a8fe0', lo: '건조', hi: '습함' },
  { key: 'smell', label: '냄새', icon: 'smell', color: '#e0a020', lo: '약함', hi: '강함' },
  { key: 'lighting', label: '조명 지수', icon: 'sun', color: '#c9a44c', lo: '어두움', hi: '밝음' },
  { key: 'crowding', label: '혼잡도', icon: 'crowd', color: '#4a4e72', lo: '여유', hi: '붐빔' },
];
const pngIcon = (name, h, w) => <img src={`/icons/${name}.png`} alt="" aria-hidden="true" style={{ height: h, width: w, objectFit: 'contain', imageRendering: 'pixelated' }} />;

export default function SenseCard({ user, me, api, refresh, toast, onClose, onEditCharacter }) {
  const own = user.id === me.id;
  const [description, setDescription] = useState(user.description || '');
  useEffect(() => { setDescription(user.description || ''); }, [user.id, user.description]);
  const senses = currentSenses(user);
  const st = user.status === 'working'
    ? { full: '출근 · 근무 중', color: '#2f8a52', bg: '#e3f3e8', dot: '#3fae6a' }
    : user.status === 'away'
      ? { full: `자리 비움 · ${user.reason || '잠깐'}`, color: '#b8701a', bg: '#fdf0da', dot: '#f0a93b' }
      : { full: '퇴근', color: '#6e7190', bg: '#ecebf1', dot: '#a5a8bd' };
  const title = own ? '나의 감각 카드' : `${user.name}님의 감각 카드`;

  async function setSensitivity(key, level) {
    if (!own) return;
    try {
      await api.profile({ ...me, sensitivity: { ...me.sensitivity, [key]: level } });
      await refresh();
      toast('평소 민감도를 바꿨어요.');
    } catch (e) { toast(e.message); }
  }
  async function saveDescription() {
    if (!own || description === (me.description || '')) return;
    try {
      await api.profile({ ...me, description });
      await refresh();
      toast(description.trim() ? '추가 설명을 저장했어요.' : '추가 설명을 지웠어요.');
    } catch (e) { toast(e.message); }
  }

  return (
    <div className="ssc-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }} style={{ position: 'fixed', inset: 0, background: 'rgba(30,31,60,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 24 }}>
      <section role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} style={{ width: 'min(780px,100%)', maxHeight: 'calc(100dvh - 48px)', overflow: 'auto', background: '#fbf7ef', borderRadius: 22, padding: 14, boxSizing: 'border-box', boxShadow: '0 0 0 2px #3b3e6e,inset 0 1px 0 #fff,0 30px 70px -20px rgba(0,0,0,.7)', display: 'grid', gridTemplateColumns: '220px minmax(0,1fr)', gap: 14, position: 'relative' }}>
        <button type="button" onClick={onClose} aria-label="닫기" style={{ position: 'absolute', right: 14, top: 14, width: 34, height: 34, borderRadius: 10, border: '1.5px solid #e2d6c2', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4a4560', padding: 0 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
        <div style={{ background: '#f3ecdf', borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ height: 180, borderRadius: 12, backgroundColor: '#fbf8f2', backgroundImage: 'linear-gradient(#efe8da 1px,transparent 1px),linear-gradient(90deg,#efe8da 1px,transparent 1px)', backgroundSize: '10px 10px', border: '1.5px solid #e7dcc8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: faceAvatar(look(user), 120) }} />
          </div>
          <div style={{ fontSize: 21, fontWeight: 800 }}>{user.name}</div>
          <div style={{ fontSize: 13, color: '#6e6a84', marginTop: -6 }}>{user.role} · {user.floor}F {user.seat}</div>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, alignSelf: 'flex-start', padding: '6px 11px', borderRadius: 9, background: st.bg, color: st.color, fontSize: 13, fontWeight: 800 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: st.dot, flexShrink: 0 }} />{st.full}</span>
          {own && <button type="button" onClick={onEditCharacter} style={{ marginTop: 'auto', height: 40, borderRadius: 11, background: '#fff', border: '1.5px solid #e2d6c2', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', boxShadow: 'inset 0 -3px 0 #efe6d5' }}>캐릭터 수정</button>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '8px 4px 4px' }}>
          <div style={{ fontSize: 17, fontWeight: 800, paddingRight: 44 }}>{title}</div>
          <div style={{ background: '#fff', border: '1px solid #ece2cf', borderRadius: 14, padding: '6px 16px', boxShadow: '0 2px 0 #ece2cf' }}>
            {SENSI.map(se => {
              const v = user.sensitivity?.[se.key] || 3;
              return (
                <div key={se.key} style={{ display: 'flex', alignItems: 'center', gap: 12, height: 40 }}>
                  {pngIcon(se.icon, 17, 21)}
                  <span style={{ width: 84, fontSize: 13.5, fontWeight: 700, color: '#4a4560' }}>{se.label}</span>
                  <span style={{ display: 'flex', gap: 7 }}>
                    {[1, 2, 3, 4, 5].map(n => own ? (
                      <button key={n} type="button" onClick={() => setSensitivity(se.key, n)} role="radio" aria-checked={v === n} aria-label={`${se.label} ${n}단계 · ${SENSI_TXT[n]}`} style={{ width: 18, height: 18, borderRadius: 5, border: 'none', padding: 0, cursor: 'pointer', background: n <= v ? se.color : '#ebe3d3', boxShadow: `inset 0 -2px 0 ${n <= v ? 'rgba(0,0,0,.2)' : '#dcd1bd'}` }} />
                    ) : (
                      <span key={n} aria-hidden="true" style={{ width: 18, height: 18, borderRadius: 5, background: n <= v ? se.color : '#ebe3d3', boxShadow: `inset 0 -2px 0 ${n <= v ? 'rgba(0,0,0,.2)' : '#dcd1bd'}` }} />
                    ))}
                  </span>
                  <span style={{ fontSize: 12.5, fontWeight: 800, color: v >= 4 ? se.color : '#8a8499' }}>{SENSI_TXT[v]}</span>
                </div>
              );
            })}
          </div>
          <div style={{ background: '#fff', border: '1px solid #ece2cf', borderRadius: 14, padding: '12px 16px', boxShadow: '0 2px 0 #ece2cf', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 13.5, fontWeight: 800 }}>추가 설명</span>
            {own
              ? <textarea value={description} onChange={e => setDescription(e.target.value)} onBlur={saveDescription} rows={2} maxLength={300} style={{ border: '1.5px solid #e2d6c2', borderRadius: 10, padding: '9px 12px', fontSize: 13.5, lineHeight: 1.55, outline: 'none', background: '#fffdf9', resize: 'none', fontFamily: 'inherit' }} />
              : <div style={{ fontSize: 13.5, lineHeight: 1.6, color: '#4a4560', whiteSpace: 'pre-line' }}>{user.description || '아직 추가 설명이 없어요.'}</div>}
          </div>
          <div style={{ background: '#fff', border: '1px solid #ece2cf', borderRadius: 14, padding: '12px 16px', boxShadow: '0 2px 0 #ece2cf', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 22px' }}>
            {SENSES.map(se => {
              const v = Number(senses[se.key]) || 0;
              return (
                <div key={se.key} style={{ display: 'flex', alignItems: 'center', gap: 8, height: 24 }}>
                  {pngIcon(se.icon, 14, 17)}
                  <span style={{ width: 56, fontSize: 12.5, fontWeight: 600, color: '#4a4560' }}>{se.label}</span>
                  <span style={{ flex: 1, height: 6, borderRadius: 3, background: '#ece4d5', position: 'relative', overflow: 'hidden' }}><span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${v * 20}%`, background: se.color, borderRadius: 3 }} /></span>
                  <span style={{ width: 50, textAlign: 'right', fontSize: 11.5, fontWeight: 800, color: v >= 4 ? se.color : '#8a8499' }}>{v ? (v <= 2 ? se.lo : se.hi) : '미공유'}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
