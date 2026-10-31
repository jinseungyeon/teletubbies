import { validateCharacter, normalizeCharacter } from './character.js';
// Replace this adapter with Supabase calls. UI modules never access storage directly.
export const SENSITIVITY = ['매우 둔감', '둔감', '보통', '민감', '매우 민감'];
export const SENSES = [
  { key: 'temperature', name: '온도', icon: 'thermometer', color: '#d78b67', labels: ['매우 추움', '추움', '적당함', '더움', '매우 더움'] },
  { key: 'humidity', name: '습도', icon: 'drop', color: '#6c9bb9', labels: ['매우 건조함', '건조함', '적당함', '습함', '매우 습함'] },
  { key: 'noise', name: '소음', icon: 'sound', color: '#cd8294', labels: ['매우 조용함', '조용함', '보통', '시끄러움', '매우 시끄러움'] },
  { key: 'smell', name: '냄새', icon: 'leaf', color: '#79a78a', labels: ['없음', '약함', '보통', '강함', '매우 강함'] },
  { key: 'discomfort', name: '불쾌 지수', icon: 'sun', color: '#a08abb', labels: ['매우 쾌적함', '쾌적함', '보통', '불편함', '매우 불편함'] },
  { key: 'crowding', name: '혼잡도', icon: 'users', color: '#8b8da5', labels: ['매우 한산함', '한산함', '보통', '붐빔', '매우 붐빔'] },
];
export const TRAITS = [{key:'visual',name:'시각',icon:'eye'}, {key:'auditory',name:'청각',icon:'sound'}, {key:'olfactory',name:'후각',icon:'leaf'}];
export const STATUS = { working: '출근', away: '자리 비움', offline: '퇴근' };
export const REASONS = ['점심', '미팅', '외근'];
export const COMPANY = '온유 스튜디오';
export const FLOORS = [2, 3];
export const MAP_SIZE = { width: 1200, height: 640 };
// Inside of the building: a rectangle with the entrance wall notched out of the top-left corner.
export const FLOOR = { left: 22, right: 1176, top: 34, bottom: 614, notch: { right: 252, bottom: 118 } };
export const FLOOR_PATH = `M${FLOOR.left} ${FLOOR.notch.bottom}H${FLOOR.notch.right}V${FLOOR.top}H${FLOOR.right}V${FLOOR.bottom}H${FLOOR.left}Z`;
export const onFloor = (x, y) => x >= FLOOR.left && x <= FLOOR.right && y >= FLOOR.top && y <= FLOOR.bottom && !(x < FLOOR.notch.right && y < FLOOR.notch.bottom);
// Shared desks; seat y is where a seated character is drawn (centre at y+36).
export const DESK_CLUSTERS = [{y:126,xs:[402,486]},{y:126,xs:[662,746]},{y:126,xs:[882,966,1050]},{y:286,xs:[372,456]},{y:286,xs:[642,726]},{y:446,xs:[402,486]},{y:446,xs:[662,746]}];
export const SEATS = DESK_CLUSTERS.flatMap(c => c.xs.map(x => ({ x, y: c.y }))).map((s, i) => ({ id: `A-${String(i+1).padStart(2,'0')}`, ...s }));
export const QUICK_STATUS = [['☕','커피'],['🍴','식사'],['❤️','하트'],['💻','노트북'],['📖','책'],['🎉','축하'],['🌱','새싹'],['🏋️','운동'],['📄','문서'],['💾','저장'],['🐱','고양이'],['👁️','눈']];
const KEY = 'sensory-fit-demo-v1';
export function charCount(text) { return [...new Intl.Segmenter('ko', { granularity: 'grapheme' }).segment(text)].length; }
export function localDay(date = new Date()) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year:'numeric',month:'2-digit',day:'2-digit' }).format(new Date(date)); }
export function currentSenses(user, now = new Date()) { return user.status === 'working' && user.sensesAt && localDay(user.sensesAt) === localDay(now) ? user.senses : {}; }
export function validateProfile(profile) {
  if (!profile.name?.trim() || !profile.role?.trim()) throw new Error('이름과 직책을 입력해 주세요.');
  if (!FLOORS.includes(Number(profile.floor)) || !SEATS.some(s=>s.id===profile.seat)) throw new Error('층과 좌석을 선택해 주세요.');
  if (TRAITS.some(t=>!Number.isInteger(profile.sensitivity?.[t.key]) || profile.sensitivity[t.key]<1 || profile.sensitivity[t.key]>5)) throw new Error('시각·청각·후각 민감도를 모두 선택해 주세요.');
  if ((profile.description||'').length > 300) throw new Error('추가 설명은 300자 이내로 입력해 주세요.');
}
function seed() {
  const now = new Date().toISOString();
  const profiles = [
    ['김민지','프로덕트 디자이너',0,'working','', '커피 마실 사람 ☕',3,'A-02'],
    ['이준호','프론트엔드 개발자',1,'working','', '오후에는 집중할게요',3,'A-03'],
    ['박서연','브랜드 디자이너',2,'away','미팅','',3,'A-05'],
    ['최민수','프로덕트 매니저',3,'working','','조금 더워요',3,'A-06'],
    ['정하은','UX 리서처',4,'working','','소리에 예민한 날이에요',3,'A-07'],
    ['김도윤','백엔드 개발자',5,'away','점심','',3,'A-09'],
    ['이수빈','서비스 기획자',6,'offline','','',3,'A-10'],
    ['윤지우','마케팅 매니저',7,'working','','오늘도 좋은 하루!',2,'A-01'],
  ];
  return { session: null, users: profiles.map((p,i)=>({id:`demo-${i}`,name:p[0],role:p[1],avatar:p[2],status:p[3],reason:p[4],message:p[5],messageIcon:['☕','💻','','🌱','👁️','','','🎉'][i],floor:p[6],seat:p[7],email:i===0?'demo@sensory.fit':`colleague${i}@demo.local`,complete:true,sensitivity:{visual:3,auditory:i===4?5:4,olfactory:2},description:i===0?'작은 배려가 모이면 더 편안한 하루가 돼요.\n갑작스러운 큰 소리에는 조금 예민한 편이에요.':'집중할 때는 먼저 메시지로 알려주시면 좋아요.',senses:{temperature:i===3?4:3,humidity:3,noise:i===4?5:2,smell:1,discomfort:2,crowding:3},sensesAt:now,statusAt:now})) };
}
export function createAdapter(storage) {
  function read() { const raw=storage.getItem(KEY); if(!raw) {const value=seed(); write(value); return value;} try {const d=JSON.parse(raw);if(!Array.isArray(d.users))throw new Error();return d;} catch {throw new Error('저장된 데모 데이터를 읽지 못했어요. 브라우저 사이트 데이터를 확인해 주세요.');} }
  function write(data) { try { storage.setItem(KEY, JSON.stringify(data)); } catch { throw new Error('브라우저 저장 공간을 사용할 수 없어요. 저장 설정을 확인해 주세요.'); } }
  const api = {
    async me() {const d=read();return d.users.find(u=>u.id===d.session)||null;},
    async list() {return read().users.filter(u=>u.complete);},
    async demo() {const d=read();d.session='demo-0';write(d);return d.users[0];},
    async login(email) {const d=read(), u=d.users.find(u=>u.email===email.trim().toLowerCase());if(!u)throw new Error('이 브라우저에 등록된 계정이 없어요. 회원가입 또는 데모 입장을 이용해 주세요.');d.session=u.id;write(d);return u;},
    async signup({name,email,code}) {const d=read();if(code.trim().toUpperCase()!=='ONYU2026')throw new Error('데모 초대 코드 ONYU2026을 입력해 주세요.');if(d.users.some(u=>u.email===email.trim().toLowerCase()))throw new Error('이미 등록된 이메일이에요.');const u={id:crypto.randomUUID(),name:name.trim(),email:email.trim().toLowerCase(),role:'',avatar:0,floor:3,seat:'',complete:false,status:'offline',reason:'',message:'',sensitivity:{},description:'',senses:{},sensesAt:null};d.users.push(u);d.session=u.id;write(d);return u;},
    async logout() {const d=read();d.session=null;write(d);},
    async profile(changes) {validateProfile(changes);const d=read(), u=d.users.find(u=>u.id===d.session);if(!u)throw new Error('다시 로그인해 주세요.');if(d.users.some(o=>o.id!==u.id&&o.complete&&o.floor===Number(changes.floor)&&o.seat===changes.seat))throw new Error('이미 배정된 좌석이에요. 다른 자리를 선택해 주세요.');Object.assign(u,{name:changes.name.trim(),role:changes.role.trim(),avatar:Number(changes.avatar),floor:Number(changes.floor),seat:changes.seat,sensitivity:changes.sensitivity,description:changes.description||'',complete:true});write(d);return u;},
    async character(look) {validateCharacter(look);return update(u=>{u.character=normalizeCharacter(look);});},
    async status(status, reason='') {if(!STATUS[status] || status==='away'&&!REASONS.includes(reason))throw new Error('근태 상태를 확인해 주세요.');return update(u=>{u.status=status;u.reason=status==='away'?reason:'';u.statusAt=new Date().toISOString();if(status==='offline'){u.senses={};u.sensesAt=null;u.message='';u.messageIcon='';}});},
    async message(value, icon='') {if(charCount(value)>20)throw new Error('상태 메시지는 공백 포함 20자까지 입력할 수 있어요.');if(icon&&!QUICK_STATUS.some(([i])=>i===icon))throw new Error('상태 아이콘을 다시 선택해 주세요.');return update(u=>{u.message=value.trim();u.messageIcon=u.message?icon:'';});},
    async senses(values) {for(const [k,v] of Object.entries(values))if(!SENSES.some(s=>s.key===k)||!Number.isInteger(v)||v<1||v>5)throw new Error('감각은 1~5단계로 선택해 주세요.');return update(u=>{if(u.status==='offline')throw new Error('출근 후 현재 감각을 공유해 주세요.');u.senses=values;u.sensesAt=new Date().toISOString();});},
  };
  function update(fn) {const d=read(),u=d.users.find(u=>u.id===d.session);if(!u)throw new Error('다시 로그인해 주세요.');fn(u);write(d);return u;}
  return api;
}
