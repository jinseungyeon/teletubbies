# Inthon 1층 48석 재구성 — 010 적용 안내

상태 갱신: **010 적용 완료 — 사용자 실행 성공 및 cleared_seat_ids=0 회신 기준.** 에이전트가 운영 DB에 직접 접속해 확인한 결과는 아니다. 성공한 010 전체를 다시 실행하지 않는다. FE 재입장·자리 선택·저장·새로고침의 별도 통합 확인은 아직 회신받지 않았다.

원본 요청은 최신 origin/front의 이 경로(확인 커밋: 77d6263)에서 읽었다. 현재 back에 없던 문서를 010 적용용으로 정리했다. FE 실행 파일은 가져오거나 수정하지 않았다. 원본의 007 번호 예시는 사용하지 않으며 007 skin_tone, 기존 008/009 등 설치된 마이그레이션은 재실행하지 않는다.

## 0. 변경 범위

- 회사: Inthon, ff484ad2-375d-416e-86fa-95e01f2b1323
- 1층: 기존 76석·4938×2868 → **48석·1400×800**
- 라벨: **A-01~A-16 / B-01~B-16 / C-01~C-16**
- 좌표: 원본 요청 2-1의 48개 값을 그대로 사용한다.
- 1층에 배정된 직원의 seat_id를 NULL로 비운다. 새 좌석 UUID가 생성되므로 모든 해당 직원은 좌석을 다시 선택해야 한다.
- **2층의 지도 행, J/K/L 93개 좌석 행, 2층에 배정된 직원 행은 변경하지 않는다.** 변경 전후 값이 다르면 전체를 롤백한다.
- 원래 1층 좌석이 없던 직원은 초기화 건수에 포함하지 않는다. 메시지·이모티콘·감각·근태를 추가로 수정하지 않는다.
- 기존 006/009 트리거는 유지된다. 1층 좌석 배정 해제 알림은 기존 수신 설정에 따라 생성되고, 위치 revision은 갱신된다. 따라서 이전에 승인된 업무 상태 예약은 기존 충돌 검사에서 실행/복원 제외될 수 있다.
- floors.id와 map_path, Storage 이미지는 유지한다. 현재 FE는 내장 1400×800 레이아웃을 사용한다.

## 1. 먼저 실행할 조회 — DB 변경 없음

현재 테이블과 임시 이동을 확인한다. 010에 다른 용도가 이미 기록돼 있으면 적용하지 않고 새로운 번호를 정한다.

related_temporary_moves는 **1층에 배정된 채 다른 자리로 이동 중**이거나 **다른 층에서 1층으로 이동 중**인 사람을 포함한다. 006의 FK/좌석 점유 제약을 지키기 위해 0명이어야 한다. 1명 이상이면 해당 직원이 기존 복귀 기능으로 돌아온 뒤 다시 조회한다. 마이그레이션이 임의로 2층 점유나 업무 상태를 해제하지 않는다.

```sql
SELECT
  current_user AS execution_role,
  (SELECT count(*) FROM public.seats s
    JOIN public.floors f ON f.id=s.floor_id AND f.company_id=s.company_id
    WHERE f.company_id='ff484ad2-375d-416e-86fa-95e01f2b1323' AND f.floor_number=1) AS floor1_seats,
  (SELECT count(*) FROM public.employees e
    JOIN public.seats s ON s.id=e.seat_id AND s.company_id=e.company_id
    JOIN public.floors f ON f.id=s.floor_id AND f.company_id=s.company_id
    WHERE e.company_id='ff484ad2-375d-416e-86fa-95e01f2b1323' AND f.floor_number=1) AS assigned_floor1_employees,
  (SELECT count(*) FROM public.employees e
    LEFT JOIN public.seats h ON h.id=e.seat_id AND h.company_id=e.company_id
    LEFT JOIN public.floors hf ON hf.id=h.floor_id AND hf.company_id=h.company_id
    LEFT JOIN public.seats t ON t.id=e.temporary_seat_id AND t.company_id=e.company_id
    LEFT JOIN public.floors tf ON tf.id=t.floor_id AND tf.company_id=t.company_id
    WHERE e.company_id='ff484ad2-375d-416e-86fa-95e01f2b1323'
      AND e.temporary_seat_id IS NOT NULL
      AND (hf.floor_number=1 OR tf.floor_number=1)) AS related_temporary_moves,
  EXISTS(SELECT 1 FROM private.sensespace_migrations
    WHERE version ~ '^010($|_)') AS migration_010_already_used;
```

