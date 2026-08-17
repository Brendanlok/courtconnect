// Run with: node scripts/gen-og-image.mjs
// Generates the 1200x630 social share banner (og:image / twitter:image),
// replacing the squished 512x512 app icon that was standing in for it.
import sharp from 'sharp';
import { writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'public');
mkdirSync(outDir, { recursive: true });

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#020817"/>
  <circle cx="980" cy="150" r="320" fill="#059669" opacity="0.08"/>
  <circle cx="120" cy="560" r="240" fill="#059669" opacity="0.06"/>

  <!-- Racket + shuttlecock, right side -->
  <g transform="translate(870,80) scale(1.15)">
    <circle cx="150" cy="256" r="200" fill="none" stroke="#059669" stroke-width="8" opacity="0.25"/>
    <rect x="142" y="330" width="16" height="100" rx="8" fill="#059669" opacity="0.9"/>
    <ellipse cx="150" cy="220" rx="90" ry="110" fill="none" stroke="#059669" stroke-width="14" opacity="0.95"/>
    <line x1="64" y1="180" x2="236" y2="180" stroke="#059669" stroke-width="3" opacity="0.5"/>
    <line x1="60" y1="210" x2="240" y2="210" stroke="#059669" stroke-width="3" opacity="0.5"/>
    <line x1="62" y1="240" x2="238" y2="240" stroke="#059669" stroke-width="3" opacity="0.5"/>
    <line x1="66" y1="270" x2="234" y2="270" stroke="#059669" stroke-width="3" opacity="0.5"/>
    <line x1="104" y1="113" x2="104" y2="328" stroke="#059669" stroke-width="3" opacity="0.5"/>
    <line x1="129" y1="110" x2="129" y2="330" stroke="#059669" stroke-width="3" opacity="0.5"/>
    <line x1="150" y1="110" x2="150" y2="330" stroke="#059669" stroke-width="3" opacity="0.5"/>
    <line x1="171" y1="110" x2="171" y2="330" stroke="#059669" stroke-width="3" opacity="0.5"/>
    <line x1="196" y1="113" x2="196" y2="328" stroke="#059669" stroke-width="3" opacity="0.5"/>
    <ellipse cx="150" cy="140" rx="22" ry="20" fill="#f59e0b"/>
    <path d="M150 120 Q124 80 104 55" stroke="#f0fdf4" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M150 120 Q134 75 122 48" stroke="#f0fdf4" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M150 120 Q144 73 142 44" stroke="#f0fdf4" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M150 120 Q150 72 150 42" stroke="#f0fdf4" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M150 120 Q156 73 158 44" stroke="#f0fdf4" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M150 120 Q166 75 178 48" stroke="#f0fdf4" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M150 120 Q176 80 196 55" stroke="#f0fdf4" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M104 55 Q150 28 196 55" stroke="#f0fdf4" stroke-width="2.5" fill="none" opacity="0.7"/>
  </g>

  <!-- Wordmark -->
  <text x="90" y="300" font-family="Arial, Helvetica, sans-serif" font-size="88" font-weight="700" fill="#f0fdf4">Court<tspan fill="#059669">Connect</tspan></text>
  <text x="92" y="360" font-family="Arial, Helvetica, sans-serif" font-size="30" fill="#94a3b8">Track your MMR, find matches, and compete</text>
  <text x="92" y="400" font-family="Arial, Helvetica, sans-serif" font-size="30" fill="#94a3b8">in badminton tournaments — Malaysia</text>

  <rect x="92" y="440" width="180" height="4" rx="2" fill="#059669" opacity="0.6"/>
</svg>`;

await sharp(Buffer.from(svg)).resize(1200, 630).png().toFile(path.join(outDir, 'og-image.png'));
console.log('✓ og-image.png (1200x630)');
