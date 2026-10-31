-- Inthon company setup. Run once after 001.
-- This creates a NEW company each run. It does not upload a map image.
-- Save the returned company_id, floor_id, map_path and join_code securely.
-- Confirmed map: fe/정보관_1층.png, 4938 x 2868 pixels, floor 1.
-- All 76 pictured chairs and their positions were visually approved by the user.
-- Confirmed company name: Inthon. This has not yet been executed on Supabase.
WITH settings AS MATERIALIZED (
  SELECT 'Inthon'::text AS company_name, 1 AS floor_number,
    4938 AS map_width, 2868 AS map_height,
    gen_random_uuid() AS company_id, gen_random_uuid() AS floor_id,
    upper(encode(extensions.gen_random_bytes(12),'hex')) AS join_code
), new_company AS (
  INSERT INTO public.companies(id,name)
  SELECT company_id,company_name FROM settings RETURNING id
), new_floor AS (
  INSERT INTO public.floors(id,company_id,floor_number,map_path,map_width,map_height)
  SELECT s.floor_id,c.id,s.floor_number,
    c.id::text||'/'||s.floor_id::text||'/v1/map.png',s.map_width,s.map_height
  FROM settings s JOIN new_company c ON c.id=s.company_id
  RETURNING id,company_id,map_path
), new_seats AS (
  INSERT INTO public.seats(company_id,floor_id,label,x_ratio,y_ratio)
  SELECT f.company_id,f.id,s.label,s.x_ratio,s.y_ratio FROM new_floor f
  CROSS JOIN (VALUES
    ('A-01',0.27987039,0.13633194),
    ('A-02',0.32037262,0.13633194),
    ('A-03',0.35945727,0.13633194),
    ('A-04',0.40380721,0.13633194),
    ('A-05',0.44734710,0.13633194),
    ('A-06',0.49027947,0.13633194),
    ('A-07',0.53280680,0.13633194),
    ('A-08',0.57513163,0.13633194),
    ('A-09',0.61725395,0.13633194),
    ('A-10',0.65957878,0.13633194),
    ('A-11',0.70170109,0.13633194),
    ('A-12',0.74321588,0.13633194),
    ('A-13',0.78371810,0.13633194),
    ('A-14',0.82563791,0.13633194),
    ('A-15',0.86816525,0.13633194),
    ('A-16',0.91008505,0.13633194),
    ('B-01',0.34325638,0.22105997),
    ('B-02',0.37748076,0.22105997),
    ('B-03',0.34325638,0.34972106),
    ('B-04',0.37748076,0.34972106),
    ('C-01',0.50688538,0.22105997),
    ('C-02',0.54637505,0.22105997),
    ('C-03',0.50688538,0.34972106),
    ('C-04',0.54637505,0.34972106),
    ('D-01',0.71931956,0.22105997),
    ('D-02',0.75536655,0.22105997),
    ('D-03',0.79789388,0.22105997),
    ('D-04',0.83738356,0.22105997),
    ('D-05',0.71931956,0.34972106),
    ('D-06',0.75536655,0.34972106),
    ('D-07',0.79789388,0.34972106),
    ('D-08',0.83738356,0.34972106),
    ('E-01',0.30275415,0.51952580),
    ('E-02',0.33839611,0.51952580),
    ('E-03',0.37505063,0.51952580),
    ('E-04',0.40927501,0.51952580),
    ('E-05',0.30275415,0.64748954),
    ('E-06',0.33839611,0.64748954),
    ('E-07',0.37505063,0.64748954),
    ('E-08',0.40927501,0.64748954),
    ('F-01',0.50243013,0.51952580),
    ('F-02',0.53948967,0.51952580),
    ('F-03',0.57816930,0.51952580),
    ('F-04',0.61624139,0.51952580),
    ('F-05',0.50243013,0.64748954),
    ('F-06',0.53948967,0.64748954),
    ('F-07',0.57816930,0.64748954),
    ('F-08',0.61624139,0.64748954),
    ('G-01',0.30275415,0.73744770),
    ('G-02',0.33839611,0.73744770),
    ('G-03',0.37505063,0.73744770),
    ('G-04',0.40927501,0.73744770),
    ('G-05',0.30275415,0.86506276),
    ('G-06',0.33839611,0.86506276),
    ('G-07',0.37505063,0.86506276),
    ('G-08',0.40927501,0.86506276),
    ('H-01',0.50243013,0.73744770),
    ('H-02',0.53948967,0.73744770),
    ('H-03',0.57816930,0.73744770),
    ('H-04',0.61624139,0.73744770),
    ('H-05',0.50243013,0.86506276),
    ('H-06',0.53948967,0.86506276),
    ('H-07',0.57816930,0.86506276),
    ('H-08',0.61624139,0.86506276),
    ('I-01',0.76994735,0.52475593),
    ('I-02',0.86330498,0.52475593),
    ('I-03',0.76994735,0.58437936),
    ('I-04',0.86330498,0.58437936),
    ('I-05',0.76994735,0.64748954),
    ('I-06',0.86330498,0.64748954),
    ('I-07',0.76994735,0.70885635),
    ('I-08',0.86330498,0.70885635),
    ('I-09',0.76994735,0.76917713),
    ('I-10',0.86330498,0.76917713),
    ('I-11',0.76994735,0.82984658),
    ('I-12',0.86330498,0.82984658)
  ) s(label,x_ratio,y_ratio)
  RETURNING id
), new_code AS (
  INSERT INTO private.company_join_codes(company_id,code_hash,expires_at)
  SELECT c.id,encode(extensions.digest(s.join_code,'sha256'),'hex'),now()+interval '30 days'
  FROM new_company c JOIN settings s ON s.company_id=c.id RETURNING company_id,expires_at
)
SELECT c.company_id,f.id AS floor_id,f.map_path,s.join_code,c.expires_at,
  (SELECT count(*) FROM new_seats) AS seats_created
FROM new_code c JOIN new_floor f ON f.company_id=c.company_id
JOIN settings s ON s.company_id=c.company_id;