SQL Editor의 관리자 postgres 역할로 진행하면 service_role 키를 채팅·문서·브라우저에 넣을 필요가 없다. 일반 FE publishable 키로 실행하지 않는다.

## 2. 필요한 변경

### 2-1. 010 — 전체 블록을 한 번에 실행

아래 **BEGIN부터 마지막 SELECT까지** 같은 SQL Editor 실행에 포함한다. 데이터 변경 4단계와 마이그레이션 기록은 한 트랜잭션이다. 마지막 SELECT는 COMMIT 이후 같은 실행 배치에서 실제 처리 건수를 출력한다.

검사 실패 또는 FK 오류가 발생하면 커밋하지 않는다. MIGRATION_010_ALREADY_USED는 재실행 금지이며, RETURN_REQUIRED_BEFORE_FLOOR1_RESET는 관련 임시 이동자가 먼저 복귀해야 한다는 뜻이다. 오류가 난 경우 결과를 공유하고, 실행기가 트랜잭션 오류 상태라고 안내할 때만 ROLLBACK;으로 그 실패한 트랜잭션을 종료한다.

```sql
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

DO $migration$
DECLARE
  v_company uuid := 'ff484ad2-375d-416e-86fa-95e01f2b1323';
  v_floor1 public.floors;
  v_floor2 public.floors;
  v_floor2_seats jsonb;
  v_floor2_employees jsonb;
  v_old_count integer;
  v_cleared integer;
  v_deleted integer;
  v_inserted integer;
  v_report jsonb;
BEGIN
  -- Same company -> status -> employee lock order as 006 and the assistant.
  PERFORM pg_advisory_xact_lock(hashtextextended('sensespace:seats:'||v_company::text,0));
  LOCK TABLE private.sensespace_migrations IN SHARE ROW EXCLUSIVE MODE;

  IF EXISTS(SELECT 1 FROM private.sensespace_migrations
    WHERE version ~ '^010($|_)') THEN
    RAISE EXCEPTION 'MIGRATION_010_ALREADY_USED: do not reset seats again';
  END IF;
  SELECT * INTO v_floor1 FROM public.floors
    WHERE company_id=v_company AND floor_number=1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'INTHON_FLOOR1_NOT_FOUND'; END IF;
  SELECT * INTO v_floor2 FROM public.floors
    WHERE company_id=v_company AND floor_number=2 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'INTHON_FLOOR2_NOT_FOUND'; END IF;

  SELECT count(*) INTO v_old_count FROM public.seats
    WHERE company_id=v_company AND floor_id=v_floor1.id;
  IF v_old_count<>76 OR v_floor1.map_width<>4938 OR v_floor1.map_height<>2868 THEN
    RAISE EXCEPTION 'FLOOR1_SOURCE_MISMATCH: seats=%, map=%x%',
      v_old_count,v_floor1.map_width,v_floor1.map_height;
  END IF;
  IF (SELECT count(*) FROM public.seats WHERE company_id=v_company AND floor_id=v_floor2.id)<>93
    OR v_floor2.map_width<>1713 OR v_floor2.map_height<>918 THEN
    RAISE EXCEPTION 'FLOOR2_SOURCE_MISMATCH';
  END IF;
  IF EXISTS(SELECT 1 FROM public.seats WHERE company_id=v_company
    AND floor_id<>v_floor1.id AND label ~ '^[ABC]-(0[1-9]|1[0-6])$') THEN
    RAISE EXCEPTION 'COMPANY_SEAT_LABEL_CONFLICT';
  END IF;

  -- Prior return is required for any temporary move involving floor 1.
  IF EXISTS(
    SELECT 1 FROM public.employees e
    LEFT JOIN public.seats home ON home.id=e.seat_id AND home.company_id=e.company_id
    LEFT JOIN public.seats dest ON dest.id=e.temporary_seat_id AND dest.company_id=e.company_id
    WHERE e.company_id=v_company AND e.temporary_seat_id IS NOT NULL
      AND (home.floor_id=v_floor1.id OR dest.floor_id=v_floor1.id)
  ) THEN
    RAISE EXCEPTION 'RETURN_REQUIRED_BEFORE_FLOOR1_RESET';
  END IF;

  PERFORM st.employee_id FROM public.employee_statuses st
    JOIN public.employees e ON e.id=st.employee_id
    JOIN public.seats s ON s.id=e.seat_id AND s.company_id=e.company_id
    WHERE e.company_id=v_company AND s.floor_id=v_floor1.id
    ORDER BY st.employee_id FOR UPDATE OF st;
  PERFORM e.id FROM public.employees e
    JOIN public.seats s ON s.id=e.seat_id AND s.company_id=e.company_id
    WHERE e.company_id=v_company AND s.floor_id=v_floor1.id
    ORDER BY e.id FOR UPDATE OF e;

  SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.id),'[]'::jsonb)
    INTO v_floor2_seats FROM public.seats s
    WHERE s.company_id=v_company AND s.floor_id=v_floor2.id;
  SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.id),'[]'::jsonb)
    INTO v_floor2_employees FROM public.employees e
    JOIN public.seats s ON s.id=e.seat_id AND s.company_id=e.company_id
    WHERE e.company_id=v_company AND s.floor_id=v_floor2.id;

  -- 1) Clear only employees assigned to Inthon floor 1.
  UPDATE public.employees e SET seat_id=NULL
    FROM public.seats s
    WHERE e.company_id=v_company AND s.company_id=v_company
      AND e.seat_id=s.id AND s.floor_id=v_floor1.id;
  GET DIAGNOSTICS v_cleared=ROW_COUNT;
  -- 006 employees_seat_claims removes those assigned claims.
  -- No trigger is disabled and no CASCADE is used.

  -- 2) Delete only Inthon floor 1 seats.
  DELETE FROM public.seats WHERE company_id=v_company AND floor_id=v_floor1.id;
  GET DIAGNOSTICS v_deleted=ROW_COUNT;
  IF v_deleted<>76 THEN RAISE EXCEPTION 'FLOOR1_DELETE_COUNT_MISMATCH'; END IF;

  -- 3) Exact coordinates from the FE request section 2-1.
  INSERT INTO public.seats(company_id,floor_id,label,x_ratio,y_ratio)
  SELECT v_company,v_floor1.id,s.label,s.x_ratio,s.y_ratio
  FROM (VALUES
('A-01',0.33785714,0.22625000),
    ('A-02',0.37785714,0.22625000),
    ('A-03',0.33785714,0.36375000),
    ('A-04',0.37785714,0.36375000),
    ('A-05',0.50285714,0.22625000),
    ('A-06',0.54285714,0.22625000),
    ('A-07',0.50285714,0.36375000),
    ('A-08',0.54285714,0.36375000),
    ('A-09',0.71357143,0.22625000),
    ('A-10',0.75357143,0.22625000),
    ('A-11',0.79357143,0.22625000),
    ('A-12',0.83357143,0.22625000),
    ('A-13',0.71357143,0.36375000),
    ('A-14',0.75357143,0.36375000),
    ('A-15',0.79357143,0.36375000),
    ('A-16',0.83357143,0.36375000),
    ('B-01',0.30071429,0.52875000),
    ('B-02',0.34071429,0.52875000),
    ('B-03',0.38071429,0.52875000),
    ('B-04',0.42071429,0.52875000),
    ('B-05',0.30071429,0.66625000),
    ('B-06',0.34071429,0.66625000),
    ('B-07',0.38071429,0.66625000),
    ('B-08',0.42071429,0.66625000),
    ('B-09',0.50214286,0.52875000),
    ('B-10',0.54214286,0.52875000),
    ('B-11',0.58214286,0.52875000),
    ('B-12',0.62214286,0.52875000),
    ('B-13',0.50214286,0.66625000),
    ('B-14',0.54214286,0.66625000),
    ('B-15',0.58214286,0.66625000),
    ('B-16',0.62214286,0.66625000),
    ('C-01',0.30071429,0.74750000),
    ('C-02',0.34071429,0.74750000),
    ('C-03',0.38071429,0.74750000),
    ('C-04',0.42071429,0.74750000),
    ('C-05',0.30071429,0.88500000),
    ('C-06',0.34071429,0.88500000),
    ('C-07',0.38071429,0.88500000),
    ('C-08',0.42071429,0.88500000),
    ('C-09',0.50214286,0.74750000),
    ('C-10',0.54214286,0.74750000),
    ('C-11',0.58214286,0.74750000),
    ('C-12',0.62214286,0.74750000),
    ('C-13',0.50214286,0.88500000),
    ('C-14',0.54214286,0.88500000),
    ('C-15',0.58214286,0.88500000),
    ('C-16',0.62214286,0.88500000)
  ) s(label,x_ratio,y_ratio);
  GET DIAGNOSTICS v_inserted=ROW_COUNT;
  IF v_inserted<>48 THEN RAISE EXCEPTION 'FLOOR1_INSERT_COUNT_MISMATCH'; END IF;

  -- 4) Keep floor ID and map_path, change only floor 1 dimensions.
  UPDATE public.floors SET map_width=1400,map_height=800
    WHERE id=v_floor1.id AND company_id=v_company AND floor_number=1;
  IF NOT EXISTS(SELECT 1 FROM public.floors WHERE id=v_floor1.id
    AND company_id=v_company AND floor_number=1 AND map_width=1400 AND map_height=800) THEN
    RAISE EXCEPTION 'FLOOR1_MAP_VALIDATION_FAILED';
  END IF;
  IF (SELECT count(*) FROM public.seats WHERE company_id=v_company AND floor_id=v_floor1.id)<>48
    OR EXISTS(SELECT 1 FROM public.seats WHERE company_id=v_company AND floor_id=v_floor1.id
      AND label !~ '^[ABC]-(0[1-9]|1[0-6])$')
    OR (SELECT count(DISTINCT split_part(label,'-',1)) FROM public.seats
      WHERE company_id=v_company AND floor_id=v_floor1.id)<>3
    OR EXISTS(SELECT 1 FROM public.seats WHERE company_id=v_company AND floor_id=v_floor1.id
      GROUP BY split_part(label,'-',1) HAVING count(*)<>16) THEN
    RAISE EXCEPTION 'FLOOR1_FINAL_VALIDATION_FAILED';
  END IF;

  IF to_jsonb(v_floor2) IS DISTINCT FROM (SELECT to_jsonb(f) FROM public.floors f WHERE id=v_floor2.id)
    OR v_floor2_seats IS DISTINCT FROM (
      SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.id),'[]'::jsonb)
      FROM public.seats s WHERE s.company_id=v_company AND s.floor_id=v_floor2.id)
    OR v_floor2_employees IS DISTINCT FROM (
      SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.id),'[]'::jsonb)
      FROM public.employees e JOIN public.seats s ON s.id=e.seat_id AND s.company_id=e.company_id
      WHERE e.company_id=v_company AND s.floor_id=v_floor2.id) THEN
    RAISE EXCEPTION 'FLOOR2_CHANGED: rolling back the whole migration';
  END IF;

  INSERT INTO private.sensespace_migrations(version) VALUES('010_inthon_floor1_seats_48');
  v_report=jsonb_build_object('migration','010_inthon_floor1_seats_48',
    'floor1_seats',v_inserted,'map_width',1400,'map_height',800,
    'cleared_seat_ids',v_cleared,'deleted_seats',v_deleted,
    'floor2_seats',jsonb_array_length(v_floor2_seats),'floor2_unchanged',true);
  -- Small session report for the final SELECT in the same SQL Editor batch.
  -- No permanent table or credentials are created.
  PERFORM set_config('sensespace.floor1_010_report',v_report::text,false);
  RAISE NOTICE '010 result: %',v_report;
END;
$migration$;

COMMIT;

SELECT r->>'migration' AS migration,
       (r->>'floor1_seats')::integer AS floor1_seats,
       (r->>'map_width')::integer AS map_width,
       (r->>'map_height')::integer AS map_height,
       (r->>'cleared_seat_ids')::integer AS cleared_seat_ids,
       (r->>'deleted_seats')::integer AS deleted_seats,
       (r->>'floor2_seats')::integer AS floor2_seats,
       (r->>'floor2_unchanged')::boolean AS floor2_unchanged
FROM (SELECT current_setting('sensespace.floor1_010_report')::jsonb AS r) result;
```

