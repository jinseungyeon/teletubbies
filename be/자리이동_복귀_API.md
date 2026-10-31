# 자리 이동·복귀·자유 자리비움 사유 — 006

작성일: 2026-11-01. 구현 및 로컬 PostgreSQL 17 검증 완료. **사용자가 실제 Supabase의 006 실행과 설치 확인 쿼리 성공을 확인했다.** 실제 직원 세션과 FE 통합 검증은 남아 있다.

이번 범위는 임시 좌석 이동·복귀·자유 사유 저장이다. 공유 팀 영역은 만들지 않는다. 새 FE의 지도·캐릭터·업무 항목·알림과 공간 감각 집계 연결은 이번 SQL에서 변경하지 않는다.

## 1. 적용

현재 Inthon 프로젝트는 006 적용 및 설치 확인이 끝났으므로 다시 실행하지 않는다. 다른 환경에서 처음 적용할 경우 001·004·005가 적용된 프로젝트에서 [006_seat_movement.sql](./006_seat_movement.sql) 전체를 SQL Editor의 새 쿼리에서 한 번 실행한다. 회사·지도·배정 좌석·캐릭터는 재생성하지 않는다.

006 전체는 한 트랜잭션이다. 실패하면 전체가 취소된다. 같은 006을 다시 실행하면 마이그레이션 버전 중복으로 거부하므로 성공 후 반복 실행할 필요가 없다. 검증용 `be/tests/*.sql`은 로컬 테스트 전용이며 Supabase에 붙여 넣지 않는다.

적용 확인용 읽기 쿼리:

```sql
select version, applied_at
from private.sensespace_migrations
where version = '006_seat_movement';

select proname
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and proname in ('move_to_seat', 'return_to_seat',
                  'set_away_reason_text', 'get_employee_location')
order by proname;
```

첫 결과에 버전 1행, 두 번째에 함수 4개가 보여야 한다. 이 조회는 설치 확인이며 실제 로그인 세션 테스트를 대신하지 않는다.

## 2. 저장 구조와 보호 규칙

| 저장 위치 | 의미 |
|---|---|
| employees.seat_id | 원래 배정 좌석. 이동·복귀·퇴근해도 유지 |
| employees.temporary_seat_id | 현재 임시 목적지. 평소/복귀/퇴근 후 NULL |
| employee_statuses.away_reason | 기존 기본 사유 lunch / meeting / outside 또는 NULL |
| employee_statuses.away_reason_text | 직접 작성 사유. 최대 20자, 없으면 NULL |
| private.seat_claims | 원래 좌석과 임시 좌석을 통합 점유하는 내부 테이블. FE 직접 접근 불가 |

**기본 사유와 자유 사유는 둘 중 하나만 사용한다.** 기본 사유를 선택하면 자유 사유를 지우고, 자유 사유를 저장하면 기본 사유를 지운다. 둘 다 NULL이면 아이콘만 표시할 수 있다. 새 기본 사유 enum은 추가하지 않았다. 사유는 기존 status_message 및 quick_emoji_id와 별개다.

공통 규칙:

- 로그인한 본인 직원만 변경 가능. 같은 회사의 좌석만 이동 가능하며 같은 회사의 다른 층도 허용한다.
- 다른 직원의 배정 좌석은 그 직원이 퇴근/이동 중이어도 사용 불가. 임시 점유된 좌석에도 이동·배정 불가.
- 원래 좌석이 없는 직원은 먼저 choose_seat로 배정해야 한다. 퇴근 상태의 이동·복귀는 차단한다.
- 이동 요청은 자동 출근을 대신하지 않는다. working/away에서 이동하면 away가 된다.
- 이동·연속 재이동·복귀·실제 off_work→working 전환은 현재 감각 6개를 모두 실제 NULL로 초기화한다.
- 평소 민감도·설명·독립 이모티콘·캐릭터는 유지한다. 상태 메시지는 이동/복귀 때 유지하고 퇴근 때만 지운다.
- 실패한 이동은 이전 위치·근태·사유·감각을 함께 유지한다. 동시 점유는 단일 점유 키로 막고 회사별 전이 잠금으로 순서를 정한다.
- 감각의 항목별 관측 시각·근무일/방문 범위와 공간 집계는 이번 범위에서 구현하지 않았다. 기존 updated_at을 항목별 입력 시각으로 재사용하지 않는다.

## 3. 이동

```ts
const { data, error } = await supabase.rpc('move_to_seat', {
  p_employee_id: employeeId,
  p_seat_id: destinationSeatId,
});
```

좌석 ID는 DB의 UUID다. A-01 같은 화면 라벨이나 FE 배열 인덱스를 넘기지 않는다.

성공하면 배정 좌석은 유지하고 임시 목적지를 교체한다. status=away, 기본/자유 사유=NULL, 감각 6개=NULL이 된다. 재이동 시 이전 임시 목적지를 해제한다. 사유가 비어도 이동은 성공한다.

