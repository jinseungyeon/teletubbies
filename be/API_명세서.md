# SenseSpace P1 — API 명세서

> 006 후속 구현: 자리 이동·복귀·자유 사유 저장과 location 조회 계약은 [자리이동·복귀 API](./자리이동_복귀_API.md)를 따른다. 기본/자유 사유는 상호 배제한다. 로컬 검증 완료이며 사용자가 Supabase 적용·설치 확인 성공을 확인했다. 실제 직원 세션과 FE 통합 검증은 남아 있다. 아래 초기 P1 계약과 다른 부분은 006 문서를 우선한다.

> P2 공간 감각 집계의 최신 계산 규칙은 [감각 집계 최종안](./감각_집계_최종안.md)을 따른다. 계산 모듈·단위 테스트는 구현했지만 현재 P1 RPC에 공간 집계 엔드포인트가 추가되거나 적용된 것은 아니다.

> 2026-11-01: 004·005 후속 SQL의 캐릭터·독립 이모티콘·업무 정보·팀·알림 계약은 FE 코드 연동 검토 4절(문서 정리로 삭제)을 따른다. 사용자가 004·005 적용과 카탈로그 조회를 확인했다. 메시지는 사용자 확정 20자, 감각은 기존 6개다. OpenAI 생성은 보류한다.

상태: P1 전체 API 설계 및 SQL 작성 완료. PostgreSQL 17 로컬 검증 완료. 실제 Supabase 프로젝트의 Auth·Data API·Storage HTTP 연동 검증 전이다.
기준: [DB 스키마 명세서](./DB_스키마_명세서.md), [초기화 SQL](./001_sensespace_init.sql). 충돌 시 기존 검토 문서보다 이 두 명세서와 최신 사용자 결정을 우선한다.

## 1. 호출 방식

FE는 Supabase Auth, 테이블 조회·수정, RPC를 사용한다. 로그인 사용자 세션으로 호출하고, 업무 데이터의 접근 권한은 DB에서 검사한다.

RPC는 DB에 저장된 함수를 호출하는 방식이다. 퇴근처럼 여러 데이터를 함께 변경해야 하는 작업에 사용한다.

## 2. 출근·자리 비움·퇴근

호출: `supabase.rpc('set_employee_status', 요청값)`

권한: 로그인한 계정에 연결된 본인 직원만 변경할 수 있다.

| 요청 필드 | 자료형 | 필수 | 설명 |
|---|---|---|---|
| p_employee_id | UUID 문자열 | 예 | 본인 직원 ID |
| p_status | 문자열 | 예 | working / away / off_work |
| p_away_reason | 문자열 또는 null | 아니요 | away일 때 lunch / meeting / outside 또는 null(006 이후). 그 외 null |

### 퇴근 요청 예시

```ts
const { data, error } = await supabase.rpc('set_employee_status', {
  p_employee_id: employeeId,
  p_status: 'off_work',
  p_away_reason: null,
});
```

FE는 요청 성공 후 응답의 상태와 감각을 함께 반영하고 카드·좌석 데이터를 다시 조회한다. 오류가 있으면 성공으로 표시하지 않는다.

### 퇴근 처리 계약

한 트랜잭션에서 아래 변경을 모두 완료한다.

| 데이터 | 완료 후 값 |
|---|---|
| employee_statuses.status | off_work |
| employee_statuses.away_reason | null |
| employee_statuses.status_message | 빈 문자열 |
| current_sensations의 감각 6개 | 모두 null |
| employees.seat_id | 기존 배정 유지 |
| sensory_profiles | 기존 민감도·설명 유지 |

이미 off_work인 상태에서 재요청해도 감각과 메시지를 초기화한다. 로그인·로그아웃은 이 퇴근 요청을 대신 실행하지 않는다.

