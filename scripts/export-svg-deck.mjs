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
const cardW = 300;
const cardH = 420;
const scaleFactor = 3;

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
function suitMark(symbol, x, y, scale, color){
  return `<g transform="translate(${x} ${y}) scale(${scale}) translate(-50 -50)" fill="${color}">${suitPath(symbol)}</g>`;
}
function outlinedSuitMark(symbol, x, y, scale, color){
  return `<g transform="translate(${x} ${y}) scale(${scale}) translate(-50 -50)" fill="none" stroke="${color}" stroke-width="3.2" stroke-linejoin="round">${suitPath(symbol)}</g>`;
}
function border(color){
  return `
    <rect x="5" y="5" width="90" height="130" rx="12" fill="#fffdfa" stroke="${color}" stroke-width="2.4"/>
    <rect x="9.5" y="9.5" width="81" height="121" rx="9.6" fill="none" stroke="${color}" stroke-opacity="0.22" stroke-width="1.1"/>
    <rect x="12.5" y="12.5" width="75" height="115" rx="8" fill="none" stroke="${color}" stroke-opacity="0.14" stroke-width="0.8"/>
    <path d="M18 18 h10 M18 18 v10 M82 18 h-10 M82 18 v10 M18 122 h10 M18 122 v-10 M82 122 h-10 M82 122 v-10" fill="none" stroke="${color}" stroke-opacity="0.20" stroke-width="0.95" stroke-linecap="round"/>
  `;
}
function corner(rank, symbol, color, mirrored=false){
  const tx = mirrored ? ' transform="rotate(180 80 111)"' : '';
  const rankX = mirrored ? 80 : 20;
  const rankY = mirrored ? 111 : 22;
  const suitX = mirrored ? 80 : 20;
  const suitY = mirrored ? 121 : 33;
  return `<g${tx}><text x="${rankX}" y="${rankY}" text-anchor="middle" dominant-baseline="middle" font-size="11" font-weight="800" letter-spacing="-0.02em" fill="${color}" font-family="Arial, Helvetica, sans-serif">${rank}</text>${suitMark(symbol, suitX, suitY, 0.14, color)}</g>`;
}
function pipField(rank, symbol, color){
  const watermark = rank === 'A'
    ? `<g opacity="0.07">${outlinedSuitMark(symbol, 50, 70, 0.48, color)}</g>`
    : `<g opacity="0.045">${outlinedSuitMark(symbol, 50, 70, 0.58, color)}</g>`;
  const pips = (pipLayouts[rank] || pipLayouts.A)
    .map(([x,y,s]) => suitMark(symbol, x, y, s, color))
    .join('');
  return `${watermark}${pips}`;
}
function floral(color, x, y){
  return `<g stroke="${color}" fill="none" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M${x} ${y+14} C${x-1} ${y+6} ${x+1} ${y-2} ${x} ${y-10}"/>
    <path d="M${x} ${y+5} c-5 -2 -7 -4 -9 -8"/>
    <path d="M${x} ${y-1} c5 -2 7 -4 9 -8"/>
    <circle cx="${x}" cy="${y-12}" r="2.1"/>
    <path d="M${x-7} ${y-12} a7 7 0 0 1 14 0 a7 7 0 0 1 -14 0z"/>
  </g>`;
}
function queenArt(symbol, color){
  return `
    <g stroke="${color}" fill="none" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round">
      <path d="M39 88 C40 71 42 56 46 42 C50 31 57 26 66 28"/>
      <path d="M45 37 C51 41 57 44 62 48 C67 52 70 57 72 63"/>
      <path d="M56 31 C53 36 52 42 53 48 C56 50 60 52 65 53"/>
      <path d="M48 66 C54 62 60 62 66 66"/>
      <path d="M50 73 C55 71 60 71 64 73"/>
      <path d="M42 80 C48 85 55 89 62 92"/>
      <path d="M41 47 C45 52 49 56 52 61"/>
      <path d="M43 55 C47 60 50 65 53 70"/>
      <path d="M45 63 C49 68 52 73 55 78"/>
      <path d="M47 71 C51 76 54 81 58 85"/>
      <path d="M46 27 h18 l-2 -6 l-4 3 l-5 -4 l-3 4 l-4 -3 z"/>
      <circle cx="49" cy="22" r="1.5" fill="${color}" stroke="none"/>
      <circle cx="56" cy="18" r="1.5" fill="${color}" stroke="none"/>
      <circle cx="63" cy="22" r="1.5" fill="${color}" stroke="none"/>
      <path d="M28 82 C29 68 30 54 30 40"/>
      ${suitMark(symbol, 28, 34, 0.12, color)}
      <path d="M75 86 C74 74 74 61 75 49"/>
      ${floral(color, 75, 58)}
      <path d="M33 86 C38 85 42 86 46 89"/>
      <path d="M60 92 C64 88 69 86 75 86"/>
    </g>`;
}

