# Supabase 담당자에게 — 개인 초대 링크(익명 로그인) 적용 요청

안녕하세요. 프론트에서 **로그인/회원가입 화면을 없애고, 사람마다 고유한 링크로 본인 계정에 입장**하는 방식으로 바꿨습니다. 프론트 코드는 이미 붙어 있고, 아래 Supabase 쪽 변경만 적용되면 연결됩니다. (007은 이미 일부 적용된 것으로 보입니다 — 0번 참고. 아래 SQL은 최종 확인용 초안입니다.)

## 0. 현재 확인된 상태 (2026-11-01, publishable 키로 확인)

- `public.issue_employee_link`, `public.redeem_employee_link` 함수는 **이미 설치돼 있습니다.**
  - `issue_employee_link`를 anon 키로 호출하면 `permission denied for function issue_employee_link` → service_role 전용으로 잘 막혀 있음.
  - `redeem_employee_link`를 anon 키로 호출하면 `{"error_code":"LINK_INVALID"}` → 정상 동작.
- **익명 로그인이 아직 꺼져 있습니다.** `/auth/v1/settings` 응답이 `external.anonymous_users: false`입니다. 이 설정만 켜지면 링크 입장이 됩니다. (아래 2-1)
- `employees.user_id` NULL 허용, `preferred_floor_number`/`floor_number` 추가, 좌석 없는 직원 숨김(RLS)은 세션 없이는 확인이 안 되어 아래 체크리스트로 남겨 둡니다.

## 1. 프론트가 하는 일 (계약)

1. `GET /enter/<token>` 링크로 들어온다.
2. 세션이 없으면 `supabase.auth.signInAnonymously()`로 익명 로그인한다.
3. `supabase.rpc('redeem_employee_link', { p_token: '<token>' })`를 호출한다.
   - 성공: `{ "employee_id": ..., "company_id": ... }`
   - 실패: **예외를 던지지 말고** `{ "error_code": "LINK_INVALID" | "LINK_EXPIRED" | "LINK_REVOKED" | "LINK_ALREADY_BOUND" }`를 돌려주세요. (`join_company`와 같은 방식)
4. 이후에는 기존 API를 그대로 씁니다: `get_my_membership`, `get_sensory_cards`, `choose_seat`, `set_employee_status`, `set_current_sensations` 등.
5. `LINK_ALREADY_BOUND`를 받으면 프론트가 기존 세션을 로그아웃하고 새 익명 세션으로 **한 번만 재시도**합니다.
6. 프론트에는 **publishable(anon) 키만** 들어갑니다. service_role 키는 절대 넣지 않습니다.

프론트에서 쓰는 에러 문구 (참고):
- `LINK_INVALID` → "초대 링크가 올바르지 않아요…"
- `LINK_EXPIRED` → "초대 링크가 만료됐어요…"
- `LINK_REVOKED` → "사용할 수 없는 초대 링크예요…"
- `LINK_ALREADY_BOUND` → "이미 다른 계정에 연결된 링크예요…"

## 2. 필요한 변경

### 2-1. Auth 설정
- Supabase Dashboard → Authentication → Sign In / Providers → **Anonymous sign-ins 활성화**.
- **CAPTCHA**: 익명 로그인도 CAPTCHA와 함께 쓸 수 있지만, 클라이언트가 `signInAnonymously({ options: { captchaToken } })`로 토큰을 함께 보내야 합니다. 현재 FE에는 CAPTCHA 위젯도 토큰 전달도 없어서 **CAPTCHA가 켜져 있으면 입장이 실패**합니다. 지금은 CAPTCHA를 꺼 두시고, 꼭 켜야 한다면 사이트 키(hCaptcha/Turnstile)를 주시면 FE에 위젯과 토큰 전달을 붙이겠습니다.

### 2-2. `employees.user_id`를 NULL 허용
관리자가 좌석/이름만 만들어 둔 "초대 대기 직원"은 아직 auth 계정이 없습니다.
`UNIQUE` 제약은 그대로 두면 NULL은 여러 행 허용되므로 문제 없습니다.

