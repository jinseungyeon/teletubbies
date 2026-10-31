-- Apply ONCE after 001 + 004 + 005, as postgres in Supabase SQL Editor.
-- Keeps companies, floors, maps, assigned seats and avatar catalogues unchanged.
-- Temporary movement / return + optional custom away reason only.
BEGIN;
INSERT INTO private.sensespace_migrations(version) VALUES('006_seat_movement');

ALTER TABLE public.employees
  ADD COLUMN temporary_seat_id uuid,
  ADD CONSTRAINT employees_company_employee_key UNIQUE(company_id,id),
  ADD CONSTRAINT employees_temporary_seat_fk
    FOREIGN KEY(company_id,temporary_seat_id) REFERENCES public.seats(company_id,id),
  ADD CONSTRAINT employees_temporary_seat_check CHECK (
    temporary_seat_id IS NULL OR (seat_id IS NOT NULL AND temporary_seat_id<>seat_id));
CREATE UNIQUE INDEX employees_temporary_seat_idx ON public.employees(temporary_seat_id)
  WHERE temporary_seat_id IS NOT NULL;

-- A single unique key covers BOTH permanent assignments and temporary occupancy.
-- Separate UNIQUE indexes on the two employee columns alone cannot do this.
CREATE TABLE private.seat_claims (
  seat_id uuid PRIMARY KEY,
  company_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  kind text NOT NULL CHECK(kind IN ('assigned','temporary')),
  UNIQUE(employee_id,kind),
  FOREIGN KEY(company_id,seat_id) REFERENCES public.seats(company_id,id),
  FOREIGN KEY(company_id,employee_id) REFERENCES public.employees(company_id,id) ON DELETE CASCADE
);
ALTER TABLE private.seat_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.seat_claims FROM PUBLIC,anon,authenticated,service_role;
INSERT INTO private.seat_claims(seat_id,company_id,employee_id,kind)
SELECT seat_id,company_id,id,'assigned' FROM public.employees WHERE seat_id IS NOT NULL;

CREATE FUNCTION private.sync_seat_claims() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  DELETE FROM private.seat_claims WHERE employee_id=NEW.id;
  IF NEW.seat_id IS NOT NULL THEN
    INSERT INTO private.seat_claims VALUES(NEW.seat_id,NEW.company_id,NEW.id,'assigned');
  END IF;
  IF NEW.temporary_seat_id IS NOT NULL THEN
    INSERT INTO private.seat_claims VALUES(NEW.temporary_seat_id,NEW.company_id,NEW.id,'temporary');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER employees_seat_claims AFTER INSERT OR UPDATE OF seat_id,temporary_seat_id,company_id
ON public.employees FOR EACH ROW EXECUTE FUNCTION private.sync_seat_claims();

ALTER TABLE public.employee_statuses
  DROP CONSTRAINT employee_statuses_check,
  ADD COLUMN away_reason_text text,
  ADD CONSTRAINT employee_statuses_away_reason_text_check CHECK (
    away_reason_text IS NULL OR
    (away_reason_text=btrim(away_reason_text) AND length(away_reason_text) BETWEEN 1 AND 20)),
  ADD CONSTRAINT employee_statuses_away_reason_exclusive CHECK (
    away_reason IS NULL OR away_reason_text IS NULL),
  ADD CONSTRAINT employee_statuses_away_reason_check CHECK (
    (status='away' AND (away_reason IS NULL OR away_reason IN ('lunch','meeting','outside')))
    OR (status<>'away' AND away_reason IS NULL AND away_reason_text IS NULL));

-- All seat/state transitions lock company -> status -> employee.
-- Other existing message/emoji/sensation writers only take the status lock.
CREATE FUNCTION private.lock_employee_location(p_employee_id uuid) RETURNS public.employees
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_company uuid; v_employee public.employees;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'LOGIN_REQUIRED'; END IF;
  SELECT company_id INTO v_company FROM public.employees
    WHERE id=p_employee_id AND user_id=auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_YOUR_EMPLOYEE'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('sensespace:seats:'||v_company::text,0));
  PERFORM private.lock_my_status(p_employee_id);
  SELECT * INTO v_employee FROM public.employees
    WHERE id=p_employee_id AND user_id=auth.uid() AND company_id=v_company FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_YOUR_EMPLOYEE'; END IF;
  RETURN v_employee;