function kingArt(symbol, color){
  return `
    <g stroke="${color}" fill="none" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round">
      <path d="M40 87 C42 70 44 56 48 42 C52 31 59 26 68 29"/>
      <path d="M52 43 C56 41 60 41 64 43"/>
      <circle cx="55" cy="40" r="1.1" fill="${color}" stroke="none"/><circle cx="62" cy="40" r="1.1" fill="${color}" stroke="none"/>
      <path d="M54 48 c3 3 6 3 9 0"/>
      <path d="M51 52 c3 3 5 4 8 4 c3 0 5 -1 8 -4"/>
      <path d="M48 57 c5 6 11 9 18 10"/>
      <path d="M47 64 c5 5 11 9 18 11"/>
      <path d="M45 72 c6 5 12 9 19 12"/>
      <path d="M43 80 c7 5 13 9 20 13"/>
      <path d="M46 27 h21 l-2 -6 l-4 3 l-4 -4 l-4 4 l-4 -3 z"/>
      <circle cx="49" cy="22" r="1.5" fill="${color}" stroke="none"/>
      <circle cx="56" cy="18" r="1.5" fill="${color}" stroke="none"/>
      <circle cx="64" cy="22" r="1.5" fill="${color}" stroke="none"/>
      <path d="M28 85 V40"/>
      <path d="M24 85 H32"/>
      <path d="M28 40 l-5 7 l5 -2 l5 2 z"/>
      ${suitMark(symbol, 28, 92, 0.12, color)}
      <path d="M78 89 V30"/>
      <path d="M74 34 L78 26 L82 34"/>
      <path d="M74 89 H82"/>
      <path d="M78 30 V89"/>
      ${suitMark(symbol, 78, 97, 0.12, color)}
      <path d="M36 84 C41 83 46 85 50 88"/>
      <path d="M61 92 C66 88 72 86 77 86"/>
    </g>`;
}

function jackArt(symbol, color){
  return `
    <g stroke="${color}" fill="none" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round">
      <path d="M40 87 C41 72 44 58 48 44 C52 32 59 27 67 30"/>
      <path d="M52 42 C56 40 60 40 64 42"/>
      <circle cx="55" cy="39" r="1.1" fill="${color}" stroke="none"/><circle cx="62" cy="39" r="1.1" fill="${color}" stroke="none"/>
      <path d="M55 47 c3 2 5 2 7 0"/>
      <path d="M48 57 C54 55 60 55 66 58"/>
      <path d="M46 63 C52 66 58 69 65 71"/>
      <path d="M45 70 C51 74 58 77 65 81"/>
      <path d="M44 78 C51 82 58 86 66 90"/>
      <path d="M45 30 c6 -5 12 -6 18 -2"/>
      <path d="M44 28 l6 -8 l6 6 l5 -7 l5 10"/>
      <path d="M29 84 V43"/>
      <path d="M25 84 H33"/>
      <path d="M29 43 l-5 6 l5 -2 l5 2 z"/>
      ${suitMark(symbol, 29, 36, 0.12, color)}
      <path d="M76 81 C73 68 71 55 70 42"/>
      <path d="M67 55 c3 -4 6 -6 10 -7"/>
      <path d="M67 64 c4 -4 7 -6 11 -7"/>
      ${suitMark(symbol, 78, 88, 0.12, color)}
      <path d="M36 84 C41 83 46 85 50 88"/>
      <path d="M60 90 C65 86 70 84 76 84"/>
    </g>`;
}

