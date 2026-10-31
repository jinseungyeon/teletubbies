import React, { useState } from 'react';
import { avatar } from '../map.js';

export default function AuthPage({ signup, api, onDone, onNavigate, onDemo }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      if (signup) {
        if (values.password !== values.confirm) throw new Error('비밀번호가 서로 달라요. 다시 확인해 주세요.');
        await api.signup(values);
      } else {
        await api.login(values.email);
      }
      onDone();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="reference-auth">
      <section className="reference-auth-card">
        <div className="reference-auth-hero">
          <span className="reference-wordmark">SENSPACE<span>✦</span></span>
          <span className="reference-auth-person" dangerouslySetInnerHTML={{ __html: avatar(0, 54) }} />
          <span className="reference-auth-person second" dangerouslySetInnerHTML={{ __html: avatar(3, 54) }} />
          <img src="/src/assets/furniture/workdesk.png" alt="" />
        </div>
        <div className="reference-auth-body">
          <h1>{signup ? '함께할 준비 되셨나요?' : '다시 만나 반가워요'}</h1>
          <p>서로의 감각을 이해하는 우리 팀의 사무실</p>
          <div className="reference-auth-tabs">
            <a href="/login" className={signup ? '' : 'active'} onClick={e => { e.preventDefault(); onNavigate('/login'); }}>로그인</a>
            <a href="/signup" className={signup ? 'active' : ''} onClick={e => { e.preventDefault(); onNavigate('/signup'); }}>회원가입</a>
          </div>
          <form onSubmit={submit}>
            {signup && <label>이름<input name="name" autoComplete="name" required maxLength={30} placeholder="이름을 입력해 주세요" /></label>}
            <label>회사 이메일<input type="email" name="email" autoComplete="email" required placeholder="name@company.com" /></label>
            <label>비밀번호<input type="password" name="password" autoComplete={signup ? 'new-password' : 'current-password'} required minLength={8} placeholder="8자 이상 입력해 주세요" /></label>
            {signup && <label>비밀번호 확인<input type="password" name="confirm" autoComplete="new-password" required minLength={8} placeholder="비밀번호를 다시 입력해 주세요" /></label>}
            {signup && <label>기업 초대 코드<input name="code" required placeholder="ONYU2026" /></label>}
            <p className="form-error" role="alert">{error}</p>
            <button className="primary full" type="submit" disabled={busy}>{signup ? '내 사무실 만들기' : '사무실 입장하기'}</button>
          </form>
          <button className="secondary full" type="button" onClick={onDemo} disabled={busy}>데모 사무실 둘러보기</button>
          <p className="reference-demo-note">로컬 데모 · 비밀번호는 저장하거나 인증하지 않아요.<br />초대 코드 ONYU2026</p>
        </div>
      </section>
    </main>
  );
}
