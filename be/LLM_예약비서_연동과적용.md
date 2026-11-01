# 업무 상태·좌석 변경 알림 예약 비서 — 연동과 적용

2026-11-01. **사용자가 설치 전 조회·009 SQL 실행 성공과 Lablup Secrets 3개 저장 완료를 회신했다.** Edge Function 배포 후에는 “된 것 같다”고 회신했으며 정상 응답은 아직 확인 전이다. 운영 DB나 Secrets에 직접 접속해 검증한 것은 아니다. 실제 제공자 통신·Cron 활성화도 확인 전이다. 사용자 요청에 따라 저장소에는 MD만 추가했다. FE, 패키지, 기존 실행 소스는 변경하지 않았다. Supabase 조작은 사용자가 진행한다.

**FE 개발자에게 전달할 때는 [FE 개발자 전달 문서](./LLM_예약비서_FE_개발자_전달.md)를 먼저 읽는다.** 실제 변경 범위, 연결할 코드 위치, API 흐름, 확인·재시도 규칙과 현재 미검증 항목을 정리했다. 전체 타입과 운영 절차는 이 문서에서 보충한다.

제공처 갱신: 사용자가 제공한 Connect cURL에서 호출 주소 `https://api.console.lablup.ai/v1/chat/completions`, **정확한 모델 ID `DeepSeek-V4.1-Flash-B300`**을 확인했다. `LLM_BASE_URL`에는 경로 `/chat/completions`를 제외한 `https://api.console.lablup.ai/v1`을 넣고, `LLM_MODEL`에는 접두사 없이 확인한 모델 ID를 그대로 넣는다. PDF의 다른 모델 예시 ID로 대체하지 않는다. 인증 키는 Lablup에서 발급받으며 사용자가 공유한 예시는 키 원문이 없는 placeholder다.

## 1. 기존 프로젝트에서 확인한 내용

| 확인 대상 | 근거와 재사용 방식 |
|---|---|
| 사용자·회사 | `employees.user_id` ↔ Supabase Auth, `employees.company_id` ↔ `companies.id`. 한 계정은 한 직원·회사에 연결된다. `private.my_employee_id/my_company_id`와 RLS를 재사용한다. |
| 익명 링크 | 대화에서 사용자가 적용한 007의 직원 연결 방식을 유지한다. 직원의 `user_id`가 재연결되면 이전 계정 예약은 실행/복원하지 않는다. 007의 운영 설치 내용은 이 저장소에 없어 원격 일치 여부는 미확인이다. |
| 업무 상태 | 001/006의 `working`, `away`, `off_work`; 기본 사유 `lunch/meeting/outside`, 자유 사유 `away_reason_text`. 예약은 `working/away`만 지원하고 퇴근자를 출근시키지 않는다. |
| 메시지·이모티콘 | 004의 `status_message` 20자, `quick_emoji_id` 카탈로그. 사유와 별개로 변경한다. |
| 이동·복귀 | 006의 회사 advisory lock → 상태 행 → 직원 행 순서를 따른다. 임시 이동 중 업무 상태 예약을 거부한다. 예약으로 좌석·현재 감각을 변경하지 않는다. |
| 알림 | 004의 `notifications`와 `private.notify_seat_change`가 본인의 배정 좌석 변경 시 알림 행을 만든다. 수신 설정 테이블은 없어 추가한다. **이번 지원 범위는 이 알림 하나**다. `system` 알림은 제어하지 않는다. |
| 기존 알림 화면 | 로컬 FE의 알림 설정은 localStorage 기반이다. 동료 상태 변화·브라우저 Push의 실제 백엔드 전송은 이번에 추가하지 않는다. DB 수신 설정을 화면에 연결하는 작업은 FE 담당자에게 전달한다. |
| FE·Edge | 현재 체크아웃의 `fe/package.json`은 React/Vite이며 Supabase SDK 의존성이 없다. `main.jsx/session.js`는 로컬 어댑터를 사용한다. 팀원이 별도로 보고한 최신 배포 FE의 링크 입장 성공과 이 로컬 코드의 상태를 구별한다. 기존 배포용 Edge Function 소스는 저장소에서 확인되지 않아 새 `sensory-assistant` 배포 코드를 MD로 제공한다. |
| 층·좌석 | 사용자 보고상 008의 2층 추가·좌석 저장 확인 완료. 이번 SQL은 층·좌석·지도·링크 함수를 변경하지 않는다. |