성공 응답은 기존 문서의 `{ status: {...}, sensations: {...} }` 키를 유지하고 006에서 location을 추가한다. `status`에는 away_reason_text도 추가된다. `sensations` 객체에는 employee_id, 감각 6개 필드, updated_at이 포함된다. 퇴근 후 감각 객체 자체는 null이 아니며 내부 감각 값만 null이다. 실제 출근 전환·이동·복귀 시 NULL 처리와 재요청 규칙은 006 문서를 따른다.

### 오류 계약

| 업무 오류 | 의미 |
|---|---|
| LOGIN_REQUIRED | 로그인 필요 |
| NOT_YOUR_EMPLOYEE | 본인 직원이 아니거나 대상 없음 |
| INVALID_STATUS | 허용되지 않은 상태 |
| INVALID_AWAY_REASON | 상태와 자리 비움 사유가 맞지 않음 |
| INVALID_STATUS_TRANSITION | 허용되지 않은 상태 전이. 기존 기본안은 off_work → away 직접 변경 금지 |

오류 이름은 기존 문서의 업무 오류 문자열이다. HTTP 상태 코드와 같은 의미가 아니다.

## 3. 상태 메시지 변경

호출: `supabase.rpc('set_status_message', 요청값)`. 초기화 SQL에 포함되어 있으며 기존 문서의 테이블 직접 UPDATE 호출을 대체한다.

| 요청 필드 | 자료형 | 필수 | 설명 |
|---|---|---|---|
| p_employee_id | UUID 문자열 | 예 | 본인 직원 ID |
| p_status_message | 문자열 | 예 | 메시지. 빈 문자열이면 삭제. null은 허용하지 않음 |

```ts
const { data, error } = await supabase.rpc('set_status_message', {
  p_employee_id: employeeId,
  p_status_message: '미팅 중입니다',
});
```

성공 응답: `{ employee_id, status, away_reason, status_message, updated_at }`. 변경한 상태 행을 반환한다.

| 조건 | 결과 |
|---|---|
| 본인 + working 또는 away | 저장 가능. 빈 문자열로 삭제 가능 |
| 본인 + off_work | EMPLOYEE_NOT_WORKING. 빈 문자열 변경 요청도 거부 |
| 비로그인 | LOGIN_REQUIRED |
| 다른 직원 또는 대상 없음 | NOT_YOUR_EMPLOYEE |
| null 또는 20자 초과 메시지 | INVALID_STATUS_MESSAGE |

최대 길이는 사용자 확정 20자를 적용한다(004 후속 SQL 필요). DB는 PostgreSQL length 기준 Unicode 코드 포인트를 센다. FE도 `[...text].length`로 검사한다. Intl.Segmenter의 grapheme 수와는 결합 이모지에서 차이가 있다. SQL text 인자로의 변환 가능 여부는 Data API가 별도 검사하므로 FE는 문자열만 전달한다.

### 권한과 동시 요청

메시지 작성·수정·삭제는 working/away에서만 허용한다. DB 함수는 본인 확인 후 해당 상태 행을 잠그고 현재 상태를 검사해 메시지를 수정한다. 상태·감각 변경 함수도 동일하게 상태 행부터 잠근다.

메시지 저장이 먼저 완료되면 뒤의 퇴근 요청이 메시지를 지운다. 퇴근이 먼저 완료되면 뒤의 메시지 저장을 거부한다. 일반 직원의 직접 UPDATE 권한은 회수하며 FE도 이 RPC만 사용한다.

FE는 퇴근 상태에서 메시지 입력·저장 UI를 비활성화한다. 저장 중 EMPLOYEE_NOT_WORKING을 받으면 상태를 다시 조회하고 퇴근 화면을 반영한다. 오류를 저장 성공으로 표시하지 않는다.

로컬 PostgreSQL에서 RPC·직접 수정 차단·퇴근과의 동시 요청을 검증했다. 실제 Supabase HTTP 연동 검증은 남아 있다.

## 4. 공통 계약

