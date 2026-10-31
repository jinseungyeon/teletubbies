import { validateCharacter, normalizeCharacter } from './character.js';
// Replace this adapter with Supabase calls. UI modules never access storage directly.
export const SENSITIVITY = ['매우 둔감', '둔감', '보통', '민감', '매우 민감'];
export const SENSES = [
  { key: 'temperature', name: '온도', icon: 'temp', color: '#d78b67', labels: ['매우 추움', '추움', '적당함', '더움', '매우 더움'] },
  { key: 'humidity', name: '습도', icon: 'humid', color: '#6c9bb9', labels: ['매우 건조함', '건조함', '적당함', '습함', '매우 습함'] },
  { key: 'noise', name: '소음', icon: 'noise', color: '#cd8294', labels: ['매우 조용함', '조용함', '보통', '시끄러움', '매우 시끄러움'] },
  { key: 'smell', name: '냄새', icon: 'smell', color: '#79a78a', labels: ['없음', '약함', '보통', '강함', '매우 강함'] },
  { key: 'lighting', name: '조명 지수', icon: 'sun', color: '#c9a44c', labels: ['매우 어두움', '어두움', '적당함', '밝음', '매우 밝음'] },
  { key: 'crowding', name: '혼잡도', icon: 'crowd', color: '#8b8da5', labels: ['매우 한산함', '한산함', '보통', '붐빔', '매우 붐빔'] },
];
export const TRAITS = [{key:'visual',name:'시각',icon:'eye'}, {key:'auditory',name:'청각',icon:'ear'}, {key:'olfactory',name:'후각',icon:'nose'}];
export const STATUS = { working: '출근', away: '자리 비움', offline: '퇴근' };
export const REASONS = ['점심', '미팅', '외근'];
export let COMPANY = '온유 스튜디오';
export function setCompanyName(name) {
  if (name) COMPANY = name;
}
// Replaced with the signed-in company's floors once the Supabase adapter loads.
export let FLOORS = [1];
export function setCompanyFloors(numbers) {
  const next = [...new Set(numbers.map(Number).filter(Number.isInteger))].sort((a, b) => a - b);
  if (next.length) FLOORS = next;
}
export const MAP_SIZE = { width: 1200, height: 640 };
// Inside of the building: a rectangle with the entrance wall notched out of the top-left corner.
export const FLOOR = { left: 22, right: 1176, top: 34, bottom: 614, notch: { right: 252, bottom: 118 } };
export const FLOOR_PATH = `M${FLOOR.left} ${FLOOR.notch.bottom}H${FLOOR.notch.right}V${FLOOR.top}H${FLOOR.right}V${FLOOR.bottom}H${FLOOR.left}Z`;
export const onFloor = (x, y) => x >= FLOOR.left && x <= FLOOR.right && y >= FLOOR.top && y <= FLOOR.bottom && !(x < FLOOR.notch.right && y < FLOOR.notch.bottom);
// Shared desks; seat y is where a seated character is drawn (centre at y+36).
export const DESK_CLUSTERS = [{y:126,xs:[402,486]},{y:126,xs:[662,746]},{y:126,xs:[882,966,1050]},{y:286,xs:[372,456]},{y:286,xs:[642,726]},{y:446,xs:[402,486]},{y:446,xs:[662,746]}];
export const SEATS = DESK_CLUSTERS.flatMap(c => c.xs.map(x => ({ x, y: c.y }))).map((s, i) => ({ id: `A-${String(i+1).padStart(2,'0')}`, ...s }));
// 2층 업무석: 2층 도면(1713×918)의 의자 위치를 1400×800 지도 좌표로 옮긴 좌석.
const F2X = 1400 / 1713, F2Y = 750 / 918, F2OY = 25;
export const SEATS2 = [
  ['J', [422, 527, 638, 750, 859, 1000, 1106, 1212, 1322, 1428], [203, 255, 305]],
  ['K', [423, 541, 657, 771, 888, 1001, 1114, 1228, 1344, 1460, 1577], [432, 487, 542]],
  ['L', [436, 550, 662, 777, 987, 1101, 1210, 1318, 1426, 1535], [676, 729, 782]],
].flatMap(([row, xs, ys]) => {
  let n = 0;
  return ys.flatMap(y => xs.map(x => ({ id: `${row}-${String(++n).padStart(2, '0')}`, x: Math.round(x * F2X), y: Math.round(F2OY + y * F2Y) })));
});
// 1층 업무석: 메인 지도(reference 레이아웃)의 A/B/C 좌석과 같은 번호·위치.
// 좌표는 1400×800 지도 좌표이고, 좌석 라벨을 지도와 같은 키로 쓰기 위해 두 자리로 맞춘다.
const F1_CLUSTERS = [[439, 197, 1, 'A'], [670, 197, 1, 'A'], [965, 197, 2, 'A'], [387, 439, 2, 'B'], [669, 439, 2, 'B'], [387, 614, 2, 'C'], [669, 614, 2, 'C']];
export const SEATS1 = (() => {
  const out = [], n = { A: 0, B: 0, C: 0 };
  F1_CLUSTERS.forEach(([x, y, count, row]) => {
    const cols = [];
    for (let d = 0; d < count; d++) { const dx = x + d * 112; cols.push(dx, dx + 56); }
    cols.forEach(cx => out.push({ id: `${row}-${String(++n[row]).padStart(2, '0')}`, x: cx + 34, y: y - 16 }));
    cols.forEach(cx => out.push({ id: `${row}-${String(++n[row]).padStart(2, '0')}`, x: cx + 34, y: y + 94 }));
  });
  return out;
})();
export const seatsOfFloor = floor => (Number(floor) === 2 ? SEATS2 : SEATS1);
// The eight quick statuses from the SENSPACE design: icon, message, and whether
// it is a sensitivity alert (shown in red to colleagues).
export const QUICK_STATUS = [['coffee','커피 마실 사람~'],['mute','지금 소리에 예민해요',true],['hot','좀 더워요',true],['smell','냄새에 예민해요',true],['focus','집중 근무 중'],['rest','조금 쉬어요'],['help','도움이 필요해요'],['heart','오늘 기분 좋아요']];
export const ALERT_ICONS = new Set(QUICK_STATUS.filter(q => q[2]).map(q => q[0]));
// Older saves stored emoji; map them to the flat icon keys.
// Icons saved by earlier versions map onto the nearest of the eight.
export const LEGACY_ICONS = {'☕':'coffee','🍴':'coffee','❤️':'heart','💻':'focus','📖':'help','🎉':'heart','🌱':'focus','🏋️':'rest','📄':'focus','💾':'focus','🐱':'rest','👁️':'focus',
  utensils:'coffee',laptop:'focus',book:'help',party:'heart',sprout:'focus',dumbbell:'rest',doc:'focus',save:'focus',cat:'rest',eye:'focus',
  lunch:'coffee',work:'focus',meeting:'focus',phone:'help',outside:'rest'};