성공하면 마지막 조회에서 다음 값이 나온다.

| 항목 | 기대값 |
|---|---|
| migration | 010_inthon_floor1_seats_48 |
| floor1_seats | 48 |
| map_width / map_height | 1400 / 800 |
| cleared_seat_ids | **그 실행에서 실제로 NULL로 바꾼 직원 수** |
| deleted_seats | 76 |
| floor2_seats / floor2_unchanged | 93 / true |

cleared_seat_ids는 전체 seat_id IS NULL 직원 수가 아니다. 실행 직전 1층 좌석이 있었고 이번 UPDATE로 해제된 행 수다. 이력 테이블을 새로 만들지 않으므로 **이 실행 결과를 보관**한다. 마지막 SELECT만 새 탭에서 실행하면 이전 배치의 보고 설정이 없어 실패할 수 있으며, 그때도 010 전체를 다시 실행하지 않는다.

### 2-2. FE 확인

기존 1층 직원은 저장된 이전 seat UUID를 그대로 쓰지 말고 최신 seats를 다시 읽어 선택한다. 라벨 매칭은 기존처럼 A-01 → A-1로 정규화한다. 선택/저장은 기존 choose_seat를 사용한다. 재선택 시 기존 006의 감각 초기화 규칙이 적용된다.

원본 요청의 “남기는 라벨만 좌표 갱신” 설명 대신, 사용자가 확정한 **전체 배정 해제 → 전 좌석 삭제 → 48석 신규 생성** 방식을 사용했다. 기존 배정 유지형 upsert는 하지 않는다.

