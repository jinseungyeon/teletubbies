// Hand-drawn 16x16 pixel icons in the style of the reference sheets: flat colour
// fills with a highlight/shade, wrapped in a dark 1px outline that is added
// automatically around each silhouette. '.' is transparent.
export const ICON_PALETTE = {
  k: '#3b2f3a', // outline / ink
  w: '#fffdf6', l: '#dedad2', g: '#a9a5a2', d: '#6e6a70',
  y: '#f7cf4f', Y: '#d9a42a', o: '#ef9a45', r: '#e5584f', R: '#b53c3a', m: '#f4a0b5',
  b: '#7ab2ee', B: '#4774c4', c: '#a6dcec', n: '#79c56f', N: '#3f8f50',
  p: '#a98ee0', P: '#7058b3', t: '#efcf9f', T: '#a8744c', s: '#f5cba7',
};
// Thin glyphs drawn directly in ink; an outline would only blur them.
const NO_OUTLINE = new Set(['chevron', 'close', 'more', 'expand', 'plus', 'minus']);
const E = '................';
export const PIXEL_ICONS = {
  home: [E, '.......rr.......', '......rrrr......', '.....rrRRrr.....', '....rrRRRRrr....', '...rrRRRRRRrr...', '..rrrrrrrrrrrr..', '...tttttttttt...', '...tttttttttt...', '...tbbtttTTTt...', '...tbbtttTTTt...', '...ttttttTTTt...', '...ttttttTTTt...', '...ttttttTTTt...', '...ttttttTTTt...', E],
  users: [E, E, E, '...TTTT...TTTT..', '...ssss...ssss..', '...ssss...ssss..', '...ssss...ssss..', '....ss.....ss...', '..pppppp.bbbbbb.', '..pppppp.bbbbbb.', '..pppppp.bbbbbb.', '..pppppp.bbbbbb.', '..PPPPPP.BBBBBB.', E, E, E],
  search: [E, '...gggg.........', '..gwwccg........', '.gwcccccg.......', '.gcccccccg......', '.gcccccccg......', '.gcccccccg......', '..gccccccg......', '...ggggggTT.....', '.........TT.....', '..........TT....', '...........TT...', '............TT..', E, E, E],
  chevron: [E, E, E, E, E, '..kk........kk..', '..kkk......kkk..', '...kkk....kkk...', '....kkk..kkk....', '.....kkkkkk.....', '......kkkk......', '.......kk.......', E, E, E, E],
  close: [E, E, E, '...kk......kk...', '...kkk....kkk...', '....kkk..kkk....', '.....kkkkkk.....', '......kkkk......', '......kkkk......', '.....kkkkkk.....', '....kkk..kkk....', '...kkk....kkk...', '...kk......kk...', E, E, E],
  arrow: [E, E, E, E, '.........w......', '.........ww.....', '.........www....', '..wwwwwwwwwww...', '..wwwwwwwwwww...', '.........www....', '.........ww.....', '.........w......', E, E, E, E],
  back: [E, E, E, E, '......w.........', '.....ww.........', '....www.........', '...wwwwwwwwwww..', '...wwwwwwwwwww..', '....www.........', '.....ww.........', '......w.........', E, E, E, E],
  check: [E, E, E, E, '...........nn...', '..........nnn...', '.........nnn....', '..nn....nnn.....', '..nnn..nnn......', '...nnnnnn.......', '....nnnn........', '.....nn.........', E, E, E, E],
  plus: [E, E, E, '.......kk.......', '.......kk.......', '.......kk.......', '.......kk.......', '...kkkkkkkkkk...', '...kkkkkkkkkk...', '.......kk.......', '.......kk.......', '.......kk.......', '.......kk.......', E, E, E],
  minus: [E, E, E, E, E, E, E, '...kkkkkkkkkk...', '...kkkkkkkkkk...', E, E, E, E, E, E, E],
  pin: [E, '......rrrr......', '.....rrrrrr.....', '....rrrwwrrr....', '....rrwwwwrr....', '....rrwwwwrr....', '....rrrwwrrr....', '.....rrrrrr.....', '.....RrrrrR.....', '......RrrR......', '......RrrR......', '.......RR.......', '.......RR.......', E, E, E],
  map: [E, E, '..tttTTTTtttt...', '..tttTTTTtttt...', '..tnnTTTTtttt...', '..tnnTbbTtrrt...', '..tttTbbTtrrt...', '..tttTTTTtttt...', '..ttnTTTTtttt...', '..tnnTTnTtbbt...', '..tttTTTTtbbt...', '..tttTTTTtttt...', '..tttTTTTtttt...', E, E, E],
  message: [E, E, '...wwwwwwwwww...', '..wwwwwwwwwwww..', '..wwwwwwwwwwww..', '..wwwkwwkwwkww..', '..wwwwwwwwwwww..', '..wwwwwwwwwwww..', '...wwwwwwwwww...', '....www.........', '....ww..........', '....w...........', E, E, E, E],
  card: [E, E, E, '..cccccccccccc..', '..cBBBBBBBBBBc..', '..cccccccccccc..', '..cssccclllllc..', '..cssccclllllc..', '..cTTcccwwwwcc..', '..cTTccclllccc..', '..cccccccccccc..', E, E, E, E, E],
  sound: [E, E, E, '..........b.....', '.......g...b....', '......gg.b..b...', '..gggggg..b.b...', '..ggdggg.b..b...', '..ggdggg.b..b...', '..gggggg..b.b...', '......gg.b..b...', '.......g...b....', '..........b.....', E, E, E],
  leaf: [E, E, '...........nnn..', '.........nnnnn..', '.......nnnnnnn..', '......nnnnnNnn..', '.....nnnnnNnnn..', '....nnnnnNnnnn..', '....nnnnNnnnn...', '....nnnNnnnn....', '....nnNnnnn.....', '....nNnnn.......', '...NN...........', '..N.............', E, E],
  thermometer: [E, '.......ww.......', '......wwww......', '......wwww......', '......wrrw......', '......wrrw......', '......wrrw......', '......wrrw......', '......wrrw......', '.....wrrrrw.....', '....wrrrrrrw....', '....wrrwrrrw....', '....wrrrrrrw....', '.....wrrrrw.....', '......wwww......', E],
  drop: [E, '.......bb.......', '......bbbb......', '......bbbb......', '.....bbbbbb.....', '.....bbbbbb.....', '....bbbbbbbb....', '....bwbbbbbb....', '...bbwbbbbbbb...', '...bbwbbbbbbb...', '...bbbbbbbbBb...', '...bbbbbbbBBb...', '....bbbbbBBb....', '.....bbBBBb.....', '......bbbb......', E],
  eye: [E, E, E, E, '.....wwwwww.....', '...wwwwwwwwww...', '..wwwwBBBBwwww..', '.wwwwBwkkBBwwww.', '.wwwwBBkkBBwwww.', '..wwwwBBBBwwww..', '...wwwwwwwwww...', '.....wwwwww.....', E, E, E, E],
  sun: [E, '.......yy.......', '..y....yy....y..', '...y........y...', '......yyyy......', '.....yyyyyy.....', '....yyyyyyyy....', '.yy.yyyyyyyy.yy.', '.yy.yyyyyyyY.yy.', '....yyyyyyYY....', '.....yyyyYY.....', '......yyYY......', '...y........y...', '..y....yy....y..', '.......yy.......', E],
  edit: [E, '...........mm...', '..........mmmm..', '.........ggmmm..', '........yggmm...', '.......yyygg....', '......yyyYY.....', '.....yyyYY......', '....yyyYY.......', '...yyyYY........', '..tyyYY.........', '..ttYY..........', '..kt............', E, E, E],
  logout: [E, E, '..TTTTTT........', '..TttttT........', '..TttttT...w....', '..TttttT...ww...', '..TttkkT...www..', '..TttttTwwwwwww.', '..TttttT...www..', '..TttttT...ww...', '..TttttT...w....', '..TttttT........', '..TTTTTT........', E, E, E],
  clock: [E, E, '.....wwwwww.....', '...wwwwwwwwww...', '..wwwwwkwwwwww..', '..wwwwwkwwwwww..', '.wwwwwwkwwwwwww.', '.wwwwwwkwwwwwww.', '.wwwwwwkkkkwwww.', '.wwwwwwwwwwwwww.', '.wwwwwwwwwwwwww.', '..wwwwwwwwwwww..', '..llwwwwwwwwll..', '...llllllllll...', '.....llllll.....', E],
  mail: [E, E, E, '..yyyyyyyyyyyy..', '..yYyyyyyyyyYy..', '..yyYyyyyyyYyy..', '..yyyYyyyyYyyy..', '..yyyyYyyYyyyy..', '..yyyyyYYyyyyy..', '..yyyyyyyyyyyy..', '..yyyyyyyyyyyy..', '..YYYYYYYYYYYY..', E, E, E, E],
  lock: [E, E, '.....gggggg.....', '....gg....gg....', '....g......g....', '....g......g....', '...yyyyyyyyyy...', '...yyyyyyyyyy...', '...yyyykkyyyy...', '...yyyykkyyyy...', '...yyyyykyyyy...', '...yyyyyyyyyy...', '...YYYYYYYYYY...', E, E, E],
  refresh: [E, E, '.....nnnnn.n....', '....nn....nnn...', '...nn.....nnnn..', '..nn............', '..nn............', '..nn............', '..nn........nn..', '...nn......nn...', '....nn....nn....', '.....nnnnnn.....', E, E, E, E],
  shuffle: [E, E, E, '...........b....', '.bbb.....bbbbb..', '....b...b..b....', '.....b.b........', '......b.........', '.....b.b........', '....b...b..b....', '.bbb.....bbbbb..', '...........b....', E, E, E, E],
  shirt: [E, E, '....bb....bb....', '..bbbbb..bbbbb..', '.bbbbbbbbbbbbbb.', '.bbbbbbbbbbbbbb.', '..bbbbbbbbbbbb..', '....bbbbbbbb....', '....bbbbbbbb....', '....bbbbbbbb....', '....bbbbbbbb....', '....bbbbbbbb....', '....bbbbbbbb....', '....BBBBBBBB....', E, E],
  star: [E, '.......yy.......', '.......yy.......', '......yyyy......', '......yyyy......', '.yyyyyyyyyyyyyy.', '..yyyyyyyyyyyy..', '....yyyyyyyy....', '.....yyyyyy.....', '.....yyyyyy.....', '....yyyYYyyy....', '....yyY..Yyy....', '...yyY....Yyy...', '...yY......Yy...', E, E],
  hood: [E, E, '.....TTTTTT.....', '...TTTTTTTTTT...', '..TTTTTTTTTTTT..', '..TTTssssssTTT..', '..TTssssssssTT..', '..TTskssssksTT..', '..TTssssssssTT..', '..TTTssssssTTT..', '..TTT......TTT..', '..TT........TT..', E, E, E, E],
  circle: [E, E, '.....mmmmmm.....', '...mmmmmmmmmm...', '..mmwwmmmmmmmm..', '..mwwmmmmmmmmm..', '.mmwmmmmmmmmmmm.', '.mmmmmmmmmmmmmm.', '.mmmmmmmmmmmmmm.', '.mmmmmmmmmmmmmm.', '.mmmmmmmmmmmrrm.', '..mmmmmmmmmrrm..', '..mmmmmmmmrrmm..', '...mmmmmrrrmm...', '.....mmmmmm.....', E],
  camera: [E, E, E, '....ddd.........', '..dddddddddddd..', '..dllllllllllld.', '..ddddcccdddrd..', '..dddccwccdddd..', '..dddcccccdddd..', '..dddcccccdddd..', '..ddddcccddddd..', '..dddddddddddd..', E, E, E, E],
  bell: [E, E, '.......yy.......', '......yyyy......', '.....yyyyyy.....', '.....ywyyyy.....', '.....ywyyyy.....', '....yyyyyyyy....', '....yyyyyyyy....', '...yyyyyyyyyy...', '..yyyyyyyyyyyy..', '..YYYYYYYYYYYY..', '.......YY.......', E, E, E],
  expand: [E, E, '..kkkk....kkkk..', '..k..........k..', '..k..........k..', E, E, E, E, E, E, '..k..........k..', '..k..........k..', '..kkkk....kkkk..', E, E],
  more: [E, E, E, E, E, E, E, '..kk...kk...kk..', '..kk...kk...kk..', E, E, E, E, E, E, E],
  coffee: [E, '......g..g......', '.....g..g.......', '......g..g......', '..wwwwwwwwww....', '..wTTTTTTTTw....', '..wwwwwwwwwwww..', '..wwwwwwwwww.ww.', '..wwwwwwwwww.ww.', '..wwwwwwwwwwww..', '..llwwwwwwwl....', '...llllllll.....', '.gggggggggggg...', E, E, E],
  utensils: [E, E, '...g.g.g....gg..', '...g.g.g...ggg..', '...g.g.g...ggg..', '...ggggg...ggg..', '....ggg....ggg..', '.....g.....ggg..', '.....g......TT..', '.....T......TT..', '.....T......TT..', '.....T......TT..', '.....T......TT..', E, E, E],
  heart: [E, E, E, '...rrr....rrr...', '..rrrrr..rrrrr..', '..rwrrrrrrrrrr..', '..rwrrrrrrrrrr..', '..rrrrrrrrrrrr..', '...rrrrrrrrrr...', '....rrrrrrrRR...', '.....rrrrrRR....', '......rrrR......', '.......rr.......', E, E, E],
  laptop: [E, E, E, '...dddddddddd...', '...dccccccccd...', '...dcwccccccd...', '...dccccccccd...', '...dccccccccd...', '...dddddddddd...', '..gggggggggggg..', '.gglglglglglggg.', '.gggggggggggggg.', E, E, E, E],
  book: [E, E, '...Bbbbbbbbbbb..', '..kBbwwwwwwbbb..', '...Bbllllllbbb..', '..kBbbbbbbbbbb..', '...Bbbbbbbbbbb..', '..kBbbbbbbbbbb..', '...Bbbbbbbbbbb..', '..kBbbbbbbbbbb..', '...Bbbbbbbbbbb..', '..kBbbbbbbbbbb..', '...BBBBBBBBBBB..', E, E, E],
  party: [E, '..........r.....', '......y.....b...', '..b......r......', '........yy..n...', '.......yyy......', '......yyoy......', '.....yyoyy..r...', '....yyoyyy......', '...yyoyyyy......', '..yyoyyyy...b...', '..yoyyyy........', '..oyyy..........', '..yy............', E, E],
  sprout: [E, E, E, '..nn........nn..', '..nnnn....nnnn..', '...nnnnN.nnnn...', '....nnnNNnnn....', '.......NN.......', '.......NN.......', '...TTTTTTTTTT...', '....tttttttt....', '....tttttttt....', '.....tttttt.....', E, E, E],
  dumbbell: [E, E, E, E, E, '..dd........dd..', '.dddd......dddd.', '.ddddggggggdddd.', '.ddddggggggdddd.', '.dddd......dddd.', '..dd........dd..', E, E, E, E, E],
  doc: [E, '...wwwwwwwl.....', '...wwwwwwwll....', '...wwwwwwwlll...', '...wwwwwwwwww...', '...wggggggggw...', '...wwwwwwwwww...', '...wggggggggw...', '...wwwwwwwwww...', '...wggggggwww...', '...wwwwwwwwww...', '...wggggggggw...', '...wwwwwwwwww...', '...llllllllll...', E, E],
  save: [E, E, '..pppppppppppp..', '..ppllllllpppp..', '..pplllgllpppp..', '..ppllllllpppp..', '..pppppppppppp..', '..ppwwwwwwwwpp..', '..ppwwwwwwwwpp..', '..ppwggggggwpp..', '..ppwwwwwwwwpp..', '..ppwwwwwwwwpp..', '..PPPPPPPPPPPP..', E, E, E],
  cat: [E, E, '..o..........o..', '..oo........oo..', '..ooo......ooo..', '..oooooooooooo..', '..oooooooooooo..', '..ookooooookoo..', '..ookooooookoo..', '..ooooommooooo..', '..oowwwwwwwwoo..', '..oowwwwwwwwoo..', '...oooooooooo...', E, E, E],
  video: [E, E, E, E, '..rrrrrrrrr.....', '..rrrrrrrrr...r.', '..rwrrrrrrr..rr.', '..rrrrrrrrr.rrr.', '..rrrrrrrrr.rrr.', '..rrrrrrrrr..rr.', '..rrrrrrrrr...r.', '..RRRRRRRRR.....', E, E, E, E],
  plane: [E, E, E, '............pp..', '.........ppppp..', '.......ppppPpp..', '.....ppppppPpp..', '...pppppppPpp...', '..ppppppppPpp...', '.....PPPPPpp....', '......PPPpp.....', '.......PPp......', '........P.......', E, E, E],
  moon: [E, E, '.....yyyy.......', '...yyyyy........', '..yyyyy.........', '..yyyy..........', '.yyyy...........', '.yyyy...........', '.yyyyy........y.', '..yyyyy......yy.', '..yyyyyyy..yyy..', '...yyyyyyyyyy...', '.....yyyyyy.....', E, E, E],
  pause: [E, E, E, '...ooo....ooo...', '...ooo....ooo...', '...ooo....ooo...', '...ooo....ooo...', '...ooo....ooo...', '...ooo....ooo...', '...ooo....ooo...', '...ooo....ooo...', '...ooo....ooo...', '...ooo....ooo...', E, E, E],
  spark: [E, '.......y........', '.......y........', '......yyy.......', '......yyy.......', '.....yyyyy......', '...yyyyyyyyy....', '.yyyyyyyyyyyyy..', '...yyyyyyyyy....', '.....yyyyy......', '......yyy.......', '......yyy.......', '.......y........', '.......y........', E, E],
};

