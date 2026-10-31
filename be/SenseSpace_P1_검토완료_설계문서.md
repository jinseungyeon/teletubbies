# SenseSpace P1 MVP — 검토 완료 설계 문서

> **후속 설계 안내 (2026-10-31):** 이 파일은 이전 검토 기록이다. 이후 확정된 한 계정 한 회사, 퇴근 시 메시지 삭제, 퇴근 중 메시지 변경 금지는 [DB 명세서](./DB_스키마_명세서.md)와 [API 명세서](./API_명세서.md)를 따른다. 새 프로젝트 설치에는 [001 전체 SQL](./001_sensespace_init.sql)과 [적용 안내](./Supabase_적용_안내.md)를 사용한다. 아래 부분 수정 SQL과 함께 실행하지 않는다. 최신 검증 범위는 [검토 결과](./설계_검토_결과.md)에 있다.

- 작성일: 2026-10-31 (Asia/Seoul)
- 버전: 1.1 · P1 요구사항 대조 및 설계 보완본
- 대상: BE 구현 담당자, FE 연동 담당자
- 검토 근거: 기존 대화 「백엔드 프로젝트 정리」의 사용자 결정, 이번 대화에 제공된 전체 SQL/API 초안, 마지막에 재확인한 P1 목록
- 검토 수준: 요구사항 대조 및 SQL 정적 검토 완료. Supabase 실행·동시성·RLS·Realtime 통합 테스트는 미실시.

> **판정:** P1의 주요 저장 항목은 기존 초안에 모두 존재한다. 다만 통합 조회, 미니맵 표시 계약, 동시성, 지도 파일 권한, 실시간 예외 처리가 부족하다. 이 문서는 그 부분을 보완한다. 아래 SQL은 제공된 기존 초안에 적용하는 수정 SQL이며, 빈 DB에 단독 실행하는 전체 설치 SQL이 아니다. 실행 검증 완료 또는 배포 완료를 뜻하지 않는다.

## 1. 확정·미정·추가 구현사항의 구분

- **확정:** 사용자가 명시적으로 결정한 제품 요구사항.
- **미정:** 사용자 또는 FE와 추가 합의해야 하는 정책·표현 방식.
- **추가 구현사항:** 확정 요구사항을 안전하게 구현하기 위해 이번 검토에서 제안한 기술 작업. 제품 합의나 구현 완료로 간주하지 않는다.
- **기존 초안 선택:** 이전 답변이 채택한 기술·정책. 사용자 확정 사항과 구분한다.

### 1.1 확정 요구사항

| ID | 확정 사항 |
|---|---|
| D01 | 여러 기업을 지원하고 기업별 데이터 접근을 분리한다. |
| D02 | 유효한 기업별 가입 코드로 기업에 가입한다. |
| D03 | 사무실 지도는 미리 제작하고 좌석 좌표를 지정한다. |
| D04 | 직원이 빈 좌석을 직접 선택한다. 중복이면 오류를 표시하고 다시 선택하게 한다. |
| D05 | 현재 감각은 직원이 직접 입력한 주관적 체감이다. 센서 측정값이 아니다. |
| D06 | 감각 수치는 1~5 정수이며 온도·습도는 3을 중심으로 양방향이다. |
| D07 | 로그인과 출근은 별개이며 직원이 근태 상태를 직접 변경한다. |
| D08 | 같은 회사 직원은 서로의 감각 카드 전체를 조회한다. |
| D09 | 퇴근 시 현재 감각을 초기화한다. |
| D10 | 미니맵의 감각 버튼은 직원 자리별 현재 감각을 색으로 표시한다. |
| D11 | 카드에는 현재 감각 6개, 미니맵에는 청각·후각·온도·습도 4개 버튼을 제공한다. |
| D12 | 출근·자리 비움·퇴근, 자리 비움 사유 점심·미팅·외근, 자유 텍스트 상태 메시지를 지원한다. |

### 1.2 미정 사항과 문서의 기본안

| 항목 | 현재 상태 | 구현을 위한 기본안 |
|---|---|---|
| 한 계정의 복수 기업 소속 | 기존 DB는 지원, 제품·FE 정책 미정 | DB 지원 유지. 회사 전환 UI와 현재 회사 선택은 별도 결정 |
| 퇴근 시 좌석 해제 | 미정 | 좌석 유지. 퇴근은 좌석 반납으로 해석하지 않음 |
| 퇴근 시 상태 메시지 삭제 | 미정 | 메시지 유지. 감각 6개만 초기화 |
| 퇴근 중 감각 입력 | 기존 초안에서 차단 | 차단 유지. 출근·자리 비움에서만 입력 |
| 퇴근 → 자리 비움 직접 변경 | 미정 | 기본안은 출근을 먼저 거치도록 제한 |
| 좌석 없이 출근 | 미정 | 허용. 카드에는 위치 미지정, 미니맵에는 표시하지 않음 |
| 민감도 1~5의 문구 | 1~5 저장은 기존 초안 선택, 세부 문구 미정 | 1 낮음 / 3 보통 / 5 높음 |
| 토글 복수 선택 | 미정 | 한 번에 하나 선택, 다시 누르면 해제 |
| 퇴근·자리 비움 직원의 지도 표현 | 미정 | 퇴근은 비활성 표시, 자리 비움은 배지와 마지막 입력 유지 |
| 가입 코드 만료·교체 정책 | 미정 | 만료·폐기 필드 추가, 운영자가 교체 가능 |
| 메시지·설명 길이 | 미정 | 메시지 200자, 추가 설명 1,000자 제안. 기존 SQL에는 제한 없음 |
| 갱신 지연 허용치 | 미정 | 초기 연동은 5초 재조회 제안. 즉시 반영은 기업별 비공개 Broadcast 추가 |

이 문서의 수정 SQL은 위 기본안 중 상태 전이와 퇴근 중 입력 차단을 구현한다. 다른 기본안은 FE·운영 정책으로 남으며, 확정 요구사항으로 바꾸지 않는다.

## 2. P1 전체 대조표

| P1 요구 | 기존 DB/SQL/API 근거 | 검토 결과 및 보완 |
|---|---|---|
| 회원가입·로그인 | Supabase Auth | 존재. 이메일 인증 후 세션 생성과 기업 가입을 분리 |
| 기업 코드 가입 | private.company_join_codes, join_company | 존재. 만료·폐기·정규화·반복 가입 처리 보완 |
| 출근·자리 비움·퇴근 | employee_statuses.status | 존재. 상태 전이와 원자적 변경 RPC 추가 |
| 점심·미팅·외근 | away_reason + CHECK | 존재. 상태와 사유를 같은 요청으로 변경 |
| 이름·직책 | employees.name, job_title | 존재. 본인만 수정 |
| 층·위치 | employees → seats → floors | 존재. 카드 통합 응답에 층·좌석명·좌표 포함 |
| 시각·청각·후각 민감도 | sensory_profiles의 3개 필드 | 존재. 현재 소음·냄새와 혼동하지 않음 |
| 추가 설명 | sensory_profiles.description | 존재. 자유 텍스트 표시·길이 협의 |
| 현재 감각 6개 | current_sensations의 6개 필드 | 모두 존재. 부분 수정·NULL·퇴근 동시 처리 보완 |
| 카드의 현재 상태 | employee_statuses | 존재. 감각·좌석과 함께 한 쿼리로 조회 |
| 자유 텍스트 상태 메시지 | status_message | 존재. 별도 수정 API와 빈 문자열 삭제 규칙 명시 |
| 지도 실제 모양·층 선택 | floors.map_path, floor_number | 저장 구조 존재. 이미지 크기·접근 권한·렌더링 계약 보완 |
| 직원 위치 표시 | seats.x_ratio, y_ratio | 존재. 회사 간 연결 무결성을 복합 FK로 강화 |
| 청각·후각·온도·습도 토글 | 감각 원본은 존재 | 통합 조회 및 정확한 필드 매핑 추가 |
| 같은 회사 카드 전체 공개 | SELECT RLS | 존재. 다른 직원 수정 금지와 분리하여 검증 |
| 좌석 중복 오류 | UNIQUE(seat_id), choose_seat | 원자성 확보. 충돌 후 기존 좌석 유지·목록 재조회 명시 |
| 퇴근 감각 초기화 | checkout 트리거 | 존재. 감각 수정 트리거와의 잠금 순서 교착 위험 보완 |

