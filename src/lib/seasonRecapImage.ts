// Client-side canvas-generated "season recap" share card — same approach as
// matchRecapImage.ts (no server, no image library), reusing its color
// palette and shareOrDownloadRecap for the actual share/download step.

const W = 1080;
const H = 1350;

const COLOR = {
  bgTop: '#0f172a', bgBottom: '#020817',
  card: '#1e293b', cardBorder: '#334155',
  white: '#f1f5f9', slate400: '#94a3b8', slate500: '#64748b',
  emerald: '#34d399', amber: '#fbbf24', red: '#f87171',
};

export interface SeasonRecapData {
  displayName: string;
  seasonNumber: number;
  tierEnd: string;
  mmrEnd: number;
  wins: number;
  losses: number;
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, startSize: number, weight = 800, floor = 28): number {
  let size = startSize;
  ctx.font = `${weight} ${size}px sans-serif`;
  while (ctx.measureText(text).width > maxWidth && size > floor) {
    size -= 4;
    ctx.font = `${weight} ${size}px sans-serif`;
  }
  return size;
}

export async function generateSeasonRecapBlob(data: SeasonRecapData): Promise<Blob> {
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
  glow(80, H - 150, 380, '#f59e0b', 0.12);

  ctx.textAlign = 'center';

  ctx.fillStyle = COLOR.slate400;
  ctx.font = '700 32px sans-serif';
  ctx.fillText('🏸 CourtConnect', W / 2, 100);

  ctx.fillStyle = COLOR.slate500;
  ctx.font = '600 30px sans-serif';
  ctx.fillText(`SEASON ${data.seasonNumber} RECAP`, W / 2, 160);

  ctx.font = '800 56px sans-serif';
  ctx.fillStyle = COLOR.amber;
  ctx.fillText('🏆', W / 2, 270);
  const nameSize = fitText(ctx, data.displayName, W - 160, 64);
  ctx.font = `800 ${nameSize}px sans-serif`;
  ctx.fillStyle = COLOR.white;
  ctx.fillText(data.displayName, W / 2, 350);

  const cardX = 90, cardY = 420, cardW = W - 180, cardH = 340, radius = 32;
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, radius);
  ctx.fillStyle = COLOR.card;
  ctx.fill();
  ctx.strokeStyle = COLOR.cardBorder;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.font = '700 34px sans-serif';
  ctx.fillStyle = COLOR.slate400;
  ctx.fillText('FINISHED', W / 2, cardY + 60);

  ctx.font = '800 88px sans-serif';
  ctx.fillStyle = COLOR.emerald;
  ctx.fillText(data.tierEnd, W / 2, cardY + 150);

  ctx.font = '600 34px sans-serif';
  ctx.fillStyle = COLOR.slate400;
  ctx.fillText(`${data.mmrEnd} MMR`, W / 2, cardY + 205);

  const total = data.wins + data.losses;
  const winRate = total > 0 ? Math.round((data.wins / total) * 100) : 0;
  ctx.font = '700 30px sans-serif';
  ctx.fillStyle = COLOR.white;
  ctx.fillText(
    total > 0 ? `${data.wins}W – ${data.losses}L  ·  ${winRate}% win rate` : 'No ranked matches this season',
    W / 2, cardY + cardH - 45,
  );

  ctx.font = '500 28px sans-serif';
  ctx.fillStyle = COLOR.slate400;
  ctx.fillText('A new season has begun — climb again!', W / 2, cardY + cardH + 80);

  return new Promise(resolve => canvas.toBlob(blob => resolve(blob!), 'image/png'));
}
