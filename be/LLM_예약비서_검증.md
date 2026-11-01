# 업무 상태·알림 예약 비서 검증 기록

2026-11-01. 전달 문서의 코드 블록을 임시 파일로 추출하여 실제로 실행했다. 운영 Supabase와 DeepSeek에는 접속하지 않았다. 테스트용 컨테이너는 외부 네트워크를 차단했다.

## 결과

- PostgreSQL 17: 기존 001 → 기존 시나리오 → 004 → 005 → 006 위에 009를 설치하고 **21개 시나리오 묶음 통과**.
- Node 22: Edge 코드와 Auth/REST/LLM 응답 모형을 사용한 **12개 테스트 통과**.
- SQL에서는 실제 PostgreSQL 역할 전환·RLS·트랜잭션·두 세션 동시 실행을 검증했다. Edge의 모형 테스트를 실제 Supabase HTTP 통신 검증으로 보지 않는다.
- 검증용 임시 파일 3개를 삭제했고 테스트용 PostgreSQL 컨테이너가 남아 있지 않음을 확인했다. Node 컨테이너도 종료 시 자동 삭제했다. 전달용 MD 4개만 저장소에 추가했다.

| 요구 시나리오 | 검증 결과 |
|---|---|
| 정상 자연어 → 초안 | Edge preview, 확인 토큰 해시, 실제 예약/상태 변경 없음 |
| 오전/오후 모호, 종료 없음, 복원 불명확 | clarification, 결정적 모호성 검사에서 LLM 호출 안 함 |
| 이미 지난 시각 | clarification. 다음 날로 자동 변경하지 않음 |
| 지원하지 않는 기능·주입·20자 제한 | Edge와 DB의 키/열거형/길이 검증에서 거부 |
| 타 사용자/타 회사 초안 | RLS 조회 0건, 확인 RPC 거부 |
| 초안 수정 후 이전 확인 | 버전 충돌, 이전 확인 토큰 무효 |
| 중복·동시 확인 | DB 두 세션 경쟁 후 예약 1개, 기존 결과 재사용 |
| 기간 중복·멱등키 재사용·만료 | 각각 거부, 인접 구간은 허용 |
| 시작·종료·이전 설정 복원 | 원래 꺼져 있던 알림도 꺼짐으로 복원, 반복 tick 중복 실행 없음 |
| 실행 전/중 수동 변경 | 시작 전 전체 실행 차단, 시작 후 변경된 항목만 복원 제외 |
| 값을 바꾸었다가 원래 값으로 수동 변경 | revision으로 감지하여 복원하지 않음 |
| 퇴근·임시 이동 | 자동 출근/금지 메시지 복원 없음, 임시 이동 중 상태 예약 거부 |
| 감각값·좌석 | 예약 실행/복원에서 변경하지 않음 |
| 계정 재연결 | 기존 예약 실행 거부, 소유권 제한 유지 |
| LLM 키 누락·HTTP 실패·비정상/잘린 JSON·tool call | 성공 응답 없음, 예약 등록 없음, 키 비노출 |
| 타임아웃·크기 제한 | 상위 호출 중단, 과대 body 거부 |
| 시작 중 일부 DB 쓰기 실패 | 같은 단계의 상태/알림 변경 전체 롤백, 재시도 후 정상 실행 |
| 복원 실패 | 최대 3회, 앞 예약 복원 중 다음 예약 대기, 최종 실패 시 기존 후속 예약 차단 |
| 취소·keep·직원 삭제 | 대기 취소, 실행 중 승인된 규칙 적용, keep 유지, FK 정리 |
| 좌석 변경 알림 설정 | 꺼짐일 때 새 알림 미생성, 켜짐이면 기존 알림 생성 |
| 분당/일일 호출 제한 | 8회/80회 후 거부 |

## 실제 환경에서 남은 확인

사용자가 007·008을 운영 DB에 적용했다고 보고했지만 이 저장소에 해당 실행 SQL이 없어 동일성을 직접 검증하지 않았다. 009 테스트는 저장소에 있는 001/004/005/006 기반이며 user_id 재연결 상황을 별도로 모사했다. 운영 007의 RLS/함수 정의는 적용 전 읽기 전용 확인이 필요하다.

실제 DeepSeek 모델·Chat Completions 응답, Secrets, Supabase JWT 게이트웨이/익명 Auth, PostgREST 오류 매핑, Dashboard 배포, pg_cron 설치·역할·실행 이력, FE 버튼 연동은 아직 실환경 미검증이다. [연동과 적용](./LLM_예약비서_연동과적용.md)의 순서로 사용자가 확인한다. 프롬프트만으로 자연어 해석 정확성을 증명한 것은 아니며 실제 요청 사례 검증도 필요하다.