```sql
ALTER TABLE public.employees ALTER COLUMN user_id DROP NOT NULL;
-- employees.user_id UNIQUE 유지
```

### 2-3. 초대 링크 테이블 (private, FE에서 직접 접근 불가)

```sql
CREATE TABLE private.employee_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  floor_number integer,               -- 좌석 선택 화면을 열 층
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX employee_links_employee_idx ON private.employee_links(employee_id);

REVOKE ALL ON private.employee_links FROM PUBLIC, anon, authenticated;
-- 토큰 원문은 저장하지 않고 sha256 해시만 저장합니다 (join code와 동일한 방식).
```

### 2-4. 좌석 선택 전 "입장할 층"
초대 대기 직원은 `seat_id`가 없어서 `get_sensory_cards`가 층을 알려주지 못합니다. 프론트는 좌석 선택 화면을 그 층으로 열어야 하므로:
- `employees.preferred_floor_number integer`를 추가하고,
- 링크 redeem 시 `employee_links.floor_number` 값을 복사해 주세요.
- `get_sensory_cards` / `get_my_membership` 응답에 **`floor_number`**를 추가해 주세요 (좌석이 있으면 좌석 층, 없으면 preferred 값).

```sql
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS preferred_floor_number integer;

-- get_sensory_cards (006 버전) 안에
--   'seat', CASE ... END,
-- 다음 줄에 추가:
--   'floor_number', coalesce(f.floor_number, e.preferred_floor_number),
--
-- get_my_membership (006 버전)에도 같은 키를 추가하고,
--   LEFT JOIN public.floors f ON f.id = s.floor_id AND f.company_id = e.company_id
--   (s는 seats, e.seat_id 기준) 조인을 추가해 주세요.
CREATE OR REPLACE FUNCTION public.get_my_membership() RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT jsonb_build_object('employee_id',e.id,'company_id',e.company_id,'company_name',c.name,
    'name',e.name,'job_title',e.job_title,'seat_id',e.seat_id,
    'floor_number',coalesce(f.floor_number,e.preferred_floor_number),
    'location',public.get_employee_location(e.id),
    'team',CASE WHEN t.id IS NULL THEN NULL ELSE jsonb_build_object('id',t.id,'name',t.name) END,
    'avatar',(to_jsonb(a)-'employee_id')||jsonb_build_object('character',
      CASE WHEN a.is_complete THEN private.avatar_character(a.selections) ELSE NULL END))
  FROM public.employees e JOIN public.companies c ON c.id=e.company_id
  LEFT JOIN public.seats s ON s.id=e.seat_id AND s.company_id=e.company_id
  LEFT JOIN public.floors f ON f.id=s.floor_id AND f.company_id=e.company_id
  LEFT JOIN public.teams t ON t.id=e.team_id AND t.company_id=e.company_id
  LEFT JOIN public.employee_avatars a ON a.employee_id=e.id
  WHERE e.id=(SELECT private.my_employee_id());
$$;
```

> 프론트의 기본값은 `1`이라, 위 키가 없어도 에러 없이 동작합니다. 다만 2·3층 건물에서 초대 직원이 1층 빈 지도를 보게 되므로 적용을 권장합니다.

### 2-5. 링크 사용(입장) RPC

동작 순서:
1. `auth.uid()`가 없으면 `LINK_INVALID`.
2. 토큰 해시로 링크 조회. 없으면 `LINK_INVALID`, `revoked_at`이면 `LINK_REVOKED`, 만료면 `LINK_EXPIRED`.
3. 현재 세션이 **이미 다른 직원에게 연결돼 있으면** `LINK_ALREADY_BOUND`. (`employees.user_id` UNIQUE 위반 예외가 나지 않도록, 연결을 시도하기 전에 먼저 검사합니다. 프론트는 이 코드를 받으면 로그아웃 후 새 익명 세션으로 한 번 재시도하므로, 그때는 새 `user_id`로 정상 연결됩니다.)
4. 대상 직원 `user_id`가 NULL이면 현재 익명 사용자로 연결.
5. 이미 현재 사용자로 연결돼 있으면 그대로 성공(멱등).
6. 다른 사용자로 연결돼 있으면:
   - 그 사용자가 **익명 사용자**면 새 익명 사용자로 재연결 (링크 소지자 = 본인이라는 전제. 같은 브라우저 재입장/기기 변경 대응)
   - **영구 계정(이메일 등)** 이면 `LINK_ALREADY_BOUND`
