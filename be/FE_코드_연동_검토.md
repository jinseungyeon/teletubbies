# 가져온 FE 코드와 백엔드 연결 검토

> 후속 적용 확인: 사용자가 004·005를 Supabase에 실행하고 메시지 20자 제약, 이모티콘 12개, 캐릭터 카테고리 7개/활성 항목 52개를 확인했다. 아래 구현 시점의 미적용 기록과 구별하며 최신 적용 현황은 [Supabase 진행 기록](./Supabase_진행_기록.md)을 따른다. 실제 사용자 세션 통합 검증은 아직 남아 있다.

검토일: 2026-11-01. 대상: fe/src/{app,data,character,map,heatmap}.js 및 be/001,004,005 SQL.

## 1. 현재 상태

- FE는 Next.js가 아닌 순수 JavaScript ES Module + Node 정적 서버다. package.json은 dev/start/test/check만 제공한다.
- app.js는 `createAdapter(localStorage)`를 사용한다. 아직 Supabase 클라이언트가 없고 실제 프로젝트 URL·키를 소비하는 코드도 없다.
- 사진·캐릭터·감각 지도 UI는 구현되어 있지만 데이터는 브라우저 안의 가상 계정/좌석 데이터다. UI 구현과 Supabase 통합 완료를 구별한다.
- 실제 그림은 character.js의 코드 기반 SVG다. 별도 PNG 파츠 파일이 없는 것은 에셋 누락이 아니다.
- OpenAI API 연동은 사용자 요청으로 이번 작업에서 제외했다. 현재 사진 처리는 Canvas 색상 샘플링 데모이며 실제 AI 생성이 아니다.

## 2. 사용자 확정 사항

| 항목 | 적용 계약 |
|---|---|
| 현재 감각 | 기존 6개 유지. 조명 추가 없음 |
| 메시지 | DB 최대 20자. 퇴근 시 삭제, 퇴근 중 작성 차단 유지 |
| 빠른 상태 | 이모티콘만 선택. 메시지·출퇴근과 독립 저장 |
| 업무 정보 탭 | 이름·직책·층·좌석, 시각·청각·후각 민감도, 근태·자리 비움 사유 |
| 캐릭터 | 실제 FE 항목 ID를 사용. OpenAI 생성은 나중에 진행 |

## 3. 실제 캐릭터 카탈로그

| FE 정의 | 개수 | DB category_id | 저장하는 실제 ID |
|---|---:|---|---|
| HAIR_STYLES | 6 | hair_style | bob/bun/wavy/short/straight/braids |
| HAIR_COLORS | 8 | hair_color | 색상 HEX |
| EYE_COLORS | 6 | eye_color | 색상 HEX |
| OUTFITS | 6 | outfit | tee/collar/cardigan/hoodie/vest/overall |
| OUTFIT_COLORS | 20 | outfit_color | 색상 HEX |
| SKINS | 4 | special_skin | red/yellow/green/purple |
| GENDERS | 2 | gender | f/m. 그림의 의상 실루엣 분류 |
| 합계 | 52 | | |

`sync_character_catalog.mjs`가 FE 정의를 직접 import하여 `005_avatar_catalog.sql`과 `avatar_catalog.json`을 생성한다. 손으로 만든 가상 항목 ID는 사용하지 않았다. metadata.frontend_index에 현재 배열 순서를 기록하고 DB에는 안정적인 항목 ID를 저장한다.

카탈로그를 변경할 때 스크립트를 재실행하고 005와 FE 코드를 같은 버전으로 적용한다. 스크립트 실행은 `node be/sync_character_catalog.mjs`다. 비활성 항목은 신규 선택을 막되 기존 렌더링 정보는 조회 가능하다. 카탈로그 수정은 운영자만 한다.

## 4. 004·005에서 준비한 기능

**적용 순서: 이미 설치된 001 위에 004 → 005.** 001·002·003을 다시 실행하지 않는다. 004는 한 번만, 005는 카탈로그 새로고침을 위해 재실행할 수 있다. 이번 작업에서는 실제 Supabase에 004·005를 실행하지 않았다.

004는 20자를 넘는 기존 메시지가 있으면 전체를 취소한다. 데이터를 자동으로 자르지 않는다. 실행 전 조회:

```sql
SELECT employee_id, length(status_message) AS message_length
FROM public.employee_statuses WHERE length(status_message) > 20;
```

### 메시지와 이모티콘

