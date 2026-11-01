# FE 개발자 전달 — LLM 업무 상태·좌석 변경 알림 예약 비서

작성일: 2026-11-01. 대상: 기존 Sensory Fit FE 개발자.

자연어 요청을 예약 초안으로 보여주고, 사용자가 **[예약] 버튼으로 최종 확인한 뒤에만** 등록하는 기능을 연결해 주세요. FE는 기존 Supabase 사용자 세션으로 `sensory-assistant` Edge Function을 호출합니다. Lablup API 키와 실제 LLM 호출은 BE에서 관리합니다.

## 1. 현재 완료 상태와 변경 내역

| 항목 | 현재 상태 |
|---|---|
| 기존 FE·BE 실행 파일 | 이번 LLM 작업에서 수정하지 않았습니다. FE 패키지 설치·변경도 하지 않았습니다. |
| 코드 전달 방식 | SQL·Edge Function 전체 코드를 MD에 작성했습니다. 저장소에 `.sql`·`.ts` 실행 파일을 새로 추가한 방식은 아닙니다. |
| 009 DB 마이그레이션 | 사용자가 Supabase SQL Editor 실행 성공을 회신했습니다. 운영 DB에 직접 접속해 검증하지는 않았습니다. |
| Lablup Secrets | 사용자가 아래 3개 값 저장 완료를 회신했습니다. 키 원문은 전달받거나 저장하지 않았습니다. |
| Edge Function | 사용자가 `sensory-assistant` 배포 후 “된 것 같다”고 회신했습니다. 실제 정상 응답은 아직 확인 전입니다. |
| Lablup 실통신 | 미검증입니다. 제공자 연결 테스트가 남아 있습니다. |
| Cron 자동 실행 | 활성화·작업 등록 완료 회신이 없습니다. 예약 자동 실행 완료 상태로 간주하지 마세요. |
| FE 비서 연결 | 이번 작업에서는 미구현입니다. 아래 항목을 FE 담당자가 연결해야 합니다. |
| 로컬 테스트 | PostgreSQL 17에서 21개 시나리오 묶음, Node 22에서 Edge 모형 테스트 12개 통과. 실환경 통합 테스트와 구별합니다. |

저장소의 현재 `back` 체크아웃은 `96236fb` 기준이며 `fe/src/main.jsx`와 `fe/src/session.js`는 `createAdapter(localStorage)`를 사용합니다. `fe/package.json`에는 React/Vite가 있고 Supabase SDK 의존성은 없습니다. 대화에서 별도로 보고된 최신 FE의 개인 링크 로그인 구현이 이 체크아웃에 모두 들어 있다고 가정하지 않았습니다. **담당자가 작업 중인 최신 FE의 Supabase 클라이언트·로그인 흐름을 우선 재사용**해 주세요. 이 전달을 위해 기존 로컬 데모 어댑터를 중복 설치하거나 인증을 다시 구현하지 않습니다.

이번 작업에서 추가한 코드 문서와 책임 범위:

| 문서 | 포함한 내용 |
|---|---|
| [LLM_예약비서_SQL.md](./LLM_예약비서_SQL.md) | 009 DB/RPC/RLS 전체 코드, 별도 Cron 등록 SQL. 성공한 009를 다시 실행하지 않습니다. |
| [LLM_예약비서_Edge.md](./LLM_예약비서_Edge.md) | LLM 해석, JSON 검증, 초안 완료 처리, 확인·취소·조회, 제공자 진단의 전체 배포 코드 |
| [LLM_예약비서_연동과적용.md](./LLM_예약비서_연동과적용.md) | 전체 요청·응답 타입, 적용 순서, 실행·복원 정책 |
| [LLM_예약비서_검증.md](./LLM_예약비서_검증.md) | 로컬 검증 결과와 재현 코드, 실환경 미검증 범위 |

## 2. BE에서 준비한 기능과 기존 API 영향