## 2. 전달 파일과 적용 범위

| 문서 | 내용 |
|---|---|
| [LLM_예약비서_SQL.md](./LLM_예약비서_SQL.md) | 009 전체 마이그레이션과 별도 Cron 등록 SQL |
| [LLM_예약비서_Edge.md](./LLM_예약비서_Edge.md) | `sensory-assistant` 전체 배포 코드와 서버 시스템 프롬프트 |
| 이 문서 | API 타입, 호출 계약, FE 후속 변경, 사용자 적용 순서 |
| [LLM_예약비서_검증.md](./LLM_예약비서_검증.md) | 로컬 테스트 코드·결과·실환경 미검증 범위 |

추가 테이블은 본인 알림 수신 설정, 초안, 예약, 실행 이력과 private 확인 해시·호출 횟수·내부 쓰기 구분 테이블이다. 상태·위치에 충돌 확인용 revision 컬럼을 추가한다. 기존 데이터는 보존하며 기존 알림은 기본 수신 켜짐으로 시작한다. 기존 `notify_seat_change`만 수신 설정을 확인하도록 교체한다. 무음 기간에는 새 `seat_changed` 알림 행을 생성하지 않으며 나중에 소급 생성하지 않는다. 기존 알림 행을 지우지 않는다.

LLM은 해석 JSON만 생성한다. 초안 저장을 마치는 RPC는 service_role 전용이며, 확인 토큰의 원문은 서버 난수이고 DB에는 SHA-256만 저장한다. LLM에는 토큰·키·사용자 ID·회사 ID를 전달하지 않는다. DB는 확인 요청 시 현재 Auth 연결, 초안 ID·버전·토큰·만료·명시적 확인·멱등키·시간·지원 항목을 재검증한다.

## 3. API 요청 타입

모든 요청은 `POST /functions/v1/sensory-assistant`, JSON body다. `Authorization: Bearer <현재 로그인 사용자의 access_token>`과 프로젝트 publishable/anon 키의 `apikey` 헤더를 사용한다. 익명 로그인 사용자도 직원 연결이 완료되었다면 사용할 수 있다. publishable 키 자체를 사용자 access_token 대신 쓰지 않는다.

```typescript
type UUID = string;
type ISODateTime = string; // 시간대가 포함된 ISO 시각. 응답은 UTC로 정규화.
type Restore = 'restore_previous' | 'keep';
type Changes = {
  attendance?: {
    status: 'working' | 'away';
    away_reason: 'lunch' | 'meeting' | 'outside' | null;
    away_reason_text: string | null; // 1~20자, 기본 사유와 동시 사용 불가
  };
  status_message?: string; // 0~20자, 빈 문자열은 명시적인 지우기
  quick_emoji_id?: string | null; // 실제 quick_emojis ID, null은 선택 해제
  notifications?: { seat_changed_enabled: boolean };
};
type Proposal = {
  starts_at: ISODateTime;
  ends_at: ISODateTime;
  restore: Restore;
  changes: Changes; // 최소 1개 항목
};
type AssistantRequest =
  | { action: 'interpret'; text: string }
  | { action: 'revise'; draft_id: UUID; version: number; text: string }
  | { action: 'cancel_draft'; draft_id: UUID; version: number }
  | { action: 'confirm'; draft_id: UUID; version: number;
      confirmation_token: string; idempotency_key: UUID; confirmed: true }
  | { action: 'cancel_reservation'; reservation_id: UUID }
  | { action: 'context' }
  | { action: 'get_draft'; draft_id: UUID }
  | { action: 'get_reservation'; reservation_id: UUID }
  | { action: 'list_reservations' }
  | { action: 'provider_check' };
type DraftState = 'editing' | 'clarification' | 'preview' | 'confirmed' | 'cancelled' | 'error';
type Draft = {
  id: UUID; employee_id: UUID; user_id: UUID; company_id: UUID;
  version: number; state: DraftState; proposal: Proposal | null;
  reply: string; questions: string[]; error_code: string | null;
  messages: {role: 'user'; content: string}[];
  expires_at: ISODateTime; created_at: ISODateTime; updated_at: ISODateTime;
};
type ReservationState = 'queued' | 'running' | 'completed' | 'completed_conflict'
  | 'failed' | 'cancelled' | 'expired';
type Reservation = {
  id: UUID; draft_id: UUID; draft_version: number; employee_id: UUID;
  user_id: UUID; company_id: UUID; idempotency_key: UUID;
  proposal: Proposal; starts_at: ISODateTime; ends_at: ISODateTime;
  state: ReservationState; cancel_requested: boolean;
  start_attempts: number; end_attempts: number; next_attempt_at: ISODateTime;
  error_code: string | null;
  result: {applied?: boolean; restored?: string[]; skipped?: string[]; mode?: 'keep'};
  expected_manual: Record<string,number>;
  before_state: Record<string,unknown> | null; applied_state: Record<string,unknown> | null;
  created_at: ISODateTime; updated_at: ISODateTime;
};
type InterpretResponse =
  | { kind:'clarification'; draft:Draft }
  | { kind:'preview'; draft:Draft; confirmation_token:string };
type ErrorResponse = {
  kind:'error'; error_code:string; reserved:false;
  draft_id?:UUID; version?:number;
};
```