- Supabase JS v2 형식으로 호출한다. FE에는 publishable key(또는 기존 anon key)와 로그인 세션만 사용한다. service_role/secret key는 사용하지 않는다.
- SDK 결과는 `{ data, error }`다. error를 처리한 후 성공 UI를 표시한다. 가입 RPC는 추가로 `data.error_code`도 반드시 검사한다.
- 다른 회사·대상 없음 조회는 빈 배열 또는 null이다. 이를 다른 회사 존재 여부를 확인하는 별도 오류로 바꾸지 않는다.
- 입력 UUID가 깨졌거나 인자 형식이 잘못되면 Data API/타입 변환 오류가 날 수 있다. 업무 오류 문자열과 구별하고 내부 SQL 오류 전문을 사용자에게 표시하지 않는다.
- 부분 수정은 생략 필드 유지다. 감각·민감도 null은 미입력으로 삭제, 메시지·설명 빈 문자열은 내용 삭제다.
- DB 시간은 ISO 8601로 전달한다. 사용자 시간대는 표시할 때만 적용한다.
- 직접 UPDATE에는 `.select('허용 컬럼').single()`을 붙인다. 변경 0행은 성공이 아니다.
- 내 직원 컨텍스트는 `get_my_membership()`에서 얻는다. 직원 SELECT의 user_id·role 조회 권한은 없다.

## 5. 인증: 회원가입·로그인·로그아웃

| 기능 | SDK 호출 | 필수 입력 | 성공 응답 |
|---|---|---|---|
| 회원가입 | auth.signUp({email,password}) | 이메일, 비밀번호 | data.user, data.session. 이메일 인증 설정에 따라 session=null |
| 로그인 | auth.signInWithPassword({email,password}) | 이메일, 비밀번호 | data.user, data.session |
| 로그아웃 | auth.signOut() | 없음 | error 없음 |

비밀번호 규칙·이메일 인증·메일 재전송·Auth 호출 제한은 Supabase Auth 설정을 사용한다. Auth 오류는 SDK error로 처리한다. 계정 생성과 회사 가입은 분리하며, 회사 가입 실패 시 계정을 다시 만들지 않는다. 로그인·로그아웃은 출퇴근 상태를 변경하지 않는다.

## 6. 내 회사 소속 조회

`supabase.rpc('get_my_membership')`. 입력 없음. 로그인 사용자만 허용한다.

반환은 `{ employee_id, company_id, company_name, name, job_title, seat_id }` 또는 미가입 시 null이다. 회사 선택 목록이 아니라 소속 회사 한 개를 반환한다. FE는 null이면 회사 코드 입력으로 안내한다.

## 7. 기업 코드 가입

`supabase.rpc('join_company', { p_code, p_name, p_job_title })`.

| 입력 | 자료형 | 필수 / 규칙 |
|---|---|---|
| p_code | text | 필수. 앞뒤 공백 제거·대문자 정규화 후 24자리 hex |
| p_name | text | 필수. 공백 제거 후 1~100자 |
| p_job_title | text | 생략 시 빈 문자열. null 금지. 최대 100자 |

성공: `{ "employee_id": "직원 UUID", "error_code": null }`.
업무 실패: `{ "employee_id": null, "error_code": "INVALID_COMPANY_CODE" }`.
호출 제한: `{ "employee_id": null, "error_code": "RATE_LIMITED", "retry_after_seconds": 42 }`.

계정당 1분 5회 허용하며 정상·실패·반복 가입 요청을 모두 센다. 실패 시도 횟수를 같은 트랜잭션에 저장하기 위해 업무 실패는 예외 대신 JSON을 반환한다. 다른 변경 RPC의 오류 처리와 이 부분이 다르다.

