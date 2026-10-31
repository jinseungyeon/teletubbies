import { createAdapter, SENSES, SENSITIVITY, TRAITS, SEATS, FLOORS, STATUS, REASONS, COMPANY, MAP_SIZE, QUICK_STATUS, ALERT_ICONS, iconKey, currentSenses, todaySenses, charCount } from './data.js';
import { avatar, officeSVG } from './map.js';
import { HAIR_STYLES, HAIR_COLORS, EYE_COLORS, OUTFITS, OUTFIT_PALETTES, SKINS, GENDERS, DEFAULT_CHARACTER, legacyCharacter, randomCharacter, characterFromPixels, characterSVG, shade } from './character.js';
import { pixelIconSVG, iconHTML, iconGrid, IMAGE_ICONS } from './pixel-icons.js';
import { HEATMAP_VIEWS, HEAT_COLORS, heatSamples, heatmapSVG } from './heatmap.js';

const api = createAdapter(localStorage);
const app=document.querySelector('#app'), modalRoot=document.querySelector('#modal-root');
let me=null, people=[], floor=3, filter='all', query='', menuOpen=false, mapZoom=1, draft=null, step=1, modalKind='', modalUser=null, lastFocus=null, toastTimer;
let miniView='noise';
let awayEditorOpen=false;
let referenceFocus=null;
function sendReferenceSnapshot(frame){
  if(!me||!frame?.contentWindow)return;
  frame.contentWindow.postMessage({source:'senspace-host',type:'snapshot',me,people,floor},location.origin);
}
function openReference(mode){
  lastFocus=document.activeElement;modalKind='reference-'+mode;
  modalRoot.innerHTML=`<div class="modal-backdrop"><section class="reference-dialog" role="dialog" aria-modal="true" aria-label="${mode==='editor'?'캐릭터 꾸미기':'설정 · 알림'}"><iframe class="reference-frame reference-modal-frame" src="/senspace-components.html?component=${mode}&floor=${floor}" title="${mode==='editor'?'캐릭터 꾸미기':'설정 · 알림'}"></iframe></section></div>`;
  app.inert=true;document.body.classList.add('modal-open');modalRoot.querySelector('iframe').focus();
}
function openMapExpand(){
  openModal('사무실 지도 크게 보기',`<div class="map-expand"><iframe id="reference-map-expand" class="reference-frame" src="/senspace-components.html?component=map&floor=${floor}" title="사무실 지도 크게 보기"></iframe></div>`,'map-expand',true);
}
window.addEventListener('message',async event=>{
  if(event.origin!==location.origin||event.data?.source!=='senspace-component')return;
  const frame=[...document.querySelectorAll('iframe.reference-frame')].find(f=>f.contentWindow===event.source);if(!frame)return;
  const data=event.data;
  try{
    if(data.type==='ready'){sendReferenceSnapshot(frame);if(frame.id==='reference-map'&&referenceFocus){frame.contentWindow.postMessage({source:'senspace-host',type:'focus',id:referenceFocus},location.origin);referenceFocus=null;}}
    if(data.type==='card'&&people.some(p=>p.id===data.id))showCard(data.id);
    if(data.type==='expand')openMapExpand();
    if(data.type==='close'){closeModal();if(location.pathname==='/character')go(me.complete?(profileStash?'/profile':'/office'):'/login');}
    if(data.type==='saved'){
      await sync();
      if(data.kind==='character'){closeModal();go(me.complete?(profileStash?'/profile':'/office'):'/onboarding');toast('캐릭터를 저장했어요.');}
      else {sendReferenceSnapshot(frame);updateList();renderPanel();}
    }
  }catch(error){toast(error.message);}
});
let profileStash=null;
const restoreDraft=()=>{const d=profileStash?{...profileStash,character:me.character}:structuredClone(me);profileStash=null;return d;};
let charDraft=null, charStep=1, charMethod='custom', faceTab='hair', outfitTab='basic', photoURL='', photoLook=null;
const look=u=>u?.referenceCharacter?{reference:u.referenceCharacter}:u?.character||u?.avatar||0;
// Face-only profile image: crops the standing sprite to head and shoulders.
const faceAvatar=(l,size)=>`<span class="avatar-face" style="width:${size}px;height:${size}px;flex:0 0 ${size}px">${avatar(l,size)}</span>`;
const esc = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Pixel-art icons (see pixel-icons.js): design PNGs first, drawn sprites otherwise.
function icon(name,size=20){return iconHTML(name,size);}
function bubbleIcon(name){
  if(IMAGE_ICONS[name])return icon(name,24);
  const points=iconGrid(name).flatMap((row,y)=>row.flatMap((pixel,x)=>pixel==='.'?[]:[[x,y]]));
  const xs=points.map(([x])=>x),ys=points.map(([,y])=>y);
  const x=Math.min(...xs),y=Math.min(...ys),w=Math.max(...xs)-x+1,h=Math.max(...ys)-y+1;
  return icon(name,24).replace('viewBox="0 0 16 16"',`viewBox="${x} ${y} ${w} ${h}"`);
}
function brand() {return `<a href="/office" data-nav="/office" class="brand"><span class="brand-mark">${icon('spark',24)}</span><span>Sensory<span class="brand-light"> Fit</span><small>OUR LITTLE OFFICE</small></span></a>`;}
function badge(u) {return `<span class="status-pill ${u.status}"><i></i>${u.status==='away'?esc(u.reason)+' 중'+(u.awayNote?' · '+esc(u.awayNote):''):STATUS[u.status]}</span>`;}
function toast(message) {const el=document.querySelector('#toast');el.textContent=message;el.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),3200);}
function go(url) {closeModal();history.pushState({},'',url);renderRoute();}
async function sync(){me=await api.me();people=await api.list();}
async function renderRoute() {
  try {
    await sync();const route=location.pathname;
    if(!me && !['/login','/signup'].includes(route)){history.replaceState({},'','/login');}
    if(me && !me.complete && !['/onboarding','/character','/login','/signup'].includes(location.pathname))history.replaceState({},'','/onboarding');
    switch(location.pathname){case '/signup':renderAuth(true);break;case '/login':renderAuth(false);break;case '/character':if(!me)return go('/login');if(me.complete)renderOffice();else app.innerHTML='<main class="reference-character-page"></main>';openReference('editor');break;case '/onboarding':if(!me)return go('/login');if(!me.character)return go('/character');draft=restoreDraft();step=1;renderProfile(true);break;case '/profile':if(!me)return go('/login');draft=restoreDraft();renderProfile(false);break;default:if(!me)return go('/login');floor=me.floor;menuOpen=false;renderOffice();}
  }catch(error){app.innerHTML=`<main class="fatal"><h1>화면을 불러오지 못했어요</h1><p>${esc(error.message)}</p><button class="primary" data-action="retry">다시 시도</button></main>`;}
}
function renderAuth(signup) {
  app.innerHTML=`<main class="reference-auth"><section class="reference-auth-card"><div class="reference-auth-hero"><span class="reference-wordmark">SENSPACE<span>✦</span></span><span class="reference-auth-person">${avatar(0,54)}</span><span class="reference-auth-person second">${avatar(3,54)}</span><img src="/src/assets/furniture/workdesk.png" alt="" /></div><div class="reference-auth-body"><h1>${signup?'함께할 준비 되셨나요?':'다시 만나 반가워요'}</h1><p>서로의 감각을 이해하는 우리 팀의 사무실</p><div class="reference-auth-tabs"><a href="/login" data-nav="/login" class="${signup?'':'active'}">로그인</a><a href="/signup" data-nav="/signup" class="${signup?'active':''}">회원가입</a></div><form id="auth-form" data-signup="${signup}">${signup?'<label>이름<input name="name" autocomplete="name" required maxlength="30" placeholder="이름을 입력해 주세요" /></label>':''}<label>회사 이메일<input type="email" name="email" autocomplete="email" required placeholder="name@company.com" /></label><label>비밀번호<input type="password" name="password" autocomplete="${signup?'new-password':'current-password'}" required minlength="8" placeholder="8자 이상 입력해 주세요" /></label>${signup?'<label>비밀번호 확인<input type="password" name="confirm" autocomplete="new-password" required minlength="8" placeholder="비밀번호를 다시 입력해 주세요" /></label><label>기업 초대 코드<input name="code" required placeholder="ONYU2026" /></label>':''}<p class="form-error" role="alert"></p><button class="primary full" type="submit">${signup?'내 사무실 만들기':'사무실 입장하기'}</button></form><button class="secondary full" data-action="demo">데모 사무실 둘러보기</button><p class="reference-demo-note">로컬 데모 · 비밀번호는 저장하거나 인증하지 않아요.<br>초대 코드 ONYU2026</p></div></section></main>`;
}
const FLOOR_TEAMS={3:'디자인 팀',2:'마케팅 팀'};
const AWAY_META={점심:['lunch','점심 식사 중'],미팅:['meeting','회의 중'],외근:['outside','외근 중']};
// Map zoom: 1 = whole floor with status icons only; above 1 the map scrolls
// and speech bubbles show full messages.
const ZOOM_MIN=1,ZOOM_MAX=2.5,ZOOM_STEP=0.5;
function setMapZoom(next){
  const map=document.querySelector('.hub-map'),scroll=document.querySelector('#map-scroll');if(!map||!scroll)return;
  next=Math.min(ZOOM_MAX,Math.max(ZOOM_MIN,next));if(next===mapZoom)return;
  // keep the point at the centre of the view in place
  const cx=(scroll.scrollLeft+scroll.clientWidth/2)/scroll.scrollWidth,cy=(scroll.scrollTop+scroll.clientHeight/2)/scroll.scrollHeight;
  mapZoom=next;
  map.style.setProperty('--z',mapZoom);map.classList.toggle('zoomed',mapZoom>1);
  document.querySelector('#zoom-label').textContent=`${Math.round(mapZoom*100)}%`;
  map.querySelector('[data-action="zoom-out"]').disabled=mapZoom<=ZOOM_MIN;map.querySelector('[data-action="zoom-in"]').disabled=mapZoom>=ZOOM_MAX;
  scroll.scrollTo(cx*scroll.scrollWidth-scroll.clientWidth/2,cy*scroll.scrollHeight-scroll.clientHeight/2);
}
const pct=(seat,dy=36)=>`left:${seat.x/MAP_SIZE.width*100}%;top:${(seat.y+dy)/MAP_SIZE.height*100}%`;
function statusInfo(u){
  if(u.status==='offline')return {icon:'off',text:'퇴근',tone:'offline'};
  if(u.status==='away'){const [i,t]=AWAY_META[u.reason]||['away','자리 비움'];return {icon:i,text:u.awayNote?`${t} · ${u.awayNote}`:t,tone:'away'};}
  return u.message?{icon:iconKey(u.messageIcon)||'message',text:u.message,tone:ALERT_ICONS.has(iconKey(u.messageIcon))?'alert':'message'}:{icon:'work',text:'근무 중',tone:'working'};
}
function hubCounts(){const n=s=>people.filter(u=>u.status===s).length;return `<span><i class="dot all"></i>전체 <b>${people.length}</b></span><span><i class="dot working"></i>출근 <b>${n('working')}</b></span><span><i class="dot away"></i>자리 비움 <b>${n('away')}</b></span><span><i class="dot offline"></i>퇴근 <b>${n('offline')}</b></span>`;}
function floorOptions(){return FLOORS.slice().sort((a,b)=>b-a).map(f=>`<option value="${f}" ${floor===f?'selected':''}>${f}층 · ${FLOOR_TEAMS[f]||''}</option>`).join('');}
function renderOffice(){
  app.innerHTML=`<div class="hub"><header class="hub-top">${brand()}<label class="hub-pill hub-floor"><span class="sr-only">사무실 층</span><select id="floor">${floorOptions()}</select></label><div class="hub-pill hub-counts" id="hub-counts" aria-label="근무 현황">${hubCounts()}</div><div class="hub-top-right"><button class="hub-icon hub-bell" data-action="notifications" aria-label="알림">${icon('bell',24)}</button><div class="hub-menu-wrap"><button class="hub-me" data-action="menu" aria-haspopup="menu" aria-expanded="${menuOpen}">${faceAvatar(look(me),30)}<span><strong>${esc(me.name)}</strong><small>${esc(me.role)}</small></span>${icon('chevron',16)}</button>${menuOpen?`<div class="hub-menu" role="menu"><button role="menuitem" data-nav="/profile">${icon('edit',16)}프로필 수정</button><button role="menuitem" data-nav="/character">${icon('spark',16)}캐릭터 꾸미기</button><button role="menuitem" data-action="notifications">${icon('bell',16)}설정 · 알림</button><button role="menuitem" data-action="logout">${icon('logout',16)}로그아웃</button></div>`:''}</div></div></header>
  <main class="hub-main"><section class="hub-map reference-map-host" aria-label="${floor}층 사무실 지도"><iframe id="reference-map" class="reference-frame reference-map-frame" src="/senspace-components.html?component=map&floor=${floor}" title="사무실 지도 · 팀 영역과 좌석 배치"></iframe></section>
  <aside class="hub-side" aria-label="동료 목록"><div class="hub-side-head"><h2>동료 목록 <span id="colleague-count"></span></h2><label class="hub-select"><span class="sr-only">상태 필터</span><select id="filter-select">${[['all','전체'],['working','출근'],['away','자리 비움'],['offline','퇴근']].map(([k,n])=>`<option value="${k}" ${filter===k?'selected':''}>${n}</option>`).join('')}</select></label></div><label class="hub-search">${icon('search',17)}<span class="sr-only">동료 검색</span><input id="search" type="search" placeholder="이름, 직책으로 찾기" value="${esc(query)}" /></label><div id="colleague-list" class="hub-list"></div></aside>
  <section class="hub-bottom"><article class="hub-card hub-profile" id="hub-profile"></article><article class="hub-card hub-info" id="hub-info"></article><article class="hub-card hub-mini" id="hub-mini"></article></section></main></div>`;
  updateMap();updateList();renderPanel();renderMini();
}
function updateMap(){
  const referenceMap=document.querySelector('#reference-map');if(referenceMap){sendReferenceSnapshot(referenceMap);const counts=document.querySelector('#hub-counts');if(counts)counts.innerHTML=hubCounts();return;}
  const root=document.querySelector('#map-people');if(!root)return;
  root.innerHTML=people.filter(u=>u.floor===floor).map(u=>{const seat=SEATS.find(s=>s.id===u.seat);if(!seat)return '';const info=statusInfo(u);return `<button class="map-person ${u.status} ${u.id===me.id?'is-me':''}" style="${pct(seat)}" data-person="${u.id}" title="${esc(u.name)} · ${esc(info.text)}" aria-label="${esc(u.name)}, ${esc(info.text)}">${u.status!=='offline'&&info.tone!=='working'?`<span class="hub-bubble ${info.tone} ${SEATS.indexOf(seat)%2?'lift':''}">${bubbleIcon(info.icon)}<span>${esc(u.status==='away'?(u.awayNote||u.reason||''):info.text)}</span></span>`:''}${avatar(look(u),40)}<span class="person-name">${esc(u.name)}${u.id===me.id?'<i>나</i>':''}</span></button>`;}).join('');
  const counts=document.querySelector('#hub-counts');if(counts)counts.innerHTML=hubCounts();
}
function updateList(){
  const list=people.filter(u=>(filter==='all'||u.status===filter)&&`${u.name} ${u.role}`.includes(query));
  document.querySelector('#colleague-count').textContent=`(${list.length})`;
  document.querySelector('#colleague-list').innerHTML=list.length?list.map(u=>{const info=statusInfo(u);return `<div class="hub-row ${u.id===me.id?'selected':''}"><button class="hub-row-main" data-person="${u.id}"><span class="hub-row-avatar ${u.status}">${faceAvatar(look(u),40)}</span><span class="hub-row-name"><strong>${esc(u.name)}${u.id===me.id?' <em>나</em>':''}</strong><small>${u.floor}층 ${esc(u.referenceSeat||u.seat)}</small></span><span class="hub-row-status ${info.tone}">${icon(info.icon,15)}${esc(info.text)}</span></button><button class="hub-more" data-card="${u.id}" aria-label="${esc(u.name)} 감각 카드 자세히 보기">${icon('more',18)}</button></div>`;}).join(''):`<div class="empty-state">${icon('search',28)}<strong>동료를 찾지 못했어요</strong><p>이름이나 검색 조건을 바꿔 보세요.</p></div>`;
}
// One row per sense: icon, name, five level dots (press to set) and the level label.
function senseBars(u){
  const values=todaySenses(u);
  return SENSES.map(s=>{const v=values[s.key];
    const dots=[1,2,3,4,5].map(n=>`<button type="button" class="hub-dot ${v&&n<=v?'on':''}" data-sense-dot="${s.key}" data-level="${n}" role="radio" aria-checked="${v===n}" aria-label="${s.name} ${n}단계 · ${s.labels[n-1]}"></button>`).join('');
    return `<div class="hub-sense" style="--sense:${s.color}"><span class="hub-sense-name">${icon(s.icon,24)}${s.name}</span><span class="hub-dots" role="radiogroup" aria-label="${s.name}">${dots}</span><b class="${v>=4?'high':''}">${v?s.labels[v-1]:'미공유'}</b></div>`;}).join('');
}
function renderPanel(){
  const u=me,clockedIn=u.status!=='offline';
  const prof=document.querySelector('#hub-profile'),panel=document.querySelector('#hub-info');if(!prof||!panel)return;
  prof.innerHTML=`<div class="hub-profile-head"><span class="hub-profile-art">${faceAvatar(look(u),72)}</span><div><h2>${esc(u.name)}</h2><p>${esc(u.role)}</p><p class="hub-loc">${icon('pin',14)}${u.floor}층 ${esc(u.seat)}</p></div></div><div class="hub-clock ${u.status==='away'?'idle':''}" role="group" aria-label="근무 상태"><button data-status="working" class="${u.status==='working'?'active':''}" aria-pressed="${u.status==='working'}">${icon('check',15)}출근</button><button data-status="offline" class="${clockedIn?'':'active'}" aria-pressed="${!clockedIn}">${icon('logout',15)}퇴근</button></div><div class="hub-away-row" role="group" aria-label="자리 비움"><button type="button" data-action="toggle-away" class="${u.status==='away'?'active':''}" aria-pressed="${u.status==='away'}" aria-expanded="${awayEditorOpen}" aria-controls="away-form">${icon('away',15)}자리 비움</button><button type="button" data-action="${u.status==='away'?'return-seat':'change-seat'}">${u.status==='away'?icon('check',15):icon('pin',15)}${u.status==='away'?'복귀':'자리 변경'}</button></div>${awayEditorOpen?`<form id="away-form" class="hub-away-note"><label class="sr-only" for="away-input">자리 비움 사유</label><input id="away-input" name="note" value="${esc(u.awayNote||'')}" maxlength="30" placeholder="사유 입력 (예: 회의, 16시 복귀)" autocomplete="off" enterkeyhint="done" /><button type="submit" aria-label="자리 비움 사유 저장">${icon('check',16)}</button></form>`:'<div class="hub-away-note-slot" aria-hidden="true"></div>'}`;
  const note=clockedIn?'':'<p class="hub-note">퇴근 상태예요. 감각을 선택하면 출근 상태로 바뀌며 공유돼요.</p>';
  panel.innerHTML=`<h2 class="hub-info-title">감각 정보</h2><div class="hub-info-grid"><section class="hub-sense-col"><h3>현재 내 감각 상태</h3><div class="hub-senses">${senseBars(u)}</div>${note}</section><section class="hub-quick-col"><h3>빠른 상태 설정</h3><div class="hub-quick" role="group" aria-label="빠른 상태">${QUICK_STATUS.map(([key,text])=>{const on=me.message===text;return `<button type="button" data-quick="${key}" class="${on?'active':''}" title="${text}" aria-label="${text}" aria-pressed="${on}">${icon(key,24)}</button>`;}).join('')}</div><label class="hub-quick-label" for="quick-input">상태 메시지</label><form id="quick-form" class="hub-quick-input">${me.messageIcon?`<span class="hub-quick-icon">${icon(me.messageIcon,18)}</span>`:''}<input id="quick-input" name="message" value="${esc(me.message)}" placeholder="상태 메시지를 입력하고 Enter" autocomplete="off" enterkeyhint="done" /><span id="quick-count" class="${charCount(me.message)>20?'over':''}">${charCount(me.message)}/20</span></form><p class="form-error" role="alert"></p></section></div>`;
}
function renderMini(){
  const root=document.querySelector('#hub-mini');if(!root)return;
  const sense=SENSES.find(s=>s.key===miniView);
  root.innerHTML=`<div class="hub-mini-head"><h3>감각 지도</h3><div class="hub-mini-tools"><label class="hub-select"><span class="sr-only">층 선택</span><select id="mini-floor">${FLOORS.slice().sort((a,b)=>b-a).map(f=>`<option value="${f}" ${floor===f?'selected':''}>${f}층</option>`).join('')}</select></label><label class="hub-select"><span class="sr-only">감각 선택</span><select id="mini-sense">${HEATMAP_VIEWS.map(v=>`<option value="${v.key}" ${miniView===v.key?'selected':''}>${SENSES.find(x=>x.key===v.key).name}</option>`).join('')}</select></label><button class="hub-icon small" data-action="mini-expand" aria-label="감각 지도 크게 보기">${icon('expand',17)}</button></div></div>${miniCanvas()}<div class="hub-legend"><span>${sense.labels[0]}</span><i style="background:linear-gradient(90deg,${HEAT_COLORS.join(',')})"></i><span>${sense.labels[4]}</span></div>`;
}
function miniCanvas(){
  const samples=heatSamples(people,floor,miniView);
  return `<div class="hub-mini-canvas" role="img" aria-label="${floor}층 ${SENSES.find(s=>s.key===miniView).name} 감각 지도${samples.length?`, 동료 ${samples.length}명의 체감 기준`:', 공유된 감각 없음'}"><div class="hub-mini-frame">${officeSVG()}${heatmapSVG(samples)}${samples.length?'':'<span class="hub-empty">지금 이 층에 공유된 감각이 없어요</span>'}</div></div>`;
}
function softRefresh(){
  if(!document.querySelector('.hub'))return;
  updateMap();updateList();renderMini();
  if(!document.querySelector('.hub-bottom')?.contains(document.activeElement))renderPanel();
}

