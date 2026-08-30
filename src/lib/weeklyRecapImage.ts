// Client-side canvas-generated "weekly recap" share card — same approach as
// matchRecapImage.ts / seasonRecapImage.ts (no server, no image library),
// reusing their palette and shareOrDownloadRecap for the share/download step.

const W = 1080;
const H = 1350;

const COLOR = {
  bgTop: '#0f172a', bgBottom: '#020817',
  card: '#1e293b', cardBorder: '#334155',
  white: '#f1f5f9', slate400: '#94a3b8', slate500: '#64748b',
  emerald: '#34d399', amber: '#fbbf24', red: '#f87171', violet: '#a78bfa',
};

export interface WeeklyRecapData {
  displayName: string;
  weekLabel: string;          // e.g. "25 Aug – 31 Aug"
  mmrDelta: number;
  matchesPlayed: number;
  winsCount: number;
  bestWinOpponent: string | null;
  bestWinMmr?: number;
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, startSize: number, weight = 800, floor = 24): number {
  let size = startSize;
  ctx.font = `${weight} ${size}px sans-serif`;
  while (ctx.measureText(text).width > maxWidth && size > floor) {
    size -= 4;
    ctx.font = `${weight} ${size}px sans-serif`;
  }
  return size;
}

export async function generateWeeklyRecapBlob(data: WeeklyRecapData): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0, COLOR.bgTop);
  bgGrad.addColorStop(1, COLOR.bgBottom);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  const glow = (x: number, y: number, r: number, color: string, alpha: number) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color + Math.round(alpha * 255).toString(16).padStart(2, '0'));
    g.addColorStop(1, color + '00');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  };
  glow(W - 100, 120, 420, '#8b5cf6', 0.18);
  glow(80, H - 150, 380, '#10b981', 0.12);

  ctx.textAlign = 'center';

  ctx.fillStyle = COLOR.slate400;
  ctx.font = '700 32px sans-serif';
  ctx.fillText('🏸 CourtConnect', W / 2, 100);

  ctx.fillStyle = COLOR.violet;
  ctx.font = '600 30px sans-serif';
  ctx.fillText('MY BADMINTON WEEK', W / 2, 160);

  const nameSize = fitText(ctx, data.displayName, W - 160, 64);
  ctx.font = `800 ${nameSize}px sans-serif`;
  ctx.fillStyle = COLOR.white;
  ctx.fillText(data.displayName, W / 2, 250);

  ctx.font = '500 28px sans-serif';
  ctx.fillStyle = COLOR.slate500;
  ctx.fillText(data.weekLabel, W / 2, 300);

  // Stat card with 3 columns
  const cardX = 90, cardY = 380, cardW = W - 180, cardH = 320, radius = 32;
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, radius);
  ctx.fillStyle = COLOR.card;
  ctx.fill();
  ctx.strokeStyle = COLOR.cardBorder;
  ctx.lineWidth = 2;
  ctx.stroke();

  const cols: { value: string; label: string; color: string }[] = [
    {
      value: `${data.mmrDelta > 0 ? '+' : ''}${data.mmrDelta}`,
      label: 'MMR',
      color: data.mmrDelta > 0 ? COLOR.emerald : data.mmrDelta < 0 ? COLOR.red : COLOR.white,
    },
    { value: String(data.matchesPlayed), label: 'Matches', color: COLOR.white },
    { value: String(data.winsCount), label: 'Wins', color: COLOR.emerald },
  ];
  cols.forEach((c, i) => {
    const cx = cardX + cardW * ((i + 0.5) / 3);
    ctx.font = '800 84px sans-serif';
    ctx.fillStyle = c.color;
    ctx.fillText(c.value, cx, cardY + 150);
    ctx.font = '600 28px sans-serif';
    ctx.fillStyle = COLOR.slate500;
    ctx.fillText(c.label, cx, cardY + 210);
    if (i > 0) {
      ctx.strokeStyle = COLOR.cardBorder;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cardX + cardW * (i / 3), cardY + 70);
      ctx.lineTo(cardX + cardW * (i / 3), cardY + cardH - 70);
      ctx.stroke();
    }
  });

  // Best win line
  let y = cardY + cardH + 90;
  if (data.bestWinOpponent) {
    const line = `🏆 Best win: beat ${data.bestWinOpponent}` +
      (data.bestWinMmr ? ` (+${data.bestWinMmr})` : '');
    ctx.font = `600 ${fitText(ctx, line, W - 140, 34, 600, 22)}px sans-serif`;
    ctx.fillStyle = COLOR.slate400;
    ctx.fillText(line, W / 2, y);
    y += 70;
  }

  ctx.font = '500 26px sans-serif';
  ctx.fillStyle = COLOR.slate500;
  ctx.fillText('Track your matches at courtconnect', W / 2, H - 90);

  return new Promise(resolve => canvas.toBlob(blob => resolve(blob!), 'image/png'));
}