```ts
const { data, error } = await supabase.rpc('join_company', {
  p_code: code, p_name: name, p_job_title: jobTitle,
});
if (error) throw error;
if (data.error_code) {
  // 안내 문구 표시. RATE_LIMITED이면 retry_after_seconds 뒤 재시도.
} else {
  // get_my_membership을 다시 조회하고 소속 회사 화면으로 이동.
}
```

잘못된·만료·폐기 코드 모두 INVALID_COMPANY_CODE다. 같은 회사의 유효 코드로 재요청하면 기존 ID를 반환하고 기존 이름·직책을 덮어쓰지 않는다. 다른 회사 가입은 ALREADY_JOINED_COMPANY다. 이미 가입했더라도 유효한 코드·이름을 입력해야 하며 호출 제한도 적용된다. 이름 오류 INVALID_NAME, 직책 오류 INVALID_JOB_TITLE도 data.error_code로 반환한다. 인증·네트워크·예상하지 못한 DB 오류는 SDK error로 반환한다.

## 8. 회사·층·좌석 조회

모두 로그인한 소속 회사만 읽을 수 있다.

| 기능 | 호출 | 선택 컬럼 | 필터 / 정렬 |
|---|---|---|---|
| 회사 | companies SELECT | id,name | id=companyId |
| 층 | floors SELECT | id,company_id,floor_number,map_path,map_width,map_height | company_id=companyId, floor_number 오름차순 |
| 좌석 | seats SELECT | id,company_id,floor_id,label,x_ratio,y_ratio | company_id=companyId, floor_id=floorId, id 오름차순 |
| 좌석 배정 | employees SELECT | id,seat_id | company_id=companyId, seat_id IS NOT NULL, id 오름차순 |

반환은 위 컬럼을 가진 객체의 배열이다. 좌석 배정 조회에 출근 상태 조건을 넣지 않는다. 퇴근자 좌석도 배정된 좌석이다.

```ts
const { data, error } = await supabase.from('floors')
  .select('id,company_id,floor_number,map_path,map_width,map_height')
  .eq('company_id', companyId).order('floor_number');
```

층·좌석·점유 목록이 Data API 응답 상한을 넘을 수 있으므로 `.range(from,to)`와 안정적인 위 정렬로 전부 조회한다. 카드 페이지는 별도 RPC 커서를 쓴다. 데이터 로딩 중에는 미조회 좌석을 빈 좌석이라고 판정하지 않는다.

## 9. 좌석 선택·변경·명시적 해제

`supabase.rpc('choose_seat', { p_employee_id, p_seat_id })`.
본인 직원만 변경 가능. p_seat_id는 같은 회사의 좌석 UUID이며, 명시적 해제에는 null을 보낸다. 출퇴근 상태와 무관하게 사용한다. 성공 data=null, error=null이다. 후속 카드·좌석 재조회가 필요하다.

중복 시 SEAT_TAKEN, 회사가 다르거나 존재하지 않는 좌석은 INVALID_SEAT, 타인 수정은 NOT_YOUR_EMPLOYEE다. 같은 좌석 동시 선택은 한 명만 성공하며 실패자의 기존 좌석은 유지한다. 퇴근은 이 API를 호출하지 않는다.

## 10. 직원 카드 목록·상세

`supabase.rpc('get_sensory_cards', { p_company_id, p_employee_id?, p_after?, p_limit? })`.

| 입력 | 자료형 | 의미 |
|---|---|---|
| p_company_id | uuid | 필수. 소속 회사 ID |
| p_employee_id | uuid 또는 null | 상세 조회 대상. 기본 null이면 목록 |
| p_after | uuid 또는 null | 이전 페이지 마지막 employee_id. 기본 null |
| p_limit | integer | 기본 50. 서버는 1~200으로 보정 |

반환은 카드 배열이며 상세도 배열 0~1개다. 카드 형식:

