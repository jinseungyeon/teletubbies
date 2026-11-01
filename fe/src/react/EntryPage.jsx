import React, { useState } from 'react';

// Accepts a full invite URL (…/enter/<token>, …?t=<token>) or a bare token.
function parseToken(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const path = text.match(/\/enter\/([^/?#\s]+)/);
  if (path) return decodeURIComponent(path[1]);
  const query = text.match(/[?&]t=([^&\s#]+)/);
  if (query) return decodeURIComponent(query[1]);
  return text;
}

// Shown when nobody is signed in. Accounts are opened by personal links, so
// there is no login form; the demo button walks the same invite flow locally.
export default function EntryPage({ error, onEnter, onDemo }) {
  const [link, setLink] = useState('');
  const [localError, setLocalError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    const token = parseToken(link);
    if (!token) {
      setLocalError('초대 링크를 입력해 주세요.');
      return;
    }
    setLocalError('');
    setBusy(true);
    try {
      await onEnter(token);
    } finally {
      setBusy(false);
    }
  }

  const shown = localError || error;

  return (
    <main className="entry-page">
      <section className="entry-card">
        <span className="entry-brand"><img src="/assets/home/wordmark.png" alt="SENSPACE" /></span>
        <span className="entry-tag">개인 초대 링크 입장</span>
        <h1>초대 링크로<br />입장해 주세요</h1>
        <p>회사에서 받은 개인 링크를 열면 내 계정으로 바로 들어갈 수 있어요. 링크는 다른 사람과 공유하지 마세요.</p>
        <form className="entry-form" onSubmit={submit}>
          <label className="sr-only" htmlFor="entry-link">초대 링크</label>
          <input
            id="entry-link"
            type="text"
            value={link}
            onChange={e => { setLink(e.target.value); setLocalError(''); }}
            placeholder="초대 링크 또는 코드를 붙여넣어 주세요"
            autoComplete="off"
            spellCheck={false}
          />
          <button type="submit" className="ob-primary" disabled={busy}>입장하기</button>
        </form>
        {shown && <p className="entry-error" role="alert">{shown}</p>}
        <div className="entry-demo">
          <span>링크가 없다면</span>
          <button type="button" onClick={onDemo}>데모 링크로 둘러보기</button>
        </div>
      </section>
    </main>
  );
}
