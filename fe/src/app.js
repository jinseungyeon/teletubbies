import { createAdapter, SENSES, SENSITIVITY, TRAITS, SEATS, FLOORS, STATUS, REASONS, COMPANY, MAP_SIZE, QUICK_STATUS, currentSenses, charCount } from './data.js';
import { avatar, officeSVG } from './map.js';
import { HAIR_STYLES, HAIR_COLORS, EYE_COLORS, OUTFITS, OUTFIT_PALETTES, SKINS, GENDERS, DEFAULT_CHARACTER, legacyCharacter, randomCharacter, characterFromPixels, characterSVG } from './character.js';
import { HEATMAP_VIEWS, HEAT_COLORS, heatSamples, heatmapSVG } from './heatmap.js';

const api = createAdapter(localStorage);
const app=document.querySelector('#app'), modalRoot=document.querySelector('#modal-root');
let me=null, people=[], floor=3, filter='all', query='', selectedId=null, infoTab='sense', quickIcon=null, menuOpen=false, draft=null, step=1, modalKind='', modalUser=null, lastFocus=null, toastTimer;
let miniView='noise';
let profileStash=null;
const restoreDraft=()=>{const d=profileStash?{...profileStash,character:me.character}:structuredClone(me);profileStash=null;return d;};
let charDraft=null, charStep=1, charMethod='custom', faceTab='hair', outfitTab='basic', photoURL='', photoLook=null;
const look=u=>u?.character||u?.avatar||0;
const esc = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paths={
  home:'M3 10 12 3l9 7M5 9v11h5v-6h4v6h5V9',
  users:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8m8-7a4 4 0 0 1 0 7',
  search:'m21 21-5-5M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14',
  chevron:'m8 10 4 4 4-4', close:'m6 6 12 12M6 18 18 6', arrow:'M4 12h16m-6-6 6 6-6 6',
  map:'m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5m6-2v16m6-14v16',
  pin:'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0ZM15 10a3 3 0 1 0-6 0 3 3 0 0 0 6 0',
  message:'M21 15a3 3 0 0 1-3 3H8l-5 4V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v9M7 8h10M7 12h7',
  card:'M3 4h18v16H3V4m11 5h4m-4 4h4M6 17v-2a3 3 0 0 1 6 0v2M9 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4',
  sound:'m11 4-6 5H2v6h3l6 5V4m4 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14',
  leaf:'M20 3C8 2 2 8 5 16s17 4 15-13ZM5 21 16 9',
  thermometer:'M9 14V5a3 3 0 0 1 6 0v9a5 5 0 1 1-6 0m3-7v10',
  drop:'M12 2S4 11 4 15a8 8 0 0 0 16 0c0-4-8-13-8-13Z',
  eye:'M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12Zm14 0a3 3 0 1 0-6 0 3 3 0 0 0 6 0',
  sun:'M12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2m-1 7a6 6 0 1 0-12 0 6 6 0 0 0 12 0',
  edit:'m15 3 6 6M3 21l5-1L21 7l-4-4L4 16l-1 5Z',
  logout:'M9 4H3v16h6m5-13 5 5-5 5M8 12h13',
  check:'m5 12 4 4L19 6', clock:'M12 7v5l3 2m6-2a9 9 0 1 0-18 0 9 9 0 0 0 18 0',
  mail:'M3 5h18v14H3V5m0 0 9 7 9-7',lock:'M6 10h12v11H6V10m2 0V6a4 4 0 0 1 8 0v4',
  refresh:'M20 11a8 8 0 1 0-2 6m2-12v6h-6',shuffle:'M16 3h5v5M4 20 21 3m0 13v5h-5M15 15l6 6M4 4l5 5',
  shirt:'m8 3-5 3 2 5 3-1v11h8V10l3 1 2-5-5-3a4 4 0 0 1-8 0',star:'m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3',
  hood:'M5 20v-8a7 7 0 0 1 14 0v8M8 14c2-3 6-3 8 0',circle:'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18',
  camera:'M4 7h3l2-3h6l2 3h3v13H4V7m11 6a3 3 0 1 0-6 0 3 3 0 0 0 6 0',back:'M20 12H4m6-6-6 6 6 6',
  bell:'M6 9a6 6 0 1 1 12 0c0 6 3 8 3 8H3s3-2 3-8m4 12a2 2 0 0 0 4 0',expand:'M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7',more:'M5 12h1M11.5 12h1M18 12h1',
  plus:'M12 5v14M5 12h14',minus:'M5 12h14',spark:'m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7',
};
function icon(name,size=20) {return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.spark}"/></svg>`;}
function brand() {return `<a href="/office" data-nav="/office" class="brand"><span class="brand-mark">${icon('spark',24)}</span><span>Sensory<span class="brand-light"> Fit</span><small>OUR LITTLE OFFICE</small></span></a>`;}
function badge(u) {return `<span class="status-pill ${u.status}"><i></i>${u.status==='away'?esc(u.reason)+' 중':STATUS[u.status]}</span>`;}
function toast(message) {const el=document.querySelector('#toast');el.textContent=message;el.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),3200);}
function go(url) {closeModal();history.pushState({},'',url);renderRoute();}
async function sync(){me=await api.me();people=await api.list();}
async function renderRoute() {
  try {
    await sync();const route=location.pathname;
    if(!me && !['/login','/signup'].includes(route)){history.replaceState({},'','/login');}
    if(me && !me.complete && !['/onboarding','/character','/login','/signup'].includes(location.pathname))history.replaceState({},'','/onboarding');
    switch(location.pathname){case '/signup':renderAuth(true);break;case '/login':renderAuth(false);break;case '/character':if(!me)return go('/login');charDraft={...DEFAULT_CHARACTER,...(me.character||legacyCharacter(me.avatar))};charStep=me.complete&&me.character?3:1;faceTab='hair';outfitTab=charDraft.skin?'special':'basic';photoURL='';photoLook=null;renderCharacter();break;case '/onboarding':if(!me)return go('/login');if(!me.character)return go('/character');draft=restoreDraft();step=1;renderProfile(true);break;case '/profile':if(!me)return go('/login');draft=restoreDraft();renderProfile(false);break;default:if(!me)return go('/login');floor=me.floor;selectedId=me.id;menuOpen=false;renderOffice();}
  }catch(error){app.innerHTML=`<main class="fatal"><h1>화면을 불러오지 못했어요</h1><p>${esc(error.message)}</p><button class="primary" data-action="retry">다시 시도</button></main>`;}
}
function renderAuth(signup) {
  app.innerHTML=`<main class="auth-page"><section class="auth-story">${brand()}<div class="story-heading"><span class="eyebrow">A LITTLE UNDERSTANDING, A BETTER DAY</span><h1>같은 공간,<br>서로 다른 감각.</h1><p>말하지 않아도 조금 더 이해할 수 있도록.<br>우리 팀의 편안한 하루가 여기서 시작돼요.</p></div><div class="auth-office">${officeSVG()}<span class="story-person one">${avatar(0,58)}<b>커피 마실 사람 ☕</b></span><span class="story-person two">${avatar(4,54)}<b>오늘은 조금 조용히 🌿</b></span></div><div class="story-footer"><span>작은 배려로 연결되는 우리 사무실</span><span>✦ &nbsp; SENSORY FIT</span></div></section><section class="auth-form-section"><div class="auth-form-wrap"><span class="eyebrow">WELCOME TO OUR OFFICE</span><h2>${signup?'함께할 준비 되셨나요?':'다시 만나 반가워요'}</h2><p class="muted">${signup?'내 자리를 만들고 동료들과 연결해 보세요.':'오늘의 나를 나누고, 동료의 하루를 살펴보세요.'}</p><div class="auth-tabs"><a href="/login" data-nav="/login" class="${!signup?'active':''}">로그인</a><a href="/signup" data-nav="/signup" class="${signup?'active':''}">회원가입</a></div><form id="auth-form" data-signup="${signup}">${signup?`<label>이름<input name="name" autocomplete="name" required maxlength="30" placeholder="이름을 입력해 주세요" /></label>`:''}<label>회사 이메일<div class="input-icon">${icon('mail')}<input type="email" name="email" autocomplete="email" required placeholder="name@company.com" /></div></label><label>비밀번호<div class="input-icon">${icon('lock')}<input type="password" name="password" autocomplete="${signup?'new-password':'current-password'}" required minlength="8" placeholder="8자 이상 입력해 주세요" /></div></label>${signup?`<label>비밀번호 확인<input name="confirm" type="password" autocomplete="new-password" required minlength="8" placeholder="비밀번호를 한 번 더 입력해 주세요" /></label><label>기업 초대 코드<input name="code" required placeholder="ONYU2026" /><small>데모 초대 코드: ONYU2026</small></label>`:''}<p class="form-error" role="alert"></p><button class="primary full" type="submit">${signup?'내 사무실 만들기':'사무실 입장하기'}${icon('arrow')}</button></form><div class="divider"><span>먼저 둘러보고 싶다면</span></div><button class="secondary full" data-action="demo">${icon('spark')}데모 사무실 둘러보기</button><div class="demo-note">프런트엔드 데모 · 입력한 비밀번호는 저장하거나 인증하지 않아요.<br>데이터는 이 브라우저에만 저장됩니다.</div></div><footer class="auth-legal">서로를 이해하는 더 좋은 방법. &nbsp; © Sensory Fit</footer></section></main>`;
}
const FLOOR_TEAMS={3:'디자인 팀',2:'마케팅 팀'};
const AWAY_META={점심:['🍴','점심 식사 중'],미팅:['📹','회의 중'],외근:['✈️','외근 중']};
const pct=(seat,dy=36)=>`left:${seat.x/MAP_SIZE.width*100}%;top:${(seat.y+dy)/MAP_SIZE.height*100}%`;
function statusInfo(u){
  if(u.status==='offline')return {icon:'🌙',text:'퇴근',tone:'offline'};
  if(u.status==='away'){const [i,t]=AWAY_META[u.reason]||['⏸️','자리 비움'];return {icon:i,text:t,tone:'away'};}
  return u.message?{icon:u.messageIcon||'💬',text:u.message,tone:'message'}:{icon:'🌿',text:'근무 중',tone:'working'};
}
const selectedPerson=()=>people.find(p=>p.id===selectedId)||me;
function hubCounts(){const n=s=>people.filter(u=>u.status===s).length;return `<span><i class="dot all"></i>전체 <b>${people.length}</b></span><span><i class="dot working"></i>출근 <b>${n('working')}</b></span><span><i class="dot away"></i>자리 비움 <b>${n('away')}</b></span><span><i class="dot offline"></i>퇴근 <b>${n('offline')}</b></span>`;}
function floorOptions(){return FLOORS.slice().sort((a,b)=>b-a).map(f=>`<option value="${f}" ${floor===f?'selected':''}>${f}층 · ${FLOOR_TEAMS[f]||''}</option>`).join('');}
function renderOffice(){
  app.innerHTML=`<div class="hub"><header class="hub-top">${brand()}<label class="hub-pill hub-floor"><span class="sr-only">사무실 층</span><select id="floor">${floorOptions()}</select></label><div class="hub-pill hub-counts" id="hub-counts" aria-label="근무 현황">${hubCounts()}</div><div class="hub-top-right"><button class="hub-icon" data-action="focus-search" aria-label="동료 검색">${icon('search',22)}</button><button class="hub-icon" data-action="notifications" aria-label="알림">${icon('bell',22)}</button><div class="hub-menu-wrap"><button class="hub-me" data-action="menu" aria-haspopup="menu" aria-expanded="${menuOpen}">${avatar(look(me),30)}<span><strong>${esc(me.name)}</strong><small>${esc(me.role)}</small></span>${icon('chevron',16)}</button>${menuOpen?`<div class="hub-menu" role="menu"><button role="menuitem" data-nav="/profile">${icon('edit',16)}프로필 수정</button><button role="menuitem" data-nav="/character">${icon('spark',16)}캐릭터 꾸미기</button><button role="menuitem" data-action="logout">${icon('logout',16)}로그아웃</button></div>`:''}</div></div></header>
  <main class="hub-main"><section class="hub-map" aria-label="${floor}층 사무실 지도"><div class="hub-stage">${officeSVG()}<div id="map-people"></div></div></section>
  <aside class="hub-side" aria-label="동료 목록"><div class="hub-side-head"><h2>동료 목록 <span id="colleague-count"></span></h2><label class="hub-select"><span class="sr-only">상태 필터</span><select id="filter-select">${[['all','전체'],['working','출근'],['away','자리 비움'],['offline','퇴근']].map(([k,n])=>`<option value="${k}" ${filter===k?'selected':''}>${n}</option>`).join('')}</select></label></div><label class="hub-search">${icon('search',17)}<span class="sr-only">동료 검색</span><input id="search" type="search" placeholder="이름, 직책으로 찾기" value="${esc(query)}" /></label><div id="colleague-list" class="hub-list"></div></aside>
  <section class="hub-bottom"><article class="hub-card hub-profile" id="hub-profile"></article><article class="hub-card hub-info" id="hub-info"></article><article class="hub-card hub-mini" id="hub-mini"></article></section></main></div>`;
  updateMap();updateList();renderPanel();renderMini();
}
function updateMap(){
  const root=document.querySelector('#map-people');if(!root)return;
  const sel=selectedPerson();
  root.innerHTML=people.filter(u=>u.floor===floor).map(u=>{const seat=SEATS.find(s=>s.id===u.seat);if(!seat)return '';const info=statusInfo(u);return `<button class="map-person ${u.status} ${u.id===me.id?'is-me':''} ${u.id===sel.id?'is-selected':''}" style="${pct(seat)}" data-person="${u.id}" aria-label="${esc(u.name)}, ${esc(info.text)}">${u.status!=='offline'&&info.tone!=='working'?`<span class="hub-bubble ${info.tone} ${SEATS.indexOf(seat)%2?'lift':''}"><i>${info.icon}</i><span>${esc(info.text)}</span></span>`:''}${avatar(look(u),40)}<span class="person-name">${esc(u.name)}${u.id===me.id?'<i>나</i>':''}</span></button>`;}).join('');
  const counts=document.querySelector('#hub-counts');if(counts)counts.innerHTML=hubCounts();
}
function updateList(){
  const list=people.filter(u=>(filter==='all'||u.status===filter)&&`${u.name} ${u.role}`.includes(query));
  document.querySelector('#colleague-count').textContent=`(${list.length})`;
  document.querySelector('#colleague-list').innerHTML=list.length?list.map(u=>{const info=statusInfo(u);return `<div class="hub-row ${u.id===selectedPerson().id?'selected':''}"><button class="hub-row-main" data-person="${u.id}"><span class="hub-row-avatar ${u.status}">${avatar(look(u),40)}</span><span class="hub-row-name"><strong>${esc(u.name)}${u.id===me.id?' <em>나</em>':''}</strong><small>${u.floor}층 ${esc(u.seat)}</small></span><span class="hub-row-status ${info.tone}"><i>${info.icon}</i>${esc(info.text)}</span></button><button class="hub-more" data-card="${u.id}" aria-label="${esc(u.name)} 감각 카드 자세히 보기">${icon('more',18)}</button></div>`;}).join(''):`<div class="empty-state">${icon('search',28)}<strong>동료를 찾지 못했어요</strong><p>이름이나 검색 조건을 바꿔 보세요.</p></div>`;
}
function senseBars(u,editable){
  const values=currentSenses(u),off=u.status!=='working';
  return SENSES.map(s=>{const v=values[s.key];const label=v?s.labels[v-1]:'미공유';return editable?`<label class="hub-sense" style="--sense:${s.color};--val:${v?(v-1)/4*100:0}%"><span>${icon(s.icon,15)}${s.name}</span><input type="range" min="1" max="5" step="1" value="${v||1}" data-sense="${s.key}" class="${v?'':'unset'}" ${off?'disabled':''} aria-valuetext="${label}" /><b>${v||'–'}</b></label>`:`<div class="hub-sense" style="--sense:${s.color};--val:${v?(v-1)/4*100:0}%"><span>${icon(s.icon,15)}${s.name}</span><span class="hub-sense-bar ${v?'':'unset'}" role="img" aria-label="${s.name} ${label}"><i></i></span><b>${v||'–'}</b></div>`;}).join('');
}
function renderPanel(){
  const u=selectedPerson(),own=u.id===me.id,info=statusInfo(u);
  const prof=document.querySelector('#hub-profile'),panel=document.querySelector('#hub-info');if(!prof||!panel)return;
  prof.innerHTML=`<div class="hub-profile-head"><span class="hub-profile-art">${avatar(look(u),72)}</span><div><h2>${esc(u.name)}${own?'':' <small>동료</small>'}</h2><p>${esc(u.role)}</p><p class="hub-loc">${icon('pin',14)}${u.floor}층 ${esc(u.seat)}</p></div></div>${own?`<button class="hub-msg" data-action="edit-message"><i>${u.message?u.messageIcon||'💬':'💬'}</i><span>${esc(u.message||'상태 메시지를 남겨보세요')}</span>${icon('edit',16)}</button>`:`<div class="hub-msg static ${info.tone}"><i>${info.icon}</i><span>${esc(info.text)}</span></div><button class="text-button hub-back" data-action="select-me">${icon('back',14)} 내 카드로 돌아가기</button>`}`;
  const tabs=`<div class="hub-tabs" role="tablist"><button role="tab" data-info-tab="sense" aria-selected="${infoTab==='sense'}" class="${infoTab==='sense'?'active':''}">감각 정보</button><button role="tab" data-info-tab="work" aria-selected="${infoTab==='work'}" class="${infoTab==='work'?'active':''}">업무 정보</button></div>`;
  let body;
  if(infoTab==='sense'){
    const chosen=currentQuickIcon();
    const right=own?`<h3>빠른 상태 설정</h3><div class="hub-quick" role="group" aria-label="상태 아이콘 선택">${QUICK_STATUS.map(([ic,label])=>`<button type="button" data-quick="${ic}" class="${chosen===ic?'active':''}" title="${label}" aria-label="${label} 아이콘" aria-pressed="${chosen===ic}">${ic}</button>`).join('')}</div><form id="quick-form" class="hub-quick-input"><label class="sr-only" for="quick-input">상태 메시지</label><span class="hub-quick-icon" aria-hidden="true">${chosen||'💬'}</span><input id="quick-input" name="message" value="${esc(me.message)}" placeholder="상태 메시지를 입력하고 Enter" autocomplete="off" enterkeyhint="done" /><span id="quick-count" class="${charCount(me.message)>20?'over':''}">${charCount(me.message)}/20</span></form><p class="form-error" role="alert"></p>`
      :`<h3>나를 이해하는 작은 힌트</h3><div class="hub-hint">${TRAITS.map((t,i)=>`<span>${icon(t.icon,14)}${t.name} <b>${SENSITIVITY[(u.sensitivity[t.key]||3)-1]}</b></span>`).join('')}</div><p class="hub-desc">${u.description?esc(u.description).replace(/\n/g,'<br>'):'아직 작성한 설명이 없어요.'}</p>`;
    body=`<div class="hub-info-grid"><section><h3>현재 ${own?'내':esc(u.name)+'님의'} 감각 상태</h3>${senseBars(u,own)}${u.status!=='working'?`<small class="hub-note">${own?'출근 후 지금의 감각을 공유할 수 있어요.':'지금은 공유된 감각이 없어요.'}</small>`:''}</section><section>${right}</section></div>`;
  }else{
    body=`<div class="hub-info-grid three"><section><h3>기본 정보</h3><dl class="hub-dl"><dt>${icon('users',14)}이름</dt><dd>${esc(u.name)}</dd><dt>${icon('card',14)}직책</dt><dd>${esc(u.role)}</dd><dt>${icon('home',14)}층</dt><dd>${u.floor}층</dd><dt>${icon('pin',14)}위치</dt><dd>${esc(u.seat)}</dd></dl></section><section><h3>평소 민감도</h3>${TRAITS.map((t,i)=>`<div class="hub-trait"><span>${icon(t.icon,14)}${t.name}</span>${levels(u.sensitivity[t.key],['#7b94bb','#cd8294','#79a78a'][i])}</div>`).join('')}</section><section><h3>현재 ${own?'나의 ':''}상태</h3>${own?`<div class="hub-status"><button data-status="working" class="${u.status==='working'?'active working':''}">${icon('check',16)}출근</button><div class="hub-away"><span>자리 비움</span>${REASONS.map(r=>`<button data-status="away" data-reason="${r}" class="${u.status==='away'&&u.reason===r?'active away':''}">${AWAY_META[r][0]} ${r}</button>`).join('')}</div><button data-status="offline" class="${u.status==='offline'?'active offline':''}">${icon('logout',16)}퇴근</button></div>`:`${badge(u)}`}</section></div>`;
  }
  panel.innerHTML=tabs+`<div class="hub-info-body">${body}</div>`;
}
function renderMini(){
  const root=document.querySelector('#hub-mini');if(!root)return;
  const sense=SENSES.find(s=>s.key===miniView);
  root.innerHTML=`<div class="hub-mini-head"><h3>감각 지도</h3><div class="hub-mini-tools"><label class="hub-select"><span class="sr-only">층 선택</span><select id="mini-floor">${FLOORS.slice().sort((a,b)=>b-a).map(f=>`<option value="${f}" ${floor===f?'selected':''}>${f}층</option>`).join('')}</select></label><label class="hub-select"><span class="sr-only">감각 선택</span><select id="mini-sense">${HEATMAP_VIEWS.map(v=>`<option value="${v.key}" ${miniView===v.key?'selected':''}>${SENSES.find(x=>x.key===v.key).name}</option>`).join('')}</select></label><button class="hub-icon small" data-action="mini-expand" aria-label="감각 지도 크게 보기">${icon('expand',17)}</button></div></div>${miniCanvas()}<div class="hub-legend"><span>${sense.labels[0]}</span><i style="background:linear-gradient(90deg,${HEAT_COLORS.join(',')})"></i><span>${sense.labels[4]}</span></div>`;
}
function miniCanvas(){
  const samples=heatSamples(people,floor,miniView);
  return `<div class="hub-mini-canvas heat" role="img" aria-label="${floor}층 ${SENSES.find(s=>s.key===miniView).name} 감각 지도${samples.length?`, 동료 ${samples.length}명의 체감 기준`:', 공유된 감각 없음'}">${officeSVG()}${heatmapSVG(samples)}${samples.length?'':'<span class="hub-empty">지금 이 층에 공유된 감각이 없어요</span>'}</div>`;
}
function softRefresh(){
  if(!document.querySelector('.hub'))return;
  updateMap();updateList();renderMini();
  if(!document.querySelector('.hub-bottom')?.contains(document.activeElement))renderPanel();
}