const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
// Returns the 16x16 grid of palette keys, with the automatic outline applied.
export function iconGrid(name) {
  const rows = PIXEL_ICONS[name] || PIXEL_ICONS.spark;
  const grid = rows.map(r => [...r]);
  if (NO_OUTLINE.has(name)) return grid;
  return grid.map((row, y) => row.map((ch, x) => ch !== '.' ? ch : N4.some(([dx, dy]) => (rows[y + dy]?.[x + dx] ?? '.') !== '.') ? 'k' : '.'));
}
const cache = new Map();
// SVG markup for an icon. Pixels are merged into horizontal runs per colour.
// recolor swaps palette keys (e.g. a shirt in the selected outfit colour).
export function pixelIconSVG(name, px = 16, recolor = null) {
  const key = `${name}:${px}:${recolor ? JSON.stringify(recolor) : ''}`;
  if (cache.has(key)) return cache.get(key);
  // Ink-only glyphs follow the surrounding text colour, so they work on dark buttons too.
  const colors = { ...ICON_PALETTE, ...(NO_OUTLINE.has(name) ? { k: 'currentColor' } : {}), ...recolor };
  const paths = {};
  iconGrid(name).forEach((row, y) => {
    for (let x = 0; x < 16; x++) {
      const ch = row[x];
      if (ch === '.') continue;
      let run = 1;
      while (x + run < 16 && row[x + run] === ch) run++;
      (paths[ch] ||= []).push(`M${x} ${y}h${run}v1h-${run}z`);
      x += run - 1;
    }
  });
  const body = Object.entries(paths).map(([ch, d]) => `<path fill="${colors[ch]}" d="${d.join('')}"/>`).join('');
  const svg = `<svg class="px-icon" width="${px}" height="${px}" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">${body}</svg>`;
  cache.set(key, svg);
  return svg;
}