| action | 성공 응답 |
|---|---|
| interpret / revise | 위 `InterpretResponse`. 수정하면 버전 증가, 이전 확인 토큰 무효화 |
| confirm | `{kind:'reserved', message:'예약했어요.', reservation:Reservation}` |
| cancel_draft | `{kind:'cancelled', draft:Draft}` |
| cancel_reservation | `{kind:'cancel_requested' 또는 현재 상태, reservation:Reservation}` |
| context | 직원 식별자·서버 현재 시각·Asia/Seoul·현재 상태/수신 설정·실제 지원 카탈로그 |
| get_draft / get_reservation | 본인 `Draft` / `Reservation` 객체. 없거나 타인이면 404 |
| list_reservations | `{reservations:Reservation[]}` 최근 시작 시각 기준 20건 |
| provider_check | `{ready:true, model:'설정 모델', endpoint:'chat/completions', format:'json_object' 또는 'text'}` |

버전 충돌·중복 기간·만료 등 DB 검증 오류는 409, 본인에게 보이지 않는 항목은 404, 호출 한도는 429, 인증 실패는 401, LLM 장애는 502/503이다. 에러 body의 `reserved:false`는 **이번 요청이 새 예약 성공 응답을 받지 못했다는 뜻**이다. 통신 단절 직전 DB가 커밋했을 가능성까지 부정하는 값은 아니다. confirm 재전송은 같은 ID·버전·확인 토큰·멱등키로 하고 DB의 기존 결과를 받는다.

초안 입력은 2,000자, HTTP body는 8KB, 초안 만료는 15분이다. 직원별 해석·제공자 진단을 합해 분당 8회·한국 날짜 하루 80회로 제한한다. 최대 30일 이내 시작, 예약 기간은 24시간 이하다. 시작은 확인 처리 시점보다 미래여야 한다. 설정한 시간을 이미 지났다면 새 시간으로 수정한다.

## 4. FE 담당자에게 전달할 변경

이 항목은 **후속 코드 변경 안내**이며 이번에 FE에 적용하지 않았다.