| 영역 | 추가·변경 내용 | FE 영향 |
|---|---|---|
| 초안 | `assistant_drafts`: 본인·회사·버전·제안 내용·만료·상태 저장 | 초안 ID와 현재 버전을 유지합니다. 초안 생성만으로 예약되지 않습니다. |
| 예약 | `assistant_reservations`: 확인된 예약, 실행 전후 값, 시도 횟수, 결과 저장 | `queued`부터 실제 실행·복원까지 조회해 표시합니다. |
| 실행 이력 | `assistant_reservation_events`: 확인·시작·재시도·종료 이력 | 일반 화면은 예약의 `state/result/error_code`로 표시할 수 있습니다. |
| 알림 수신 설정 | `employee_notification_preferences.seat_changed_enabled` 추가, 기본값 `true` | 본인의 좌석 배정 변경 알림 토글만 연결합니다. |
| 기존 알림 생성 | `private.notify_seat_change`가 위 설정을 확인하도록 변경 | 꺼진 동안 새 `seat_changed` 알림을 생성하지 않습니다. 기존 알림을 삭제하거나 나중에 소급 생성하지 않습니다. |
| 수동 변경 보호 | 상태·메시지·이모티콘·알림·위치의 revision 관리 | FE에서 revision을 직접 수정하지 않습니다. 알림 설정 저장 시에만 현재 알림 revision을 보내 충돌을 확인할 수 있습니다. |
| 실행기 | `private.assistant_tick`와 Cron 등록 코드 | 사용자용 실행 API가 아닙니다. FE에서 Cron 함수를 직접 호출하지 않습니다. |
| 인증·권한 | 기존 Auth → 직원 → 회사 연결 재사용, 본인 RLS와 RPC 검사 | 요청에 사용자·직원·회사 ID를 넣어 변경 대상을 지정하지 않습니다. |

기존 수동 업무 상태·메시지·이모티콘·좌석 이동 API를 계속 사용합니다. 예약 UI가 기존 수동 API를 호출해 예약 시작 효과를 미리 적용하면 안 됩니다. 예약 실행·복원에서는 좌석 이동이나 개인 감각값 초기화를 추가하지 않습니다.

## 3. 연결 주소와 인증

FE가 호출할 주소:

```text
POST https://wabyrfyvfuxtgmxaozin.supabase.co/functions/v1/sensory-assistant
Content-Type: application/json
Authorization: Bearer <현재 로그인 사용자의 access_token>
apikey: <기존 프로젝트의 publishable 또는 anon key>
```

프로젝트 공개 연결 값은 기존 [FE 연동 안내](./FE_연동_안내.md)를 참고하고, 현재 FE에서 사용 중인 Supabase 인스턴스를 재사용해 주세요. 개인 초대 링크로 익명 로그인한 사용자도 **직원 연결이 완료된 실제 사용자 세션**이라면 사용할 수 있습니다. publishable/anon 키 자체나 service_role 키를 사용자 access_token 대신 보내지 않습니다. 테스트를 위해 사용자 토큰을 문서·채팅·로그로 복사할 필요는 없습니다.

최소 호출 예시입니다. `supabase`는 기존 FE의 인스턴스입니다. 새 패키지를 설치하라는 의미는 아닙니다.

```javascript
const { data, error } = await supabase.functions.invoke('sensory-assistant', {
  body: { action: 'context' },
});

if (error) {
  // HTTP 상태와 오류 body를 확인하여 UI 오류로 처리합니다.
  // error가 있는 응답을 예약 성공으로 표시하지 않습니다.
} else {
  // 현재 본인의 설정과 지원 기능을 화면에 반영합니다.
}
```

서버 전용 설정은 아래와 같습니다. FE 환경변수나 브라우저 코드에 넣지 않습니다.

| Supabase Secret | 현재 설정 |
|---|---|
| `LLM_API_KEY` | Lablup에서 발급한 실제 키. 원문 전달 대상 아님 |
| `LLM_BASE_URL` | `https://api.console.lablup.ai/v1` |
| `LLM_MODEL` | `DeepSeek-V4.1-Flash-B300` |

위 모델 ID는 사용자가 제공한 Lablup Connect cURL의 `model` 값으로 확인했습니다. `deepseek-ai/` 접두사를 추가하거나 다른 Flash/Pro ID로 바꾸지 않습니다.

## 4. FE에서 연결할 작업