## 3. 실패 시 보완

- 원본 SQL의 seat_id=NULL만 실행하면 임시 좌석이 남아 직원 제약조건 또는 좌석 FK를 위반할 수 있다. 010은 이를 실행 전에 검사해 중단한다.
- 1층이 76석·4938×2868, 2층이 93석·1713×918인 요청 전제와 다르면 중단한다.
- 다른 층에 새 A/B/C 라벨이 이미 있으면 회사 전체 라벨 충돌을 피하기 위해 중단한다.
- 알려지지 않은 다른 테이블이 이전 좌석을 참조하면 DELETE가 실패하여 전부 롤백된다. CASCADE, 트리거 비활성화, 다른 층 삭제로 우회하지 않는다.
- 기존 마이그레이션 번호를 덮어쓰지 않는다. 010 적용 성공 뒤 다시 초기화하려면 별도 요청과 새 번호가 필요하다.

## 4. 적용 후 확인 쿼리

```sql
SELECT f.floor_number,f.map_width,f.map_height,count(s.id) AS seats
FROM public.floors f
LEFT JOIN public.seats s ON s.floor_id=f.id AND s.company_id=f.company_id
WHERE f.company_id='ff484ad2-375d-416e-86fa-95e01f2b1323'
GROUP BY f.floor_number,f.map_width,f.map_height
ORDER BY f.floor_number;
-- 1: 1400 / 800 / 48
-- 2: 1713 / 918 / 93

SELECT split_part(s.label,'-',1) AS row,count(*) AS seats
FROM public.seats s JOIN public.floors f ON f.id=s.floor_id AND f.company_id=s.company_id
WHERE f.company_id='ff484ad2-375d-416e-86fa-95e01f2b1323' AND f.floor_number=1
GROUP BY 1 ORDER BY 1;
-- A 16 / B 16 / C 16

SELECT version FROM private.sensespace_migrations WHERE version ~ '^010($|_)';
-- 010_inthon_floor1_seats_48
```

