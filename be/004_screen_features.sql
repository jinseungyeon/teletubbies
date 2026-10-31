-- Apply ONCE after 001, as postgres. Does not recreate companies/maps/seats.
-- AI image generation is explicitly deferred. Register the real avatar item IDs separately.
-- Existing messages longer than 20 characters cause a full rollback, never truncation.
BEGIN;
CREATE TABLE IF NOT EXISTS private.sensespace_migrations (
  version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON private.sensespace_migrations FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE private.sensespace_migrations ENABLE ROW LEVEL SECURITY;
INSERT INTO private.sensespace_migrations(version) VALUES('004_screen_features');
LOCK TABLE public.employee_statuses IN SHARE ROW EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM public.employee_statuses WHERE length(status_message)>20) THEN
    RAISE EXCEPTION 'STATUS_MESSAGES_EXCEED_20_CHARS: shorten existing messages before retrying';
  END IF;
END $$;
ALTER TABLE public.employee_statuses DROP CONSTRAINT employee_statuses_status_message_check;
ALTER TABLE public.employee_statuses ADD CONSTRAINT employee_statuses_status_message_check
  CHECK(length(status_message)<=20);
CREATE TABLE public.quick_emojis (
  id text PRIMARY KEY, emoji text NOT NULL UNIQUE,
  label text NOT NULL, sort_order integer NOT NULL
);
INSERT INTO public.quick_emojis VALUES
  ('coffee','☕','커피',1),('meal','🍴','식사',2),('heart','❤️','하트',3),
  ('computer','💻','컴퓨터',4),('book','📖','책',5),('party','🎉','축하',6),
  ('plant','🌱','새싹',7),('exercise','🏋️','운동',8),('document','📄','문서',9),
  ('storage','💾','저장',10),('cat','🐱','고양이',11),('eye','👁️','눈',12);
ALTER TABLE public.employee_statuses ADD COLUMN quick_emoji_id text REFERENCES public.quick_emojis(id);

CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  name text NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 100),
  UNIQUE(company_id,name), UNIQUE(company_id,id)
);
ALTER TABLE public.employees ADD COLUMN team_id uuid;
ALTER TABLE public.employees ADD CONSTRAINT employees_company_team_fk
  FOREIGN KEY(company_id,team_id) REFERENCES public.teams(company_id,id);
CREATE INDEX employees_company_team_idx ON public.employees(company_id,team_id);

CREATE TABLE public.avatar_categories (
  id text PRIMARY KEY, label text NOT NULL,
  required_for_basic boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL
);
INSERT INTO public.avatar_categories VALUES
  ('hair_style','머리 모양',true,1),('hair_color','머리 색',true,2),
  ('eye_color','눈 색',true,3),('outfit','기본 의상',true,4),
  ('outfit_color','의상 색',true,5),('special_skin','특별 스킨',false,6),
  ('gender','의상 실루엣',true,7);
-- Real item IDs/assets are provided by FE. No invented IDs are seeded here.
CREATE TABLE public.avatar_items (
  category_id text NOT NULL REFERENCES public.avatar_categories(id),
  item_id text NOT NULL CHECK(length(item_id) BETWEEN 1 AND 100),
  label text NOT NULL CHECK(length(label) BETWEEN 1 AND 100),
  asset_path text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(metadata)='object'),
  enabled boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  PRIMARY KEY(category_id,item_id),
  CHECK(asset_path IS NULL OR asset_path ~ '^(/[^/]|https://)')
);
CREATE TABLE public.employee_avatars (
  employee_id uuid PRIMARY KEY REFERENCES public.employees(id) ON DELETE CASCADE,
  selections jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(selections)='object'),
  is_complete boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.employee_avatars(employee_id) SELECT id FROM public.employees;
CREATE TRIGGER avatar_touch BEFORE UPDATE ON public.employee_avatars
FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at();
CREATE OR REPLACE FUNCTION private.initialize_employee() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  INSERT INTO public.sensory_profiles(employee_id) VALUES(NEW.id);
  INSERT INTO public.employee_statuses(employee_id) VALUES(NEW.id);
  INSERT INTO public.current_sensations(employee_id) VALUES(NEW.id);
  INSERT INTO public.employee_avatars(employee_id) VALUES(NEW.id);
  RETURN NEW;