- set_status_message 기존 인자는 유지한다. DB CHECK와 RPC가 모두 PostgreSQL length 기준 20자를 제한한다.
- FE의 Intl.Segmenter grapheme 수는 DB 코드 포인트 수와 다를 수 있다. DB 기준에 맞출 때 `[...text].length`를 사용한다.
- `quick_emojis`는 현재 FE QUICK_STATUS의 12개 이모티콘을 제공한다. `id,emoji,label,sort_order`를 sort_order로 정렬해 조회한다.
- `set_quick_emoji({p_employee_id,p_emoji_id})`: 본인만 변경. null이면 해제, 잘못된 ID는 INVALID_QUICK_EMOJI. 응답은 변경된 상태 행이다.
- 상태 메시지를 지워도 이모티콘은 남고, 이모티콘을 선택해도 메시지나 근태가 바뀌지 않는다. 카드 status.quick_emoji는 `{id,emoji}` 또는 null이다.
- 추가 제품 결정 전 기본안으로 독립 이모티콘은 퇴근 중에도 변경 가능하며 퇴근 시 유지한다. 메시지의 퇴근 삭제·차단과는 별도다. 다른 정책을 원하면 별도 확정 후 변경한다.

```js
await supabase.rpc('set_quick_emoji', {
  p_employee_id: employeeId, p_emoji_id: 'coffee',
});
```

### 현재 FE 형태 그대로 캐릭터 저장

```js
const { data, error } = await supabase.rpc('save_character', {
  p_employee_id: employeeId,
  p_character: {
    hair: 0, hairColor: 0, eye: 0, gender: 'f',
    outfit: 0, color: 0, skin: null,
  },
});
```

7개 키를 모두 전달한다. hair 0~5, hairColor 0~7, eye 0~5, outfit 0~5, color 0~19는 정수다. gender는 f/m, skin은 null 또는 red/yellow/green/purple다. 알 수 없는 키·문자열 숫자·소수·범위 밖 값은 INVALID_CHARACTER, 미등록/비활성 선택은 INVALID_AVATAR_ITEM, 타인 수정은 NOT_YOUR_EMPLOYEE다.

응답은 `{employee_id,selections,is_complete,updated_at,character}`. 카드와 내 소속의 `avatar`에도 `{selections,is_complete,updated_at,character}`가 추가된다. FE user.character에 avatar.character를 연결한다. 미완료 캐릭터의 character는 null이다. 특별 스킨만 선택해 완료한 경우 기본 파츠는 renderer 기본값으로 반환한다. 퇴근해도 외형은 유지한다.

원시 ID 방식은 `save_employee_avatar({p_employee_id,p_selections,p_complete})`다. selections는 category_id → item_id 문자열/null 객체이며 **전체 교체**다. 기본 p_complete=true일 때 기본 파츠·실루엣을 모두 선택하거나 특별 스킨을 선택해야 한다. false는 초안 저장이다. 오류는 INVALID_AVATAR_SELECTIONS / INVALID_AVATAR_CATEGORY / INVALID_AVATAR_ITEM / INCOMPLETE_AVATAR다.

### 업무 정보

`get_employee_work_info({p_employee_id})`는 같은 회사 직원의 `{employee_id,name,job_title,team,seat,profile,status}`를 반환한다. seat에 floor_number/label/좌표, profile에 민감도·설명, status에 근태·자리 비움 사유·updated_at이 있다. 다른 회사/없는 직원/null 인자는 null이다. 이 API의 status에는 메시지·이모티콘을 섞지 않는다.

### 팀과 알림

- teams에서 같은 회사의 `id,company_id,name`을 읽는다. 카드와 내 소속 응답에 team `{id,name}` 또는 null이 추가된다. 실제 팀 명단이 없어 가상 팀을 운영 데이터로 등록하지 않았다. 팀 등록·직원 지정은 운영자가 한다.
- notifications에서 자신의 `id,kind,title,body,read_at,created_at`만 조회한다. created_at 내림차순·id 정렬과 범위 페이지를 사용한다. read_at IS NULL로 읽지 않은 개수를 센다.
- `mark_notification_read({p_notification_id})`는 본인 알림만 읽음 처리한다. 응답은 변경 행, 오류는 NOT_YOUR_NOTIFICATION이다. 재요청은 최초 read_at을 유지한다.
- 알림 생성 기본안은 본인 좌석 변경/해제이며 운영자가 system 알림을 추가할 수 있다. 클라이언트의 임의 발송·직접 INSERT/UPDATE/DELETE는 차단한다. 푸시·이메일 발송은 포함하지 않는다.

## 5. FE 담당자가 바꿔야 하는 연결 지점