현재 저장소 기준 수정 후보입니다. 최신 FE에서 파일 구조가 다르면 같은 역할의 코드에 반영해 주세요. 아래 파일·컴포넌트를 이번 작업에서 실제 변경한 것은 아닙니다.

| 수정 위치·역할 | 필요한 작업 |
|---|---|
| 기존 Supabase 통신 계층 | `sensory-assistant` 호출과 오류 처리 함수를 추가하고, 기존 로그인 세션을 재사용합니다. 새로운 LLM SDK는 필요하지 않습니다. |
| 비서 입력 화면·컴포넌트 | 자연어 입력, 처리 중 표시, 추가 질문과 답변, 초안 표시를 연결합니다. 현재 체크아웃에서 LLM 비서 연결은 확인되지 않았으므로 컴포넌트 이름은 최신 FE 구조에 맞춰 결정합니다. |
| 초안 확인 화면 | 실제 날짜·한국 시간·변경할 항목·종료 규칙을 표시하고 [예약]/[수정]/[취소] 버튼을 연결합니다. |
| 화면 상태 관리 | draft ID·version·confirmation token·멱등키·reservation ID를 관리합니다. 이전 요청의 늦은 응답이 최신 초안을 덮어쓰지 않도록 합니다. |
| 예약 결과·내역 화면 | 예약 등록, 실행 대기, 실행 중, 복원 완료·충돌·실패를 구분합니다. 자동 실행을 위해 FE 타이머로 기존 상태 API를 호출하지 않습니다. |
| 알림 설정 | 로컬 저장만 하던 좌석 배정 변경 알림 설정을 BE RPC와 연결합니다. |
| 상태·지도 데이터 갱신 | 실행·복원 결과 확인 후 기존 조회 경로와 `context`로 실제 상태를 다시 읽습니다. 초안만 보고 캐릭터를 자리비움 상태로 바꾸지 않습니다. |

현재 체크아웃에서는 `fe/src/main.jsx`, `fe/src/session.js`가 통신 어댑터를 만들고, `fe/src/react/App.jsx`가 사용자 데이터 동기화를 담당합니다. 알림 화면은 `fe/src/react/ReferenceViews.jsx`, 저장 동작은 `fe/src/senspace.js`의 `saveSettings`에 있습니다. 이 구조가 최신 FE에도 유지된다면 연결 위치 후보로 사용하세요.

## 5. API 계약

모든 action은 위 **하나의 POST 엔드포인트**로 보냅니다. `/interpret` 같은 별도 URL은 없습니다. 표의 ID·버전·토큰 값은 실제 직전 응답에서 받은 값을 사용합니다.

| 동작 | 요청 body | 성공 응답 |
|---|---|---|
| 현재 상태·지원 목록 | `{"action":"context"}` | 현재 직원 식별자, `server_now`, `timezone`, `state`, `capabilities` |
| 자연어 해석 | `{"action":"interpret","text":"사용자 요청"}` | 아래 clarification 또는 preview |
| 수정·추가 질문 답변 | `{"action":"revise","draft_id":"…","version":1,"text":"수정 요청 또는 답변"}` | 버전이 증가한 clarification 또는 preview |
| 초안 취소 | `{"action":"cancel_draft","draft_id":"…","version":2}` | `{"kind":"cancelled","draft":{…}}` |
| 최종 확인 | `{"action":"confirm","draft_id":"…","version":2,"confirmation_token":"…","idempotency_key":"UUID","confirmed":true}` | `{"kind":"reserved","message":"예약했어요.","reservation":{…}}` |
| 초안 조회 | `{"action":"get_draft","draft_id":"…"}` | draft 객체 자체 |
| 예약 조회 | `{"action":"get_reservation","reservation_id":"…"}` | reservation 객체 자체 |
| 예약 목록 | `{"action":"list_reservations"}` | `{"reservations":[…]}` 시작 시각 내림차순 최대 20개 |
| 등록된 예약 취소 | `{"action":"cancel_reservation","reservation_id":"…"}` | `{"kind":"현재 상태 또는 cancel_requested","reservation":{…}}` |
| 제공자 연결 진단 | `{"action":"provider_check"}` | `{"ready":true,"model":"…","endpoint":"chat/completions","format":"json_object 또는 text"}` |

