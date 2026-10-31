import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync,existsSync} from 'node:fs';
import {createAdapter} from '../src/data.js';
const source=readFileSync(new URL('../src/senspace.js',import.meta.url),'utf8');
async function setup({login=true}={}){
  const memory=new Map(),storage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)};
  const api=createAdapter(storage),current=login?await api.demo():null;
  class Logic{setState(p){this.state={...this.state,...(typeof p==='function'?p(this.state):p)};}forceUpdate(){}}
  const SP={ready:true,defaultChar:{hair:'bob'},char:()=>'/avatar.png',hair:{bob:{},short:{}},hairColors:['#000000'],eyeColors:['#000000'],skinTones:['#eeeeee'],special:Object.fromEntries(['a_red','a_yellow','a_green','a_purple','bear','cat','frog','bunny'].map(k=>[k,{name:k}]))};
  const context=vm.createContext({window:{SenspaceSession:{api,current},SP},localStorage:storage,location:{pathname:'/login'},history:{replaceState(){}},React:{createRef:()=>({current:null})},DCLogic:Logic,Intl,console,setTimeout:()=>0,clearTimeout(){},clearInterval(){},FormData:class{constructor(form){return new Map(Object.entries(form));}}});
  vm.runInContext(source+'\nglobalThis.App=Component;globalThis.seats=SEATS;',context);
  const app=new context.App();return{app,context,memory,storage};
}
test('v2 uses exact reference seats and opens a small profile before the sensory card',async()=>{
  const {app,context}=await setup();assert.equal(context.seats.length,48);
  let v=app.renderVals();assert.equal(v.showSpace,true);assert.equal(v.hasPop,false);
  v.mapPeople[1].onClick();v=app.renderVals();assert.equal(v.hasPop,true);assert.equal(v.pop.name,'최민수');
  v.pop.openCard();v=app.renderVals();assert.equal(v.showCard,true);assert.equal(v.card.name,'최민수');assert.equal(v.hasPop,false);
});
test('team rectangle is clamped, requires a useful area, and persists',async()=>{
  const {app,memory}=await setup();app.mapRef.current={getBoundingClientRect:()=>({left:0,top:0})};
  app.renderVals().startSelect();let v=app.renderVals();v.selDown({stopPropagation(){},currentTarget:{},clientX:-200,clientY:-200});v.selMove({clientX:9000,clientY:9000});v.selUp();
  assert.equal(app.state.selRect.x,0);assert.equal(app.state.selRect.y,0);assert.equal(app.state.selRect.w,1400);assert.equal(app.state.selRect.h,800);
  app.renderVals().saveTeam();assert.equal(app.state.view,'team');assert.ok(memory.has('senspace.team'));
  app.setState({selecting:true,selRect:{x:0,y:0,w:10,h:10}});app.renderVals().saveTeam();assert.equal(app.state.selecting,true);
});
test('character selection saves and survives rebuilding the app',async()=>{
  const {app,context}=await setup();app.openEditor('header');let v=app.renderVals();assert.equal(v.ed.isFace,true);
  v.ed.heads[1].onClick();app.renderVals().ed.next();v=app.renderVals();assert.equal(v.ed.isOutfit,true);v.ed.outfits[1].onClick();app.renderVals().ed.next();
  assert.equal(app.state.modal,null);const saved=app.state.people[0].cfg;const reloaded=new context.App();assert.equal(reloaded.state.people[0].cfg.hair,saved.hair);assert.equal(reloaded.state.people[0].cfg.top,saved.top);
});
test('seat picker excludes occupied seats and saves a free seat',async()=>{
  const {app}=await setup();app.setState({pickSeat:true});let v=app.renderVals();assert.ok(!v.seatMarkers.some(s=>s.id==='B-1'));
  const target=v.seatMarkers.find(s=>s.id!=='B-2');target.onClick();await app.renderVals().confirmSeat();assert.equal(app.state.people[0].seat,target.id);assert.equal(app.state.pickSeat,false);
});
test('settings save scopes and switches; disabled or quiet notifications do not send',async()=>{
  const {app,memory}=await setup();app.renderVals().openSettings();let v=app.renderVals();assert.equal(v.showSettings,true);assert.equal(v.notifRows.length,6);
  v.scopeBtns[1].onClick();app.renderVals().notifRows[0].onClick();app.renderVals().saveSettings();const n=JSON.parse(memory.get('senspace.notif'));assert.equal(n.scope,'floor');assert.equal(n.items.sense,false);
  app.renderVals().toggleMaster();app.notify('test');assert.match(app.state.toast,/꺼져/);app.renderVals().toggleMaster();app.updMe({task:'집중 근무 중'});app.notify('test');assert.match(app.state.toast,/집중/);
});
test('closing notification settings discards unsaved changes',async()=>{
  const {app}=await setup();const before=JSON.stringify(app.state.notif);app.renderVals().openSettings();app.renderVals().toggleMaster();app.renderVals().scopeBtns[2].onClick();app.renderVals().closeModal();assert.equal(JSON.stringify(app.state.notif),before);
});
test('away reason starts closed, toggles independently and appears without a status prefix',async()=>{
  const {app,context}=await setup();let v=app.renderVals();assert.equal(v.awayOpen,false);v.toggleAway();v=app.renderVals();assert.equal(v.awayOpen,true);v.onAwayDraft({target:{value:'회의, 16시 복귀'}});app.renderVals().saveAway({preventDefault(){}});
  v=app.renderVals();assert.ok(v.bubbles.some(b=>b.text==='회의, 16시 복귀'));v.toggleAway();assert.equal(app.renderVals().awayOpen,false);assert.equal(app.state.people[0].status,'away');
  const reloaded=new context.App();assert.equal(reloaded.renderVals().awayOpen,false);assert.equal(reloaded.state.people[0].awayNote,'회의, 16시 복귀');reloaded.renderVals().clockButtons[0].onClick();assert.equal(reloaded.state.people[0].status,'work');
});
test('login and signup validate and connect onboarding to the existing account adapter',async()=>{
  const {app}=await setup({login:false});assert.equal(app.renderVals().isAuth,true);app.renderVals().showSignup();
  const event=values=>({preventDefault(){},currentTarget:values});
  await app.authenticate(event({name:'테스트',email:'test@example.com',password:'12345678',confirm:'bad',code:'ONYU2026'}));assert.match(app.state.authError,/일치/);
  await app.authenticate(event({name:'테스트',email:'test@example.com',password:'12345678',confirm:'12345678',code:'ONYU2026'}));assert.equal(app.state.screen,'welcome');assert.equal(app.state.people[0].name,'테스트');
  app.renderVals().goInfo();app.renderVals().goChar();assert.equal(app.state.ed.from,'onboard');
  await app.logout();assert.equal(app.state.screen,'auth');await app.authenticate(event({email:'test@example.com',password:'12345678'}));assert.equal(app.state.screen,'welcome');
});
test('the Vite entry only references local assets that exist',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.ok(html.includes('type="module" src="/src/main.jsx"'));
  for(const match of html.matchAll(/(?:src|href)="(\/(?!\/)[^"{}]+)"|url\((\/[^)]+)\)/g)){
    const path=decodeURIComponent(match[1]||match[2]);assert.ok(existsSync(new URL('..'+path,import.meta.url)),path);
  }
  assert.ok(!html.includes('senspace-bootstrap'));assert.ok(!html.includes('<x-dc>'));
});
test('the app is a single React tree with no iframe bridge',()=>{
  for(const file of ['src/main.jsx','src/react/App.jsx','src/react/OfficePage.jsx','src/react/ReferenceViews.jsx']){
    const text=readFileSync(new URL('../'+file,import.meta.url),'utf8');
    assert.ok(!/postMessage|contentWindow|<iframe/i.test(text),file);
  }
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.ok(!/senspace\.css|sprites\.js|app\.js/.test(html));
});
