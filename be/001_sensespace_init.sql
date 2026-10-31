-- SenseSpace P1: NEW Supabase project only. Run once as postgres in SQL Editor.
-- Auth and Storage must already exist. No DROP/DELETE of existing application data.
-- Do not combine with the old patch SQL. private must NOT be an exposed API schema.
BEGIN;
DO $$
DECLARE n text;
BEGIN
  FOREACH n IN ARRAY ARRAY['companies','floors','seats','employees',
    'sensory_profiles','employee_statuses','current_sensations'] LOOP
    IF to_regclass('public.' || n) IS NOT NULL THEN
      RAISE EXCEPTION 'Existing application table %. Use a migration instead.', n;
    END IF;
  END LOOP;
END $$;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace
    WHERE e.extname='pgcrypto' AND n.nspname='extensions') THEN
    RAISE EXCEPTION 'pgcrypto must be installed in extensions schema';
  END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA public, private TO authenticated;

CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 100),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.floors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  floor_number integer NOT NULL,
  map_path text NOT NULL,
  map_width integer NOT NULL CHECK (map_width > 0),
  map_height integer NOT NULL CHECK (map_height > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, floor_number), UNIQUE(company_id, id),
  CHECK (map_path LIKE company_id::text || '/' || id::text || '/%'
    AND map_path NOT LIKE '%..%')
);
CREATE TABLE public.seats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  floor_id uuid NOT NULL,
  label text NOT NULL CHECK (length(btrim(label)) BETWEEN 1 AND 50),
  x_ratio numeric NOT NULL CHECK (x_ratio BETWEEN 0 AND 1),
  y_ratio numeric NOT NULL CHECK (y_ratio BETWEEN 0 AND 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(company_id, floor_id) REFERENCES public.floors(company_id, id),
  UNIQUE(floor_id, label), UNIQUE(company_id, id)
);
CREATE INDEX seats_company_floor_idx ON public.seats(company_id, floor_id);
CREATE TABLE public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  seat_id uuid UNIQUE,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 100),
  job_title text NOT NULL DEFAULT '' CHECK (length(job_title) <= 100),
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('member','admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(company_id, seat_id) REFERENCES public.seats(company_id, id)
);
CREATE INDEX employees_company_id_idx ON public.employees(company_id, id);
CREATE TABLE public.sensory_profiles (
  employee_id uuid PRIMARY KEY REFERENCES public.employees(id) ON DELETE CASCADE,
  visual_sensitivity smallint CHECK (visual_sensitivity BETWEEN 1 AND 5),
  auditory_sensitivity smallint CHECK (auditory_sensitivity BETWEEN 1 AND 5),
  olfactory_sensitivity smallint CHECK (olfactory_sensitivity BETWEEN 1 AND 5),
  description text NOT NULL DEFAULT '' CHECK (length(description) <= 1000),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.employee_statuses (
  employee_id uuid PRIMARY KEY REFERENCES public.employees(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'off_work' CHECK (status IN ('working','away','off_work')),
  away_reason text,
  status_message text NOT NULL DEFAULT '' CHECK (length(status_message) <= 200),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status='away' AND away_reason IS NOT NULL AND away_reason IN ('lunch','meeting','outside'))
    OR (status<>'away' AND away_reason IS NULL)),
  CHECK (status<>'off_work' OR status_message='')
);
CREATE TABLE public.current_sensations (
  employee_id uuid PRIMARY KEY REFERENCES public.employees(id) ON DELETE CASCADE,
  temperature_level smallint CHECK (temperature_level BETWEEN 1 AND 5),
  humidity_level smallint CHECK (humidity_level BETWEEN 1 AND 5),
  noise_level smallint CHECK (noise_level BETWEEN 1 AND 5),
  odor_level smallint CHECK (odor_level BETWEEN 1 AND 5),
  discomfort_level smallint CHECK (discomfort_level BETWEEN 1 AND 5),
  crowd_level smallint CHECK (crowd_level BETWEEN 1 AND 5),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE private.company_join_codes (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id),
  code_hash text NOT NULL UNIQUE CHECK (code_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE private.join_rate_limits (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  window_started_at timestamptz NOT NULL,
  attempts integer NOT NULL CHECK (attempts > 0)
);

-- Fixed, non-exposed SECURITY DEFINER helpers prevent recursive membership RLS.
CREATE FUNCTION private.my_company_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT company_id FROM public.employees WHERE user_id=(SELECT auth.uid());
$$;
CREATE FUNCTION private.my_employee_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT id FROM public.employees WHERE user_id=(SELECT auth.uid());
$$;
CREATE FUNCTION private.touch_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN NEW.updated_at=clock_timestamp(); RETURN NEW; END;
$$;
CREATE TRIGGER employees_touch BEFORE UPDATE ON public.employees
FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at();
CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.sensory_profiles
FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at();
CREATE TRIGGER statuses_touch BEFORE UPDATE ON public.employee_statuses
FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at();
CREATE TRIGGER sensations_touch BEFORE UPDATE ON public.current_sensations
FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at();
CREATE FUNCTION private.initialize_employee() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  INSERT INTO public.sensory_profiles(employee_id) VALUES(NEW.id);
  INSERT INTO public.employee_statuses(employee_id) VALUES(NEW.id);
  INSERT INTO public.current_sensations(employee_id) VALUES(NEW.id);
  RETURN NEW;
END;
$$;
CREATE TRIGGER initialize_employee AFTER INSERT ON public.employees
FOR EACH ROW EXECUTE FUNCTION private.initialize_employee();

-- This helper is NOT executable by API roles. Called by trusted mutation functions.
CREATE FUNCTION private.lock_my_status(p_employee_id uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_status text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'LOGIN_REQUIRED'; END IF;
  SELECT s.status INTO v_status FROM public.employee_statuses s
  JOIN public.employees e ON e.id=s.employee_id
  WHERE e.id=p_employee_id AND e.user_id=auth.uid() FOR UPDATE OF s;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_YOUR_EMPLOYEE'; END IF;
  RETURN v_status;
END;
$$;

-- Business errors are returned as data so failed-code attempt counters COMMIT.
CREATE FUNCTION private.register_company_member(p_code text, p_name text, p_job_title text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_company uuid; v_existing public.employees; v_attempts integer;
  v_window timestamptz; v_employee uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'LOGIN_REQUIRED'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));
  INSERT INTO private.join_rate_limits AS r(user_id,window_started_at,attempts)
  VALUES(auth.uid(),clock_timestamp(),1)
  ON CONFLICT(user_id) DO UPDATE SET
    attempts=CASE WHEN r.window_started_at <= clock_timestamp()-interval '1 minute'
      THEN 1 ELSE r.attempts+1 END,
    window_started_at=CASE WHEN r.window_started_at <= clock_timestamp()-interval '1 minute'
      THEN clock_timestamp() ELSE r.window_started_at END
  RETURNING attempts,window_started_at INTO v_attempts,v_window;
  IF v_attempts>5 THEN RETURN jsonb_build_object('employee_id',NULL,
    'error_code','RATE_LIMITED','retry_after_seconds',
    greatest(1,ceil(extract(epoch FROM v_window+interval '1 minute'-clock_timestamp()))::integer)); END IF;
  IF p_name IS NULL OR length(btrim(p_name)) NOT BETWEEN 1 AND 100 THEN
    RETURN jsonb_build_object('employee_id',NULL,'error_code','INVALID_NAME'); END IF;
  IF p_job_title IS NULL OR length(p_job_title)>100 THEN
    RETURN jsonb_build_object('employee_id',NULL,'error_code','INVALID_JOB_TITLE'); END IF;
  IF p_code IS NULL OR upper(btrim(p_code)) !~ '^[0-9A-F]{24}$' THEN
    RETURN jsonb_build_object('employee_id',NULL,'error_code','INVALID_COMPANY_CODE'); END IF;
  SELECT company_id INTO v_company FROM private.company_join_codes
  WHERE code_hash=encode(extensions.digest(upper(btrim(p_code)),'sha256'),'hex')
    AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at>clock_timestamp())
  FOR SHARE;
  IF NOT FOUND THEN RETURN jsonb_build_object('employee_id',NULL,'error_code','INVALID_COMPANY_CODE'); END IF;
  SELECT * INTO v_existing FROM public.employees WHERE user_id=auth.uid();
  IF FOUND THEN
    IF v_existing.company_id<>v_company THEN
      RETURN jsonb_build_object('employee_id',NULL,'error_code','ALREADY_JOINED_COMPANY');
    END IF;
    RETURN jsonb_build_object('employee_id',v_existing.id,'error_code',NULL);
  END IF;
  INSERT INTO public.employees(user_id,company_id,name,job_title)
  VALUES(auth.uid(),v_company,btrim(p_name),p_job_title) RETURNING id INTO v_employee;
  RETURN jsonb_build_object('employee_id',v_employee,'error_code',NULL);
END;
$$;
CREATE FUNCTION private.choose_seat(p_employee_id uuid,p_seat_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_company uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'LOGIN_REQUIRED'; END IF;
  SELECT company_id INTO v_company FROM public.employees
  WHERE id=p_employee_id AND user_id=auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_YOUR_EMPLOYEE'; END IF;
  IF p_seat_id IS NOT NULL THEN
    PERFORM 1 FROM public.seats WHERE id=p_seat_id AND company_id=v_company FOR KEY SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_SEAT'; END IF;
  END IF;
  BEGIN
    UPDATE public.employees SET seat_id=p_seat_id WHERE id=p_employee_id;
  EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'SEAT_TAKEN';
  END;
END;
$$;
CREATE FUNCTION private.set_status(p_employee_id uuid,p_status text,p_away_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_old text; v_result jsonb;
BEGIN
  v_old=private.lock_my_status(p_employee_id);
  IF p_status IS NULL OR p_status NOT IN ('working','away','off_work') THEN
    RAISE EXCEPTION 'INVALID_STATUS'; END IF;
  IF (p_status='away' AND (p_away_reason IS NULL OR p_away_reason NOT IN ('lunch','meeting','outside')))
    OR (p_status<>'away' AND p_away_reason IS NOT NULL) THEN
    RAISE EXCEPTION 'INVALID_AWAY_REASON'; END IF;
  IF v_old='off_work' AND p_status='away' THEN RAISE EXCEPTION 'INVALID_STATUS_TRANSITION'; END IF;
  UPDATE public.employee_statuses SET status=p_status,away_reason=p_away_reason,
    status_message=CASE WHEN p_status='off_work' THEN '' ELSE status_message END
  WHERE employee_id=p_employee_id;
  IF p_status='off_work' THEN
    UPDATE public.current_sensations SET temperature_level=NULL,humidity_level=NULL,
      noise_level=NULL,odor_level=NULL,discomfort_level=NULL,crowd_level=NULL
    WHERE employee_id=p_employee_id;
  END IF;
  SELECT jsonb_build_object('status',to_jsonb(s),'sensations',to_jsonb(c)) INTO v_result
  FROM public.employee_statuses s JOIN public.current_sensations c USING(employee_id)
  WHERE s.employee_id=p_employee_id;
  RETURN v_result;
END;
$$;
CREATE FUNCTION private.set_message(p_employee_id uuid,p_status_message text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_status text; v_result jsonb;
BEGIN
  v_status=private.lock_my_status(p_employee_id);
  IF v_status NOT IN ('working','away') THEN RAISE EXCEPTION 'EMPLOYEE_NOT_WORKING'; END IF;
  IF p_status_message IS NULL OR length(p_status_message)>200 THEN
    RAISE EXCEPTION 'INVALID_STATUS_MESSAGE'; END IF;
  UPDATE public.employee_statuses SET status_message=p_status_message
  WHERE employee_id=p_employee_id RETURNING to_jsonb(employee_statuses) INTO v_result;
  RETURN v_result;
END;
$$;
CREATE FUNCTION private.set_sensations(p_employee_id uuid,p_patch jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_status text; k text; v jsonb; v_result jsonb;
BEGIN
  v_status=private.lock_my_status(p_employee_id);
  IF v_status NOT IN ('working','away') THEN RAISE EXCEPTION 'EMPLOYEE_NOT_WORKING'; END IF;
  IF p_patch IS NULL OR jsonb_typeof(p_patch)<>'object' OR p_patch='{}'::jsonb THEN
    RAISE EXCEPTION 'INVALID_SENSATIONS'; END IF;
  FOR k,v IN SELECT key,value FROM jsonb_each(p_patch) LOOP
    IF k NOT IN ('temperature_level','humidity_level','noise_level','odor_level','discomfort_level','crowd_level') THEN
      RAISE EXCEPTION 'INVALID_SENSATIONS'; END IF;
    IF v<>'null'::jsonb THEN
      IF jsonb_typeof(v)<>'number' THEN RAISE EXCEPTION 'INVALID_SENSATIONS'; END IF;
      IF (v::text)::numeric NOT BETWEEN 1 AND 5 OR (v::text)::numeric<>trunc((v::text)::numeric) THEN
        RAISE EXCEPTION 'INVALID_SENSATIONS'; END IF;
    END IF;
  END LOOP;
  UPDATE public.current_sensations SET
    temperature_level=CASE WHEN p_patch ? 'temperature_level' THEN (p_patch->>'temperature_level')::numeric::smallint ELSE temperature_level END,
    humidity_level=CASE WHEN p_patch ? 'humidity_level' THEN (p_patch->>'humidity_level')::numeric::smallint ELSE humidity_level END,
    noise_level=CASE WHEN p_patch ? 'noise_level' THEN (p_patch->>'noise_level')::numeric::smallint ELSE noise_level END,
    odor_level=CASE WHEN p_patch ? 'odor_level' THEN (p_patch->>'odor_level')::numeric::smallint ELSE odor_level END,
    discomfort_level=CASE WHEN p_patch ? 'discomfort_level' THEN (p_patch->>'discomfort_level')::numeric::smallint ELSE discomfort_level END,
    crowd_level=CASE WHEN p_patch ? 'crowd_level' THEN (p_patch->>'crowd_level')::numeric::smallint ELSE crowd_level END
  WHERE employee_id=p_employee_id RETURNING to_jsonb(current_sensations) INTO v_result;
  RETURN v_result;
END;
$$;

-- Exposed wrappers run as caller. Only internal functions elevate privileges.
CREATE FUNCTION public.join_company(p_code text,p_name text,p_job_title text DEFAULT '')
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
  SELECT private.register_company_member(p_code,p_name,p_job_title);
$$;
CREATE FUNCTION public.choose_seat(p_employee_id uuid,p_seat_id uuid)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
  SELECT private.choose_seat(p_employee_id,p_seat_id);
$$;
CREATE FUNCTION public.set_employee_status(p_employee_id uuid,p_status text,p_away_reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
  SELECT private.set_status(p_employee_id,p_status,p_away_reason);
$$;
CREATE FUNCTION public.set_status_message(p_employee_id uuid,p_status_message text)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
  SELECT private.set_message(p_employee_id,p_status_message);
$$;
CREATE FUNCTION public.set_current_sensations(p_employee_id uuid,p_patch jsonb)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
  SELECT private.set_sensations(p_employee_id,p_patch);
$$;
CREATE FUNCTION public.get_sensory_cards(p_company_id uuid,p_employee_id uuid DEFAULT NULL,
  p_after uuid DEFAULT NULL,p_limit integer DEFAULT 50)
RETURNS SETOF jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT jsonb_build_object('employee_id',e.id,'company_id',e.company_id,'name',e.name,'job_title',e.job_title,
    'seat',CASE WHEN s.id IS NULL THEN NULL ELSE jsonb_build_object('id',s.id,'label',s.label,
      'floor_id',f.id,'floor_number',f.floor_number,'x_ratio',s.x_ratio,'y_ratio',s.y_ratio) END,
    'profile',to_jsonb(p)-'employee_id','status',to_jsonb(st)-'employee_id',
    'sensations',to_jsonb(c)-'employee_id')
  FROM public.employees e
  LEFT JOIN public.seats s ON s.id=e.seat_id AND s.company_id=e.company_id
  LEFT JOIN public.floors f ON f.id=s.floor_id AND f.company_id=e.company_id
  LEFT JOIN public.sensory_profiles p ON p.employee_id=e.id
  LEFT JOIN public.employee_statuses st ON st.employee_id=e.id
  LEFT JOIN public.current_sensations c ON c.employee_id=e.id
  WHERE e.company_id=p_company_id AND (p_employee_id IS NULL OR e.id=p_employee_id)
    AND (p_after IS NULL OR e.id>p_after)
  ORDER BY e.id LIMIT greatest(1,least(coalesce(p_limit,50),200));
$$;

-- Row policies + column grants: no direct state/sensation/seat/membership writes.
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.floors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sensory_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.current_sensations ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.company_join_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.join_rate_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY company_read ON public.companies FOR SELECT TO authenticated
USING(id=(SELECT private.my_company_id()));
CREATE POLICY floor_read ON public.floors FOR SELECT TO authenticated
USING(company_id=(SELECT private.my_company_id()));
CREATE POLICY seat_read ON public.seats FOR SELECT TO authenticated
USING(company_id=(SELECT private.my_company_id()));
CREATE POLICY employee_read ON public.employees FOR SELECT TO authenticated
USING(company_id=(SELECT private.my_company_id()));
CREATE POLICY employee_update_self ON public.employees FOR UPDATE TO authenticated
USING(user_id=(SELECT auth.uid())) WITH CHECK(user_id=(SELECT auth.uid()));
CREATE POLICY profile_read ON public.sensory_profiles FOR SELECT TO authenticated
USING(EXISTS(SELECT 1 FROM public.employees e WHERE e.id=employee_id));
CREATE POLICY profile_update_self ON public.sensory_profiles FOR UPDATE TO authenticated
USING(employee_id=(SELECT private.my_employee_id()))
WITH CHECK(employee_id=(SELECT private.my_employee_id()));
CREATE POLICY status_read ON public.employee_statuses FOR SELECT TO authenticated
USING(EXISTS(SELECT 1 FROM public.employees e WHERE e.id=employee_id));
CREATE POLICY sensation_read ON public.current_sensations FOR SELECT TO authenticated
USING(EXISTS(SELECT 1 FROM public.employees e WHERE e.id=employee_id));
REVOKE ALL ON public.companies,public.floors,public.seats,public.employees,
  public.sensory_profiles,public.employee_statuses,public.current_sensations,
  private.company_join_codes,private.join_rate_limits FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.companies,public.floors,public.seats,
  public.sensory_profiles,public.employee_statuses,public.current_sensations TO authenticated;
-- user_id/role are not exposed by the general employees SELECT API.
GRANT SELECT(id,company_id,seat_id,name,job_title,created_at,updated_at)
  ON public.employees TO authenticated;
GRANT UPDATE(name,job_title) ON public.employees TO authenticated;
GRANT UPDATE(visual_sensitivity,auditory_sensitivity,olfactory_sensitivity,description)
  ON public.sensory_profiles TO authenticated;
-- Bootstrap lookup avoids SELECT(user_id) exposure to colleagues.
CREATE FUNCTION public.get_my_membership() RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT to_jsonb(x) FROM (SELECT e.id AS employee_id,e.company_id,c.name AS company_name,
    e.name,e.job_title,e.seat_id FROM public.employees e JOIN public.companies c ON c.id=e.company_id
    WHERE e.id=(SELECT private.my_employee_id())) x;
$$;

-- Revoke default function grants only for this installation's own functions.
DO $$
DECLARE f record;
BEGIN
  FOR f IN SELECT p.oid::regprocedure AS signature,p.proname,n.nspname
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE (n.nspname='public' AND p.proname IN ('join_company','choose_seat',
      'set_employee_status','set_status_message','set_current_sensations','get_sensory_cards','get_my_membership'))
    OR (n.nspname='private' AND p.proname IN ('my_company_id','my_employee_id','touch_updated_at',
      'initialize_employee','lock_my_status','register_company_member','choose_seat','set_status','set_message','set_sensations'))
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',f.signature);
    IF f.proname NOT IN ('touch_updated_at','initialize_employee','lock_my_status') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.signature);
    END IF;
  END LOOP;
END $$;

-- New private map bucket. Existing bucket/configuration requires separate review.
INSERT INTO storage.buckets(id,name,public) VALUES('office-maps','office-maps',false);
CREATE POLICY office_maps_company_read ON storage.objects FOR SELECT TO authenticated
USING(bucket_id='office-maps' AND (storage.foldername(name))[1]=(SELECT private.my_company_id())::text);
-- No public Postgres Changes registration. P1 uses 5-second active-tab polling.
NOTIFY pgrst, 'reload schema';
COMMIT;
