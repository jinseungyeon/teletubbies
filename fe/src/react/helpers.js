import { avatar, officeSVG } from '../map.js';
import { iconHTML, iconGrid, IMAGE_ICONS } from '../pixel-icons.js';
import { heatSamples, heatmapSVG } from '../heatmap.js';
import { SENSES, MAP_SIZE, SEATS, ALERT_ICONS, iconKey } from '../data.js';

export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const look = u => u?.referenceCharacter ? { reference: u.referenceCharacter } : u?.character || u?.avatar || 0;
// Face-only profile image: crops the standing sprite to head and shoulders.
export const faceAvatar = (l, size) => `<span class="avatar-face" style="width:${size}px;height:${size}px;flex:0 0 ${size}px">${avatar(l, size)}</span>`;
export function icon(name, size = 20) { return iconHTML(name, size); }
export function bubbleIcon(name) {
  if (IMAGE_ICONS[name]) return icon(name, 24);
  const points = iconGrid(name).flatMap((row, y) => row.flatMap((pixel, x) => pixel === '.' ? [] : [[x, y]]));
  const xs = points.map(([x]) => x), ys = points.map(([, y]) => y);
  const x = Math.min(...xs), y = Math.min(...ys), w = Math.max(...xs) - x + 1, h = Math.max(...ys) - y + 1;
  return icon(name, 24).replace('viewBox="0 0 16 16"', `viewBox="${x} ${y} ${w} ${h}"`);
}
export const FLOOR_TEAMS = { 3: '디자인 팀', 2: '마케팅 팀' };
export const AWAY_META = { 점심: ['lunch', '점심 식사 중'], 미팅: ['meeting', '회의 중'], 외근: ['outside', '외근 중'] };
export function statusInfo(u) {
  if (u.status === 'offline') return { icon: 'off', text: '퇴근', tone: 'offline' };
  if (u.status === 'away') { const [i, t] = AWAY_META[u.reason] || ['away', '자리 비움']; return { icon: i, text: u.awayNote ? `${t} · ${u.awayNote}` : t, tone: 'away' }; }
  return u.message
    ? { icon: iconKey(u.messageIcon) || 'message', text: u.message, tone: ALERT_ICONS.has(iconKey(u.messageIcon)) ? 'alert' : 'message' }
    : { icon: 'work', text: '근무 중', tone: 'working' };
}
export const pct = (seat, dy = 36) => `left:${seat.x / MAP_SIZE.width * 100}%;top:${(seat.y + dy) / MAP_SIZE.height * 100}%`;
export function miniCanvasHTML(people, floor, view) {
  const samples = heatSamples(people, floor, view);
  const name = SENSES.find(s => s.key === view)?.name || '';
  return `<div class="hub-mini-canvas" role="img" aria-label="${floor}층 ${name} 감각 지도${samples.length ? `, 동료 ${samples.length}명의 체감 기준` : ', 공유된 감각 없음'}"><div class="hub-mini-frame">${officeSVG()}${heatmapSVG(samples)}${samples.length ? '' : '<span class="hub-empty">지금 이 층에 공유된 감각이 없어요</span>'}</div></div>`;
}
export function seatMapHTML(people, me, floor, seat) {
  return `<div class="seat-map-art">${officeSVG()}${SEATS.map(s => {
    const taken = people.some(p => p.id !== me.id && p.floor === Number(floor) && p.seat === s.id);
    return `<button type="button" class="seat-choice ${seat === s.id ? 'chosen' : ''}" style="${pct(s, 28)}" data-seat="${s.id}" ${taken ? 'disabled' : ''} aria-label="${s.id} ${taken ? '사용 중' : '선택 가능'}" aria-pressed="${seat === s.id}">${s.id}</button>`;
  }).join('')}</div>`;
}