1. 기존 로그인된 Supabase 클라이언트에서 Edge Function을 호출한다. FE에서 DeepSeek를 직접 호출하거나 LLM 키/service_role을 보관하지 않는다.
2. clarification의 `draft.questions`를 표시하고 답변을 `revise`에 같은 초안 ID·현재 버전으로 보낸다.
3. preview는 서버가 검증한 `draft.proposal`로 날짜·시간·업무 상태·사유·메시지/이모티콘·좌석 변경 알림·종료 규칙을 렌더링한다. 시간 표시는 `timeZone:'Asia/Seoul'`을 지정한다.
4. [예약] 클릭 이벤트에서만 `confirm`을 호출한다. 자연어의 “확인했어”, LLM의 텍스트, 초안 생성 완료를 자동 클릭으로 간주하지 않는다. [수정]은 revise, [취소]는 cancel_draft를 호출한다.
5. 확인 토큰은 현재 초안 버전에 연결해 메모리에 보관한다. 수정하면 즉시 폐기한다. 새로고침으로 토큰을 잃었다면 초안을 revise하여 새 버전·토큰을 받는다. get_draft는 토큰을 재노출하지 않는다.
6. 예약 요청별 `crypto.randomUUID()` 멱등키를 한 번 만들고 네트워크 재시도·중복 클릭에는 같은 키를 사용한다. 버튼 중복 클릭 방지는 UX 개선이며 DB의 원자적 중복 방지와 함께 사용한다.
7. 예약 성공 응답 후에만 “예약했어요”를 표시한다. queued는 아직 상태를 바꾸지 않은 단계다. get_reservation으로 실행·복원 결과를 조회한다. 결과 조회는 일정 간격 또는 상세 화면 재진입 시 수행할 수 있다. 신규 알림/Realtime 구독은 이번에 추가하지 않았다.
8. 알림 설정 화면을 저장할 때 아래 본인 전용 RPC를 사용한다. localStorage 토글만 바꾸면 예약 실행기와 공유되지 않는다. 브라우저 자체 알림 권한은 이 API와 별개다.

```typescript
// 기존 Supabase 인스턴스를 사용하는 예시. 이 코드는 이번에 FE에 추가하지 않았다.
const { data: preview, error } = await supabase.functions.invoke('sensory-assistant', {
  body: { action: 'interpret', text: userText },
});
if (error) { /* 오류 응답 확인. 예약 성공으로 표시하지 않음. */ }

// preview 화면의 [예약] 버튼에서만 실행. retryKey는 이 확인 요청 동안 고정.
const { data: confirmed, error: confirmError } = await supabase.functions.invoke('sensory-assistant', {
  body: { action: 'confirm', draft_id: preview.draft.id, version: preview.draft.version,
    confirmation_token: preview.confirmation_token, idempotency_key: retryKey, confirmed: true },
});

// 본인 좌석 배정 변경 알림만 변경. expected revision은 context.state.revisions.notifications.
await supabase.rpc('assistant_set_notification_preferences', {
  p_enabled: false, p_expected_revision: currentPreferenceRevision,
});
```

서버는 물리적으로 버튼을 눌렀는지까지 증명할 수 없다. 인증된 사용자가 보유한 현재 버전 확인 토큰과 명시적인 confirm API 요청을 확인 이벤트로 검증한다. LLM 호출 경로에는 confirm 기능이 없다.

## 5. 실행·복원 정책

회사·상태·직원 잠금을 공통 순서로 사용한다. 같은 직원의 queued/running 예약 시간 중복은 거부하며 끝나는 시각과 다음 시작 시각이 같으면 허용한다. Cron은 종료/복원부터 처리한다. 앞 예약 복원이 재시도 중이면 다음 예약은 기다리고, 복원이 최종 실패하면 그 실패 전에 이미 승인된 후속 예약은 실행하지 않는다. 실패를 확인하고 현재 설정을 검토한 뒤 새로 초안을 만들어야 한다.

시작 시 실제 변경 전 값을 저장한다. 예약 확정 후 시작 전 대상 항목이나 업무 상태 예약의 좌석을 수동 변경했다면 예약 전체를 실행하지 않는다. 시작·종료의 DB 쓰기는 각 단계에서 원자적이며 일부만 커밋하지 않는다. 오류 시 60초·120초 간격으로 최대 세 번 시도한다. Cron이 시작 구간을 완전히 놓치면 `expired`로 끝내며 뒤늦게 실행하지 않는다.

restore_previous는 변경 직전 값을 복원한다. 업무 상태·메시지·이모티콘·알림 수신 설정을 각각 비교하여 실행 이후 수동 변경된 항목은 복원하지 않는다. 값을 바꿨다가 되돌려도 revision으로 감지한다. 좌석 이동 이후 이전 업무 상태를 덮어쓰지 않고 퇴근 이후 상태/메시지를 복원하지 않는다. 나머지 복원 가능한 항목은 복원하고 `completed_conflict`, `result.skipped`에 남긴다. keep은 끝나도 변경값을 유지한다.