## 재현 방법

아래 테스트 코드는 **로컬 전용이며 Supabase SQL Editor에 넣지 않는다.** Python, Docker, 로컬 캐시의 `postgres:17-alpine`, Node 22 이미지가 필요하다. 저장소 루트에서 실행한다. 저장소의 `be/tests/bootstrap.sql`은 가짜 auth/storage를 만들기 때문에 운영 DB에서 실행하면 안 된다.

첫 Python 블록을 임시 폴더의 `sensory_assistant_test.py`로 저장하고 `python -B <임시 경로>`로 실행한다. 임의 이름의 네트워크 차단 컨테이너를 만들며 finally에서 자기 컨테이너만 제거한다. 기존 `be/tests/run_sql_checks.py`의 로컬 DB 도우미를 재사용한다.

두 번째 JavaScript 블록을 같은 임시 폴더의 `sensory_assistant_edge_test.mjs`로 저장하고, [Edge 문서](./LLM_예약비서_Edge.md)의 첫 javascript 블록만 `assistant.mjs`로 복사한다. Node 22에서 `node --test <임시 폴더>/sensory_assistant_edge_test.mjs`로 실행한다. FE 폴더에 설치할 패키지는 없다. 테스트 후 본인이 만든 임시 파일만 삭제한다.

```python
from pathlib import Path
import sys,subprocess,time,json,re,uuid,traceback
sys.path.insert(0,str(Path('be/tests').resolve()))
import run_sql_checks as b
b.CONTAINER='sensory-assistant-test-'+str(time.time_ns())
b.TEST_DB='assistant_test'
E=lambda n:f"40000000-0000-4000-8000-{n:012}"
U=lambda n:f"00000000-0000-4000-8000-{n:012}"
Q=lambda o:"'"+json.dumps(o,ensure_ascii=False).replace("'","''")+"'::jsonb"
def sql(q,check=True):return b.sql(q,check)
def scalar(q):return sql(q).stdout.strip().splitlines()[-1]
def call(n,q):return sql(b.session(n,q)).stdout.strip().splitlines()[-1]
def obj(n,q):return json.loads(call(n,q))
def err(n,q,text):
 r=sql(b.session(n,q),False);assert r.returncode and text in r.stderr,(text,r.stderr)
def ok(q,label):assert scalar(q)=='t',label
def clear():
 sql("DELETE FROM public.assistant_reservations; DELETE FROM public.assistant_drafts; DELETE FROM private.assistant_rate_limits;")
def working(n=1):
 call(n,f"SELECT public.set_employee_status('{E(n)}','working');")
def proposal(changes=None,offset=600,duration=3600,restore='restore_previous'):
 return json.loads(scalar("SELECT jsonb_build_object('starts_at',clock_timestamp()+interval '"+str(offset)+" seconds','ends_at',clock_timestamp()+interval '"+str(offset+duration)+" seconds','restore','"+restore+"','changes',"+Q(changes or {'attendance':{'status':'away','away_reason':'meeting','away_reason_text':None},'notifications':{'seat_changed_enabled':False}})+");"))
def begin(n=1,d=None,ver=None):
 return obj(n,"SELECT public.assistant_begin_draft('test request',"+("'"+d+"'" if d else "NULL")+","+(str(ver) if ver else "NULL")+");")['draft']
TOKEN='a'*64
def finish(d,p,n=1):
 r=sql("BEGIN; SET LOCAL ROLE service_role; SELECT public.assistant_finish_draft('"+U(n)+"','"+d['id']+"',"+str(d['version'])+","+Q({'kind':'preview','questions':[],'proposal':p})+",'"+__import__('hashlib').sha256(TOKEN.encode()).hexdigest()+"'); COMMIT;")
 return json.loads(r.stdout.strip().splitlines()[-1])
def confsql(d,key=None,token=TOKEN,confirmed=True):
 return "SELECT public.assistant_confirm_draft('"+d['id']+"',"+str(d['version'])+",'"+token+"','"+(key or str(uuid.uuid4()))+"',"+str(confirmed).lower()+");"
def reserve(p=None,n=1):
 d=begin(n);finish(d,p or proposal(),n);return obj(n,confsql(d)),d
def tick(t):return json.loads(scalar("SELECT private.assistant_tick('"+t+"'::timestamptz);"))
def res(r):return json.loads(scalar("SELECT to_jsonb(r) FROM public.assistant_reservations r WHERE id='"+r['id']+"';"))
def snap(n=1):return json.loads(scalar(f"SELECT private.assistant_snapshot('{E(n)}');"))
def passed(label):print('PASS: '+label,flush=True)
try:
 subprocess.run(['docker','run','--detach','--rm','--network','none','--name',b.CONTAINER,'-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:17-alpine'],check=True,capture_output=True)
 for _ in range(120):
  if subprocess.run(['docker','exec',b.CONTAINER,'pg_isready','-h','127.0.0.1','-U','postgres'],capture_output=True).returncode==0:break
  time.sleep(.2)
 subprocess.run(['docker','exec',b.CONTAINER,'createdb','-U','postgres',b.TEST_DB],check=True)
 for name in ['tests/bootstrap.sql','001_sensespace_init.sql','tests/scenarios.sql','004_screen_features.sql','005_avatar_catalog.sql','006_seat_movement.sql']:
  sql((Path('be')/name).read_text(encoding='utf-8'))
 migration=re.search(r'\x60\x60\x60sql\n(.*?)\n\x60\x60\x60',next(Path('be').glob('LLM_*SQL.md')).read_text(encoding='utf-8'),re.S)[1]
 sql(migration);passed('009 installs over existing 001/004/005/006 with data retained')
 r=sql(migration,False);assert r.returncode and 'duplicate key' in r.stderr
 passed('repeat migration rolls back at version guard')
 working();working(2);working(3)
 d=begin();p=proposal();finish(d,p)
 assert scalar("SELECT count(*)=0 FROM public.assistant_reservations;")=='t'
 assert snap()['attendance']['status']=='working'
 for n in (2,3):
  assert call(n,"SELECT count(*) FROM public.assistant_drafts;")=='0'
  err(n,confsql(d),'DRAFT_NOT_FOUND')
 err(1,"SELECT public.assistant_finish_draft('"+U(1)+"','"+d['id']+"',1,'{}',NULL);",'permission denied')
 err(1,"SELECT private.assistant_tick();",'permission denied')
 err(1,"UPDATE public.assistant_drafts SET state='confirmed';",'permission denied')
 err(1,"SELECT * FROM private.assistant_confirmations;",'permission denied')
 err(1,confsql(d,confirmed=False),'CONFIRMATION_REQUIRED')
 err(1,confsql(d,token='b'*64),'INVALID_CONFIRMATION')
 passed('preview has no effects; ownership/RLS/private RPC/confirmation boundary')
 old=d;d=begin(d=d['id'],ver=1)
 err(1,confsql(old),'VERSION_CONFLICT')
 err(1,confsql(d),'INVALID_CONFIRMATION')
 finish(d,p);key=str(uuid.uuid4())
 b.race(b.session(1,confsql(d,key),1),b.session(1,confsql(d,key)))
 rr=obj(1,confsql(d))
 assert scalar('SELECT count(*) FROM public.assistant_reservations;')=='1'
 passed('draft revision invalidates proof; concurrent/duplicate confirmation creates one reservation')
 d2=begin();finish(d2,p);err(1,confsql(d2),'OVERLAP')
 d3=begin();p3=proposal(offset=5000);finish(d3,p3);err(1,confsql(d3,key),'IDEMPOTENCY_CONFLICT')
 sql("UPDATE public.assistant_drafts SET expires_at=now()-interval '1 second' WHERE id='"+d3['id']+"';")
 err(1,confsql(d3),'DRAFT_EXPIRED')
 passed('overlap, idempotency-key reuse and expiry rejected')
 clear();working()
 original=snap();r,d=reserve()
 tick(r['starts_at']);assert res(r)['state']=='running'
 assert snap()['attendance']['status']=='away'
 assert snap()['notifications']['seat_changed_enabled'] is False
 assert snap()['manual']==original['manual']
 tick(r['starts_at']);assert res(r)['start_attempts']==1
 tick(r['ends_at']);assert res(r)['state']=='completed'
 assert snap()['attendance']==original['attendance']
 assert snap()['notifications']==original['notifications']
 tick(r['ends_at']);assert res(r)['end_attempts']==1
 passed('start/end restores actual prior state and is idempotent; worker revisions distinguished')
 clear();working()
 call(1,"SELECT public.assistant_set_notification_preferences(false);")
 r,d=reserve();tick(r['starts_at']);tick(r['ends_at'])
 assert snap()['notifications']['seat_changed_enabled'] is False
 call(1,"SELECT public.assistant_set_notification_preferences(true);")
 passed('restore respects originally muted notification setting')
 clear();working()
 r,d=reserve();call(1,f"SELECT public.set_employee_status('{E(1)}','away','lunch');")
 tick(r['starts_at']);assert res(r)['error_code']=='STATE_CHANGED_BEFORE_START'
 clear();working();r,d=reserve();tick(r['starts_at'])
 call(1,f"SELECT public.set_employee_status('{E(1)}','away','lunch');")
 tick(r['ends_at']);assert res(r)['state']=='completed_conflict'
 assert snap()['attendance']['away_reason']=='lunch'
 assert snap()['notifications']['seat_changed_enabled'] is True
 passed('manual changes before start block; manual during execution preserved per group')
 clear();working();r,d=reserve(proposal({'status_message':'meeting','attendance':{'status':'away','away_reason':'meeting','away_reason_text':None}}))
 tick(r['starts_at']);call(1,f"SELECT public.set_employee_status('{E(1)}','off_work');")
 tick(r['ends_at']);assert snap()['attendance']['status']=='off_work' and snap()['status_message']==''
 assert res(r)['state']=='completed_conflict'
 passed('manual checkout never auto-checks-in or restores forbidden message')
 clear();working()
 r,d=reserve(proposal({'notifications':{'seat_changed_enabled':False}}));tick(r['starts_at'])
 call(1,"SELECT public.assistant_set_notification_preferences(true);")
 call(1,"SELECT public.assistant_set_notification_preferences(false);")
 tick(r['ends_at']);assert res(r)['state']=='completed_conflict' and not snap()['notifications']['seat_changed_enabled']
 passed('change-then-change-back still invalidates restore')
 clear();working()
 r,d=reserve();obj(1,"SELECT public.assistant_cancel_reservation('"+r['id']+"');")
 tick(r['ends_at']);assert res(r)['state']=='cancelled' and snap()['attendance']['status']=='working'
 r,d=reserve();tick(r['starts_at']);obj(1,"SELECT public.assistant_cancel_reservation('"+r['id']+"');")
 tick(r['starts_at']);assert res(r)['state']=='cancelled' and snap()['attendance']['status']=='working'
 passed('queued cancellation and running cancellation with approved restore')
 clear();working()
 p=proposal();r,d=reserve(p)
 p2={**p,'starts_at':p['ends_at'],'ends_at':json.loads(scalar("SELECT to_jsonb('"+p['ends_at']+"'::timestamptz+interval '1 hour');"))}
 r2,d2=reserve(p2);tick(r['starts_at']);tick(r['ends_at'])
 assert res(r)['state']=='completed' and res(r2)['state']=='running'
 tick(r2['ends_at']);assert res(r2)['state']=='completed' and snap()['attendance']['status']=='working'
 passed('adjacent reservations execute end before start without false manual conflict')
 clear();working()
 sql("CREATE TABLE tests.fail_flag(enabled boolean); INSERT INTO tests.fail_flag VALUES(true); CREATE FUNCTION tests.inject_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF (SELECT enabled FROM tests.fail_flag) THEN RAISE EXCEPTION 'test-only'; END IF; RETURN NEW; END $$; CREATE TRIGGER z_test_failure BEFORE UPDATE ON public.employee_notification_preferences FOR EACH ROW EXECUTE FUNCTION tests.inject_failure();")
 r,d=reserve();tick(r['starts_at'])
 assert res(r)['state']=='queued' and res(r)['start_attempts']==1
 assert snap()['attendance']['status']=='working'
 sql("UPDATE tests.fail_flag SET enabled=false;")
 t=scalar("SELECT next_attempt_at FROM public.assistant_reservations WHERE id='"+r['id']+"';");tick(t)
 assert res(r)['state']=='running' and res(r)['start_attempts']==2
 sql("UPDATE tests.fail_flag SET enabled=true;");tick(r['ends_at'])
 assert res(r)['state']=='running' and snap()['attendance']['status']=='away'
 for _ in range(2):
  t=scalar("SELECT next_attempt_at FROM public.assistant_reservations WHERE id='"+r['id']+"';");tick(t)
 assert res(r)['state']=='failed' and res(r)['end_attempts']==3
 sql("DROP TRIGGER z_test_failure ON public.employee_notification_preferences;")
 passed('atomic rollback on partial writes, start retry recovery, restore retries bounded at 3')
 clear();working()
 r,d=reserve();tick(r['ends_at']);assert res(r)['state']=='expired'
 clear();working()
 r,d=reserve()
 sql("UPDATE public.employees SET user_id='"+U(8)+"' WHERE id='"+E(1)+"';")
 tick(r['starts_at']);assert res(r)['error_code']=='AUTH_BINDING_CHANGED'
 sql("UPDATE public.employees SET user_id='"+U(1)+"' WHERE id='"+E(1)+"';")
 passed('missed execution window expires; anonymous-account rebinding invalidates reservation')
 clear();working()
 call(1,"SELECT public.assistant_set_notification_preferences(false);")
 sql("DELETE FROM public.notifications WHERE employee_id='"+E(1)+"';")
 call(1,f"SELECT public.choose_seat('{E(1)}',NULL);")
 assert scalar("SELECT count(*) FROM public.notifications WHERE employee_id='"+E(1)+"';")=='0'
 call(1,"SELECT public.assistant_set_notification_preferences(true);")
 call(1,f"SELECT public.choose_seat('{E(1)}','30000000-0000-4000-8000-000000000001');")
 assert scalar("SELECT count(*) FROM public.notifications WHERE employee_id='"+E(1)+"';")=='1'
 passed('existing own seat-change event obeys only supported preference')
 clear()
 for _ in range(8):begin()
 err(1,"SELECT public.assistant_begin_draft('blocked');",'RATE_LIMITED')
 sql("UPDATE private.assistant_rate_limits SET window_at=now()-interval '2 minutes',daily_count=80;")
 err(1,"SELECT public.assistant_begin_draft('blocked daily');",'RATE_LIMITED')
 passed('inference 8/minute and 80/KST-day limits')
 clear();working()
 for changes in [
 {'status_message':'x'*21},
 {'attendance':{'status':'away','away_reason':'meeting','away_reason_text':'other'}},
 {'notifications':{'everyone':False}},
 {'attendance':{'status':'off_work','away_reason':None,'away_reason_text':None}},
 {'user_id':U(2)}]:
  d=begin();r=sql("SELECT public.assistant_finish_draft('"+U(1)+"','"+d['id']+"',1,"+Q({'kind':'preview','proposal':proposal(changes)})+",repeat('a',64));",False)
  assert r.returncode,r.stdout
 passed('strict DB revalidation rejects 21-char text, mixed reasons, unsupported notifications/status/identity')

 clear();working()
 # An adjacent start must wait if the previous end transaction needs a retry.
 r,d=reserve();p2={**r['proposal'],'starts_at':r['ends_at'],'ends_at':json.loads(scalar("SELECT to_jsonb('"+r['ends_at']+"'::timestamptz+interval '1 hour');"))}
 r2,d2=reserve(p2);tick(r['starts_at'])
 sql("CREATE TRIGGER z_test_failure BEFORE UPDATE ON public.employee_notification_preferences FOR EACH ROW EXECUTE FUNCTION tests.inject_failure(); UPDATE tests.fail_flag SET enabled=true;")
 tick(r['ends_at']);assert res(r)['state']=='running' and res(r2)['state']=='queued' and res(r2)['error_code']=='WAITING_FOR_PREVIOUS_RESTORE'
 sql("UPDATE tests.fail_flag SET enabled=false;")
 t=scalar("SELECT next_attempt_at FROM public.assistant_reservations WHERE id='"+r['id']+"';");tick(t)
 assert res(r)['state']=='completed' and res(r2)['state']=='running'
 tick(r2['ends_at']);sql("DROP TRIGGER z_test_failure ON public.employee_notification_preferences;")
 passed('adjacent execution waits for retrying restore')
 clear();working()
 r,d=reserve();p2={**r['proposal'],'starts_at':r['ends_at'],'ends_at':json.loads(scalar("SELECT to_jsonb('"+r['ends_at']+"'::timestamptz+interval '1 hour');"))};r2,d2=reserve(p2);tick(r['starts_at'])
 sql("CREATE TRIGGER z_test_failure BEFORE UPDATE ON public.employee_notification_preferences FOR EACH ROW EXECUTE FUNCTION tests.inject_failure(); UPDATE tests.fail_flag SET enabled=true;")
 tick(r['ends_at'])
 for _ in range(2):
  t=scalar("SELECT next_attempt_at FROM public.assistant_reservations WHERE id='"+r['id']+"';");tick(t)
 assert res(r)['state']=='failed' and res(r2)['error_code']=='PREVIOUS_RESTORE_FAILED'
 sql("DROP TRIGGER z_test_failure ON public.employee_notification_preferences;")
 passed('terminal restore failure blocks already-approved following reservation')
 clear();working()
 # Temporary movement cannot be hidden inside an assistant attendance update.
 sql("INSERT INTO public.seats(company_id,floor_id,label,x_ratio,y_ratio) VALUES('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','A3',.7,.7);")
 seat=scalar("SELECT id FROM public.seats WHERE label='A3';")
 call(1,f"SELECT public.set_current_sensations('{E(1)}','"+'{"noise_level":4}'+"');")
 r,d=reserve();tick(r['starts_at']);assert scalar(f"SELECT noise_level FROM public.current_sensations WHERE employee_id='{E(1)}';")=='4'
 tick(r['ends_at']);assert scalar(f"SELECT noise_level FROM public.current_sensations WHERE employee_id='{E(1)}';")=='4'
 clear();call(1,f"SELECT public.move_to_seat('{E(1)}','{seat}');")
 d=begin();r=sql("SELECT public.assistant_finish_draft('"+U(1)+"','"+d['id']+"',1,"+Q({'kind':'preview','proposal':proposal()})+",repeat('a',64));",False)
 assert 'RETURN_REQUIRED' in r.stderr
 call(1,f"SELECT public.return_to_seat('{E(1)}');")
 passed('assistant never moves seats or resets sensations; moving attendance rejected')
 clear();working()
 r,d=reserve(proposal(restore='keep'));tick(r['starts_at']);tick(r['ends_at'])
 assert snap()['attendance']['status']=='away' and res(r)['result']['mode']=='keep'
 clear();working();r,d=reserve()
 sql("UPDATE public.assistant_drafts SET expires_at=now()+interval '1 minute' WHERE id='"+d['id']+"';")
 sql(f"DELETE FROM public.employees WHERE id='{E(1)}';")
 assert scalar("SELECT count(*) FROM public.assistant_reservations;")=='0'
 passed('keep mode and employee cascade cleanup')

 print('ALL SQL TESTS PASSED',flush=True)
except Exception:
 traceback.print_exc();sys.exitcode=1
finally:
 subprocess.run(['docker','rm','--force',b.CONTAINER],capture_output=True)
sys.exit(getattr(sys,'exitcode',0))

```

