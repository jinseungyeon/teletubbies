\set ON_ERROR_STOP on
CREATE SCHEMA tests;
CREATE FUNCTION tests.ok(b boolean,msg text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF NOT coalesce(b,false) THEN RAISE EXCEPTION 'FAIL: %',msg; END IF; END $$;
CREATE FUNCTION tests.raises(q text,expected text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE msg text;
BEGIN
  BEGIN EXECUTE q;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS msg=MESSAGE_TEXT;
    IF position(expected IN msg)>0 THEN RETURN; END IF;
    RAISE EXCEPTION 'Expected %, got %',expected,msg;
  END;
  RAISE EXCEPTION 'Expected error %, query succeeded',expected;
END $$;
GRANT USAGE ON SCHEMA tests TO authenticated,anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA tests TO authenticated,anon;
INSERT INTO auth.users(id)
SELECT ('00000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid FROM generate_series(1,8) i;
INSERT INTO public.companies(id,name) VALUES
('10000000-0000-4000-8000-000000000001','Company A'),
('10000000-0000-4000-8000-000000000002','Company B');
INSERT INTO public.floors(id,company_id,floor_number,map_path,map_width,map_height)
SELECT ('20000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
('10000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,1,
'10000000-0000-4000-8000-'||lpad(i::text,12,'0')||'/20000000-0000-4000-8000-'||lpad(i::text,12,'0')||'/v1/map.png',1000,600
FROM generate_series(1,2) i;
INSERT INTO public.seats(id,company_id,floor_id,label,x_ratio,y_ratio) VALUES
('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','A1',0.2,0.3),
('30000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','A2',0.4,0.3),
('30000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','B1',0.6,0.3);
INSERT INTO public.employees(id,user_id,company_id,name)
SELECT ('40000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
('00000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
CASE WHEN i=3 THEN '10000000-0000-4000-8000-000000000002'::uuid ELSE '10000000-0000-4000-8000-000000000001'::uuid END,'Employee '||i
FROM generate_series(1,3) i;
INSERT INTO private.company_join_codes(company_id,code_hash)
VALUES('10000000-0000-4000-8000-000000000001',encode(extensions.digest('AAAAAAAAAAAAAAAAAAAAAAAA','sha256'),'hex')),
('10000000-0000-4000-8000-000000000002',encode(extensions.digest('BBBBBBBBBBBBBBBBBBBBBBBB','sha256'),'hex'));
INSERT INTO storage.objects(bucket_id,name) SELECT 'office-maps',map_path FROM public.floors;

BEGIN;
SET LOCAL ROLE anon;
SELECT tests.raises('SELECT * FROM public.companies','permission denied');
SELECT tests.raises($q$SELECT public.get_my_membership()$q$,'permission denied');
ROLLBACK;
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
SELECT tests.ok((SELECT count(*)=1 FROM public.companies),'company RLS');
SELECT tests.ok((SELECT count(*)=2 FROM public.employees),'employee RLS');
SELECT tests.ok((SELECT count(*)=2 FROM public.sensory_profiles),'profile RLS');
SELECT tests.ok((SELECT count(*)=2 FROM public.employee_statuses),'status RLS');
SELECT tests.ok((SELECT count(*)=2 FROM public.current_sensations),'sensation RLS');
SELECT tests.ok((SELECT count(*)=1 FROM storage.objects),'map RLS');
SELECT tests.ok((public.get_my_membership()->>'employee_id')='40000000-0000-4000-8000-000000000001','membership');
SELECT tests.ok((SELECT count(*)=2 FROM public.get_sensory_cards('10000000-0000-4000-8000-000000000001')),'cards own company');
SELECT tests.ok((SELECT count(*)=0 FROM public.get_sensory_cards('10000000-0000-4000-8000-000000000002')),'cards cross company');
SELECT tests.ok((SELECT count(*)=1 FROM public.get_sensory_cards('10000000-0000-4000-8000-000000000001',NULL,NULL,1)),'pagination');
SELECT tests.raises('SELECT user_id FROM public.employees','permission denied');
SELECT tests.raises('SELECT * FROM private.company_join_codes','permission denied');
SELECT tests.raises('UPDATE public.employees SET role=''admin''','permission denied');
SELECT tests.raises('UPDATE public.employees SET seat_id=NULL','permission denied');
SELECT tests.raises('UPDATE public.employee_statuses SET status_message=''bypass''','permission denied');
SELECT tests.raises('UPDATE public.current_sensations SET noise_level=5','permission denied');
SELECT tests.raises('DELETE FROM public.employees','permission denied');
SELECT tests.raises($q$SELECT public.set_employee_status('40000000-0000-4000-8000-000000000002','working')$q$,'NOT_YOUR_EMPLOYEE');
SELECT tests.raises($q$SELECT public.set_status_message('40000000-0000-4000-8000-000000000001','hello')$q$,'EMPLOYEE_NOT_WORKING');
SELECT tests.raises($q$SELECT public.set_current_sensations('40000000-0000-4000-8000-000000000001','{"noise_level":5}')$q$,'EMPLOYEE_NOT_WORKING');
SELECT tests.raises($q$SELECT public.set_employee_status('40000000-0000-4000-8000-000000000001','away','lunch')$q$,'INVALID_STATUS_TRANSITION');
SELECT public.set_employee_status('40000000-0000-4000-8000-000000000001','working');
SELECT public.set_status_message('40000000-0000-4000-8000-000000000001','hello');
SELECT public.set_current_sensations('40000000-0000-4000-8000-000000000001','{"noise_level":5,"humidity_level":2}');
SELECT public.set_current_sensations('40000000-0000-4000-8000-000000000001','{"humidity_level":null}');
SELECT tests.ok((SELECT noise_level=5 AND humidity_level IS NULL FROM public.current_sensations WHERE employee_id='40000000-0000-4000-8000-000000000001'),'partial patch');
SELECT tests.raises($q$SELECT public.set_current_sensations('40000000-0000-4000-8000-000000000001','{"noise_level":2.5}')$q$,'INVALID_SENSATIONS');
SELECT tests.raises($q$SELECT public.set_current_sensations('40000000-0000-4000-8000-000000000001','{"noise_level":"5"}')$q$,'INVALID_SENSATIONS');
SELECT tests.raises($q$SELECT public.set_current_sensations('40000000-0000-4000-8000-000000000001','{"oops":5}')$q$,'INVALID_SENSATIONS');
SELECT tests.raises($q$SELECT public.set_current_sensations('40000000-0000-4000-8000-000000000001','{}')$q$,'INVALID_SENSATIONS');
SELECT tests.raises($q$SELECT public.set_current_sensations('40000000-0000-4000-8000-000000000001','{"noise_level":6}')$q$,'INVALID_SENSATIONS');
SELECT tests.raises($q$SELECT public.set_employee_status('40000000-0000-4000-8000-000000000001','away')$q$,'INVALID_AWAY_REASON');
SELECT public.set_employee_status('40000000-0000-4000-8000-000000000001','away','meeting');
UPDATE public.sensory_profiles SET visual_sensitivity=4,description='keep' WHERE employee_id='40000000-0000-4000-8000-000000000001';
UPDATE public.employees SET job_title='Engineer' WHERE id='40000000-0000-4000-8000-000000000001';
WITH changed AS (UPDATE public.employees SET name='forbidden' WHERE id='40000000-0000-4000-8000-000000000002' RETURNING id)
SELECT tests.ok((SELECT count(*)=0 FROM changed),'colleague update denied');
SELECT public.choose_seat('40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001');
SELECT tests.raises($q$SELECT public.choose_seat('40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000003')$q$,'INVALID_SEAT');
SELECT public.set_employee_status('40000000-0000-4000-8000-000000000001','off_work');
SELECT tests.ok((SELECT seat_id='30000000-0000-4000-8000-000000000001' FROM public.employees WHERE id='40000000-0000-4000-8000-000000000001'),'checkout retains seat');
SELECT tests.ok((SELECT status='off_work' AND status_message='' AND away_reason IS NULL FROM public.employee_statuses WHERE employee_id='40000000-0000-4000-8000-000000000001'),'checkout clears status');
SELECT tests.ok((SELECT num_nonnulls(temperature_level,humidity_level,noise_level,odor_level,discomfort_level,crowd_level)=0 FROM public.current_sensations WHERE employee_id='40000000-0000-4000-8000-000000000001'),'checkout clears sensations');
SELECT tests.ok((SELECT visual_sensitivity=4 AND description='keep' FROM public.sensory_profiles WHERE employee_id='40000000-0000-4000-8000-000000000001'),'checkout retains profile');
SELECT public.set_employee_status('40000000-0000-4000-8000-000000000001','off_work');
SELECT tests.raises($q$SELECT public.set_status_message('40000000-0000-4000-8000-000000000001','')$q$,'EMPLOYEE_NOT_WORKING');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
SELECT public.choose_seat('40000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000002');
SELECT tests.raises($q$SELECT public.choose_seat('40000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001')$q$,'SEAT_TAKEN');
SELECT tests.ok((SELECT seat_id='30000000-0000-4000-8000-000000000002' FROM public.employees WHERE id='40000000-0000-4000-8000-000000000002'),'failed switch retains old seat');
COMMIT;

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000004',true);
SELECT tests.ok(public.get_my_membership() IS NULL,'unjoined account');
SELECT tests.ok((public.join_company(' aaaaaaaaaaaaaaaaaaaaaaaa ','New','Developer')->>'error_code') IS NULL,'join normalization');
SELECT tests.ok((public.join_company('AAAAAAAAAAAAAAAAAAAAAAAA','New','')->>'employee_id')=(public.get_my_membership()->>'employee_id'),'repeat join');
SELECT tests.ok((public.join_company('BBBBBBBBBBBBBBBBBBBBBBBB','New','')->>'error_code')='ALREADY_JOINED_COMPANY','one company only');
COMMIT;
-- Failed business attempts persist across separate committed requests.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000005',false);
SELECT tests.ok((public.join_company('bad','New','')->>'error_code')='INVALID_COMPANY_CODE','bad code') FROM generate_series(1,5);
SELECT tests.ok((public.join_company('bad','New','')->>'error_code')='RATE_LIMITED','rate limit persists');
RESET ROLE;
SELECT tests.ok((SELECT count(*)=4 FROM public.employees),'employee count');
SELECT tests.ok((SELECT count(*)=4 FROM public.employee_statuses),'child auto initialization');
SELECT tests.raises($q$INSERT INTO public.employees(user_id,company_id,name) VALUES('00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','duplicate')$q$,'unique constraint');
SELECT tests.raises($q$UPDATE public.seats SET company_id='10000000-0000-4000-8000-000000000002' WHERE id='30000000-0000-4000-8000-000000000001'$q$,'foreign key constraint');
SELECT 'SQL_SCENARIOS_PASSED';
