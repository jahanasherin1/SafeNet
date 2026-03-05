const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const logoPath = './assets/images/logo.png';
const mipmapDensities = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
};

const drawableDensities = {
  'drawable-mdpi': 96,
  'drawable-hdpi': 144,
  'drawable-xhdpi': 192,
  'drawable-xxhdpi': 288,
  'drawable-xxxhdpi': 384,
};

async function convertIcon() {
  try {
    // Convert mipmap icons
    for (const [folder, size] of Object.entries(mipmapDensities)) {
      const dir = `./android/app/src/main/res/${folder}`;
      
      // Convert ic_launcher
      await sharp(logoPath)
        .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
        .webp()
        .toFile(path.join(dir, 'ic_launcher.webp'));
      
      // Convert ic_launcher_round
      await sharp(logoPath)
        .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
        .webp()
        .toFile(path.join(dir, 'ic_launcher_round.webp'));
      
      // Convert ic_launcher_foreground
      await sharp(logoPath)
        .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
        .webp()
        .toFile(path.join(dir, 'ic_launcher_foreground.webp'));
      
      console.log(`✓ Converted logo.png to ${folder} (${size}x${size})`);
    }
    
    // Convert drawable splash screens
    for (const [folder, size] of Object.entries(drawableDensities)) {
      const dir = `./android/app/src/main/res/${folder}`;
      
      await sharp(logoPath)
        .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
        .png()
        .toFile(path.join(dir, 'splashscreen_logo.png'));
      
      console.log(`✓ Converted logo.png to ${folder} (${size}x${size})`);
    }
    
    console.log('✓ All icons and splash screens converted successfully!');
  } catch (error) {
    console.error('Error converting icon:', error);
    process.exit(1);
  }
}

convertIcon();
