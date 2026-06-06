import fs from 'fs';
import path from 'path';

const suits = [
  { key: 'S', symbol: '♠', name: 'spades', color: '#181818' },
  { key: 'H', symbol: '♥', name: 'hearts', color: '#cc2a2a' },
  { key: 'D', symbol: '♦', name: 'diamonds', color: '#cc2a2a' },
  { key: 'C', symbol: '♣', name: 'clubs', color: '#181818' },
];
const ranks = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const pipLayouts = {
  A: [[50,69,.54]],
  '2': [[50,40,.36],[50,98,.36]],
  '3': [[50,34,.34],[50,69,.36],[50,104,.34]],
  '4': [[31,40,.32],[69,40,.32],[31,98,.32],[69,98,.32]],
  '5': [[31,40,.31],[69,40,.31],[50,69,.34],[31,98,.31],[69,98,.31]],
  '6': [[31,34,.3],[69,34,.3],[31,69,.3],[69,69,.3],[31,104,.3],[69,104,.3]],
  '7': [[50,24,.27],[31,38,.28],[69,38,.28],[50,69,.3],[31,98,.28],[69,98,.28],[50,114,.27]],
  '8': [[31,24,.27],[69,24,.27],[31,46,.27],[69,46,.27],[31,92,.27],[69,92,.27],[31,114,.27],[69,114,.27]],
  '9': [[50,22,.24],[31,36,.26],[69,36,.26],[31,58,.26],[69,58,.26],[50,70,.28],[31,102,.26],[69,102,.26],[50,116,.24]],
  '10': [[31,22,.23],[69,22,.23],[31,40,.23],[69,40,.23],[31,58,.23],[69,58,.23],[31,82,.23],[69,82,.23],[31,100,.23],[69,100,.23]],
};

