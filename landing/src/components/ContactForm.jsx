import { useRef, useState } from 'react';
import { inquiryMailto, validateInquiry } from '../inquiry.js';
const endpoint = import.meta.env.VITE_CONTACT_ENDPOINT;
export default function ContactForm() {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [draft, setDraft] = useState('');
  const statusRef = useRef(null);
  function announce(message) {
    setStatus(message);
    requestAnimationFrame(() => statusRef.current?.focus());
  }
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setDraft('');
    const data = new FormData(event.currentTarget);
    const fields = Object.fromEntries(['company','name','email','size','msg'].map(key => [key, String(data.get(key) ?? '')]));
    const error = validateInquiry(fields, file);
    if (error) { announce(error); return; }
    if (!endpoint) {
      setDraft(inquiryMailto(fields));
      announce('문의 메일이 준비됐어요. 아래 버튼으로 메일 앱을 열어 전송을 완료해 주세요.');
      return;
    }
    if (file) data.set('attachment', file);
    else data.delete('attachment');
    setBusy(true);
    setStatus('문의를 보내고 있어요…');
    try {
      const response = await fetch(endpoint, { method: 'POST', body: data, signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error('문의 전송 실패');
      setSent(true);
      announce('문의가 접수됐어요. 입력하신 업무 이메일로 연락드릴게요.');
    } catch {
      announce('문의를 보내지 못했어요. 잠시 후 다시 시도하거나 contact@senspace.io로 문의해 주세요.');
    } finally { setBusy(false); }
  }
  return <>
    {!sent && <form className="contact-form" onSubmit={submit} aria-busy={busy}>
      <div className="contact-fields">
        <label>회사명<input name="company" autoComplete="organization" placeholder="센스컴퍼니" maxLength={120} required /></label>
        <label>담당자 이름<input name="name" autoComplete="name" placeholder="홍길동" maxLength={80} required /></label>
        <label>업무 이메일<input name="email" type="email" autoComplete="email" placeholder="name@company.com" maxLength={254} required /></label>
        <label>사용 인원<select name="size" defaultValue="50~200명">{['50명 이하','50~200명','200~500명','500명 이상'].map(size => <option key={size}>{size}</option>)}</select></label>
      </div>
      <label className="file-drop" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); if (event.dataTransfer.files[0]) { setFile(event.dataTransfer.files[0]); setDraft(''); } }}>
        <span className="upload-symbol" aria-hidden="true">↑</span>
        <span><strong>{file ? file.name : '파일을 끌어오거나 눌러서 올려주세요'}</strong><small>평면도·배치도 첨부 (선택, 최대 10MB)</small></span>
        <input name="attachment" type="file" aria-label="평면도·배치도 첨부" onChange={event => { setFile(event.target.files[0] ?? null); setDraft(''); }} />
      </label>
      {file && <button type="button" className="remove-file" onClick={event => { setFile(null); event.currentTarget.form.elements.attachment.value=''; }}>첨부 취소</button>}
      <label>문의 내용<textarea name="msg" rows={3} maxLength={5000} placeholder="층 수, 도입 희망 시기 등을 알려주세요" /></label>
      {!endpoint && <p className="form-note">문의는 메일 앱에서 직접 전송해 주세요. 첨부 자료도 메일에 함께 넣어 주세요.</p>}
      <button type="submit" className="primary-button" disabled={busy}>{busy ? '전송 중…' : '도입 문의 보내기'}</button>
    </form>}
    <p ref={statusRef} className="form-status" role="status" tabIndex={-1}>{status}</p>
    {draft && <a className="mail-draft primary-button" href={draft}>메일 앱에서 보내기</a>}
    {sent && <button className="primary-button" onClick={() => { setSent(false); setFile(null); setStatus(''); }}>새 문의 작성하기</button>}
  </>;
}
