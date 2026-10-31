"""Generate a technical SVG overlay and SQL seed coordinates; preserve source PNG."""
from pathlib import Path
import hashlib
import html
import json
import re
import struct
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent
source = next((ROOT.parent / 'fe').glob('*.png'))
raw = source.read_bytes()
assert raw[:8] == b'\x89PNG\r\n\x1a\n'
width, height = struct.unpack('>II', raw[16:24])
assert (width, height) == (4938, 2868)
# Visually estimated chair centers in the 2048px-wide inspection rendering.
# Convert both axes using the same image scale. These require human review.
groups = [
    ('A', '창가 일렬 좌석', [(x, 162) for x in [573,656,736,827,916,1004,1091,1178,1264,1351,1437,1522,1605,1691,1778,1864]]),
    ('B', '위쪽 왼쪽 테이블', [(x,y) for y in [263,416] for x in [703,773]]),
    ('C', '위쪽 가운데 테이블', [(x,y) for y in [263,416] for x in [1038,1119]]),
    ('D', '위쪽 오른쪽 테이블', [(x,y) for y in [263,416] for x in [1473,1547,1634,1715]]),
    ('E', '중간 왼쪽 테이블', [(x,y) for y in [618,770] for x in [620,693,768,838]]),
    ('F', '중간 가운데 테이블', [(x,y) for y in [618,770] for x in [1029,1105,1184,1262]]),
    ('G', '아래쪽 왼쪽 테이블', [(x,y) for y in [877,1029] for x in [620,693,768,838]]),
    ('H', '아래쪽 가운데 테이블', [(x,y) for y in [877,1029] for x in [1029,1105,1184,1262]]),
    ('I', '오른쪽 세로 테이블', [(x,y) for y in [624,695,770,843,915,987] for x in [1577,1768]]),
]
seats = []
for group, name, points in groups:
    for index, (x,y) in enumerate(points, 1):
        px, py = round(x * width / 2048), round(y * width / 2048)
        seats.append(dict(label=f'{group}-{index:02}', group=group, area=name,
                          x_px=px, y_px=py, x_ratio=round(px/width,8), y_ratio=round(py/height,8)))
assert len(seats) == 76
assert len({s['label'] for s in seats}) == len(seats)
assert all(0 <= s['x_ratio'] <= 1 and 0 <= s['y_ratio'] <= 1 for s in seats)
previous_path = ROOT/'seat_coordinates.json'
previous = json.loads(previous_path.read_text(encoding='utf-8')) if previous_path.exists() else {}
reviewed = (previous.get('status') == 'user_visual_review_approved'
            and previous.get('sha256') == hashlib.sha256(raw).hexdigest()
            and previous.get('seats') == seats)
data = dict(source=str(source.relative_to(ROOT.parent)), sha256=hashlib.sha256(raw).hexdigest(),
            floor_number=1, map_width=width, map_height=height,
            status='user_visual_review_approved' if reviewed else 'visually_estimated_pending_review',
            seat_count=len(seats), seats=seats)
if previous.get('company_name'):
    data['company_name'] = previous['company_name']
