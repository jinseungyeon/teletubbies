export function validateInquiry(fields, file) {
  if (!fields.company.trim() || !fields.name.trim())
    return "회사명과 담당자 이름을 입력해 주세요.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim()))
    return "올바른 업무 이메일을 입력해 주세요.";
  if (file && (file.size === 0 || file.size > 10 * 1024 * 1024))
    return "첨부 파일은 0바이트보다 크고 10MB 이하여야 해요.";
  return "";
}
export function inquiryMailto(fields) {
  const subject = "[Senspace 도입 문의] " + fields.company.trim();
  const body = `회사명: ${fields.company.trim()}\n담당자: ${fields.name.trim()}\n업무 이메일: ${fields.email.trim()}\n사용 인원: ${fields.size}\n\n문의 내용:\n${fields.msg.trim()}`;
  return `mailto:contact@senspace.io?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
