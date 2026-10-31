# Supabase 적용 안내

> **현재 프로젝트는 006까지 적용 및 설치 확인 완료:** 사용자가 001~006의 적용을 확인했다. [006_seat_movement.sql](./006_seat_movement.sql)은 자리 이동·복귀·자유 사유 저장의 추가 마이그레이션이다. 지금은 확정된 FE를 기다린 뒤 실제 세션 통합 검증을 진행한다. [006 안내](./자리이동_복귀_API.md) 참조. 이미 적용한 초기화·마이그레이션을 다시 실행하지 않는다.

001은 신규 프로젝트 초기 설치용이고 후속 파일은 기존 DB 확장용이다. 현재 프로젝트의 적용 이력은 [진행 기록](./Supabase_진행_기록.md)을 따른다. 로컬 PostgreSQL 검증과 별개로 Supabase Auth·Storage·Data API의 실제 사용자 HTTP 연동 검증은 아직 필요하다.

## 1. 파일 순서

| 파일 | 용도 | 실행 여부 |
|---|---|---|
| 001_sensespace_init.sql | 테이블·제약·함수·권한·RLS·비공개 버킷 설치 | 새 프로젝트에서 한 번 |
| 002_company_setup_example.sql | 회사·층·예시 좌석·30일 가입 코드 생성 | 값 수정 후 필요 시 한 번 |
| 003_rotate_inthon_join_code.sql | 기존 Inthon 코드만 교체 | 이미 재발급 완료. 다시 실행하면 현재 코드 무효화 |
| 004_screen_features.sql | 메시지 20자·독립 이모티콘·캐릭터·팀·알림 확장 | 001이 설치된 DB에 한 번 |
| 005_avatar_catalog.sql | 실제 FE 캐릭터 항목 52개 등록 | 004 이후. 카탈로그 갱신은 재실행 가능 |
| 006_seat_movement.sql | 임시 이동·복귀·자유 사유·통합 점유 보호 | 사용자 적용 및 설치 확인 완료. 재실행하지 않음 |
| tests/bootstrap.sql | 로컬 테스트용 Auth/Storage 모형 | Supabase에서는 실행 금지 |
| tests/scenarios.sql | 가상 계정·회사로 수행하는 로컬 테스트 | Supabase에서는 실행 금지 |

원본 검토 문서에 있는 수정 SQL은 이전 초안용이다. 위 초기화 SQL과 함께 실행하지 않는다.

## 2. 기존 데이터 확인

SQL Editor에서 다음 읽기 전용 쿼리로 확인한다.

```sql
SELECT table_schema,table_name FROM information_schema.tables
WHERE table_schema IN ('public','private')
ORDER BY table_schema,table_name;
```

companies/floors/seats/employees/sensory_profiles/employee_statuses/current_sensations가 이미 존재하면 초기화 SQL을 실행하지 말고 기존 스키마에 맞춘 마이그레이션을 작성해야 한다. 001도 이 경우 오류로 멈추며 기존 데이터를 지우지 않는다. `office-maps` 버킷·동일 이름의 함수나 정책이 이미 있는 경우에도 충돌 여부를 확인한다. 기존 실패 트랜잭션이 열린 상태라면 ROLLBACK 후 원인을 수정한다.

## 3. 최초 설치

1. 새 개발 Supabase 프로젝트를 선택한다.
2. SQL Editor에서 새 쿼리를 열고 `001_sensespace_init.sql` 전체를 붙여넣어 postgres 역할로 실행한다.
3. 성공 후 Table Editor에서 public 업무 테이블 7개를 확인한다. private에는 코드와 호출 제한 테이블 2개가 있다.
4. Storage의 `office-maps` 버킷이 비공개인지 확인한다.
5. API 설정에서 public은 노출하고 private는 Exposed schemas에 추가하지 않는다. Data API가 켜져 있어야 한다.
6. 이 SQL은 재실행용이 아니다. 성공 후 변경은 새 마이그레이션으로 관리한다.

## 4. 회사·지도·좌석 준비

`002_company_setup_example.sql`에 사용자 확정 회사명 `Inthon`을 반영했다. 실제 지도 `fe/정보관_1층.png` 기준으로 층은 1, 원본 크기는 4938×2868이다. 사용자는 모든 의자를 등록하기로 결정하고 [좌석 확인용 지도](./seat_map_preview.html)에서 전체 76석(A 16 / B 4 / C 4 / D 8 / E 8 / F 8 / G 8 / H 8 / I 12)의 번호·배치를 확인했다. 001 설치 후 002 전체를 새 SQL Editor 쿼리에서 한 번 실행한다. 재실행하면 다른 회사가 새로 생기므로 반복 실행하지 않는다.

좌표 원본은 [seat_coordinates.json](./seat_coordinates.json)에 있으며 이미지 SHA-256과 픽셀·비율 좌표를 기록했다. `python -X utf8 be/prepare_seat_map.py`로 SQL의 좌석 목록과 확인용 HTML을 재생성할 수 있다. 원본 PNG는 수정하지 않는다. 지도 교체·자르기·여백 변경 시 좌표도 다시 검토한다.

결과의 company_id, floor_id, map_path를 기록한다. join_code 원문은 권한 있는 담당자에게 전달한다. DB에는 해시만 저장하므로 원문을 잃으면 재발급한다. 코드 만료는 예시 기본 30일이며 필요 시 수정한다.