function suitPath(symbol){
  switch(symbol){
    case '♥': return '<path d="M50 84 C22 59 13 43 20 29 C25 18 39 17 50 32 C61 17 75 18 80 29 C87 43 78 59 50 84 Z" />';
    case '♦': return '<path d="M50 10 L82 50 L50 90 L18 50 Z" />';
    case '♣': return '<circle cx="50" cy="27" r="17" /><circle cx="34" cy="49" r="17" /><circle cx="66" cy="49" r="17" /><path d="M46 58 C45 70 37 78 31 85 L69 85 C63 78 55 70 54 58 Z" />';
    case '♠': return '<path d="M50 13 C24 36 15 52 24 66 C31 76 43 72 48 62 C47 74 39 82 33 88 L67 88 C61 82 53 74 52 62 C57 72 69 76 76 66 C85 52 76 36 50 13 Z" />';
    default: return '<path d="M50 13 L60 39 L88 39 L65 56 L74 84 L50 67 L26 84 L35 56 L12 39 L40 39 Z" />';
  }
}
function suitMark(symbol, x, y, scale){
  return `<g transform="translate(${x} ${y}) scale(${scale}) translate(-50 -50)">${suitPath(symbol)}</g>`;
}
function corner(rank, symbol, color, mirrored=false){
  const transform = mirrored ? ' transform="rotate(180 80 111)"' : '';
  const x = mirrored ? 80 : 20;
  const y = mirrored ? 22+89 : 22;
  const sy = mirrored ? 118 : 29;
  return `<g${transform}><text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" font-size="11" font-weight="900" fill="${color}">${rank}</text><g fill="${color}">${suitMark(symbol, mirrored ? 80 : 20, sy, .15)}</g></g>`;
}
function royal(rank, symbol, color){
  const word = rank === 'J' ? 'JACK' : rank === 'Q' ? 'QUEEN' : 'KING';
  return `
    <rect x="24" y="34" width="52" height="72" rx="13" fill="#f7f1e4" stroke="#d8bc78" stroke-width="1" />
    <rect x="28" y="38" width="44" height="64" rx="10" fill="rgba(255,255,255,.55)" stroke="rgba(30,47,88,.12)" stroke-width=".8" />
    <g fill="${color}">${suitMark(symbol, 50, 51, .18)}</g>
    <text x="50" y="78" text-anchor="middle" dominant-baseline="middle" font-size="28" font-weight="900" fill="${color}">${rank}</text>
    <text x="50" y="95" text-anchor="middle" font-size="5.8" font-weight="900" letter-spacing=".18em" fill="#1f2f56">${word}</text>
    <path d="M34 88 H66" fill="none" stroke="rgba(30,47,88,.24)" stroke-width="1" stroke-linecap="round"/>
    <g fill="${color}">${suitMark(symbol, 38, 95, .12)}${suitMark(symbol, 62, 95, .12)}</g>`;
}
function joker(centerText='JOKER', assigned=''){
  return `
    ${corner('JKR','★','#181818',false)}
    ${corner('JKR','★','#181818',true)}
    <g>
      <path d="M26 82 C28 60 34 49 44 41 C44 51 39 60 34 69 C42 67 47 64 52 58 C53 68 50 75 44 82 Z" fill="#cc2a2a" />
      <path d="M74 82 C72 60 66 49 56 41 C56 51 61 60 66 69 C58 67 53 64 48 58 C47 68 50 75 56 82 Z" fill="#181818" />
      <path d="M37 82 C37 69 43 60 50 60 C57 60 63 69 63 82 C63 95 57 104 50 104 C43 104 37 95 37 82 Z" fill="#fff7ea" stroke="#1f2f56" stroke-width="1.1" />
      <circle cx="34" cy="69" r="3.2" fill="#cc2a2a" />
      <circle cx="66" cy="69" r="3.2" fill="#181818" />
      <circle cx="50" cy="44" r="4" fill="#d7b15e" />
      <path d="M38 93 C43 88 47 86 50 86 C53 86 57 88 62 93 C56 97 53 100 50 104 C47 100 44 97 38 93 Z" fill="#d7b15e" stroke="#1f2f56" stroke-width=".9" />
      <circle cx="45" cy="81" r="1.6" fill="#181818" />
      <circle cx="55" cy="81" r="1.6" fill="#181818" />
      <path d="M44 88 C47 91 53 91 56 88" fill="none" stroke="#181818" stroke-width="1.2" stroke-linecap="round" />
    </g>
    <text x="50" y="115" text-anchor="middle" font-size="9" font-weight="900" letter-spacing=".2em" fill="#1f2f56">${centerText}</text>
    ${assigned ? `<text x="50" y="124" text-anchor="middle" font-size="8" font-weight="900" fill="#1f2f56">${assigned}</text>` : ''}`;
}
function body(inner){
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 140" role="img">
  <rect x="5" y="6" width="90" height="128" rx="13" fill="rgba(17,17,17,.12)" />
  <rect x="4" y="4" width="92" height="130" rx="13" fill="#fffdf8" stroke="#1e2f58" stroke-width="2.3" />
  <rect x="7" y="7" width="86" height="124" rx="11" fill="none" stroke="#d5b56b" stroke-width="1.15" />
  <rect x="11" y="11" width="78" height="116" rx="9" fill="none" stroke="rgba(30,47,88,.18)" stroke-width="1.1" />
  ${inner}
</svg>`;
}
function natural(rank, suit){
  const color = suit.color;
  const symbol = suit.symbol;
  const pips = ['J','Q','K'].includes(rank)
    ? royal(rank, symbol, color)
    : (pipLayouts[rank] || pipLayouts.A).map(([x,y,s]) => `<g fill="${color}">${suitMark(symbol, x, y, s)}</g>`).join('');
  const aceRing = rank === 'A' ? `<path d="M29 69 C29 54 39 43 50 43 C61 43 71 54 71 69 C71 84 61 95 50 95 C39 95 29 84 29 69 Z" fill="none" stroke="${color}22" stroke-width="4" />` : '';
  return body(`${corner(rank,symbol,color,false)}${corner(rank,symbol,color,true)}${pips}${aceRing}`);
}
function back(){
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 140" role="img">
  <rect x="5" y="6" width="90" height="128" rx="13" fill="rgba(17,17,17,.12)" />
  <rect x="4" y="4" width="92" height="130" rx="13" fill="#1f2f56" stroke="#d5b56b" stroke-width="2.3" />
  <rect x="9" y="9" width="82" height="120" rx="10" fill="none" stroke="#f7e2a8" stroke-width="1.1" />
  <rect x="14" y="14" width="72" height="110" rx="8" fill="none" stroke="#f7e2a8" stroke-width="0.9" stroke-dasharray="2 3" />
  <circle cx="50" cy="70" r="20" fill="none" stroke="#f7e2a8" stroke-width="1.2" />
  <path d="M50 48 L58 65 L77 67 L63 79 L67 97 L50 88 L33 97 L37 79 L23 67 L42 65 Z" fill="#cc2a2a" />
  <path d="M50 56 L56 68 L70 70 L60 79 L63 92 L50 85 L37 92 L40 79 L30 70 L44 68 Z" fill="#f7e2a8" />
</svg>`;
}

const outDir = path.join(process.cwd(), 'public', 'svg-deck');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
const manifest = [];
for (const suit of suits){
  for (const rank of ranks){
    const file = `${rank}${suit.key}.svg`;
    fs.writeFileSync(path.join(outDir, file), natural(rank, suit));
    manifest.push({ file, rank, suit: suit.symbol, suitName: suit.name });
  }
}
for (let i=1;i<=4;i++){
  const file = `JOKER${i}.svg`;
  fs.writeFileSync(path.join(outDir, file), body(joker('JOKER')));
  manifest.push({ file, rank: 'JOKER', suit: '🃏', variant: i });
}
fs.writeFileSync(path.join(outDir, 'BACK.svg'), back());
manifest.push({ file: 'BACK.svg', rank: 'BACK', suit: '' });
fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`Exported ${manifest.length} SVG assets to ${outDir}`);