function mirroredCourt(topArt){
  return `<g>${topArt}</g><g transform="rotate(180 50 70)">${topArt}</g>`;
}
function court(rank, symbol, color){
  const art = rank === 'Q' ? queenArt(symbol, color) : rank === 'K' ? kingArt(symbol, color) : jackArt(symbol, color);
  const centerFrame = `<rect x="28" y="18" width="44" height="104" rx="8" fill="none" stroke="${color}" stroke-opacity="0.10" stroke-width="0.8"/>`;
  return `${centerFrame}${mirroredCourt(art)}`;
}
function jokerArt(){
  const black = '#151515';
  const red = '#c53a2f';
  const gold = '#d4b25f';
  const top = `
    <g stroke="${black}" fill="none" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round">
      <path d="M40 76 C41 64 44 54 50 48 C56 54 59 64 60 76"/>
      <path d="M38 46 l5 -10 l7 7 l6 -8 l5 11"/>
      <circle cx="38" cy="46" r="1.9" fill="${red}" stroke="none"/>
      <circle cx="50" cy="42" r="1.9" fill="${gold}" stroke="none"/>
      <circle cx="62" cy="46" r="1.9" fill="${red}" stroke="none"/>
      <circle cx="46" cy="58" r="1.1" fill="${black}" stroke="none"/><circle cx="54" cy="58" r="1.1" fill="${black}" stroke="none"/>
      <path d="M45 63 c3 3 7 3 10 0"/>
      <path d="M42 68 c5 3 11 3 16 0"/>
      <path d="M41 76 c3 2 6 3 9 3 c3 0 6 -1 9 -3"/>
      <path d="M45 84 C47 79 49 76 50 76 C51 76 53 79 55 84"/>
    </g>`;
  return `${mirroredCourt(top)}<text x="50" y="72" text-anchor="middle" font-size="8.2" font-weight="800" letter-spacing=".22em" fill="#1f2f56" font-family="Arial, Helvetica, sans-serif">JOKER</text>`;
}
function largeSvg(inner, aria = ''){
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${cardW}" height="${cardH}" viewBox="0 0 ${cardW} ${cardH}" role="img"${aria ? ` aria-label="${aria}"` : ''}>
  <rect width="${cardW}" height="${cardH}" fill="none"/>
  <g transform="scale(${scaleFactor})">
    ${inner}
  </g>
</svg>`;
}
function naturalCard(rank, suit){
  const color = suit.color;
  const symbol = suit.symbol;
  const inner = `${border(color)}${corner(rank, symbol, color, false)}${corner(rank, symbol, color, true)}${['J','Q','K'].includes(rank) ? court(rank, symbol, color) : pipField(rank, symbol, color)}`;
  return largeSvg(inner, `${rank} of ${suit.name}`);
}
function jokerCard(index){
  const borderColor = index % 2 === 0 ? '#151515' : '#c53a2f';
  const inner = `${border(borderColor)}${corner('J', '★', '#151515', false)}${corner('J', '★', '#151515', true)}${jokerArt()}`;
  return largeSvg(inner, `Joker ${index}`);
}
function backCard(){
  const inner = `
    <rect x="5" y="5" width="90" height="130" rx="12" fill="#fffdfa" stroke="#1f2f56" stroke-width="2.4"/>
    <rect x="10" y="10" width="80" height="120" rx="9" fill="#1f2f56" stroke="#d8bc78" stroke-width="1.1"/>
    <rect x="14" y="14" width="72" height="112" rx="7" fill="none" stroke="#fff0c5" stroke-width="1"/>
    <path d="M50 28 L58 45 L77 48 L63 61 L67 80 L50 71 L33 80 L37 61 L23 48 L42 45 Z" fill="#c53a2f"/>
    <path d="M50 34 L56 47 L70 49 L60 58 L63 72 L50 65 L37 72 L40 58 L30 49 L44 47 Z" fill="#fff0c5"/>
    <circle cx="50" cy="70" r="20" fill="none" stroke="#fff0c5" stroke-width="1.2"/>
    <circle cx="50" cy="70" r="11" fill="none" stroke="#fff0c5" stroke-width="1.2"/>
    <path d="M30 70 H70 M50 50 V90" stroke="#fff0c5" stroke-width="1" opacity=".7"/>
    <path d="M20 20 L80 120 M80 20 L20 120" stroke="#fff0c5" stroke-opacity=".2" stroke-width="0.8"/>
  `;
  return largeSvg(inner, 'Card back');
}
function deckPreview(files){
  const cols = 8;
  const rows = Math.ceil(files.length / cols);
  const cellW = 120;
  const cellH = 168;
  const gap = 12;
  const width = cols * cellW + (cols + 1) * gap;
  const height = rows * cellH + (rows + 1) * gap;
  const items = files.map((file, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const x = gap + col * cellW;
    const y = gap + row * cellH;
    return `<image href="${file}" x="${x}" y="${y}" width="${cellW}" height="${cellH}" />`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#f2ece0"/>
  ${items}
</svg>`;
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
const manifest = [];
const previewFiles = [];
for (const suit of suits){
  for (const rank of ranks){
    const file = `${rank}${suit.key}.svg`;
    fs.writeFileSync(path.join(outDir, file), naturalCard(rank, suit));
    manifest.push({ file, rank, suit: suit.symbol, suitName: suit.name, width: cardW, height: cardH });
    previewFiles.push(file);
  }
}
for (let i = 1; i <= 4; i++){
  const file = `JOKER${i}.svg`;
  fs.writeFileSync(path.join(outDir, file), jokerCard(i));
  manifest.push({ file, rank: 'JOKER', suit: '🃏', variant: i, width: cardW, height: cardH });
  previewFiles.push(file);
}
fs.writeFileSync(path.join(outDir, 'BACK.svg'), backCard());
manifest.push({ file: 'BACK.svg', rank: 'BACK', suit: '', width: cardW, height: cardH });
previewFiles.push('BACK.svg');
fs.writeFileSync(path.join(outDir, 'deck-preview.svg'), deckPreview(previewFiles));
manifest.push({ file: 'deck-preview.svg', rank: 'PREVIEW', suit: '', width: null, height: null });
fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`Exported ${previewFiles.length} SVG deck assets + manifest to ${outDir}`);
