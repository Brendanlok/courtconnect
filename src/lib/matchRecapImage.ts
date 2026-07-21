// Client-side canvas-generated "match recap" share card — no server, no image
// library, just the 2D canvas API drawing a fixed layout. Portrait 4:5, the
// common ratio for a card shared straight into a chat (WhatsApp etc.).

const W = 1080;
const H = 1350;

// Tailwind slate/emerald/amber/red hex values, hardcoded — this canvas has no
// access to the app's Tailwind theme, so it just matches the palette by eye.
const COLOR = {
  bgTop: '#0f172a', bgBottom: '#020817',
  card: '#1e293b', cardBorder: '#334155',
  white: '#f1f5f9', slate400: '#94a3b8', slate500: '#64748b',
  emerald: '#34d399', amber: '#fbbf24', red: '#f87171',
};

export interface RecapData {
  matchTypeLabel: string;
  myName: string; oppName: string;
  myGamesWon: number; oppGamesWon: number;
  isWin: boolean;
  gameScores: { p1: number; p2: number }[]; // already oriented p1 = me
  mmrChange?: number;
  venue?: string;
  dateLabel: string;
}

// Shrinks the font until the text fits maxWidth, down to a floor size —
// good enough for the handful of long-name edge cases without a full
// text-wrapping engine.
function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, startSize: number, weight = 800, floor = 28): number {
  let size = startSize;
  ctx.font = `${weight} ${size}px sans-serif`;
  while (ctx.measureText(text).width > maxWidth && size > floor) {
    size -= 4;
    ctx.font = `${weight} ${size}px sans-serif`;
  }
  return size;
}

export async function generateMatchRecapBlob(data: RecapData): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Background
  const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0, COLOR.bgTop);
  bgGrad.addColorStop(1, COLOR.bgBottom);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // Soft glow blobs, same idea as the home hero card
  const glow = (x: number, y: number, r: number, color: string, alpha: number) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color + Math.round(alpha * 255).toString(16).padStart(2, '0'));
    g.addColorStop(1, color + '00');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  };
  glow(W - 100, 120, 420, '#10b981', 0.18);
  glow(80, H - 150, 380, '#f59e0b', 0.12);

  ctx.textAlign = 'center';

  // Wordmark
  ctx.fillStyle = COLOR.slate400;
  ctx.font = '700 32px sans-serif';
  ctx.fillText('🏸 CourtConnect', W / 2, 100);

  // Match type
  ctx.fillStyle = COLOR.slate500;
  ctx.font = '600 30px sans-serif';
  ctx.fillText(data.matchTypeLabel.toUpperCase(), W / 2, 160);

  // Winner banner
  ctx.font = '800 56px sans-serif';
  ctx.fillStyle = COLOR.amber;
  ctx.fillText('🏆', W / 2, 270);
  const winnerName = data.isWin ? data.myName : data.oppName;
  const winnerSize = fitText(ctx, `${winnerName} wins!`, W - 160, 64);
  ctx.font = `800 ${winnerSize}px sans-serif`;
  ctx.fillStyle = COLOR.emerald;
  ctx.fillText(`${winnerName} wins!`, W / 2, 350);

  // Score card
  const cardX = 90, cardY = 420, cardW = W - 180, cardH = 340, radius = 32;
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, radius);
  ctx.fillStyle = COLOR.card;
  ctx.fill();
  ctx.strokeStyle = COLOR.cardBorder;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Names row
  const nameY = cardY + 70;
  ctx.font = `700 ${fitText(ctx, data.myName, cardW / 2 - 60, 40)}px sans-serif`;
  ctx.fillStyle = data.isWin ? COLOR.emerald : COLOR.white;
  ctx.fillText(data.myName, cardX + cardW * 0.27, nameY);
  ctx.font = `700 ${fitText(ctx, data.oppName, cardW / 2 - 60, 40)}px sans-serif`;
  ctx.fillStyle = !data.isWin ? COLOR.emerald : COLOR.white;
  ctx.fillText(data.oppName, cardX + cardW * 0.73, nameY);
  ctx.font = '700 30px sans-serif';
  ctx.fillStyle = COLOR.slate500;
  ctx.fillText('vs', W / 2, nameY - 10);

  // Big games-won score
  const scoreY = nameY + 100;
  ctx.font = '800 96px sans-serif';
  ctx.fillStyle = data.isWin ? COLOR.emerald : COLOR.slate400;
  ctx.fillText(String(data.myGamesWon), cardX + cardW * 0.27, scoreY);
  ctx.fillStyle = !data.isWin ? COLOR.emerald : COLOR.slate400;
  ctx.fillText(String(data.oppGamesWon), cardX + cardW * 0.73, scoreY);

  // Per-game scores
  ctx.font = '600 26px sans-serif';
  ctx.fillStyle = COLOR.slate400;
  const gameLine = data.gameScores.map(g => `${g.p1}-${g.p2}`).join('   ·   ');
  ctx.fillText(gameLine, W / 2, cardY + cardH - 40);

  // MMR pill (ranked only)
  let y = cardY + cardH + 70;
  if (data.mmrChange !== undefined && data.mmrChange !== 0) {
    const positive = data.mmrChange > 0;
    const label = `${positive ? '+' : ''}${data.mmrChange} MMR`;
    ctx.font = '800 36px sans-serif';
    const pillW = ctx.measureText(label).width + 64;
    const pillX = W / 2 - pillW / 2, pillY = y - 44, pillH = 64;
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, pillH / 2);
    ctx.fillStyle = positive ? '#10b98122' : '#f8717122';
    ctx.fill();
    ctx.strokeStyle = positive ? COLOR.emerald : COLOR.red;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = positive ? COLOR.emerald : COLOR.red;
    ctx.fillText(label, W / 2, y);
    y += 90;
  } else {
    y += 20;
  }

  // Footer: venue + date
  ctx.font = '500 28px sans-serif';
  ctx.fillStyle = COLOR.slate400;
  const footer = [data.venue, data.dateLabel].filter(Boolean).join('  ·  ');
  ctx.fillText(footer, W / 2, y);

  return new Promise(resolve => canvas.toBlob(blob => resolve(blob!), 'image/png'));
}

// Shares the generated image via the Web Share API (opens the native share
// sheet — WhatsApp etc. show up there on mobile) when available and can
// share files; otherwise falls back to a plain download, same pattern
// ClipRecorder uses for its own no-share-API fallback.
export async function shareOrDownloadRecap(blob: Blob, filename: string): Promise<'shared' | 'downloaded'> {
  const file = new File([blob], filename, { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (data: { files: File[] }) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: 'CourtConnect Match Recap' });
      return 'shared';
    } catch {
      // user cancelled the share sheet — not an error, just stop here
      return 'shared';
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return 'downloaded';
}