**기능 누락 판정:** 저장 컬럼 자체의 큰 누락은 없다. 기존 초안을 바로 FE 전달용 최종본으로 쓰기에는 동작 계약과 보안 검증이 부족했다.

## 3. 실제 초안에서 발견한 설계 문제

| 우선순위 | 발견 내용 | 영향 | 보완 |
|---|---|---|---|
| 높음 | 감각 UPDATE가 감각 행을 잡고 상태 행을 잠금. 퇴근 UPDATE는 상태 행을 잡고 감각 행을 수정 | 동시 실행 시 교착 가능. 한 요청이 실패할 수 있음 | 상태·감각 수정은 RPC만 허용, 모두 상태 행부터 잠금 |
| 높음 | 직원 트리거는 직원의 seat_id/company_id 변경만 검사 | 운영자가 좌석의 층이나 층의 기업을 바꾸면 회사 불일치 가능 | floors→seats→employees 복합 FK 추가 |
| 높음 | Realtime 전체를 RLS로 격리된다고 설명 | Postgres Changes DELETE에는 같은 RLS 보장이 적용되지 않음 | 엄격한 격리에는 기업별 비공개 Broadcast. 우선 RLS 조회 기반 재조회로 연동 |
| 중간 | 지도 경로만 저장, Storage 권한 없음 | 공개 버킷이면 회사 지도 파일을 외부에서 접근 가능 | 비공개 버킷과 경로 기반 회원 정책 |
| 중간 | 감각 카드가 '3개 테이블 조회'로만 설명됨 | 이름·좌석·층까지 합치면 추가 조회 필요, 응답 시점도 불일치 | 직원·프로필·상태·감각·좌석·층 통합 조회 RPC |
| 중간 | 감각 직접 UPDATE는 RLS로 0행 처리될 수 있음 | FE가 error만 보고 성공으로 오인 | 새 RPC는 권한·상태 오류를 명시적으로 반환 |
| 중간 | 가입 코드 만료·폐기 필드 없음 | 유출·교체 운영이 불명확 | 필드와 검증 조건 추가 |
| 중간 | 회사 전환과 실시간 캐시 계약 없음 | 다른 회사의 합법적으로 조회한 데이터가 현재 화면에 섞임 | 회사별 캐시 키·이전 구독 해제·재조회 |
| 낮음 | '7개 주요 테이블 + 코드 테이블' 표현 혼재 | auth.users까지 포함하는지 혼동 | public 7개 + private 1개 + Supabase 관리 auth.users로 정리 |

