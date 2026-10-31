"""004/005 migration + regression checks in the local test container only."""
import run_sql_checks as base

base.CONTAINER='sensespace-screen-review'
sql,session,race,ROOT=base.sql,base.session,base.race,base.ROOT

if __name__=='__main__':
    base.subprocess.run(['docker','exec',base.CONTAINER,'createdb','-U','postgres',base.TEST_DB],check=True)
    for path in [ROOT/'tests/bootstrap.sql',ROOT/'001_sensespace_init.sql',ROOT/'tests/scenarios.sql']:
        sql(path.read_text(encoding='utf-8'))
        print(f'PASS: baseline {path.name}',flush=True)
    eid='40000000-0000-4000-8000-000000000001'
    sql(session(1,f"SELECT public.set_employee_status('{eid}','working'); SELECT public.set_status_message('{eid}',repeat('x',21));"))
    migration=(ROOT/'004_screen_features.sql').read_text(encoding='utf-8')
    refused=sql(migration,False)
    assert refused.returncode and 'STATUS_MESSAGES_EXCEED_20_CHARS' in refused.stderr,refused.stderr
    assert sql("SELECT to_regclass('public.employee_avatars') IS NULL;").stdout.strip()=='t'
    assert sql(f"SELECT length(status_message)=21 FROM public.employee_statuses WHERE employee_id='{eid}';").stdout.strip()=='t'
    print('PASS: oversized existing message preserved; migration fully rolled back',flush=True)
    sql(session(1,f"SELECT public.set_status_message('{eid}','short');"))
    sql(migration)
    repeated=sql(migration,False)
    assert repeated.returncode and 'unique constraint' in repeated.stderr,repeated.stderr
    catalog=(ROOT/'005_avatar_catalog.sql').read_text(encoding='utf-8')
    sql(catalog); sql(catalog)
    print('PASS: 004 installed, repeat rejected; 005 catalogue refresh is repeatable',flush=True)
    sql((ROOT/'tests/screen_scenarios.sql').read_text(encoding='utf-8'))
    print('PASS: 20 characters, independent emoji, work info, actual avatar catalogue, ownership, teams, notifications',flush=True)
    sql(catalog)
    records=base.json.loads((ROOT/'avatar_catalog.json').read_text(encoding='utf-8'))
    fields={'hair_style':'hair','hair_color':'hairColor','eye_color':'eye','outfit':'outfit','outfit_color':'color','gender':'gender','special_skin':'skin'}
    checks=[]
    for item in records:
        character=dict(hair=0,hairColor=0,eye=0,gender='f',outfit=0,color=0,skin=None)
        character[fields[item['category_id']]]=item['item_id'] if item['category_id'] in ('gender','special_skin') else item['metadata']['frontend_index']
        body=base.json.dumps(character).replace("'","''")
        checks.append(f"SELECT tests.ok((public.save_character('{eid}','{body}'::jsonb)->'character')='{body}'::jsonb,'catalogue roundtrip');")
    sql(session(1,''.join(checks)))
    print('PASS: all 52 actual FE item choices roundtrip with native character JSON',flush=True)
    sql(session(1,f"SELECT public.set_employee_status('{eid}','working');"))
    for write,label in [(f"SELECT public.set_status_message('{eid}','race');",'message'),
                        (f"SELECT public.set_current_sensations('{eid}','{{\"noise_level\":5}}');",'sensations')]:
        checkout=f"SELECT public.set_employee_status('{eid}','off_work');"
        race(session(1,write,1),session(1,checkout))
        sql(session(1,f"SELECT public.set_employee_status('{eid}','working');"))
        race(session(1,checkout,1),session(1,write),'EMPLOYEE_NOT_WORKING')
        assert sql(f"SELECT status='off_work' AND status_message='' AND num_nonnulls(temperature_level,humidity_level,noise_level,odor_level,discomfort_level,crowd_level)=0 FROM public.employee_statuses JOIN public.current_sensations USING(employee_id) WHERE employee_id='{eid}';").stdout.strip()=='t'
        sql(session(1,f"SELECT public.set_employee_status('{eid}','working');"))
        print(f'PASS: concurrent checkout/{label}, both orders',flush=True)
    race(session(1,f"SELECT public.set_quick_emoji('{eid}','coffee');",1),session(1,f"SELECT public.set_status_message('{eid}','independent');"))
    assert sql(f"SELECT quick_emoji_id='coffee' AND status_message='independent' FROM public.employee_statuses WHERE employee_id='{eid}';").stdout.strip()=='t'
    assert sql("SELECT count(*)=6 FROM information_schema.columns WHERE table_schema='public' AND table_name='current_sensations' AND data_type='smallint';").stdout.strip()=='t'
    print('PASS: simultaneous emoji/message independent; sensations still exactly six',flush=True)
    print('All local checks passed; no remote SQL or AI calls made.',flush=True)
