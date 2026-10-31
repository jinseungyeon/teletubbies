"""Local test container only. No credentials or Supabase network connection."""
from pathlib import Path
import subprocess
from concurrent.futures import ThreadPoolExecutor
import time
import json

ROOT = Path(__file__).resolve().parents[1]
CONTAINER = 'sensespace-sql-review-20261031'
TEST_DB = 'sensespace_check_' + str(time.time_ns())

def sql(query, check=True):
    p = subprocess.run(['docker', 'exec', '-i', CONTAINER, 'psql', '-U', 'postgres', '-d', TEST_DB,
                        '-v', 'ON_ERROR_STOP=1', '-Atq'], input=query,
                       encoding='utf-8', capture_output=True)
    if check and p.returncode:
        raise RuntimeError(p.stderr[-5000:])
    return p

def session(uid, query, delay=0):
    return ("BEGIN; SET LOCAL application_name='sensespace_test_race'; SET LOCAL ROLE authenticated; "
            f"SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-{uid:012}',true); "
            + query + (f'SELECT pg_sleep({delay});' if delay else '') + 'COMMIT;')

def race(first, second, expected_second_error=None):
    # Prove first session reached its sleep after acquiring the relevant locks.
    with ThreadPoolExecutor(max_workers=2) as pool:
        a = pool.submit(sql, first)
        for _ in range(100):
            p = sql("SELECT count(*) FROM pg_stat_activity WHERE application_name='sensespace_test_race' AND wait_event='PgSleep';")
            if int(p.stdout.strip()) > 0:
                break
            if a.done():
                a.result()
                raise AssertionError('First session finished without lock barrier')
            time.sleep(.03)
        else:
            raise AssertionError('Concurrent lock barrier timed out')
        b = pool.submit(sql, second, False)
        a.result()
        out = b.result()
        if expected_second_error:
            assert out.returncode != 0 and expected_second_error in out.stderr, out.stderr
        else:
            assert out.returncode == 0, out.stderr

