
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const R = p => (window.__resources && window.__resources[p.replace(/[^a-z0-9]/gi, '_')]) || ('/src/' + p);
const IC = k => R('assets/icons/' + k + '.png');
const MW = 1400, MH = 800;
const FS = { workdesk: [56, 36], workdesk_b: [56, 36], chair: [14, 16], chair_b: [14, 16], mtable_long: [40, 164], mchair_l: [16, 18], mchair_r: [16, 18], pillar_table: [30, 34], front_desk: [34, 128], wall_tv: [36, 24] };
const FURN = [];
const add = (k, x, y, z) => { const [w, h] = FS[k]; FURN.push({ src: 'assets/furniture/' + k + '.png', style: { position: 'absolute', left: x, top: y, width: w * 2, height: h * 2, zIndex: z != null ? z : Math.round(y + h * 2), imageRendering: 'pixelated', pointerEvents: 'none' } }); };
const CLUS = [[439, 197, 1, 'A'], [670, 197, 1, 'A'], [965, 197, 2, 'A'], [387, 439, 2, 'B'], [669, 439, 2, 'B'], [387, 614, 2, 'C'], [669, 614, 2, 'C']];
const SEATS = []; const rc = { A: 0, B: 0, C: 0 };
CLUS.forEach(([x, y, n, row], ci) => {
  const cols = [];
  for (let d = 0; d < n; d++) { const dx = x + d * 112; add((ci + d) % 2 ? 'workdesk_b' : 'workdesk', dx, y, y + 72); cols.push(dx, dx + 56); }
  cols.forEach(cx => { add('chair', cx + 14, y - 14, y + 17); add('chair_b', cx + 14, y + 76, y + 110); });
  cols.forEach(cx => SEATS.push({ id: row + '-' + (++rc[row]), side: 'n', x: cx + 10, y: y - 40, z: y + 18, mx: cx + 14, my: y - 46 }));
  cols.forEach(cx => SEATS.push({ id: row + '-' + (++rc[row]), side: 's', x: cx + 10, y: y + 44, z: y + 101, mx: cx + 14, my: y + 64 }));
});
for (let i = 0; i < 16; i++) add('chair_b', 372 + i * 60, 88, 130);
add('mtable_long', 1103, 389, 720);
for (let i = 0; i < 6; i++) { add('mchair_l', 1067, 412 + i * 50, 700); add('mchair_r', 1187, 412 + i * 50, 700); }
add('pillar_table', 305, 302); add('pillar_table', 866, 305); add('front_desk', 64, 413, 700); add('wall_tv', 84, 150, 5); add('wall_tv', 216, 150, 5);
const pct = (x, y, w, h) => ({ position: 'absolute', left: x / 14 + '%', top: y / 8 + '%', width: w / 14 + '%', height: h / 8 + '%' });
const MINI = [
  { style: { ...pct(344, 36, 984, 708), background: '#e4e2df' } }, { style: { ...pct(36, 188, 308, 556), background: '#e4e2df' } },
  { style: { ...pct(344, 36, 984, 64), background: '#a9d8ef' } }, { style: { ...pct(1328, 36, 32, 736), background: '#a9d8ef' } },
  { style: { ...pct(1103, 389, 80, 328), background: '#ffffff', borderRadius: 2 } }, { style: { ...pct(64, 413, 68, 256), background: '#d9a466' } },
  ...CLUS.map(([x, y, n]) => ({ style: { ...pct(x, y + 8, n * 112, 54), background: '#d9a466', borderRadius: 2 } }))
];
const SEN = [
  { k: 'noise', label: '소음', icon: 'noise', color: '#e5534b', lo: '조용함', hi: '시끄러움' }, { k: 'temp', label: '온도', icon: 'temp', color: '#f08a3c', lo: '추움', hi: '더움' },
  { k: 'humid', label: '습도', icon: 'humid', color: '#4a8fe0', lo: '건조', hi: '습함' }, { k: 'smell', label: '냄새', icon: 'smell', color: '#e0a020', lo: '약함', hi: '강함' },
  { k: 'discomfort', label: '불쾌 지수', icon: 'discomfort', color: '#8f7ad8', lo: '쾌적', hi: '불쾌' }, { k: 'crowd', label: '혼잡도', icon: 'crowd', color: '#4a4e72', lo: '여유', hi: '붐빔' }
];
const SENSI = [{ k: 'visual', label: '시각 민감도', icon: 'eye', color: '#4a8fe0' }, { k: 'audio', label: '청각 민감도', icon: 'ear', color: '#e5534b' }, { k: 'smell', label: '후각 민감도', icon: 'nose', color: '#5fb34f' }];
const SENSI_TXT = ['', '낮음', '조금 낮음', '보통', '높음', '매우 높음'];
const QUICK = [
  ['coffee', '커피 마실 사람~'], ['lunch', '점심 같이 드실 분?'], ['mute', '지금 소리에 예민해요', 1], ['hot', '좀 더워요', 1], ['smell', '냄새에 예민해요', 1], ['eye', '눈이 피로해요', 1],
  ['focus', '집중하고 있어요'], ['rest', '조금 쉬어요'], ['help', '도움이 필요해요'], ['heart', '오늘 기분 좋아요'], ['phone', '통화 중이에요'], ['meeting', '회의 준비 중']
].map(([icon, text, alert]) => ({ icon, text, alert: !!alert }));
const WORK = [['focus', '집중 근무 중'], ['meeting', '회의 중'], ['heart', '디자인 작업 중'], ['eye', '리뷰 중'], ['phone', '통화 중'], ['help', '교육 중']];
const REASONS = { meal: { label: '식사', icon: 'lunch', long: '식사하러 갔어요' }, meeting: { label: '회의', icon: 'meeting', long: '회의에 들어갔어요' }, outside: { label: '외근', icon: 'outside', long: '외근 중이에요' }, short: { label: '잠깐 자리 비움', icon: 'away', long: '잠깐 자리를 비웠어요' }, personal: { label: '개인 용무', icon: 'rest', long: '개인 용무 중이에요' }, home: { label: '재택', icon: 'off', long: '오늘은 재택이에요' } };
const LV = ['', '#5aa9e0', '#7cc5a0', '#f0c04a', '#f08a3c', '#e5534b'];
const sn = (noise, temp, humid, smell, discomfort, crowd) => ({ noise, temp, humid, smell, discomfort, crowd });
const P = (id, name, role, seat, team, status, extra, cfg, senses, sensi, desc) => ({ id, name, role, seat, team, status, reason: null, since: '09:10', task: '', msg: '', msgIcon: null, alert: false, ...extra, cfg, senses, sensi: sensi || { visual: 3, audio: 3, smell: 3 }, desc: desc || '' });
const P0 = [
  P('me', '김민지', '프로덕트 디자이너', 'B-2', 'd', 'work', { task: '집중 근무 중', msg: '커피 마실 사람~', msgIcon: 'coffee', since: '09:12' }, { hair: 'bob', hairColor: '#5a3a2a', outfit: 'shirt', top: '#4a86d8' }, sn(2, 3, 2, 1, 2, 3), { visual: 3, audio: 4, smell: 3 }, '큰 소음이 지속되면 집중하기 어려워요. 강한 향수 냄새도 불편할 수 있어요.'),
  P('p1', '최민수', 'UI 디자이너', 'B-1', 'd', 'work', { msg: '지금 소리에 예민해요', msgIcon: 'mute', alert: true, task: '디자인 작업 중' }, { hair: 'part', hairColor: '#8a5a3a', outfit: 'shirt', top: '#9cc8f0' }, sn(5, 3, 2, 2, 4, 3), { visual: 2, audio: 5, smell: 2 }, '키보드·통화 소리에 특히 예민해요. 근처 통화는 짧게 부탁드려요.'),
  P('p2', '정하은', '디자인 리드', 'B-3', 'd', 'work', { msg: '집중하고 있어요', msgIcon: 'focus', task: '리뷰 중', since: '08:40' }, { hair: 'bun', hairColor: '#2e2a36', outfit: 'suit', top: '#4a4e72' }, sn(2, 3, 3, 1, 2, 2), null, '오전엔 집중 시간이에요. 급한 일은 메시지로 남겨주세요.'),
  P('p3', '이준호', 'UX 리서처', 'B-4', 'd', 'away', { reason: 'meeting', since: '10:30', task: '회의 중' }, { hair: 'short', hairColor: '#2e2a36', outfit: 'hoodie', top: '#5aa96a' }, sn(3, 3, 3, 2, 2, 4), null, '회의 중엔 메시지 확인이 늦을 수 있어요.'),
  P('p4', '박서연', '그래픽 디자이너', 'B-5', 'd', 'away', { reason: 'meal', since: '12:05', msg: '점심 같이 드실 분?', msgIcon: 'lunch' }, { hair: 'long', hairColor: '#e8c27a', outfit: 'cardigan', top: '#f0a6c8', bottom: 'skirt' }, sn(3, 2, 3, 3, 2, 4), { visual: 4, audio: 2, smell: 3 }, '밝은 조명 아래에선 눈이 쉽게 피로해요.'),
  P('p5', '김도연', 'BX 디자이너', 'B-6', 'd', 'work', { msg: '도움이 필요해요', msgIcon: 'help', task: '디자인 작업 중' }, { hair: 'twin', hairColor: '#c0563f', outfit: 'hoodie', top: '#f2c9a8', bottom: 'skirt' }, sn(3, 3, 3, 2, 2, 3), { visual: 3, audio: 2, smell: 4 }, '향이 강한 음식 냄새에 민감한 편이에요.'),
  P('p6', '한지우', '모션 디자이너', 'B-9', 'd', 'work', { msg: '좀 더워요', msgIcon: 'hot', alert: true }, { hair: 'long', hairColor: '#2e2a36', outfit: 'shirt', top: '#d9484a' }, sn(2, 5, 4, 2, 4, 3), null, '더위를 많이 타요.'),
  P('p7', '이수빈', 'UX 라이터', 'B-10', 'd', 'away', { reason: 'short', since: '11:48' }, { hair: 'bob', hairColor: '#8a5a3a', outfit: 'cardigan', top: '#a58be0', bottom: 'skirt' }, sn(2, 2, 3, 3, 2, 4), { visual: 2, audio: 4, smell: 3 }, '조용한 환경에서 글이 잘 써져요.'),
  P('p8', '박지훈', '디자인팀장', 'B-11', 'd', 'away', { reason: 'outside', since: '09:30', task: '클라이언트 미팅 · 16시 복귀' }, { hair: 'short', hairColor: '#a9a6b8', outfit: 'suit', top: '#3f4258' }, sn(3, 3, 3, 2, 2, 3), null, '외근 중엔 전화보다 메시지가 편해요.'),
  P('p9', '서다인', '디자인 인턴', 'B-13', 'd', 'work', { msg: '조금 쉬어요', msgIcon: 'rest' }, { special: 'bunny' }, sn(3, 3, 3, 3, 3, 4), { visual: 4, audio: 4, smell: 3 }, '사람이 많은 곳에선 금방 지쳐요.'),
  P('p10', '오세린', '콘텐츠 디자이너', 'C-1', 'd', 'off', { since: '13:00' }, { hair: 'twin', hairColor: '#2e2a36', outfit: 'cardigan', top: '#8fcf9a', bottom: 'skirt' }, sn(2, 3, 3, 2, 2, 2), null, '오늘은 반차예요.'),
  P('p11', '강민호', '3D 디자이너', 'C-2', 'd', 'work', { msg: '오늘 기분 좋아요', msgIcon: 'heart' }, { special: 'a_red' }, sn(3, 3, 3, 2, 2, 3), null, ''),
  P('q1', '김태현', '백엔드 개발자', 'A-1', 'e', 'work', { msg: '커피 마실 사람~', msgIcon: 'coffee' }, { hair: 'short', hairColor: '#2e2a36', outfit: 'hoodie', top: '#3f4258' }, sn(3, 3, 3, 2, 3, 3)),
  P('q2', '이도윤', '프론트엔드 개발자', 'A-2', 'e', 'work', { task: '디자인 QA 대응' }, { hair: 'part', hairColor: '#5a3a2a', outfit: 'shirt', top: '#8fcf9a' }, sn(2, 3, 3, 1, 2, 3)),
  P('q3', '정우진', 'iOS 개발자', 'A-6', 'e', 'away', { reason: 'meal', since: '12:10' }, { hair: 'short', hairColor: '#8a5a3a', outfit: 'suit', top: '#4a4e72' }, sn(3, 3, 3, 3, 3, 3)),
  P('q4', '최유나', 'PM', 'A-9', 'e', 'work', { msg: '통화 중이에요', msgIcon: 'phone' }, { hair: 'long', hairColor: '#c0563f', outfit: 'cardigan', top: '#f2c9a8', bottom: 'skirt' }, sn(3, 3, 3, 2, 2, 4)),
  P('q5', '한서준', '데이터 분석가', 'A-10', 'e', 'off', {}, { hair: 'part', hairColor: '#2e2a36', outfit: 'hoodie', top: '#9cc8f0' }, sn(2, 3, 3, 2, 2, 2)),
  P('q6', '문지아', 'QA 엔지니어', 'A-14', 'e', 'work', { msg: '좀 더워요', msgIcon: 'hot', alert: true }, { special: 'a_yellow' }, sn(2, 5, 4, 2, 4, 3))
];
const statusOf = p => {
  if (p.status === 'work') return { label: '출근', full: '출근 · 근무 중', color: '#2f8a52', bg: '#e3f3e8', dot: '#3fae6a' };
  if (p.status === 'off') return { label: '퇴근', full: '퇴근', color: '#6e7190', bg: '#ecebf1', dot: '#a5a8bd' };
  const r = REASONS[p.reason || 'short']; return { label: r.label, full: '자리 비움 · ' + r.label, color: '#b8701a', bg: '#fdf0da', dot: '#f0a93b' };
};
const dotSq = (on, color, size) => ({ width: size, height: size, borderRadius: Math.round(size / 3.5), border: 'none', padding: 0, cursor: 'pointer', background: on ? color : '#ebe3d3', boxShadow: on ? 'inset 0 -2px 0 rgba(0,0,0,.2)' : 'inset 0 -2px 0 #dcd1bd' });
const SEG = on => ({ height: 32, border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 800, padding: '0 12px', whiteSpace: 'nowrap', background: on ? '#fff' : 'transparent', color: on ? '#2b2d55' : '#9a9384', boxShadow: on ? '0 2px 0 #dccdb2' : 'none' });
const VSEG = on => ({ height: 30, padding: '0 14px', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap', background: on ? '#2b2d55' : 'transparent', color: on ? '#fff' : '#5d5870', boxShadow: on ? 'inset 0 -2px 0 #17183a' : 'none' });
const OPT = on => ({ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '8px 4px', borderRadius: 13, cursor: 'pointer', background: on ? '#ece8fb' : '#fff', border: on ? '2px solid #8b7fe0' : '2px solid #efe6d5', boxShadow: on ? '0 0 0 3px rgba(139,127,224,.18), inset 0 -3px 0 #d6cff3' : 'inset 0 -3px 0 #f1eadc' });
const CHIP = on => ({ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 10px', borderRadius: 10, cursor: 'pointer', fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', border: on ? '1.5px solid #8b7fe0' : '1.5px solid #e2d6c2', background: on ? '#ece8fb' : '#fff', color: on ? '#4b3fb8' : '#4a4560', boxShadow: on ? 'inset 0 -2px 0 #d6cff3' : 'inset 0 -2px 0 #efe6d5' });
const dotStyle = c => ({ width: 8, height: 8, borderRadius: 2, background: c, flexShrink: 0 });
const chipStyle = st => ({ display: 'inline-flex', alignItems: 'center', gap: 7, alignSelf: 'flex-start', padding: '6px 11px', borderRadius: 9, background: st.bg, color: st.color, fontSize: 13, fontWeight: 800 });
const checkBox = on => ({ width: 22, height: 22, borderRadius: 7, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: on ? '#2b2d55' : '#fff', border: on ? 'none' : '1.5px solid #cfc2aa', boxShadow: on ? 'inset 0 -2px 0 #17183a' : 'inset 0 2px 0 #f1eadc' });
const pick = a => a[Math.floor(Math.random() * a.length)];
const OUTF = {
  f: [{ outfit: 'shirt', top: '#4a86d8', bottom: 'skirt', pants: '#4a4e72' }, { outfit: 'cardigan', top: '#f0a6c8', bottom: 'skirt', pants: '#8a7a62' }, { outfit: 'hoodie', top: '#8fcf9a', bottom: 'pants', pants: '#4a4e72' }, { outfit: 'suit', top: '#3f4258', bottom: 'skirt', pants: '#2e2a36' }, { outfit: 'cardigan', top: '#e0bf8f', bottom: 'pants', pants: '#6b84b8' }, { outfit: 'hoodie', top: '#a58be0', bottom: 'skirt', pants: '#2e2a36' }],
  m: [{ outfit: 'shirt', top: '#9cc8f0', bottom: 'pants', pants: '#4a4e72' }, { outfit: 'hoodie', top: '#3f4258', bottom: 'pants', pants: '#2e2a36' }, { outfit: 'suit', top: '#4a4e72', bottom: 'pants', pants: '#2e2a36' }, { outfit: 'cardigan', top: '#b8773e', bottom: 'pants', pants: '#8a7a62' }, { outfit: 'shirt', top: '#5aa96a', bottom: 'pants', pants: '#6b84b8' }, { outfit: 'hoodie', top: '#d9484a', bottom: 'pants', pants: '#4a4e72' }]
};
const NOTIFS = [
  ['sense', 'mute', '감각 상태 알림', '내 팀 동료가 "소음에 예민해요" 같은 감각 상태를 올리면'],
  ['meetup', 'coffee', '모임 메시지', '"커피 마실 사람~", "점심 같이 드실 분?" 같은 메시지'],
  ['help', 'help', '도움 요청', '동료가 "도움이 필요해요"를 띄우면'],
  ['attend', 'work', '근태 변화', '팀원이 출근·퇴근·외근할 때'],
  ['back', 'away', '자리 복귀', '찾던 동료가 자리로 돌아오면'],
  ['space', 'noise', '내 주변 감각 변화', '내 자리 주변 소음·온도가 높아지면']
];

// Keep existing local accounts; store the richer v2 profile under that account.
const SESSION = window.SenspaceSession;
const EMBEDDED=!!SESSION.mode;
const profileKey = () => 'senspace.v2.profile.' + (SESSION.current?.id || 'guest');
function loadProfile(user) {
  const base={...P0[0],name:user?.name||P0[0].name,role:user?.role||P0[0].role,desc:user?.description||P0[0].desc};
  try { const saved=JSON.parse(localStorage.getItem(profileKey())||'null');if(saved&&SEATS.some(s=>s.id===saved.seat))return {...base,...saved,id:'me'}; }catch{}
  if(user){base.status={working:'work',away:'away',offline:'off'}[user.status]||'work';base.msg=user.message||'';base.msgIcon=user.messageIcon||null;base.sensi={visual:user.sensitivity?.visual||3,audio:user.sensitivity?.auditory||3,smell:user.sensitivity?.olfactory||3};base.awayNote=user.awayNote||'';base.reason=({점심:'meal',미팅:'meeting',외근:'outside'})[user.reason]||null;if(SESSION.characterFor)base.cfg=SESSION.characterFor(user);base.senses={...base.senses,...Object.fromEntries(Object.entries(user.senses||{}).map(([key,value])=>[({temperature:'temp',humidity:'humid',crowding:'crowd'})[key]||key,value]))};}
  return base;
}
const initialPeople=()=>EMBEDDED&&SESSION.current?SESSION.referencePeople(SESSION.users,SESSION.current):P0.map(p=>p.id==='me'?loadProfile(SESSION.current):{...p});

class Component extends DCLogic {
  constructor(props) {
    super(props);
    // Which reference surface this instance renders. In the old iframe build the
    // host set this through ?component=; in the React app each view passes a prop.
    this.mode = (props && props.mode) || SESSION.mode || '';
  }
  state = { ready: !!(window.SP && window.SP.ready), screen: SESSION.current ? (SESSION.current.complete?'space':'welcome') : 'auth', authMode:location.pathname==='/signup'?'signup':'login', authError:'', authBusy:false, awayOpen:false, awayDraft:'', people: initialPeople(), modal: null, cardId: null, ed: null, menu: false, listScope: 'team', q: '', mini: null,
    vw: 900, vh: 520, view: 'all', zm: 1, panX: 0, panY: 0, full: false, pop: null, selecting: false, selRect: null, team: { x: 360, y: 330, w: 560, h: 420 },
    pickSeat: false, seatDraft: null, toast: null, job: SESSION.current?.role||'프로덕트 디자이너', rank: '팀원',
    notif: { master: true, items: { sense: true, meetup: true, help: true, attend: false, back: false, space: false }, scope: 'team', quiet: true }, perm: typeof Notification !== 'undefined' ? Notification.permission : 'unsupported' };
  mapRef = React.createRef();
  componentDidMount() {
    if(EMBEDDED){
      this._onKey=e=>{if(e.key==='Escape'){if(this.mode==='map')this.setState({pop:null,pickSeat:false,selecting:false});else this.emit('close');}};
      window.addEventListener('keydown',this._onKey);
      let people=this.state.people;
      if(this.props&&this.props.me){
        SESSION.current=this.props.me;SESSION.users=this.props.people||[];SESSION.floor=this.props.floor;
        people=SESSION.referencePeople(SESSION.users,SESSION.current);
      }
      this.setState({screen:'space',people});
      if(this.mode==='editor'){this.openEditor('header',people.find(p=>p.id==='me'));this._opened=true;}
      if(this.mode==='settings'){this.openSettings();this._opened=true;}
      if(this.props&&this.props.onReady)this.props.onReady();
    }
    try { const t = JSON.parse(localStorage.getItem(EMBEDDED?'senspace.team.'+SESSION.floor:'senspace.team') || 'null'); if(t&&[t.x,t.y,t.w,t.h].every(Number.isFinite)&&t.x>=0&&t.y>=0&&t.w>=60&&t.h>=60&&t.x+t.w<=MW&&t.y+t.h<=MH)this.setState({team:t}); const n = JSON.parse(localStorage.getItem('senspace.notif') || 'null'); if(n&&typeof n.master==='boolean'&&n.items&&['team','floor','fav'].includes(n.scope))this.setState({notif:{...this.state.notif,...n,items:{...this.state.notif.items,...n.items}}}); } catch (e) {}
    if (!this.state.ready) this._t = setInterval(() => { if (window.SP && window.SP.ready) { clearInterval(this._t); this.setState({ ready: true }); } }, 40);
    this.attach();
  }
  componentDidUpdate(prevProps) {
    if(this.props&&this.props.version!==undefined&&prevProps.version!==this.props.version&&this.props.me)this.applySnapshot(this.props.me,this.props.people,this.props.floor);
    this.attach();
    if(EMBEDDED&&this._opened&&!this.state.modal)this.emit('close');
  }
  componentWillUnmount() { clearInterval(this._t); this._ro && this._ro.disconnect(); clearTimeout(this._toast);if(this._onKey)window.removeEventListener('keydown',this._onKey); }
  emit(type,payload={}){if(this.props&&typeof this.props.onHost==='function')this.props.onHost(type,payload);}
  applySnapshot(me,users,floor){if(!me)return;SESSION.current=me;SESSION.users=users||[];SESSION.floor=floor;this.setState({people:SESSION.referencePeople(SESSION.users,SESSION.current),screen:'space'});}
  focusPerson(id){const p=this.state.people.find(p=>p.sourceId===id||p.id===id);if(!p)return;this.setState({pop:p.id});}
  startPickSeat(){this.setState({pickSeat:true,seatDraft:null,pop:null});}
  async saveAppearance(cfg){try{await SESSION.api.referenceCharacter(cfg);this.emit('saved',{kind:'character'});}catch(error){this.showToast(error.message);}}
  attach() {
    const el = this.mapRef.current;
    if (el && el !== this._roEl) {
      this._ro && this._ro.disconnect(); this._roEl = el;
      const fit = () => { if (Math.abs(el.clientWidth - this.state.vw) > 1 || Math.abs(el.clientHeight - this.state.vh) > 1) this.setState({ vw: el.clientWidth, vh: el.clientHeight }); };
      this._ro = new ResizeObserver(fit); this._ro.observe(el); fit();
    }
  }
  showToast(t) { clearTimeout(this._toast); this.setState({ toast: t }); this._toast = setTimeout(() => this.setState({ toast: null }), 2400); }
  updMe(patch) { this.setState(st => {const people=st.people.map(p=>p.id==='me'?{...p,...patch}:p);try{localStorage.setItem(profileKey(),JSON.stringify(people.find(p=>p.id==='me')));}catch{this._saveFailed=true;}return {people};}); }
  async authenticate(event, demo=false) {
    event?.preventDefault();if(this.state.authBusy)return;
    const values=event?Object.fromEntries(new FormData(event.currentTarget)):{};
    this.setState({authBusy:true,authError:''});
    try{
      const signup=this.state.authMode==='signup'&&!demo;
      if(signup&&values.password!==values.confirm)throw new Error('비밀번호가 일치하지 않아요.');
      SESSION.current=demo?await SESSION.api.demo():signup?await SESSION.api.signup(values):await SESSION.api.login(values.email);
      this.setState({people:initialPeople(),screen:signup||!SESSION.current.complete?'welcome':'space',authBusy:false});history.replaceState({},'', '/office');
    }catch(error){this.setState({authError:error.message,authBusy:false});}
  }
  async logout(){await SESSION.api.logout();SESSION.current=null;this.setState({screen:'auth',authMode:'login',menu:false,modal:null,pop:null,authError:''});history.replaceState({},'','/login');}
  openSettings(){this._notifSnapshot=JSON.parse(JSON.stringify(this.state.notif));this.setState({modal:'settings',menu:false});}
  closeDialog(){const patch={modal:null,ed:null};if(this.state.modal==='settings'&&this._notifSnapshot)patch.notif=this._notifSnapshot;this._notifSnapshot=null;this.setState(patch);}
  setEd(patch) { this.setState(st => ({ ed: { ...st.ed, ...patch } })); }
  setDraft(patch) { this.setState(st => ({ ed: { ...st.ed, draft: { ...st.ed.draft, ...patch } } })); }
  openEditor(from, meOpt) { const me = meOpt || this.state.people.find(p => p.id === 'me'); this.setState({ modal: 'editor', menu: false, ed: { from, step: 'face', otab: me.cfg.special ? 'special' : 'basic', gender: me.cfg.bottom === 'skirt' ? 'f' : 'm', draft: { ...window.SP.defaultChar, ...me.cfg } } }); }
  randomCfg() { const SP = window.SP; return { ...SP.defaultChar, hair: pick(Object.keys(SP.hair)), hairColor: pick(SP.hairColors), eye: pick(SP.eyeColors), skin: pick(SP.skinTones), ...pick(OUTF.f.concat(OUTF.m)), special: null }; }
  notify(body) {
    const n = this.state.notif;
    if(!n.master)return this.showToast('웹 알림이 꺼져 있어요.');
    if(n.quiet&&this.state.people.find(p=>p.id==='me').task==='집중 근무 중')return this.showToast('집중 근무 중에는 알림을 잠시 멈춰요.');
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') { try { new Notification('Senspace', { body }); return; } catch (e) {} }
    this.showToast(body);
  }

  renderVals() {
    const s = this.state, SPx = s.ready ? window.SP : null;
    const C = (cfg, opt) => SPx ? SPx.char(cfg, opt || {}) : BLANK;
    const me = s.people.find(p => p.id === 'me');
    const stop = e => e.stopPropagation();
    const set = p => this.setState(p);
    const scn = s.screen;
    const inSpace = scn === 'space';

    // camera
    const vw = s.vw, vh = s.vh;
    const view = s.selecting || s.pickSeat ? 'all' : s.view;
    const base = view === 'team' ? s.team : { x: 0, y: 0, w: MW, h: MH };
    const z0 = Math.min(vw / base.w, vh / base.h) * (view === 'team' ? 0.92 : 0.98);
    const z = z0 * (s.selecting ? 1 : s.zm);
    const cx = base.x + base.w / 2 + (s.selecting ? 0 : s.panX), cy = base.y + base.h / 2 + (s.selecting ? 0 : s.panY);
    const tx = vw / 2 - cx * z, ty = vh / 2 - cy * z;
    const showText = s.zm >= 1.45;
    const k = 1 / z;
    const toMap = e => { const r = this.mapRef.current.getBoundingClientRect(); return { x: Math.max(0,Math.min(MW,(e.clientX - r.left - tx) / z)), y: Math.max(0,Math.min(MH,(e.clientY - r.top - ty) / z)) }; };

    // people placement
    const seatMap = {}; SEATS.forEach(se => { seatMap[se.id] = se; });
    const placed = s.people.filter(p=>!EMBEDDED||p.floor===SESSION.floor).map(p => { const se = seatMap[p.id === 'me' && s.pickSeat ? (s.seatDraft || p.seat) : p.seat]; return { p, se, present: p.status === 'work' || (p.id === 'me' && s.pickSeat) }; });
    const focus = (p, se) => { const zm = Math.max(s.zm, 1.3 / z0); set({ pop: p.id, view: s.view === 'team' && !(se.x > s.team.x && se.x < s.team.x + s.team.w && se.y > s.team.y && se.y < s.team.y + s.team.h) ? 'all' : s.view, zm, panX: se.x + 18 - (base.x + base.w / 2), panY: se.y - 10 - (base.y + base.h / 2) }); };
    const glow = c => `drop-shadow(2px 0 0 ${c}) drop-shadow(-2px 0 0 ${c}) drop-shadow(0 2px 0 ${c}) drop-shadow(0 -2px 0 ${c})`;
    const mapPeople = placed.map(o => ({ name: o.p.name, img: C(o.p.cfg, { back: o.se.side === 's' }), onClick: () => !s.pickSeat && set({ pop: s.pop === o.p.id ? null : o.p.id }),
      style: { position: 'absolute', left: o.se.x, top: o.se.y, width: 36, height: 56, zIndex: o.se.z, cursor: 'pointer', opacity: o.present ? 1 : 0.42, filter: o.p.id === 'me' ? glow('#8b7fe0') : s.pop === o.p.id ? glow('#f0c04a') : o.present ? 'none' : 'grayscale(.4)', transition: 'transform .15s' } }));
    const bubbles = s.pickSeat ? [] : placed.filter(o => (o.present && o.p.msg)||o.p.status==='away').map(o => {
      const away=o.p.status==='away',reason=REASONS[o.p.reason||'short'];const bubbleText=away?(o.p.awayNote||(o.p.reason?reason.label:'')):o.p.msg;const al = !away&&o.p.alert, isMe = o.p.id === 'me';
      const bg = al ? '#fff0f1' : '#fffdf8', bd = al ? '#f1b3ba' : isMe ? '#8b7fe0' : '#ded1bb', fg = al ? '#cf3646' : '#2e2a44';
      const lift = showText && Math.round((o.se.x - 10) / 56) % 2 ? 22 : 0;
      const bx = Math.max(84, Math.min(MW - 84, o.se.x + 18));
      return { icon:IC(away?reason.icon:(o.p.msgIcon||'heart')),text:bubbleText, showText, onClick: e => { if (e && e.stopPropagation) e.stopPropagation(); if (!s.pickSeat) set({ pop: s.pop === o.p.id ? null : o.p.id }); },
        style: { position: 'absolute', left: bx, top: o.se.y - 8*k - lift, transform: `translate(-50%,-100%) scale(${k})`, transformOrigin: '50% 100%', zIndex: al ? 2200 : isMe ? 2100 : 2000, maxWidth: 150, display: 'flex', alignItems: 'center', gap: 5, padding: showText ? '4px 9px 4px 7px' : '5px', background: bg, border: '2px solid ' + bd, color: fg, borderRadius: 9, font: '12px Galmuri11', whiteSpace: 'nowrap', boxShadow: '0 3px 0 rgba(46,36,51,.18)', pointerEvents: 'auto', cursor: 'pointer' },
        tail: { position: 'absolute', left: '50%', bottom: -6, width: 7, height: 7, marginLeft: -4.5, background: bg, borderRight: '2px solid ' + bd, borderBottom: '2px solid ' + bd, transform: 'rotate(45deg)' } };
    });
    let pop = {};
    const po = s.pop && placed.find(o => o.p.id === s.pop);
    if (po && !s.pickSeat) {
      const p = po.p, st = statusOf(p), r = p.status === 'away' ? REASONS[p.reason || 'short'] : null;
      // Fixed-position overlay: escapes the map viewport so it is never clipped by the map.
      const psx = tx + (po.se.x + 18) * z, psy = ty + (po.se.y - 2) * z;
      const flip = psy < 262;
      pop = { name: p.name, role: p.role, seat: p.seat, img: C(p.cfg),
        statusIcon: IC(p.status === 'work' ? 'work' : p.status === 'off' ? 'off' : r.icon),
        statusTitle: p.status === 'work' ? (p.task || '근무 중') : p.status === 'off' ? '퇴근했어요' : (p.awayNote||r.long),
        statusSub: p.status === 'work' ? p.since + ' 출근' : p.status === 'off' ? '내일 만나요' : p.since + '부터 자리 비움' + (p.task ? ' · ' + p.task : ''),
        statusStyle: { display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', borderRadius: 11, background: st.bg, color: st.color },
        hasMsg: !!p.msg && p.status === 'work', msg: p.msg, msgIcon: IC(p.msgIcon || 'heart'),
        avStyle: { width: 44, height: 44, borderRadius: 12, overflow: 'hidden', background: '#ece8fb', display: 'block', flexShrink: 0 },
        openCard: () => EMBEDDED?this.emit('card',{id:p.sourceId}):set({ modal: 'card', cardId: p.id, pop: null }),
        style: { position: 'fixed', left: Math.max(132, Math.min(vw - 132, psx)), top: flip ? psy + 56 : psy, transform: flip ? 'translate(-50%,0)' : 'translate(-50%,-100%)', zIndex: 5000, width: 250, display: 'flex', flexDirection: 'column', gap: 9, padding: 12, boxSizing: 'border-box', background: '#fbf7ef', border: '2px solid #2e2433', borderRadius: 14, boxShadow: '0 5px 0 rgba(46,36,51,.25)', cursor: 'default' },
        tailStyle: flip
          ? { position: 'absolute', left: '50%', top: -8, width: 12, height: 12, marginLeft: -7, background: '#fbf7ef', borderLeft: '2px solid #2e2433', borderTop: '2px solid #2e2433', transform: 'rotate(45deg)' }
          : { position: 'absolute', left: '50%', bottom: -8, width: 12, height: 12, marginLeft: -7, background: '#fbf7ef', borderRight: '2px solid #2e2433', borderBottom: '2px solid #2e2433', transform: 'rotate(45deg)' } };
    }
    const tm = s.team, M = 'rgba(38,40,72,.8)';
    const teamMask = view === 'team' ? [
      { style: { position: 'absolute', left: -3000, top: -3000, width: 7400, height: 3000 + tm.y, background: M, zIndex: 4000, pointerEvents: 'none' } },
      { style: { position: 'absolute', left: -3000, top: tm.y + tm.h, width: 7400, height: 3000, background: M, zIndex: 4000, pointerEvents: 'none' } },
      { style: { position: 'absolute', left: -3000, top: tm.y, width: 3000 + tm.x, height: tm.h, background: M, zIndex: 4000, pointerEvents: 'none' } },
      { style: { position: 'absolute', left: tm.x + tm.w, top: tm.y, width: 3000, height: tm.h, background: M, zIndex: 4000, pointerEvents: 'none' } }
    ] : [];
    const sr = s.selecting ? s.selRect : (view === 'team' ? tm : null);
    const selRectStyle = sr ? { position: 'absolute', left: sr.x, top: sr.y, width: sr.w, height: sr.h, border: `${2 * k}px dashed #b3a9ee`, borderRadius: 10 * k, background: s.selecting ? 'rgba(139,127,224,.16)' : 'transparent', zIndex: 4001, pointerEvents: 'none', boxSizing: 'border-box' } : {};
    const selLabelStyle = { position: 'absolute', left: 0, top: 0, transform: `translateY(-110%) scale(${k})`, transformOrigin: '0 100%', padding: '4px 9px', borderRadius: 6, background: '#8b7fe0', color: '#fff', font: '12px Galmuri11', whiteSpace: 'nowrap' };
    const taken = new Set(s.people.filter(p => p.id !== 'me'&&(!EMBEDDED||p.floor===SESSION.floor)).map(p => p.seat));
    const draft = s.seatDraft || me.seat;
    const seatMarkers = SEATS.filter(se => !taken.has(se.id)).map(se => { const on = se.id === draft;
      return { id: se.id, onClick: () => set({ seatDraft: se.id }), style: { position: 'absolute', left: se.mx - 6, top: se.my, width: 40, height: 60, border: on ? '2px solid #8b7fe0' : '2px dashed #b3a9ee', background: on ? 'rgba(139,127,224,.35)' : 'rgba(255,255,255,.55)', borderRadius: 9, zIndex: 1800, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 3, boxSizing: 'border-box', font: '10.5px Galmuri11', color: on ? '#fff' : '#5b4fc9', cursor: 'pointer' } }; });

    // list
    const scopeTeam = s.listScope === 'team';
    const order = { work: 0, away: 1, off: 2 };
    const listItems = s.people.filter(p => (!scopeTeam || p.team === 'd') && (!s.q || (p.name + p.role).includes(s.q)))
      .sort((a, b) => (a.id === 'me' ? -1 : b.id === 'me' ? 1 : order[a.status] - order[b.status]))
      .map(p => { const st = statusOf(p), r = p.status === 'away' ? REASONS[p.reason || 'short'] : null, sel = s.pop === p.id;
        const hasMsg = !!p.msg;
        const line = hasMsg ? p.msg : p.status === 'away' ? r.long : p.status === 'off' ? '퇴근했어요' : (p.task || '근무 중');
        const icon = hasMsg ? (p.msgIcon || 'heart') : p.status === 'away' ? r.icon : p.status === 'off' ? 'off' : 'focus';
        const dim = p.status !== 'work';
        return { name: p.name, isMe: p.id === 'me', img: C(p.cfg), line, icon: IC(icon), status: st.label, dot: dotStyle(st.dot),
          statusStyle: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: st.color, whiteSpace: 'nowrap' },
          lineStyle: { display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: hasMsg ? 700 : 500, color: hasMsg ? (p.alert ? '#cf3646' : '#2e2a44') : '#8a8499', maxWidth: '100%', minWidth: 0 },
          avatarStyle: { width: 42, height: 42, flexShrink: 0, borderRadius: 12, overflow: 'hidden', display: 'block', background: dim ? '#ecebf1' : '#ece8fb', opacity: dim ? 0.55 : 1 },
          onClick: () => focus(p, seatMap[p.seat]),
          style: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px', borderRadius: 12, cursor: 'pointer', textAlign: 'left', width: '100%', background: sel ? '#f0ecfb' : 'transparent', border: sel ? '1.5px solid #cfc6f2' : '1.5px solid transparent' } }; });

    // profile panel
    const statusBtns = [['work', '출근', '#3fae6a'], ['away', '자리 비움', '#f0a93b'], ['off', '퇴근', '#a5a8bd']].map(([key, label, col]) => { const on = me.status === key;
      return { label, onClick: () => { set({awayOpen:false}); this.updMe({ status: key, reason: key === 'away' ? (me.reason || 'meal') : null, since:new Intl.DateTimeFormat('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date()) }); this.showToast(label + ' 상태로 바꿨어요'); },
        radio: { width: 14, height: 14, borderRadius: '50%', boxSizing: 'border-box', border: on ? `4px solid ${col}` : '2px solid #cfc2aa', background: '#fff', flexShrink: 0 },
        style: { flex: 1, display: 'flex', alignItems: 'center', gap: 9, padding: '0 12px', borderRadius: 11, cursor: 'pointer', fontSize: 14, fontWeight: 800, textAlign: 'left', background: on ? col + '22' : '#fff', color: '#2e2a44', border: on ? `2px solid ${col}` : '1.5px solid #e2d6c2', boxShadow: on ? `inset 0 -3px 0 ${col}44` : 'inset 0 -2px 0 #efe6d5' } }; });
    const isAway = me.status === 'away', isWork = me.status === 'work';
    const infoChips = isAway ? Object.keys(REASONS).map(rk => ({ label: REASONS[rk].label, icon: IC(REASONS[rk].icon), style: CHIP(me.reason === rk), onClick: () => this.updMe({ reason: rk }) }))
      : WORK.map(([icon, label]) => ({ label, icon: IC(icon), style: CHIP(me.task === label), onClick: () => this.updMe({ task: me.task === label ? '' : label }) }));
    const meSt = statusOf(me);
    const meStatusText = isWork ? (me.task || '근무 중') : isAway ? '자리 비움 · ' + REASONS[me.reason || 'short'].label : '퇴근';

    // senses
    const senseRows = SEN.map(se => { const v = me.senses[se.k];
      const setV = e => { if(me.status==='off')return this.showToast('출근 후 감각 상태를 공유할 수 있어요.'); const r = e.currentTarget.getBoundingClientRect(); const nv = Math.max(1, Math.min(5, Math.round((e.clientX - r.left) / r.width * 4) + 1)); if (nv !== me.senses[se.k]) this.updMe({ senses: { ...me.senses, [se.k]: nv } }); };
      const pctv = (v - 1) / 4 * 100;
      return { label: se.label, icon: IC(se.icon), val: String(v), valStyle: { width: 14, textAlign: 'right', font: '12px Galmuri11', color: v >= 4 ? se.color : '#8a8499' },
        down: e => { e.currentTarget.setPointerCapture && e.currentTarget.setPointerCapture(e.pointerId); setV(e); }, move: e => { if (e.buttons & 1) setV(e); },
        fill: { position: 'absolute', left: 0, top: 8, height: 6, width: pctv + '%', borderRadius: 3, background: se.color, opacity: 0.85 },
        knob: { position: 'absolute', top: 3, left: `calc(${pctv}% - 8px)`, width: 16, height: 16, borderRadius: '50%', boxSizing: 'border-box', background: '#fff', border: '3px solid ' + se.color, boxShadow: '0 2px 0 rgba(46,36,51,.2)' } }; });
    const quickBtns = QUICK.map(q => { const on = me.msg === q.text;
      return { icon: IC(q.icon), text: q.text, onClick: () => { if (on) this.updMe({ msg: '', msgIcon: null, alert: false }); else this.updMe({ msg: q.text, msgIcon: q.icon, alert: q.alert }); },
        style: { height: 38, borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: on ? '#ece8fb' : '#fff', border: on ? '2px solid #8b7fe0' : '1.5px solid #e2d6c2', boxShadow: on ? 'inset 0 -2px 0 #d6cff3' : 'inset 0 -3px 0 #efe6d5' } }; });

    // minimap
    const MB = [['noise', '청각', 'ear'], ['smell', '후각', 'nose'], ['temp', '온도', 'temp'], ['humid', '습도', 'humid']];
    const miniBtns = MB.map(([key, label, icon]) => ({ label, icon: IC(icon), onClick: () => set({ mini: s.mini === key ? null : key }), style: { ...CHIP(s.mini === key), height: 30, justifyContent: 'center', padding: '0 4px', fontSize: 12 } }));
    const miniDots = placed.map(o => { const isMe = o.p.id === 'me', sz = isMe ? 9 : 6, st = statusOf(o.p);
      return { isMe, style: { position: 'absolute', left: (o.se.x + 18) / 14 + '%', top: (o.se.y + 40) / 8 + '%', width: sz, height: sz, margin: `-${sz / 2 + 1.5}px 0 0 -${sz / 2 + 1.5}px`, borderRadius: '50%', background: isMe ? '#8b7fe0' : st.dot, border: '1.5px solid #fff', opacity: o.present ? 1 : 0.45, zIndex: isMe ? 3 : 2 } }; });
    const miniHeat = s.mini ? placed.filter(o => o.present).map(o => { const col = LV[o.p.senses[s.mini]];
      return { style: { position: 'absolute', left: (o.se.x + 18) / 14 + '%', top: (o.se.y + 40) / 8 + '%', width: '22%', aspectRatio: '1', transform: 'translate(-50%,-50%)', borderRadius: '50%', background: `radial-gradient(circle, ${col}dd 0%, ${col}66 38%, ${col}00 70%)`, zIndex: 1 } }; }) : [];
    const vx = Math.max(0, -tx / z), vy = Math.max(0, -ty / z), vx2 = Math.min(MW, (vw - tx) / z), vy2 = Math.min(MH, (vh - ty) / z);
    const miniView = { position: 'absolute', left: vx / 14 + '%', top: vy / 8 + '%', width: Math.max(0, vx2 - vx) / 14 + '%', height: Math.max(0, vy2 - vy) / 8 + '%', border: '2px solid #f0c04a', borderRadius: 3, boxSizing: 'border-box', zIndex: 4, pointerEvents: 'none' };
    const seN = SEN.find(x => x.k === s.mini);

    // onboarding
    const obIdx = s.modal === 'editor' && s.ed && s.ed.from === 'onboard' ? 2 : scn === 'info' ? 1 : 3;
    const obSteps = ['기본 정보', '캐릭터', '내 자리'].map((label, i) => { const on = i + 1 === obIdx, done = i + 1 < obIdx;
      return { n: done ? '✓' : String(i + 1), label, line: i > 0, labelStyle: { fontSize: 13, fontWeight: 800, color: on ? '#2b2d55' : '#9a9384' },
        numStyle: { width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '700 12px Galmuri11', background: on ? '#2b2d55' : done ? '#8b7fe0' : '#e7e0d2', color: on || done ? '#fff' : '#9a9384' } }; });
    const sel = (label, value, options, key) => ({ label, options: options.map(v => ({ v, sel: v === value })), onChange: e => { set({ [key]: e.target.value }); if (key === 'job') this.updMe({ role: e.target.value }); } });
    const infoSelects = [sel('직무', s.job, [...new Set([me.role,'프로덕트 디자이너','FE 엔지니어','BE 엔지니어','UX 리서처','그래픽 디자이너','UI 디자이너','BX 디자이너','PM'].filter(Boolean))], 'job'), sel('직책 (선택)', s.rank, ['팀원', '파트 리드', '팀장', '인턴'], 'rank')];

    // editor
    let ed = {}; const E = s.ed;
    if (s.modal === 'editor' && E && SPx) {
      const d = E.draft;
      const sw = (list, key, size) => list.map(c => ({ onClick: () => this.setDraft({ [key]: c, special: key === 'skin' || key === 'eye' ? d.special : null }), style: { width: size, height: size, borderRadius: '50%', cursor: 'pointer', padding: 0, background: c, border: d[key] === c ? '3px solid #fff' : '2px solid rgba(46,36,51,.12)', boxShadow: d[key] === c ? '0 0 0 2px #5b4fc9' : 'inset 0 -2px 0 rgba(0,0,0,.15)' } }));
      const card = on => ({ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 20, borderRadius: 18, cursor: 'pointer', background: on ? '#fff' : '#faf6ee', border: on ? '2px solid #8b7fe0' : '2px solid #efe6d5', boxShadow: on ? '0 0 0 4px rgba(139,127,224,.14), inset 0 -4px 0 #e4defa' : 'inset 0 -3px 0 #efe6d5', color: '#2e2a44', textAlign: 'center' });
      const titles = { face: ['얼굴', '머리 모양과 색을 골라주세요'], outfit: ['옷 스타일', '기본 의상 또는 특별 스킨을 골라주세요'] };
      const finish = () => { if(EMBEDDED)return this.saveAppearance({...d});this.updMe({ cfg: { ...d } }); if (E.from === 'onboard') this.setState({ modal: null, ed: null, screen: 'space', pickSeat: true, seatDraft: null, pop: null }); else { this.setState({ modal: null, ed: null }); this.showToast('캐릭터를 저장했어요'); } };
      const prevMap = { face: null, outfit: 'face' };
      const grpItems = ks => ks.map(kk => ({ name: kk ? SPx.special[kk].name : '없음', img: C({ ...d, special: kk }), style: { ...OPT(d.special === kk), padding: '8px 4px 6px' }, onClick: () => this.setDraft({ special: kk }) }));
      ed = { title: titles[E.step][0], sub: titles[E.step][1],
        isFace: E.step === 'face', isOutfit: E.step === 'outfit',
        showPreview: ['face', 'outfit'].includes(E.step), showTools: true, showNav: true,
        heads: Object.keys(SPx.hair).map(h => ({ img: C({ ...d, hair: h, special: null }), style: OPT(!d.special && d.hair === h), onClick: () => this.setDraft({ hair: h, special: null }) })),
        swRows: [{ label: '머리 색', sw: sw(SPx.hairColors, 'hairColor', 26) }, { label: '눈 색', sw: sw(SPx.eyeColors, 'eye', 26) }, { label: '피부 톤', sw: sw(SPx.skinTones, 'skin', 26) }],
        outTabs: [['basic', '기본 의상'], ['special', '특별 스킨']].map(([kk, label]) => ({ label, onClick: () => this.setEd({ otab: kk }), style: { ...VSEG(E.otab === kk), flex: 1, height: 38, border: '1.5px solid ' + (E.otab === kk ? '#2b2d55' : '#e2d6c2'), background: E.otab === kk ? '#2b2d55' : '#fff' } })),
        isBasic: E.otab === 'basic', isSpecial: E.otab === 'special',
        genders: [['f', '여자'], ['m', '남자']].map(([g, label]) => ({ label, onClick: () => this.setEd({ gender: g }), style: SEG(E.gender === g) })),
        outfits: OUTF[E.gender].map(o => ({ img: C({ ...d, ...o, special: null }), style: { ...OPT(!d.special && d.outfit === o.outfit && d.top === o.top && d.bottom === o.bottom), padding: '10px 4px' }, onClick: () => this.setDraft({ ...o, special: null }) })),
        specialGroups: [{ label: '안테나 슈트', items: grpItems(['a_red', 'a_yellow', 'a_green', 'a_purple']) }, { label: '동물 후드', items: grpItems([null, 'bear', 'cat', 'frog', 'bunny']) }],
        preview: C(d), reset: () => this.setEd({ draft: { ...SPx.defaultChar, ...me.cfg } }), shuffle: () => this.setEd({ draft: { ...d, ...this.randomCfg() } }),
        prevLabel: '← 이전', nextLabel: E.step === 'outfit' ? '완료하기 ✓' : '다음 →',
        prev: () => { const pv = prevMap[E.step]; if (pv) this.setEd({ step: pv }); else if (E.from === 'onboard') this.setState({ modal: null, ed: null, screen: 'info' }); else this.setState({ modal: null, ed: null }); },
        next: () => { if (E.step === 'face') this.setEd({ step: 'outfit' }); else if (E.step === 'outfit') finish(); },
        nextStyle: { flex: 1, height: 50, border: 'none', borderRadius: 12, background: '#2b2d55', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', boxShadow: 'inset 0 -4px 0 #17183a, inset 0 1px 0 rgba(255,255,255,.16)' } };
    }
    const edOnboard = !!(E && E.from === 'onboard');

    // card
    let card = {};
    if (s.modal === 'card') { const cp = s.people.find(p => p.id === s.cardId) || me, st = statusOf(cp), isMe = cp.id === 'me';
      card = { img: C(cp.cfg), name: cp.name, role: cp.role, seat: cp.seat, isMe, notMe: !isMe, title: isMe ? '나의 감각 카드' : cp.name + '님의 감각 카드', chip: chipStyle(st), dotStyle: dotStyle(st.dot), statusFull: st.full, desc: cp.desc || '아직 추가 설명이 없어요.',
        sensi: SENSI.map(se => { const v = cp.sensi[se.k] || 3; return { label: se.label, icon: IC(se.icon), valText: SENSI_TXT[v], valStyle: { fontSize: 12.5, fontWeight: 800, color: v >= 4 ? se.color : '#8a8499' }, dots: [1, 2, 3, 4, 5].map(n => ({ style: { ...dotSq(n <= v, se.color, 18), cursor: isMe ? 'pointer' : 'default' }, onClick: () => isMe && this.updMe({ sensi: { ...me.sensi, [se.k]: n } }) })) }; }),
        senses: SEN.map(se => { const v = cp.senses[se.k]; return { label: se.label, icon: IC(se.icon), valText: v <= 2 ? se.lo : v >= 4 ? se.hi : '보통', valStyle: { width: 50, textAlign: 'right', fontSize: 11.5, fontWeight: 800, color: v >= 4 ? se.color : '#8a8499' }, fill: { position: 'absolute', left: 0, top: 0, bottom: 0, width: v * 20 + '%', background: se.color, borderRadius: 3 } }; }) };
    }

    // settings
    const n = s.notif;
    const setN = patch => this.setState(st => ({ notif: { ...st.notif, ...patch } }));
    const notifRows = NOTIFS.map(([key, icon, title, desc], i) => ({ icon: IC(icon), title, desc, onClick: () => setN({ items: { ...n.items, [key]: !n.items[key] } }), box: checkBox(n.items[key] && n.master),
      rowStyle: { display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '11px 14px', border: 'none', borderTop: i ? '1px solid #f1eadc' : 'none', background: 'transparent', cursor: 'pointer', opacity: n.master ? 1 : 0.5 } }));
    const scopeBtns = [['team', '내 팀'], ['floor', '같은 층'], ['fav', '즐겨찾는 동료']].map(([kk, label]) => ({ label, onClick: () => setN({ scope: kk }), style: SEG(n.scope === kk) }));
    const permLabel = { granted: '허용됨', denied: '차단됨', default: '아직 묻지 않음', unsupported: '지원 안 됨' }[s.perm] || s.perm;

    const MI = (label, icon, hint, onClick) => ({ label, icon: IC(icon), hint, onClick });
    const counts = [['전체', s.people.length, '#4a8fe0'], ['출근', s.people.filter(p => p.status === 'work').length, '#3fae6a'], ['자리 비움', s.people.filter(p => p.status === 'away').length, '#f0a93b'], ['퇴근', s.people.filter(p => p.status === 'off').length, '#a5a8bd']].map(([label, c, col]) => ({ label, n: String(c), dot: dotStyle(col) }));
    const blur = scn !== 'space' || false;

    return {
      isAuth:scn==='auth',isSignup:s.authMode==='signup',isLogin:s.authMode==='login',authTitle:s.authMode==='signup'?'함께할 준비 되셨나요?':'다시 만나 반가워요',authSubmit:s.authMode==='signup'?'내 사무실 만들기':'사무실 입장하기',authError:s.authError,authBusy:s.authBusy,passwordAutocomplete:s.authMode==='signup'?'new-password':'current-password',showLogin:()=>{set({authMode:'login',authError:''});history.replaceState({},'','/login');},showSignup:()=>{set({authMode:'signup',authError:''});history.replaceState({},'','/signup');},submitAuth:e=>this.authenticate(e),enterDemo:()=>this.authenticate(null,true),
      isEmail: scn === 'email', showSpace: (!EMBEDDED||this.mode==='map')&&scn !== 'email'&&scn!=='auth', isWelcome: scn === 'welcome', isInfo: scn === 'info' && s.modal !== 'editor',
      heroA: C({ hair: 'bob' }), heroB: C({ hair: 'short', hairColor: '#2e2a36', outfit: 'hoodie', top: '#5aa96a' }), heroC: C({ special: 'a_red' }),
      goWelcome: () => set({ screen: 'welcome' }), goInfo: () => set({ screen: 'info' }), goChar: () => me.name.trim()?this.openEditor('onboard'):this.showToast('이름을 입력해 주세요'),
      welcomeHeads: s.people.filter(p => p.team === 'd' && p.id !== 'me').slice(0, 5).map(p => C(p.cfg)), teamCount: String(s.people.filter(p => p.team === 'd' && p.id !== 'me').length),
      onName: e => this.updMe({ name: e.target.value }), infoSelects, obSteps,
      spaceStyle: { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: '#f1e9dc', filter: blur ? 'blur(5px)' : 'none', pointerEvents: blur ? 'none' : 'auto' },
      counts, me, meImg: C(me.cfg), toggleMenu: () => set({ menu: !s.menu }), showMenu: s.menu,
      menuItems: [MI('내 감각 카드', 'eye', '', () => set({ modal: 'card', cardId: 'me', menu: false })), MI('캐릭터 꾸미기', 'heart', '', () => this.openEditor('header')), MI('내 자리 변경', 'work', me.seat, () => set({ menu: false, pickSeat: true, seatDraft: null, pop: null })), MI('설정 · 알림', 'help', '', () => this.openSettings()), MI('로그아웃', 'off', '', () => this.logout())],
      openSettings: () => this.openSettings(), notifOn: n.master,
      mapRef: this.mapRef, stop,
      vpStyle: { flex: 1, minWidth: 0, position: 'relative', borderRadius: 18, overflow: 'hidden', backgroundColor: '#262848', backgroundImage: 'radial-gradient(#33366a 1.5px,transparent 1.5px)', backgroundSize: '24px 24px', touchAction: 'none', cursor: this._drag ? 'grabbing' : 'grab', userSelect: 'none' },
      layerStyle: { position: 'absolute', left: 0, top: 0, width: MW, height: MH, transform: `translate(${tx}px,${ty}px) scale(${z})`, transformOrigin: '0 0' },
      vpDown: e => { if (s.selecting) return; this._drag = { x: e.clientX, y: e.clientY, px: s.panX, py: s.panY, moved: false }; e.currentTarget.setPointerCapture && e.currentTarget.setPointerCapture(e.pointerId); },
      vpMove: e => { const d = this._drag; if (!d) return; const dx = e.clientX - d.x, dy = e.clientY - d.y; if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true; if (d.moved) set({ panX: d.px - dx / z, panY: d.py - dy / z }); },
      vpUp: () => { const d = this._drag; this._drag = null; if (d && !d.moved) set({ pop: null }); else this.forceUpdate(); },
      vpWheel: e => { if (s.selecting) return; const f = e.deltaY < 0 ? 1.12 : 1 / 1.12; set({ zm: Math.max(0.7, Math.min(4, s.zm * f)) }); },
      furniture: FURN.map(f => ({ ...f, src: R(f.src) })), mapPeople, bubbles, hasPop: !!po && !s.pickSeat, pop, closePop: () => set({ pop: null }),
      teamMask, hasSelRect: !!sr && sr.w > 0, selRectStyle, selLabelStyle, teamName: '디자인팀',
      viewAll: () => set({ view: 'all', zm: 1, panX: 0, panY: 0 }), viewTeam: () => set({ view: 'team', zm: 1, panX: 0, panY: 0 }),
      viewAllStyle: VSEG(view === 'all'), viewTeamStyle: VSEG(view === 'team'),
      startSelect: () => set({ selecting: true, selRect: null, pop: null }), cancelSelect: () => set({ selecting: false, selRect: null }),
      selDown: e => { e.stopPropagation(); this._sel = toMap(e); e.currentTarget.setPointerCapture && e.currentTarget.setPointerCapture(e.pointerId); set({ selRect: { x: this._sel.x, y: this._sel.y, w: 0, h: 0 } }); },
      selMove: e => { if (!this._sel) return; const p = toMap(e), a = this._sel; set({ selRect: { x: Math.min(a.x, p.x), y: Math.min(a.y, p.y), w: Math.abs(p.x - a.x), h: Math.abs(p.y - a.y) } }); },
      selUp: () => { this._sel = null; },
      saveTeam: () => { const r = s.selRect; if (!r || r.w < 60 || r.h < 60) return this.showToast('조금 더 크게 드래그해 주세요'); try { localStorage.setItem(EMBEDDED?'senspace.team.'+SESSION.floor:'senspace.team', JSON.stringify(r)); } catch (e) {} set({ team: r, selecting: false, selRect: null, view: 'team', zm: 1, panX: 0, panY: 0 }); this.showToast('내 팀 영역을 저장했어요'); },
      saveTeamStyle: { height: 36, padding: '0 14px', borderRadius: 10, border: 'none', background: s.selRect && s.selRect.w > 60 ? '#2b2d55' : '#b9b7cc', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: 'inset 0 -3px 0 rgba(0,0,0,.25)' },
      selecting: s.selecting,
      zoomIn: () => set({ zm: Math.min(4, s.zm * 1.25) }), zoomOut: () => set({ zm: Math.max(0.7, s.zm / 1.25) }), zoomFit: () => set({ zm: 1, panX: 0, panY: 0 }), zoomLabel: Math.round(s.zm * 100) + '%',
      showZoomHint: !showText && !s.selecting && !s.pickSeat && inSpace,
      toggleFull: () => EMBEDDED ? this.emit('expand', { floor: SESSION.floor }) : set({ full: !s.full }), fullIcon: s.full ? 'M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5' : 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5', showSide: !EMBEDDED&&!s.full,
      pickSeat: s.pickSeat, seatMarkers, seatDraft: '3F ' + draft,
      confirmSeat: async () => { if(taken.has(draft))return this.showToast('이미 사용 중인 자리예요');if(EMBEDDED){try{await SESSION.api.referenceSeat(draft);this.setState({pickSeat:false,seatDraft:null});this.emit('saved',{kind:'seat'});this.showToast('자리를 변경했어요');}catch(error){this.showToast(error.message);}return;}try{SESSION.current=await SESSION.api.completeOnboarding({name:me.name,role:me.role});}catch(error){return this.showToast(error.message);} this.updMe({ seat: draft, status: 'work', reason: null }); set({ pickSeat: false, seatDraft: null }); this.showToast('3층 ' + draft + ' 자리에 입장했어요'); },
      listItems, listCount: String(listItems.length), q: s.q, onQ: e => set({ q: e.target.value }),
      listTeam: () => set({ listScope: 'team' }), listAll: () => set({ listScope: 'all' }), listTeamStyle: { ...SEG(scopeTeam), height: 28, padding: '0 10px', fontSize: 12 }, listAllStyle: { ...SEG(!scopeTeam), height: 28, padding: '0 10px', fontSize: 12 },
      openMyCard: () => set({ modal: 'card', cardId: 'me' }),
      editorBackdrop: EMBEDDED ? 'transparent' : 'rgba(30,31,60,.5)',
      settingsBackdrop: EMBEDDED ? 'transparent' : 'rgba(30,31,60,.55)',
      clockButtons:statusBtns.filter(b=>b.label!=='자리 비움'),awayOpen:s.awayOpen,awayDraft:s.awayDraft,
      toggleAway:()=>{const open=!s.awayOpen;set({awayOpen:open,awayDraft:me.awayNote||''});if(open&&me.status!=='away')this.updMe({status:'away',reason:null,awayNote:''});},
      onAwayDraft:e=>set({awayDraft:e.target.value}),saveAway:e=>{e.preventDefault();this.updMe({awayNote:s.awayDraft.trim()});this.showToast('자리 비움 사유를 저장했어요');}, meStatusText, statusBtns, chipTitle: isAway ? '자리 비운 이유' : isWork ? '근무 정보' : '퇴근', showChips: !(me.status === 'off'), isOff: me.status === 'off', infoChips,
      senseRows, quickBtns, onMsg: e => this.updMe({ msg: e.target.value, msgIcon: me.msgIcon || 'heart', alert: false }), msgCount: String((me.msg || '').length), msgIcon: IC(me.msgIcon || 'heart'),
      miniBtns, miniRects: MINI, miniDots, miniHeat, miniView, miniOn: !!s.mini, miniOff: !s.mini, miniLo: seN ? seN.lo : '', miniHi: seN ? seN.hi : '',
      miniClick: e => { const r = e.currentTarget.getBoundingClientRect(); const mx = (e.clientX - r.left) / r.width * MW, my = (e.clientY - r.top) / r.height * MH; set({ panX: mx - (base.x + base.w / 2), panY: my - (base.y + base.h / 2), zm: Math.max(s.zm, 1.2 / z0) }); },
      showEditor: s.modal === 'editor' && !!SPx && !!E, ed, edOnboard, edClosable: !edOnboard, closeEditorBackdrop: () => { if (!edOnboard) set({ modal: null, ed: null }); },
      showCard: s.modal === 'card', card, closeModal: () => this.closeDialog(), editChar: () => this.openEditor('header'), onDesc: e => this.updMe({ desc: e.target.value }),
      showSettings: s.modal === 'settings', notifRows, scopeBtns, permLabel, permStyle: { color: s.perm === 'granted' ? '#2f8a52' : '#b8701a' }, needPerm: s.perm === 'default',
      askPerm: () => { if (typeof Notification === 'undefined') return; Notification.requestPermission().then(p => set({ perm: p })).catch(() => {}); },
      toggleMaster: () => setN({ master: !n.master }),
      masterStyle: { width: 48, height: 28, borderRadius: 14, border: 'none', padding: 3, cursor: 'pointer', background: n.master ? '#3fae6a' : '#d8d0c0', display: 'flex', justifyContent: n.master ? 'flex-end' : 'flex-start', boxShadow: 'inset 0 2px 0 rgba(0,0,0,.12)', flexShrink: 0 },
      masterKnob: { width: 22, height: 22, borderRadius: '50%', background: '#fff', boxShadow: '0 2px 0 rgba(0,0,0,.18)' },
      toggleQuiet: () => setN({ quiet: !n.quiet }), quietBox: checkBox(n.quiet),
      testNotif: () => { const on = NOTIFS.filter(([key]) => n.items[key]).map(x => x[2]); this.notify(on.length ? `최민수님이 "지금 소리에 예민해요" 상태예요 (${on[0]})` : '선택한 알림이 없어요'); },
      saveSettings: () => { this._notifSnapshot=null;try { localStorage.setItem('senspace.notif', JSON.stringify(n)); } catch (e) {} set({ modal: null }); this.showToast('알림 설정을 저장했어요'); },
      hasToast: !!s.toast, toast: s.toast || ''
    };
  }
}
// The React entry imports this file for its side effect and reads the class here.
if (typeof window !== 'undefined') window.__SenspaceComponent = Component;
