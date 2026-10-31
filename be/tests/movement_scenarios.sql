-- Local fixtures ONLY. Never paste this file into Supabase.
INSERT INTO auth.users(id) SELECT ('00000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid FROM generate_series(11,14) i;
INSERT INTO public.companies(id,name) VALUES
('10000000-0000-4000-8000-000000000011','Movement A'),('10000000-0000-4000-8000-000000000012','Movement B');
INSERT INTO public.floors(id,company_id,floor_number,map_path,map_width,map_height)
SELECT ('20000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
  CASE WHEN i=13 THEN '10000000-0000-4000-8000-000000000012'::uuid ELSE '10000000-0000-4000-8000-000000000011'::uuid END,
  CASE WHEN i=12 THEN 2 ELSE 1 END,
  CASE WHEN i=13 THEN '10000000-0000-4000-8000-000000000012' ELSE '10000000-0000-4000-8000-000000000011' END
    ||'/20000000-0000-4000-8000-'||lpad(i::text,12,'0')||'/v1/map.png',1000,600
FROM generate_series(11,13) i;
INSERT INTO public.seats(id,company_id,floor_id,label,x_ratio,y_ratio)
SELECT ('30000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
  CASE WHEN i=13 THEN '10000000-0000-4000-8000-000000000012'::uuid ELSE '10000000-0000-4000-8000-000000000011'::uuid END,
  ('20000000-0000-4000-8000-'||lpad(CASE WHEN i=13 THEN 13 WHEN i IN (15,16) THEN 12 ELSE 11 END::text,12,'0'))::uuid,
  'M'||i,0.4,0.6
FROM generate_series(11,17) i;
INSERT INTO public.employees(id,user_id,company_id,seat_id,name)
SELECT ('40000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
  ('00000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
  CASE WHEN i=13 THEN '10000000-0000-4000-8000-000000000012'::uuid ELSE '10000000-0000-4000-8000-000000000011'::uuid END,
  CASE WHEN i=14 THEN NULL ELSE ('30000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid END,'Mover '||i
FROM generate_series(11,14) i;
UPDATE public.sensory_profiles SET visual_sensitivity=4,auditory_sensitivity=1,olfactory_sensitivity=5,description='keep'
WHERE employee_id='40000000-0000-4000-8000-000000000011';
-- Simulate a stale legacy value: a real check-in must clear it.
UPDATE public.current_sensations SET noise_level=4 WHERE employee_id='40000000-0000-4000-8000-000000000011';
SELECT tests.ok((SELECT count(*) FROM private.seat_claims WHERE kind='assigned')=
  (SELECT count(*) FROM public.employees WHERE seat_id IS NOT NULL),'assigned claims backfilled and new-employee trigger active');

BEGIN;
SET LOCAL ROLE anon;
SELECT tests.raises($q$SELECT public.move_to_seat(NULL,NULL)$q$,'permission denied');
SELECT tests.raises($q$SELECT public.return_to_seat(NULL)$q$,'permission denied');
SELECT tests.raises($q$SELECT public.set_away_reason_text(NULL,NULL)$q$,'permission denied');
SELECT tests.raises($q$SELECT public.get_employee_location(NULL)$q$,'permission denied');
COMMIT;
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','',true);
SELECT tests.raises($q$SELECT public.move_to_seat(NULL,NULL)$q$,'LOGIN_REQUIRED');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000011',true);
SELECT tests.raises($q$SELECT public.move_to_seat('40000000-0000-4000-8000-000000000012','30000000-0000-4000-8000-000000000014')$q$,'NOT_YOUR_EMPLOYEE');
SELECT tests.raises($q$SELECT public.return_to_seat('40000000-0000-4000-8000-000000000012')$q$,'NOT_YOUR_EMPLOYEE');
SELECT tests.raises($q$SELECT public.set_away_reason_text('40000000-0000-4000-8000-000000000012','x')$q$,'NOT_YOUR_EMPLOYEE');
SELECT tests.raises($q$SELECT public.move_to_seat('40000000-0000-4000-8000-000000000011','30000000-0000-4000-8000-000000000014')$q$,'EMPLOYEE_NOT_WORKING');
SELECT tests.raises($q$SELECT public.return_to_seat('40000000-0000-4000-8000-000000000011')$q$,'EMPLOYEE_NOT_WORKING');
SELECT tests.raises($q$SELECT public.set_away_reason_text('40000000-0000-4000-8000-000000000011','x')$q$,'EMPLOYEE_NOT_AWAY');
SELECT tests.ok(public.get_employee_location('40000000-0000-4000-8000-000000000013') IS NULL,'other company location hidden');
SELECT tests.ok((public.get_employee_location('40000000-0000-4000-8000-000000000011')->>'current_seat') IS NULL,'off work no current seat');
SELECT tests.raises('SELECT * FROM private.seat_claims','permission denied');
SELECT tests.raises('SELECT private.lock_employee_location(NULL)','permission denied');
SELECT tests.raises('SELECT private.clear_current_sensations(NULL)','permission denied');
SELECT tests.raises('SELECT private.employee_state(NULL)','permission denied');
SELECT tests.raises('UPDATE public.employees SET temporary_seat_id=NULL','permission denied');
SELECT tests.raises('UPDATE public.employee_statuses SET away_reason_text=NULL','permission denied');

SELECT public.set_employee_status('40000000-0000-4000-8000-000000000011','working');
SELECT tests.ok((SELECT noise_level IS NULL FROM public.current_sensations WHERE employee_id='40000000-0000-4000-8000-000000000011'),'check in clears legacy sensations');
SELECT public.set_status_message('40000000-0000-4000-8000-000000000011','independent');
SELECT public.set_quick_emoji('40000000-0000-4000-8000-000000000011','coffee');
SELECT public.set_current_sensations('40000000-0000-4000-8000-000000000011','{"noise_level":5,"temperature_level":2}');
SELECT public.set_employee_status('40000000-0000-4000-8000-000000000011','working');
SELECT tests.ok((SELECT noise_level=5 FROM public.current_sensations WHERE employee_id='40000000-0000-4000-8000-000000000011'),'repeat check in does not erase input');
SELECT tests.raises($q$SELECT public.move_to_seat('40000000-0000-4000-8000-000000000011',NULL)$q$,'INVALID_SEAT');
SELECT tests.raises($q$SELECT public.move_to_seat('40000000-0000-4000-8000-000000000011','30000000-0000-4000-8000-000000000013')$q$,'INVALID_SEAT');
SELECT tests.raises($q$SELECT public.move_to_seat('40000000-0000-4000-8000-000000000011','30000000-0000-4000-8000-000000000011')$q$,'USE_RETURN_TO_SEAT');
SELECT tests.raises($q$SELECT public.move_to_seat('40000000-0000-4000-8000-000000000011','30000000-0000-4000-8000-000000000012')$q$,'SEAT_TAKEN');
SELECT tests.ok((SELECT noise_level=5 FROM public.current_sensations WHERE employee_id='40000000-0000-4000-8000-000000000011'),'failed move preserves input');
SELECT public.move_to_seat('40000000-0000-4000-8000-000000000011','30000000-0000-4000-8000-000000000014');
SELECT tests.ok((SELECT seat_id='30000000-0000-4000-8000-000000000011' AND temporary_seat_id='30000000-0000-4000-8000-000000000014' FROM public.employees WHERE id='40000000-0000-4000-8000-000000000011'),'move retains assigned home');
SELECT tests.ok((SELECT status='away' AND away_reason IS NULL AND away_reason_text IS NULL AND status_message='independent' AND quick_emoji_id='coffee' FROM public.employee_statuses WHERE employee_id='40000000-0000-4000-8000-000000000011'),'move auto away and independent message emoji');
SELECT tests.ok((SELECT num_nonnulls(temperature_level,humidity_level,noise_level,odor_level,discomfort_level,crowd_level)=0 FROM public.current_sensations WHERE employee_id='40000000-0000-4000-8000-000000000011'),'all six NULL after move');
SELECT tests.ok((public.get_my_membership()->'location'->>'is_moving')='true','membership movement');
SELECT tests.ok((public.get_employee_work_info('40000000-0000-4000-8000-000000000011')->'location'->'temporary_seat'->>'label')='M14','work info current destination');
SELECT tests.ok((SELECT c->'seat'->>'label'='M11' AND c->'location'->'current_seat'->>'label'='M14' FROM public.get_sensory_cards('10000000-0000-4000-8000-000000000011','40000000-0000-4000-8000-000000000011') c),'card keeps home plus current destination');

SELECT public.set_away_reason_text('40000000-0000-4000-8000-000000000011',repeat('가',20));
SELECT tests.raises($q$SELECT public.set_away_reason_text('40000000-0000-4000-8000-000000000011',repeat('가',21))$q$,'INVALID_AWAY_REASON_TEXT');
SELECT tests.ok((public.get_employee_work_info('40000000-0000-4000-8000-000000000011')->'status'->>'away_reason_text')=repeat('가',20),'custom Unicode length and work info');
SELECT public.set_employee_status('40000000-0000-4000-8000-000000000011','away','meeting');
SELECT tests.ok((SELECT away_reason='meeting' AND away_reason_text IS NULL FROM public.employee_statuses WHERE employee_id='40000000-0000-4000-8000-000000000011'),'preset clears custom');
SELECT public.set_away_reason_text('40000000-0000-4000-8000-000000000011','  water  ');
SELECT tests.ok((SELECT away_reason IS NULL AND away_reason_text='water' FROM public.employee_statuses WHERE employee_id='40000000-0000-4000-8000-000000000011'),'custom trims and clears preset');
SELECT public.set_current_sensations('40000000-0000-4000-8000-000000000011','{"noise_level":4}');
SELECT public.move_to_seat('40000000-0000-4000-8000-000000000011','30000000-0000-4000-8000-000000000014');
SELECT tests.ok((SELECT away_reason_text='water' FROM public.employee_statuses WHERE employee_id='40000000-0000-4000-8000-000000000011'),'retry destination retains custom reason');
SELECT tests.ok((SELECT noise_level=4 FROM public.current_sensations WHERE employee_id='40000000-0000-4000-8000-000000000011'),'retry destination retains input');
SELECT tests.raises($q$SELECT public.move_to_seat('40000000-0000-4000-8000-000000000011','30000000-0000-4000-8000-000000000012')$q$,'SEAT_TAKEN');
SELECT tests.ok((SELECT temporary_seat_id='30000000-0000-4000-8000-000000000014' FROM public.employees WHERE id='40000000-0000-4000-8000-000000000011'),'failed second move keeps first destination');
SELECT tests.raises($q$SELECT public.choose_seat('40000000-0000-4000-8000-000000000011',NULL)$q$,'RETURN_REQUIRED');
SELECT public.move_to_seat('40000000-0000-4000-8000-000000000011','30000000-0000-4000-8000-000000000015');
SELECT tests.ok((public.get_employee_location('40000000-0000-4000-8000-000000000011')->'current_seat'->>'floor_number')='2','cross floor move');
SELECT tests.ok((SELECT away_reason_text IS NULL FROM public.employee_statuses WHERE employee_id='40000000-0000-4000-8000-000000000011'),'second move clears old reason');
SELECT tests.ok((SELECT noise_level IS NULL FROM public.current_sensations WHERE employee_id='40000000-0000-4000-8000-000000000011'),'second move clears input');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000012',true);
SELECT public.set_employee_status('40000000-0000-4000-8000-000000000012','working');
SELECT tests.raises($q$SELECT public.choose_seat('40000000-0000-4000-8000-000000000012','30000000-0000-4000-8000-000000000015')$q$,'SEAT_TAKEN');
SELECT tests.raises($q$SELECT public.move_to_seat('40000000-0000-4000-8000-000000000012','30000000-0000-4000-8000-000000000015')$q$,'SEAT_TAKEN');
SELECT tests.raises($q$SELECT public.choose_seat('40000000-0000-4000-8000-000000000012','30000000-0000-4000-8000-000000000011')$q$,'SEAT_TAKEN');
SELECT public.move_to_seat('40000000-0000-4000-8000-000000000012','30000000-0000-4000-8000-000000000014');
SELECT public.return_to_seat('40000000-0000-4000-8000-000000000012');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000011',true);
SELECT public.set_away_reason_text('40000000-0000-4000-8000-000000000011','back soon');
SELECT public.set_current_sensations('40000000-0000-4000-8000-000000000011','{"noise_level":5}');
SELECT public.return_to_seat('40000000-0000-4000-8000-000000000011');
SELECT tests.ok((public.get_employee_location('40000000-0000-4000-8000-000000000011')->'current_seat'->>'floor_number')='1','return original floor');
SELECT tests.ok((SELECT status='working' AND away_reason IS NULL AND away_reason_text IS NULL AND status_message='independent' FROM public.employee_statuses WHERE employee_id='40000000-0000-4000-8000-000000000011'),'return clears reason retains message');
SELECT tests.ok((SELECT noise_level IS NULL FROM public.current_sensations WHERE employee_id='40000000-0000-4000-8000-000000000011'),'return clears sensations');
SELECT tests.raises($q$SELECT public.set_away_reason_text('40000000-0000-4000-8000-000000000011','x')$q$,'EMPLOYEE_NOT_AWAY');
SELECT public.set_current_sensations('40000000-0000-4000-8000-000000000011','{"noise_level":3}');
SELECT public.return_to_seat('40000000-0000-4000-8000-000000000011');
SELECT tests.ok((SELECT noise_level=3 FROM public.current_sensations WHERE employee_id='40000000-0000-4000-8000-000000000011'),'retry return preserves post-return input');
SELECT public.set_employee_status('40000000-0000-4000-8000-000000000011','away');
SELECT public.set_away_reason_text('40000000-0000-4000-8000-000000000011','');
SELECT tests.ok((SELECT away_reason_text IS NULL FROM public.employee_statuses WHERE employee_id='40000000-0000-4000-8000-000000000011'),'empty custom clears to NULL');
SELECT public.set_away_reason_text('40000000-0000-4000-8000-000000000011',NULL);
SELECT public.return_to_seat('40000000-0000-4000-8000-000000000011');
SELECT tests.ok((SELECT status='away' FROM public.employee_statuses WHERE employee_id='40000000-0000-4000-8000-000000000011'),'return retry does not cancel manual away');
SELECT public.set_employee_status('40000000-0000-4000-8000-000000000011','working');
SELECT public.move_to_seat('40000000-0000-4000-8000-000000000011','30000000-0000-4000-8000-000000000015');
SELECT public.set_away_reason_text('40000000-0000-4000-8000-000000000011','checkout');
SELECT public.set_employee_status('40000000-0000-4000-8000-000000000011','off_work');
SELECT tests.ok((SELECT temporary_seat_id IS NULL AND seat_id='30000000-0000-4000-8000-000000000011' FROM public.employees WHERE id='40000000-0000-4000-8000-000000000011'),'checkout releases destination retains home');
SELECT tests.ok((SELECT status_message='' AND away_reason_text IS NULL AND away_reason IS NULL AND quick_emoji_id='coffee' FROM public.employee_statuses WHERE employee_id='40000000-0000-4000-8000-000000000011'),'checkout clears message reason but retains independent emoji');
SELECT tests.ok((SELECT visual_sensitivity=4 AND auditory_sensitivity=1 AND olfactory_sensitivity=5 AND description='keep' FROM public.sensory_profiles WHERE employee_id='40000000-0000-4000-8000-000000000011'),'sensory profile never cleared');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000012',true);
SELECT tests.raises($q$SELECT public.move_to_seat('40000000-0000-4000-8000-000000000012','30000000-0000-4000-8000-000000000011')$q$,'SEAT_TAKEN');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000014',true);
SELECT public.set_employee_status('40000000-0000-4000-8000-000000000014','working');
SELECT tests.raises($q$SELECT public.move_to_seat('40000000-0000-4000-8000-000000000014','30000000-0000-4000-8000-000000000014')$q$,'ASSIGNED_SEAT_REQUIRED');
COMMIT;

SELECT tests.raises($q$UPDATE public.employee_statuses SET status='away',away_reason='meeting',away_reason_text='both' WHERE employee_id='40000000-0000-4000-8000-000000000011'$q$,'check constraint');
SELECT tests.ok((SELECT count(*)=1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='set_employee_status'),'no overloaded status RPC');