`provider_check`는 일반 사용자 입력마다 호출하는 API가 아닙니다. 연결 진단용이며 소량의 LLM 비용과 해석 호출 한도를 사용하고, 진단을 위해 생성 후 취소한 초안 행을 남깁니다. 업무 상태와 예약은 변경하지 않습니다.

### 추가 질문 응답

```json
{
  "kind": "clarification",
  "draft": {
    "id": "응답의 실제 UUID",
    "version": 1,
    "state": "clarification",
    "questions": ["오전과 오후 중 어느 시간인가요?"],
    "reply": "추가 정보를 확인해 주세요. 아직 예약되지 않았어요.",
    "expires_at": "서버가 반환한 ISO 시각"
  }
}
```

문서는 주요 필드만 발췌했습니다. 실제 draft에는 다른 관리 필드도 있습니다. 질문 답변은 새 interpret 대신 **같은 draft의 최신 version으로 revise**합니다. clarification 상태에서는 예약 버튼을 활성화하지 않습니다.

### 초안 응답

```json
{
  "kind": "preview",
  "confirmation_token": "서버가 생성한 64자리 hex 문자열",
  "draft": {
    "id": "응답의 실제 UUID",
    "version": 2,
    "state": "preview",
    "reply": "다음 내용으로 예약할까요? 아직 예약되지 않았어요.",
    "questions": [],
    "proposal": {
      "starts_at": "2026-11-02T05:00:00.000Z",
      "ends_at": "2026-11-02T06:00:00.000Z",
      "restore": "restore_previous",
      "changes": {
        "attendance": {
          "status": "away",
          "away_reason": "meeting",
          "away_reason_text": null
        },
        "notifications": { "seat_changed_enabled": false }
      }
    }
  }
}
```

위 시각은 응답 형식을 설명하기 위한 예시입니다. 고정 테스트 시각으로 사용하지 말고 서버가 반환한 실제 시각을 사용해 주세요.

표시 예: “2026년 11월 2일 14:00~15:00 / 업무 상태: 자리비움·회의 / 본인의 좌석 배정 변경 알림 끄기 / 종료 후 변경 전 설정으로 복원”. 화면 문구는 기존 FE 용어에 맞춥니다.

## 6. 필드와 화면 규칙

| API 필드 | FE 처리 |
|---|---|
| `starts_at` / `ends_at` | 서버가 해석한 실제 시각을 사용합니다. 표시는 `Asia/Seoul`로 변환하고 날짜까지 보여줍니다. |
| `changes.attendance.status` | `working`=업무 중, `away`=자리비움. 예약용 `off_work`는 지원하지 않습니다. |
| `away_reason` | `lunch`=점심, `meeting`=회의, `outside`=외출. |
| `away_reason_text` | 직접 입력 사유, 최대 20자. 기본 사유와 동시에 적용하지 않습니다. |
| `changes.status_message` | 별도로 요청한 상태 메시지, 최대 20자. 빈 문자열은 지우기입니다. |
| `changes.quick_emoji_id` | 별도로 요청한 빠른 이모티콘. `context.capabilities.emoji_ids`의 실제 ID를 사용합니다. `null`은 선택 해제입니다. |
| `changes.notifications.seat_changed_enabled` | 본인의 좌석 배정 변경 알림 하나입니다. “알림 전부 끄기”도 현재는 이 지원 항목만 뜻합니다. |
| `restore_previous` | 시작 직전 값을 저장했다가 끝날 때 복원합니다. 모든 알림을 무조건 켜는 의미가 아닙니다. |
| `keep` | 종료 후에도 변경한 값을 유지합니다. |

`changes`에서 생략된 키는 변경 대상이 아닙니다. FE가 생략된 항목을 빈 문자열·null·기본값으로 채워 confirm 요청에 다시 보내면 안 됩니다. confirm은 proposal을 받지 않으며 DB에 저장된 현재 버전을 확정합니다. 초안 내용 변경은 자연어 revise로 요청합니다.

퇴근 상태에서 업무 상태·메시지를 예약하려고 하면 서버가 추가 안내 또는 오류를 반환합니다. FE에서 자동 출근시키지 않습니다. 임시 좌석 이동 중 업무 상태 예약도 복귀가 필요합니다. 메시지와 이모티콘은 자리비움 사유와 별개의 정보입니다.