Storage에서 map_path와 정확히 같은 경로에 실제 map.png를 운영자로 업로드한다. SQL의 경로 등록만으로 파일이 생기지는 않는다. 지도 크기와 좌석 비율을 실제 이미지에 맞추고, 이미지를 교체할 때 좌표도 검토한다. 여러 층은 별도 floors 행과 해당 층 seats 행을 추가한다.

## 5. 코드 교체·폐기

아래 UUID를 실제 회사 ID로 바꿔 SQL Editor에서 실행한다. 교체는 원문을 새로 생성해 반환하고, 이전 코드는 즉시 신규 가입에 사용할 수 없게 한다. 기존 직원은 유지된다.

```sql
WITH new_code AS MATERIALIZED (
  SELECT upper(encode(extensions.gen_random_bytes(12),'hex')) AS raw
), changed AS (
  UPDATE private.company_join_codes c
  SET code_hash=encode(extensions.digest(n.raw,'sha256'),'hex'),
      expires_at=now()+interval '30 days',revoked_at=NULL,created_at=now()
  FROM new_code n
  WHERE c.company_id='실제 회사 UUID'::uuid
  RETURNING c.company_id,c.expires_at
)
SELECT c.company_id,n.raw AS join_code,c.expires_at FROM changed c CROSS JOIN new_code n;
```

폐기는 `UPDATE private.company_join_codes SET revoked_at=now() WHERE company_id='실제 회사 UUID'::uuid;`다. 두 작업은 운영자 전용이다.

## 6. 인증과 FE 연결

Auth에서 이메일 인증 여부와 비밀번호 정책·허용 Redirect URL·메일 발송 설정을 확인한다. 이메일 인증을 켜면 signUp 성공 시 session이 null일 수 있으므로 인증 후 로그인한다. FE 환경 변수에는 프로젝트 URL과 publishable/anon key만 넣는다.

직원 흐름: 회원가입 → 필요 시 이메일 인증 → 로그인 → get_my_membership → 미가입이면 join_company → 프로필·좌석 선택 → 직접 출근.

API 호출 형식은 [API 명세서](./API_명세서.md)를 따른다. 특히 join_company는 SDK error 외에 data.error_code를 검사해야 한다. 직원 테이블에는 select('*')를 사용하지 않는다.

## 7. 실제 프로젝트에서 최종 확인

- 비로그인·미가입·A사 직원 2명·B사 직원 1명으로 테스트한다. SQL Editor의 postgres 조회만으로 권한을 검증하지 않는다.
- A사 JWT로 B사 카드·층·좌석·지도 URL 발급을 시도해 차단되는지 확인한다.
- 다른 직원 수정과 company_id/user_id/role/seat_id 직접 수정이 차단되는지 확인한다.
- 같은 좌석을 두 직원이 동시에 선택하고 한 명만 성공하는지 확인한다.
- 출근 → 메시지·감각 입력 → 퇴근 후 메시지·감각 초기화, 좌석·민감도 유지, 퇴근 중 입력 차단을 확인한다.
- 코드 오류·만료·폐기·같은 회사 재가입·다른 회사 가입·6번째 연속 호출 제한을 확인한다.
- 실제 지도 이미지 다운로드·signed URL 만료·화면 크기에 따른 좌표를 확인한다.
- 카드가 50명/200명을 넘는 경우 모든 페이지 조회와 미니맵 점유 연결을 확인한다.
- 로그아웃·재연결·탭 복귀 시 캐시 정리와 재조회를 확인한다.

초기화 SQL은 Realtime publication을 추가하지 않는다. 프로젝트에서 전체 테이블을 자동 publication에 포함하거나 별도 권한·정책을 추가했다면 격리 조건을 다시 확인한다. 즉시 반영 대신 활성 탭 5초 polling을 기본으로 적용했다.

## 8. 검증 근거

[검토 결과](./설계_검토_결과.md)에 요구사항 대조와 실행 범위를 기록했다. 공식 근거: [Supabase 함수 권한](https://supabase.com/docs/guides/database/functions), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Storage 권한](https://supabase.com/docs/guides/storage/security/access-control).

## 9. 004·005 실행 전후

1. 기존 프로젝트의 개발 DB에서 20자 초과 메시지를 조회한다. 결과가 있으면 작성자와 내용을 정리한 뒤 진행한다. 자동으로 잘라내지 않는다.
2. `004_screen_features.sql` 전체를 새 SQL Editor 쿼리에서 한 번 실행한다. 중복 실행은 migration version PK로 거부한다.
3. 성공하면 `005_avatar_catalog.sql` 전체를 별도 쿼리에서 실행한다.
4. `SELECT category_id,count(*) FROM public.avatar_items WHERE enabled GROUP BY category_id ORDER BY category_id;`로 7개 카테고리 합계 52개를 확인한다.
5. 실제 사용자 세션으로 캐릭터 저장/조회, 20자 허용/21자 거부, 독립 이모티콘, 업무 정보 탭과 알림을 테스트한다.

현재 FE는 localStorage 데모라 SQL만 실행해도 실제 서버 연결 화면이 되는 것은 아니다. FE 어댑터·Auth·실제 지도 연결 변경이 필요하다. 외부 OpenAI 호출은 구현하지 않았다.