```json
[
  {
    "employee_id": "40000000-0000-4000-8000-000000000001",
    "company_id": "10000000-0000-4000-8000-000000000001",
    "name": "김하늘",
    "job_title": "개발자",
    "seat": {
      "id": "30000000-0000-4000-8000-000000000001",
      "label": "A-03",
      "floor_id": "20000000-0000-4000-8000-000000000001",
      "floor_number": 3,
      "x_ratio": 0.35,
      "y_ratio": 0.62
    },
    "profile": {
      "visual_sensitivity": 2,
      "auditory_sensitivity": 5,
      "olfactory_sensitivity": null,
      "description": "작은 소리에도 집중이 흐트러져요.",
      "updated_at": "2026-10-31T12:00:00Z"
    },
    "status": {
      "status": "working",
      "away_reason": null,
      "status_message": "집중 중입니다",
      "updated_at": "2026-10-31T12:00:00Z"
    },
    "sensations": {
      "temperature_level": 4,
      "humidity_level": null,
      "noise_level": 5,
      "odor_level": null,
      "discomfort_level": null,
      "crowd_level": null,
      "updated_at": "2026-10-31T12:00:00Z"
    }
  }
]
```

ID는 형식 설명용 예시다. 좌석 미지정은 seat=null. 하위 profile/status/sensations 객체 자체가 null이면 초기화 데이터 이상으로 취급한다. 정상 미입력은 객체 내부의 필드 null이다.

다음 페이지는 마지막 employee_id를 p_after로 보낸다. 요청 p_limit를 1~200으로 맞추고 받은 배열 길이가 p_limit보다 작을 때 종료한다. 정확히 같은 길이면 다음 페이지를 한 번 더 조회해 빈 배열 여부를 확인한다. UUID 오름차순이며 이름순이 아니다. 사용자 카드 전체 조회·미니맵에는 필요한 모든 페이지를 읽는다.

## 11. 내 이름·직책 수정

employees UPDATE. 수정 가능 입력은 name(1~100자, 공백만 금지), job_title(최대 100자, 빈 문자열 허용)이다. 생략 필드는 유지하고 null은 금지한다.

```ts
const { data, error } = await supabase.from('employees')
  .update({ name, job_title: jobTitle }).eq('id', employeeId)
  .select('id,name,job_title,updated_at').single();
```

성공은 선택한 컬럼의 객체 1개다. 다른 직원 수정은 RLS로 0행 처리되며 single() 오류를 성공으로 취급하지 않는다. 제한 위반은 DB 오류이며 company_id/user_id/role/seat_id는 직접 수정 금지다.

## 12. 내 평소 민감도·설명 수정

sensory_profiles UPDATE. 본인 employee_id 필터를 사용한다.

| 입력 | 규칙 |
|---|---|
| visual_sensitivity | null 또는 1~5 정수 |
| auditory_sensitivity | null 또는 1~5 정수 |
| olfactory_sensitivity | null 또는 1~5 정수 |
| description | 최대 1,000자. 빈 문자열로 삭제. null 금지 |

```ts
const { data, error } = await supabase.from('sensory_profiles')
  .update({ auditory_sensitivity: 5, description: '작은 소리에 민감해요.' })
  .eq('employee_id', employeeId)
  .select('employee_id,visual_sensitivity,auditory_sensitivity,olfactory_sensitivity,description,updated_at')
  .single();
```

성공은 위 선택 컬럼의 객체 1개다. 퇴근 중에도 수정할 수 있다. 빈 patch는 FE에서 보내지 않는다. 정수·범위·길이는 FE에서 검사하며 DB도 저장형과 범위를 제한한다. 권한 없음·0행·CHECK 위반은 실패로 처리한다.

## 13. 내 현재 감각 수정

`supabase.rpc('set_current_sensations', { p_employee_id, p_patch })`.

p_patch는 비어 있지 않은 JSON 객체다. 허용 키는 temperature_level, humidity_level, noise_level, odor_level, discomfort_level, crowd_level이다. 각 값은 숫자 1~5 정수 또는 null. 문자열 숫자·소수·0·6·알 수 없는 키·빈 객체는 INVALID_SENSATIONS다. 생략 키는 유지하고 null은 해당 값만 초기화한다.

