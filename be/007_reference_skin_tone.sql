-- Apply ONCE after 001 + 004 + 005, as postgres in Supabase SQL Editor.
-- 저장되지 않던 참조 캐릭터의 피부 톤(색)을 보존한다.
--   * 캐릭터 JSON에 선택 키 'skinTone'을 하나 더 허용한다(기존 7개 키는 그대로).
--   * 값은 fe/src/sprites.js의 skinTones 4색(#ffe2c6/#ffd4b0/#eab48a/#c98a5e)만 허용.
--   * 기존 7개 키만 보내는 FE는 지금과 똑같이 동작한다(skinTone 없으면 피부 톤은 null).
BEGIN;
INSERT INTO private.sensespace_migrations(version) VALUES('007_reference_skin_tone');

INSERT INTO public.avatar_categories(id,label,required_for_basic,sort_order)
VALUES('skin_tone','피부 톤',false,8)
ON CONFLICT (id) DO UPDATE SET label=EXCLUDED.label, sort_order=EXCLUDED.sort_order;

INSERT INTO public.avatar_items(category_id,item_id,label,metadata,sort_order)
VALUES
  ('skin_tone','#ffe2c6','밝은 톤','{"hex":"#ffe2c6","catalog_source":"fe/src/sprites.js"}'::jsonb,0),
  ('skin_tone','#ffd4b0','기본 톤','{"hex":"#ffd4b0","catalog_source":"fe/src/sprites.js"}'::jsonb,1),
  ('skin_tone','#eab48a','중간 톤','{"hex":"#eab48a","catalog_source":"fe/src/sprites.js"}'::jsonb,2),
  ('skin_tone','#c98a5e','어두운 톤','{"hex":"#c98a5e","catalog_source":"fe/src/sprites.js"}'::jsonb,3)
ON CONFLICT (category_id,item_id) DO UPDATE
  SET label=EXCLUDED.label, metadata=EXCLUDED.metadata, sort_order=EXCLUDED.sort_order, enabled=true;

-- 읽기 응답의 character에 skinTone(색)을 함께 돌려준다.
CREATE OR REPLACE FUNCTION private.avatar_character(p_selections jsonb) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT jsonb_build_object(
    'hair',coalesce((SELECT (metadata->>'frontend_index')::integer FROM public.avatar_items WHERE category_id='hair_style' AND item_id=p_selections->>'hair_style'),0),
    'hairColor',coalesce((SELECT (metadata->>'frontend_index')::integer FROM public.avatar_items WHERE category_id='hair_color' AND item_id=p_selections->>'hair_color'),0),
    'eye',coalesce((SELECT (metadata->>'frontend_index')::integer FROM public.avatar_items WHERE category_id='eye_color' AND item_id=p_selections->>'eye_color'),0),
    'outfit',coalesce((SELECT (metadata->>'frontend_index')::integer FROM public.avatar_items WHERE category_id='outfit' AND item_id=p_selections->>'outfit'),0),
    'color',coalesce((SELECT (metadata->>'frontend_index')::integer FROM public.avatar_items WHERE category_id='outfit_color' AND item_id=p_selections->>'outfit_color'),0),
    'gender',coalesce(p_selections->>'gender','f'), 'skin',p_selections->>'special_skin',
    'skinTone',p_selections->>'skin_tone');
$$;

-- 7개 키(기존) 또는 8개 키(맨 위 7개 + skinTone)만 받는다.
CREATE OR REPLACE FUNCTION private.save_character(p_employee_id uuid,p_character jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE k text; category text; selected text; selections jsonb='{}'; result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'LOGIN_REQUIRED'; END IF;
  IF p_character IS NULL OR jsonb_typeof(p_character)<>'object' THEN RAISE EXCEPTION 'INVALID_CHARACTER'; END IF;
  IF (SELECT count(*) FROM jsonb_object_keys(p_character)) NOT IN (7,8)
    OR NOT (p_character ?& ARRAY['hair','hairColor','eye','gender','outfit','color','skin'])
    OR ((SELECT count(*) FROM jsonb_object_keys(p_character)) = 8 AND NOT (p_character ? 'skinTone')) THEN
    RAISE EXCEPTION 'INVALID_CHARACTER';
  END IF;
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
  IF p_character ? 'skinTone' AND p_character->'skinTone'<>'null'::jsonb THEN
    IF jsonb_typeof(p_character->'skinTone')<>'string' THEN RAISE EXCEPTION 'INVALID_CHARACTER'; END IF;
    IF NOT EXISTS(SELECT 1 FROM public.avatar_items
      WHERE category_id='skin_tone' AND item_id=(p_character->>'skinTone') AND enabled) THEN
      RAISE EXCEPTION 'INVALID_CHARACTER';
    END IF;
    selections=selections||jsonb_build_object('skin_tone',p_character->>'skinTone');
  ELSE
    selections=selections||jsonb_build_object('skin_tone',NULL);
  END IF;
  selections=selections||jsonb_build_object('gender',p_character->>'gender','special_skin',p_character->'skin');
  result=private.save_avatar(p_employee_id,selections,true);
  RETURN result||jsonb_build_object('character',private.avatar_character(selections));
END;
$$;
COMMIT;