END;
$$;
CREATE FUNCTION private.clear_current_sensations(p_employee_id uuid) RETURNS void
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
  UPDATE public.current_sensations SET temperature_level=NULL,humidity_level=NULL,
    noise_level=NULL,odor_level=NULL,discomfort_level=NULL,crowd_level=NULL
  WHERE employee_id=p_employee_id;
$$;

CREATE FUNCTION public.get_employee_location(p_employee_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT jsonb_build_object('employee_id',e.id,'status',st.status,
    'assigned_seat',a.seat,'temporary_seat',t.seat,
    'current_seat',CASE WHEN st.status='off_work' THEN NULL
      WHEN e.temporary_seat_id IS NOT NULL THEN t.seat ELSE a.seat END,
    'is_moving',e.temporary_seat_id IS NOT NULL)
  FROM public.employees e JOIN public.employee_statuses st ON st.employee_id=e.id
  LEFT JOIN LATERAL (SELECT jsonb_build_object('id',s.id,'label',s.label,
    'floor_id',f.id,'floor_number',f.floor_number,'x_ratio',s.x_ratio,'y_ratio',s.y_ratio) AS seat
    FROM public.seats s JOIN public.floors f ON f.id=s.floor_id AND f.company_id=s.company_id
    WHERE s.id=e.seat_id AND s.company_id=e.company_id) a ON true
  LEFT JOIN LATERAL (SELECT jsonb_build_object('id',s.id,'label',s.label,
    'floor_id',f.id,'floor_number',f.floor_number,'x_ratio',s.x_ratio,'y_ratio',s.y_ratio) AS seat
    FROM public.seats s JOIN public.floors f ON f.id=s.floor_id AND f.company_id=s.company_id
    WHERE s.id=e.temporary_seat_id AND s.company_id=e.company_id) t ON true
  WHERE e.id=p_employee_id;
$$;
CREATE FUNCTION private.employee_state(p_employee_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT jsonb_build_object('status',to_jsonb(st),'sensations',to_jsonb(c),
    'location',public.get_employee_location(p_employee_id))
  FROM public.employee_statuses st JOIN public.current_sensations c USING(employee_id)
  WHERE st.employee_id=p_employee_id;
$$;

CREATE FUNCTION private.move_employee(p_employee_id uuid,p_seat_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.employees; v_status text;
BEGIN
  e=private.lock_employee_location(p_employee_id);
  SELECT status INTO v_status FROM public.employee_statuses WHERE employee_id=e.id;
  IF v_status='off_work' THEN RAISE EXCEPTION 'EMPLOYEE_NOT_WORKING'; END IF;
  IF e.seat_id IS NULL THEN RAISE EXCEPTION 'ASSIGNED_SEAT_REQUIRED'; END IF;
  IF p_seat_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.seats
    WHERE id=p_seat_id AND company_id=e.company_id) THEN RAISE EXCEPTION 'INVALID_SEAT'; END IF;
  IF p_seat_id=e.seat_id THEN RAISE EXCEPTION 'USE_RETURN_TO_SEAT'; END IF;
  -- A retry to the current destination must not erase freshly entered sensations/reason.
  IF p_seat_id=e.temporary_seat_id THEN RETURN private.employee_state(e.id); END IF;
  BEGIN
    UPDATE public.employees SET temporary_seat_id=p_seat_id WHERE id=e.id;
  EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'SEAT_TAKEN'; END;
  UPDATE public.employee_statuses SET status='away',away_reason=NULL,away_reason_text=NULL
    WHERE employee_id=e.id;
  PERFORM private.clear_current_sensations(e.id);
  RETURN private.employee_state(e.id);
END;
$$;
CREATE FUNCTION public.move_to_seat(p_employee_id uuid,p_seat_id uuid) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
  SELECT private.move_employee(p_employee_id,p_seat_id);
$$;
CREATE FUNCTION private.return_employee(p_employee_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.employees; v_status text;
BEGIN
  e=private.lock_employee_location(p_employee_id);
  SELECT status INTO v_status FROM public.employee_statuses WHERE employee_id=e.id;
  IF v_status='off_work' THEN RAISE EXCEPTION 'EMPLOYEE_NOT_WORKING'; END IF;
  -- Already home: harmless retry; this does not cancel a manual away status.
  IF e.temporary_seat_id IS NULL THEN RETURN private.employee_state(e.id); END IF;
  UPDATE public.employees SET temporary_seat_id=NULL WHERE id=e.id;
  UPDATE public.employee_statuses SET status='working',away_reason=NULL,away_reason_text=NULL
    WHERE employee_id=e.id;
  PERFORM private.clear_current_sensations(e.id);
  RETURN private.employee_state(e.id);
END;
$$;
CREATE FUNCTION public.return_to_seat(p_employee_id uuid) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
  SELECT private.return_employee(p_employee_id);
$$;

-- Keep the existing signature: there is no ambiguous PostgREST overload.
CREATE OR REPLACE FUNCTION private.set_status(p_employee_id uuid,p_status text,p_away_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.employees; v_old text;
BEGIN
  e=private.lock_employee_location(p_employee_id);
  SELECT status INTO v_old FROM public.employee_statuses WHERE employee_id=e.id;
  IF p_status IS NULL OR p_status NOT IN ('working','away','off_work') THEN
    RAISE EXCEPTION 'INVALID_STATUS'; END IF;
  IF (p_away_reason IS NOT NULL AND p_away_reason NOT IN ('lunch','meeting','outside'))
    OR (p_status<>'away' AND p_away_reason IS NOT NULL) THEN
    RAISE EXCEPTION 'INVALID_AWAY_REASON'; END IF;
  IF v_old='off_work' AND p_status='away' THEN RAISE EXCEPTION 'INVALID_STATUS_TRANSITION'; END IF;
  -- Going working while temporarily away is the same atomic operation as return.
  IF p_status IN ('working','off_work') AND e.temporary_seat_id IS NOT NULL THEN
    UPDATE public.employees SET temporary_seat_id=NULL WHERE id=e.id;
  END IF;
  UPDATE public.employee_statuses SET status=p_status,away_reason=p_away_reason,
    away_reason_text=CASE WHEN p_status='away' AND v_old='away' AND p_away_reason IS NULL
      THEN away_reason_text ELSE NULL END,
    status_message=CASE WHEN p_status='off_work' THEN '' ELSE status_message END
    WHERE employee_id=e.id;
  IF p_status='off_work' OR (p_status='working' AND (v_old='off_work' OR e.temporary_seat_id IS NOT NULL)) THEN
    PERFORM private.clear_current_sensations(e.id);
  END IF;
  RETURN private.employee_state(e.id);
END;
$$;
CREATE OR REPLACE FUNCTION private.choose_seat(p_employee_id uuid,p_seat_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.employees;
BEGIN
  e=private.lock_employee_location(p_employee_id);
  IF e.seat_id IS NOT DISTINCT FROM p_seat_id THEN RETURN; END IF;
  IF e.temporary_seat_id IS NOT NULL THEN RAISE EXCEPTION 'RETURN_REQUIRED'; END IF;
  IF p_seat_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.seats
    WHERE id=p_seat_id AND company_id=e.company_id) THEN RAISE EXCEPTION 'INVALID_SEAT'; END IF;
  BEGIN
    UPDATE public.employees SET seat_id=p_seat_id WHERE id=e.id;
  EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'SEAT_TAKEN'; END;
  -- A changed home assignment is also a changed physical location.
  PERFORM private.clear_current_sensations(e.id);
END;
$$;

-- Preset and custom reasons are mutually exclusive. Empty custom input clears it.
CREATE FUNCTION private.set_away_text(p_employee_id uuid,p_reason_text text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_status text; v_text text;
BEGIN
  v_status=private.lock_my_status(p_employee_id);
  IF v_status<>'away' THEN RAISE EXCEPTION 'EMPLOYEE_NOT_AWAY'; END IF;
  v_text=nullif(btrim(p_reason_text),'');
  IF length(v_text)>20 THEN RAISE EXCEPTION 'INVALID_AWAY_REASON_TEXT'; END IF;
  UPDATE public.employee_statuses SET away_reason=NULL,away_reason_text=v_text
    WHERE employee_id=p_employee_id;
  RETURN private.employee_state(p_employee_id);
END;
$$;
CREATE FUNCTION public.set_away_reason_text(p_employee_id uuid,p_reason_text text) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
  SELECT private.set_away_text(p_employee_id,p_reason_text);
$$;

CREATE OR REPLACE FUNCTION public.get_sensory_cards(p_company_id uuid,p_employee_id uuid DEFAULT NULL,
  p_after uuid DEFAULT NULL,p_limit integer DEFAULT 50)
RETURNS SETOF jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT jsonb_build_object('employee_id',e.id,'company_id',e.company_id,'name',e.name,'job_title',e.job_title,
    'team',CASE WHEN t.id IS NULL THEN NULL ELSE jsonb_build_object('id',t.id,'name',t.name) END,
    'seat',CASE WHEN s.id IS NULL THEN NULL ELSE jsonb_build_object('id',s.id,'label',s.label,
      'floor_id',f.id,'floor_number',f.floor_number,'x_ratio',s.x_ratio,'y_ratio',s.y_ratio) END,
    'location',public.get_employee_location(e.id),
    'profile',to_jsonb(p)-'employee_id',
    'status',(to_jsonb(st)-'employee_id')||jsonb_build_object('quick_emoji',
      CASE WHEN q.id IS NULL THEN NULL ELSE jsonb_build_object('id',q.id,'emoji',q.emoji) END),
    'sensations',to_jsonb(c)-'employee_id', 'avatar',(to_jsonb(a)-'employee_id')||
      jsonb_build_object('character',CASE WHEN a.is_complete THEN private.avatar_character(a.selections) ELSE NULL END))
  FROM public.employees e
  LEFT JOIN public.teams t ON t.id=e.team_id AND t.company_id=e.company_id
  LEFT JOIN public.seats s ON s.id=e.seat_id AND s.company_id=e.company_id
  LEFT JOIN public.floors f ON f.id=s.floor_id AND f.company_id=e.company_id
  LEFT JOIN public.sensory_profiles p ON p.employee_id=e.id
  LEFT JOIN public.employee_statuses st ON st.employee_id=e.id
  LEFT JOIN public.quick_emojis q ON q.id=st.quick_emoji_id
  LEFT JOIN public.current_sensations c ON c.employee_id=e.id
  LEFT JOIN public.employee_avatars a ON a.employee_id=e.id
  WHERE e.company_id=p_company_id AND (p_employee_id IS NULL OR e.id=p_employee_id)
    AND (p_after IS NULL OR e.id>p_after)
  ORDER BY e.id LIMIT greatest(1,least(coalesce(p_limit,50),200));
$$;
CREATE OR REPLACE FUNCTION public.get_employee_work_info(p_employee_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT jsonb_build_object('employee_id',c->'employee_id','name',c->'name','job_title',c->'job_title',
    'team',c->'team','seat',c->'seat','location',c->'location','profile',c->'profile',
    'status',jsonb_build_object('status',c->'status'->'status','away_reason',c->'status'->'away_reason',
      'away_reason_text',c->'status'->'away_reason_text','updated_at',c->'status'->'updated_at'))
  FROM public.get_sensory_cards(private.my_company_id(),p_employee_id,NULL,1) c
  WHERE p_employee_id IS NOT NULL;
$$;
CREATE OR REPLACE FUNCTION public.get_my_membership() RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT jsonb_build_object('employee_id',e.id,'company_id',e.company_id,'company_name',c.name,
    'name',e.name,'job_title',e.job_title,'seat_id',e.seat_id,
    'location',public.get_employee_location(e.id),
    'team',CASE WHEN t.id IS NULL THEN NULL ELSE jsonb_build_object('id',t.id,'name',t.name) END,
    'avatar',(to_jsonb(a)-'employee_id')||jsonb_build_object('character',
      CASE WHEN a.is_complete THEN private.avatar_character(a.selections) ELSE NULL END))
  FROM public.employees e JOIN public.companies c ON c.id=e.company_id
  LEFT JOIN public.teams t ON t.id=e.team_id AND t.company_id=e.company_id
  LEFT JOIN public.employee_avatars a ON a.employee_id=e.id
  WHERE e.id=(SELECT private.my_employee_id());
$$;

GRANT SELECT(temporary_seat_id) ON public.employees TO authenticated;
DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT p.oid::regprocedure AS signature,p.proname,n.nspname
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE (n.nspname='private' AND p.proname IN ('sync_seat_claims','lock_employee_location',
      'clear_current_sensations','employee_state','move_employee','return_employee','set_status','choose_seat','set_away_text'))
      OR (n.nspname='public' AND p.proname IN ('move_to_seat','return_to_seat','get_employee_location','set_away_reason_text')) LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',f.signature);
    IF f.nspname='public' OR f.proname IN ('move_employee','return_employee','set_status','choose_seat','set_away_text') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.signature);
    END IF;
  END LOOP;
END $$;
NOTIFY pgrst, 'reload schema';
COMMIT;