이미 같은 임시 목적지에 있는 상태에서 재요청하면 현재 결과만 반환한다. 이후 입력한 사유·감각을 지우지 않는다. 원래 배정 좌석을 목적지로 보내면 USE_RETURN_TO_SEAT이며 복귀 RPC를 사용해야 한다.

## 4. 복귀

```ts
const { data, error } = await supabase.rpc('return_to_seat', {
  p_employee_id: employeeId,
});
```

임시 목적지를 해제하고 원래 층/좌석으로 돌아온다. status=working, 기본/자유 사유=NULL, 감각 6개=NULL이다. 상태 메시지는 유지한다.

이미 임시 이동 중이 아니면 값을 지우지 않고 현재 결과만 반환한다. 이는 응답 유실 후 복귀 재요청이 새 입력을 삭제하는 것을 막기 위한 처리다. 목적지 없는 수동 away를 이 RPC로 working으로 바꾸지는 않는다. 수동 away 해제는 기존 set_employee_status를 사용한다.

## 5. 자유 사유 저장·삭제

```ts
const { data, error } = await supabase.rpc('set_away_reason_text', {
  p_employee_id: employeeId,
  p_reason_text: '물을 가지러 갔어요',
});
```

away 상태에서만 가능하다. 근태나 좌석을 변경하지 않으므로 먼저 자리비움으로 바꾸거나 이동을 완료해야 한다. 이동 성공 후 이 RPC로 선택 사유를 저장할 수 있으며, 사유 저장 실패가 이미 성공한 이동을 취소하지는 않는다.

앞뒤 일반 공백을 제거하고 PostgreSQL length 기준 Unicode 코드 포인트 최대 20자를 검사한다. FE에서는 `[...text].length` 기준으로 맞춘다. 빈 문자열·공백만 있는 문자열·NULL은 자유 사유를 NULL로 지운다. 이 API를 사용하면 기본 사유도 NULL이 된다. 상태 메시지는 바뀌지 않는다.

기본 사유 선택은 기존 RPC를 사용한다. 이때 자유 사유가 지워진다.

```ts
await supabase.rpc('set_employee_status', {
  p_employee_id: employeeId,
  p_status: 'away',
  p_away_reason: 'lunch',
});
```

006 이후 away에서 p_away_reason=NULL도 허용한다. 이미 away이고 기본 사유를 지정하지 않았다면 현재 자유 사유는 유지한다. 기본 사유 또는 자유 사유를 명시적으로 바꾸거나 지우려면 위 API를 사용한다.

복귀·working 전환·퇴근 시 사유를 지운다. 다른 임시 목적지로 재이동할 때도 지난 사유를 지운다.

## 6. 공통 변경 응답·조회

세 변경 RPC와 기존 set_employee_status는 다음 구조를 반환한다. status와 sensations의 기존 키는 유지하며 location이 추가된다.

```ts
{
  status: { employee_id, status, away_reason, away_reason_text,
            status_message, quick_emoji_id, updated_at },
  sensations: { employee_id, temperature_level, humidity_level, noise_level,
                odor_level, discomfort_level, crowd_level, updated_at },
  location: {
    employee_id, status,
    assigned_seat: { id, label, floor_id, floor_number, x_ratio, y_ratio },
    temporary_seat: null, // 이동 중에는 같은 구조의 목적지 좌석
    current_seat: null,   // working/away는 목적지 또는 배정 좌석, off_work는 null
    is_moving: false
  }
}
```

배정이 없으면 assigned_seat도 NULL이다. current_seat는 지도에 사용할 현재 등록 위치이며, 목적지 없는 수동 자리비움 직원이 실제 사무실에 있는지를 보장하는 값은 아니다. 그 경우의 공간 인원·집계 정책은 확정 전이며 이 값만으로 집계하지 않는다.

```ts
const { data, error } = await supabase.rpc('get_employee_location', {
  p_employee_id: targetEmployeeId,
});
```

같은 회사 직원은 조회할 수 있고 다른 회사·대상 없음은 NULL이다. get_sensory_cards, get_employee_work_info, get_my_membership에도 location을 추가했다. 직원 카드의 기존 seat와 회원 정보의 seat_id는 계속 **배정 좌석**을 의미한다. away_reason_text는 카드 status와 업무 정보 status에서 읽는다.

빈 자리 후보는 같은 회사 seats에서 모든 직원의 배정 좌석과 임시 목적지를 제외해 표시할 수 있다. 직원 목록은 페이지를 끝까지 조회해야 하며 FE 후보 계산 후에도 최종 점유 판정은 이동 RPC가 한다.

## 7. 기존 API와 동시 요청

