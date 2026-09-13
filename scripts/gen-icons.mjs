// Run with: node scripts/gen-icons.mjs
import sharp from 'sharp';
import { writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'public', 'icons');
mkdirSync(outDir, { recursive: true });

// SVG icon: dark slate bg + emerald CC monogram + subtle shuttlecock
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <!-- Background -->
  <rect width="512" height="512" rx="112" fill="#020817"/>

  <!-- Outer ring glow -->
  <circle cx="256" cy="256" r="200" fill="none" stroke="#059669" stroke-width="8" opacity="0.3"/>

  <!-- Racket handle -->
  <rect x="248" y="330" width="16" height="100" rx="8" fill="#059669" opacity="0.9"/>

  <!-- Racket frame (oval) -->
  <ellipse cx="256" cy="220" rx="90" ry="110" fill="none" stroke="#059669" stroke-width="14" opacity="0.95"/>

  <!-- String lines horizontal -->
  <line x1="170" y1="180" x2="342" y2="180" stroke="#059669" stroke-width="3" opacity="0.5"/>
  <line x1="166" y1="210" x2="346" y2="210" stroke="#059669" stroke-width="3" opacity="0.5"/>
  <line x1="168" y1="240" x2="344" y2="240" stroke="#059669" stroke-width="3" opacity="0.5"/>
  <line x1="172" y1="270" x2="340" y2="270" stroke="#059669" stroke-width="3" opacity="0.5"/>

  <!-- String lines vertical -->
  <line x1="210" y1="113" x2="210" y2="328" stroke="#059669" stroke-width="3" opacity="0.5"/>
  <line x1="235" y1="110" x2="235" y2="330" stroke="#059669" stroke-width="3" opacity="0.5"/>
  <line x1="256" y1="110" x2="256" y2="330" stroke="#059669" stroke-width="3" opacity="0.5"/>
  <line x1="277" y1="110" x2="277" y2="330" stroke="#059669" stroke-width="3" opacity="0.5"/>
  <line x1="302" y1="113" x2="302" y2="328" stroke="#059669" stroke-width="3" opacity="0.5"/>

  <!-- Shuttlecock cork -->
  <ellipse cx="256" cy="140" rx="22" ry="20" fill="#f59e0b"/>

  <!-- Shuttlecock feathers -->
  <path d="M256 120 Q230 80 210 55" stroke="#f0fdf4" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M256 120 Q240 75 228 48" stroke="#f0fdf4" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M256 120 Q250 73 248 44" stroke="#f0fdf4" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M256 120 Q256 72 256 42" stroke="#f0fdf4" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M256 120 Q262 73 264 44" stroke="#f0fdf4" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M256 120 Q272 75 284 48" stroke="#f0fdf4" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M256 120 Q282 80 302 55" stroke="#f0fdf4" stroke-width="3" fill="none" stroke-linecap="round"/>

  <!-- Feather tips connector arc -->
  <path d="M210 55 Q256 28 302 55" stroke="#f0fdf4" stroke-width="2.5" fill="none" opacity="0.7"/>
</svg>`;

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

for (const size of sizes) {
  const outPath = path.join(outDir, `icon-${size}x${size}.png`);
  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toFile(outPath);
  console.log(`✓ icon-${size}x${size}.png`);
}

// Maskable icon (icon with safe-zone padding, solid bg, no rounded corners)
const maskableSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#020817"/>
  <rect x="248" y="330" width="16" height="100" rx="8" fill="#059669" opacity="0.9"/>
  <ellipse cx="256" cy="220" rx="90" ry="110" fill="none" stroke="#059669" stroke-width="14" opacity="0.95"/>
  <line x1="170" y1="180" x2="342" y2="180" stroke="#059669" stroke-width="3" opacity="0.5"/>
  <line x1="166" y1="210" x2="346" y2="210" stroke="#059669" stroke-width="3" opacity="0.5"/>
  <line x1="168" y1="240" x2="344" y2="240" stroke="#059669" stroke-width="3" opacity="0.5"/>
  <line x1="172" y1="270" x2="340" y2="270" stroke="#059669" stroke-width="3" opacity="0.5"/>
  <line x1="210" y1="113" x2="210" y2="328" stroke="#059669" stroke-width="3" opacity="0.5"/>
  <line x1="235" y1="110" x2="235" y2="330" stroke="#059669" stroke-width="3" opacity="0.5"/>
  <line x1="256" y1="110" x2="256" y2="330" stroke="#059669" stroke-width="3" opacity="0.5"/>
  <line x1="277" y1="110" x2="277" y2="330" stroke="#059669" stroke-width="3" opacity="0.5"/>
  <line x1="302" y1="113" x2="302" y2="328" stroke="#059669" stroke-width="3" opacity="0.5"/>
  <ellipse cx="256" cy="140" rx="22" ry="20" fill="#f59e0b"/>
  <path d="M256 120 Q230 80 210 55" stroke="#f0fdf4" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M256 120 Q240 75 228 48" stroke="#f0fdf4" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M256 120 Q250 73 248 44" stroke="#f0fdf4" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M256 120 Q256 72 256 42" stroke="#f0fdf4" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M256 120 Q262 73 264 44" stroke="#f0fdf4" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M256 120 Q272 75 284 48" stroke="#f0fdf4" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M256 120 Q282 80 302 55" stroke="#f0fdf4" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M210 55 Q256 28 302 55" stroke="#f0fdf4" stroke-width="2.5" fill="none" opacity="0.7"/>
</svg>`;

await sharp(Buffer.from(maskableSvg)).resize(512, 512).png().toFile(path.join(outDir, 'maskable-512x512.png'));
console.log('✓ maskable-512x512.png');

// Apple touch icon (180x180, no rounded corners — iOS adds them)
await sharp(Buffer.from(maskableSvg)).resize(180, 180).png().toFile(path.join(outDir, 'apple-touch-icon.png'));
console.log('✓ apple-touch-icon.png');

// Favicon 32x32
await sharp(Buffer.from(svg)).resize(32, 32).png().toFile(path.join(outDir, 'favicon-32x32.png'));
console.log('✓ favicon-32x32.png');

console.log('\nAll icons generated in public/icons/');