export const iconKey = icon => LEGACY_ICONS[icon] || icon || '';
const KEY = 'sensory-fit-demo-v1';
export function charCount(text) { return [...new Intl.Segmenter('ko', { granularity: 'grapheme' }).segment(text)].length; }
export function localDay(date = new Date()) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year:'numeric',month:'2-digit',day:'2-digit' }).format(new Date(date)); }
export function todaySenses(user, now = new Date()) { return user.sensesAt && localDay(user.sensesAt) === localDay(now) ? user.senses : {}; }
export function currentSenses(user, now = new Date()) { return user.status !== 'offline' ? todaySenses(user, now) : {}; }
export function validateProfile(profile) {
  if (!profile.name?.trim() || !profile.role?.trim()) throw new Error('이름과 직책을 입력해 주세요.');
  if (!FLOORS.includes(Number(profile.floor)) || !seatsOfFloor(profile.floor).some(s=>s.id===profile.seat)) throw new Error('층과 좌석을 선택해 주세요.');
  if (TRAITS.some(t=>!Number.isInteger(profile.sensitivity?.[t.key]) || profile.sensitivity[t.key]<1 || profile.sensitivity[t.key]>5)) throw new Error('시각·청각·후각 민감도를 모두 선택해 주세요.');
  if ((profile.description||'').length > 300) throw new Error('추가 설명은 300자 이내로 입력해 주세요.');
}
function seed() {
  const now = new Date().toISOString();
  const profiles = [
    ['김민지','프로덕트 디자이너',0,'working','', '커피 마실 사람 ☕',1,'A-02'],
    ['이준호','프론트엔드 개발자',1,'working','', '오후에는 집중할게요',1,'A-03'],
    ['박서연','브랜드 디자이너',2,'away','미팅','',1,'A-05'],
    ['최민수','프로덕트 매니저',3,'working','','조금 더워요',1,'A-06'],
    ['정하은','UX 리서처',4,'working','','소리에 예민한 날이에요',1,'A-07'],
    ['김도윤','백엔드 개발자',5,'away','점심','',1,'A-09'],
    ['이수빈','서비스 기획자',6,'offline','','',1,'A-10'],
    ['윤지우','마케팅 매니저',7,'working','','오늘도 좋은 하루!',2,'J-11'],
  ];
  return { session: null, users: profiles.map((p,i)=>({id:`demo-${i}`,name:p[0],role:p[1],avatar:p[2],status:p[3],reason:p[4],message:p[5],messageIcon:['coffee','focus','','hot','mute','','','heart'][i],floor:p[6],seat:p[7],email:i===0?'demo@sensory.fit':`colleague${i}@demo.local`,complete:true,sensitivity:{visual:3,auditory:i===4?5:4,olfactory:2},description:i===0?'작은 배려가 모이면 더 편안한 하루가 돼요.\n갑작스러운 큰 소리에는 조금 예민한 편이에요.':'집중할 때는 먼저 메시지로 알려주시면 좋아요.',senses:{temperature:i===3?4:3,humidity:3,noise:i===4?5:2,smell:1,lighting:2,crowding:3},sensesAt:now,statusAt:now})) };
}
export function createAdapter(storage) {
  function read() { const raw=storage.getItem(KEY); if(!raw) {const value=seed(); write(value); return value;} try {const d=JSON.parse(raw);if(!Array.isArray(d.users))throw new Error();let changed=false;for(const u of d.users){if(u.senses&&'discomfort' in u.senses){if(!('lighting' in u.senses))u.senses.lighting=u.senses.discomfort;delete u.senses.discomfort;changed=true;}if(u.floor===3){u.floor=1;changed=true;}}if(changed)write(d);return d;} catch {throw new Error('저장된 데모 데이터를 읽지 못했어요. 브라우저 사이트 데이터를 확인해 주세요.');} }
  function write(data) { try { storage.setItem(KEY, JSON.stringify(data)); } catch { throw new Error('브라우저 저장 공간을 사용할 수 없어요. 저장 설정을 확인해 주세요.'); } }
  const api = {
    async me() {const d=read();return d.users.find(u=>u.id===d.session)||null;},
    async list() {return read().users.filter(u=>u.complete);},
    async demo() {const d=read(),u=d.users[0];if(!u.seat){u.seat='A-02';u.referenceSeat='A-02';u.role=u.role||'프로덕트 디자이너';u.complete=true;}d.session=u.id;write(d);return u;},
    // Demo stand-in for a personal link: starts as an invitee who has not set a
    // seat yet, so the welcome → info → seat flow can be walked through locally.
    async enter(token) {
      const clean=String(token||'').trim();
      if(!clean)throw new Error('초대 링크가 올바르지 않아요. 링크를 다시 확인해 주세요.');
      const d=read(),u=d.users[0],keep={name:u.name,character:u.character,referenceCharacter:u.referenceCharacter};
      Object.assign(u,{name:keep.name||'김민지',role:'',avatar:0,floor:1,seat:'',referenceSeat:'',complete:false,status:'offline',reason:'',message:'',messageIcon:'',awayNote:'',sensitivity:{},description:'',senses:{},sensesAt:null,character:keep.character,referenceCharacter:keep.referenceCharacter});
      d.session=u.id;write(d);return u;
    },
    async login(email) {const d=read(), u=d.users.find(u=>u.email===email.trim().toLowerCase());if(!u)throw new Error('이 브라우저에 등록된 계정이 없어요. 회원가입 또는 데모 입장을 이용해 주세요.');d.session=u.id;write(d);return u;},
    async signup({name,email,code}) {const d=read();if(code.trim().toUpperCase()!=='ONYU2026')throw new Error('데모 초대 코드 ONYU2026을 입력해 주세요.');if(d.users.some(u=>u.email===email.trim().toLowerCase()))throw new Error('이미 등록된 이메일이에요.');const u={id:crypto.randomUUID(),name:name.trim(),email:email.trim().toLowerCase(),role:'',avatar:0,floor:1,seat:'',complete:false,status:'offline',reason:'',message:'',sensitivity:{},description:'',senses:{},sensesAt:null};d.users.push(u);d.session=u.id;write(d);return u;},
    async logout() {const d=read();d.session=null;write(d);},
    async completeOnboarding({name,role}) {if(!name?.trim()||!role?.trim())throw new Error('이름과 직무를 입력해 주세요.');return update(u=>{u.name=name.trim();u.role=role.trim();});},
    async referenceCharacter(cfg) {
      if(!cfg||!['bob','bun','long','short','twin','part'].includes(cfg.hair)||!['shirt','cardigan','hoodie','suit'].includes(cfg.outfit)||!['pants','skirt'].includes(cfg.bottom)||!['hairColor','eye','skin','top','pants'].every(k=>cfg[k]===undefined||/^#[0-9a-f]{6}$/i.test(cfg[k]))||!(cfg.special==null||['a_red','a_yellow','a_green','a_purple','bear','cat','frog','bunny'].includes(cfg.special)))throw new Error('캐릭터 설정을 확인해 주세요.');
      return update(u=>{u.referenceCharacter=JSON.parse(JSON.stringify(cfg));if(!u.character)u.character=normalizeCharacter();});
    },
    async referenceSeat(seat) {
      const bare=s=>String(s||'').trim().toUpperCase().replace(/-0*(\d+)$/,(_,n)=>'-'+Number(n));
      const key=bare(seat);
      const match=key.match(/^([A-Z]+)-(\d+)$/);
      // 지도(참조 레이아웃)의 좌석 구성: 1층 A/B/C 각 16석, 2층 J 30·K 33·L 30석.
      const ROWS={A:16,B:16,C:16,J:30,K:33,L:30};
      if(!match||Number(match[2])<1||Number(match[2])>(ROWS[match[1]]||0))throw new Error('좌석을 확인해 주세요.');
      const floor=/^[JKL]$/.test(match[1])?2:1;
      const d=read(),u=d.users.find(p=>p.id===d.session);if(!u)throw new Error('다시 로그인해 주세요.');
      if(d.users.some(p=>p.id!==u.id&&p.floor===floor&&bare(p.referenceSeat||p.seat)===key))throw new Error('이미 사용 중인 자리예요.');
      return update(p=>{p.referenceSeat=key;p.seat=key.replace(/-0*(\d+)$/,(_,n)=>'-'+String(n).padStart(2,'0'));p.floor=floor;p.complete=true;});
    },
    async profile(changes) {validateProfile(changes);const d=read(), u=d.users.find(u=>u.id===d.session);if(!u)throw new Error('다시 로그인해 주세요.');if(d.users.some(o=>o.id!==u.id&&o.complete&&o.floor===Number(changes.floor)&&o.seat===changes.seat))throw new Error('이미 배정된 좌석이에요. 다른 자리를 선택해 주세요.');Object.assign(u,{name:changes.name.trim(),role:changes.role.trim(),avatar:Number(changes.avatar),floor:Number(changes.floor),seat:changes.seat,sensitivity:changes.sensitivity,description:changes.description||'',complete:true});write(d);return u;},
    async character(look) {validateCharacter(look);return update(u=>{u.character=normalizeCharacter(look);});},
    async status(status, reason='') {if(!STATUS[status] || status==='away'&&reason!==''&&!REASONS.includes(reason))throw new Error('근태 상태를 확인해 주세요.');return update(u=>{u.awayNote=status==='away'&&u.status==='away'?u.awayNote||'':'';u.status=status;u.reason=status==='away'?reason:'';u.statusAt=new Date().toISOString();if(status==='offline'){u.senses={};u.sensesAt=null;u.message='';u.messageIcon='';}});},
    // Free-text detail while away, e.g. "16시 복귀" or "외근 후 바로 퇴근".
    async awayNote(value) {if(charCount(value)>30)throw new Error('자리 비움 상세는 30자까지 입력할 수 있어요.');return update(u=>{if(u.status!=='away')throw new Error('자리 비움 상태에서만 적을 수 있어요.');u.awayNote=value.trim();});},
    async message(value, icon='') {if(charCount(value)>20)throw new Error('상태 메시지는 공백 포함 20자까지 입력할 수 있어요.');if(icon&&!QUICK_STATUS.some(([i])=>i===icon))throw new Error('상태 아이콘을 다시 선택해 주세요.');return update(u=>{u.message=value.trim();u.messageIcon=u.message?icon:'';});},
    async senses(values) {for(const [k,v] of Object.entries(values))if(!SENSES.some(s=>s.key===k)||!Number.isInteger(v)||v<1||v>5)throw new Error('감각은 1~5단계로 선택해 주세요.');return update(u=>{if(u.status==='offline')throw new Error('출근 후 현재 감각을 공유해 주세요.');u.senses=values;u.sensesAt=new Date().toISOString();});},
  };
  function update(fn) {const d=read(),u=d.users.find(u=>u.id===d.session);if(!u)throw new Error('다시 로그인해 주세요.');fn(u);write(d);return u;}
  return api;
}