7. `last_used_at`, `employees.preferred_floor_number` 갱신.

```sql
CREATE OR REPLACE FUNCTION public.redeem_employee_link(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_link private.employee_links;
  v_emp public.employees;
  v_prev_anonymous boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error_code','LINK_INVALID');
  END IF;
  IF p_token IS NULL OR length(btrim(p_token)) < 32 THEN
    RETURN jsonb_build_object('error_code','LINK_INVALID');
  END IF;

  SELECT * INTO v_link FROM private.employee_links
   WHERE token_hash = encode(extensions.digest(btrim(p_token),'sha256'),'hex')
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error_code','LINK_INVALID');
  END IF;
  IF v_link.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('error_code','LINK_REVOKED');
  END IF;
  IF v_link.expires_at <= clock_timestamp() THEN
    RETURN jsonb_build_object('error_code','LINK_EXPIRED');
  END IF;

  SELECT * INTO v_emp FROM public.employees WHERE id = v_link.employee_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error_code','LINK_INVALID');
  END IF;

  -- 이 세션이 이미 다른 직원에게 연결돼 있으면 UNIQUE 예외 대신 코드로 돌려줍니다.
  -- (프론트는 LINK_ALREADY_BOUND를 받으면 로그아웃 → 새 익명 세션으로 1회 재시도)
  IF EXISTS (SELECT 1 FROM public.employees WHERE user_id = v_uid AND id <> v_emp.id) THEN
    RETURN jsonb_build_object('error_code','LINK_ALREADY_BOUND');
  END IF;

  IF v_emp.user_id IS NULL OR v_emp.user_id = v_uid THEN
    UPDATE public.employees
       SET user_id = v_uid,
           preferred_floor_number = coalesce(v_link.floor_number, preferred_floor_number)
     WHERE id = v_emp.id;
  ELSE
    SELECT u.is_anonymous INTO v_prev_anonymous FROM auth.users u WHERE u.id = v_emp.user_id;
    IF coalesce(v_prev_anonymous, false) THEN
      UPDATE public.employees
         SET user_id = v_uid,
             preferred_floor_number = coalesce(v_link.floor_number, preferred_floor_number)
       WHERE id = v_emp.id;
    ELSE
      RETURN jsonb_build_object('error_code','LINK_ALREADY_BOUND');
    END IF;
  END IF;

  UPDATE private.employee_links SET last_used_at = clock_timestamp() WHERE id = v_link.id;

  RETURN jsonb_build_object('employee_id', v_emp.id, 'company_id', v_emp.company_id);
END $$;

REVOKE ALL ON FUNCTION public.redeem_employee_link(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_employee_link(text) TO anon, authenticated;
```

### 2-6. 링크 발급 (관리자/서버 전용)

직원을 미리 만들고 링크 토큰을 1회 발급합니다. `service_role` 또는 대시보드에서만 실행되도록 권한을 막아 주세요. 이미 만든 직원(`p_employee_id`)에 링크만 추가할 때는 그 직원이 `p_company_id` 소속인지 확인하고, 아니면 `EMPLOYEE_COMPANY_MISMATCH`로 거부합니다.

