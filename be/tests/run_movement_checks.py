"""Local PostgreSQL only: migration, permissions, movement and concurrency checks."""
import run_sql_checks as base

base.CONTAINER = 'sensespace-movement-review'
sql, session, race, ROOT = base.sql, base.session, base.race, base.ROOT


def eid(n):
    return f'40000000-0000-4000-8000-{n:012}'


def sid(n):
    return f'30000000-0000-4000-8000-{n:012}'


def reset(n):
    sql(session(n, f"SELECT public.set_employee_status('{eid(n)}','off_work');"
                   f"SELECT public.set_employee_status('{eid(n)}','working');"))


def move(n, target):
    return f"SELECT public.move_to_seat('{eid(n)}','{sid(target)}');"


def assert_home(n):
    assert sql(f"SELECT temporary_seat_id IS NULL FROM public.employees WHERE id='{eid(n)}';").stdout.strip() == 't'


if __name__ == '__main__':
    base.subprocess.run(['docker', 'exec', base.CONTAINER, 'createdb', '-U', 'postgres', base.TEST_DB], check=True)
    for filename in ['tests/bootstrap.sql', '001_sensespace_init.sql', 'tests/scenarios.sql',
                     '004_screen_features.sql', '005_avatar_catalog.sql', 'tests/screen_scenarios.sql']:
        sql((ROOT / filename).read_text(encoding='utf-8'))
        print(f'PASS: baseline {filename}', flush=True)
    original = sql("SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM (SELECT id,company_id,seat_id,name FROM public.employees) x;").stdout
    migration = (ROOT / '006_seat_movement.sql').read_text(encoding='utf-8')
    sql(migration)
    assert sql("SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM (SELECT id,company_id,seat_id,name FROM public.employees) x;").stdout == original
    repeated = sql(migration, False)
    assert repeated.returncode and 'unique constraint' in repeated.stderr, repeated.stderr
    print('PASS: migration preserves assigned seats and employees; repeat fully rejected', flush=True)
    sql((ROOT / 'tests/movement_scenarios.sql').read_text(encoding='utf-8'))
    print('PASS: movement, cross-floor return, six NULL values, custom/preset exclusivity, retries and RLS', flush=True)

    reset(11)
    reset(12)
    race(session(11, move(11, 14), 1), session(12, move(12, 14)), 'SEAT_TAKEN')
    assert_home(12)
    print('PASS: two movers, one destination, exactly one winner', flush=True)

    for movement_first in [True, False]:
        reset(11)
        reset(12)
        assign = f"SELECT public.choose_seat('{eid(12)}','{sid(17)}');"
        first = session(11, move(11, 17), 1) if movement_first else session(12, assign, 1)
        second = session(12, assign) if movement_first else session(11, move(11, 17))
        race(first, second, 'SEAT_TAKEN')
        reset(11)
        sql(session(12, f"SELECT public.choose_seat('{eid(12)}','{sid(12)}');"))
    print('PASS: home assignment versus temporary occupancy, both orders', flush=True)

    for movement_first in [True, False]:
        reset(11)
        checkout = f"SELECT public.set_employee_status('{eid(11)}','off_work');"
        race(session(11, move(11, 14) if movement_first else checkout, 1),
             session(11, checkout if movement_first else move(11, 14)),
             None if movement_first else 'EMPLOYEE_NOT_WORKING')
        assert_home(11)
        assert sql(f"SELECT status='off_work' FROM public.employee_statuses WHERE employee_id='{eid(11)}';").stdout.strip() == 't'
    print('PASS: move versus checkout, both orders', flush=True)

    for custom_first in [True, False]:
        reset(11)
        sql(session(11, move(11, 14)))
        custom = f"SELECT public.set_away_reason_text('{eid(11)}','water');"
        back = f"SELECT public.return_to_seat('{eid(11)}');"
        race(session(11, custom if custom_first else back, 1),
             session(11, back if custom_first else custom),
             None if custom_first else 'EMPLOYEE_NOT_AWAY')
        assert sql(f"SELECT status='working' AND away_reason_text IS NULL FROM public.employee_statuses WHERE employee_id='{eid(11)}';").stdout.strip() == 't'
    print('PASS: custom reason versus return, both orders', flush=True)

    for input_first in [True, False]:
        reset(11)
        sql(session(11, move(11, 14)))
        write = f"SELECT public.set_current_sensations('{eid(11)}','{{\"noise_level\":5}}');"
        back = f"SELECT public.return_to_seat('{eid(11)}');"
        race(session(11, write if input_first else back, 1), session(11, back if input_first else write))
        expected = 'noise_level IS NULL' if input_first else 'noise_level=5'
        assert sql(f"SELECT {expected} FROM public.current_sensations WHERE employee_id='{eid(11)}';").stdout.strip() == 't'
    print('PASS: return versus sensation input, both orders', flush=True)

    reset(11)
    race(session(11, move(11, 14), 1), session(11, move(11, 15)))
    assert sql(f"SELECT temporary_seat_id='{sid(15)}' FROM public.employees WHERE id='{eid(11)}';").stdout.strip() == 't'
    assert sql(f"SELECT count(*)=1 FROM private.seat_claims WHERE employee_id='{eid(11)}' AND kind='temporary';").stdout.strip() == 't'
    sql(session(11, f"SELECT public.set_employee_status('{eid(11)}','working');"))
    assert_home(11)
    print('PASS: sequential concurrent moves and legacy working RPC return', flush=True)

    invariant = """
    WITH expected AS (
      SELECT seat_id,id AS employee_id,'assigned'::text AS kind FROM public.employees WHERE seat_id IS NOT NULL
      UNION ALL SELECT temporary_seat_id,id,'temporary' FROM public.employees WHERE temporary_seat_id IS NOT NULL
    ), delta AS (
      (SELECT seat_id,employee_id,kind FROM expected EXCEPT SELECT seat_id,employee_id,kind FROM private.seat_claims)
      UNION ALL
      (SELECT seat_id,employee_id,kind FROM private.seat_claims EXCEPT SELECT seat_id,employee_id,kind FROM expected)
    ) SELECT NOT EXISTS(SELECT 1 FROM delta) AND NOT EXISTS(
      SELECT 1 FROM public.employees e JOIN public.employee_statuses st ON st.employee_id=e.id
      WHERE e.temporary_seat_id IS NOT NULL AND st.status<>'away');
    """
    assert sql(invariant).stdout.strip() == 't'
    print('PASS: final occupancy ledger and movement/status invariants', flush=True)
    print('All local movement checks passed. No remote Supabase changes.', flush=True)
