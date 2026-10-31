import test from 'node:test';
import assert from 'node:assert/strict';
import { validateInquiry, inquiryMailto } from '../src/inquiry.js';
const valid = { company:'센스 & 컴퍼니', name:'홍길동', email:'hello@example.com', size:'50~200명', msg:'2층\n11월 도입 희망' };
test('requires company, contact name and valid work email', () => {
  assert.equal(validateInquiry(valid), '');
  for (const key of ['company','name','email']) assert.ok(validateInquiry({...valid,[key]:'   '}));
  assert.ok(validateInquiry({...valid,email:'not-an-email'}));
});
test('rejects empty or oversized attachment while accepting a floor plan', () => {
  assert.ok(validateInquiry(valid,{size:0}));
  assert.ok(validateInquiry(valid,{size:10*1024*1024+1}));
  assert.equal(validateInquiry(valid,{size:1024}),'');
});
test('email draft preserves Korean text, special characters and multiline inquiry', () => {
  const url = new URL(inquiryMailto(valid));
  assert.equal(url.pathname,'contact@senspace.io');
  assert.equal(url.searchParams.get('subject'),'[Senspace 도입 문의] 센스 & 컴퍼니');
  assert.match(url.searchParams.get('body'),/2층\n11월 도입 희망/);
  assert.match(url.searchParams.get('body'),/hello@example.com/);
});
