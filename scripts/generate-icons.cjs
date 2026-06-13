/* Rasterize public/logo.svg into the PWA/favicon PNGs. Run: node scripts/generate-icons.cjs */
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'public');
const svg = fs.readFileSync(path.join(root, 'logo.svg'));

const targets = [
  ['favicon.png', 128],
  ['apple-touch-icon.png', 180],
  ['icon-192.png', 192],
  ['icon-512.png', 512],
];

Promise.all(
  targets.map(([file, size]) =>
    sharp(svg).resize(size, size).png().toFile(path.join(root, file)).then(() => console.log(`✓ ${file} (${size}px)`))
  )
)
  .then(() => console.log('Icons generated from logo.svg'))
  .catch((e) => {
    console.error('Icon generation failed:', e);
    process.exit(1);
  });
