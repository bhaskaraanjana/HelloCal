import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const sourceLogo = "C:\\Users\\bhask\\.gemini\\antigravity\\brain\\78c0e2ea-36cd-4f8a-bfaa-a821d1f42488\\halocal_food_fitness_logo_1779223139494.png";

async function applyLogo() {
  try {
    console.log(`Loading new premium logo from: ${sourceLogo}...`);
    const logoBuffer = fs.readFileSync(sourceLogo);

    // 1. Output icon-512.png (512x512)
    console.log("Writing public/icon-512.png...");
    await sharp(logoBuffer)
      .resize(512, 512)
      .png()
      .toFile('public/icon-512.png');

    // 2. Output icon-192.png (192x192)
    console.log("Writing public/icon-192.png...");
    await sharp(logoBuffer)
      .resize(192, 192)
      .png()
      .toFile('public/icon-192.png');

    // 3. Output apple-touch-icon.png (180x180)
    console.log("Writing public/apple-touch-icon.png...");
    await sharp(logoBuffer)
      .resize(180, 180)
      .png()
      .toFile('public/apple-touch-icon.png');

    // 4. Output favicon.png (64x64) for browser tabs
    console.log("Writing public/favicon.png...");
    await sharp(logoBuffer)
      .resize(64, 64)
      .png()
      .toFile('public/favicon.png');

    console.log("Successfully scaled and copied all premium branding logo assets to PWA directory!");
  } catch (err) {
    console.error("Failed to copy and scale new logo:", err);
  }
}

applyLogo();