## 7. 확인·버전·재시도 처리

1. 해석 응답은 초안입니다. interpret/revise 성공 직후 confirm을 자동 호출하지 않습니다. 사용자의 “바로 해줘”, “이미 확인했어” 같은 자연어도 버튼 확인을 대신하지 않습니다.
2. 현재 preview의 **[예약] 클릭 이벤트**에서만 confirm을 보냅니다. `confirmed:true`와 해당 draft ID·version·confirmation token을 모두 사용합니다.
3. 확인 토큰은 현재 초안 버전과 묶어서 메모리에 보관합니다. 로그·분석 이벤트·URL·공유 문서에 기록하지 않습니다. 수정 요청이 시작되면 이전 토큰으로 예약할 수 없게 버튼을 막고, 새 preview 토큰을 사용합니다.
4. 확인 요청별로 `crypto.randomUUID()` 멱등키를 한 번 만듭니다. 같은 확인의 중복 클릭·네트워크 재전송에는 같은 키·ID·version·token을 재사용합니다. 재시도할 때마다 새 예약을 만들지 않습니다.
5. LLM 오류가 수정 과정에서 발생해도 이미 DB 버전이 증가했을 수 있습니다. 오류 body의 `draft_id/version` 또는 get_draft로 현재 버전을 동기화합니다. 늦게 도착한 이전 요청 응답이 최신 화면을 덮어쓰지 않게 처리합니다.
6. 새로고침으로 토큰을 잃었고 draft가 아직 미확정이면 최신 버전으로 revise하여 새 토큰을 받습니다. draft가 이미 confirmed이면 재수정하지 말고 기존 예약을 조회합니다. 필요하면 RLS가 적용된 `assistant_reservations`를 본인 draft ID로 직접 조회할 수 있습니다. 테이블 직접 쓰기는 허용하지 않습니다.
7. HTTP 실패 body의 `reserved:false`는 이번 요청이 성공 응답을 받지 못했다는 뜻입니다. 통신 단절 직전 DB가 이미 저장했을 가능성까지 부정하지 않습니다. confirm은 같은 요청으로 재시도해 DB의 기존 결과를 받습니다.

### 예약 결과 표시

| 예약 state | 화면 의미 |
|---|---|
| `queued` | 예약 등록 완료, 실행 대기. “예약했어요”는 가능하지만 “변경했어요”는 아직 아닙니다. |
| `running` | 시작 작업 적용 완료, 종료 처리 대기. 실제 상태를 다시 조회합니다. |
| `completed` | 승인한 종료 규칙 처리 완료. restore_previous인지 keep인지 함께 봅니다. |
| `completed_conflict` | 복원 일부/전체를 건너뜀. `result.restored`와 `result.skipped`를 구분해 표시합니다. |
| `cancelled` | 취소 처리 완료. 실행 중 keep 규칙으로 취소한 경우 원래 값으로 복원되었다고 표시하지 않습니다. |
| `failed` | `error_code` 확인이 필요합니다. 복원 실패라면 변경값이 남아 있을 수 있습니다. |
| `expired` | 실행 가능한 구간을 놓쳐 시작하지 않은 예약입니다. |

`get_reservation`의 `result/error_code`를 확인하고 완료·실패 뒤 현재 상태를 다시 읽습니다. 모든 completed를 “원래대로 복원됐어요”로 일괄 표시하면 keep에서 잘못된 안내가 됩니다.

대기 예약 취소는 바로 실행을 막습니다. 실행 중 취소는 `cancel_requested:true` 후 다음 Cron에서 승인된 종료 규칙을 처리합니다. 이때 `running + cancel_requested:true`를 즉시 취소 완료로 표시하지 않습니다.

## 8. 좌석 배정 변경 알림 설정 연결

현재 구현 범위는 **본인의 좌석 배정 변경 알림**입니다. 동료 상태·새 메시지·감각 변화 알림, 회사 전체 알림, 브라우저 Push 발송 기능을 이 API에 연결하지 않습니다. 기존 FE의 해당 항목이 데모 UI라면 데모와 실제 지원 항목을 구별해 주세요.

