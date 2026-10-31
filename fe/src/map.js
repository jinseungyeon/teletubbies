import { characterSVG, legacyCharacter } from './character.js';
import { DESK_CLUSTERS, MAP_SIZE, FLOOR_PATH } from './data.js';
// Original code-drawn pixel artwork. No external image/font requests.
// Accepts a character object, or a legacy avatar number (0–7).
export function avatar(look=0, size=48) {
  return characterSVG(typeof look==='object'&&look?look:legacyCharacter(look), size);
}
function rect(x,y,w,h,fill,stroke='',sw=2) {return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" ${stroke?`stroke="${stroke}" stroke-width="${sw}"`:''}/>`;}
function plant(x,y,scale=1) {return `<g transform="translate(${x} ${y}) scale(${scale})">${rect(-12,14,28,5,'#655d5140')}${rect(-9,0,20,17,'#805f4c','#4f4c48')}${rect(-11,-3,24,6,'#bc8f63','#4f4c48')}${rect(-6,3,5,10,'#ca9d6e')}${rect(-1,-30,3,29,'#536e46')}${rect(-12,-29,10,14,'#456e4e','#354e3b')}${rect(-16,-23,8,8,'#69965b')}${rect(3,-36,10,18,'#638b51','#354e3b')}${rect(7,-32,9,9,'#85a460')}${rect(-8,-14,9,10,'#759955')}${rect(4,-15,13,8,'#507e4c')}${rect(7,-12,7,3,'#93af6e')}</g>`;}
// Office chair seen from above.
function chair(x,y,vertical=false) {
  const [w,h]=vertical?[20,26]:[28,20];
  return rect(x-w/2+2,y+3,w,h,'#5b607030')+rect(x-w/2,y,w,h,'#9aa0ad','#5c6170')+rect(x-w/2+3,y+3,w-6,h/2-2,'#c3c8d1');
}
function monitor(x,y) {return rect(x-17,y,34,18,'#3c4150','#2c303b')+rect(x-14,y+3,28,11,'#7d8aa0')+rect(x-14,y+3,28,3,'#a8b6c9')+rect(x-4,y+18,8,4,'#4a4f5c')+rect(x-12,y+26,24,5,'#d9d9dd','#8f929a',1);}
// A shared desk: people sit on the chairs above it; chairs below stay free.
function cluster({y,xs}) {
  const top=y+60, left=Math.min(...xs)-42, width=Math.max(...xs)-Math.min(...xs)+84;
  let s=xs.map(x=>chair(x,y+40)+chair(x,top+70)).join('');
  s+=rect(left+4,top+6,width,62,'#7d6a5540')+rect(left,top,width,60,'#c49a62','#6d5644')+rect(left+3,top+3,width-6,52,'#e9c995')+rect(left+3,top+3,width-6,4,'#f6dfb6');
  xs.forEach((x,i)=>{s+=monitor(x,top+8);if(i<xs.length-1)s+=rect(x+40,top+3,2,52,'#c9a571');s+=rect(x+20,top+38,8,9,i%2?'#7aa363':'#e1e4ea','#6b6f78',1);});
  return s;
}
export function officeSVG() {
  const {width:W,height:H}=MAP_SIZE;
  let s=`<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" class="office-art" aria-hidden="true" shape-rendering="crispEdges"><defs><pattern id="marble" width="160" height="160" patternUnits="userSpaceOnUse"><rect width="160" height="160" fill="#d2d3d6"/><path d="M0 80H160M80 0V160" stroke="#c3c4c8" stroke-width="1.5"/><path d="M8 30q30-14 52 6t60 2M20 120q24 10 44-6t56 10M96 60q16 20 40 14" stroke="#e3e4e7" stroke-width="3" fill="none"/><path d="M30 60q18-8 30 4M110 130q12-10 30-4" stroke="#c6c7cb" stroke-width="2" fill="none"/></pattern></defs>`;
  s+=rect(0,0,W,H,'#efe9df');
  // Building shell with the notched entrance wall at the top left.
  const floorPath=FLOOR_PATH;
  s+=`<path d="${floorPath}" fill="url(#marble)"/><path d="${floorPath}" fill="none" stroke="#e9dcc2" stroke-width="12"/><path d="M14 110H244V26H1184V622H14Z" fill="none" stroke="#5e5a66" stroke-width="3"/><path d="M30 126H260V42H1168V606H30Z" fill="none" stroke="#bfb29b" stroke-width="2"/>`;
  // Window wall (top and right) with a counter and chairs along the glass.
  s+=rect(262,22,914,20,'#a7d2ea','#5f8aa3');
  for(let x=262;x<1176;x+=114)s+=rect(x,22,4,20,'#e9f4fb')+rect(x+12,26,40,4,'#d8eef9');
  s+=rect(1172,46,12,566,'#a7d2ea','#5f8aa3');
  for(let y=46;y<612;y+=94)s+=rect(1172,y,12,4,'#e9f4fb');
  s+=rect(262,46,906,10,'#efe9df','#b9ad97',1);
  for(let x=300;x<1150;x+=64)s+=chair(x,64);
  // Storage against the entrance wall.
  for(const x of [46,150])s+=rect(x,130,86,36,'#3e4352','#2b2f3a')+rect(x+4,134,78,10,'#5b6274')+rect(x+38,150,10,4,'#9aa3b5');
  // Front desk.
  s+=rect(38,330,50,252,'#c79b62','#6d5644')+rect(44,336,38,240,'#ecd2a4');
  s+=`<g font-family="system-ui,sans-serif" font-size="17" font-weight="800" fill="#4a3d33" text-anchor="middle">${[...'프론트데스크'].map((ch,i)=>`<text x="63" y="${384+i*30}">${ch}</text>`).join('')}</g>`;
  s+=rect(92,430,34,96,'#e6dccb','#a59a88')+rect(97,470,24,18,'#3c4150')+rect(100,473,18,10,'#9fb1c6')+plant(109,440,.8);
  // Glass entrance door.
  s+=rect(40,600,90,20,'#c5e5f3','#6d8ea0')+rect(84,600,3,20,'#6d8ea0');
  // Pillars.
  for(const [x,y] of [[250,330],[880,318]])s+=`<ellipse cx="${x+3}" cy="${y+30}" rx="28" ry="10" fill="#6b6b7230"/><rect x="${x-26}" y="${y-8}" width="52" height="40" rx="6" fill="#f1f1f0" stroke="#a9a9ae" stroke-width="2"/><ellipse cx="${x}" cy="${y-8}" rx="26" ry="10" fill="#ffffff" stroke="#a9a9ae" stroke-width="2"/>`;
  // Desks.
  s+=DESK_CLUSTERS.map(cluster).join('');
  // Meeting table on the right.
  for(let y=316;y<590;y+=46)s+=chair(986,y,true)+chair(1098,y,true);
  s+=rect(1014,298,64,306,'#7d7a8030')+rect(1010,294,64,306,'#fbfbfa','#9b9aa2')+rect(1015,299,54,296,'#f1f1f0');
  s+=plant(1042,342,.7)+plant(1042,520,.7)+rect(1036,400,12,44,'#d6d6da','#8d8d95',1);
  // Greenery.
  s+=plant(1150,590,1.05)+plant(286,590,.9)+plant(150,250,.9);
  s+='</svg>';
  return s;
}