END;
$$;

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK(kind IN ('system','seat_changed')),
  title text NOT NULL CHECK(length(title) BETWEEN 1 AND 100),
  body text NOT NULL DEFAULT '' CHECK(length(body)<=500),
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_employee_created_idx ON public.notifications(employee_id,created_at DESC,id);
CREATE FUNCTION private.notify_seat_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF OLD.seat_id IS DISTINCT FROM NEW.seat_id THEN
    INSERT INTO public.notifications(employee_id,kind,title,body)
    VALUES(NEW.id,'seat_changed','좌석 배정 변경',
      CASE WHEN NEW.seat_id IS NULL THEN '좌석 배정이 해제되었습니다.' ELSE '새 좌석이 배정되었습니다.' END);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER notify_seat_change AFTER UPDATE OF seat_id ON public.employees
FOR EACH ROW EXECUTE FUNCTION private.notify_seat_change();

CREATE OR REPLACE FUNCTION private.set_message(p_employee_id uuid,p_status_message text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_status text; v_result jsonb;
BEGIN
  v_status=private.lock_my_status(p_employee_id);
  IF v_status NOT IN ('working','away') THEN RAISE EXCEPTION 'EMPLOYEE_NOT_WORKING'; END IF;
  IF p_status_message IS NULL OR length(p_status_message)>20 THEN
    RAISE EXCEPTION 'INVALID_STATUS_MESSAGE'; END IF;
  UPDATE public.employee_statuses SET status_message=p_status_message
  WHERE employee_id=p_employee_id RETURNING to_jsonb(employee_statuses) INTO v_result;
  RETURN v_result;
END;
$$;
CREATE FUNCTION private.set_emoji(p_employee_id uuid,p_emoji_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_result jsonb;
BEGIN
  PERFORM private.lock_my_status(p_employee_id);
  IF p_emoji_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.quick_emojis WHERE id=p_emoji_id) THEN
    RAISE EXCEPTION 'INVALID_QUICK_EMOJI'; END IF;
  UPDATE public.employee_statuses SET quick_emoji_id=p_emoji_id WHERE employee_id=p_employee_id
  RETURNING to_jsonb(employee_statuses) INTO v_result;
  RETURN v_result;
END;
$$;
CREATE FUNCTION public.set_quick_emoji(p_employee_id uuid,p_emoji_id text)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
  SELECT private.set_emoji(p_employee_id,p_emoji_id);
$$;
CREATE FUNCTION private.save_avatar(p_employee_id uuid,p_selections jsonb,p_complete boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE k text; v jsonb; v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'LOGIN_REQUIRED'; END IF;
  PERFORM 1 FROM public.employees WHERE id=p_employee_id AND user_id=auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_YOUR_EMPLOYEE'; END IF;
  IF p_selections IS NULL OR jsonb_typeof(p_selections)<>'object' OR p_complete IS NULL THEN
    RAISE EXCEPTION 'INVALID_AVATAR_SELECTIONS'; END IF;
  FOR k,v IN SELECT key,value FROM jsonb_each(p_selections) LOOP
    IF NOT EXISTS(SELECT 1 FROM public.avatar_categories WHERE id=k) THEN
      RAISE EXCEPTION 'INVALID_AVATAR_CATEGORY'; END IF;
    IF v<>'null'::jsonb THEN
      IF jsonb_typeof(v)<>'string' THEN RAISE EXCEPTION 'INVALID_AVATAR_ITEM'; END IF;
      IF NOT EXISTS(SELECT 1 FROM public.avatar_items WHERE category_id=k AND item_id=(p_selections->>k) AND enabled) THEN
        RAISE EXCEPTION 'INVALID_AVATAR_ITEM'; END IF;
    END IF;
  END LOOP;
  -- A special skin is a full outfit/appearance; otherwise all basic parts are required.
  IF p_complete AND (p_selections->>'special_skin') IS NULL AND EXISTS(
    SELECT 1 FROM public.avatar_categories c WHERE c.required_for_basic AND (p_selections->>c.id) IS NULL
  ) THEN RAISE EXCEPTION 'INCOMPLETE_AVATAR'; END IF;
  INSERT INTO public.employee_avatars(employee_id,selections,is_complete)
  VALUES(p_employee_id,p_selections,p_complete)
  ON CONFLICT(employee_id) DO UPDATE SET selections=EXCLUDED.selections,is_complete=EXCLUDED.is_complete
  RETURNING to_jsonb(employee_avatars) INTO v_result;
  RETURN v_result;
END;
$$;
CREATE FUNCTION public.save_employee_avatar(p_employee_id uuid,p_selections jsonb,p_complete boolean DEFAULT true)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
  SELECT private.save_avatar(p_employee_id,p_selections,p_complete);
$$;
-- Decode stable catalogue IDs to the current FE renderer's indices.
CREATE FUNCTION private.avatar_character(p_selections jsonb) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT jsonb_build_object(
    'hair',coalesce((SELECT (metadata->>'frontend_index')::integer FROM public.avatar_items WHERE category_id='hair_style' AND item_id=p_selections->>'hair_style'),0),
    'hairColor',coalesce((SELECT (metadata->>'frontend_index')::integer FROM public.avatar_items WHERE category_id='hair_color' AND item_id=p_selections->>'hair_color'),0),
    'eye',coalesce((SELECT (metadata->>'frontend_index')::integer FROM public.avatar_items WHERE category_id='eye_color' AND item_id=p_selections->>'eye_color'),0),
    'outfit',coalesce((SELECT (metadata->>'frontend_index')::integer FROM public.avatar_items WHERE category_id='outfit' AND item_id=p_selections->>'outfit'),0),
    'color',coalesce((SELECT (metadata->>'frontend_index')::integer FROM public.avatar_items WHERE category_id='outfit_color' AND item_id=p_selections->>'outfit_color'),0),
    'gender',coalesce(p_selections->>'gender','f'), 'skin',p_selections->>'special_skin');
$$;
-- Accept exactly the JSON shape exported by fe/src/character.js.
CREATE FUNCTION private.save_character(p_employee_id uuid,p_character jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE k text; category text; selected text; selections jsonb='{}'; result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'LOGIN_REQUIRED'; END IF;
  IF p_character IS NULL OR jsonb_typeof(p_character)<>'object' THEN RAISE EXCEPTION 'INVALID_CHARACTER'; END IF;
  IF (SELECT count(*) FROM jsonb_object_keys(p_character))<>7 OR NOT (p_character ?& ARRAY['hair','hairColor','eye','gender','outfit','color','skin']) THEN
    RAISE EXCEPTION 'INVALID_CHARACTER'; END IF;
  FOREACH k IN ARRAY ARRAY['hair','hairColor','eye','outfit','color'] LOOP
    IF jsonb_typeof(p_character->k)<>'number' THEN RAISE EXCEPTION 'INVALID_CHARACTER'; END IF;
    IF (p_character->>k)::numeric<>trunc((p_character->>k)::numeric) THEN RAISE EXCEPTION 'INVALID_CHARACTER'; END IF;
    category=CASE k WHEN 'hair' THEN 'hair_style' WHEN 'hairColor' THEN 'hair_color'
      WHEN 'eye' THEN 'eye_color' WHEN 'outfit' THEN 'outfit' ELSE 'outfit_color' END;
    SELECT item_id INTO selected FROM public.avatar_items
      WHERE category_id=category AND (metadata->>'frontend_index')::numeric=(p_character->>k)::numeric AND enabled;
    IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_CHARACTER'; END IF;
    selections=selections||jsonb_build_object(category,selected);
  END LOOP;
  IF jsonb_typeof(p_character->'gender')<>'string' OR (p_character->>'gender') NOT IN ('f','m') THEN RAISE EXCEPTION 'INVALID_CHARACTER'; END IF;
  IF p_character->'skin'<>'null'::jsonb AND jsonb_typeof(p_character->'skin')<>'string' THEN RAISE EXCEPTION 'INVALID_CHARACTER'; END IF;
  selections=selections||jsonb_build_object('gender',p_character->>'gender','special_skin',p_character->'skin');
  result=private.save_avatar(p_employee_id,selections,true);
  RETURN result||jsonb_build_object('character',private.avatar_character(selections));
END;
$$;
CREATE FUNCTION public.save_character(p_employee_id uuid,p_character jsonb) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
  SELECT private.save_character(p_employee_id,p_character);
$$;
CREATE FUNCTION private.read_notification(p_notification_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'LOGIN_REQUIRED'; END IF;
  UPDATE public.notifications SET read_at=coalesce(read_at,clock_timestamp())
  WHERE id=p_notification_id AND employee_id=private.my_employee_id()
  RETURNING to_jsonb(notifications) INTO v_result;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_YOUR_NOTIFICATION'; END IF;
  RETURN v_result;
END;
$$;
CREATE FUNCTION public.mark_notification_read(p_notification_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
  SELECT private.read_notification(p_notification_id);
$$;

CREATE OR REPLACE FUNCTION public.get_sensory_cards(p_company_id uuid,p_employee_id uuid DEFAULT NULL,
  p_after uuid DEFAULT NULL,p_limit integer DEFAULT 50)
RETURNS SETOF jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT jsonb_build_object('employee_id',e.id,'company_id',e.company_id,'name',e.name,'job_title',e.job_title,
    'team',CASE WHEN t.id IS NULL THEN NULL ELSE jsonb_build_object('id',t.id,'name',t.name) END,
    'seat',CASE WHEN s.id IS NULL THEN NULL ELSE jsonb_build_object('id',s.id,'label',s.label,
      'floor_id',f.id,'floor_number',f.floor_number,'x_ratio',s.x_ratio,'y_ratio',s.y_ratio) END,
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
CREATE FUNCTION public.get_employee_work_info(p_employee_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT jsonb_build_object('employee_id',c->'employee_id','name',c->'name','job_title',c->'job_title',
    'team',c->'team','seat',c->'seat','profile',c->'profile',
    'status',jsonb_build_object('status',c->'status'->'status','away_reason',c->'status'->'away_reason',
      'updated_at',c->'status'->'updated_at'))
  FROM public.get_sensory_cards(private.my_company_id(),p_employee_id,NULL,1) c
  WHERE p_employee_id IS NOT NULL;
$$;
CREATE OR REPLACE FUNCTION public.get_my_membership() RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT jsonb_build_object('employee_id',e.id,'company_id',e.company_id,'company_name',c.name,
    'name',e.name,'job_title',e.job_title,'seat_id',e.seat_id,
    'team',CASE WHEN t.id IS NULL THEN NULL ELSE jsonb_build_object('id',t.id,'name',t.name) END,
    'avatar',(to_jsonb(a)-'employee_id')||jsonb_build_object('character',
      CASE WHEN a.is_complete THEN private.avatar_character(a.selections) ELSE NULL END))
  FROM public.employees e JOIN public.companies c ON c.id=e.company_id
  LEFT JOIN public.teams t ON t.id=e.team_id AND t.company_id=e.company_id
  LEFT JOIN public.employee_avatars a ON a.employee_id=e.id
  WHERE e.id=(SELECT private.my_employee_id());
$$;

ALTER TABLE public.quick_emojis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avatar_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avatar_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_avatars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY quick_emoji_read ON public.quick_emojis FOR SELECT TO authenticated USING(true);
CREATE POLICY team_company_read ON public.teams FOR SELECT TO authenticated
USING(company_id=(SELECT private.my_company_id()));
CREATE POLICY avatar_category_read ON public.avatar_categories FOR SELECT TO authenticated USING(true);
CREATE POLICY avatar_item_read ON public.avatar_items FOR SELECT TO authenticated USING(true);
CREATE POLICY avatar_company_read ON public.employee_avatars FOR SELECT TO authenticated
USING(EXISTS(SELECT 1 FROM public.employees e WHERE e.id=employee_id));
CREATE POLICY notification_owner_read ON public.notifications FOR SELECT TO authenticated
USING(employee_id=(SELECT private.my_employee_id()));
REVOKE ALL ON public.quick_emojis,public.teams,public.avatar_categories,public.avatar_items,
  public.employee_avatars,public.notifications FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.quick_emojis,public.teams,public.avatar_categories,public.avatar_items,
  public.employee_avatars,public.notifications TO authenticated;
GRANT SELECT(team_id) ON public.employees TO authenticated;

DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT p.oid::regprocedure AS signature,p.proname FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE (n.nspname='private' AND p.proname IN ('notify_seat_change','set_emoji','save_avatar','read_notification','save_character','avatar_character'))
      OR (n.nspname='public' AND p.proname IN ('set_quick_emoji','save_employee_avatar',
        'mark_notification_read','get_employee_work_info','save_character')) LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',f.signature);
    IF f.proname<>'notify_seat_change' THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.signature);
    END IF;
  END LOOP;
END $$;
NOTIFY pgrst, 'reload schema';
COMMIT;