대기 예약 취소는 즉시 실행을 막는다. 실행 중 취소는 `cancel_requested` 후 다음 Cron에서 **이미 승인된 종료 규칙**을 적용한다. keep을 승인한 예약이면 취소해도 원래 값으로 되돌리지 않는다. 실패는 error_code와 이력으로 조회하며 재확인 버튼, 신뢰도, 환경 변화 감지, 새 알림 전송은 추가하지 않는다.

익명 초대 링크를 새 기기에서 사용해 직원 user_id가 바뀌면 예전 계정 초안/예약은 접근이 차단된다. 대기 예약은 AUTH_BINDING_CHANGED로 실패하고 실행 중인 예약은 이전 계정의 스냅샷을 복원하지 않는다. 이는 타 계정 설정 덮어쓰기를 피하기 위한 정책이다. 새 계정에서 현재 값을 확인하고 필요한 예약을 다시 만든다.

## 6. 사용자가 적용할 순서

**1단계 — 설치 전 확인.** SQL Editor에서 postgres 역할로 아래 읽기 전용 쿼리를 실행한다. 운영 함수가 문서와 다르게 변경되어 있으면 009를 덮어 적용하지 말고 정의를 비교한다. 아래는 설정 변경이 아니다.

```sql
SELECT current_user;
SELECT version FROM private.sensespace_migrations ORDER BY version;
SELECT to_regprocedure('private.lock_employee_location(uuid)') AS location_lock,
       to_regprocedure('public.assistant_get_context()') AS assistant_installed,
       to_regprocedure('public.redeem_employee_link(text)') AS personal_links;
SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='employee_statuses'
  AND column_name IN ('away_reason_text','status_message','quick_emoji_id');
```

필수 조건은 기존 006과 위 상태 컬럼 3개가 있고 assistant_installed는 NULL인 상태다. 007/008을 다시 실행하지 않는다. 009 적용 전 현재 DB 백업/복구 지점 확보는 운영 절차에 맞춰 진행한다.

**2단계 — DB.** [SQL 문서](./LLM_예약비서_SQL.md)의 첫 SQL 블록만 전체 실행한다. BEGIN~COMMIT까지 한 번이다. Cron 등록 블록은 아직 실행하지 않는다. 실패 시 같은 트랜잭션이 롤백된다. 성공한 009를 다시 실행하면 중복 마이그레이션으로 거부된다.