```ts
const { data, error } = await supabase.rpc('set_current_sensations', {
  p_employee_id: employeeId,
  p_patch: { temperature_level: 4, humidity_level: null, noise_level: 5 },
});
```

응답은 `{ employee_id, temperature_level, humidity_level, noise_level, odor_level, discomfort_level, crowd_level, updated_at }` 객체다. 본인 working/away에서만 가능하며 퇴근 상태는 EMPLOYEE_NOT_WORKING이다. 퇴근과 같은 상태 행 잠금 규약으로 처리한다.

## 14. 지도 파일 조회

비공개 `office-maps` 버킷에 대해 다음을 호출한다.

```ts
const { data, error } = await supabase.storage.from('office-maps')
  .createSignedUrl(floor.map_path, 300);
// 성공 URL: data.signedUrl
```

floor.map_path는 소속 회사 floors에서 얻는다. 소속 회사 파일만 SELECT 가능하고 일반 직원 업로드·수정·삭제는 차단한다. 권한 없음·없는 파일·발급 실패는 SDK error다. URL은 5분 후 만료하므로 재발급한다. URL 자체는 DB에 저장하지 않는다. 이미 전달된 URL은 만료 전 공유될 수 있으며 권한 회수 즉시 무효화되는 계약은 아니다.

## 15. 미니맵·갱신·오류 복구

| 버튼 | 참조하는 현재 감각 |
|---|---|
| 청각 | sensations.noise_level |
| 후각 | sensations.odor_level |
| 온도 | sensations.temperature_level |
| 습도 | sensations.humidity_level |

민감도와 현재 감각을 혼용하지 않는다. 좌석 미지정 직원은 목록·카드에만 표시하고 선택 층 지도에서는 제외한다. 빈 좌석·미입력·퇴근 배정 좌석을 구별한다. away는 마지막 감각과 배지를 유지한다. 온도·습도는 3을 중립으로 하고 양끝을 구별한다. 색 외 숫자·문구·범례를 함께 제공한다. 토글 단일 선택은 기본안이며 DB에 저장하지 않는다.

P1 기본 연동은 화면 진입·층 변경·변경 성공 후 재조회와 활성 탭 5초 polling이다. 숨김·오프라인에서는 중지하고 복귀·재연결 때 즉시 재조회한다. 늦게 도착한 이전 응답으로 최신 응답을 덮어쓰지 않는다. 캐시 키에는 companyId를 포함하고 로그아웃 때 비운다.

초기화 SQL은 Postgres Changes publication에 업무 테이블을 등록하지 않는다. 즉시 반영 Broadcast는 이번 설치 범위 밖이며, 요구 시 비공개 채널 권한 설계를 추가한다. 5초 재조회는 제품이 확정한 갱신 지연이 아닌 구현 기본안이다.

네트워크 오류는 저장 실패·성공을 단정하지 말고 재조회한다. 40P01/40001은 전체 트랜잭션 단위로 제한 재시도하고, 업무 오류를 무한 재시도하지 않는다. 중복 좌석은 목록을 새로 읽고 다른 좌석 선택을 안내한다. DB 제약 오류(23514/23502/23503 등)·타입 변환 오류는 입력/권한/대상 컨텍스트를 다시 확인한다.

## 16. 운영 전용 작업

회사 생성, 층·좌석 등록, 지도 업로드, 가입 코드 발급·교체·폐기는 SQL Editor/Storage의 운영 경로로 제공한다. 일반 직원 API에는 포함하지 않는다. [Supabase 적용 안내](./Supabase_적용_안내.md)를 참조한다. 탈퇴·회사 이동·이력·관리자 UI·센서 API는 P1 범위 밖이다.