```javascript
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHandler,validateResult,clarificationGuard,requestJSON} from './assistant.mjs';
const UID='00000000-0000-4000-8000-000000000001', DID='50000000-0000-4000-8000-000000000001', RID='60000000-0000-4000-8000-000000000001';
const context={server_now:'2026-11-01T00:00:00Z',timezone:'Asia/Seoul',state:{attendance:{status:'working',away_reason:null,away_reason_text:null},status_message:'',quick_emoji_id:null,notifications:{seat_changed_enabled:true},is_moving:false},capabilities:{away_reasons:['meeting','lunch','outside'],emoji_ids:['coffee'],notification_keys:['seat_changed_enabled']}};
const proposal={starts_at:'2026-11-01T14:00:00+09:00',ends_at:'2026-11-01T15:00:00+09:00',restore:'restore_previous',changes:{attendance:{status:'away',away_reason:'meeting',away_reason_text:null},notifications:{seat_changed_enabled:false}}};
const preview=()=>({kind:'preview',questions:[],proposal:structuredClone(proposal)});
const text='오늘 오후 2시부터 3시까지 회의니까 알림 다 끄고 미팅 중으로 바꿔줘. 끝나면 원래대로 해줘.';
function mock(opts={}){
 const calls=[], finishes=[];
 const envValues={SUPABASE_URL:'https://project.example',SUPABASE_ANON_KEY:'anon-test',SUPABASE_SERVICE_ROLE_KEY:'service-test',LLM_BASE_URL:'https://llm.example',LLM_API_KEY:'secret-test',LLM_MODEL:'configured-model',...opts.env};
 let chatCalls=0;
 const fetchImpl=async(url,init={})=>{
  const body=init.body?JSON.parse(init.body):null;
  calls.push({url,headers:init.headers,body});
  const response=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
  if(url.endsWith('/auth/v1/user'))return response({id:UID},opts.authStatus||200);
  if(url.includes('/rpc/assistant_begin_draft')){
   if(opts.beginError)return response({message:opts.beginError},400);
   return response({draft:{id:DID,version:body.p_version?body.p_version+1:1,messages:[{role:'user',content:body.p_text}],proposal:opts.previous||null},context:opts.context||context});
  }
  if(url.includes('/rpc/assistant_finish_draft')){
   assert.equal(init.headers.Authorization,'Bearer service-test');
   assert.equal(body.p_user_id,UID);
   finishes.push(body);
   if(opts.finishError)return response({message:opts.finishError},400);
   return response({id:DID,version:body.p_version,state:body.p_result.kind,proposal:body.p_result.proposal||null});
  }
  if(url.includes('/rpc/assistant_confirm_draft')){
   assert.equal(init.headers.Authorization,'Bearer user-jwt');
   if(opts.confirmError)return response({message:opts.confirmError},400);
   return response({id:RID,state:'queued'});
  }
  if(url.includes('/rpc/assistant_cancel_draft'))return response({id:DID,state:'cancelled'});
  if(url.includes('/rpc/assistant_cancel_reservation'))return response({id:RID,state:'running',cancel_requested:true});
  if(url.endsWith('/models'))return response({data:[{id:opts.modelMissing?'other-model':'configured-model'}]});
  if(url.endsWith('/chat/completions')){
   chatCalls++;
   if(opts.providerThrows)throw new Error('secret-test provider failure');
   if(opts.fallback&&chatCalls===1)return response({error:{message:'response_format not supported'}},400);
   if(opts.providerStatus)return response({error:{message:'secret-test unauthorized'}},opts.providerStatus);
   if(opts.badJSON)return new Response('not json',{status:200});
   return response({choices:[{finish_reason:opts.finishReason||'stop',message:{content:opts.content??JSON.stringify(body.max_tokens===512?{ok:true}:opts.result||preview()),...(opts.toolCalls?{tool_calls:[{}]}:{})}}]});
  }
  if(url.includes('/assistant_drafts?'))return response(opts.notFound?[]:[{id:DID,state:'preview'}]);
  if(url.includes('/assistant_reservations?'))return response(opts.notFound?[]:[{id:RID,state:'queued'}]);
  throw new Error('Unexpected URL '+url);
 };
 const handler=createHandler({env:k=>envValues[k],fetchImpl});
 const request=async(body,headers={})=>{
  const r=await handler(new Request('https://project.example/functions/v1/sensory-assistant',{method:'POST',headers:{Authorization:'Bearer user-jwt','Content-Type':'application/json',...headers},body:JSON.stringify(body)}));
  return {status:r.status,data:await r.json(),headers:r.headers};
 };
 return {handler,request,calls,finishes,get chatCalls(){return chatCalls;}};
}
test('normal natural language creates preview only; trusted IDs and hashed proof',async()=>{
 const m=mock();const r=await m.request({action:'interpret',text});
 assert.equal(r.status,200);assert.equal(r.data.kind,'preview');assert.match(r.data.confirmation_token,/^[0-9a-f]{64}$/);
 assert.notEqual(m.finishes[0].p_confirmation_hash,r.data.confirmation_token);
 assert.equal(m.finishes[0].p_confirmation_hash,Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(r.data.confirmation_token))).toString('hex'));
 assert.equal(m.calls.filter(x=>x.url.includes('confirm_draft')).length,0);
 const llm=m.calls.find(x=>x.url.endsWith('/chat/completions'));
 assert.ok(llm.body.messages[0].content.includes('Asia/Seoul'));
 assert.ok(!JSON.stringify(llm.body).includes(UID));assert.ok(!JSON.stringify(r.data).includes('secret-test'));
});
test('ambiguous AM/PM, missing end and restoration produce clarification without provider call',async()=>{
 for(const [text,pattern] of [['오늘 2시부터 3시 회의 원래대로 해줘',/오전/],['오늘 오후 2시 회의 원래대로 해줘',/종료/],['오늘 오후 2시부터 3시 회의',/복원/]]){
  const m=mock();const r=await m.request({action:'interpret',text});assert.equal(r.data.kind,'clarification');assert.equal(m.chatCalls,0);assert.match(m.finishes[0].p_result.questions.join(),pattern);
 }
});
test('revision retains explicit previous duration/restoration',()=>{
 assert.deepEqual(clarificationGuard([{content:'메시지만 수정해 줘'}],proposal),[]);
});
test('past date is clarification, never silently moved to tomorrow',async()=>{
 const bad=preview();bad.proposal.starts_at='2026-10-31T14:00:00+09:00';
 const m=mock({result:bad});const r=await m.request({action:'interpret',text});assert.equal(r.data.kind,'clarification');assert.match(m.finishes[0].p_result.questions[0],/지났/);
});
test('unsupported notification, injected identity/confirmation, 21 chars, conflicting reasons and invalid dates rejected',()=>{
 const variants=[];
 let p=preview();p.proposal.changes.notifications={company_all:false};variants.push(p);
 p=preview();p.user_id=UID;variants.push(p);
 p=preview();p.confirmed=true;variants.push(p);
 p=preview();p.proposal.changes.status_message='가'.repeat(21);variants.push(p);
 p=preview();p.proposal.changes.attendance.away_reason_text='회의';variants.push(p);
 p=preview();p.proposal.starts_at='2026-02-30T14:00:00+09:00';variants.push(p);
 p=preview();p.proposal.changes.attendance.status='off_work';variants.push(p);
 p=preview();p.proposal.changes.quick_emoji_id='admin';variants.push(p);
 for(const v of variants)assert.throws(()=>validateResult(v,context));
 assert.doesNotThrow(()=>validateResult({...preview(),proposal:{...proposal,changes:{status_message:'가'.repeat(20)}}},context));
});
test('off-work and temporary movement require user action, no auto-checkin',async()=>{
 for(const c of [{...context,state:{...context.state,attendance:{status:'off_work'}}},{...context,state:{...context.state,is_moving:true}}]){
  const m=mock({context:c});const r=await m.request({action:'interpret',text});assert.equal(r.data.kind,'clarification');
 }
});
test('missing secret and provider failures never report reservation success or leak secrets',async()=>{
 for(const opts of [{env:{LLM_API_KEY:''}},{providerStatus:401},{providerThrows:true},{badJSON:true},{content:'not json'},{finishReason:'length'},{toolCalls:true}]){
  const m=mock(opts),r=await m.request({action:'interpret',text});assert.ok(r.status>=400);assert.equal(r.data.reserved,false);assert.ok(!JSON.stringify(r.data).includes('secret-test'));assert.ok(!m.calls.some(x=>x.url.includes('confirm_draft')));
 }
});
test('confirmation separate and explicit; errors and stale version propagated; no inference on confirm',async()=>{
 let m=mock(),r=await m.request({action:'confirm',draft_id:DID,version:1,confirmation_token:'a'.repeat(64),idempotency_key:RID,confirmed:false});assert.equal(r.status,400);
 for(const code of ['ASSISTANT_VERSION_CONFLICT','ASSISTANT_DRAFT_NOT_FOUND','ASSISTANT_OVERLAP']){
  m=mock({confirmError:code});r=await m.request({action:'confirm',draft_id:DID,version:1,confirmation_token:'a'.repeat(64),idempotency_key:RID,confirmed:true});assert.ok(r.status>=400);assert.equal(r.data.error_code,code);assert.equal(m.chatCalls,0);
 }
 m=mock();r=await m.request({action:'confirm',draft_id:DID,version:1,confirmation_token:'a'.repeat(64),idempotency_key:RID,confirmed:true});assert.equal(r.data.message,'예약했어요.');assert.equal(m.chatCalls,0);
});
test('revision API version forwarded; cancellation and owner-scoped query flow',async()=>{
 const m=mock({previous:proposal});
 const r=await m.request({action:'revise',draft_id:DID,version:1,text:'메시지만 수정해 줘'});assert.equal(r.data.draft.version,2);
 assert.equal((await m.request({action:'cancel_draft',draft_id:DID,version:2})).data.kind,'cancelled');
 assert.equal((await m.request({action:'cancel_reservation',reservation_id:RID})).data.kind,'cancel_requested');
 assert.equal((await m.request({action:'get_draft',draft_id:DID})).data.id,DID);
 assert.equal((await m.request({action:'get_reservation',reservation_id:RID})).data.id,RID);
 assert.equal((await m.request({action:'list_reservations'})).data.reservations.length,1);
 assert.equal((await mock({notFound:true}).request({action:'get_draft',draft_id:DID})).status,404);
});
test('rate limit enforced before provider, caller identity rejected, CORS and request limit',async()=>{
 const m=mock({beginError:'ASSISTANT_RATE_LIMITED'});
 assert.equal((await m.request({action:'interpret',text})).status,429);assert.equal(m.chatCalls,0);
 assert.equal((await mock().request({action:'interpret',text,user_id:UID})).status,400);
 assert.equal((await mock().request({action:'interpret',text:'가'.repeat(5000)})).status,413);
 assert.equal((await mock().request({action:'interpret',text},{Origin:'https://evil.example'})).status,403);
 assert.equal((await mock({authStatus:401}).request({action:'interpret',text})).status,401);
 const p=await mock().handler(new Request('https://project.example',{method:'OPTIONS',headers:{Origin:'http://localhost:5173'}}));assert.equal(p.status,204);
});
test('provider probe verifies models and endpoint; response_format fallback only on explicit 400',async()=>{
 for(const opts of [{},{fallback:true}]){
  const m=mock(opts),r=await m.request({action:'provider_check'});
  assert.equal(r.data.ready,true);assert.equal(r.data.endpoint,'chat/completions');assert.equal(r.data.format,opts.fallback?'text':'json_object');
  assert.equal(m.chatCalls,opts.fallback?2:1);
 }
 const m=mock({modelMissing:true});assert.equal((await m.request({action:'provider_check'})).data.error_code,'LLM_MODEL_NOT_AVAILABLE');assert.equal(m.chatCalls,0);
 const bad=mock({providerStatus:401});await bad.request({action:'provider_check'});assert.equal(bad.chatCalls,1);
});
test('outbound timeout and bounded upstream body',async()=>{
 const hanging=(_,init)=>new Promise((_,reject)=>init.signal.addEventListener('abort',()=>reject(new Error('aborted'))));
 await assert.rejects(requestJSON(hanging,'https://example.test',{},32768,5),e=>e.code==='UPSTREAM_UNAVAILABLE');
 await assert.rejects(requestJSON(async()=>new Response('x'.repeat(100)),'https://example.test',{},10),e=>e.code==='BODY_TOO_LARGE');
});

```