if __name__ == '__main__':
    subprocess.run(['docker','exec',CONTAINER,'createdb','-U','postgres',TEST_DB],check=True)
    for path in [ROOT/'tests/bootstrap.sql', ROOT/'001_sensespace_init.sql', ROOT/'tests/scenarios.sql']:
        result = sql(path.read_text(encoding='utf-8'))
        print(f'PASS: {path.name}')
    eid = '40000000-0000-4000-8000-000000000001'
    uid2 = '40000000-0000-4000-8000-000000000002'
    sql(session(1, f"SELECT public.set_employee_status('{eid}','working');"))
    # Message then checkout; checkout then message; sensations then checkout; reverse.
    for write, label in [(f"SELECT public.set_status_message('{eid}','race');", 'message'),
                         (f"SELECT public.set_current_sensations('{eid}','{{\"noise_level\":5}}');", 'sensations')]:
        checkout = f"SELECT public.set_employee_status('{eid}','off_work');"
        race(session(1, write, 1), session(1, checkout))
        sql(session(1, f"SELECT public.set_employee_status('{eid}','working');"))
        race(session(1, checkout, 1), session(1, write), 'EMPLOYEE_NOT_WORKING')
        final = sql(f"SELECT status='off_work' AND status_message='' AND noise_level IS NULL FROM public.employee_statuses JOIN public.current_sensations USING(employee_id) WHERE employee_id='{eid}';")
        assert final.stdout.strip() == 't', final.stdout
        sql(session(1, f"SELECT public.set_employee_status('{eid}','working');"))
        print(f'PASS: concurrent checkout/{label}, both orders')
    # Two employees choose the same currently vacant seat.
    sql(session(1, f"SELECT public.choose_seat('{eid}',NULL);"))
    sql(session(2, f"SELECT public.choose_seat('{uid2}',NULL);"))
    seat = '30000000-0000-4000-8000-000000000001'
    race(session(1, f"SELECT public.choose_seat('{eid}','{seat}');", 1),
         session(2, f"SELECT public.choose_seat('{uid2}','{seat}');"), 'SEAT_TAKEN')
    print('PASS: concurrent seat selection')
    # One account concurrently joins different companies.
    race(session(6, "SELECT public.join_company('AAAAAAAAAAAAAAAAAAAAAAAA','Race','');", 1),
         session(6, "SELECT public.join_company('BBBBBBBBBBBBBBBBBBBBBBBB','Race','');"))
    assert sql("SELECT count(*)=1 FROM public.employees WHERE user_id='00000000-0000-4000-8000-000000000006';").stdout.strip() == 't'
    print('PASS: concurrent single-company membership')
    sql("UPDATE private.company_join_codes SET expires_at=now()-interval '1 day' WHERE company_id='10000000-0000-4000-8000-000000000002';")
    p = sql(session(7, "SELECT tests.ok((public.join_company('BBBBBBBBBBBBBBBBBBBBBBBB','Expiry','')->>'error_code')='INVALID_COMPANY_CODE','expired code');"))
    sql("UPDATE private.company_join_codes SET expires_at=NULL,revoked_at=now() WHERE company_id='10000000-0000-4000-8000-000000000002';")
    sql(session(7, "SELECT tests.ok((public.join_company('BBBBBBBBBBBBBBBBBBBBBBBB','Revoked','')->>'error_code')='INVALID_COMPANY_CODE','revoked code');"))
    sql("UPDATE private.company_join_codes SET revoked_at=NULL WHERE company_id='10000000-0000-4000-8000-000000000002';")
    sql("UPDATE private.join_rate_limits SET window_started_at=now()-interval '2 minutes' WHERE user_id='00000000-0000-4000-8000-000000000005';")
    sql(session(5, "SELECT tests.ok((public.join_company('AAAAAAAAAAAAAAAAAAAAAAAA','Reset','')->>'error_code') IS NULL,'rate window resets');"))
    print('PASS: expired/revoked code and rate window reset')
    sql(session(1, f"SELECT tests.raises($q$SELECT public.set_status_message('{eid}',repeat('x',201))$q$,'INVALID_STATUS_MESSAGE');"))
    sql(session(1, f"SELECT tests.raises($q$SELECT public.set_status_message('{eid}',NULL)$q$,'INVALID_STATUS_MESSAGE');"))
    sql(session(1, "SELECT tests.raises('SELECT private.lock_my_status(NULL)','permission denied');"))
    print('PASS: message length/null and private lock helper access')
    sql("INSERT INTO auth.users(id) SELECT ('00000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid FROM generate_series(100,304) i;")
    sql("INSERT INTO public.employees(user_id,company_id,name) SELECT ('00000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'10000000-0000-4000-8000-000000000001','Bulk '||i FROM generate_series(100,304) i;")
    cursor, ids = None, []
    while True:
        after = 'NULL' if cursor is None else f"'{cursor}'::uuid"
        out = sql(session(1, "SELECT coalesce(json_agg(x),'[]'::json) FROM public.get_sensory_cards('10000000-0000-4000-8000-000000000001',NULL," + after + ",50) x;"))
        page = json.loads(out.stdout.strip().splitlines()[-1])
        if not page:
            break
        ids.extend(c['employee_id'] for c in page)
        cursor = page[-1]['employee_id']
    expected = int(sql("SELECT count(*) FROM public.employees WHERE company_id='10000000-0000-4000-8000-000000000001';").stdout.strip())
    assert len(ids) == len(set(ids)) == expected and expected > 200
    print(f'PASS: full cursor pagination across {expected} employees')
    setup = sql((ROOT/'002_company_setup_example.sql').read_text(encoding='utf-8'))
    fields = setup.stdout.strip().split('|')
    coordinates = json.loads((ROOT/'seat_coordinates.json').read_text(encoding='utf-8'))
    assert len(fields[3]) == 24 and int(fields[-1]) == coordinates['seat_count'], fields
    print('PASS: 002_company_setup_example.sql')
    print('All local checks passed. Supabase Auth/Storage HTTP integration still needs a real project.')
