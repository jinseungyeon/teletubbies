# 009 업무 상태·알림 예약 비서 — Supabase SQL

상태 갱신: 사용자가 설치 전 조회와 009 SQL 실행 성공을 회신했다. 운영 DB에 직접 접속한 검증은 하지 않았다. 아래 Cron 등록 SQL의 실행은 아직 확인 전이다. 기존 001~008과 성공한 009는 재실행하지 않는다. FE 및 실행 소스 파일은 수정하지 않는다.

009는 006의 직원·상태·좌석 잠금 규약을 재사용한다. 007 개인 링크와 008 층 추가는 그대로 유지된다. 알림은 실제 지원하는 **본인의 좌석 배정 변경 알림**만 제어한다.

아래 첫 SQL 블록 전체가 한 마이그레이션이다. 끝의 COMMIT까지 한 번에 실행한다. SQL Editor의 관리자 실행 결과는 실제 사용자 RLS 테스트를 대신하지 않는다.

```sql
BEGIN;
INSERT INTO private.sensespace_migrations(version) VALUES('009_sensory_assistant');

CREATE TABLE public.employee_notification_preferences (
  employee_id uuid PRIMARY KEY REFERENCES public.employees(id) ON DELETE CASCADE,
  seat_changed_enabled boolean NOT NULL DEFAULT true,
  revision bigint NOT NULL DEFAULT 0,
  manual_revision bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.employee_notification_preferences(employee_id) SELECT id FROM public.employees;
CREATE FUNCTION private.assistant_initialize_preferences() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  INSERT INTO public.employee_notification_preferences(employee_id) VALUES(NEW.id);
  RETURN NEW;
END;
$$;
CREATE TRIGGER assistant_initialize_preferences AFTER INSERT ON public.employees
FOR EACH ROW EXECUTE FUNCTION private.assistant_initialize_preferences();

ALTER TABLE public.employee_statuses
  ADD COLUMN attendance_revision bigint NOT NULL DEFAULT 0,
  ADD COLUMN attendance_manual_revision bigint NOT NULL DEFAULT 0,
  ADD COLUMN message_revision bigint NOT NULL DEFAULT 0,
  ADD COLUMN message_manual_revision bigint NOT NULL DEFAULT 0,
  ADD COLUMN emoji_revision bigint NOT NULL DEFAULT 0,
  ADD COLUMN emoji_manual_revision bigint NOT NULL DEFAULT 0;
ALTER TABLE public.employees ADD COLUMN assistant_location_revision bigint NOT NULL DEFAULT 0;

-- A browser-controlled GUC cannot impersonate the worker. Only owner code can add this row.
CREATE TABLE private.assistant_write_context (
  backend_pid integer NOT NULL, transaction_id bigint NOT NULL,
  PRIMARY KEY(backend_pid,transaction_id)
);
CREATE FUNCTION private.assistant_is_worker() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT EXISTS(SELECT 1 FROM private.assistant_write_context
    WHERE backend_pid=pg_backend_pid() AND transaction_id=txid_current());
$$;
CREATE FUNCTION private.assistant_status_revisions() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE worker boolean=private.assistant_is_worker();
BEGIN
  NEW.attendance_revision=OLD.attendance_revision;
  NEW.attendance_manual_revision=OLD.attendance_manual_revision;
  NEW.message_revision=OLD.message_revision;
  NEW.message_manual_revision=OLD.message_manual_revision;
  NEW.emoji_revision=OLD.emoji_revision;
  NEW.emoji_manual_revision=OLD.emoji_manual_revision;
  IF ROW(NEW.status,NEW.away_reason,NEW.away_reason_text)
    IS DISTINCT FROM ROW(OLD.status,OLD.away_reason,OLD.away_reason_text) THEN
    NEW.attendance_revision=OLD.attendance_revision+1;
    IF NOT worker THEN NEW.attendance_manual_revision=OLD.attendance_manual_revision+1; END IF;
  END IF;
  IF NEW.status_message IS DISTINCT FROM OLD.status_message THEN
    NEW.message_revision=OLD.message_revision+1;
    IF NOT worker THEN NEW.message_manual_revision=OLD.message_manual_revision+1; END IF;
  END IF;
  IF NEW.quick_emoji_id IS DISTINCT FROM OLD.quick_emoji_id THEN
    NEW.emoji_revision=OLD.emoji_revision+1;
    IF NOT worker THEN NEW.emoji_manual_revision=OLD.emoji_manual_revision+1; END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER assistant_status_revisions BEFORE UPDATE ON public.employee_statuses
FOR EACH ROW EXECUTE FUNCTION private.assistant_status_revisions();
CREATE FUNCTION private.assistant_preference_revisions() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  NEW.revision=OLD.revision;
  NEW.manual_revision=OLD.manual_revision;
  IF NEW.seat_changed_enabled IS DISTINCT FROM OLD.seat_changed_enabled THEN
    NEW.revision=OLD.revision+1;
    IF NOT private.assistant_is_worker() THEN NEW.manual_revision=OLD.manual_revision+1; END IF;
  END IF;
  NEW.updated_at=clock_timestamp(); RETURN NEW;
END;
$$;
CREATE TRIGGER assistant_preference_revisions BEFORE UPDATE ON public.employee_notification_preferences
FOR EACH ROW EXECUTE FUNCTION private.assistant_preference_revisions();
CREATE FUNCTION private.assistant_location_revision() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  NEW.assistant_location_revision=OLD.assistant_location_revision;
  IF ROW(NEW.seat_id,NEW.temporary_seat_id) IS DISTINCT FROM ROW(OLD.seat_id,OLD.temporary_seat_id) THEN
    NEW.assistant_location_revision=OLD.assistant_location_revision+1;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER assistant_location_revision BEFORE UPDATE ON public.employees
FOR EACH ROW EXECUTE FUNCTION private.assistant_location_revision();

CREATE OR REPLACE FUNCTION private.notify_seat_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF OLD.seat_id IS DISTINCT FROM NEW.seat_id AND coalesce((
    SELECT seat_changed_enabled FROM public.employee_notification_preferences WHERE employee_id=NEW.id
  ),true) THEN
    INSERT INTO public.notifications(employee_id,kind,title,body)
    VALUES(NEW.id,'seat_changed','좌석 배정 변경',
      CASE WHEN NEW.seat_id IS NULL THEN '좌석 배정이 해제되었습니다.' ELSE '새 좌석이 배정되었습니다.' END);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TABLE public.assistant_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  user_id uuid NOT NULL, company_id uuid NOT NULL,
  FOREIGN KEY(company_id,employee_id) REFERENCES public.employees(company_id,id),
  version integer NOT NULL DEFAULT 1 CHECK(version>0),
  state text NOT NULL CHECK(state IN ('editing','clarification','preview','confirmed','cancelled','error')),
  messages jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(messages)='array'),
  proposal jsonb, reply text NOT NULL DEFAULT '', questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  error_code text, expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE private.assistant_confirmations (
  draft_id uuid PRIMARY KEY REFERENCES public.assistant_drafts(id) ON DELETE CASCADE,
  version integer NOT NULL, token_hash text NOT NULL CHECK(token_hash~'^[0-9a-f]{64}$'),
  used_at timestamptz
);
CREATE TABLE private.assistant_rate_limits (
  employee_id uuid PRIMARY KEY REFERENCES public.employees(id) ON DELETE CASCADE,
  window_at timestamptz NOT NULL, minute_count integer NOT NULL,
  work_date date NOT NULL, daily_count integer NOT NULL
);
CREATE TABLE public.assistant_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id uuid NOT NULL UNIQUE REFERENCES public.assistant_drafts(id) ON DELETE CASCADE, draft_version integer NOT NULL,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  user_id uuid NOT NULL, company_id uuid NOT NULL,
  FOREIGN KEY(company_id,employee_id) REFERENCES public.employees(company_id,id),
  idempotency_key uuid NOT NULL, UNIQUE(employee_id,idempotency_key),
  proposal jsonb NOT NULL, starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL,
  CHECK(ends_at>starts_at),
  state text NOT NULL DEFAULT 'queued' CHECK(state IN
    ('queued','running','completed','completed_conflict','failed','cancelled','expired')),
  expected_manual jsonb NOT NULL, before_state jsonb, applied_state jsonb,
  start_attempts integer NOT NULL DEFAULT 0, end_attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(), cancel_requested boolean NOT NULL DEFAULT false,
  result jsonb NOT NULL DEFAULT '{}'::jsonb, error_code text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX assistant_reservations_due_idx ON public.assistant_reservations(state,next_attempt_at,starts_at,ends_at);
CREATE TABLE public.assistant_reservation_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  reservation_id uuid NOT NULL REFERENCES public.assistant_reservations(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL, user_id uuid NOT NULL, company_id uuid NOT NULL,
  kind text NOT NULL, detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX assistant_events_reservation_idx ON public.assistant_reservation_events(reservation_id,id);
CREATE TRIGGER assistant_drafts_touch BEFORE UPDATE ON public.assistant_drafts
FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at();
CREATE TRIGGER assistant_reservations_touch BEFORE UPDATE ON public.assistant_reservations
FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at();

CREATE FUNCTION private.assistant_snapshot(p_employee_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT jsonb_build_object('attendance',jsonb_build_object('status',st.status,'away_reason',st.away_reason,
    'away_reason_text',st.away_reason_text),'status_message',st.status_message,'quick_emoji_id',st.quick_emoji_id,
    'notifications',jsonb_build_object('seat_changed_enabled',np.seat_changed_enabled),
    'revisions',jsonb_build_object('attendance',st.attendance_revision,'message',st.message_revision,
      'emoji',st.emoji_revision,'notifications',np.revision,'location',e.assistant_location_revision),
    'manual',jsonb_build_object('attendance',st.attendance_manual_revision,'message',st.message_manual_revision,
      'emoji',st.emoji_manual_revision,'notifications',np.manual_revision,'location',e.assistant_location_revision),
    'is_moving',e.temporary_seat_id IS NOT NULL)
  FROM public.employees e JOIN public.employee_statuses st ON st.employee_id=e.id
  JOIN public.employee_notification_preferences np ON np.employee_id=e.id WHERE e.id=p_employee_id;
$$;
CREATE FUNCTION private.assistant_lock(p_employee_id uuid,p_company_id uuid) RETURNS public.employees
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.employees;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('sensespace:seats:'||p_company_id::text,0));
  PERFORM 1 FROM public.employee_statuses WHERE employee_id=p_employee_id FOR UPDATE;
  SELECT * INTO e FROM public.employees WHERE id=p_employee_id AND company_id=p_company_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ASSISTANT_EMPLOYEE_MISSING'; END IF;
  PERFORM 1 FROM public.employee_notification_preferences WHERE employee_id=p_employee_id FOR UPDATE;
  RETURN e;
END;
$$;
CREATE FUNCTION private.assistant_validate(p jsonb,p_now timestamptz) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE k text; c jsonb; a jsonb; v_start timestamptz; v_end timestamptz;
BEGIN
  IF jsonb_typeof(p) IS DISTINCT FROM 'object' OR NOT p ?& ARRAY['starts_at','ends_at','restore','changes']
    OR (SELECT count(*) FROM jsonb_object_keys(p))<>4 THEN RAISE EXCEPTION 'ASSISTANT_INVALID_PROPOSAL'; END IF;
  IF p->>'restore' NOT IN ('restore_previous','keep') OR jsonb_typeof(p->'restore')<>'string'
    OR jsonb_typeof(p->'starts_at')<>'string' OR jsonb_typeof(p->'ends_at')<>'string'
    OR p->>'starts_at' !~ '(Z|[+-][0-9]{2}:[0-9]{2})$'
    OR p->>'ends_at' !~ '(Z|[+-][0-9]{2}:[0-9]{2})$' THEN RAISE EXCEPTION 'ASSISTANT_INVALID_TIME'; END IF;
  BEGIN v_start=(p->>'starts_at')::timestamptz; v_end=(p->>'ends_at')::timestamptz;
  EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'ASSISTANT_INVALID_TIME'; END;
  IF NOT isfinite(v_start) OR NOT isfinite(v_end) OR v_start<=p_now OR v_end<=v_start
    OR v_end-v_start>interval '24 hours' OR v_start>p_now+interval '30 days' THEN
    RAISE EXCEPTION 'ASSISTANT_INVALID_TIME'; END IF;
  c=p->'changes';
  IF jsonb_typeof(c) IS DISTINCT FROM 'object' OR c='{}'::jsonb THEN RAISE EXCEPTION 'ASSISTANT_INVALID_CHANGES'; END IF;
  FOR k IN SELECT jsonb_object_keys(c) LOOP
    IF k NOT IN ('attendance','status_message','quick_emoji_id','notifications') THEN RAISE EXCEPTION 'ASSISTANT_UNSUPPORTED_ACTION'; END IF;
  END LOOP;
  IF c ? 'attendance' THEN
    a=c->'attendance';
    IF jsonb_typeof(a) IS DISTINCT FROM 'object' OR NOT a ?& ARRAY['status','away_reason','away_reason_text']
      OR (SELECT count(*) FROM jsonb_object_keys(a))<>3
      OR coalesce(a->>'status','') NOT IN ('working','away') THEN RAISE EXCEPTION 'ASSISTANT_INVALID_ATTENDANCE'; END IF;
    IF a->'away_reason'<>'null'::jsonb AND (jsonb_typeof(a->'away_reason')<>'string'
      OR a->>'away_reason' NOT IN ('lunch','meeting','outside')) THEN RAISE EXCEPTION 'ASSISTANT_INVALID_AWAY_REASON'; END IF;
    IF a->'away_reason_text'<>'null'::jsonb AND (jsonb_typeof(a->'away_reason_text')<>'string'
      OR length(a->>'away_reason_text') NOT BETWEEN 1 AND 20 OR a->>'away_reason_text'<>btrim(a->>'away_reason_text')) THEN
      RAISE EXCEPTION 'ASSISTANT_INVALID_AWAY_REASON'; END IF;
    IF (a->'away_reason'<>'null'::jsonb AND a->'away_reason_text'<>'null'::jsonb)
      OR (a->>'status'='working' AND (a->'away_reason'<>'null'::jsonb OR a->'away_reason_text'<>'null'::jsonb)) THEN
      RAISE EXCEPTION 'ASSISTANT_INVALID_AWAY_REASON'; END IF;
  END IF;
  IF c ? 'status_message' AND (jsonb_typeof(c->'status_message')<>'string' OR length(c->>'status_message')>20) THEN
    RAISE EXCEPTION 'ASSISTANT_INVALID_MESSAGE'; END IF;
  IF c ? 'quick_emoji_id' AND c->'quick_emoji_id'<>'null'::jsonb AND
    (jsonb_typeof(c->'quick_emoji_id')<>'string' OR NOT EXISTS(
      SELECT 1 FROM public.quick_emojis WHERE id=c->>'quick_emoji_id')) THEN RAISE EXCEPTION 'ASSISTANT_INVALID_EMOJI'; END IF;
  IF c ? 'notifications' AND (jsonb_typeof(c->'notifications') IS DISTINCT FROM 'object'
    OR NOT (c->'notifications') ? 'seat_changed_enabled'
    OR (SELECT count(*) FROM jsonb_object_keys(c->'notifications'))<>1
    OR jsonb_typeof(c->'notifications'->'seat_changed_enabled')<>'boolean') THEN
    RAISE EXCEPTION 'ASSISTANT_UNSUPPORTED_NOTIFICATION'; END IF;
END;
$$;
CREATE FUNCTION private.assistant_executable(p_employee_id uuid,p jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE snap jsonb=private.assistant_snapshot(p_employee_id); c jsonb=p->'changes';
BEGIN
  IF (c ? 'attendance' OR c ? 'status_message') AND snap->'attendance'->>'status'='off_work' THEN
    RAISE EXCEPTION 'ASSISTANT_EMPLOYEE_OFF_WORK'; END IF;
  IF c ? 'attendance' AND (snap->>'is_moving')::boolean THEN RAISE EXCEPTION 'ASSISTANT_RETURN_REQUIRED'; END IF;
END;
$$;

CREATE FUNCTION public.assistant_get_context() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.employees;
BEGIN
  SELECT * INTO e FROM public.employees WHERE user_id=auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'ASSISTANT_MEMBERSHIP_REQUIRED'; END IF;
  RETURN jsonb_build_object('employee_id',e.id,'user_id',e.user_id,'company_id',e.company_id,
    'employee_name',e.name,'server_now',clock_timestamp(),'timezone','Asia/Seoul',
    'state',private.assistant_snapshot(e.id),
    'capabilities',jsonb_build_object('attendance_statuses',jsonb_build_array('working','away'),
      'away_reasons',jsonb_build_array('lunch','meeting','outside'),
      'notification_keys',jsonb_build_array('seat_changed_enabled'),
      'notification_labels',jsonb_build_object('seat_changed_enabled','본인 좌석 배정 변경 알림'),
      'emoji_ids',(SELECT jsonb_agg(id ORDER BY sort_order) FROM public.quick_emojis)));
END;
$$;
CREATE FUNCTION public.assistant_set_notification_preferences(p_enabled boolean,p_expected_revision bigint DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.employees; np public.employee_notification_preferences;
BEGIN
  e=private.lock_employee_location(private.my_employee_id());
  SELECT * INTO np FROM public.employee_notification_preferences WHERE employee_id=e.id FOR UPDATE;
  IF p_enabled IS NULL THEN RAISE EXCEPTION 'ASSISTANT_INVALID_PREFERENCE'; END IF;
  IF p_expected_revision IS NOT NULL AND np.revision<>p_expected_revision THEN RAISE EXCEPTION 'ASSISTANT_VERSION_CONFLICT'; END IF;
  UPDATE public.employee_notification_preferences SET seat_changed_enabled=p_enabled
    WHERE employee_id=e.id RETURNING * INTO np;
  RETURN to_jsonb(np);
END;
$$;
CREATE FUNCTION public.assistant_begin_draft(p_text text,p_draft_id uuid DEFAULT NULL,p_version integer DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.employees; d public.assistant_drafts; rate private.assistant_rate_limits;
  v_now timestamptz=clock_timestamp(); today date=(clock_timestamp() AT TIME ZONE 'Asia/Seoul')::date;
BEGIN
  e=private.lock_employee_location(private.my_employee_id());
  IF p_text IS NULL OR length(btrim(p_text)) NOT BETWEEN 1 AND 2000 THEN RAISE EXCEPTION 'ASSISTANT_INVALID_TEXT'; END IF;
  INSERT INTO private.assistant_rate_limits AS r(employee_id,window_at,minute_count,work_date,daily_count)
    VALUES(e.id,v_now,1,today,1)
  ON CONFLICT(employee_id) DO UPDATE SET
    minute_count=CASE WHEN r.window_at<=v_now-interval '1 minute' THEN 1 ELSE r.minute_count+1 END,
    window_at=CASE WHEN r.window_at<=v_now-interval '1 minute' THEN v_now ELSE r.window_at END,
    daily_count=CASE WHEN r.work_date<>today THEN 1 ELSE r.daily_count+1 END,work_date=today
  RETURNING * INTO rate;
  IF rate.minute_count>8 OR rate.daily_count>80 THEN RAISE EXCEPTION 'ASSISTANT_RATE_LIMITED'; END IF;
  IF p_draft_id IS NULL THEN
    IF p_version IS NOT NULL THEN RAISE EXCEPTION 'ASSISTANT_VERSION_CONFLICT'; END IF;
    INSERT INTO public.assistant_drafts(employee_id,user_id,company_id,state,messages,expires_at)
      VALUES(e.id,auth.uid(),e.company_id,'editing',jsonb_build_array(
        jsonb_build_object('role','user','content',btrim(p_text))),v_now+interval '15 minutes')
      RETURNING * INTO d;
  ELSE
    SELECT * INTO d FROM public.assistant_drafts WHERE id=p_draft_id AND employee_id=e.id
      AND user_id=auth.uid() AND company_id=e.company_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'ASSISTANT_DRAFT_NOT_FOUND'; END IF;
    IF d.state IN ('confirmed','cancelled') THEN RAISE EXCEPTION 'ASSISTANT_DRAFT_NOT_EDITABLE'; END IF;
    IF p_version IS NULL OR d.version<>p_version THEN RAISE EXCEPTION 'ASSISTANT_VERSION_CONFLICT'; END IF;
    DELETE FROM private.assistant_confirmations WHERE draft_id=d.id;
    UPDATE public.assistant_drafts SET version=version+1,state='editing',reply='',questions='[]',error_code=NULL,
      messages=coalesce((SELECT jsonb_agg(value ORDER BY ord) FROM jsonb_array_elements(d.messages)
        WITH ORDINALITY v(value,ord) WHERE ord>jsonb_array_length(d.messages)-5),'[]'::jsonb)
        ||jsonb_build_array(jsonb_build_object('role','user','content',btrim(p_text))),
      expires_at=v_now+interval '15 minutes' WHERE id=d.id RETURNING * INTO d;
  END IF;
  RETURN jsonb_build_object('draft',to_jsonb(d),'context',public.assistant_get_context());
END;
$$;

-- Only the Edge Function's server client can finish interpretation and mint a confirmation hash.
CREATE FUNCTION public.assistant_finish_draft(p_user_id uuid,p_draft_id uuid,p_version integer,
  p_result jsonb,p_confirmation_hash text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.employees; d public.assistant_drafts; kind text=p_result->>'kind'; q jsonb;
BEGIN
  SELECT * INTO e FROM public.employees WHERE user_id=p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'ASSISTANT_MEMBERSHIP_REQUIRED'; END IF;
  e=private.assistant_lock(e.id,e.company_id);
  IF e.user_id IS DISTINCT FROM p_user_id THEN RAISE EXCEPTION 'ASSISTANT_AUTH_BINDING_CHANGED'; END IF;
  SELECT * INTO d FROM public.assistant_drafts WHERE id=p_draft_id AND employee_id=e.id
    AND user_id=p_user_id AND company_id=e.company_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ASSISTANT_DRAFT_NOT_FOUND'; END IF;
  IF d.version IS DISTINCT FROM p_version OR d.state<>'editing' THEN RAISE EXCEPTION 'ASSISTANT_VERSION_CONFLICT'; END IF;
  IF d.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'ASSISTANT_DRAFT_EXPIRED'; END IF;
  DELETE FROM private.assistant_confirmations WHERE draft_id=d.id;
  IF kind='preview' THEN
    PERFORM private.assistant_validate(p_result->'proposal',clock_timestamp());
    PERFORM private.assistant_executable(e.id,p_result->'proposal');
    IF p_confirmation_hash IS NULL OR p_confirmation_hash !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'ASSISTANT_INVALID_CONFIRMATION'; END IF;
    UPDATE public.assistant_drafts SET state='preview',proposal=p_result->'proposal',questions='[]',
      reply='다음 내용으로 예약할까요? 아직 예약되지 않았어요.',error_code=NULL WHERE id=d.id RETURNING * INTO d;
    INSERT INTO private.assistant_confirmations(draft_id,version,token_hash) VALUES(d.id,d.version,p_confirmation_hash);
  ELSIF kind='clarification' THEN
    q=p_result->'questions';
    IF jsonb_typeof(q) IS DISTINCT FROM 'array' OR jsonb_array_length(q) NOT BETWEEN 1 AND 3 THEN
      RAISE EXCEPTION 'ASSISTANT_INVALID_CLARIFICATION'; END IF;
    IF EXISTS(SELECT 1 FROM jsonb_array_elements(q) v WHERE jsonb_typeof(v)<>'string' OR length(v#>>'{}') NOT BETWEEN 1 AND 200) THEN
      RAISE EXCEPTION 'ASSISTANT_INVALID_CLARIFICATION'; END IF;
    UPDATE public.assistant_drafts SET state='clarification',questions=q,
      reply='추가 정보를 확인해 주세요. 아직 예약되지 않았어요.',error_code=NULL WHERE id=d.id RETURNING * INTO d;
  ELSIF kind='error' AND p_result->>'code' IN ('LLM_NOT_CONFIGURED','LLM_UNAVAILABLE','LLM_INVALID_OUTPUT') THEN
    UPDATE public.assistant_drafts SET state='error',error_code=p_result->>'code',
      reply='요청을 처리하지 못했어요. 아직 예약되지 않았어요.' WHERE id=d.id RETURNING * INTO d;
  ELSE RAISE EXCEPTION 'ASSISTANT_INVALID_RESULT'; END IF;
  RETURN to_jsonb(d);
END;
$$;

CREATE FUNCTION public.assistant_cancel_draft(p_draft_id uuid,p_version integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.employees; d public.assistant_drafts;
BEGIN
  e=private.lock_employee_location(private.my_employee_id());
  SELECT * INTO d FROM public.assistant_drafts WHERE id=p_draft_id AND employee_id=e.id
    AND user_id=auth.uid() AND company_id=e.company_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ASSISTANT_DRAFT_NOT_FOUND'; END IF;
  IF d.state='cancelled' THEN RETURN to_jsonb(d); END IF;
  IF d.version IS DISTINCT FROM p_version THEN RAISE EXCEPTION 'ASSISTANT_VERSION_CONFLICT'; END IF;
  IF d.state='confirmed' THEN RAISE EXCEPTION 'ASSISTANT_ALREADY_CONFIRMED'; END IF;
  UPDATE public.assistant_drafts SET state='cancelled',version=version+1 WHERE id=d.id RETURNING * INTO d;
  DELETE FROM private.assistant_confirmations WHERE draft_id=d.id;
  RETURN to_jsonb(d);
END;
$$;
CREATE FUNCTION private.assistant_event(p_id uuid,p_kind text,p_detail jsonb DEFAULT '{}'::jsonb) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
  INSERT INTO public.assistant_reservation_events(reservation_id,employee_id,user_id,company_id,kind,detail)
  SELECT id,employee_id,user_id,company_id,p_kind,p_detail FROM public.assistant_reservations WHERE id=p_id;
$$;
CREATE FUNCTION public.assistant_confirm_draft(p_draft_id uuid,p_version integer,p_confirmation_token text,
  p_idempotency_key uuid,p_confirmed boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.employees; d public.assistant_drafts; r public.assistant_reservations;
  proof private.assistant_confirmations; v_start timestamptz; v_end timestamptz;
BEGIN
  e=private.lock_employee_location(private.my_employee_id());
  IF p_confirmed IS DISTINCT FROM true OR p_idempotency_key IS NULL THEN RAISE EXCEPTION 'ASSISTANT_CONFIRMATION_REQUIRED'; END IF;
  SELECT * INTO d FROM public.assistant_drafts WHERE id=p_draft_id AND employee_id=e.id
    AND user_id=auth.uid() AND company_id=e.company_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ASSISTANT_DRAFT_NOT_FOUND'; END IF;
  IF d.version IS DISTINCT FROM p_version THEN RAISE EXCEPTION 'ASSISTANT_VERSION_CONFLICT'; END IF;
  SELECT * INTO proof FROM private.assistant_confirmations WHERE draft_id=d.id FOR UPDATE;
  IF NOT FOUND OR proof.version<>d.version OR p_confirmation_token IS NULL
    OR p_confirmation_token !~ '^[0-9a-f]{64}$'
    OR proof.token_hash<>encode(extensions.digest(p_confirmation_token,'sha256'),'hex') THEN
    RAISE EXCEPTION 'ASSISTANT_INVALID_CONFIRMATION'; END IF;
  -- Successful retries return the existing row; no second reservation is inserted.
  SELECT * INTO r FROM public.assistant_reservations WHERE draft_id=d.id;
  IF FOUND AND d.state='confirmed' THEN RETURN to_jsonb(r); END IF;
  IF d.state<>'preview' OR proof.used_at IS NOT NULL THEN RAISE EXCEPTION 'ASSISTANT_DRAFT_NOT_READY'; END IF;
  IF d.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'ASSISTANT_DRAFT_EXPIRED'; END IF;
  PERFORM private.assistant_validate(d.proposal,clock_timestamp());
  PERFORM private.assistant_executable(e.id,d.proposal);
  v_start=(d.proposal->>'starts_at')::timestamptz; v_end=(d.proposal->>'ends_at')::timestamptz;
  IF EXISTS(SELECT 1 FROM public.assistant_reservations WHERE employee_id=e.id
    AND idempotency_key=p_idempotency_key) THEN RAISE EXCEPTION 'ASSISTANT_IDEMPOTENCY_CONFLICT'; END IF;
  IF EXISTS(SELECT 1 FROM public.assistant_reservations WHERE employee_id=e.id AND state IN ('queued','running')
    AND tstzrange(starts_at,ends_at,'[)') && tstzrange(v_start,v_end,'[)')) THEN RAISE EXCEPTION 'ASSISTANT_OVERLAP'; END IF;
  INSERT INTO public.assistant_reservations(draft_id,draft_version,employee_id,user_id,company_id,idempotency_key,
    proposal,starts_at,ends_at,expected_manual,next_attempt_at)
    VALUES(d.id,d.version,e.id,auth.uid(),e.company_id,p_idempotency_key,d.proposal,v_start,v_end,
      private.assistant_snapshot(e.id)->'manual',v_start) RETURNING * INTO r;
  UPDATE private.assistant_confirmations SET used_at=clock_timestamp() WHERE draft_id=d.id;
  UPDATE public.assistant_drafts SET state='confirmed' WHERE id=d.id;
  PERFORM private.assistant_event(r.id,'confirmed');
  RETURN to_jsonb(r);
END;
$$;
CREATE FUNCTION public.assistant_cancel_reservation(p_reservation_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.employees; r public.assistant_reservations;
BEGIN
  e=private.lock_employee_location(private.my_employee_id());
  SELECT * INTO r FROM public.assistant_reservations WHERE id=p_reservation_id AND employee_id=e.id
    AND user_id=auth.uid() AND company_id=e.company_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ASSISTANT_RESERVATION_NOT_FOUND'; END IF;
  IF r.state='queued' THEN
    UPDATE public.assistant_reservations SET state='cancelled' WHERE id=r.id RETURNING * INTO r;
    PERFORM private.assistant_event(r.id,'cancelled');
  ELSIF r.state='running' AND NOT r.cancel_requested THEN
    UPDATE public.assistant_reservations SET cancel_requested=true,next_attempt_at=clock_timestamp()
      WHERE id=r.id RETURNING * INTO r;
    PERFORM private.assistant_event(r.id,'cancel_requested');
  END IF;
  RETURN to_jsonb(r);
END;
$$;

CREATE FUNCTION private.assistant_manual_conflict(c jsonb,expected jsonb,current_revisions jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT (c ? 'attendance' AND (expected->'attendance' IS DISTINCT FROM current_revisions->'attendance'
      OR expected->'location' IS DISTINCT FROM current_revisions->'location'))
    OR (c ? 'status_message' AND expected->'message' IS DISTINCT FROM current_revisions->'message')
    OR (c ? 'quick_emoji_id' AND expected->'emoji' IS DISTINCT FROM current_revisions->'emoji')
    OR (c ? 'notifications' AND expected->'notifications' IS DISTINCT FROM current_revisions->'notifications');
$$;
CREATE FUNCTION private.assistant_apply_changes(p_employee_id uuid,c jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF c ? 'attendance' THEN
    UPDATE public.employee_statuses SET status=c->'attendance'->>'status',
      away_reason=c->'attendance'->>'away_reason',away_reason_text=c->'attendance'->>'away_reason_text'
      WHERE employee_id=p_employee_id;
  END IF;
  IF c ? 'status_message' THEN UPDATE public.employee_statuses SET status_message=c->>'status_message' WHERE employee_id=p_employee_id; END IF;
  IF c ? 'quick_emoji_id' THEN UPDATE public.employee_statuses SET quick_emoji_id=c->>'quick_emoji_id' WHERE employee_id=p_employee_id; END IF;
  IF c ? 'notifications' THEN UPDATE public.employee_notification_preferences
    SET seat_changed_enabled=(c->'notifications'->>'seat_changed_enabled')::boolean WHERE employee_id=p_employee_id; END IF;
END;
$$;
CREATE FUNCTION private.assistant_restore(p_employee_id uuid,c jsonb,before_state jsonb,applied jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE current_state jsonb=private.assistant_snapshot(p_employee_id);
  restored jsonb='[]'; skipped jsonb='[]'; can_restore boolean;
BEGIN
  IF c ? 'attendance' THEN
    can_restore=current_state->'revisions'->'attendance'=applied->'revisions'->'attendance'
      AND current_state->'revisions'->'location'=applied->'revisions'->'location'
      AND current_state->'attendance'->>'status'<>'off_work'
      AND before_state->'attendance'->>'status' IN ('working','away');
    IF can_restore THEN
      UPDATE public.employee_statuses SET status=before_state->'attendance'->>'status',
        away_reason=before_state->'attendance'->>'away_reason',away_reason_text=before_state->'attendance'->>'away_reason_text'
        WHERE employee_id=p_employee_id;
      restored=restored||jsonb_build_array('attendance');
    ELSE skipped=skipped||jsonb_build_array('attendance'); END IF;
  END IF;
  IF c ? 'status_message' THEN
    IF current_state->'revisions'->'message'=applied->'revisions'->'message'
      AND current_state->'attendance'->>'status'<>'off_work' THEN
      UPDATE public.employee_statuses SET status_message=before_state->>'status_message' WHERE employee_id=p_employee_id;
      restored=restored||jsonb_build_array('status_message');
    ELSE skipped=skipped||jsonb_build_array('status_message'); END IF;
  END IF;
  IF c ? 'quick_emoji_id' THEN
    IF current_state->'revisions'->'emoji'=applied->'revisions'->'emoji' THEN
      UPDATE public.employee_statuses SET quick_emoji_id=before_state->>'quick_emoji_id' WHERE employee_id=p_employee_id;
      restored=restored||jsonb_build_array('quick_emoji_id');
    ELSE skipped=skipped||jsonb_build_array('quick_emoji_id'); END IF;
  END IF;
  IF c ? 'notifications' THEN
    IF current_state->'revisions'->'notifications'=applied->'revisions'->'notifications' THEN
      UPDATE public.employee_notification_preferences
        SET seat_changed_enabled=(before_state->'notifications'->>'seat_changed_enabled')::boolean WHERE employee_id=p_employee_id;
      restored=restored||jsonb_build_array('notifications');
    ELSE skipped=skipped||jsonb_build_array('notifications'); END IF;
  END IF;
  RETURN jsonb_build_object('restored',restored,'skipped',skipped);
END;
$$;

-- No public HTTP cron endpoint. Only the DB owner/Cron owner may execute this function.
CREATE FUNCTION private.assistant_tick(p_now timestamptz DEFAULT clock_timestamp(),p_limit integer DEFAULT 25) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE candidate record; e public.employees; r public.assistant_reservations;
  snap jsonb; c jsonb; outcome jsonb; processed integer=0; fail_code text; has_conflict boolean;
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtextextended('sensory-assistant:runner',0)) THEN
    RETURN jsonb_build_object('processed',0,'busy',true); END IF;
  PERFORM set_config('lock_timeout','2s',true);
  FOR candidate IN SELECT id,employee_id,company_id FROM public.assistant_reservations
    WHERE next_attempt_at<=p_now AND ((state='queued' AND starts_at<=p_now)
      OR (state='running' AND (ends_at<=p_now OR cancel_requested)))
    ORDER BY CASE WHEN state='running' THEN 0 ELSE 1 END,ends_at,id
    LIMIT greatest(1,least(coalesce(p_limit,25),100))
  LOOP
    -- Keep company/status locks outside the mutation savepoint, including on failure.
    BEGIN e=private.assistant_lock(candidate.employee_id,candidate.company_id);
    EXCEPTION WHEN OTHERS THEN CONTINUE; END;
    SELECT * INTO r FROM public.assistant_reservations WHERE id=candidate.id FOR UPDATE;
    IF NOT FOUND OR r.state NOT IN ('queued','running') OR r.next_attempt_at>p_now THEN CONTINUE; END IF;
    processed=processed+1; c=r.proposal->'changes';
    snap=private.assistant_snapshot(e.id);
    IF r.state='queued' THEN
      fail_code=NULL;
      IF r.user_id IS DISTINCT FROM e.user_id THEN fail_code='AUTH_BINDING_CHANGED';
      ELSIF p_now>=r.ends_at THEN fail_code='MISSED_WINDOW';
      ELSIF EXISTS(SELECT 1 FROM public.assistant_reservations prior WHERE prior.employee_id=e.id
        AND prior.id<>r.id AND prior.state='failed' AND prior.end_attempts>=3
        AND prior.updated_at>r.created_at) THEN fail_code='PREVIOUS_RESTORE_FAILED';
      ELSIF private.assistant_manual_conflict(c,r.expected_manual,snap->'manual') THEN fail_code='STATE_CHANGED_BEFORE_START';
      ELSIF (c ? 'attendance' OR c ? 'status_message') AND snap->'attendance'->>'status'='off_work' THEN fail_code='EMPLOYEE_OFF_WORK';
      ELSIF c ? 'attendance' AND (snap->>'is_moving')::boolean THEN fail_code='RETURN_REQUIRED'; END IF;
      IF fail_code IS NOT NULL THEN
        UPDATE public.assistant_reservations SET state=CASE WHEN fail_code='MISSED_WINDOW' THEN 'expired' ELSE 'failed' END,
          error_code=fail_code,result=jsonb_build_object('applied',false) WHERE id=r.id;
        PERFORM private.assistant_event(r.id,'not_started',jsonb_build_object('code',fail_code));
        CONTINUE;
      END IF;
      -- A delayed restore must finish before an adjacent reservation may start.
      IF EXISTS(SELECT 1 FROM public.assistant_reservations active WHERE active.employee_id=e.id
        AND active.id<>r.id AND active.state='running') THEN
        UPDATE public.assistant_reservations SET next_attempt_at=p_now+interval '1 minute',
          error_code='WAITING_FOR_PREVIOUS_RESTORE' WHERE id=r.id;
        IF r.error_code IS DISTINCT FROM 'WAITING_FOR_PREVIOUS_RESTORE' THEN
          PERFORM private.assistant_event(r.id,'waiting_for_previous_restore');
        END IF;
        CONTINUE;
      END IF;
      UPDATE public.assistant_reservations SET start_attempts=start_attempts+1 WHERE id=r.id RETURNING * INTO r;
      BEGIN
        PERFORM private.assistant_validate(r.proposal,r.starts_at-interval '1 microsecond');
        INSERT INTO private.assistant_write_context VALUES(pg_backend_pid(),txid_current());
        PERFORM private.assistant_apply_changes(e.id,c);
        DELETE FROM private.assistant_write_context WHERE backend_pid=pg_backend_pid() AND transaction_id=txid_current();
        UPDATE public.assistant_reservations SET state='running',before_state=snap,
          applied_state=private.assistant_snapshot(e.id),next_attempt_at=ends_at,error_code=NULL,
          result=jsonb_build_object('applied',true) WHERE id=r.id;
        PERFORM private.assistant_event(r.id,'started');
      EXCEPTION WHEN OTHERS THEN
        fail_code='START_DB_'||SQLSTATE;
        UPDATE public.assistant_reservations SET state=CASE WHEN r.start_attempts>=3 THEN 'failed' ELSE 'queued' END,
          next_attempt_at=p_now+make_interval(secs=>60*power(2,r.start_attempts-1)::integer),error_code=fail_code
          WHERE id=r.id;
        PERFORM private.assistant_event(r.id,CASE WHEN r.start_attempts>=3 THEN 'failed' ELSE 'start_retry' END,
          jsonb_build_object('code',fail_code));
      END;
    ELSE
      UPDATE public.assistant_reservations SET end_attempts=end_attempts+1 WHERE id=r.id RETURNING * INTO r;
      BEGIN
        IF r.user_id IS DISTINCT FROM e.user_id THEN
          outcome=jsonb_build_object('restored','[]'::jsonb,'skipped',jsonb_build_array('identity'));
        ELSIF r.proposal->>'restore'='keep' THEN
          outcome=jsonb_build_object('restored','[]'::jsonb,'skipped','[]'::jsonb,'mode','keep');
        ELSE
          INSERT INTO private.assistant_write_context VALUES(pg_backend_pid(),txid_current());
          outcome=private.assistant_restore(e.id,c,r.before_state,r.applied_state);
          DELETE FROM private.assistant_write_context WHERE backend_pid=pg_backend_pid() AND transaction_id=txid_current();
        END IF;
        has_conflict=jsonb_array_length(outcome->'skipped')>0;
        UPDATE public.assistant_reservations SET state=CASE WHEN has_conflict THEN 'completed_conflict'
          WHEN cancel_requested THEN 'cancelled' ELSE 'completed' END,
          result=outcome,error_code=CASE WHEN has_conflict THEN 'RESTORE_SKIPPED' ELSE NULL END WHERE id=r.id;
        PERFORM private.assistant_event(r.id,'finished',outcome);
      EXCEPTION WHEN OTHERS THEN
        fail_code='RESTORE_DB_'||SQLSTATE;
        UPDATE public.assistant_reservations SET state=CASE WHEN r.end_attempts>=3 THEN 'failed' ELSE 'running' END,
          next_attempt_at=p_now+make_interval(secs=>60*power(2,r.end_attempts-1)::integer),error_code=fail_code
          WHERE id=r.id;
        PERFORM private.assistant_event(r.id,CASE WHEN r.end_attempts>=3 THEN 'failed' ELSE 'restore_retry' END,
          jsonb_build_object('code',fail_code));
      END;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('processed',processed,'at',p_now);
END;
$$;

ALTER TABLE public.employee_notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistant_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistant_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistant_reservation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.assistant_write_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.assistant_confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.assistant_rate_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY assistant_preference_owner ON public.employee_notification_preferences FOR SELECT TO authenticated
  USING(employee_id=(SELECT private.my_employee_id()));
CREATE POLICY assistant_draft_owner ON public.assistant_drafts FOR SELECT TO authenticated
  USING(user_id=(SELECT auth.uid()) AND company_id=(SELECT private.my_company_id()) AND employee_id=(SELECT private.my_employee_id()));
CREATE POLICY assistant_reservation_owner ON public.assistant_reservations FOR SELECT TO authenticated
  USING(user_id=(SELECT auth.uid()) AND company_id=(SELECT private.my_company_id()) AND employee_id=(SELECT private.my_employee_id()));
CREATE POLICY assistant_event_owner ON public.assistant_reservation_events FOR SELECT TO authenticated
  USING(user_id=(SELECT auth.uid()) AND company_id=(SELECT private.my_company_id()) AND employee_id=(SELECT private.my_employee_id()));
REVOKE ALL ON public.employee_notification_preferences,public.assistant_drafts,public.assistant_reservations,
  public.assistant_reservation_events,private.assistant_write_context,private.assistant_confirmations,
  private.assistant_rate_limits FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.employee_notification_preferences,public.assistant_drafts,
  public.assistant_reservations,public.assistant_reservation_events TO authenticated;

DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT p.oid::regprocedure AS signature,p.proname,n.nspname
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname IN ('private','public') AND p.proname LIKE 'assistant_%' LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',f.signature);
    IF f.nspname='public' THEN
      IF f.proname='assistant_finish_draft' THEN
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.signature);
      ELSE EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.signature); END IF;
    END IF;
  END LOOP;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
```

## Cron 등록 — 009 적용 뒤 별도 실행

사용자가 Dashboard → Integrations → Cron에서 pg_cron을 활성화한 다음 실행한다. 초 단위 정시성을 보장하는 작업이 아니며 1분 주기로 만료·시작·종료 작업을 처리한다. DB 내부 함수 호출이므로 외부 Cron용 HTTP 엔드포인트나 브라우저용 실행 권한은 없다.

```sql
DO $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
    RAISE EXCEPTION 'ENABLE_PG_CRON_FIRST';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM cron.job WHERE jobname='sensory-assistant-tick') THEN
    PERFORM cron.schedule('sensory-assistant-tick','* * * * *','SELECT private.assistant_tick();');
  END IF;
END;
$$;

SELECT jobid,jobname,schedule,active FROM cron.job WHERE jobname='sensory-assistant-tick';
```

Cron이 생성되는 역할은 postgres여야 한다. 역할 확인은 `SELECT current_user;`로 할 수 있다. pg_cron 자체 활성화와 실제 운영 작업 실행은 사용자가 적용 후 확인한다.