여기서 좌석 배정 변경은 `employees.seat_id` 변경을 뜻합니다. `temporary_seat_id`를 사용하는 임시 자리 이동·복귀를 새 알림 대상으로 추가한 것은 아닙니다.

조회는 `context` 응답의 `state.notifications.seat_changed_enabled`, 현재 revision은 `state.revisions.notifications`를 사용합니다. 수동 저장은 기존 Supabase 인스턴스에서 다음 RPC로 처리합니다.

```javascript
const { data: saved, error } = await supabase.rpc('assistant_set_notification_preferences', {
  p_enabled: nextSeatChangedEnabled,
  p_expected_revision: currentNotificationRevision,
});

// 성공하면 saved.seat_changed_enabled / saved.revision으로 화면 상태를 갱신합니다.
// 버전 충돌이면 context를 다시 읽고 사용자에게 현재 설정을 보여줍니다.
```

localStorage에 토글만 저장하면 BE 실행기와 공유되지 않습니다. 예약 실행·복원 뒤에도 `context`를 다시 읽어 UI 토글을 동기화합니다. 브라우저 알림 권한 요청과 이 DB 수신 설정은 별개입니다. 이번 BE가 브라우저 권한이나 Push 전송을 자동 처리하지는 않습니다.

## 9. 오류·제한과 배포 확인 사항

| 오류 또는 상황 | FE 처리·전달 |
|---|---|
| `AUTH_REQUIRED` / HTTP 401 | 현재 사용자 세션과 만료 여부 확인. 기본 anon/service_role 키로 사용자 인증을 대신하지 않습니다. |
| `ASSISTANT_MEMBERSHIP_REQUIRED` | 개인 초대 링크의 직원 연결 완료 여부 확인. 비서 오류를 이유로 임의의 다른 계정으로 재연결하지 않습니다. |
| `ORIGIN_NOT_ALLOWED` / CORS | 실제 FE origin을 담당자에게 전달해 `ASSISTANT_ALLOWED_ORIGINS`에 등록합니다. |
| `ASSISTANT_VERSION_CONFLICT` | 초안을 재조회하여 버전을 동기화하고 다시 확인받습니다. |
| `ASSISTANT_DRAFT_EXPIRED` / `ASSISTANT_INVALID_TIME` | 초안을 수정해 새 확인을 받습니다. 이미 지난 시간을 FE가 임의로 내일로 넘기지 않습니다. |
| `ASSISTANT_OVERLAP` | 기존 예약과 시간이 겹친다는 안내 후 수정합니다. |
| `ASSISTANT_EMPLOYEE_OFF_WORK` / `ASSISTANT_RETURN_REQUIRED` | 필요한 출근·복귀는 사용자가 기존 기능으로 직접 수행합니다. |
| `ASSISTANT_RATE_LIMITED` / HTTP 429 | 연속 자동 재시도하지 않고 잠시 뒤 다시 요청하도록 안내합니다. |
| `LLM_NOT_CONFIGURED` / `BACKEND_NOT_CONFIGURED` | 담당자에게 서버 설정 확인 요청. 키 입력 UI로 사용자를 유도하지 않습니다. |
| `LLM_UNAVAILABLE` / `UPSTREAM_UNAVAILABLE` / `LLM_INVALID_OUTPUT` | 예약 성공으로 표시하지 않고 재시도·수정 경로를 제공합니다. |
| `LLM_MODEL_NOT_AVAILABLE` | 모델 목록 API 응답 확인 필요. Lablup에서 `/models`가 지원되지 않는 경우도 진단 대상이므로 모델 ID 오류라고 단정하지 않습니다. |

Edge가 처리한 오류는 보통 `{kind:'error',error_code:'…',reserved:false}`를 반환합니다. Supabase 게이트웨이 오류나 CORS·네트워크 오류는 이 구조가 아닐 수 있으므로 JSON body가 없는 실패도 처리해 주세요.

입력은 최대 2,000자, HTTP body는 최대 8KB입니다. 20자 제한은 Unicode code point 기준이므로 한글/이모지 길이도 유의하세요. 초안 유효기간은 15분, 해석·진단 합계 직원별 분당 8회·한국 날짜 하루 80회, 시작은 30일 이내 미래·기간은 최대 24시간입니다. 시간 관련 최종 판정은 서버가 합니다.