확인할 항목:

- [x] 1층 48석, 크기 1400×800 — 적용 SQL 내부 검사 및 사용자 성공 회신 기준
- [x] A/B/C 각 16석, 요청 좌표 일치 — 동일한 적용 SQL 및 내부 검사 기준
- [x] 2층 93석과 지도/기존 배정 보존 — 변경 전후 비교 검사 및 사용자 성공 회신 기준
- [x] 실행 결과의 cleared_seat_ids 보관 — 사용자 확인 0건
- [ ] 1층 직원 재입장 → 자리 재선택 → 저장·새로고침 확인
- [ ] 중복·타사 좌석 선택 거부

## 5. 검증 및 운영 적용 상태

PostgreSQL 17 임시 DB에서 다음 8개 시나리오 묶음을 통과했다. 기존 001/004/005/006, 최신 front의 007_reference_skin_tone, 009 LLM SQL 위에 검증했다. 기존 008의 별도 코드는 저장소에 없으므로 2층 93석·1713×918 데이터를 테스트용으로 구성했다. 운영 Supabase에 접속하거나 실제 FE의 재입장 흐름을 실행한 검증은 아니다.

| 검증 | 결과 |
|---|---|
| 사전 조회 | 1층 좌석·배정된 직원·임시 이동·010 기록을 정확히 조회 |
| 1층↔2층 임시 이동 | 두 방향 모두 변경 전 중단, 모든 데이터 보존 |
| 추가 FK로 DELETE 실패 | 배정 해제·알림 생성·좌석 삭제 모두 롤백 |
| 이미 사용한 010 번호 | 기존 마이그레이션 보존, 작업 거부 |
| 요청과 다른 초기 지도 | 작업 거부, 변경 없음 |
| 정상 재구성 | 정확한 좌표 48개, 1400×800, 실제 초기화 2건 출력. **2건은 테스트 데이터 결과이며 운영 건수가 아님** |
| 영향 범위 | 2층 좌석 UUID·좌표·지도·직원 배정, 다른 회사 데이터, 기존 메시지·근태·감각 보존. 기존 점유 트리거와 위치 revision 정상 동작 |
| 적용 후 API·재실행 | 새 좌석 선택 및 기존 감각 초기화 정상, 중복/타사 좌석 거부, 재실행 시 새 배정을 다시 비우지 않음 |

임시 PostgreSQL 컨테이너와 검증용 Python 파일을 삭제했다. 사용자가 운영 실행 성공 및 초기화 0건을 확인했다. 이 적용 기록은 사용자 요청에 따라 back 브랜치에서 관리한다.

## 6. 운영 적용 결과 — 사용자 확인

아래는 010의 내부 검사 통과와 사용자의 실행 성공 회신을 기준으로 기록한 결과다. 원격 DB를 직접 조회한 결과와 구별한다.

| 항목 | 결과 |
|---|---|
| 마이그레이션 | 010_inthon_floor1_seats_48 |
| 1층 좌석 | 48석, A/B/C 각 16석 |
| 1층 지도 크기 | 1400×800 |
| 초기화된 seat_id | **0건 — 사용자 출력값 확인** |
| 2층 | 93석·1713×918, 기존 좌석 및 배정 보존 |

0건은 이번 적용 시점에 해제할 1층 좌석 배정이 없었다는 뜻이며 좌석 48석 생성 실패를 의미하지 않는다. FE의 자리 선택·저장 확인은 위 미완료 항목으로 남긴다.