| 현재 FE 코드 | 실제 연결 시 필요한 변경 |
|---|---|
| createAdapter(localStorage) | Supabase 어댑터를 연결하고 Auth·RPC 오류를 처리 |
| login(email), 비밀번호는 폼에서만 받음 | password도 어댑터에 전달하고 auth.signInWithPassword 사용 |
| signup의 ONYU2026 검사 | 실제 Auth 가입 후 Inthon join_company. 업무 실패 data.error_code도 검사 |
| COMPANY='온유 스튜디오', FLOORS=[2,3] | get_my_membership·floors 응답 사용. 실제 등록은 Inthon 1층 |
| 가상 1200×640 지도·데스크 좌석 | office-maps 원본 4938×2868 지도·76개 좌석과 DB 좌표 사용. heatmap 좌표/클리핑도 실제 지도 기준으로 조정 |
| seat='A-01' 문자열 | 내부 저장·수정은 좌석 UUID, 화면 표시만 label |
| u.role이 '직책' | DB job_title과 매핑. DB role 권한 필드와 혼용하지 않음 |
| status='offline' | DB off_work와 양방향 매핑. 다른 상태는 working/away |
| reason='점심'/'미팅'/'외근' | DB lunch/meeting/outside와 매핑 |
| smell/crowding 등 감각 키 | odor_level/crowd_level 등 아래 매핑 사용 |
| api.message(value,icon), pickQuickIcon/saveQuick | 메시지와 이모티콘 API를 분리. 메시지가 없어도 이모티콘 클릭을 즉시 저장·표시 |
| 메시지 작성 시 offline 검사 없음 | 퇴근 UI 비활성화 + EMPLOYEE_NOT_WORKING 처리 |
| currentSenses가 working만 허용 | away의 마지막 감각도 표시·수정 가능하도록 계약과 일치시킴 |
| currentSenses의 자정 자동 숨김 | 기존 서버 계약에는 자정 만료 없음. 별도 합의 전 제거하거나 UI 정책임을 명확히 정의 |
| 15초 재조회 | 계약 기본안은 활성 탭 5초. 복귀/재연결 재조회도 구현 |
| notifications가 고정 토스트 | 본인 notifications 목록/읽지 않은 개수/읽음 RPC에 연결 |
| complete 로컬 플래그 | 서버에 동일 필드가 없으므로 avatar.is_complete와 실제 프로필 필수 입력 상태로 UI 완료를 판정. 독립 완료 플래그가 필요하면 별도 설계 |
| FE 설명 최대 300자 | DB는 1,000자. FE의 더 엄격한 제한은 저장 가능하나 제품 제한 문구는 맞출 필요 있음 |

감각 매핑:

```text
temperature -> temperature_level
humidity    -> humidity_level
noise       -> noise_level
smell       -> odor_level
discomfort  -> discomfort_level
crowding    -> crowd_level
```

FE의 me.id는 직원 employee_id에 연결한다. Auth user.id는 로그인 계정 ID로 다른 값이다. 민감도 키 visual/auditory/olfactory는 각각 visual_sensitivity/auditory_sensitivity/olfactory_sensitivity다. 감각 PATCH에서 미공유로 바꿀 항목은 null을 명시한다. 단순 생략은 서버 값 유지다.

팀/알림/실제 지도 연동 및 위 어댑터 교체는 이번 BE 작업에서 FE 파일을 수정해 완료한 것이 아니다. 별도 FE 담당자가 연결해야 한다.

## 6. 검증 결과와 남은 단계

- FE 기존 테스트 13개 통과(Node 22): 코드 캐릭터·특별 스킨·감각 지도. 이 테스트는 현재 데모 동작 검증이며 실제 사용자 인증 검증이 아니다.
- PostgreSQL 17에서 기존 001·업무 시나리오 통과 후 004·005 설치 검증.
- 기존 21자 메시지 보존과 마이그레이션 전체 롤백, 004 중복 적용 차단, 005 반복 적용 검증.
- 한글 20자 허용/21자 거부, 이모티콘과 메시지·근태의 독립성, 6개 감각 유지 확인.
- 실제 FE 52개 항목 선택을 모두 저장 후 동일 native character JSON으로 조회하는 왕복 검증 통과.
- 캐릭터 본인 수정·동료 조회·타사 차단, 카탈로그 검증, 신규 직원 초기화, 업무 정보, 회사별 팀, 본인 알림·읽음 처리 검증.
- 퇴근/메시지·퇴근/감각 동시 요청 양방향, 이모티콘/메시지 동시 저장 검증 통과.
- 실제 Supabase의 004·005 적용, Auth·RLS·Storage HTTP, FE 어댑터 연결은 아직 남아 있다. AI는 보류하며 관련 외부 호출을 하지 않았다.

로컬 재현: 외부 포트 없는 postgres:17-alpine 컨테이너 `sensespace-screen-review`를 만든 뒤 `python -X utf8 be/tests/run_screen_checks.py` 실행. 테스트 파일은 실제 Supabase에 실행하지 않는다.