// Pixel PNG icons from the SENSPACE design file (src/icons/<name>.png), with
// their native pixel size. These take priority over the drawn sprites above.
export const IMAGE_ICONS = {"coffee":[11,10],"focus":[12,11],"mute":[12,10],"discomfort":[11,10],"hot":[8,10],"ear":[10,11],"eye":[12,8],"help":[11,10],"noise":[12,10],"humid":[11,10],"outside":[12,9],"crowd":[12,9],"work":[12,10],"rest":[10,9],"lunch":[11,11],"smell":[11,9],"meeting":[12,8],"away":[12,10],"temp":[8,10],"nose":[11,9],"heart":[11,10],"off":[12,10],"phone":[12,10],"sun":[12,12],"message":[14,12]};
// Markup for any icon. PNGs scale by whole pixels (1x, or 2x from 24px) so
// they stay crisp; drawn sprites render at 16px, or 32px from 24px.
export function iconHTML(name, size = 20) {
  const img = IMAGE_ICONS[name];
  if (!img) return pixelIconSVG(name, size >= 24 ? 32 : 16);
  const k = size >= 24 ? 2 : 1;
  return `<img class="px-icon px-img" src="/icons/${name}.png" width="${img[0] * k}" height="${img[1] * k}" alt="" aria-hidden="true" draggable="false">`;
}
