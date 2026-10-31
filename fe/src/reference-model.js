import {normalizeCharacter,legacyCharacter,HAIR_COLORS,EYE_COLORS,OUTFIT_COLORS} from './character.js';
export function referenceCharacter(user){
  if(user.referenceCharacter)return user.referenceCharacter;
  const c=normalizeCharacter(user.character||legacyCharacter(user.avatar));
  return {hair:['bob','bun','long','short','long','twin'][c.hair],hairColor:HAIR_COLORS[c.hairColor].hex,eye:EYE_COLORS[c.eye].hex,outfit:['shirt','shirt','cardigan','hoodie','suit','shirt'][c.outfit],top:OUTFIT_COLORS[c.color],bottom:c.gender==='f'?'skirt':'pants',special:c.skin?'a_'+c.skin:null};
}
export const referenceSeat=user=>user.referenceSeat||(user.seat||'B-2').replace(/-0+(\d+)/,'-$1');
export function referencePeople(users,current){
  const all=users.some(u=>u.id===current.id)?users:[current,...users];
  return all.map(u=>({id:u.id===current.id?'me':u.id,sourceId:u.id,name:u.name,role:u.role,seat:referenceSeat(u),floor:u.floor,team:'d',status:({working:'work',away:'away',offline:'off'})[u.status]||'off',reason:({점심:'meal',미팅:'meeting',외근:'outside'})[u.reason]||null,awayNote:u.awayNote||'',since:u.statusAt?new Intl.DateTimeFormat('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(u.statusAt)):'',task:'',msg:u.message||'',msgIcon:u.messageIcon||null,alert:['mute','hot','smell','eye'].includes(u.messageIcon),cfg:referenceCharacter(u),senses:{noise:u.senses?.noise||3,temp:u.senses?.temperature||3,humid:u.senses?.humidity||3,smell:u.senses?.smell||3,discomfort:u.senses?.discomfort||3,crowd:u.senses?.crowding||3},sensi:{visual:u.sensitivity?.visual||3,audio:u.sensitivity?.auditory||3,smell:u.sensitivity?.olfactory||3},desc:u.description||''}));
}