// The icon in use: one picked but not yet saved, else the saved message's icon.
const currentQuickIcon=()=>quickIcon??(me.message?me.messageIcon||'':'');
async function saveQuick(){
  const text=document.querySelector('#quick-input')?.value.trim()||'';
  await api.message(text,text?currentQuickIcon():'');
  quickIcon=null;await sync();softRefresh();renderPanel();
  toast(text?'상태 메시지를 바꿨어요.':'상태 메시지를 지웠어요.');
}
// Picking an icon only changes the icon. A saved message takes it right away;
// otherwise it waits for the text. Picking the active icon again clears it.
async function pickQuickIcon(icon){
  const next=currentQuickIcon()===icon?'':icon;
  if(me.message&&!quickIcon){await api.message(me.message,next);await sync();softRefresh();}
  else quickIcon=next;
  const typed=document.querySelector('#quick-input')?.value;
  renderPanel();
  const input=document.querySelector('#quick-input');if(input&&typed!==undefined)input.value=typed;
  document.querySelector(`[data-quick="${icon}"]`)?.focus();
}
function openModal(title,content,kind='generic',wide=false){
  if(!modalRoot.firstChild)lastFocus=document.activeElement;
  modalKind=kind;
  modalRoot.innerHTML=`<div class="modal-backdrop"><section class="modal ${wide?'wide':''}" role="dialog" aria-modal="true" aria-labelledby="modal-title" tabindex="-1"><header class="modal-header"><h2 id="modal-title">${title}</h2><button class="icon-button" data-action="close" aria-label="닫기">${icon('close')}</button></header>${content}</section></div>`;
  app.inert=true;document.body.classList.add('modal-open');modalRoot.querySelector('.modal').focus();
}
function closeModal(){modalRoot.innerHTML='';modalKind='';app.inert=false;document.body.classList.remove('modal-open');if(lastFocus?.isConnected)lastFocus.focus();lastFocus=null;}
function levels(value,color='#a18aba'){return `<span class="level-bars" style="--sense:${color}" aria-label="${value||0} / 5">${[1,2,3,4,5].map(n=>`<i class="${n<=value?'filled':''}"></i>`).join('')}</span>`;}
function showCard(id){
  const u=people.find(p=>p.id===id);if(!u)return;modalUser=id;
  const senses=currentSenses(u),own=u.id===me.id;
  openModal(own?'나의 감각 카드':'동료의 감각 카드',`<div class="card-body"><aside class="card-identity"><div class="portrait">${avatar(look(u),90)}<span class="portrait-spark">✦</span></div><h3>${esc(u.name)}${own?'<span class="you-label">나</span>':''}</h3><p>${esc(u.role)}</p><p class="location">${icon('pin',14)}${u.floor}층 · ${esc(u.seat)}</p>${badge(u)}${own?`<button class="secondary full small" data-nav="/profile">${icon('edit',15)}프로필 수정</button>`:''}</aside><div class="card-information">${u.message?`<div class="card-message">${icon('message',17)}${esc(u.message)}</div>`:''}<section class="card-section"><h3>나의 기본 감각 <span>평소 민감도</span></h3>${TRAITS.map((t,i)=>`<div class="trait-row"><span>${icon(t.icon,17)}${t.name}</span>${levels(u.sensitivity[t.key],['#7b94bb','#cd8294','#79a78a'][i])}<small>${SENSITIVITY[u.sensitivity[t.key]-1]}</small></div>`).join('')}</section><section class="card-section"><div class="section-title"><h3>지금 느끼는 감각</h3>${own?`<button class="text-button" data-action="senses">업데이트 ${icon('edit',13)}</button>`:''}</div><div class="sense-grid">${SENSES.map(s=>`<div class="sense-summary"><span style="color:${s.color}">${icon(s.icon,17)}${s.name}</span><strong>${senses[s.key]?s.labels[senses[s.key]-1]:'미공유'}</strong>${levels(senses[s.key],s.color)}</div>`).join('')}</div><small class="update-time">${Object.keys(senses).length?`${new Intl.DateTimeFormat('ko-KR',{hour:'numeric',minute:'2-digit'}).format(new Date(u.sensesAt))} 업데이트 · 개인의 주관적인 체감이에요`:'현재 공유된 감각이 없어요.'}</small></section><section class="description-box"><h3>나를 이해하는 작은 힌트</h3><p>${u.description?esc(u.description).replace(/\n/g,'<br>'):'아직 작성한 설명이 없어요.'}</p></section></div></div><footer class="modal-footer muted">${icon('leaf',15)} 다르게 느끼는 건 자연스러운 일이에요. 서로의 감각을 존중해 주세요.</footer>`,'card',true);
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
  const shirt=hex=>`<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="m8 3-5 3 2 5 3-1v11h8V10l3 1 2-5-5-3a4 4 0 0 1-8 0Z" fill="${hex}" stroke="#4a4b66" stroke-width="1.2" stroke-linejoin="round"/></svg>`;
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
async function refreshOffice(){await sync();if(document.querySelector('.hub'))renderOffice();}

document.addEventListener('click',async event=>{
  const b=event.target.closest('button,a');
  if(event.target.classList.contains('modal-backdrop')){closeModal();return;}
  if(menuOpen&&!event.target.closest('.hub-menu-wrap')){menuOpen=false;if(document.querySelector('.hub'))renderOffice();}
  if(!b)return;
  if(b.dataset.nav){event.preventDefault();go(b.dataset.nav);return;}
  try{
    if(b.dataset.person){const p=people.find(u=>u.id===b.dataset.person);if(!p)return;selectedId=p.id;if(p.floor!==floor){floor=p.floor;renderOffice();}else{updateMap();updateList();renderPanel();}if(matchMedia('(max-width:1100px)').matches)document.querySelector('.hub-bottom')?.scrollIntoView({behavior:'smooth'});return;}
    if(b.dataset.card){showCard(b.dataset.card);return;}
    if(b.dataset.infoTab){infoTab=b.dataset.infoTab;renderPanel();document.querySelector(`[data-info-tab="${infoTab}"]`)?.focus();return;}
    if(b.dataset.quick){await pickQuickIcon(b.dataset.quick);return;}
    if(b.dataset.seat){saveDraft(document.querySelector('#profile-form'));draft.seat=b.dataset.seat;renderSeatMap();return;}
    if(b.dataset.status){b.disabled=true;try{me=await api.status(b.dataset.status,b.dataset.reason);closeModal();await refreshOffice();toast('동료에게 내 상태를 알려줬어요.');}finally{b.disabled=false;}return;}
    if(b.dataset.cpick){const f=b.dataset.cpick,raw=b.dataset.value;if(f==='skin')charDraft={...charDraft,skin:charDraft.skin===raw?null:raw};else charDraft={...charDraft,[f]:f==='gender'?raw:Number(raw),skin:null};renderCharacter();return;}
    if(b.dataset.ctab){const [group,key]=b.dataset.ctab.split(':');if(group==='face')faceTab=key;else outfitTab=key;renderCharacter();return;}
    if(b.dataset.cstep){charStepMove(b.dataset.cstep);return;}
    if(b.dataset.unshare){modalRoot.querySelectorAll(`input[name="${b.dataset.unshare}"]`).forEach(i=>i.checked=false);return;}
    switch(b.dataset.action){
      case 'demo':b.disabled=true;me=await api.demo();go('/office');break;
      case 'retry':renderRoute();break;
      case 'close':closeModal();break;
      case 'my-card':showCard(me.id);break;
      case 'status':showStatus();break;
      case 'message':showMessage();break;
      case 'senses':showSenses();break;
      case 'clear-message':await api.message('');closeModal();await refreshOffice();toast('상태 메시지를 지웠어요.');break;
      case 'menu':menuOpen=!menuOpen;renderOffice();document.querySelector('.hub-menu button')?.focus();break;
      case 'focus-search':document.querySelector('#search')?.focus();break;
      case 'notifications':toast('새로운 알림이 없어요.');break;
      case 'select-me':selectedId=me.id;updateMap();updateList();renderPanel();break;
      case 'edit-message':infoTab='sense';renderPanel();document.querySelector('#quick-input')?.focus();break;
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
  if(e.target.dataset.sense){const s=SENSES.find(x=>x.key===e.target.dataset.sense),v=Number(e.target.value),row=e.target.closest('.hub-sense');row.style.setProperty('--val',`${(v-1)/4*100}%`);row.querySelector('b').textContent=v;e.target.classList.remove('unset');e.target.setAttribute('aria-valuetext',s.labels[v-1]);}
  if(e.target.id==='quick-input'){const n=charCount(e.target.value),c=document.querySelector('#quick-count');c.textContent=`${n}/20`;c.classList.toggle('over',n>20);}
  if(e.target.id==='message-input'){const value=e.target.value,n=charCount(value);document.querySelector('#char-count').textContent=`${n} / 20`;document.querySelector('#char-count').classList.toggle('over',n>20);document.querySelector('#message-preview').textContent=value||'오늘의 한마디를 남겨 주세요';document.querySelector('#message-form button[type="submit"]').disabled=n>20;}
});
document.addEventListener('change',e=>{if(e.target.name==='char-method'){charMethod=e.target.value;renderCharacter();document.querySelector(`input[name="char-method"][value="${charMethod}"]`)?.focus();return;}if(e.target.id==='char-photo'){charMethod='photo';loadPhoto(e.target.files[0]);return;}if(e.target.id==='floor'||e.target.id==='mini-floor'){floor=Number(e.target.value);renderOffice();document.querySelector('#'+e.target.id)?.focus();return;}if(e.target.id==='filter-select'){filter=e.target.value;updateList();return;}if(e.target.id==='mini-sense'){miniView=e.target.value;renderMini();document.querySelector('#mini-sense')?.focus();return;}if(e.target.dataset.sense){saveSense(e.target);return;}if(e.target.id==='profile-floor'){saveDraft(document.querySelector('#profile-form'));draft.seat='';renderSeatMap();}});
async function saveSense(input){try{await api.senses({...currentSenses(me),[input.dataset.sense]:Number(input.value)});await sync();updateMap();renderMini();const err=document.querySelector('.hub-info .form-error');if(err)err.textContent='';toast('지금의 감각을 공유했어요.');}catch(error){toast(error.message);await sync();renderPanel();}}
document.addEventListener('submit',async e=>{
  e.preventDefault();const form=e.target,err=form.querySelector('.form-error'),submit=form.querySelector('[type="submit"]');if(err)err.textContent='';if(submit)submit.disabled=true;
  try {
    const values=Object.fromEntries(new FormData(form));
    if(form.id==='auth-form'){if(form.dataset.signup==='true'){if(values.password!==values.confirm)throw new Error('비밀번호가 서로 달라요. 다시 확인해 주세요.');me=await api.signup(values);}else me=await api.login(values.email);go(me.complete?'/office':'/onboarding');}
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