```sql
CREATE OR REPLACE FUNCTION public.issue_employee_link(
  p_company_id uuid,
  p_name text,
  p_job_title text DEFAULT '',
  p_floor_number integer DEFAULT NULL,
  p_employee_id uuid DEFAULT NULL,     -- 이미 만든 직원에 링크만 추가할 때
  p_expires_days integer DEFAULT 30
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_raw text := encode(extensions.gen_random_bytes(24),'hex');  -- 48 hex chars
  v_emp uuid := p_employee_id;
BEGIN
  -- 이미 만든 직원에 링크만 발급할 때는 요청한 회사 소속인지 먼저 확인합니다.
  IF v_emp IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.employees WHERE id = v_emp AND company_id = p_company_id) THEN
      RAISE EXCEPTION 'EMPLOYEE_COMPANY_MISMATCH' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF v_emp IS NULL THEN
    INSERT INTO public.employees(company_id,name,job_title,user_id)
    VALUES(p_company_id,btrim(p_name),coalesce(p_job_title,''),NULL)
    RETURNING id INTO v_emp;
  END IF;

  INSERT INTO private.employee_links(employee_id,token_hash,floor_number,expires_at)
  VALUES(v_emp,
         encode(extensions.digest(v_raw,'sha256'),'hex'),
         p_floor_number,
         clock_timestamp() + make_interval(days => greatest(1,coalesce(p_expires_days,30))));

  RETURN jsonb_build_object(
    'employee_id', v_emp,
    'token', v_raw,
    'path', '/enter/' || v_raw,
    'expires_at', (SELECT expires_at FROM private.employee_links WHERE employee_id=v_emp ORDER BY created_at DESC LIMIT 1)
  );
END $$;

REVOKE ALL ON FUNCTION public.issue_employee_link(uuid,text,text,integer,uuid,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_employee_link(uuid,text,text,integer,uuid,integer) TO service_role;
```

발급된 `path`를 프론트 오리진에 붙여 1:1로 전달하면 됩니다.
예: `https://<프론트 도메인>/enter/9f3c…` (쿼리 방식 `?t=9f3c…`도 지원)
로컬 테스트: `http://127.0.0.1:5173/enter/<token>`

재발급/폐기:
```sql
UPDATE private.employee_links SET revoked_at = now()
 WHERE employee_id = '<employee-id>' AND revoked_at IS NULL;
```

## 3. 보안/운영 메모

- **링크 자체가 인증 수단**입니다. 1:1로 전달하고, 공개 채널에 붙이지 마세요.
- 토큰 원문은 DB에 저장하지 않고 해시만 저장합니다.
- 익명 재연결을 허용하면 기기/브라우저를 바꿔도 같은 링크로 입장할 수 있습니다. 대신 링크가 유출되면 제3자가 그 직원으로 들어올 수 있으니, 필요하면 **최초 입장 후 `revoked_at`을 채우는 정책**으로 바꿔 주세요. 그 경우 프론트는 `LINK_ALREADY_BOUND`/`LINK_REVOKED` 문구를 그대로 보여 줍니다.
- `redeem_employee_link`에 시도 횟수 제한(예: IP/토큰 기준)을 걸어 주시면 좋습니다.
- 기존 `join_company`(기업 초대 코드)는 이 플로우에서 사용하지 않습니다. 제거하지 않아도 됩니다.
- 프론트는 `employees.user_id`가 NULL인 직원도 초대 대기 상태로 취급합니다. **좌석이 배정되기 전에는 다른 동료의 목록/지도에 보이면 안 됩니다.** `get_sensory_cards`의 `WHERE`에 아래 조건을 추가해 주세요.

```sql
-- 006 버전 get_sensory_cards의 WHERE 절
WHERE e.company_id = p_company_id
  AND (p_employee_id IS NULL OR e.id = p_employee_id)
  AND (p_after IS NULL OR e.id > p_after)
  -- 좌석 없는 초대 대기 직원은 본인 조회에서만 보이게
  AND (e.seat_id IS NOT NULL OR e.id = (SELECT private.my_employee_id()))
```

카드 RPC뿐 아니라 **테이블 직접 조회(RLS)**에도 같은 조건을 반영해 주세요. `employees`의 SELECT 정책을 좁히면 `sensory_profiles`·`employee_statuses`·`current_sensations` 정책의 `EXISTS (SELECT 1 FROM public.employees …)` 조건도 같은 RLS를 상속하므로, 좌석 없는 직원의 프로필/상태/감각도 함께 가려집니다. (본인 행은 항상 보이므로 본인 데이터 조회와 `get_my_membership`은 그대로 동작합니다.)

