import type { Match } from '@/types';
import { MATCH_TYPE_LABEL, formatDate } from '@/lib/utils';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Opens a print-formatted window and triggers the browser's print dialog —
// "Save as PDF" is a native option there on every desktop and mobile browser,
// so no PDF library is needed for a static-export app with no server.
export function exportMatchHistoryPdf(playerName: string, matches: Match[], userId: string) {
  const win = window.open('', '_blank');
  if (!win) return; // popup blocked

  const rows = [...matches]
    .sort((a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime())
    .map(m => {
      const isP1 = m.player1Id === userId;
      const opponent = isP1 ? m.player2Name : m.player1Name;
      const scoreStr = m.games
        .filter(g => g.p1 > 0 || g.p2 > 0)
        .map(g => isP1 ? `${g.p1}-${g.p2}` : `${g.p2}-${g.p1}`)
        .join(', ') || '—';
      const result = m.status !== 'Confirmed' ? m.status : (m.winnerId === userId ? 'Win' : 'Loss');
      const mmr = m.status === 'Confirmed' && m.mmrChange !== undefined
        ? (m.mmrChange > 0 ? `+${m.mmrChange}` : `${m.mmrChange}`) : '';
      return `<tr>
        <td>${esc(formatDate(m.playedAt))}</td>
        <td>${esc(MATCH_TYPE_LABEL[m.type])}</td>
        <td>${esc(opponent)}</td>
        <td>${esc(scoreStr)}</td>
        <td>${esc(result)}</td>
        <td>${esc(mmr)}</td>
      </tr>`;
    })
    .join('');

  win.document.write(`<!DOCTYPE html>
<html><head><title>${esc(playerName)} — Match History</title>
<meta charset="utf-8">
<style>
  body { font-family: -apple-system, Segoe UI, Arial, sans-serif; color: #0f172a; padding: 32px; }
  h1 { font-size: 20px; margin-bottom: 2px; }
  p.sub { color: #64748b; font-size: 13px; margin-top: 0; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #e2e8f0; }
  th { color: #64748b; font-weight: 600; text-transform: uppercase; font-size: 11px; }
  tr:nth-child(even) { background: #f8fafc; }
  @media print { body { padding: 0; } }
</style></head>
<body>
  <h1>${esc(playerName)} — Match History</h1>
  <p class="sub">${matches.length} match${matches.length === 1 ? '' : 'es'} · Generated ${esc(formatDate(new Date().toISOString()))}</p>
  <table>
    <thead><tr><th>Date</th><th>Format</th><th>Opponent</th><th>Score</th><th>Result</th><th>MMR</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body></html>`);
  win.document.close();
  setTimeout(() => win.print(), 150);
}