**3단계 — Secrets.** Supabase Dashboard → Edge Functions → Secrets에서 `LLM_API_KEY`에 **Lablup Token Factory에서 발급받은 실제 키**, `LLM_BASE_URL`에 **`https://api.console.lablup.ai/v1`**, `LLM_MODEL`에 **`DeepSeek-V4.1-Flash-B300`**을 등록한다. 값에 따옴표나 Bearer 접두사를 넣지 않는다. 배포 FE origin은 `ASSISTANT_ALLOWED_ORIGINS`에 등록한다. 키 원문을 채팅·MD·브라우저 코드로 전달하지 않는다. 콘솔의 Key ID는 인증 키 원문과 다르다. Supabase 기본 환경변수는 [공식 Secrets 안내](https://supabase.com/docs/guides/functions/secrets)를 따른다.

**4단계 — Edge 배포.** Dashboard에서 `sensory-assistant`를 만들고 [Edge 문서](./LLM_예약비서_Edge.md)의 전체 코드 블록을 편집기에 붙여 배포한다. 사용자 JWT 검증을 유지한다. 익명 로그인이라도 유효한 사용자 JWT를 보내야 한다. 코드 내부에서도 Auth `/user` 검증을 수행한다. 인증 방식은 [공식 Edge 인증 안내](https://supabase.com/docs/guides/functions/auth)를 참고한다.

**5단계 — 실제 제공자 검증.** 직원 연결이 끝난 사용자 세션으로 `{"action":"provider_check"}`를 호출한다. 실제 GET `/models`에 설정 모델이 있고 Chat Completions가 JSON을 반환하는지 검사한다. `ready:true`를 받아야 다음 단계로 간다. 진단은 소량의 API 비용과 호출 한도를 사용한다. 모델 ID가 잘못되면 Secrets를 고친다. 키를 제공받지 않았으므로 이 실통신 검증은 현재 미실시다.

Edge 코드는 설정한 base URL에 `/chat/completions`와 `/models`를 붙인다. Lablup의 제공 가이드는 OpenAI 호환 cURL/Python 예시를 보여주지만, JSON 출력 모드·모델 목록 API·thinking 옵션의 호환 여부까지 명시하지 않는다. 현재 코드는 [DeepSeek 공식 API](https://api-docs.deepseek.com/api/create-chat-completion/) 기준의 `thinking` 옵션과 `response_format:json_object`를 포함하므로 **Lablup 실통신까지 검증 완료된 것으로 취급하지 않는다.** 실제 응답을 확인해 필요한 Edge 전달 코드 보완을 진행한다. JSON Schema 출력 모드를 가정하지 않고 Edge와 DB가 별도로 구조를 검증한다. 명시적인 response_format 미지원 400에서만 일반 JSON 파싱으로 대체한다. `provider_check` 결과의 format으로 실제 사용 방식을 확인한다.

**6단계 — Cron.** Dashboard → Integrations → Cron에서 활성화한 뒤 SQL 문서의 두 번째 블록을 postgres로 실행한다. `sensory-assistant-tick` 작업 1개가 active인지 확인한다. 매분 DB 내부 함수만 실행하며 HTTP 실행용 키는 없다. Cron은 [공식 안내](https://supabase.com/docs/guides/cron)에 따라 실행 이력을 확인할 수 있다.

**7단계 — 실제 직원 검증.** 현재 출근 상태에서 3~5분 뒤 시작하는 짧은 예약을 만든다. preview 단계에서 DB 상태와 예약 행이 바뀌지 않는지 확인한다. 예약 버튼 후 queued 1개 → Cron 후 running → 종료 후 completed 및 원래 상태·수신 설정을 확인한다. 별도 사례에서 실행 중 메시지·사유를 수동 변경해 보존되는지 확인한다. Cron이 매분이므로 약 1분 이상 늦어질 수 있고 초 단위 정시성을 보장하지 않는다.

```sql
-- 관리자 확인용. 키/초대 토큰/자연어 원문을 공유하지 않는다.
SELECT id,state,starts_at,ends_at,start_attempts,end_attempts,error_code,result
FROM public.assistant_reservations ORDER BY created_at DESC LIMIT 10;
SELECT reservation_id,kind,detail,created_at
FROM public.assistant_reservation_events ORDER BY id DESC LIMIT 30;
SELECT jobname,active,schedule FROM cron.job WHERE jobname='sensory-assistant-tick';
SELECT status,start_time,end_time,return_message FROM cron.job_run_details
WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname='sensory-assistant-tick')
ORDER BY start_time DESC LIMIT 10;
```

일시 중지는 `SELECT cron.alter_job(jobid,active:=false) FROM cron.job WHERE jobname='sensory-assistant-tick';`로 할 수 있다. 실행 중 예약은 Cron이 멈춘 동안 자동 복원되지 않으므로 상태를 확인하고 작업을 재개한다. 데이터 삭제나 DROP으로 되돌리는 SQL은 제공하지 않는다. 성공한 009의 수정은 새 후속 마이그레이션으로 진행한다.

## 7. 남은 검증과 구현

009 SQL은 사용자로부터 실행 성공을 회신받았다. 사용자 JWT/익명 링크 통합, Dashboard Edge 배포, Lablup 실통신, 실제 pg_cron 실행 확인은 사용자의 작업이 남아 있다. FE의 비서 화면·확인 이벤트·알림 설정 연결도 전달 사항이며 이번에는 수정하지 않았다. 브라우저 Push, 동료 상태 알림, 새 감각 집계 알고리즘, 알림 예약 이외의 LLM 실행 권한은 포함하지 않는다.
