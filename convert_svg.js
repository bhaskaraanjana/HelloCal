import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const svgPath = path.resolve('public/favicon.svg');

async function convert() {
  try {
    console.log(`Reading SVG from ${svgPath}...`);
    
    // Read the SVG content
    const svgBuffer = fs.readFileSync(svgPath);
    
    // Render at 192x192
    console.log("Generating public/icon-192.png (192x192)...");
    await sharp(svgBuffer)
      .resize(192, 192)
      .png()
      .toFile('public/icon-192.png');
      
    // Render at 512x512
    console.log("Generating public/icon-512.png (512x512)...");
    await sharp(svgBuffer)
      .resize(512, 512)
      .png()
      .toFile('public/icon-512.png');
      
    // Render at 180x180 for iOS Apple Touch Icon
    console.log("Generating public/apple-touch-icon.png (180x180)...");
    await sharp(svgBuffer)
      .resize(180, 180)
      .png()
      .toFile('public/apple-touch-icon.png');
      
    console.log("Success! All premium PWA PNG icons successfully generated from public/favicon.svg!");
  } catch (error) {
    console.error("Error during SVG to PNG conversion:", error);
  }
}

convert();