교착 상태 보완은 모든 변경 경로가 같은 순서로 잠금을 획득하도록 하는 설계다. 기존 SQL이 항상 잘못된 데이터를 저장한다는 뜻은 아니며, 동시 실행에서 요청 실패가 발생할 수 있다는 정적 분석 결과다. [PostgreSQL 잠금 문서](https://www.postgresql.org/docs/17/explicit-locking.html)

## 4. 최종 논리 DB 구조

기존 이름과 관계를 유지하여 FE 수정 범위를 줄인다.

| 테이블 | 주요 데이터 | 무결성·수명 |
|---|---|---|
| auth.users | 인증 계정 | Supabase 관리. 비밀번호를 업무 테이블에 복제하지 않음 |
| companies | id, name | 기업 단위 데이터 경계 |
| floors | id, company_id, floor_number, map_path, map_width, map_height | 회사 안에서 층 번호 유일. 음수 층 허용 |
| seats | id, company_id, floor_id, label, x_ratio, y_ratio | 층 안 좌석명 유일. 좌표 각각 0~1 |
| employees | id, user_id, company_id, seat_id, name, job_title, role | UNIQUE(user_id,company_id), UNIQUE(seat_id) |
| sensory_profiles | employee_id, visual/auditory/olfactory_sensitivity, description, updated_at | 직원당 1행. 퇴근해도 유지 |
| employee_statuses | employee_id, status, away_reason, status_message, updated_at | 직원당 1행. 기본 off_work |
| current_sensations | employee_id, 감각 6개, updated_at | 직원당 1행. 각 1~5 또는 NULL |
| private.company_join_codes | company_id, code_hash, expires_at, revoked_at, created_at | 회사당 현재 코드 1개. 일반 직원 직접 조회 금지 |

- 회사별 직원 ID가 업무 데이터의 기준이다. auth.uid()와 employee_id를 서로 바꿔 쓰지 않는다.
- 층·좌석 정보는 좌석 관계에서 계산한다. 직원에 층 번호와 좌표를 중복 저장하지 않는다.
- FK는 존재 여부뿐 아니라 동일 회사 관계까지 보장한다. CHECK로 다른 테이블을 조회하는 대신 복합 FK를 사용한다. [PostgreSQL 제약조건](https://www.postgresql.org/docs/current/ddl-constraints.html)
- UNIQUE(seat_id)는 NULL 좌석을 여러 직원이 가질 수 있게 하면서 지정된 좌석의 중복만 막는다.
- 코드 가입 시 직원과 하위 3개 행은 동일 트랜잭션에서 생성한다. 운영자도 직원 행만 단독 생성하지 않는다.
- P1은 현재값 중심이다. 상태·감각 이력 보관, 출퇴근 시간 집계, 센서 데이터, 공간 추천은 범위 밖이다.

### 4.1 감각 의미

| 화면 명칭 | 저장 필드 | 1 | 3 | 5 | 미니맵 |
|---|---|---|---|---|---|
| 온도 | temperature_level | 매우 추움 | 적당함 | 매우 더움 | 온도 |
| 습도 | humidity_level | 매우 건조함 | 적당함 | 매우 습함 | 습도 |
| 소음 정도 | noise_level | 매우 조용함 | 보통 | 매우 시끄러움 | 청각 |
| 냄새 | odor_level | 거의 없음 | 보통 | 매우 강함 | 후각 |
| 불쾌 지수 | discomfort_level | 매우 쾌적함 | 보통 | 매우 불쾌함 | 없음 |
| 혼잡도 | crowd_level | 매우 한산함 | 보통 | 매우 혼잡함 | 없음 |

불쾌 지수는 체감 점수다. 온습도 공식으로 계산하는 기상 지수가 아니다. NULL은 미입력·초기화이며 0이나 3으로 변환하지 않는다. 개인 청각 민감도(auditory_sensitivity)와 현재 소음(noise_level)은 서로 다른 정보다.

## 5. 상태·감각·좌석 동작 계약

### 5.1 상태 전이 기본안

| 현재 → 요청 | 처리 |
|---|---|
| off_work → working | 허용, away_reason=NULL |
| working → away | lunch / meeting / outside 중 하나 필수 |
| away → away | 사유 변경 허용 |
| away → working | 복귀, away_reason=NULL |
| working/away → off_work | 사유 NULL, 감각 6개 NULL을 같은 트랜잭션으로 처리 |
| off_work → away | INVALID_STATUS_TRANSITION. 제품 정책 미정에 대한 기본안 |
| 같은 상태 재요청 | 허용. off_work 재요청도 감각 NULL 상태를 보장 |

로그인·로그아웃·브라우저 종료·토큰 만료는 출퇴근을 자동 변경하지 않는다. 자동 퇴근은 추가 정책이므로 P1에 임의 도입하지 않는다.

### 5.2 동시성 계약

1. 상태 또는 감각 변경 요청은 본인 직원 ID인지 확인한다.
2. 해당 employee_statuses 행을 먼저 FOR UPDATE로 잠근다.
3. 현재 상태를 검사하고 상태 또는 감각을 변경한다.
4. 퇴근이면 현재 감각 6개를 NULL로 만든 뒤 함께 커밋한다.
5. 같은 직원의 동시 요청은 순서대로 처리된다. 감각 입력이 먼저 완료되면 이후 퇴근이 지운다. 퇴근이 먼저 완료되면 감각 입력은 EMPLOYEE_NOT_WORKING이다.

상태 메시지는 상태 전이와 별도 수정한다. 메시지만 바꿀 때 감각을 지우지 않는다. 사용자 간 동시 좌석 선택은 DB UNIQUE가 결정한다. 좌석 충돌로 UPDATE가 실패하면 기존 좌석 배정은 롤백되어 유지된다.

## 6. 기존 SQL에 적용할 수정 SQL

### 6.1 적용 범위와 순서

1. 제공된 기존 초안의 1단계 테이블, 2단계 함수·트리거, 3단계 권한·RLS가 존재하는 DB를 대상으로 한다.
2. 기존 데이터를 백업하고 개발용 프로젝트에서 아래 6.2~6.5를 순서대로 적용한다.
3. 아래 DDL은 1회용 변경이다. 재실행용 설치 스크립트가 아니다. 이미 같은 변경을 적용했다면 마이그레이션 이력으로 건너뛴다.
4. 기존 불일치 데이터가 있으면 복합 FK 적용이 실패한다. 실패를 무시하지 말고 원인을 정정한다.
5. 기존 Realtime publication 등록은 자동으로 해제하지 않는다. 9장의 전환 절차를 별도로 수행한다.
6. pgcrypto는 extensions 스키마, SQL 함수 소유자는 기존의 신뢰할 수 있는 마이그레이션 역할이라는 전제를 유지한다.

### 6.2 회사 관계·지도·가입 코드 강화

```sql
BEGIN;

ALTER TABLE public.floors
  ADD CONSTRAINT floors_company_id_id_key UNIQUE (company_id, id),
  ADD COLUMN map_width integer CHECK (map_width > 0),
  ADD COLUMN map_height integer CHECK (map_height > 0);

ALTER TABLE public.seats ADD COLUMN company_id uuid;
UPDATE public.seats s SET company_id = f.company_id
FROM public.floors f WHERE f.id = s.floor_id;
ALTER TABLE public.seats ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.seats
  ADD CONSTRAINT seats_company_floor_fk
    FOREIGN KEY (company_id, floor_id)
    REFERENCES public.floors(company_id, id),
  ADD CONSTRAINT seats_company_id_id_key UNIQUE (company_id, id);

-- 기존 단일 FK의 ON DELETE SET NULL을 제거한다.
-- 앞으로 좌석 삭제는 배정 해제 후 운영자가 수행한다.
ALTER TABLE public.employees DROP CONSTRAINT employees_seat_id_fkey;
ALTER TABLE public.employees
  ADD CONSTRAINT employees_company_seat_fk
    FOREIGN KEY (company_id, seat_id)
    REFERENCES public.seats(company_id, id);

ALTER TABLE private.company_join_codes
  ADD COLUMN expires_at timestamptz,
  ADD COLUMN revoked_at timestamptz;
ALTER TABLE private.company_join_codes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.company_join_codes FROM PUBLIC, anon, authenticated;

COMMIT;
```

기존 validate_seat_company 트리거와 UNIQUE(seat_id)는 유지한다. 복합 FK가 운영자 변경까지 관계를 지키고, 트리거는 읽기 쉬운 오류를 보조한다. 회사 전체 삭제는 기존 CASCADE와 새 FK의 상호 작용을 개발 DB에서 검증한 뒤 운영 절차로 제공한다. 직원·좌석 삭제를 일반 FE 기능으로 추가하지 않는다.

### 6.3 가입 코드 만료·폐기 반영

```sql
CREATE OR REPLACE FUNCTION private.register_company_member(
  p_code text, p_name text, p_job_title text DEFAULT ''
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_company_id uuid;
  v_employee_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'LOGIN_REQUIRED'; END IF;
  IF p_name IS NULL OR length(btrim(p_name)) = 0 THEN
    RAISE EXCEPTION 'NAME_REQUIRED';
  END IF;
  -- 기존 생성 방식: 12바이트 난수의 24자리 대문자 hex.
  IF p_code IS NULL OR upper(btrim(p_code)) !~ '^[0-9A-F]{24}$' THEN
    RAISE EXCEPTION 'INVALID_COMPANY_CODE';
  END IF;
  SELECT company_id INTO v_company_id
  FROM private.company_join_codes
  WHERE code_hash = encode(extensions.digest(upper(btrim(p_code)), 'sha256'), 'hex')
    AND revoked_at IS NULL
    AND (expires_at IS NULL OR expires_at > now())
  FOR SHARE;
  IF v_company_id IS NULL THEN RAISE EXCEPTION 'INVALID_COMPANY_CODE'; END IF;

  INSERT INTO public.employees(user_id, company_id, name, job_title)
  VALUES (auth.uid(), v_company_id, btrim(p_name), coalesce(p_job_title, ''))
  ON CONFLICT (user_id, company_id) DO NOTHING
  RETURNING id INTO v_employee_id;
  IF v_employee_id IS NULL THEN
    SELECT id INTO v_employee_id FROM public.employees
    WHERE user_id = auth.uid() AND company_id = v_company_id;
    RETURN v_employee_id;
  END IF;
  INSERT INTO public.sensory_profiles(employee_id) VALUES(v_employee_id);
  INSERT INTO public.employee_statuses(employee_id) VALUES(v_employee_id);
  INSERT INTO public.current_sensations(employee_id) VALUES(v_employee_id);
  RETURN v_employee_id;
END;
$$;
REVOKE ALL ON FUNCTION private.register_company_member(text,text,text)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.register_company_member(text,text,text)
TO authenticated;
```

기존 public.join_company 래퍼는 그대로 사용한다. 위 형식 제한은 기존 초안의 난수 코드 형식에 맞춘 것이다. 사람이 정한 짧은 코드가 이미 있다면 교체 계획을 먼저 수립한다. 해시는 복호화할 수 없으며 코드를 재발급한다. 잘못됨·만료됨·폐기됨은 모두 INVALID_COMPANY_CODE로 응답한다.

가입 남용 방지는 추가 구현사항이다. FE 버튼 제한만으로 방어했다고 판단하지 않는다. 서버 측 시도 횟수 제한을 도입한다면 직접 join_company 호출도 동일 제한을 거치게 하거나 직접 실행 권한을 회수해야 한다. 현재 수정 SQL에는 호출 횟수 제한이 구현되어 있지 않다.

### 6.4 상태·감각 변경을 RPC로 통일

기존 감각 UPDATE 권한과 상태 컬럼 UPDATE 권한을 회수한다. 상태 메시지 UPDATE 권한은 유지한다. 기존 checkout 트리거와 updated_at 트리거는 유지한다.

```sql
BEGIN;
DROP TRIGGER check_sensation_before_update ON public.current_sensations;

REVOKE UPDATE(status, away_reason)
ON public.employee_statuses FROM authenticated;
REVOKE UPDATE(temperature_level, humidity_level, noise_level,
  odor_level, discomfort_level, crowd_level)
ON public.current_sensations FROM authenticated;

CREATE FUNCTION private.set_status(
  p_employee_id uuid, p_status text, p_away_reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_old text;
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'LOGIN_REQUIRED'; END IF;
  SELECT s.status INTO v_old FROM public.employee_statuses s
  WHERE s.employee_id = p_employee_id AND EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.id = s.employee_id AND e.user_id = auth.uid()
  ) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_YOUR_EMPLOYEE'; END IF;
  IF p_status IS NULL OR p_status NOT IN ('working','away','off_work') THEN
    RAISE EXCEPTION 'INVALID_STATUS';
  END IF;
  IF p_status = 'away' AND
     (p_away_reason IS NULL OR p_away_reason NOT IN ('lunch','meeting','outside')) THEN
    RAISE EXCEPTION 'INVALID_AWAY_REASON';
  END IF;
  IF p_status <> 'away' AND p_away_reason IS NOT NULL THEN
    RAISE EXCEPTION 'INVALID_AWAY_REASON';
  END IF;
  IF v_old = 'off_work' AND p_status = 'away' THEN
    RAISE EXCEPTION 'INVALID_STATUS_TRANSITION';
  END IF;
  UPDATE public.employee_statuses
  SET status = p_status, away_reason = p_away_reason
  WHERE employee_id = p_employee_id;
  -- 일반적인 퇴근 전이는 기존 checkout 트리거가 초기화한다.
  -- 이미 off_work인 재요청에서도 NULL을 보장한다.
  IF p_status = 'off_work' AND v_old = 'off_work' THEN
    UPDATE public.current_sensations SET temperature_level=NULL,
      humidity_level=NULL, noise_level=NULL, odor_level=NULL,
      discomfort_level=NULL, crowd_level=NULL
    WHERE employee_id = p_employee_id;
  END IF;
  SELECT jsonb_build_object('status', to_jsonb(s), 'sensations', to_jsonb(c))
  INTO v_result FROM public.employee_statuses s
  JOIN public.current_sensations c USING(employee_id)
  WHERE s.employee_id = p_employee_id;
  RETURN v_result;
END;
$$;

CREATE FUNCTION private.set_sensations(p_employee_id uuid, p_patch jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_status text;
  v_key text;
  v_value jsonb;
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'LOGIN_REQUIRED'; END IF;
  SELECT s.status INTO v_status FROM public.employee_statuses s
  WHERE s.employee_id = p_employee_id AND EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.id = s.employee_id AND e.user_id = auth.uid()
  ) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_YOUR_EMPLOYEE'; END IF;
  IF v_status NOT IN ('working','away') THEN
    RAISE EXCEPTION 'EMPLOYEE_NOT_WORKING';
  END IF;
  IF p_patch IS NULL OR jsonb_typeof(p_patch) <> 'object' OR p_patch = '{}'::jsonb THEN
    RAISE EXCEPTION 'INVALID_SENSATIONS';
  END IF;
  FOR v_key, v_value IN SELECT key, value FROM jsonb_each(p_patch) LOOP
    IF v_key NOT IN ('temperature_level','humidity_level','noise_level',
      'odor_level','discomfort_level','crowd_level') THEN
      RAISE EXCEPTION 'INVALID_SENSATIONS';
    END IF;
    IF v_value <> 'null'::jsonb THEN
      IF jsonb_typeof(v_value) <> 'number' THEN
        RAISE EXCEPTION 'INVALID_SENSATIONS';
      END IF;
      IF (v_value::text)::numeric NOT BETWEEN 1 AND 5 OR
         (v_value::text)::numeric <> trunc((v_value::text)::numeric) THEN
        RAISE EXCEPTION 'INVALID_SENSATIONS';
      END IF;
    END IF;
  END LOOP;
  UPDATE public.current_sensations SET
    temperature_level=CASE WHEN p_patch ? 'temperature_level' THEN (p_patch->>'temperature_level')::numeric::smallint ELSE temperature_level END,
    humidity_level=CASE WHEN p_patch ? 'humidity_level' THEN (p_patch->>'humidity_level')::numeric::smallint ELSE humidity_level END,
    noise_level=CASE WHEN p_patch ? 'noise_level' THEN (p_patch->>'noise_level')::numeric::smallint ELSE noise_level END,
    odor_level=CASE WHEN p_patch ? 'odor_level' THEN (p_patch->>'odor_level')::numeric::smallint ELSE odor_level END,
    discomfort_level=CASE WHEN p_patch ? 'discomfort_level' THEN (p_patch->>'discomfort_level')::numeric::smallint ELSE discomfort_level END,
    crowd_level=CASE WHEN p_patch ? 'crowd_level' THEN (p_patch->>'crowd_level')::numeric::smallint ELSE crowd_level END
  WHERE employee_id = p_employee_id;
  SELECT to_jsonb(c) INTO v_result FROM public.current_sensations c
  WHERE c.employee_id = p_employee_id;
  RETURN v_result;
END;
$$;

CREATE FUNCTION public.set_employee_status(
  p_employee_id uuid, p_status text, p_away_reason text DEFAULT NULL
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT private.set_status(p_employee_id, p_status, p_away_reason);
$$;
CREATE FUNCTION public.set_current_sensations(p_employee_id uuid, p_patch jsonb)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT private.set_sensations(p_employee_id, p_patch);
$$;

REVOKE ALL ON FUNCTION private.set_status(uuid,text,text),
 private.set_sensations(uuid,jsonb), public.set_employee_status(uuid,text,text),
 public.set_current_sensations(uuid,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.set_status(uuid,text,text),
 private.set_sensations(uuid,jsonb), public.set_employee_status(uuid,text,text),
 public.set_current_sensations(uuid,jsonb) TO authenticated;
COMMIT;
```

기존 RLS UPDATE 정책은 남아 있어도 GRANT가 없으면 직접 변경할 수 없다. 단, 다른 마이그레이션에서 테이블 전체 UPDATE 권한을 부여했다면 먼저 그것도 회수해야 한다. 관리자·배치도 상태/감각의 동일 잠금 순서를 따라야 한다. service_role로 직접 감각을 쓰는 별도 경로는 이 불변식을 우회하므로 만들지 않는다.

### 6.5 감각 카드 통합 조회

아래 함수는 SECURITY INVOKER로 기존 SELECT RLS를 적용한다. 회사 ID 필터는 화면 범위 지정이며, 권한 판정은 RLS가 담당한다. 기본 50개, 최대 200개씩 조회한다.

```sql
CREATE FUNCTION public.get_sensory_cards(
  p_company_id uuid, p_employee_id uuid DEFAULT NULL,
  p_after uuid DEFAULT NULL, p_limit integer DEFAULT 50
) RETURNS SETOF jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'employee_id', e.id, 'company_id', e.company_id,
    'name', e.name, 'job_title', e.job_title,
    'seat', CASE WHEN s.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', s.id, 'label', s.label, 'floor_id', f.id,
      'floor_number', f.floor_number, 'x_ratio', s.x_ratio, 'y_ratio', s.y_ratio
    ) END,
    'profile', to_jsonb(p) - 'employee_id',
    'status', to_jsonb(st) - 'employee_id',
    'sensations', to_jsonb(c) - 'employee_id'
  )
  FROM public.employees e
  LEFT JOIN public.seats s ON s.id=e.seat_id AND s.company_id=e.company_id
  LEFT JOIN public.floors f ON f.id=s.floor_id AND f.company_id=e.company_id
  LEFT JOIN public.sensory_profiles p ON p.employee_id=e.id
  LEFT JOIN public.employee_statuses st ON st.employee_id=e.id
  LEFT JOIN public.current_sensations c ON c.employee_id=e.id
  WHERE e.company_id=p_company_id
    AND (p_employee_id IS NULL OR e.id=p_employee_id)
    AND (p_after IS NULL OR e.id>p_after)
  ORDER BY e.id
  LIMIT greatest(1, least(coalesce(p_limit,50),200));
$$;
REVOKE ALL ON FUNCTION public.get_sensory_cards(uuid,uuid,uuid,integer)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_sensory_cards(uuid,uuid,uuid,integer)
TO authenticated;
```

LEFT JOIN으로 하위 행 누락이 직원 자체를 숨기지 않게 한다. profile/status/sensations 객체가 NULL이면 초기화 데이터 오류로 기록하고 운영자가 복구한다. 정상 미입력은 sensations 객체 내부의 개별 필드가 NULL인 상태다. 카드 API에는 인증 user_id, 가입 코드 해시, 관리자 역할을 포함하지 않는다.

## 7. FE API 계약

### 7.1 공통 규칙

- 인증: Supabase publishable/anon key와 로그인 사용자 세션을 사용한다. service_role/secret key를 FE에 넣지 않는다.
- 기업 컨텍스트: 먼저 현재 계정의 소속을 조회하고 activeCompanyId와 그 회사의 employeeId를 함께 보관한다. 임의로 입력된 ID를 권한으로 신뢰하지 않는다.
- 읽기: 회사 ID로 필터하고 RLS로 접근을 제한한다. 미소속 기업 조회는 일반적으로 빈 배열이다. 존재 여부를 추측하도록 별도 오류로 구별하지 않는다.
- 부분 수정: 생략한 필드는 유지, 명시한 NULL은 해당 감각 값 삭제다. 빈 문자열은 메시지·설명 삭제다.
- 변경 가능한 기본 정보: 이름·직책, 민감도·설명, 상태 메시지. company_id/user_id/role/employee_id는 직접 수정할 수 없다. seat_id는 choose_seat만 사용한다.
- Supabase 응답은 `{ data, error }`다. 이 문서의 오류 이름은 업무 오류이며 HTTP 상태와 같지 않다. PL/pgSQL 사용자 예외는 기본 P0001, 좌석 중복은 기존 23505이다.
- 일반 UPDATE에는 `.select(...).single()`을 붙여 0행 변경을 성공으로 취급하지 않는다. 오류 전문과 내부 SQL을 사용자에게 그대로 표시하지 않는다.
- 시간은 timestamptz의 ISO 8601로 전달한다. 표시 시 사용자 시간대로 변환하며 정렬은 서버 시각으로 한다.

### 7.2 API 목록

| 기능 | 실제 호출 | 입력 | 응답 / 권한 |
|---|---|---|---|
| 계정 생성 | auth.signUp | email, password | user, session. 이메일 인증 설정에 따라 session=NULL |
| 로그인 | auth.signInWithPassword | email, password | session, user. 자동 출근 없음 |
| 로그아웃 | auth.signOut | 없음 | 자동 퇴근 없음 |
| 내 소속 목록 | employees SELECT | user_id=현재 auth 사용자 | id, company_id, name. 기업명은 companies에서 조회 |
| 기업 가입 | rpc join_company | p_code, p_name, p_job_title | employee_id UUID. 이미 가입했으면 기존 ID |
| 층 목록 | floors SELECT | company_id | id, floor_number, map_path, map_width, map_height |
| 좌석 목록 | seats SELECT | company_id, floor_id | id, label, x_ratio, y_ratio |
| 좌석 점유 조회 | employees SELECT | company_id, seat_id IS NOT NULL | id, seat_id. 서버 DB가 최종 점유 판정 |
| 좌석 배정/해제 | rpc choose_seat | p_employee_id, p_seat_id 또는 NULL | 성공 data=NULL. 이후 카드·좌석 재조회 |
| 직원 카드 목록 | rpc get_sensory_cards | p_company_id, p_after, p_limit | 카드 JSON 배열. 미소속 회사는 [] |
| 특정 카드 | rpc get_sensory_cards | p_company_id, p_employee_id | 배열 0개 또는 1개 |
| 내 이름·직책 변경 | employees UPDATE | name, job_title / id 조건 | 변경된 행 1개 |
| 개인 민감도·설명 변경 | sensory_profiles UPDATE | 3개 민감도, description / employee_id | 변경된 행 1개 |
| 출근·자리 비움·퇴근 | rpc set_employee_status | p_employee_id, p_status, p_away_reason | status와 sensations 객체 |
| 상태 메시지 변경 | employee_statuses UPDATE | status_message / employee_id | 변경된 행 1개 |
| 현재 감각 변경 | rpc set_current_sensations | p_employee_id, p_patch | 감각 6개와 employee_id, updated_at |
| 지도 이미지 URL | storage.createSignedUrl | 저장된 map_path | 짧은 만료 시간을 가진 URL. 버킷 SELECT 정책 필요 |

카드 목록은 마지막 employee_id를 p_after로 넘겨 다음 페이지를 읽는다. 조회 수가 p_limit보다 작으면 마지막 페이지다. 미니맵 점유 조회에는 모든 관련 직원을 가져와야 하므로 첫 50명만 불러와 빈 좌석이라고 판단하지 않는다. 대규모 지도는 층별 카드 조회나 별도 미니맵 조회 함수를 추가하는 최적화가 필요하다.

### 7.3 FE 호출 예시

```ts
// 회사 컨텍스트는 로그인 후 내 소속 목록에서 선택한다.
const { data: cards, error: cardsError } = await supabase.rpc('get_sensory_cards', {
  p_company_id: activeCompanyId,
  p_limit: 50,
});

// 상태와 사유를 한 요청으로 변경한다.
const { data: statusResult, error: statusError } = await supabase.rpc('set_employee_status', {
  p_employee_id: employeeId,
  p_status: 'away',
  p_away_reason: 'lunch',
});

// 퇴근은 감각 초기화를 별도로 요청하지 않는다.
const { data: checkoutResult, error: checkoutError } = await supabase.rpc('set_employee_status', {
  p_employee_id: employeeId,
  p_status: 'off_work',
  p_away_reason: null,
});

// 일부 값만 변경: 나머지는 유지. humidity_level은 미입력으로 변경.
const { data: sensations, error: sensationsError } = await supabase.rpc('set_current_sensations', {
  p_employee_id: employeeId,
  p_patch: { temperature_level: 4, humidity_level: null, noise_level: 5 },
});

// 상태 메시지는 출퇴근 상태와 독립적인 텍스트다.
const { data: messageResult, error: messageError } = await supabase
  .from('employee_statuses')
  .update({ status_message: '커피 마실 사람~' })
  .eq('employee_id', employeeId)
  .select('employee_id,status_message,updated_at')
  .single();
```

각 호출의 error를 처리한 다음에만 성공 UI를 표시한다. 퇴근 응답의 status/sensations를 함께 반영하고 지도와 카드를 다시 조회한다. 기존 `employee_statuses.update({status: ...})`와 `current_sensations.update(...)` 예시는 새 계약에서 사용하지 않는다.

### 7.4 카드 응답 예시

아래 ID는 구조를 설명하는 예시 UUID다. updated_at은 각 데이터의 마지막 변경 시각이다.

```json
[
  {
    "employee_id": "11111111-1111-4111-8111-111111111111",
    "company_id": "22222222-2222-4222-8222-222222222222",
    "name": "김하늘",
    "job_title": "개발자",
    "seat": {
      "id": "33333333-3333-4333-8333-333333333333",
      "label": "A-03",
      "floor_id": "44444444-4444-4444-8444-444444444444",
      "floor_number": 3,
      "x_ratio": 0.35,
      "y_ratio": 0.62
    },
    "profile": {
      "visual_sensitivity": 2,
      "auditory_sensitivity": 5,
      "olfactory_sensitivity": 3,
      "description": "작은 소리에도 집중이 흐트러져요.",
      "updated_at": "2026-10-31T00:00:00Z"
    },
    "status": {
      "status": "working",
      "away_reason": null,
      "status_message": "커피 마실 사람~",
      "updated_at": "2026-10-31T00:05:00Z"
    },
    "sensations": {
      "temperature_level": 4,
      "humidity_level": 2,
      "noise_level": 5,
      "odor_level": null,
      "discomfort_level": 4,
      "crowd_level": 2,
      "updated_at": "2026-10-31T00:06:00Z"
    }
  }
]
```

좌석 미선택은 `seat: null`이다. 층을 임의로 1층으로 채우지 않는다. 퇴근 후에는 sensations 객체는 유지하고 감각 6개만 NULL이다. 개인 민감도·설명은 유지한다.

### 7.5 업무 오류와 FE 처리

| 오류/상황 | 처리 |
|---|---|
| LOGIN_REQUIRED / 세션 만료 | 로그인 화면 또는 세션 갱신. 자동 출근하지 않음 |
| INVALID_COMPANY_CODE | 유효하지 않거나 만료된 코드 안내. 기업 존재 여부는 노출하지 않음 |
| NAME_REQUIRED | 이름 필수값 안내 |
| NOT_YOUR_EMPLOYEE | 변경 중단, 소속·직원 컨텍스트 다시 조회 |
| INVALID_SEAT | 현재 회사의 좌석만 선택하도록 목록 갱신 |
| SEAT_TAKEN / 23505 | “이미 선택된 좌석입니다. 다른 좌석을 선택해주세요.” 후 목록 재조회 |
| INVALID_STATUS / INVALID_AWAY_REASON | 상태·사유 입력 검증 |
| INVALID_STATUS_TRANSITION | 출근 후 자리 비움 선택 안내 |
| EMPLOYEE_NOT_WORKING | 현재 상태 재조회, 감각 입력 비활성화 |
| INVALID_SENSATIONS / 23514 | 정수 1~5 또는 NULL인지 확인. 알 수 없는 키 거부 |
| 조회 [] / 변경 0행 | 권한 없음·대상 없음 가능. 성공 알림 금지 |
| 40P01 / 40001 | 전체 요청 단위로 제한된 재시도. 계속 실패하면 오류 안내 |
| 네트워크 단절 | 저장 성공으로 단정하지 않고 재조회 후 재시도 |

DB 예외 message는 알려진 업무 문자열과 비교한다. HTTP 409 같은 별도 REST 계약은 이번 Supabase 직접 연동에 구현되어 있지 않다.

## 8. 미니맵 층·좌표·4개 토글

### 8.1 데이터 연결

1. 현재 회사의 floors를 조회해 층 선택 목록과 지도 경로를 얻는다.
2. 선택한 층의 seats를 조회한다.
3. 회사 카드와 좌석 점유 데이터를 조회해 `card.seat.id === seat.id`로 연결한다.
4. 실제 지도에 좌석을 그리고 해당 직원의 상태 배지와 선택한 감각을 표시한다.
5. 좌석 클릭 시 같은 employee_id의 감각 카드 전체를 연다.

회사 지도는 미리 제작된 이미지·SVG 등을 배치하는 형태다. P1에 지도 편집기, 실제 이동 추적, 자유 이동 캐릭터, 공간별 보간 히트맵을 추가하지 않는다.

### 8.2 좌표 계약

- 원점은 지도 콘텐츠 영역의 왼쪽 위, x는 오른쪽, y는 아래쪽이다.
- 좌표는 이미지 원본 기준으로 정규화한 0~1 비율이며 아이콘 중심점이다.
- 화면 좌표: `left = offsetX + x_ratio * renderedMapWidth`, `top = offsetY + y_ratio * renderedMapHeight`.
- CSS object-fit: contain으로 생기는 여백은 offsetX/offsetY에 반영한다. 바깥 컨테이너 크기를 그대로 곱하지 않는다.
- map_width/map_height는 원본 종횡비를 고정한다. 지도 이미지를 교체하면 좌표 기준도 검토하고 같은 버전으로 배포한다.
- 좌석 선택은 등록된 좌석 ID를 고르는 동작이다. 일반 직원이 x_ratio/y_ratio를 직접 수정하지 않는다.

### 8.3 토글 표시 규칙

| 버튼 | 실제 참조 필드 | 혼동하면 안 되는 필드 |
|---|---|---|
| 청각 | sensations.noise_level | profile.auditory_sensitivity |
| 후각 | sensations.odor_level | profile.olfactory_sensitivity |
| 온도 | sensations.temperature_level | 실제 섭씨 온도 |
| 습도 | sensations.humidity_level | 실제 상대습도 % |

단일 선택을 기본안으로 한다. 토글 해제 시 기본 직원 상태 표시로 복귀한다. 네 버튼의 최종 색상 팔레트와 복수 선택 여부는 FE 협의 사항이다. 색상 외 숫자·문구·범례도 제공한다. 온도·습도는 양쪽 극단을 구별하고 3을 중립으로 표시한다. 소음·냄새는 강도 순서로 표시한다.

| 상황 | 기본 표시안 |
|---|---|
| 빈 좌석 | 빈 좌석 스타일. 1점으로 처리하지 않음 |
| 직원은 있으나 해당 감각 NULL | 중립 회색 + 미입력 |
| 출근 직원 | 선택한 현재 감각 표시 |
| 자리 비움 직원 | 마지막 입력 감각 + 자리 비움 배지 |
| 퇴근 직원 | 퇴근/비활성. 현재 감각 색상을 남기지 않음 |
| 좌석 미지정 직원 | 지도에는 없음. 직원 목록·카드는 유지 |
| 다른 층 직원 | 현재 층 지도에서 제외 |

토글은 FE 표시 상태이므로 DB에 저장하지 않는다. 온도·습도와 나머지 항목을 합산해 새로운 점수를 만들지 않는다.

## 9. 기업 격리·RLS·실시간·지도 보안

### 9.1 권한 표

| 데이터/행동 | 일반 로그인 직원 | 비로그인 | 운영자 |
|---|---|---|---|
| 소속 회사·층·좌석 조회 | 소속 회사만 | 차단 | 관리 권한 |
| 감각 카드 조회 | 같은 회사 직원 전체 | 차단 | 별도 운영 정책 |
| 기본 정보·프로필·메시지 수정 | 본인만, 허용 컬럼만 | 차단 | 관리 권한 |
| 상태·감각 수정 | 본인 RPC만 | 차단 | 동일 잠금 규약 준수 |
| 좌석 변경 | 본인 choose_seat만 | 차단 | 배정 충돌 제약 준수 |
| 기업 소속 생성 | 유효 코드의 join_company만 | 차단 | 제한된 운영 경로 |
| user_id/company_id/role 직접 수정 | 차단 | 차단 | 별도 관리 절차 |
| 회사·층·좌석 생성 | 차단 | 차단 | 납품 초기 세팅 |
| 가입 코드 해시 조회 | 차단 | 차단 | 제한된 운영 경로 |

기존 my_company_ids는 RLS가 employees를 반복 참조하는 재귀 문제를 피하기 위한 보안 함수다. 유지하되 소유자와 search_path를 고정한다. private 스키마는 Data API의 노출 스키마에 추가하지 않는다. public 래퍼가 SECURITY INVOKER여도 내부 SECURITY DEFINER는 높은 권한으로 실행되므로 내부에서 auth.uid()·소유권을 확인해야 한다. [Supabase 함수 권한](https://supabase.com/docs/guides/database/functions)

RLS는 행 권한이고 GRANT는 테이블·컬럼·함수 실행 권한이다. 둘 다 필요하다. 테이블 소유자나 service_role로만 검증하면 실제 사용자의 권한 오류를 발견할 수 없다. [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)

### 9.2 현재 기업과 접근 가능한 기업의 차이

한 계정이 A와 B에 모두 소속되어 있다면 두 회사 데이터를 조회할 권한이 있다. 이것은 격리 실패가 아니다. A에만 소속된 계정이 B를 조회할 수 없어야 한다. 현재 선택된 회사에 화면을 한정하는 일은 회사 필터와 FE 캐시가 담당한다.

캐시 키는 `[companyId, resource, id]`로 구성한다. 회사 전환·로그아웃 시 구독을 해제하고 이전 회사 화면 데이터를 제거한다. RLS를 FE의 회사 필터로 대체하지 않는다.

### 9.3 실시간 보완 및 초기 연동 방식

**기존 초안의 설명 정정:** Postgres Changes의 INSERT/UPDATE 조회 권한 검사와 DELETE 전달은 동일하지 않다. DELETE에는 일반 행 RLS와 같은 보장을 적용할 수 없으므로 “Realtime은 항상 회사 격리가 유지된다”는 설명은 불충분하다. [Supabase Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes)

P1 기능 원문에는 갱신 지연 수치가 확정되어 있지 않다. 따라서 다음 두 단계를 구분한다.

**초기 연동 기본안 — RLS 조회 기반 재조회**

- 화면 진입·회사/층 변경·본인 수정 성공 후 카드/좌석을 다시 조회한다.
- 화면이 활성화되어 있을 때 5초 간격으로 재조회하고 숨김·오프라인에서는 중지한다.
- 다시 활성화되거나 네트워크가 복구되면 즉시 재조회한다.
- 이전 요청보다 나중에 시작한 요청의 응답만 반영해 오래된 응답의 덮어쓰기를 막는다.
- 5초는 제안값이며 제품팀의 즉시 반영 요구를 대체하는 확정값이 아니다.

**즉시 동기화 추가 구현안 — 기업별 비공개 Broadcast**

- 주제는 `company:<company_uuid>`로 정한다. 이름만 이렇게 붙이는 것으로 권한이 생기지 않는다.
- realtime.messages의 수신 정책에서 현재 사용자가 해당 회사 직원인지 확인한다. 비공개 채널로만 연결하고 클라이언트의 임의 송신은 허용하지 않는다.
- employees/statuses/profiles/sensations 변경 후 서버 트리거가 기업 주제로 `invalidate` 알림을 보낸다. payload는 company_id, employee_id, entity, operation 정도로 제한한다.
- 자식 행에는 company_id가 없으므로 직원 관계에서 얻는다. 소속 삭제·CASCADE 전에는 OLD 관계에서 회사 ID를 확보하도록 별도 처리한다.
- FE는 채널 SUBSCRIBED 뒤 최초 조회를 시작한다. 최초 조회 도중 이벤트가 오면 조회 완료 후 다시 조회한다.
- 이벤트를 완성된 카드로 적용하지 않고 해당 카드/지도 캐시를 무효화한 뒤 get_sensory_cards를 다시 호출한다. 퇴근의 상태·감각 이벤트가 따로 도착해도 일관된 카드로 갱신된다.
- 재연결 때 전체 재조회한다. 이벤트 유실·중복·순서 변경에 의존하지 않는다.
- 회원 자격 회수 시 기존 채널 세션도 정리하고 재인가하는 절차를 검증한다.

이 Broadcast의 트리거·realtime.messages 정책은 **추가 구현사항이며 이 문서의 SQL에 포함되지 않는다.** 공식 비공개 Broadcast 절차에 맞춰 구현한 뒤 기업 간 이벤트 격리 테스트를 해야 한다. [Supabase DB 변경 구독](https://supabase.com/docs/guides/realtime/subscribing-to-database-changes)

기존 4개 테이블을 supabase_realtime publication에 이미 등록했다면, 다른 기능의 사용 여부를 확인한 후 해당 테이블의 Postgres Changes 노출을 제거하고 위 방식으로 전환한다. FE에서 DELETE 구독만 빼는 것은 임의 클라이언트의 구독을 막지 못하므로 서버 보안 대책이 아니다. 공유 publication의 전역 publish 설정을 무작정 바꾸지 않는다. Realtime 전환 완료 전에는 실시간 격리 검증을 통과했다고 표시하지 않는다.

### 9.4 지도 Storage 접근

- 비공개 버킷 이름 예: `office-maps`.
- 경로 규칙: `<company_uuid>/<floor_uuid>/<version>/map.png`.
- map_path에는 버킷 내부 경로를 저장한다. 만료되는 signed URL 자체를 DB에 저장하지 않는다.
- 업로드·삭제는 운영자만 수행한다. 일반 직원은 소속 회사 경로만 읽는다.
- 아래 SELECT 정책을 적용하기 전에 같은 버킷에 광범위하게 허용하는 기존 정책이 없는지 확인한다.

```sql
-- office-maps 비공개 버킷은 운영자가 먼저 생성한다.
CREATE POLICY office_maps_company_read ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'office-maps'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM private.my_company_ids() AS t(id)
  )
);
```

FE는 허용된 경로에 대해 짧은 TTL(예: 5분)의 signed URL을 발급받고 만료 시 재발급한다. 이미 발급된 URL은 만료 전 전달될 수 있으므로 접근 권한 회수와 동시에 즉시 무효화되는 구조라고 설명하지 않는다. 즉시 회수가 필수라면 인증된 다운로드 경로를 별도로 검토한다.

## 10. 최초 기업 납품·가입 흐름

### 10.1 운영자 초기 설정

1. companies에 회사를 만든다.
2. floors에 회사 ID·층 번호·지도 원본 크기를 등록한다.
3. 비공개 Storage에 회사/층 경로로 지도 파일을 올리고 map_path를 저장한다.
4. seats에 company_id, floor_id, label, 0~1 좌표를 입력한다. 새 company_id 컬럼을 빠뜨리지 않는다.
5. 12바이트 난수로 24자리 hex 코드를 생성하고 대문자·앞뒤 공백 제거 규칙으로 SHA-256 해시를 저장한다. 원문은 담당자에게 1회 전달한다.
6. 코드 만료 시간을 정했다면 expires_at을 저장한다. 미정이면 NULL이며 무기한이라는 사실을 운영자가 인지해야 한다.
7. 일반 계정으로 가입·지도 읽기·좌석 선택을 확인한다. 운영자 SQL Editor 조회만으로 완료하지 않는다.

기업별 관리자 UI는 P1 필수 기능이 아니다. 기존 role='admin'은 이 문서에서 별도 FE 관리 권한을 부여하지 않는다. 필요하면 관리 화면과 정책을 후속 설계한다.

### 10.2 직원 가입

계정 생성 → 필요 시 이메일 인증 → 로그인 세션 생성 → 가입 코드 입력 → join_company → employee_id와 소속 선택 → 감각 프로필 입력 → 빈 좌석 선택 → 직접 출근.

인증 계정 생성과 회사 가입은 서로 다른 절차다. 코드 오류로 가입이 실패해도 로그인 계정은 남을 수 있고 코드만 재입력하면 된다. 같은 회사에 다시 가입 요청하면 기존 직원 ID를 반환한다. 기존 이름·직책·감각을 덮어쓰지 않는다.

코드 교체는 해당 회사 행의 해시를 새 난수 코드로 바꾸고 만료·폐기 상태를 갱신한다. 코드 폐기는 새 가입만 차단하며 기존 직원 소속을 삭제하지 않는다. 직원 탈퇴·계정 삭제·기업 이동은 별도 관리 흐름이며 P1 일반 사용자 API에 포함하지 않는다.

## 11. 실행 전·후 검증 시나리오

아래는 **실행할 테스트 명세**다. 아직 통과한 테스트 목록이 아니다. A사 직원 A1·A2, B사 직원 B1, 미가입 로그인 계정 U0, A/B 복수 소속 계정 AB를 준비한다. RLS 검증은 실제 사용자 JWT로 한다.

| ID | 절차 | 기대 결과 |
|---|---|---|
| T01 | 비로그인 상태로 업무 테이블·RPC 접근 | 차단 |
| T02 | U0가 잘못된/만료/폐기 코드로 가입 | INVALID_COMPANY_CODE, 직원·하위 행 생성 없음 |
| T03 | U0가 정상 코드로 가입 | 직원 1행+프로필/상태/감각 각 1행, off_work·감각 NULL |
| T04 | 동일 계정으로 같은 코드 동시 가입 | 직원 1명만 생성, 동일 employee_id |
| T05 | A1이 B사 회사/층/좌석/직원/카드 ID 직접 조회 | B 데이터 미노출 |
| T06 | A1이 A2 카드 전체 조회 후 상태·감각 수정 시도 | 조회 허용, 수정 차단 |
| T07 | A1이 company_id/user_id/role/seat_id 직접 수정 | 차단 |
| T08 | A1·A2가 같은 좌석을 동시에 선택 | 한 명 성공, 한 명 SEAT_TAKEN, 점유 1명 |
| T09 | 기존 좌석이 있는 A1이 점유 좌석 선택 | 실패, 기존 좌석 유지 |
| T10 | A1이 B사 좌석 선택 / 운영자가 불일치 관계 생성 | RPC 거부 / 복합 FK 거부 |
| T11 | away인데 사유 없음 또는 working인데 사유 있음 | INVALID_AWAY_REASON 또는 CHECK 거부 |
| T12 | 출근·자리 비움 상태에서 감각 일부 수정 | 명시한 값만 변경, 생략 필드 유지 |
| T13 | 감각 0, 6, 2.5, 문자열, 알 수 없는 키 입력 | INVALID_SENSATIONS, 데이터 변경 없음 |
| T14 | 감각 6개 입력 후 퇴근 | 상태 off_work, 사유 NULL, 감각 전부 NULL |
| T15 | 감각 수정과 퇴근을 두 세션에서 동시 실행 | 공통 잠금 순서, 최종 off_work+감각 NULL |
| T16 | 퇴근 중 감각 RPC / 직접 UPDATE 시도 | EMPLOYEE_NOT_WORKING / 권한 거부 |
| T17 | 로그인·로그아웃·창 닫기 | 출퇴근 상태 자동 변경 없음 |
| T18 | 퇴근 처리 후 민감도·설명·좌석·메시지 확인 | 기본안대로 유지 |
| T19 | 각 토글 선택, NULL·빈 좌석·퇴근 확인 | 정확한 4개 필드 연결, 3점 자동 치환 없음 |
| T20 | 이미지 비율·창 크기·층 변경 | 좌석 중심이 실제 위치와 일치 |
| T21 | A1이 B 지도 경로로 다운로드/URL 발급 | 차단. A 지도만 허용 |
| T22 | AB가 A→B 전환 | 회사별 직원 ID 선택, 이전 캐시·구독 제거 |
| T23 | 목록 200명 초과·페이지 이동 | 전체 조회 가능, 미조회 직원을 빈 좌석으로 오인하지 않음 |
| T24 | 일반 UPDATE가 0행 처리되는 경우 | FE 성공 알림 없음 |
| T25 | 네트워크 단절·재연결·탭 복귀 | 재조회로 카드·지도 최신 상태 복구 |
| T26 | Broadcast 구현 후 A 변경/삭제를 B 계정으로 구독 | B에 알림·행 정보 미전달 |
| T27 | Broadcast 구현 후 퇴근의 여러 이벤트 수신 | 통합 재조회 결과로 일관된 화면 |
| T28 | 기존 Postgres Changes 노출과 임의 DELETE 구독 시도 | 선택한 격리 설계에 따라 서버에서 노출 제거 확인 |

T15는 순서를 뒤집어 반복하고 두 세션의 오류 코드도 확인한다. 기존 SQL의 잠금 순서로 교착이 재현되더라도 이를 데이터 손상과 혼동하지 않는다. 수정 후에는 교착이 나지 않는지, 최종 감각 NULL이 지켜지는지 둘 다 확인한다.

## 12. 남은 작업과 완료 기준

### 12.1 이번 문서에서 완료한 작업

- [x] 사용자가 확정한 P1 전체 항목과 실제 제공된 DB/SQL/API 대조
- [x] 기본 정보·민감도·현재 감각 6개·상태·메시지의 누락 여부 확인
- [x] 기업 격리·가입 코드·좌석 충돌·퇴근 초기화의 설계 문제 정리
- [x] 복합 FK, 가입 코드 유효기간, 공통 잠금 순서 RPC 수정안 작성
- [x] 카드 통합 조회, FE 요청·응답·오류, 미니맵 토글·좌표 계약 작성
- [x] 확정/미정/추가 구현 및 실행 검증 미완료 구분

### 12.2 BE·FE 추가 구현사항

- [ ] 개발 Supabase에 기존 SQL 및 본 수정 SQL 적용, 버전별 문법·권한 검증
- [ ] 기존 상태·감각 직접 UPDATE 호출을 새 RPC로 교체
- [ ] 카드 통합 조회와 목록 페이지 처리, 미니맵 전체 점유 데이터 연결
- [ ] 지도 버킷·SELECT 정책·signed URL 및 실제 좌표 QA
- [ ] 코드 발급·교체·폐기 및 서버 측 가입 시도 제한
- [ ] 변경 전후 DB 권한 점검: PUBLIC·anon·authenticated에 불필요한 GRANT가 없는지 확인
- [ ] 5초 재조회 허용 여부 합의 또는 비공개 Broadcast와 권한 회수 구현
- [ ] 기존 Realtime publication 사용 조사 및 위험 노출 제거
- [ ] T01~T28 중 적용 대상 실행, 결과·실패·수정 기록
- [ ] 문자열 길이·팔레트·복수 기업 UI·퇴근 좌석/메시지 정책 확정

**구현 완료 기준:** 필수 P1 기능이 실제 사용자 계정으로 동작하고, 교차 기업 조회·변조가 차단되며, 동시 좌석 선택과 퇴근/감각 경쟁 조건 테스트를 통과해야 한다. 문서 작성 완료와 배포 가능한 구현 완료는 별개다.

## 13. 참고 근거

- 요구사항·결정: 기존 대화 「백엔드 프로젝트 정리」 및 사용자가 이 대화에 제공한 전체 SQL/API와 P1 원문.
- 제약조건 설명 근거: [PostgreSQL Constraints](https://www.postgresql.org/docs/current/ddl-constraints.html).
- 교착·잠금 순서 설명 근거: [PostgreSQL Explicit Locking](https://www.postgresql.org/docs/17/explicit-locking.html).
- RLS·함수 권한 설명 근거: [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security), [Database Functions](https://supabase.com/docs/guides/database/functions).
- 실시간 DELETE 제한과 대안 근거: [Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes), [Subscribing to Database Changes](https://supabase.com/docs/guides/realtime/subscribing-to-database-changes).

제품 기본안, SQL 수정안, API 구조와 테스트 시나리오는 위 요구사항을 충족하도록 이번 검토에서 설계한 내용이다. 공식 문서가 SenseSpace의 제품 정책을 확정하는 것은 아니다.