(ROOT/'seat_coordinates.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

seed = ROOT/'002_company_setup_example.sql'
content = seed.read_text(encoding='utf-8')
values = ',\n    '.join(f"('{s['label']}',{s['x_ratio']:.8f},{s['y_ratio']:.8f})" for s in seats)
replacement = 'CROSS JOIN (VALUES\n    '+values+'\n  ) s(label,x_ratio,y_ratio)'
content, count = re.subn(r'CROSS JOIN \(VALUES.*?\) s\(label,x_ratio,y_ratio\)',replacement,content,flags=re.S)
assert count == 1
content = content.replace('-- Company name and the two example seats below still require replacement.',
    '-- All 76 pictured chairs are included. Coordinates are visual estimates: review seat_map_preview.html.\n-- Company name still requires replacement; do not execute until the map has been reviewed.')
seed.write_text(content,encoding='utf-8')

image_href = '../fe/'+quote(source.name)
circles = []
for s in seats:
    label = s['label']
    detail = f"{label} | {s['area']} | ({s['x_px']}, {s['y_px']})px | ({s['x_ratio']}, {s['y_ratio']})"
    circles.append(f'<g class="seat" tabindex="0" data-info="{html.escape(detail)}"><title>{html.escape(detail)}</title>'
        f'<circle cx="{s["x_px"]}" cy="{s["y_px"]}" r="38"/>'
        f'<text x="{s["x_px"]}" y="{s["y_px"]}" dy=".35em">{label}</text></g>')
legend = ''.join(f'<li><b>{g}</b> {name}: {len(points)}석</li>' for g,name,points in groups)
document = '''<!doctype html>
<html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>정보관 1층 좌석 검토 — 76석</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f4f6fa;color:#182230;font:16px/1.6 system-ui,sans-serif}
main{max-width:1800px;margin:auto;padding:24px}h1{margin:0;font-size:26px}p{margin:8px 0 16px}
.panel{background:white;border:1px solid #d9dfe9;border-radius:12px;padding:18px;margin:16px 0}
.toolbar{display:flex;gap:16px;align-items:center;flex-wrap:wrap}button{padding:8px 16px;cursor:pointer}
.map{overflow:auto;background:#202733;border-radius:8px}svg{display:block;width:100%;min-width:1000px;height:auto}
.seat{cursor:crosshair}.seat circle{fill:#fff;fill-opacity:.9;stroke:#1554b8;stroke-width:5}
.seat text{text-anchor:middle;font:bold 24px system-ui;fill:#102b50;pointer-events:none}
.seat:hover circle,.seat:focus circle{fill:#ffe37c;fill-opacity:1;stroke:#cb7600;stroke-width:7}
.hidden .seat{display:none}ul{display:flex;flex-wrap:wrap;gap:8px 30px;list-style:none;padding:0;margin:0}
#info{font-variant-numeric:tabular-nums}small{color:#526175}
</style><main>
<h1>정보관 1층 · 전체 의자 76석</h1>
<p>좌석 중심 좌표 초안입니다. 번호가 의자 위에 있는지, 빠지거나 중복된 의자가 없는지 확인해주세요.</p>
<div class="panel toolbar"><button id="toggle">번호 숨기기</button><span id="info">번호에 마우스를 올리면 좌표를 확인할 수 있습니다.</span></div>
<div class="map" id="map"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4938 2868" role="img" aria-label="정보관 1층 원본 지도와 좌석 번호">
<image href="__IMAGE__" width="4938" height="2868"/>__CIRCLES__
</svg></div>
<div class="panel"><ul>__LEGEND__</ul></div>
<small>원본: 4938 × 2868px · 좌표는 원본 이미지 전체 기준 · 현재 좌표는 이미지 육안 추정이며 사용자 검토 전입니다.
Supabase에 업로드할 파일은 fe 폴더의 원본 PNG입니다. 이 확인용 지도는 업로드하지 않습니다.</small>
</main><script>
const info=document.getElementById('info');
document.querySelectorAll('.seat').forEach(s=>{['mouseenter','focus','click'].forEach(e=>s.addEventListener(e,()=>{info.textContent=s.dataset.info}))});
document.getElementById('toggle').addEventListener('click',e=>{const hidden=document.getElementById('map').classList.toggle('hidden');e.target.textContent=hidden?'번호 표시하기':'번호 숨기기'});
</script></html>
'''
document=document.replace('__IMAGE__',image_href).replace('__CIRCLES__','\n'.join(circles)).replace('__LEGEND__',legend)
if reviewed:
    document=document.replace('좌석 중심 좌표 초안입니다. 번호가 의자 위에 있는지, 빠지거나 중복된 의자가 없는지 확인해주세요.',
                              '사용자가 전체 76석의 번호와 배치를 확인했습니다. 회사명: '+html.escape(data.get('company_name','')))
    document=document.replace('현재 좌표는 이미지 육안 추정이며 사용자 검토 전입니다.',
                              '현재 좌표는 이미지 기준으로 지정하고 사용자 시각 검토를 완료했습니다.')
(ROOT/'seat_map_preview.html').write_text(document,encoding='utf-8')
print(json.dumps({'map_width':width,'map_height':height,'seat_count':len(seats),
                  'groups':{g:len(points) for g,_,points in groups}},ensure_ascii=False))
