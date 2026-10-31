(function (G) {
  const SP = (G.SP = G.SP || {});
  const O = '#2e2433';
  const C = {
    W1: '#f3cf96', W2: '#e3ad6c', W3: '#c98a4f', W4: '#9c6136', W5: '#6e4126',
    M1: '#f4f4f8', M2: '#d5d7e2', M3: '#a5a8bd', M4: '#6e7190', M5: '#474a66',
    S1: '#a9dcf7', S2: '#5aa9e0', S3: '#2f6fb4', BZ: '#2c2f45',
    L1: '#a8dd78', L2: '#6cbb55', L3: '#459447', L4: '#2c6a3a',
    P1: '#ee9a68', P2: '#d06e43', P3: '#9a4a2c',
    F1: '#b3bcf0', F2: '#8a95da', F3: '#6670b8', F4: '#4a518e',
    A1: '#f6bb93', A2: '#e6936a', A3: '#c06b47', A4: '#8e4a33',
    CH1: '#7d82a6', CH2: '#5a5e82', CH3: '#40435f', CR: '#fffaf2'
  };
  const hex = h => { h = h.replace('#', ''); return [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16)); };
  const mix = (a, b, t) => { const A = hex(a), B = hex(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
  const dark = (c, t = 0.22) => mix(c, O, t);
  const light = (c, t = 0.3) => mix(c, '#ffffff', t);
  SP.mix = mix; SP.dark = dark; SP.light = light; SP.O = O;

  function mk(w, h) {
    let c;
    if (SP._canvas) c = SP._canvas(w, h);
    else { c = document.createElement('canvas'); c.width = w; c.height = h; }
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
    return c;
  }
  function api(c) {
    const x = c.getContext('2d');
    const r = (a, b, w, h, col) => { x.fillStyle = col; x.fillRect(a, b, w, h); };
    const p = (a, b, col) => r(a, b, 1, 1, col);
    const clr = (a, b) => x.clearRect(a, b, 1, 1);
    const box = (a, b, w, h, f, o = {}) => {
      const oc = o.o || O;
      r(a, b, w, h, oc); r(a + 1, b + 1, w - 2, h - 2, f);
      if (o.hi) r(a + 1, b + 1, w - 2, 1, o.hi);
      if (o.sh) r(a + 1, b + h - 2, w - 2, 1, o.sh);
      if (o.rs) r(a + w - 2, b + 1, 1, h - 2, o.rs);
      if (o.round) { clr(a, b); clr(a + w - 1, b); clr(a, b + h - 1); clr(a + w - 1, b + h - 1); p(a + 1, b + 1, oc); p(a + w - 2, b + 1, oc); p(a + 1, b + h - 2, oc); p(a + w - 2, b + h - 2, oc); }
    };
    const blob = (cx, cy, rx, ry, col) => {
      x.fillStyle = col;
      for (let yy = Math.floor(cy - ry); yy <= Math.ceil(cy + ry); yy++)
        for (let xx = Math.floor(cx - rx); xx <= Math.ceil(cx + rx); xx++) {
          const dx = (xx + 0.5 - cx) / rx, dy = (yy + 0.5 - cy) / ry;
          if (dx * dx + dy * dy <= 1) x.fillRect(xx, yy, 1, 1);
        }
    };
    const grid = (rows, pal, ox = 0, oy = 0) => rows.forEach((row, j) => [...row].forEach((ch, i) => { if (pal[ch]) p(ox + i, oy + j, pal[ch]); }));
    return { x, r, p, clr, box, blob, grid };
  }
  function outline(c, col = O) {
    const x = c.getContext('2d'), w = c.width, h = c.height;
    const d = x.getImageData(0, 0, w, h).data;
    const a = (i, j) => (i < 0 || j < 0 || i >= w || j >= h ? 0 : d[(j * w + i) * 4 + 3]);
    x.fillStyle = col;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++)
      if (a(i, j) < 128 && (a(i - 1, j) >= 128 || a(i + 1, j) >= 128 || a(i, j - 1) >= 128 || a(i, j + 1) >= 128)) x.fillRect(i, j, 1, 1);
    return c;
  }
  const seeded = s => () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  function books(r, x0, x1, bottom, seed) {
    const rnd = seeded(seed);
    const cols = ['#e5534b', '#4a8fe0', '#f0c04a', '#5fb34f', '#8f7ad8', '#f08a5a', '#efe6d2', '#3f7f8f'];
    let x = x0;
    while (x < x1 - 1) {
      const w = rnd() < 0.4 ? 3 : 2, h = 6 + Math.floor(rnd() * 3), col = cols[Math.floor(rnd() * cols.length)];
      if (x + w > x1) break;
      r(x, bottom - h, w, h, col); r(x, bottom - h, w, 1, light(col, 0.35)); r(x + w - 1, bottom - h + 1, 1, h - 1, dark(col, 0.25));
      x += w; if (rnd() < 0.15) x += 1;
    }
  }
  function deskBase({ r, box }) {
    box(0, 8, 32, 15, C.W2, { hi: C.W1 });
    r(4, 12, 6, 1, '#d9a466'); r(20, 18, 7, 1, '#d9a466');
    box(0, 21, 32, 5, C.W3, { sh: C.W4 });
    box(1, 25, 3, 5, C.W4); box(28, 25, 3, 5, C.W4);
  }

  function wdesk({ r, p, box, blob }, v) {
    box(0, 4, 56, 24, C.W2, { hi: C.W1 }); r(1, 15, 54, 1, '#d9a466'); r(1, 16, 54, 1, '#efc58e');
    box(0, 26, 56, 5, C.W3, { sh: C.W4 }); box(1, 30, 3, 6, C.W4); box(52, 30, 3, 6, C.W4);
    [14, 42].forEach(c => {
      box(c - 7, 0, 14, 11, C.BZ); r(c - 6, 1, 12, 8, C.S2); r(c - 6, 1, 12, 1, C.S1); r(c - 5, 2, 3, 1, C.S1); p(c - 5, 3, C.S1); r(c - 6, 8, 12, 1, C.S3);
      box(c - 2, 10, 4, 3, C.M4); box(c - 4, 12, 8, 2, C.M3);
      box(c - 6, 18, 12, 4, C.M2, { hi: C.M1 }); r(c - 4, 19, 8, 1, C.M3);
    });
    if (v === 0) { box(24, 19, 4, 4, C.CR); p(25, 20, '#7a4a28'); box(48, 18, 5, 5, '#f3efe6', { hi: '#fff' }); blob(50.5, 16, 3, 2.5, C.L3); p(49, 15, C.L1); box(1, 6, 6, 6, C.CR); r(2, 8, 4, 1, C.M2); }
    else { box(1, 18, 6, 4, '#8f7ad8', { hi: '#b3a4ee' }); box(26, 6, 5, 5, C.P2, { hi: C.P1 }); blob(28.5, 4.5, 3, 2.5, C.L3); p(27, 3, C.L1); box(50, 19, 4, 4, '#e5534b'); }
  }

  const F = {
    workdesk: { name: '2인 업무 책상', cat: '업무', w: 56, h: 36, draw(d) { wdesk(d, 0); } },
    workdesk_b: { name: '2인 업무 책상 B', cat: '업무', w: 56, h: 36, draw(d) { wdesk(d, 1); } },
    mtable_long: { name: '롱 회의 테이블', cat: '회의', w: 40, h: 164, draw({ r, box }) {
      box(2, 158, 4, 6, C.M4); box(34, 158, 4, 6, C.M4);
      box(0, 0, 40, 158, '#fbf8f1', { hi: '#ffffff' }); r(1, 78, 38, 1, '#e2dbcc'); r(1, 79, 38, 1, '#ffffff');
      box(18, 30, 4, 16, '#5b5f78'); box(18, 112, 4, 16, '#5b5f78');
      box(0, 154, 40, 6, '#e2dbcc', { sh: '#c9c1b0' });
    } },
    mchair_l: { name: '회의 의자(좌)', cat: '회의', w: 16, h: 18, draw({ r, box }) {
      box(3, 2, 12, 14, '#f7f4ee', { hi: '#ffffff', sh: '#e2dbcc', round: true }); r(5, 1, 9, 2, '#ddd6c8'); r(5, 15, 9, 2, '#ddd6c8');
      box(0, 0, 5, 18, '#ddd6c8', { hi: '#efe9de', round: true });
    } },
    mchair_r: { name: '회의 의자(우)', cat: '회의', w: 16, h: 18, draw({ r, box }) {
      box(1, 2, 12, 14, '#f7f4ee', { hi: '#ffffff', sh: '#e2dbcc', round: true }); r(2, 1, 9, 2, '#ddd6c8'); r(2, 15, 9, 2, '#ddd6c8');
      box(11, 0, 5, 18, '#ddd6c8', { hi: '#efe9de', round: true });
    } },
    pillar_table: { name: '원기둥 테이블', cat: '휴게', w: 30, h: 34, ol: true, draw({ r, blob }) {
      r(3, 9, 24, 18, '#e9e4da'); r(21, 9, 6, 18, '#d8d1c2');
      blob(15, 27, 12, 3.6, '#d0c8b8'); blob(15, 9, 12, 6, '#fbf8f1'); blob(13, 7.5, 6, 2.4, '#ffffff');
    } },
    front_desk: { name: '정보데스크', cat: '구조', w: 34, h: 128, draw({ r, box }) {
      box(0, 0, 34, 128, C.W2, { hi: C.W1, sh: C.W3, rs: C.W3 }); box(0, 0, 8, 128, '#f6f1e8', { hi: '#ffffff' }); r(8, 2, 1, 124, C.W3);
    } },
    wall_tv: { name: '벽걸이 TV', cat: '구조', w: 36, h: 24, draw({ r, box }) {
      box(14, 19, 8, 5, C.M5); box(0, 0, 36, 20, C.BZ, { hi: '#3d4160' }); r(2, 2, 32, 15, '#3a3e5c'); r(3, 3, 12, 1, '#4f5478'); r(3, 4, 5, 1, '#4f5478');
    } },
    desk_screen: { name: '책상 · 모니터(앞)', cat: '업무', w: 32, h: 30, draw(d) {
      const { r, p, box } = d; deskBase(d);
      box(9, 0, 14, 11, C.BZ); r(10, 1, 12, 8, C.S2); r(10, 1, 12, 1, C.S1); r(11, 2, 3, 1, C.S1); p(11, 3, C.S1); r(10, 8, 12, 1, C.S3);
      box(14, 10, 4, 3, C.M4); box(11, 12, 10, 2, C.M3);
      box(8, 15, 13, 4, C.M2, { hi: C.M1 }); r(10, 16, 9, 1, C.M3);
      box(23, 15, 3, 4, C.M1);
      box(26, 9, 4, 5, C.CR); p(27, 10, '#7a4a28'); p(28, 10, '#7a4a28');
    } },
    desk_back: { name: '책상 · 모니터(뒤)', cat: '업무', w: 32, h: 30, draw(d) {
      const { r, p, box, blob } = d; deskBase(d);
      box(14, 10, 4, 4, C.M5);
      box(9, 1, 14, 10, C.M4, { hi: C.M3, sh: C.M5 }); r(15, 5, 2, 2, C.M3);
      box(2, 12, 8, 6, C.CR); r(3, 14, 5, 1, C.M2); r(3, 16, 4, 1, C.M2);
      box(25, 13, 5, 5, C.P2, { hi: C.P1 }); blob(27.5, 11.5, 3, 2.5, C.L3); p(26, 10, C.L1); p(28, 11, C.L2);
      r(19, 15, 4, 1, '#4a8fe0');
    } },
    desk_laptop: { name: '책상 · 노트북', cat: '업무', w: 32, h: 30, draw(d) {
      const { r, p, box } = d; deskBase(d);
      box(10, 5, 12, 9, C.BZ); r(11, 6, 10, 6, C.S2); r(11, 6, 10, 1, C.S1); p(12, 7, C.S1);
      box(9, 13, 14, 5, C.M2, { hi: C.M1 }); r(11, 15, 10, 1, C.M3);
      box(2, 11, 6, 3, '#e5534b'); box(2, 13, 6, 3, '#4a8fe0'); box(3, 15, 5, 3, '#f0c04a');
      box(25, 12, 4, 5, '#fffaf2'); p(26, 13, '#7a4a28');
    } },
    chair: { name: '사무용 의자(앞)', cat: '업무', w: 14, h: 16, draw({ r, p, box }) {
      box(2, 0, 10, 8, C.CH2, { hi: C.CH1, round: true });
      box(1, 6, 12, 6, C.CH1, { hi: '#9ba0c2', sh: C.CH2, round: true });
      r(6, 12, 2, 2, O); box(3, 13, 8, 2, C.M4); p(2, 15, O); p(7, 15, O); p(11, 15, O);
    } },
    chair_b: { name: '사무용 의자(뒤)', cat: '업무', w: 14, h: 16, draw({ r, p, box }) {
      box(1, 0, 12, 6, C.CH1, { hi: '#9ba0c2', round: true });
      box(2, 3, 10, 10, C.CH2, { hi: C.CH1, sh: C.CH3, round: true });
      r(6, 12, 2, 2, O); box(3, 13, 8, 2, C.M4); p(2, 15, O); p(7, 15, O); p(11, 15, O);
    } },
    cabinet: { name: '서랍장', cat: '업무', w: 16, h: 26, draw({ r, box }) {
      box(0, 0, 16, 26, C.M3, { hi: C.M2, sh: C.M4 }); r(1, 1, 14, 3, C.M2);
      for (let i = 0; i < 3; i++) { box(1, 4 + i * 7, 14, 7, C.M2, { o: C.M4, hi: C.M1 }); r(6, 6 + i * 7, 4, 1, C.M5); }
    } },
    bookshelf: { name: '책장', cat: '업무', w: 32, h: 36, draw({ r, p, box }) {
      box(0, 0, 32, 36, C.W4, { hi: C.W3 }); r(2, 3, 28, 31, '#5a3520'); r(1, 1, 30, 2, C.W2);
      r(1, 13, 30, 2, C.W3); r(1, 24, 30, 2, C.W3); r(1, 34, 30, 1, C.W5);
      books(r, 3, 22, 13, 7); books(r, 3, 29, 24, 31); books(r, 9, 29, 34, 53);
      box(23, 8, 6, 5, C.P2, { hi: C.P1 }); r(24, 5, 4, 3, C.L3); p(25, 4, C.L2);
      box(3, 29, 6, 5, '#efe6d2', { hi: '#fff' });
    } },
    printer: { name: '복합기', cat: '업무', w: 24, h: 26, draw({ r, p, box }) {
      box(1, 16, 22, 10, C.M4, { hi: C.M3, sh: C.M5 }); r(4, 20, 16, 1, C.M5);
      box(0, 5, 24, 13, C.M1, { hi: '#fff', sh: C.M2 });
      box(2, 2, 20, 5, C.M2, { hi: C.M1 }); box(6, 0, 12, 4, '#ffffff', { o: C.M4 });
      r(16, 8, 5, 2, C.S2); p(17, 11, '#5fb34f'); p(19, 11, '#f0c04a'); r(4, 13, 10, 2, C.M3);
    } },
    whiteboard: { name: '화이트보드', cat: '회의', w: 46, h: 30, draw({ r, p, box }) {
      r(4, 25, 2, 5, C.M5); r(40, 25, 2, 5, C.M5);
      box(0, 0, 46, 26, C.M3, { hi: C.M2 }); r(2, 2, 42, 21, '#fdfdfb');
      r(5, 5, 14, 1, '#4a8fe0'); r(5, 8, 10, 1, '#4a8fe0'); r(5, 11, 12, 1, '#4a8fe0');
      r(26, 14, 3, 6, '#5fb34f'); r(30, 11, 3, 9, '#f0a93b'); r(34, 8, 3, 12, '#e5534b'); r(25, 20, 14, 1, C.M4);
      box(5, 14, 6, 6, '#f8dc80', { o: '#d8b440' }); box(12, 14, 6, 6, '#f5b6c8', { o: '#d88aa2' });
      r(6, 23, 34, 2, C.M4); p(10, 23, '#e5534b'); p(13, 23, '#4a8fe0');
    } },
    meeting_table: { name: '회의 테이블', cat: '회의', w: 72, h: 38, draw({ r, box }) {
      box(3, 32, 4, 6, C.W4); box(65, 32, 4, 6, C.W4);
      box(0, 0, 72, 30, C.W2, { hi: C.W1 }); r(6, 8, 20, 1, '#d9a466'); r(40, 20, 24, 1, '#d9a466');
      box(0, 28, 72, 6, C.W3, { sh: C.W4 });
      box(8, 7, 10, 8, C.CR); r(10, 9, 6, 1, C.M3); r(10, 11, 5, 1, C.M3);
      box(30, 3, 12, 7, C.BZ); r(31, 4, 10, 5, C.S2); r(31, 4, 10, 1, C.S1); box(29, 9, 14, 5, C.M2, { hi: C.M1 });
      box(52, 5, 4, 7, C.S1, { o: C.S3 }); box(58, 15, 4, 7, C.S1, { o: C.S3 });
      box(18, 18, 9, 7, '#8f7ad8', { hi: '#b3a4ee' }); box(46, 18, 5, 5, C.CR);
    } },
    sofa: { name: '소파', cat: '휴게', w: 44, h: 28, draw({ r, box }) {
      box(2, 0, 40, 13, C.F3, { hi: C.F2, round: true });
      box(8, 4, 9, 7, '#f0c04a', { hi: '#f8dc80' }); box(27, 4, 9, 7, '#f5b6c8', { hi: '#fbd6e1' });
      box(0, 16, 44, 9, C.F4);
      box(5, 10, 18, 10, C.F2, { hi: C.F1, sh: C.F3 }); box(21, 10, 18, 10, C.F2, { hi: C.F1, sh: C.F3 });
      box(0, 7, 7, 18, C.F3, { hi: C.F2, sh: C.F4, round: true }); box(37, 7, 7, 18, C.F3, { hi: C.F2, sh: C.F4, round: true });
      r(3, 25, 3, 3, O); r(38, 25, 3, 3, O);
    } },
    armchair: { name: '1인 소파', cat: '휴게', w: 24, h: 26, draw({ r, box }) {
      box(2, 0, 20, 12, C.A3, { hi: C.A2, round: true });
      box(0, 15, 24, 8, C.A4);
      box(4, 9, 16, 10, C.A2, { hi: C.A1, sh: C.A3 });
      box(0, 6, 6, 17, C.A3, { hi: C.A2, sh: C.A4, round: true }); box(18, 6, 6, 17, C.A3, { hi: C.A2, sh: C.A4, round: true });
      r(2, 23, 3, 3, O); r(19, 23, 3, 3, O);
    } },
    table_round: { name: '원형 테이블', cat: '휴게', w: 22, h: 24, ol: true, draw({ r, p, blob }) {
      r(10, 12, 2, 8, C.M4); r(6, 20, 10, 2, C.M5); r(7, 20, 8, 1, C.M4);
      blob(11, 8, 10, 6, '#d8ccb5'); blob(11, 7, 10, 6, C.CR); blob(9, 5.5, 5, 2.5, '#ffffff');
      r(13, 6, 3, 3, '#e5534b'); p(13, 6, '#f07a6f'); r(6, 8, 3, 2, '#c98a4f');
    } },
    stool: { name: '스툴', cat: '휴게', w: 14, h: 14, ol: true, draw({ r, blob }) {
      r(3, 7, 1, 6, C.W5); r(10, 7, 1, 6, C.W5); r(6, 8, 2, 5, C.W5); r(3, 10, 8, 1, C.W4);
      blob(7, 5.5, 6, 3.5, C.W4); blob(7, 4.5, 6, 3.5, C.W2); blob(6, 3.5, 3, 1.3, C.W1);
    } },
    rug: { name: '러그', cat: '휴게', w: 64, h: 40, draw({ r, p, box }) {
      box(0, 0, 64, 40, '#b7a6e0', { o: '#8e78bd' }); r(3, 3, 58, 34, '#f3ead8'); r(5, 5, 54, 30, '#a693d8');
      r(5, 11, 54, 1, '#c3b5ee'); r(5, 28, 54, 1, '#c3b5ee');
      for (let y = -6; y <= 6; y++) { const w = 12 - Math.abs(y) * 2; if (w > 0) r(32 - w / 2, 20 + y, w, 1, y === 0 ? '#f8dc80' : '#8e78bd'); }
      for (let y = -3; y <= 3; y++) { const w = 6 - Math.abs(y) * 2; if (w > 0) r(32 - w / 2, 20 + y, w, 1, '#f3ead8'); }
      for (let i = 4; i < 60; i += 3) { p(i, 0, '#f3ead8'); p(i, 39, '#f3ead8'); }
    } },
    lamp: { name: '스탠드 조명', cat: '휴게', w: 12, h: 34, draw({ r, box }) {
      r(5, 9, 2, 21, C.M5); r(5, 9, 1, 21, C.M4);
      box(1, 0, 10, 10, '#f8e3a8', { hi: '#fff6d6', sh: '#e7c473', round: true });
      box(1, 29, 10, 5, C.M4, { hi: C.M3, round: true });
    } },
    vending: { name: '자판기', cat: '휴게', w: 24, h: 36, draw({ r, p, box }) {
      box(0, 0, 24, 36, '#e5534b', { hi: '#f07a6f', sh: '#b83c36', rs: '#c9443e' }); r(1, 1, 22, 3, '#f07a6f');
      box(2, 4, 14, 22, C.BZ);
      const cans = ['#f0c04a', '#5aa9e0', '#5fb34f', '#f5b6c8'];
      for (let row = 0; row < 4; row++) { const y = 6 + row * 5; for (let k = 0; k < 4; k++) { r(4 + k * 3, y, 2, 3, cans[(row + k) % 4]); p(4 + k * 3, y, '#fff'); } r(3, y + 3, 12, 1, C.M4); }
      box(17, 6, 5, 9, C.M2, { hi: C.M1 }); p(18, 8, '#5fb34f'); p(20, 8, '#f0c04a'); p(18, 10, C.M4); p(20, 10, C.M4); p(18, 12, C.M4); p(20, 12, C.M4);
      r(17, 18, 5, 2, '#fff'); box(3, 28, 12, 5, C.BZ); r(4, 29, 10, 1, '#45496a');
    } },
    coffee_counter: { name: '커피 카운터', cat: '팬트리', w: 46, h: 34, draw({ r, p, box }) {
      box(0, 16, 46, 18, C.W3, { hi: C.W2, sh: C.W4 });
      box(2, 19, 14, 13, C.W3, { o: C.W4, hi: C.W2 }); box(16, 19, 14, 13, C.W3, { o: C.W4, hi: C.W2 }); box(30, 19, 14, 13, C.W3, { o: C.W4, hi: C.W2 });
      r(13, 25, 1, 2, C.W5); r(18, 25, 1, 2, C.W5); r(41, 25, 1, 2, C.W5);
      box(0, 12, 46, 6, '#f3efe6', { hi: '#ffffff', sh: '#d8d1c2' });
      box(4, 0, 14, 14, C.M5, { hi: C.M4 }); r(6, 2, 10, 3, C.BZ); p(7, 3, '#5fb34f'); p(9, 3, '#e5534b'); r(9, 7, 4, 2, C.M4); box(9, 9, 4, 4, C.CR);
      box(21, 8, 5, 5, '#e5534b', { hi: '#f07a6f' }); box(27, 8, 5, 5, '#4a8fe0', { hi: '#7fb0ee' });
      box(35, 3, 8, 10, '#e8f4fb', { o: C.M4, hi: '#ffffff' }); p(37, 8, '#a86d3c'); p(39, 10, '#a86d3c'); p(40, 7, '#a86d3c'); r(36, 3, 6, 1, C.W3);
    } },
    fridge: { name: '냉장고', cat: '팬트리', w: 20, h: 36, draw({ r, p, box }) {
      box(0, 0, 20, 36, C.M1, { hi: '#ffffff', sh: C.M2, rs: C.M2 }); r(1, 13, 18, 1, C.M3);
      r(15, 4, 2, 6, C.M4); r(15, 16, 2, 9, C.M4);
      p(4, 5, '#e5534b'); p(6, 7, '#f0c04a'); p(9, 5, '#5aa9e0');
      box(3, 17, 7, 8, '#f8dc80', { o: '#d8b440' }); r(4, 19, 4, 1, '#d8b440'); r(4, 21, 3, 1, '#d8b440');
    } },
    water_cooler: { name: '정수기', cat: '팬트리', w: 14, h: 32, draw({ r, p, box }) {
      box(1, 10, 12, 22, C.M1, { hi: '#ffffff', sh: C.M2 });
      box(3, 0, 8, 11, C.S1, { o: C.S3, hi: '#e6f6ff', round: true }); r(4, 5, 6, 5, '#7fc4ee'); p(5, 6, '#e6f6ff');
      p(4, 14, '#e5534b'); p(9, 14, '#4a8fe0'); r(3, 17, 8, 5, C.M3); r(3, 21, 8, 1, C.M4); r(2, 29, 10, 1, C.M2);
    } },
    locker: { name: '사물함', cat: '팬트리', w: 34, h: 36, draw({ r, box }) {
      box(0, 0, 34, 36, '#8aa1d0', { hi: '#a9bce0', sh: '#6a80b4' });
      for (let i = 0; i < 4; i++) {
        box(1 + i * 8, 2, 8, 33, '#8aa1d0', { o: '#4c5f90', hi: '#a9bce0' });
        for (let v = 0; v < 3; v++) r(3 + i * 8, 5 + v * 2, 4, 1, '#6a80b4');
        r(7 + i * 8, 18, 1, 3, '#4c5f90'); r(3 + i * 8, 26, 4, 2, C.CR);
      }
    } },
    trash: { name: '휴지통', cat: '팬트리', w: 12, h: 14, draw({ r, box }) {
      box(1, 3, 10, 11, C.M3, { hi: C.M2, sh: C.M4 }); r(4, 6, 1, 6, C.M4); r(7, 6, 1, 6, C.M4);
      box(4, 0, 5, 3, C.CR, { o: C.M4 }); box(0, 2, 12, 3, C.M4, { hi: C.M3 });
    } },
    plant_big: { name: '큰 화분', cat: '식물', w: 22, h: 32, ol: true, draw({ r, p, blob }) {
      blob(11, 11, 9, 10, C.L4); blob(3.5, 15, 3, 4, C.L3); blob(18.5, 14, 3, 4, C.L3);
      blob(10.5, 10, 8, 8.5, C.L3); blob(9.5, 8, 6, 6, C.L2); blob(15, 4.5, 3, 3, C.L2); blob(7, 6, 3, 3, C.L1);
      p(6, 4, '#d3f0a8'); p(5, 5, '#d3f0a8'); p(14, 3, C.L1); p(16, 12, C.L2); p(13, 15, C.L2);
      r(6, 21, 10, 10, C.P2); r(5, 20, 12, 3, C.P1); r(5, 22, 12, 1, C.P3); r(14, 23, 2, 8, C.P3); r(6, 30, 10, 1, C.P3); p(6, 20, '#f6b993');
    } },
    plant_small: { name: '작은 화분', cat: '식물', w: 14, h: 18, ol: true, draw({ r, p, blob }) {
      blob(7, 6, 5.5, 5, C.L3); blob(6, 5, 3.5, 3.5, C.L2); p(5, 3, C.L1); p(4, 4, C.L1); p(9, 7, C.L2);
      r(3, 10, 8, 7, '#f3efe6'); r(3, 10, 8, 1, '#ffffff'); r(3, 16, 8, 1, '#d8d1c2'); r(9, 11, 2, 5, '#e2dacb');
    } },
    plant_snake: { name: '산세베리아', cat: '식물', w: 14, h: 30, ol: true, draw({ r, p }) {
      r(2, 7, 2, 13, C.L3); r(5, 1, 3, 19, C.L2); r(9, 4, 2, 16, C.L3); r(11, 10, 1, 10, C.L2);
      r(5, 2, 1, 8, C.L1); p(9, 5, C.L1); p(6, 8, '#d8e98a'); p(6, 13, '#d8e98a'); p(3, 12, '#d8e98a'); p(10, 10, '#d8e98a');
      r(1, 19, 12, 9, '#5b6c8f'); r(1, 19, 12, 2, '#7a8bb3'); r(10, 21, 2, 7, '#46557a'); r(2, 27, 10, 1, '#46557a');
    } },
    door: { name: '문', cat: '구조', w: 26, h: 40, draw({ r, p, box }) {
      box(0, 0, 26, 40, C.W5, { hi: C.W4 });
      box(3, 3, 20, 37, C.W3, { o: C.W5, hi: C.W2 });
      box(7, 6, 12, 10, C.S1, { o: C.W4 }); p(9, 8, '#e6f6ff'); p(10, 9, '#e6f6ff'); p(9, 9, '#e6f6ff');
      box(6, 20, 14, 16, C.W3, { o: C.W4, hi: C.W2 }); r(19, 22, 2, 2, '#f0c04a');
    } },
    window: { name: '창문', cat: '구조', w: 32, h: 26, draw({ r, p, box }) {
      box(0, 0, 32, 24, C.CR, { o: C.M4 });
      r(2, 2, 13, 19, C.S1); r(17, 2, 13, 19, C.S1); r(2, 15, 13, 6, '#c3e7f9'); r(17, 15, 13, 6, '#c3e7f9');
      for (let i = 0; i < 5; i++) { p(4 + i, 9 - i, '#e6f6ff'); p(5 + i, 9 - i, '#e6f6ff'); p(20 + i, 12 - i, '#e6f6ff'); }
      r(2, 2, 28, 1, '#86c4e8');
      box(0, 22, 32, 4, C.M2, { hi: C.M1 });
    } },
    cat: { name: '사무실 고양이', cat: '소품', w: 20, h: 13, ol: true, draw({ grid }) {
      grid([
        '..W....W..........',
        '..Wp..pW..........',
        '.WWWWWWWW.....oo..',
        '.WkWWWWkW......o..',
        '.WWWnnWWWoooooWo..',
        '..WWWWWWooooWWWo..',
        '...WWWWWWWWWWWWo..',
        '...WW.WW...WW.WW..'
      ], { W: '#fffaf2', p: '#f5b8c4', k: O, n: '#f5a3b0', o: '#f0a24a' }, 1, 2);
    } }
  };
  SP.furniture = F;
  SP.drawFurniture = key => { const f = F[key]; const c = mk(f.w, f.h); f.draw(api(c)); if (f.ol) outline(c); return c; };

  const T = {
    wood: { name: '마루 바닥', w: 32, h: 16, draw({ r, p }) {
      r(0, 0, 32, 8, '#e6b479'); r(0, 8, 32, 8, '#e0ac70');
      r(1, 0, 31, 1, '#efc58e'); r(17, 8, 15, 1, '#e9bb80'); r(0, 8, 16, 1, '#e9bb80');
      r(0, 7, 32, 1, '#c98f57'); r(0, 15, 32, 1, '#c98f57'); r(0, 0, 1, 7, '#c98f57'); r(16, 8, 1, 7, '#c98f57');
      p(5, 3, '#d9a266'); r(21, 4, 4, 1, '#d9a266'); r(12, 11, 5, 1, '#d29c62'); p(28, 12, '#d29c62');
    } },
    carpet: { name: '카펫', w: 16, h: 16, draw({ r, p }) {
      r(0, 0, 16, 16, '#dcd7ee'); r(0, 0, 8, 8, '#d3cde8'); r(8, 8, 8, 8, '#d3cde8'); p(3, 3, '#c8c1e0'); p(11, 11, '#c8c1e0'); p(11, 4, '#e4e0f3'); p(4, 12, '#e4e0f3');
    } },
    tile: { name: '타일', w: 16, h: 16, draw({ r }) {
      r(0, 0, 16, 16, '#f4ecdc'); r(8, 0, 8, 8, '#eadcc2'); r(0, 8, 8, 8, '#eadcc2'); r(0, 15, 16, 1, '#dccdb0'); r(15, 0, 1, 16, '#dccdb0'); r(0, 7, 16, 1, '#e3d4b8'); r(7, 0, 1, 16, '#e3d4b8');
    } },
    marble: { name: '대리석 바닥', w: 64, h: 64, draw({ r, p }) {
      r(0, 0, 64, 64, '#d3d1ce'); r(0, 63, 64, 1, '#c5c3c0'); r(63, 0, 1, 64, '#c5c3c0');
      const rnd = seeded(11);
      for (let v = 0; v < 4; v++) { let x = rnd() * 64, y = rnd() * 64; const col = v % 2 ? '#e6e4e1' : '#c9c7c4'; for (let i = 0; i < 46; i++) { p(Math.floor(x) % 63, Math.floor(y + 64) % 63, col); x += 0.6 + rnd() * 1.2; y += rnd() * 2 - 0.7; } }
    } },
    wall: { name: '벽', w: 16, h: 36, draw({ r }) {
      r(0, 0, 16, 4, '#4a4e72'); r(0, 3, 16, 1, '#3a3d5e'); r(0, 4, 16, 26, '#f1e7d6'); r(0, 4, 16, 1, '#fbf5ea'); r(15, 4, 1, 26, '#e7dbc6');
      r(0, 29, 16, 5, '#b8a585'); r(0, 29, 16, 1, '#d4c3a3'); r(0, 33, 16, 1, '#9b8868'); r(0, 34, 16, 2, '#cf9c62');
    } }
  };
  SP.tiles = T;
  SP.drawTile = key => { const t = T[key]; const c = mk(t.w, t.h); t.draw(api(c)); return c; };

  const I = {
    work: { name: '출근', pal: { a: '#3fae6a', b: '#2a8a50', w: '#fff' }, rows: ['...aaaa...', '..a....a..', 'aaaaaaaaaa', 'abbbbbbbba', 'aaaawwaaaa', 'aaaaaaaaaa', 'aaaaaaaaaa', 'aaaaaaaaaa'] },
    away: { name: '자리 비움', pal: { a: '#f0a93b', w: '#fff', k: O }, rows: ['..aaaaaa..', '.awwwwwwa.', 'awwwkwwwwa', 'awwwkwwwwa', 'awwwkkkwwa', 'awwwwwwwwa', '.awwwwwwa.', '..aaaaaa..'] },
    off: { name: '퇴근', pal: { a: '#8d90a6', b: '#c4c6d2', w: '#fff' }, rows: ['....aa....', '...aaaa...', '..aaaaaa..', '.aaaaaaaa.', 'aaaaaaaaaa', '.bbbbbbbb.', '.bbbaabbb.', '.bbbaabbb.'] },
    lunch: { name: '점심', pal: { a: '#9a9cb5' }, rows: ['a.a.a..a.', 'a.a.a.aa.', 'a.a.a.aa.', 'aaaaa.aa.', '.aaa..aa.', '..a....a.', '..a....a.', '..a....a.', '..a....a.'] },
    meeting: { name: '미팅', pal: { a: '#7b6fd6', w: '#fff' }, rows: ['aaaaaa....', 'awwaaa..a.', 'aaaaaa.aa.', 'aaaaaaaaa.', 'aaaaaa.aa.', 'aaaaaa..a.'] },
    outside: { name: '외근', pal: { a: '#4a8fe0', b: '#2f6fb4', w: '#fff' }, rows: ['...bbbb...', '...b..b...', 'aaaaaaaaaa', 'aaaaaaaaaa', 'bbbbwwbbbb', 'aaaaaaaaaa', 'aaaaaaaaaa'] },
    coffee: { name: '커피', pal: { a: '#fffaf2', b: '#9c6136', s: '#c4c6d2' }, rows: ['.s.s.s...', '..s.s....', 'aaaaaaa..', 'abbbbba.a', 'aaaaaaaaa', 'aaaaaaa.a', 'aaaaaaa..', '.aaaaa...'] },
    focus: { name: '집중', pal: { a: '#5fb34f', b: '#2c6a3a' }, rows: ['......aaa.', '....aaaaa.', '...aaabaa.', '..aaabaaa.', '..aabaaa..', '.aabaaa...', '.abaaa....', '.baa......', 'b.........'] },
    mute: { name: '소음 예민', pal: { a: '#e5534b', b: '#e5534b' }, rows: ['....a.....', '...aa.....', 'aaaaa.b..b', 'aaaaa..bb.', 'aaaaa..bb.', 'aaaaa.b..b', '...aa.....', '....a.....'] },
    hot: { name: '더워요', pal: { a: '#f08a3c', w: '#fff' }, rows: ['..ww..', '.wwww.', '.waaw.', '.waaw.', '.waaw.', 'aaaaaa', 'aaaaaa', '.aaaa.'] },
    rest: { name: '휴식', pal: { a: '#f0c04a', b: '#e0a020' }, rows: ['...aaa..', '..aa....', '.aa.....', '.aa.....', '.aaa...b', '..aaaabb', '...aaab.'] },
    help: { name: '도움 요청', pal: { a: '#4a8fe0', w: '#fff' }, rows: ['.aaaaaaa.', 'aaawwwaaa', 'aawaaawaa', 'aaaaawaaa', 'aaaawaaaa', '.aaaaaaa.', '....w....', '...aa....'] },
    phone: { name: '통화', pal: { a: '#4a8fe0' }, rows: ['.aa.......', 'aaaa......', 'aaa.......', '.aa.......', '..aa......', '...aa..aa.', '....aaaaaa', '.....aaaa.'] },
    heart: { name: '하트', pal: { a: '#e5534b', w: '#fbd6e1' }, rows: ['.aa...aa.', 'awaa.aaaa', 'awaaaaaaa', 'aaaaaaaaa', '.aaaaaaa.', '..aaaaa..', '...aaa...', '....a....'] },
    noise: { name: '소음', pal: { a: '#e5534b', b: '#e5534b' }, rows: ['....a.....', '...aa..b..', 'aaaaa...b.', 'aaaaa.b.b.', 'aaaaa.b.b.', 'aaaaa...b.', '...aa..b..', '....a.....'] },
    temp: { name: '온도', pal: { a: '#f08a3c', w: '#fff' }, rows: ['..ww..', '.wwww.', '.waaw.', '.waaw.', '.waaw.', 'aaaaaa', 'aaaaaa', '.aaaa.'] },
    humid: { name: '습도', pal: { a: '#4a8fe0', w: '#d8ecfb' }, rows: ['....a....', '...aaa...', '...aaa...', '..aaaaa..', '.awaaaaa.', '.awaaaaa.', '.aaaaaaa.', '..aaaaa..'] },
    smell: { name: '냄새', pal: { a: '#e0a020' }, rows: ['.a...a...', 'a...a....', 'a...a....', '.a...a...', '..a...a..', '..a...a..', '.a...a...'] },
    discomfort: { name: '불쾌 지수', pal: { a: '#8f7ad8', k: O }, rows: ['..aaaaa..', '.aaaaaaa.', 'aakaaakaa', 'aaaaaaaaa', 'aaakkkaaa', 'aakaaakaa', '.aaaaaaa.', '..aaaaa..'] },
    crowd: { name: '혼잡도', pal: { a: '#4a4e72', b: '#8d90a6' }, rows: ['..aa...bb.', '.aaaa.bbbb', '.aaaa.bbbb', '..aa...bb.', '.aaaa.bbbb', 'aaaaaabbbb', 'aaaaaabbbb'] },
    eye: { name: '시각', pal: { a: '#4a8fe0', w: '#fff', k: O }, rows: ['...aaaa...', '.aawwwwaa.', 'awwwkkwwwa', 'awwkkkkwwa', '.aawkkwaa.', '...aaaa...'] },
    ear: { name: '청각', pal: { a: '#e98a7a', b: '#c0605a' }, rows: ['..aaaa..', '.aaaaaa.', 'aaabbaaa', 'aabaaaaa', 'aaaaabaa', '...abaa.', '...aaa..', '.aaaa...', '..aa....'] },
    nose: { name: '후각', pal: { a: '#5fb34f' }, rows: ['.a...a...', 'a...a....', 'a...a....', '.a...a...', '..a...a..', '..a...a..', '.a...a...'] }
  };
  SP.icons = I;
  SP.drawIcon = key => { const ic = I[key]; const w = Math.max(...ic.rows.map(r => r.length)) + 2, h = ic.rows.length + 2; const c = mk(w, h); api(c).grid(ic.rows, ic.pal, 1, 1); outline(c); return c; };

  const HAIR = {
    bob: { name: '단발', rows: ['', '', '', '.....HHHHHH.....', '...HHHlHHHHHH...', '..HHHllHHHHHHH..', '.HHHHHHHHHHHHHh.', '.HHHHHHHHHHHHHh.', '.HHHH....HHHHHh.', '.HH.........HHh.', '.HH..........Hh.', '.HH..........hh.', '.HH..........hh.', '.Hh..........hh.', '.hh..........hh.', '..h..........h..'] },
    long: { name: '긴 머리', rows: ['', '', '', '.....HHHHHH.....', '...HHHHlHHHHH...', '..HHHHllHHHHHH..', '.HHHHHHHHHHHHHh.', '.HHHHHH.HHHHHHh.', '.HHHH.....HHHHh.', '.HHH.......HHHh.', '.HH..........Hh.', '.HH..........hh.', '.HH..........hh.', '.HH..........hh.', '.HH..........hh.', '.HH..........hh.', '.HHh........hhh.', '.HHh........Hhh.', '.HHH........HHh.', '.HHh........hHh.', '.hHh........hhh.', '..hh........hh..'] },
    bun: { name: '올림 머리', rows: ['......HHHH......', '.....HHlHHH.....', '.....hHHHhh.....', '....hHHHHHHh....', '...HHHHlHHHHH...', '..HHHllHHHHHHH..', '.HHHHHHHHHHHHHh.', '.HHHHHHHHHHHHHh.', '.HHH.HH..HH.HHh.', '.HH..........Hh.', '.Hh..........hh.', '..h..........h..'] },
    twin: { name: '양갈래', rows: ['', '', '', '.....HHHHHH.....', '...HHHlHHHHHH...', '..HHHllHHHHHHH..', '.HHHHHHHHHHHHHh.', '.HHHHHHHHHHHHHh.', '.HHHHHH..HHHHHh.', 'HHH..........HhH', 'HHh..........hhH', 'HH............hH', 'HH............hh', 'Hh............hh', 'Hh............hh', 'Hh............hh', '.h............h.'] },
    short: { name: '짧은 머리', rows: ['', '', '', '', '....HHHHHHHH....', '..HHHHlHHHHHHH..', '.HHHHllHHHHHHHh.', '.HHHHHHHHHHHHHh.', '.HHHHHHHHHHHHHh.', '.HH.HH.HHH.HHHh.', '.Hh..........hh.', '..h..........h..'] },
    part: { name: '가르마', rows: ['', '', '', '', '....HHHHHHHH....', '..HHHHHHHlHHHH..', '.HHHHHHHllHHHHh.', '.HHHHHHHHHHHHHh.', '.HHHHHHHHH.HHHh.', '.HHHHH......HHh.', '.HH..........hh.', '.Hh..........hh.', '..h..........h..'] }
  };
  const HOOD_BASE = ['..CCCCCCCCCCCC..', '.CCCCCCCCCCCCCc.', '.CCCCCCCCCCCCCc.', '.CCC........CCc.', '.CC..........Cc.', '.CC..........cc.', '.CC..........cc.', '.CC..........cc.', '.CC..........cc.', '.Cc..........cc.', '.ccC........Ccc.', '..ccCCCCCCCCcc..'];
  const SPECIAL = {
    bear: { name: '곰돌이', color: '#b8773e', ears: ['', '', '', '..CCC......CCC..', '..CiC......CiC..'] },
    cat: { name: '고양이', color: '#9aa0b8', ears: ['', '', '..C..........C..', '..CC........CC..', '..CiC......CiC..'] },
    frog: { name: '개구리', color: '#7cc56b', ears: ['', '', '', '..www......www..', '..wkw......wkw..'] },
    bunny: { name: '토끼', color: '#f3e3ea', ears: ['....CC....CC....', '....Ci....iC....', '....Ci....iC....', '....Ci....iC....', '...CCC....CCC...'] },
    a_red: { name: '빨강', group: 'suit', suit: true, color: '#e5443f', ears: ['......CCCC......', '......C..C......', '......CCCC......', '.......CC.......', '.......CC.......'] },
    a_yellow: { name: '노랑', group: 'suit', suit: true, color: '#f2c230', ears: ['.......CC.......', '........C.......', '.......C........', '........C.......', '.......CC.......'] },
    a_green: { name: '연두', group: 'suit', suit: true, color: '#8cc63f', ears: ['.......C........', '.......C........', '.......C........', '.......CC.......', '.......CC.......'] },
    a_purple: { name: '보라', group: 'suit', suit: true, color: '#7a52c7', ears: ['.....CCCCC......', '......C.C.......', '.......C........', '.......C........', '.......CC.......'] }
  };
  const OUTFITS = { shirt: '셔츠', hoodie: '후디', suit: '정장', cardigan: '가디건' };
  SP.hair = HAIR; SP.special = SPECIAL; SP.outfits = OUTFITS;
  SP.hairColors = ['#5a3a2a', '#2e2a36', '#8a5a3a', '#e8c27a', '#c0563f', '#a9a6b8', '#f2a6c0', '#6b55c9'];
  SP.eyeColors = ['#3b2a2a', '#2e2433', '#3f6fb4', '#3f8a5a', '#8a5a3a', '#7b55c9'];
  SP.skinTones = ['#ffe2c6', '#ffd4b0', '#eab48a', '#c98a5e'];
  SP.clothPalettes = [
    ['#4a86d8', '#9cc8f0', '#f4f1ea', '#4a4e72'],
    ['#d9484a', '#e98a7a', '#f2c9a8', '#d8b48e'],
    ['#5aa96a', '#8fcf9a', '#c9c6bd', '#3f4258'],
    ['#b8773e', '#c98d4f', '#e0bf8f', '#7a4a35'],
    ['#a58be0', '#6b55c9', '#f0a6c8', '#d6d6dc']
  ];
  SP.pantsColors = ['#4a4e72', '#2e2a36', '#8a7a62', '#6b84b8'];
  SP.defaultChar = { hair: 'bob', hairColor: '#5a3a2a', eye: '#3b2a2a', skin: '#ffd4b0', outfit: 'shirt', top: '#4a86d8', bottom: 'pants', pants: '#4a4e72', special: null };

  const cache = {};
  SP.charCanvas = function (cfg = {}, opt = {}) {
    cfg = Object.assign({}, SP.defaultChar, cfg);
    const W = 18, H = 28, c = mk(W, H), d = api(c);
    const g = {};
    const set = (x, y, col) => { g[x + ',' + y] = col; };
    const sp = cfg.special && SPECIAL[cfg.special];
    const skin = cfg.skin, skinS = dark(skin, 0.14);
    const top = sp ? sp.color : cfg.top, topS = dark(top, 0.2);
    const pants = sp ? dark(sp.color, 0.1) : cfg.pants, pantsS = dark(pants, 0.2);
    const back = !!opt.back;
    for (let y = 17; y <= 21; y++) { set(3, y, top); set(12, y, topS); }
    set(3, 22, skin); set(12, 22, skin);
    for (let y = 17; y <= 22; y++) for (let x = 4; x <= 11; x++) set(x, y, x === 11 || y === 22 ? topS : top);
    for (let y = 18; y <= 21; y++) set(4, y, topS);
    for (let x = 6; x <= 9; x++) set(x, 16, skinS);
    if (!back) {
      if (sp && sp.suit) { for (let x = 6; x <= 9; x++) { set(x, 18, '#8d90a6'); set(x, 21, '#8d90a6'); } for (let x = 6; x <= 9; x++) for (let y = 19; y <= 20; y++) set(x, y, x === 6 ? '#e9e8f0' : '#c9c8d6'); }
      else if (sp) { for (let y = 17; y <= 22; y++) set(7, y, dark(top, 0.35)); for (let x = 6; x <= 9; x++) set(x, 21, light(top, 0.25)); }
      else if (cfg.outfit === 'shirt') { [5, 6, 9, 10].forEach(x => set(x, 17, C.CR)); set(7, 17, skin); set(8, 17, skin); set(7, 19, topS); set(7, 21, topS); }
      else if (cfg.outfit === 'hoodie') { for (let x = 5; x <= 10; x++) set(x, 17, topS); set(6, 18, C.CR); set(6, 19, C.CR); set(9, 18, C.CR); set(9, 19, C.CR); for (let x = 6; x <= 9; x++) set(x, 20, topS); for (let x = 5; x <= 10; x++) set(x, 21, topS); }
      else if (cfg.outfit === 'suit') { for (let y = 17; y <= 20; y++) for (let x = 6; x <= 9; x++) set(x, y, C.CR); for (let y = 17; y <= 21; y++) { set(7, y, '#d9484a'); set(8, y, y === 17 ? '#b83c36' : '#d9484a'); } for (let y = 17; y <= 19; y++) { set(5, y, topS); set(10, y, topS); } }
      else if (cfg.outfit === 'cardigan') { for (let y = 17; y <= 22; y++) for (let x = 6; x <= 9; x++) set(x, y, '#f4f1ea'); for (let y = 17; y <= 22; y++) { set(5, y, topS); set(10, y, topS); } set(5, 19, C.CR); set(5, 21, C.CR); }
    } else {
      for (let x = 5; x <= 10; x++) set(x, 17, topS);
    }
    if (sp || cfg.bottom !== 'skirt') {
      for (let y = 23; y <= 24; y++) for (let x = 5; x <= 10; x++) set(x, y, x === 10 ? pantsS : pants);
      delete g['7,24']; delete g['8,24'];
    } else {
      for (let x = 4; x <= 11; x++) set(x, 23, x >= 10 ? pantsS : pants);
      [5, 6, 9, 10].forEach(x => set(x, 24, skin));
    }
    const shoe = sp ? dark(sp.color, 0.35) : '#3a3448';
    [5, 6, 9, 10].forEach(x => set(x, 25, shoe));
    const hairC = cfg.hairColor, hairS = dark(hairC, 0.22), hairL = mix(hairC, '#fff1dc', 0.38);
    for (let y = 6; y <= 15; y++) for (let x = 2; x <= 13; x++) {
      if (y === 15 && (x === 2 || x === 13)) continue;
      set(x, y, back ? (x === 13 ? hairS : hairC) : (x === 13 && y > 12 ? skinS : skin));
    }
    if (!back) {
      [[4, 10], [10, 10]].forEach(([ex, ey]) => { set(ex, ey, cfg.eye); set(ex + 1, ey, '#ffffff'); set(ex, ey + 1, cfg.eye); set(ex + 1, ey + 1, cfg.eye); });
      if (!opt.mood || opt.mood !== 'tired') { set(3, 12, '#f5a3a3'); set(12, 12, '#f5a3a3'); }
      set(7, 13, '#c9605a'); set(8, 13, '#c9605a');
      if (opt.mood === 'tired') { set(4, 10, skinS); set(5, 10, skinS); set(10, 10, skinS); set(11, 10, skinS); }
    }
    if (sp) {
      const rows = sp.ears.concat(HOOD_BASE);
      const pal = { C: top, c: topS, i: '#f5b8c4', w: '#ffffff', k: O };
      rows.forEach((row, y) => [...row].forEach((ch, x) => { if (pal[ch] && !(back && false)) set(x, y, pal[ch]); }));
      if (back) for (let y = 8; y <= 15; y++) for (let x = 3; x <= 12; x++) set(x, y, top);
    } else {
      const rows = (HAIR[cfg.hair] || HAIR.bob).rows;
      const pal = { H: hairC, h: hairS, l: hairL };
      rows.forEach((row, y) => [...row].forEach((ch, x) => { if (pal[ch]) set(x, y, pal[ch]); }));
    }
    Object.keys(g).forEach(k => { const [x, y] = k.split(',').map(Number); d.p(x + 1, y + 1, g[k]); });
    outline(c);
    return c;
  };
  SP.char = function (cfg, opt = {}) {
    const key = JSON.stringify([cfg, opt]);
    if (!cache[key]) cache[key] = SP.charCanvas(cfg, opt).toDataURL();
    return cache[key];
  };
  SP.ready = true;
})(typeof window !== 'undefined' ? window : globalThis);