- set_employee_status(..., 'working'): 임시 이동 중이면 원자적으로 복귀한다. 실제 출근 전환 또는 임시 위치 복귀일 때 감각을 초기화한다. 이미 본래 자리에서 working인 상태의 재요청은 입력을 지우지 않는다.
- set_employee_status(..., 'off_work'): 임시 목적지·사유·메시지·감각을 함께 해제/초기화한다. 원래 좌석은 유지하며 다음 출근은 원래 좌석이다.
- choose_seat: 배정 변경용이다. 이동 중 배정 변경/해제는 RETURN_REQUIRED로 막는다. 배정이 실제로 바뀌면 감각도 초기화한다. 같은 배정의 재요청은 변경하지 않는다.
- 감각·메시지·사유 쓰기는 동일한 상태 행 잠금과 직렬화된다. 예를 들어 사유 쓰기가 먼저면 뒤의 복귀가 지우고, 복귀가 먼저면 뒤의 사유 쓰기는 EMPLOYEE_NOT_AWAY다.
- 이 API들은 요청 ID 기반의 완전한 중복 제거를 제공하지 않는다. FE는 같은 직원의 위치 변경을 동시에 여러 개 보내지 말고 요청 중 버튼을 잠근다. 목적지가 달라지는 재요청은 새 이동이다.

## 8. 오류

| 오류 | 의미 |
|---|---|
| LOGIN_REQUIRED | 로그인 세션 필요 |
| NOT_YOUR_EMPLOYEE | 본인 직원이 아니거나 대상 없음 |
| EMPLOYEE_NOT_WORKING | 퇴근 상태에서 이동/복귀 요청 |
| ASSIGNED_SEAT_REQUIRED | 원래 배정 좌석이 없음 |
| INVALID_SEAT | NULL·존재하지 않음·다른 회사 좌석 |
| SEAT_TAKEN | 배정 또는 임시 점유 중인 좌석 |
| USE_RETURN_TO_SEAT | 원래 좌석으로 가려면 복귀 RPC 사용 |
| RETURN_REQUIRED | 임시 이동 중에는 배정 좌석 변경 불가 |
| EMPLOYEE_NOT_AWAY | 자리비움 상태가 아닌데 자유 사유 작성 |
| INVALID_AWAY_REASON_TEXT | 정규화 후 자유 사유가 20자 초과 |

기존 INVALID_STATUS / INVALID_AWAY_REASON / INVALID_STATUS_TRANSITION도 유지한다. SDK의 error를 확인한 뒤 성공 상태를 표시한다. 실패 시 로컬 위치를 먼저 확정하지 말고 최신 카드/위치를 다시 읽는다.

## 9. FE 담당 범위와 보류

- location.is_moving이면 원래 assigned_seat에 중간 투명도 잔상, temporary_seat에 현재 캐릭터를 그린다. 복귀 버튼도 이 값으로 전환한다.
- off_work이면 assigned_seat에 이동 때보다 더 투명한 캐릭터를 표시한다. opacity 숫자는 BE에 저장하지 않는다.
- 지도·내 정보 창은 같은 away_reason_text를 사용한다. 빈 값은 사유 텍스트 없이 아이콘만 표시할 수 있다.
- 줌에 따른 텍스트 숨김/표시와 드래그 팀 영역은 FE에서 처리한다. 이번에 FE 파일·확대/축소 코드는 변경하지 않았다.
- 팀 영역은 동료와 공유하지 않기로 확정했다. BE 저장 테이블/API를 추가하지 않았다.
- 새 FE 확정 후 지도·캐릭터·업무 정보·알림 및 집계 연결을 별도로 결정한다. OpenAI 생성과 환경 변화 알림 등 제외 기능은 추가하지 않았다.

## 10. 검증

로컬 PostgreSQL 17의 Auth/Storage 테스트 대역에서 기존 P1·004/005 시나리오 후 006을 설치해 검증했다.

- 기존 직원·배정 보존, 신규 직원 점유 연동, 006 반복 실행 거부.
- 본인 수정·회사별 조회·익명/직접 수정/내부 도우미 접근 차단.
- 이동·연속 이동·다른 층 복귀·퇴근 중 이동 차단·배정 없는 이동 차단.
- 사유 20자·기본/자유 상호 배제·삭제·복귀/퇴근 초기화·메시지/민감도 보존.
- 감각 6개 NULL, 실패한 이동 유지, 같은 목적지/복귀의 재요청 보호.
- 동시 이동의 단일 승자, 배정과 임시 점유 충돌 양방향, 이동/퇴근·사유/복귀·감각/복귀의 양방향 순서.

재실행: 로컬 `postgres:17-alpine` 컨테이너 이름 `sensespace-movement-review`를 준비한 뒤 `python be/tests/run_movement_checks.py`를 사용한다. 테스트마다 새 DB를 만든다. 실제 Supabase Auth/Data API 및 FE 통합 검증은 적용 후 필요하다.