서버가 한국 시간으로 해석하며 응답은 UTC ISO로 정규화합니다. FE는 예를 들어 `Intl.DateTimeFormat('ko-KR', {timeZone:'Asia/Seoul', ...})`로 표시합니다. 사용자의 브라우저 시간대만으로 날짜를 다시 해석하지 않습니다.

기본 허용 origin은 `http://localhost:5173`, `http://127.0.0.1:5173`입니다. 배포 도메인이 정해지면 **origin만** 담당자에게 전달합니다. 담당자가 Supabase Secret `ASSISTANT_ALLOWED_ORIGINS`에 쉼표로 구분해 저장하며, URL 경로나 초대 토큰은 넣지 않습니다. 이 운영 설정은 사용자가 직접 진행합니다.

## 10. BE 담당자와 확인해야 할 남은 항목

| 항목 | 담당·확인 기준 |
|---|---|
| 실제 인증·DB 연결 | 직원 연결된 사용자로 `context`가 정상 응답하는지 확인 |
| Lablup 모델/출력 형식 | `provider_check`와 실제 자연어 요청으로 검증. 현재 코드는 `/models`, `thinking:{type:'disabled'}`, `response_format:json_object`를 사용합니다. 제공 가이드는 이 옵션 전체를 보장하지 않습니다. |
| 조건부 Edge 보완 | Lablup이 특정 옵션이나 `/models`를 지원하지 않으면 BE가 실제 오류를 확인해 전달 코드를 보완하고 사용자가 재배포합니다. FE에서 Lablup 직접 호출로 우회하지 않습니다. |
| Cron | 사용자가 `sensory-assistant-tick` 등록·활성화를 확인해야 자동 시작/복원이 작동합니다. 1분 주기이며 초 단위 정시 실행을 보장하지 않습니다. |
| 수동 변경 보호 | 시작 전 대상 항목 변경 시 실행 차단, 실행 후 수동 변경 항목은 복원에서 제외되는지 실제 확인 |
| 익명 사용자 재연결 | 개인 링크의 user_id 재연결 시 이전 계정 예약 접근·시작·복원이 보호되는지 확인 |
| 배포 FE origin | 허용 목록에 등록 후 브라우저에서 실제 호출 확인 |

이 항목은 현재 미검증 또는 조건부 수정 대상입니다. 이미 Lablup 호환 오류가 발생했다거나 수정이 완료된 것으로 간주하지 않습니다. 009를 다시 실행하거나 DB 스키마를 추측해 추가할 필요는 없습니다.

## 11. FE 완료 확인 목록

- [ ] 개인 링크로 연결된 본인 세션으로 context 조회 성공
- [ ] 자연어 입력 → clarification 답변 → preview 표시
- [ ] preview 단계에서 업무 상태·알림 설정·예약이 바뀌지 않음
- [ ] 실제 날짜·한국 시간·변경 항목·종료 규칙을 확인 화면에 표시
- [ ] [예약] 클릭 때만 confirm 호출, 중복 클릭/통신 재시도 시 예약 1개
- [ ] 초안 수정 후 이전 버전·토큰으로 확인되지 않음
- [ ] 초안 취소와 등록된 예약 취소를 다른 API로 처리
- [ ] queued·running·completed·충돌·실패를 구분하고 실제 상태 재조회
- [ ] 실행 중 수동 변경·퇴근 후에도 기존 값을 무조건 덮어쓰지 않음
- [ ] 좌석 변경 알림 설정을 실제 DB 값과 동기화
- [ ] LLM·service_role 키와 확인 토큰을 FE 소스/로그/URL에 기록하지 않음
- [ ] Lablup 실통신 및 Cron을 포함한 최종 통합 테스트 결과를 BE 담당자와 공유

검토 결과 공유 시에는 HTTP 상태, error_code, 기대 동작과 실제 동작만 전달해 주세요. 사용자 access_token, Lablup 키, service_role 키, 개인 초대 링크 토큰은 포함하지 않습니다.
