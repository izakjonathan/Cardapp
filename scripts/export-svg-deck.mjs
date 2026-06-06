import fs from 'fs';
import path from 'path';

const suits = [
  { key: 'S', symbol: '♠', name: 'spades', color: '#151515' },
  { key: 'H', symbol: '♥', name: 'hearts', color: '#c53a2f' },
  { key: 'D', symbol: '♦', name: 'diamonds', color: '#c53a2f' },
  { key: 'C', symbol: '♣', name: 'clubs', color: '#151515' },
];
const ranks = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const outDir = path.join(process.cwd(), 'public', 'svg-deck');

const pipLayouts = {
  A: [[50,70,0.58]],
  '2': [[50,37,0.38],[50,103,0.38]],
  '3': [[50,31,0.34],[50,70,0.38],[50,109,0.34]],
  '4': [[31,38,0.33],[69,38,0.33],[31,102,0.33],[69,102,0.33]],
  '5': [[31,38,0.31],[69,38,0.31],[50,70,0.35],[31,102,0.31],[69,102,0.31]],
  '6': [[31,29,0.30],[69,29,0.30],[31,70,0.30],[69,70,0.30],[31,111,0.30],[69,111,0.30]],
  '7': [[50,22,0.26],[31,38,0.28],[69,38,0.28],[50,70,0.30],[31,102,0.28],[69,102,0.28],[50,118,0.26]],
  '8': [[31,22,0.26],[69,22,0.26],[31,44,0.26],[69,44,0.26],[31,96,0.26],[69,96,0.26],[31,118,0.26],[69,118,0.26]],
  '9': [[50,19,0.23],[31,34,0.25],[69,34,0.25],[31,54,0.25],[69,54,0.25],[50,70,0.28],[31,86,0.25],[69,86,0.25],[50,121,0.23]],
  '10': [[31,19,0.23],[69,19,0.23],[31,37,0.23],[69,37,0.23],[31,56,0.23],[69,56,0.23],[31,84,0.23],[69,84,0.23],[31,103,0.23],[69,103,0.23]],
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
function suitMark(symbol, x, y, scale, fill = true, strokeColor = null){
  const attrs = fill ? `fill="${strokeColor || 'currentColor'}"` : `fill="none" stroke="${strokeColor || 'currentColor'}" stroke-width="4" stroke-linejoin="round"`;
  return `<g transform="translate(${x} ${y}) scale(${scale}) translate(-50 -50)" ${attrs}>${suitPath(symbol)}</g>`;
}
function corner(rank, symbol, color, mirrored=false){
  const tx = mirrored ? ' transform="rotate(180 80 111)"' : '';
  const rankX = mirrored ? 80 : 20;
  const rankY = mirrored ? 111 : 22;
  const suitX = mirrored ? 80 : 20;
  const suitY = mirrored ? 121 : 32;
  return `<g${tx}><text x="${rankX}" y="${rankY}" text-anchor="middle" dominant-baseline="middle" font-size="11" font-weight="800" fill="${color}" font-family="Arial, Helvetica, sans-serif">${rank}</text>${suitMark(symbol, suitX, suitY, 0.14, true, color)}</g>`;
}
function border(color){
  return `
  <rect x="5" y="5" width="90" height="130" rx="12" fill="#fffdfa" stroke="${color}" stroke-width="2.6"/>
  <rect x="10" y="10" width="80" height="120" rx="9" fill="none" stroke="${color}" stroke-opacity="0.17" stroke-width="1.1"/>
  `;
}
function pips(rank, symbol, color){
  return (pipLayouts[rank] || pipLayouts.A)
    .map(([x,y,s]) => suitMark(symbol, x, y, s, true, color))
    .join('');
}
function floral(suit, color, x, y){
  return `<g stroke="${color}" fill="none" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round">
    <path d="M${x} ${y+14} C${x-1} ${y+6} ${x+1} ${y-2} ${x} ${y-10}"/>
    <path d="M${x} ${y+5} c-5 -2 -7 -4 -9 -8"/>
    <path d="M${x} ${y-1} c5 -2 7 -4 9 -8"/>
    <circle cx="${x}" cy="${y-12}" r="2.2"/>
    <path d="M${x-7} ${y-12} a7 7 0 0 1 14 0 a7 7 0 0 1 -14 0z"/>
  </g>`;
}
function queenArt(symbol, color){
  return `
  <g stroke="${color}" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M42 58 C42 45 47 34 56 29 C62 26 67 27 71 31"/>
    <path d="M49 58 C51 47 57 39 63 35 C58 43 57 51 59 58"/>
    <path d="M58 33 C55 35 53 38 52 42 C55 44 59 45 64 45"/>
    <path d="M53 38 C57 37 60 38 62 40"/>
    <path d="M56 48 C59 49 62 49 64 47"/>
    <path d="M47 28 h18 l-2 -5 l-4 2 l-3 -4 l-4 4 l-4 -2 z"/>
    <circle cx="50" cy="24" r="1.4" fill="${color}" stroke="none"/><circle cx="56" cy="21" r="1.4" fill="${color}" stroke="none"/><circle cx="62" cy="24" r="1.4" fill="${color}" stroke="none"/>
    <path d="M44 59 C50 56 56 56 64 59"/>
    <path d="M48 63 C53 60 58 60 62 63"/>
    <path d="M43 64 C49 68 55 71 61 73"/>
    <path d="M40 69 C46 73 53 77 60 80"/>
    <path d="M38 74 C45 79 53 83 61 87"/>
    <path d="M36 79 C44 84 52 88 60 92"/>
    <path d="M31 74 C33 61 34 48 34 34"/>
    ${suitMark(symbol, 31, 28, 0.14, true, color)}
    ${floral(symbol, color, 74, 48)}
  </g>`;
}
function kingArt(symbol, color){
  return `
  <g stroke="${color}" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M44 58 C45 44 49 33 58 29 C64 26 69 27 73 32"/>
    <path d="M52 58 C54 48 59 40 64 36 C60 43 60 50 61 58"/>
    <path d="M58 34 C55 37 53 40 53 44 C56 46 61 47 66 47"/>
    <path d="M45 28 h20 l-2 -5 l-4 2 l-4 -4 l-4 4 l-4 -2 z"/>
    <circle cx="48" cy="24" r="1.4" fill="${color}" stroke="none"/><circle cx="55" cy="21" r="1.4" fill="${color}" stroke="none"/><circle cx="62" cy="24" r="1.4" fill="${color}" stroke="none"/>
    <circle cx="57" cy="40" r="1.1" fill="${color}" stroke="none"/><circle cx="64" cy="40" r="1.1" fill="${color}" stroke="none"/>
    <path d="M55 45 c2 2 4 3 5 3 c2 0 3 -1 5 -3"/>
    <path d="M54 49 c3 2 5 2 7 0"/>
    <path d="M54 53 c2 3 4 4 7 4 c3 0 5 -1 7 -4"/>
    <path d="M44 59 C50 57 56 57 64 60"/>
    <path d="M46 65 C52 67 58 69 65 70"/>
    <path d="M47 71 C53 74 59 76 67 78"/>
    <path d="M31 76 V29"/>
    <path d="M27 76 H35"/>
    <path d="M31 29 l-5 7 l5 -2 l5 2 z"/>
    ${suitMark(symbol, 28, 82, 0.12, true, color)}
    <path d="M79 82 V25"/>
    <path d="M75 29 L79 22 L83 29"/>
    <path d="M75 82 H83"/>
    ${suitMark(symbol, 80, 88, 0.12, true, color)}
  </g>`;
}
function jackArt(symbol, color){
  return `
  <g stroke="${color}" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M43 58 C44 45 49 34 58 29 C63 26 69 28 72 33"/>
    <path d="M51 58 C53 49 58 41 63 37 C60 44 60 51 61 58"/>
    <path d="M46 29 C52 25 58 24 64 28"/>
    <path d="M45 28 l6 -6 l5 4 l4 -5 l4 7"/>
    <path d="M55 39 c2 2 4 3 6 3 c2 0 4 -1 5 -3"/>
    <circle cx="57" cy="40" r="1.1" fill="${color}" stroke="none"/><circle cx="64" cy="40" r="1.1" fill="${color}" stroke="none"/>
    <path d="M56 47 c3 2 5 2 7 0"/>
    <path d="M45 59 C51 57 57 57 65 60"/>
    <path d="M46 65 C53 68 59 70 66 72"/>
    <path d="M47 71 C54 75 60 78 67 81"/>
    <path d="M31 76 V33"/>
    <path d="M27 76 H35"/>
    <path d="M31 33 l-5 6 l5 -2 l5 2 z"/>
    ${suitMark(symbol, 31, 26, 0.12, true, color)}
    <path d="M79 77 C77 63 75 49 74 35"/>
    <path d="M70 49 c3 -4 6 -6 9 -6"/>
    <path d="M70 58 c3 -3 6 -5 10 -5"/>
    ${suitMark(symbol, 80, 84, 0.12, true, color)}
  </g>`;
}
function mirroredCourt(topArt){
  return `<g>${topArt}</g><g transform="rotate(180 50 70)">${topArt}</g>`;
}
function court(rank, symbol, color){
  const art = rank === 'Q' ? queenArt(symbol, color) : rank === 'K' ? kingArt(symbol, color) : jackArt(symbol, color);
  return mirroredCourt(art);
}
function jokerArt(){
  const color = '#151515';
  const red = '#c53a2f';
  const top = `
    <g stroke="${color}" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M40 76 C41 64 44 54 50 48 C56 54 59 64 60 76"/>
      <path d="M38 46 l5 -10 l7 7 l6 -8 l5 11"/>
      <circle cx="38" cy="46" r="1.9" fill="${red}" stroke="none"/>
      <circle cx="50" cy="42" r="1.9" fill="#d4b25f" stroke="none"/>
      <circle cx="62" cy="46" r="1.9" fill="${red}" stroke="none"/>
      <circle cx="46" cy="58" r="1.1" fill="${color}" stroke="none"/><circle cx="54" cy="58" r="1.1" fill="${color}" stroke="none"/>
      <path d="M45 63 c3 3 7 3 10 0"/>
      <path d="M42 68 c5 3 11 3 16 0"/>
      <path d="M41 76 c3 2 6 3 9 3 c3 0 6 -1 9 -3"/>
    </g>`;
  return `${mirroredCourt(top)}<text x="50" y="72" text-anchor="middle" font-size="8.2" font-weight="800" letter-spacing=".22em" fill="#1f2f56" font-family="Arial, Helvetica, sans-serif">JOKER</text>`;
}
function cardSvg(inner, color){
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 140" role="img" aria-hidden="true">
  ${border(color)}
  ${inner}
</svg>`;
}
function naturalCard(rank, suit){
  const color = suit.color;
  const symbol = suit.symbol;
  const inner = `${corner(rank, symbol, color, false)}${corner(rank, symbol, color, true)}${['J','Q','K'].includes(rank) ? court(rank, symbol, color) : pips(rank, symbol, color)}`;
  return cardSvg(inner, color);
}
function jokerCard(idx){
  const inner = `${corner('J', '★', '#151515', false)}${corner('J', '★', '#151515', true)}${jokerArt()}`;
  return cardSvg(inner, idx % 2 === 0 ? '#151515' : '#c53a2f');
}
function backCard(){
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 140" role="img" aria-hidden="true">
  <rect x="5" y="5" width="90" height="130" rx="12" fill="#fffdfa" stroke="#1f2f56" stroke-width="2.6"/>
  <rect x="10" y="10" width="80" height="120" rx="9" fill="#1f2f56" stroke="#d8bc78" stroke-width="1.2"/>
  <rect x="16" y="16" width="68" height="108" rx="7" fill="none" stroke="#fff0c5" stroke-width="1"/>
  <path d="M50 28 L58 45 L77 48 L63 61 L67 80 L50 71 L33 80 L37 61 L23 48 L42 45 Z" fill="#c53a2f"/>
  <path d="M50 34 L56 47 L70 49 L60 58 L63 72 L50 65 L37 72 L40 58 L30 49 L44 47 Z" fill="#fff0c5"/>
  <circle cx="50" cy="70" r="20" fill="none" stroke="#fff0c5" stroke-width="1.2"/>
  <circle cx="50" cy="70" r="11" fill="none" stroke="#fff0c5" stroke-width="1.2"/>
  <path d="M30 70 H70 M50 50 V90" stroke="#fff0c5" stroke-width="1" opacity=".7"/>
</svg>`;
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
const manifest = [];
for (const suit of suits){
  for (const rank of ranks){
    const file = `${rank}${suit.key}.svg`;
    fs.writeFileSync(path.join(outDir, file), naturalCard(rank, suit));
    manifest.push({ file, rank, suit: suit.symbol, suitName: suit.name });
  }
}
for (let i = 1; i <= 4; i++){
  const file = `JOKER${i}.svg`;
  fs.writeFileSync(path.join(outDir, file), jokerCard(i));
  manifest.push({ file, rank: 'JOKER', suit: '🃏', variant: i });
}
fs.writeFileSync(path.join(outDir, 'BACK.svg'), backCard());
manifest.push({ file: 'BACK.svg', rank: 'BACK', suit: '' });

const preview = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 540 300">
  <rect width="540" height="300" fill="#f3efe7"/>
  <image href="QH.svg" x="20" y="20" width="100" height="140"/>
  <image href="KC.svg" x="140" y="20" width="100" height="140"/>
  <image href="JD.svg" x="260" y="20" width="100" height="140"/>
  <image href="AS.svg" x="380" y="20" width="100" height="140"/>
  <image href="10H.svg" x="80" y="150" width="100" height="140"/>
  <image href="JOKER1.svg" x="200" y="150" width="100" height="140"/>
  <image href="BACK.svg" x="320" y="150" width="100" height="140"/>
</svg>`;
fs.writeFileSync(path.join(outDir, 'deck-preview.svg'), preview);
manifest.push({ file: 'deck-preview.svg', rank: 'PREVIEW', suit: '' });

fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`Exported ${manifest.length - 1} deck assets (+ manifest) to ${outDir}`);