// The icon in use: one picked but not yet saved, else the saved message's icon.
// A typed message keeps a status icon only if it is one of the eight presets.
async function saveMessage(text){
  const preset=QUICK_STATUS.find(([,t])=>t===text);
  await api.message(text,preset?preset[0]:'');
  await sync();softRefresh();renderPanel();
}
async function saveQuick(){
  const text=document.querySelector('#quick-input')?.value.trim()||'';
  await saveMessage(text);toast(text?'상태 메시지를 바꿨어요.':'상태 메시지를 지웠어요.');
}
async function pickQuick(key){
  const [,text]=QUICK_STATUS.find(([k])=>k===key);
  await saveMessage(text);toast(`상태 메시지를 바꿨어요 · ${text}`);
  document.querySelector(`[data-quick="${key}"]`)?.focus();
}
function openModal(title,content,kind='generic',wide=false){
  if(!modalRoot.firstChild)lastFocus=document.activeElement;
  modalKind=kind;
  modalRoot.innerHTML=`<div class="modal-backdrop"><section class="modal ${wide?'wide':''}" data-kind="${kind}" role="dialog" aria-modal="true" aria-labelledby="modal-title" tabindex="-1"><header class="modal-header"><h2 id="modal-title">${title}</h2><button class="icon-button" data-action="close" aria-label="닫기">${icon('close')}</button></header>${content}</section></div>`;
  app.inert=true;document.body.classList.add('modal-open');modalRoot.querySelector('.modal').focus();
}
function closeModal(){modalRoot.innerHTML='';modalKind='';app.inert=false;document.body.classList.remove('modal-open');if(lastFocus?.isConnected)lastFocus.focus();lastFocus=null;}
const SENSI_COLORS={visual:'#4a8fe0',auditory:'#e5534b',olfactory:'#5fb34f'};
const hhmm=iso=>iso?new Intl.DateTimeFormat('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(iso)):'';
// Square level dots; interactive ones are buttons (own card), others are plain.
function levelDots(value,color,{size='md',editKey=''}={}){
  return `<span class="lv-dots ${size}" style="--sense:${color}">${[1,2,3,4,5].map(n=>editKey
    ?`<button type="button" class="hub-dot ${value&&n<=value?'on':''}" data-sensi-dot="${editKey}" data-level="${n}" role="radio" aria-checked="${value===n}" aria-label="${n}단계 · ${SENSITIVITY[n-1]}"></button>`
    :`<i class="hub-dot ${value&&n<=value?'on':''}"></i>`).join('')}</span>`;
}
// Sensory card — matches reference "05 감각 카드" surface.
const CARD_SENSI=[{key:'visual',label:'시각 민감도',icon:'eye',color:'#4a8fe0'},{key:'auditory',label:'청각 민감도',icon:'ear',color:'#e5534b'},{key:'olfactory',label:'후각 민감도',icon:'nose',color:'#5fb34f'}];
const CARD_SENSI_TXT=['','낮음','조금 낮음','보통','높음','매우 높음'];
const CARD_SENSES=[{key:'noise',label:'소음',icon:'noise',color:'#e5534b',lo:'조용함',hi:'시끄러움'},{key:'temperature',label:'온도',icon:'temp',color:'#f08a3c',lo:'추움',hi:'더움'},{key:'humidity',label:'습도',icon:'humid',color:'#4a8fe0',lo:'건조',hi:'습함'},{key:'smell',label:'냄새',icon:'smell',color:'#e0a020',lo:'약함',hi:'강함'},{key:'discomfort',label:'불쾌 지수',icon:'discomfort',color:'#8f7ad8',lo:'쾌적',hi:'불쾌'},{key:'crowding',label:'혼잡도',icon:'crowd',color:'#4a4e72',lo:'여유',hi:'붐빔'}];
const pngIcon=(name,h,w)=>`<img src="/src/icons/${name}.png" alt="" aria-hidden="true" style="height:${h}px;width:${w}px;object-fit:contain;image-rendering:pixelated;">`;
function showCard(id){
  const u=people.find(p=>p.id===id);if(!u)return;modalUser=id;
  const senses=currentSenses(u),own=u.id===me.id;
  const st=u.status==='working'?{full:'출근 · 근무 중',color:'#2f8a52',bg:'#e3f3e8',dot:'#3fae6a'}
    :u.status==='away'?{full:'자리 비움 · '+esc(u.reason||'잠깐'),color:'#b8701a',bg:'#fdf0da',dot:'#f0a93b'}
    :{full:'퇴근',color:'#6e7190',bg:'#ecebf1',dot:'#a5a8bd'};
  const dot=(on,color,size=18)=>`width:${size}px;height:${size}px;border-radius:${Math.round(size/3.5)}px;border:none;padding:0;cursor:${own?'pointer':'default'};background:${on?color:'#ebe3d3'};box-shadow:inset 0 -2px 0 ${on?'rgba(0,0,0,.2)':'#dcd1bd'};`;
  const sensi=CARD_SENSI.map(se=>{const v=u.sensitivity?.[se.key]||3;
    const dots=[1,2,3,4,5].map(n=>own
      ?`<button type="button" data-sensi-dot="${se.key}" data-level="${n}" role="radio" aria-checked="${v===n}" aria-label="${se.label} ${n}단계 · ${CARD_SENSI_TXT[n]}" style="${dot(n<=v,se.color)}"></button>`
      :`<span aria-hidden="true" style="${dot(n<=v,se.color)}"></span>`).join('');
    return `<div style="display:flex;align-items:center;gap:12px;height:40px;">${pngIcon(se.icon,17,21)}<span style="width:84px;font-size:13.5px;font-weight:700;color:#4a4560;">${se.label}</span><span style="display:flex;gap:7px;">${dots}</span><span style="font-size:12.5px;font-weight:800;color:${v>=4?se.color:'#8a8499'};">${CARD_SENSI_TXT[v]}</span></div>`;}).join('');
  const now=CARD_SENSES.map(se=>{const v=Number(senses[se.key])||0;
    return `<div style="display:flex;align-items:center;gap:8px;height:24px;">${pngIcon(se.icon,14,17)}<span style="width:56px;font-size:12.5px;font-weight:600;color:#4a4560;">${se.label}</span><span style="flex:1;height:6px;border-radius:3px;background:#ece4d5;position:relative;overflow:hidden;"><span style="position:absolute;left:0;top:0;bottom:0;width:${v*20}%;background:${se.color};border-radius:3px;"></span></span><span style="width:50px;text-align:right;font-size:11.5px;font-weight:800;color:${v>=4?se.color:'#8a8499'};">${v? (v<=2?se.lo:se.hi) : '미공유'}</span></div>`;}).join('');
  const title=own?'나의 감각 카드':`${esc(u.name)}님의 감각 카드`;
  modalKind='card';modalUser=id;
  if(!modalRoot.firstChild)lastFocus=document.activeElement;
  modalRoot.innerHTML=`<div class="modal-backdrop ssc-backdrop" style="position:fixed;inset:0;background:rgba(30,31,60,.55);backdrop-filter:none;display:flex;align-items:center;justify-content:center;z-index:200;padding:24px;">
    <section role="dialog" aria-modal="true" aria-label="${title}" tabindex="-1" style="width:min(780px,100%);max-height:calc(100dvh - 48px);overflow:auto;background:#fbf7ef;border-radius:22px;padding:14px;box-sizing:border-box;box-shadow:0 0 0 2px #3b3e6e,inset 0 1px 0 #fff,0 30px 70px -20px rgba(0,0,0,.7);display:grid;grid-template-columns:220px minmax(0,1fr);gap:14px;position:relative;">
      <button type="button" data-action="close" aria-label="닫기" style="position:absolute;right:14px;top:14px;width:34px;height:34px;border-radius:10px;border:1.5px solid #e2d6c2;background:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#4a4560;padding:0;"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"></path></svg></button>
      <div style="background:#f3ecdf;border-radius:16px;padding:16px;display:flex;flex-direction:column;gap:10px;">
        <div style="height:180px;border-radius:12px;background-color:#fbf8f2;background-image:linear-gradient(#efe8da 1px,transparent 1px),linear-gradient(90deg,#efe8da 1px,transparent 1px);background-size:10px 10px;border:1.5px solid #e7dcc8;display:flex;align-items:center;justify-content:center;">${faceAvatar(look(u),120)}</div>
        <div style="font-size:21px;font-weight:800;">${esc(u.name)}</div>
        <div style="font-size:13px;color:#6e6a84;margin-top:-6px;">${esc(u.role)} · ${u.floor}F ${esc(u.seat)}</div>
        <span style="display:inline-flex;align-items:center;gap:7px;align-self:flex-start;padding:6px 11px;border-radius:9px;background:${st.bg};color:${st.color};font-size:13px;font-weight:800;"><span style="width:8px;height:8px;border-radius:2px;background:${st.dot};flex-shrink:0;"></span>${st.full}</span>
        ${own?`<button type="button" data-nav="/character" style="margin-top:auto;height:40px;border-radius:11px;background:#fff;border:1.5px solid #e2d6c2;font-size:13.5px;font-weight:700;cursor:pointer;box-shadow:inset 0 -3px 0 #efe6d5;">캐릭터 수정</button>`:''}
      </div>
      <div style="display:flex;flex-direction:column;gap:12px;padding:8px 4px 4px;">
        <div style="font-size:17px;font-weight:800;padding-right:44px;">${title}</div>
        <div style="background:#fff;border:1px solid #ece2cf;border-radius:14px;padding:6px 16px;box-shadow:0 2px 0 #ece2cf;">${sensi}</div>
        <div style="background:#fff;border:1px solid #ece2cf;border-radius:14px;padding:12px 16px;box-shadow:0 2px 0 #ece2cf;display:flex;flex-direction:column;gap:6px;">
          <span style="font-size:13.5px;font-weight:800;">추가 설명</span>
          ${own?`<textarea data-card-desc rows="2" maxlength="300" style="border:1.5px solid #e2d6c2;border-radius:10px;padding:9px 12px;font-size:13.5px;line-height:1.55;outline:none;background:#fffdf9;resize:none;font-family:inherit;">${esc(u.description||'')}</textarea>`
            :`<div style="font-size:13.5px;line-height:1.6;color:#4a4560;">${u.description?esc(u.description).replace(/\n/g,'<br>'):'아직 추가 설명이 없어요.'}</div>`}
        </div>
        <div style="background:#fff;border:1px solid #ece2cf;border-radius:14px;padding:12px 16px;box-shadow:0 2px 0 #ece2cf;display:grid;grid-template-columns:1fr 1fr;gap:6px 22px;">${now}</div>
      </div>
    </section>
  </div>`;
  app.inert=true;document.body.classList.add('modal-open');modalRoot.querySelector('[role="dialog"]').focus();
}
function showStatus(){openModal('지금 어디에 계신가요?',`<p class="modal-intro">동료에게 지금 나의 상태를 알려 주세요.</p><div class="status-options"><button data-status="working" class="status-option ${me.status==='working'?'selected':''}"><span class="status-icon working">${icon('home')}</span><span><strong>출근</strong><small>${me.status==='away'?'내 자리로 복귀해요':'오늘도 함께 시작해요'}</small></span>${me.status==='working'?icon('check'):''}</button><div class="away-options"><strong>${icon('clock',18)} 자리 비움</strong><div>${REASONS.map(r=>`<button data-status="away" data-reason="${r}" class="${me.status==='away'&&me.reason===r?'selected':''}">${r}</button>`).join('')}</div></div><button data-status="offline" class="status-option ${me.status==='offline'?'selected':''}"><span class="status-icon offline">${icon('logout')}</span><span><strong>퇴근</strong><small>오늘의 감각과 상태 메시지도 비워져요</small></span>${me.status==='offline'?icon('check'):''}</button></div><p class="form-error" role="alert"></p>`,'status');}
function showMessage(){openModal('짧은 말 한마디',`<p class="modal-intro">지금 하고 싶은 말을 말풍선에 담아 보세요.</p><form id="message-form"><label for="message-input" class="sr-only">상태 메시지</label><textarea id="message-input" name="message" rows="2" placeholder="커피 마실 사람 ☕">${esc(me.message)}</textarea><div class="char-count" id="char-count">${charCount(me.message)} / 20</div><div class="message-preview"><span class="preview-bubble" id="message-preview">${esc(me.message||'오늘의 한마디를 남겨 주세요')}</span>${avatar(look(me),52)}<small>${esc(me.name)}</small></div><p class="form-error" role="alert"></p><div class="button-row"><button type="button" class="secondary" data-action="clear-message">메시지 삭제</button><button class="primary" type="submit">저장하기 ${icon('check',16)}</button></div></form>`,'message');}
function choiceRow(key,name,ico,labels,value,color){return `<fieldset class="choice-row" style="--sense:${color||'#8b7cb0'}"><legend>${icon(ico,18)}${name}</legend><div class="five-options">${labels.map((l,i)=>`<label class="choice"><input type="radio" name="${key}" value="${i+1}" ${value===i+1?'checked':''}/><span><i></i><small>${l}</small></span></label>`).join('')}</div></fieldset>`;}
function showSenses(){if(me.status==='offline'){toast('먼저 출근한 뒤 현재 감각을 공유해 주세요.');showStatus();return;}const values=currentSenses(me);openModal('지금, 나의 감각은',`<p class="modal-intro">정답은 없어요. 지금 내가 느끼는 정도를 골라 주세요.</p><form id="senses-form"><div class="sense-editor">${SENSES.map(s=>choiceRow(s.key,s.name,s.icon,s.labels,values[s.key],s.color)+`<button type="button" class="unshare text-button" data-unshare="${s.key}">미공유로 변경</button>`).join('')}</div><div class="sharing-note">${icon('users',16)} 선택한 항목만 같은 회사 동료에게 공유돼요.</div><p class="form-error" role="alert"></p><div class="button-row"><button class="secondary" type="button" data-action="close">취소</button><button class="primary" type="submit">감각 공유하기 ${icon('check',16)}</button></div></form>`,'senses',true);}
function profileFirst(){return `<div class="profile-columns"><section class="profile-fields"><h3><span class="section-number">01</span> 기본 정보</h3><label>이름<input name="name" value="${esc(draft.name)}" required maxlength="30" autocomplete="name"/></label><label>직책<input name="role" value="${esc(draft.role)}" required maxlength="40" placeholder="예: 프로덕트 디자이너" /></label><label>회사 이메일<input value="${esc(me.email)}" disabled /></label><h3 class="avatar-title"><span class="section-number">02</span> 나를 닮은 캐릭터</h3><div class="character-summary"><span class="character-summary-art">${avatar(look(me),46)}</span><span><strong>${me.character?.skin?SKINS.find(s=>s.key===me.character.skin).name+' 특별 스킨':'기본 의상'}</strong><small>머리, 눈, 옷을 바꿀 수 있어요.</small></span><button type="button" class="secondary small" data-action="edit-character">${icon('edit',15)}꾸미기</button></div></section><section class="seat-section"><h3><span class="section-number">03</span> 내 자리 지정</h3><div class="seat-top"><p>실제로 앉는 자리를 선택해 주세요.</p><select id="profile-floor" name="floor" aria-label="내 자리 층">${FLOORS.map(f=>`<option value="${f}" ${Number(draft.floor)===f?'selected':''}>${f}층</option>`).join('')}</select></div><div id="seat-map"></div><div class="seat-legend"><span><i></i>선택 가능</span><span><i class="occupied"></i>사용 중</span><span><i class="chosen"></i>내 자리</span></div><div class="selected-seat" id="selected-seat"></div></section></div>`;}
function sensitivityFields(){return `<div class="sensitivity-form"><div class="intro-leaf">${icon('leaf',30)}</div><h2>나를 이해하는 작은 힌트</h2><p class="muted">평소 나의 감각은 어떤가요? 세 가지 모두 선택해 주세요.</p>${TRAITS.map((t,i)=>choiceRow(t.key,t.name+' 민감도',t.icon,SENSITIVITY,draft.sensitivity[t.key],['#7b94bb','#cd8294','#79a78a'][i])).join('')}<label class="description-label">추가 설명 <span class="optional">선택</span><textarea name="description" maxlength="300" rows="3" placeholder="예: 갑작스러운 큰 소리에 쉽게 놀라요.">${esc(draft.description)}</textarea><small>동료가 나를 이해하는 데 도움이 되는 이야기를 적어 주세요.</small></label><div class="sharing-note">${icon('users',16)} 입력한 정보는 같은 회사 동료에게 표시돼요.</div></div>`;}
function renderProfile(onboarding){app.innerHTML=`<div class="settings-page"><header class="topbar">${brand()}<span class="company">${COMPANY}</span><div class="topbar-right"><span class="demo-label">LOCAL DEMO</span>${!onboarding?`<button class="text-button" data-nav="/office">사무실로 돌아가기 ${icon('arrow',16)}</button>`:''}</div></header><main class="settings-main"><div class="settings-heading"><span class="eyebrow">${onboarding?'MAKE YOURSELF AT HOME':'MY LITTLE PROFILE'}</span><h1>${onboarding?'우리 사무실에 오신 걸 환영해요':'나를 조금 더 알아가기'}</h1><p class="muted">${onboarding?'내 자리와 감각을 알려 주시면, 함께할 준비가 끝나요.':'동료에게 보여줄 나의 모습과 감각을 설정해요.'}</p></div>${onboarding?`<div class="steps"><span class="${step===1?'current':'done'}"><b>${step===2?'✓':'1'}</b>프로필과 내 자리</span><i></i><span class="${step===2?'current':''}"><b>2</b>나의 감각 소개</span></div>`:''}<form id="profile-form" data-onboarding="${onboarding}"><div class="settings-card">${!onboarding||step===1?profileFirst():''}${!onboarding?'<hr>':''}${!onboarding||step===2?sensitivityFields():''}</div><p class="form-error" role="alert"></p><div class="settings-actions">${onboarding&&step===2?'<button type="button" class="secondary" data-action="previous-step">이전 단계</button>':!onboarding?'<button type="button" class="text-button" data-action="logout">로그아웃</button>':'<span>작은 배려의 시작, Sensory Fit</span>'}<button type="submit" class="primary">${onboarding?(step===1?'다음: 나의 감각 소개':'우리 사무실 들어가기'):'변경 사항 저장'} ${icon('arrow',18)}</button></div></form></main></div>`;if(!onboarding||step===1)renderSeatMap();}
function renderSeatMap(){const root=document.querySelector('#seat-map');if(!root)return;root.innerHTML=`<div class="seat-map-art">${officeSVG()}${SEATS.map(s=>{const taken=people.some(p=>p.id!==me.id&&p.floor===Number(draft.floor)&&p.seat===s.id);return `<button type="button" class="seat-choice ${draft.seat===s.id?'chosen':''}" style="${pct(s,28)}" data-seat="${s.id}" ${taken?'disabled':''} aria-label="${s.id} ${taken?'사용 중':'선택 가능'}" aria-pressed="${draft.seat===s.id}">${s.id}</button>`;}).join('')}</div>`;document.querySelector('#selected-seat').innerHTML=`${icon('pin',17)}${draft.seat?`${draft.floor}층 · ${draft.seat} 자리`:'지도에서 내 자리를 선택해 주세요'}`;}
const CHAR_STEPS=[['프로필 설정 시작','나만의 캐릭터를 만들어 사무실에 참여해보세요.'],['캐릭터 생성 방법 선택','원하는 방식으로 캐릭터를 만들어보세요.'],['얼굴 스타일 선택','머리, 눈 등의 스타일을 선택해주세요.'],['옷 스타일 선택','기본 의상 또는 특별한 스킨을 선택해주세요.']];
const CHAR_SAMPLES=[{hair:0,hairColor:0,color:0},{hair:3,hairColor:3,color:0,gender:'m'},{hair:2,hairColor:2,color:1},{hair:5,hairColor:6,color:6},{hair:1,hairColor:7,color:17},{hair:4,hairColor:7,color:2,gender:'m'}].map(c=>({...DEFAULT_CHARACTER,...c}));
function charPreview(){return `<aside class="char-preview"><span class="char-preview-label">미리보기</span><div class="char-preview-art">${avatar(charDraft,112)}</div><div class="char-preview-tools"><button type="button" data-action="char-reset" aria-label="처음 상태로 되돌리기" title="되돌리기">${icon('refresh',19)}</button><button type="button" data-action="char-random" aria-label="무작위로 바꾸기" title="랜덤">${icon('shuffle',19)}</button></div></aside>`;}
function charOption(field,value,label,{size=56,head=false,caption=false}={}){const selected=charDraft[field]===value;const look={...charDraft,[field]:value,...(field==='skin'?{}:{skin:null})};return `<button type="button" class="char-option ${selected?'selected':''}" data-cpick="${field}" data-value="${value}" aria-pressed="${selected}" aria-label="${esc(label)}" title="${esc(label)}"><span class="char-tile">${head?characterSVG(look,size,{head:true}):avatar(look,size)}</span>${caption?`<small>${esc(label)}</small>`:''}</button>`;}
function charButtons(prev,next){return `<footer class="char-actions ${prev?'split':''}">${prev?`<button type="button" class="char-btn ghost" data-cstep="prev">${icon('back',17)} 이전</button>`:''}${next}</footer>`;}
const nextBtn=(label='다음',attr='data-cstep="next"',ico='arrow')=>`<button type="button" class="char-btn" ${attr}>${label} ${icon(ico,17)}</button>`;
function charIntro(){return `<div class="char-intro-scene">${officeSVG()}<div class="char-intro-bubble"><strong>안녕하세요!</strong><span>사무실에서 사용한<br>나만의 캐릭터를 만들어볼까요?</span></div><span class="char-intro-person">${avatar(charDraft,72)}</span></div>${charButtons(false,nextBtn('시작하기'))}`;}
function charMethodStep(){
  const radio=(value,title,desc)=>`<label class="char-method"><input type="radio" name="char-method" value="${value}" ${charMethod===value?'checked':''}/><span><strong>${title}</strong><small>${desc}</small></span></label>`;
  return `<div class="char-methods" role="radiogroup" aria-label="캐릭터 생성 방법"><section class="char-method-block">${radio('photo','사진 업로드로 AI 캐릭터 생성','내 사진을 업로드하면<br>AI가 픽셀 캐릭터로 변환해줘요.')}<div class="char-photo-row"><label class="char-photo-drop">${photoURL?`<img src="${photoURL}" alt="업로드한 사진 미리보기" />`:`${icon('camera',28)}<span>사진 올리기</span>`}<input type="file" id="char-photo" accept="image/*" class="sr-only" /></label><span class="char-photo-arrow">${icon('arrow',24)}</span><span class="char-photo-result">${avatar(photoLook||charDraft,56)}<i class="sparkle one">✦</i><i class="sparkle two">✦</i></span></div></section><section class="char-method-block">${radio('custom','직접 커스터마이징하기','머리, 눈, 옷 등을 직접 선택해서<br>나만의 캐릭터를 만들어요.')}<div class="char-sample-row" aria-hidden="true">${CHAR_SAMPLES.map(c=>avatar(c,34)).join('')}</div></section></div><p class="char-photo-note">${icon('lock',12)} 사진은 이 브라우저 안에서만 분석되고 저장되지 않아요. (AI 연동 전 데모)</p><p class="form-error" role="alert"></p>${charButtons(false,nextBtn())}`;
}
function charFaceStep(){
  const tabs=[['hair','머리 모양','hood'],['hairColor','머리 색깔','circle'],['eye','눈 색깔','eye']];
  const list=faceTab==='hair'?HAIR_STYLES:faceTab==='hairColor'?HAIR_COLORS:EYE_COLORS;
  return `<div class="char-layout"><div><div class="char-tabs" role="tablist">${tabs.map(([k,n,i])=>`<button type="button" role="tab" data-ctab="face:${k}" aria-selected="${faceTab===k}" class="${faceTab===k?'active':''}">${icon(i,17)}${n}</button>`).join('')}</div><div class="char-grid faces" role="tabpanel">${list.slice(0,6).map((item,i)=>charOption(faceTab,i,item.name,{size:96,head:true})).join('')}</div></div>${charPreview()}</div><p class="form-error" role="alert"></p>${charButtons(true,nextBtn())}`;
}
function charOutfitStep(){
  const special=outfitTab==='special';
  const tabs=`<div class="char-tabs wide" role="tablist"><button type="button" role="tab" data-ctab="outfit:basic" aria-selected="${!special}" class="${!special?'active':''}">${icon('shirt',16)}기본 의상</button><button type="button" role="tab" data-ctab="outfit:special" aria-selected="${special}" class="${special?'active':''}">${icon('star',16)}특별 스킨</button></div>`;
  if(special)return `<div class="char-layout"><div>${tabs}<div class="char-grid skins">${SKINS.map(s=>charOption('skin',s.key,s.name,{size:72,caption:true})).join('')}</div><div class="char-note"><span class="char-note-star">★</span><span>특별 스킨은 언제든지 다시 변경할 수 있습니다.<br>업무 중에도 가볍게 분위기를 바꿔보세요!</span></div></div>${charPreview()}</div><p class="form-error" role="alert"></p>${charButtons(true,nextBtn('완료하기','data-action="char-done"','check'))}`;
  const shirt=hex=>pixelIconSVG('shirt',16,{b:hex,B:shade(hex,-0.28)});
  return `${tabs}<div class="char-outfit"><div><div class="char-gender"><span>성별</span><div class="char-segment">${Object.entries(GENDERS).map(([k,n])=>`<button type="button" data-cpick="gender" data-value="${k}" aria-pressed="${charDraft.gender===k}" class="${charDraft.gender===k?'active':''}">${icon('hood',16)}${n}</button>`).join('')}</div></div><div class="char-grid outfits">${OUTFITS.map((o,i)=>charOption('outfit',i,o.name,{size:62})).join('')}</div></div><div class="char-palette"><h4>의상 색상 조합</h4><div class="char-palette-list">${OUTFIT_PALETTES.map((p,r)=>`<div class="char-palette-row">${shirt(p.colors[0])}${p.colors.map((hex,c)=>{const idx=r*4+c,sel=charDraft.color===idx;return `<button type="button" class="swatch ${sel?'selected':''}" style="--swatch:${hex}" data-cpick="color" data-value="${idx}" aria-pressed="${sel}" aria-label="${p.name} ${c+1}번 색"></button>`;}).join('')}</div>`).join('')}</div></div></div><p class="form-error" role="alert"></p>${charButtons(true,nextBtn())}`;
}
function renderCharacter(){
  const active=document.activeElement?.dataset||{};
  const focusKey=active.cpick?`[data-cpick="${active.cpick}"][data-value="${active.value}"]`:active.ctab?`[data-ctab="${active.ctab}"]`:'';
  const special=charStep===4&&outfitTab==='special';
  const [title,sub]=CHAR_STEPS[charStep-1];
  const heading=special?'특별 스킨 선택 <em class="char-title-accent">(텔레토비)</em>':charStep===3?`${title} <small>(직접 설정 시)</small>`:title;
  const body=[charIntro,charMethodStep,charFaceStep,charOutfitStep][charStep-1]();
  app.innerHTML=`<div class="settings-page char-page"><header class="topbar">${brand()}<span class="company">${COMPANY}</span><div class="topbar-right"><span class="demo-label">LOCAL DEMO</span>${me.complete?`<button class="text-button" data-nav="/profile">프로필로 돌아가기 ${icon('arrow',16)}</button>`:''}</div></header><main class="char-main"><section class="char-card step-${charStep}${special?' special':''}" aria-labelledby="char-title"><header class="char-head"><span class="char-step-no" aria-label="${charStep}/4 단계">${String(charStep).padStart(2,'0')}</span><div><h1 id="char-title">${heading}</h1><p>${special?'재밌는 특별 스킨으로도 참여할 수 있어요!':sub}</p></div></header><div class="char-body">${body}</div></section></main></div>`;
  if(focusKey)document.querySelector(focusKey)?.focus();
}
function charError(message){const el=document.querySelector('.char-card .form-error');if(el)el.textContent=message;}
function loadPhoto(file){
  if(!file)return;if(!file.type.startsWith('image/')){charError('이미지 파일을 선택해 주세요.');return;}
  const url=URL.createObjectURL(file),img=new Image();
  img.onload=()=>{const size=48,canvas=document.createElement('canvas');canvas.width=canvas.height=size;const ctx=canvas.getContext('2d');const s=Math.min(img.width,img.height);ctx.drawImage(img,(img.width-s)/2,(img.height-s)/2,s,s,0,0,size,size);photoLook=characterFromPixels(ctx.getImageData(0,0,size,size).data,size);if(photoURL)URL.revokeObjectURL(photoURL);photoURL=url;renderCharacter();};
  img.onerror=()=>{URL.revokeObjectURL(url);charError('사진을 읽지 못했어요. 다른 사진을 선택해 주세요.');};
  img.src=url;
}
function charStepMove(dir){
  if(dir==='prev'){if(charStep===4&&outfitTab==='special')outfitTab='basic';else charStep=Math.max(1,charStep-1);renderCharacter();return;}
  if(charStep===2&&charMethod==='photo'){if(!photoLook){charError('사진을 올려 캐릭터를 먼저 만들어 주세요.');return;}charDraft={...photoLook};}
  if(charStep===4){outfitTab='special';renderCharacter();return;}
  charStep=Math.min(4,charStep+1);renderCharacter();window.scrollTo(0,0);
}
async function finishCharacter(){
  if(charStep===4&&outfitTab==='basic')charDraft={...charDraft,skin:null};
  me=await api.character(charDraft);
  if(photoURL){URL.revokeObjectURL(photoURL);photoURL='';}
  go(me.complete?'/profile':'/onboarding');toast('나만의 캐릭터가 완성됐어요!');
}
function saveDraft(form){const f=new FormData(form);for(const k of ['name','role','avatar','floor','description'])if(f.has(k))draft[k]=f.get(k);for(const t of TRAITS)if(f.has(t.key))draft.sensitivity[t.key]=Number(f.get(t.key));draft.floor=Number(draft.floor);draft.avatar=Number(draft.avatar);}
async function refreshOffice(){await sync();if(!document.querySelector('.hub'))return;const s=document.querySelector('#map-scroll'),pos=s?[s.scrollLeft,s.scrollTop]:[0,0];renderOffice();document.querySelector('#map-scroll')?.scrollTo(...pos);}

document.addEventListener('click',async event=>{
  const b=event.target.closest('button,a');
  if(event.target.classList.contains('modal-backdrop')){closeModal();return;}
  if(menuOpen&&!event.target.closest('.hub-menu-wrap')){menuOpen=false;if(document.querySelector('.hub'))renderOffice();}
  if(!b)return;
  if(b.dataset.nav){event.preventDefault();go(b.dataset.nav);return;}
  try{
    if(b.dataset.person){const p=people.find(u=>u.id===b.dataset.person);if(p){if(p.floor!==floor){floor=p.floor;renderOffice();}const frame=document.querySelector('#reference-map');if(frame){referenceFocus=p.id;frame.contentWindow.postMessage({source:'senspace-host',type:'focus',id:p.id},location.origin);}else showCard(p.id);}return;}
    if(b.dataset.card){showCard(b.dataset.card);return;}
    if(b.dataset.sensiDot){me=await api.profile({...me,sensitivity:{...me.sensitivity,[b.dataset.sensiDot]:Number(b.dataset.level)}});await sync();showCard(me.id);modalRoot.querySelector(`[data-sensi-dot="${b.dataset.sensiDot}"][data-level="${b.dataset.level}"]`)?.focus();toast('평소 민감도를 바꿨어요.');return;}
    if(b.dataset.senseDot){await saveSense(b.dataset.senseDot,Number(b.dataset.level));return;}
    if(b.dataset.quick){await pickQuick(b.dataset.quick);return;}
    if(b.dataset.seat){saveDraft(document.querySelector('#profile-form'));draft.seat=b.dataset.seat;renderSeatMap();return;}
    if(b.dataset.status){awayEditorOpen=false;b.disabled=true;try{me=await api.status(b.dataset.status,b.dataset.reason);closeModal();await refreshOffice();if(b.dataset.status==='away')document.querySelector('#away-input')?.focus();toast('동료에게 내 상태를 알려줬어요.');}finally{b.disabled=false;}return;}
    if(b.dataset.cpick){const f=b.dataset.cpick,raw=b.dataset.value;if(f==='skin')charDraft={...charDraft,skin:charDraft.skin===raw?null:raw};else charDraft={...charDraft,[f]:f==='gender'?raw:Number(raw),skin:null};renderCharacter();return;}
    if(b.dataset.ctab){const [group,key]=b.dataset.ctab.split(':');if(group==='face')faceTab=key;else outfitTab=key;renderCharacter();return;}
    if(b.dataset.cstep){charStepMove(b.dataset.cstep);return;}
    if(b.dataset.unshare){modalRoot.querySelectorAll(`input[name="${b.dataset.unshare}"]`).forEach(i=>i.checked=false);return;}
    switch(b.dataset.action){
      case 'toggle-away':{
        b.disabled=true;
        try{
          const wasOpen=awayEditorOpen;
          if(!wasOpen&&me.status!=='away'){me=await api.status('away');await sync();}
          else if(wasOpen&&me.status==='away'){me=await api.status('working');await sync();}
          awayEditorOpen=!wasOpen;softRefresh();renderPanel();
          document.querySelector(awayEditorOpen?'#away-input':'[data-action="toggle-away"]')?.focus();
        }finally{b.disabled=false;}
        break;
      }
      case 'return-seat':{
        b.disabled=true;
        try{me=await api.status('working');await sync();awayEditorOpen=false;softRefresh();renderPanel();toast('자리로 복귀했어요.');}
        finally{b.disabled=false;}
        break;
      }
      case 'demo':b.disabled=true;me=await api.demo();go('/office');break;
      case 'retry':renderRoute();break;
      case 'close':closeModal();break;
      case 'my-card':showCard(me.id);break;
      case 'status':showStatus();break;
      case 'message':showMessage();break;
      case 'senses':showSenses();break;
      case 'clear-message':await api.message('');closeModal();await refreshOffice();toast('상태 메시지를 지웠어요.');break;
      case 'menu':menuOpen=!menuOpen;renderOffice();document.querySelector('.hub-menu button')?.focus();break;
      case 'zoom-in':setMapZoom(mapZoom+ZOOM_STEP);break;
      case 'zoom-out':setMapZoom(mapZoom-ZOOM_STEP);break;
      case 'notifications':openReference('settings');break;
      case 'reference-seat':
      case 'change-seat':document.querySelector('#reference-map')?.contentWindow.postMessage({source:'senspace-host',type:'pick-seat'},location.origin);break;
      case 'mini-expand':openModal(`${floor}층 ${SENSES.find(s=>s.key===miniView).name} 감각 지도`,`<div class="hub-mini-large">${miniCanvas()}</div>`,'mini',true);break;
      case 'previous-step':saveDraft(document.querySelector('#profile-form'));step=1;renderProfile(true);break;
      case 'char-reset':charDraft={...DEFAULT_CHARACTER,...(me.character||legacyCharacter(me.avatar))};if(charStep===4&&outfitTab==='basic')charDraft.skin=null;renderCharacter();break;
      case 'char-random':charDraft=charStep===4&&outfitTab==='special'?{...charDraft,skin:SKINS[Math.floor(Math.random()*SKINS.length)].key}:randomCharacter();renderCharacter();break;
      case 'char-done':b.disabled=true;await finishCharacter();break;
      case 'edit-character':{const form=document.querySelector('#profile-form');if(form)saveDraft(form);profileStash=structuredClone(draft);go('/character');break;}
      case 'logout':await api.logout();go('/login');break;
    }
  }catch(error){const target=modalRoot.querySelector('.form-error')||document.querySelector('.char-card .form-error')||document.querySelector('.hub-info .form-error');if(target)target.textContent=error.message;else toast(error.message);b.disabled=false;}
});
document.addEventListener('input',e=>{
  if(e.target.id==='search'){query=e.target.value;updateList();}
  if(e.target.id==='quick-input'){const n=charCount(e.target.value),c=document.querySelector('#quick-count');c.textContent=`${n}/20`;c.classList.toggle('over',n>20);}
  if(e.target.id==='message-input'){const value=e.target.value,n=charCount(value);document.querySelector('#char-count').textContent=`${n} / 20`;document.querySelector('#char-count').classList.toggle('over',n>20);document.querySelector('#message-preview').textContent=value||'오늘의 한마디를 남겨 주세요';document.querySelector('#message-form button[type="submit"]').disabled=n>20;}
});
document.addEventListener('change',async e=>{if(e.target.dataset.cardDesc!==undefined){const value=e.target.value;try{me=await api.profile({...me,description:value});await sync();toast(value.trim()?'추가 설명을 저장했어요.':'추가 설명을 지웠어요.');}catch(error){toast(error.message);await sync();showCard(me.id);}return;}if(e.target.name==='char-method'){charMethod=e.target.value;renderCharacter();document.querySelector(`input[name="char-method"][value="${charMethod}"]`)?.focus();return;}if(e.target.id==='char-photo'){charMethod='photo';loadPhoto(e.target.files[0]);return;}if(e.target.id==='floor'||e.target.id==='mini-floor'){floor=Number(e.target.value);renderOffice();document.querySelector('#'+e.target.id)?.focus();return;}if(e.target.id==='filter-select'){filter=e.target.value;updateList();return;}if(e.target.id==='mini-sense'){miniView=e.target.value;renderMini();document.querySelector('#mini-sense')?.focus();return;}if(e.target.id==='profile-floor'){saveDraft(document.querySelector('#profile-form'));draft.seat='';renderSeatMap();}});
async function saveSense(key,level){try{await api.senses({...todaySenses(me),[key]:level});if(HEATMAP_VIEWS.some(v=>v.key===key))miniView=key;if(me.floor!==floor){floor=me.floor;}await sync();updateMap();renderMini();renderPanel();document.querySelector(`[data-sense-dot="${key}"][data-level="${level}"]`)?.focus();const err=document.querySelector('.hub-info .form-error');if(err)err.textContent='';toast('지금의 감각을 공유했어요.');}catch(error){if(me.status==='offline'){try{me=await api.status('working');await sync();return saveSense(key,level);}catch(clockError){toast(clockError.message);return;}}toast(error.message);await sync();renderPanel();}}
document.addEventListener('submit',async e=>{
  e.preventDefault();const form=e.target,err=form.querySelector('.form-error'),submit=form.querySelector('[type="submit"]');if(err)err.textContent='';if(submit)submit.disabled=true;
  try {
    const values=Object.fromEntries(new FormData(form));
    if(form.id==='auth-form'){if(form.dataset.signup==='true'){if(values.password!==values.confirm)throw new Error('비밀번호가 서로 달라요. 다시 확인해 주세요.');me=await api.signup(values);}else me=await api.login(values.email);go(me.complete?'/office':'/onboarding');}
    if(form.id==='away-form'){me=await api.awayNote(values.note||'');await sync();softRefresh();renderPanel();toast(values.note?.trim()?'자리 비움 상세를 남겼어요.':'자리 비움 상세를 지웠어요.');}
    if(form.id==='quick-form'){if(charCount(values.message)>20)throw new Error('상태 메시지는 20자까지 입력할 수 있어요.');await saveQuick();document.querySelector('#quick-input')?.focus();}
    if(form.id==='message-form'){await api.message(values.message);closeModal();await refreshOffice();toast('말풍선에 오늘의 한마디를 담았어요.');}
    if(form.id==='senses-form'){await api.senses(Object.fromEntries(Object.entries(values).map(([k,v])=>[k,Number(v)])));closeModal();await refreshOffice();toast('지금의 감각을 공유했어요.');}
    if(form.id==='profile-form'){saveDraft(form);const onboarding=form.dataset.onboarding==='true';if(onboarding&&step===1){if(!draft.seat)throw new Error('지도에서 내 자리를 선택해 주세요.');step=2;renderProfile(true);window.scrollTo(0,0);}else{me=await api.profile(draft);go('/office');toast('나의 프로필을 저장했어요.');}}
  }catch(error){if(err)err.textContent=error.message;else toast(error.message);}finally{if(submit)submit.disabled=false;}
});
document.addEventListener('keydown',e=>{if(!modalRoot.firstChild)return;if(e.key==='Escape'){closeModal();return;}if(e.key==='Tab'){const nodes=[...modalRoot.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea,a[href],select')];const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&(document.activeElement===first||document.activeElement.classList.contains('modal'))){last?.focus();e.preventDefault();}else if(!e.shiftKey&&(document.activeElement===last||document.activeElement.classList.contains('modal'))){first?.focus();e.preventDefault();}}});
window.addEventListener('popstate',()=>{closeModal();renderRoute();});
window.addEventListener('storage',async()=>{try{await sync();if(!me){go('/login');return;}softRefresh();}catch(e){toast(e.message);}});
setInterval(async()=>{if(document.hidden||!document.querySelector('.hub'))return;try{await sync();if(!me)return go('/login');softRefresh();}catch(e){toast(e.message);}},15000);
renderRoute();

let panStart=null;
document.addEventListener('pointerdown',e=>{const s=e.target.closest('#map-scroll');if(!s||mapZoom<=1||e.button!==0||e.target.closest('.map-person'))return;panStart={x:e.clientX,y:e.clientY,l:s.scrollLeft,t:s.scrollTop,s};s.classList.add('panning');});
document.addEventListener('pointermove',e=>{if(!panStart)return;panStart.s.scrollLeft=panStart.l-(e.clientX-panStart.x);panStart.s.scrollTop=panStart.t-(e.clientY-panStart.y);});
document.addEventListener('pointerup',()=>{panStart?.s.classList.remove('panning');panStart=null;});
document.addEventListener('wheel',e=>{if(!(e.ctrlKey||e.metaKey)||!e.target.closest('#map-scroll'))return;e.preventDefault();setMapZoom(mapZoom+(e.deltaY<0?ZOOM_STEP:-ZOOM_STEP));},{passive:false});