```sql
DROP POLICY employee_read ON public.employees;
CREATE POLICY employee_read ON public.employees FOR SELECT TO authenticated
USING (
  company_id = (SELECT private.my_company_id())
  AND (seat_id IS NOT NULL OR user_id = (SELECT auth.uid()))
);
```

## 4. 적용 후 확인 체크리스트

- [ ] Anonymous sign-ins 활성화, CAPTCHA 미적용 (켜려면 FE에 위젯/토큰 전달 필요)
- [ ] `employees.user_id` NULL 허용
- [ ] `private.employee_links` 생성 + 권한 회수
- [ ] `redeem_employee_link`가 `anon`에서 호출 가능, 에러는 `error_code`로 반환
- [ ] 현재 세션이 이미 다른 직원에게 연결돼 있으면 `LINK_ALREADY_BOUND` (UNIQUE 예외 아님)
- [ ] `get_sensory_cards`/`get_my_membership`에 `floor_number`
- [ ] `get_sensory_cards`와 `employees` SELECT 정책 모두에서 좌석 없는 초대 대기 직원은 본인에게만 보임
- [ ] `issue_employee_link`로 토큰 발급 → `/enter/<token>` 접속
- [ ] `issue_employee_link`에 다른 회사 직원 ID를 넘기면 `EMPLOYEE_COMPANY_MISMATCH`
- [ ] 최초 입장 시: 환영 → 기본 정보 → 캐릭터 꾸미기 → 내 자리 선택 → 지도
- [ ] 새로고침해도 같은 직원으로 유지, 다른 브라우저에서도 같은 링크로 입장(정책에 따라 다름)
- [ ] 폐기한 링크는 `LINK_REVOKED` 문구 표시
- [ ] 직원 링크 10개 발급 후 회신 (5번)

## 5. 요청 — 사용자 링크 10개 발급

2-1의 **익명 로그인을 켜 주신 뒤**, 아래로 직원 10명 링크를 한 번에 발급해 주세요. (회사: Inthon `ff484ad2-375d-416e-86fa-95e01f2b1323`, 입장 층: `1`)

```sql
with people(name, job_title) as (values
  ('직원1',  '프로덕트 디자이너'),
  ('직원2',  'UX 리서처'),
  ('직원3',  '그래픽 디자이너'),
  ('직원4',  'UI 디자이너'),
  ('직원5',  'BX 디자이너'),
  ('직원6',  '프로덕트 디자이너'),
  ('직원7',  'UX 리서처'),
  ('직원8',  '그래픽 디자이너'),
  ('직원9',  'UI 디자이너'),
  ('직원10', 'BX 디자이너')
)
select p.name,
       public.issue_employee_link(
         'ff484ad2-375d-416e-86fa-95e01f2b1323',
         p.name,
         p.job_title,
         1
       ) as issued
from people p;
```

- **회신 형식**: `이름 | issued->>'path' | issued->>'expires_at'` 10줄. (path에 토큰이 들어 있습니다.)
- 이름/직무는 임시값입니다. 실제 명단을 주시면 그걸로 바꿔 다시 요청드리겠습니다. 이름은 첫 입장의 "기본 정보" 단계에서 본인이 수정할 수 있습니다.
- 같은 SQL을 두 번 실행하면 직원이 중복 생성되니 **1회만** 실행해 주세요. 이미 만든 직원에 링크만 붙일 때는 `p_employee_id`를 함께 넘기면 됩니다.
- 링크는 **1:1로만** 전달해 주세요(공개 채널 금지). 프론트 도메인은 지금 로컬 개발 주소(`http://127.0.0.1:5173`)이고, 배포 도메인이 정해지면 그 기준으로 다시 안내드리겠습니다.
- 10개 중 1개만 먼저 주셔도 됩니다. 받는 대로 실제 입장(환영 → 기본 정보 → 캐릭터 → 내 자리 → 지도)까지 검증해서 결과를 공유하겠습니다.
