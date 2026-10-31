-- Run once in Supabase SQL Editor as postgres.
-- Rotates only the existing Inthon company's join code; does not create a company.
-- Save join_code from the result immediately. A later run invalidates this code.
WITH new_code AS MATERIALIZED (
  SELECT upper(encode(extensions.gen_random_bytes(12), 'hex')) AS raw
), changed AS (
  UPDATE private.company_join_codes AS c
  SET code_hash = encode(extensions.digest(n.raw, 'sha256'), 'hex'),
      expires_at = now() + interval '30 days',
      revoked_at = NULL,
      created_at = now()
  FROM new_code AS n
  WHERE c.company_id = 'ff484ad2-375d-416e-86fa-95e01f2b1323'::uuid
    AND EXISTS (
      SELECT 1 FROM public.companies AS co
      WHERE co.id = c.company_id AND co.name = 'Inthon'
    )
  RETURNING c.company_id, c.expires_at
)
SELECT c.company_id, n.raw AS join_code, c.expires_at
FROM changed AS c CROSS JOIN new_code AS n;
