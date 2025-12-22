import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const musicDir = path.join(__dirname, '..', 'public', 'music');
const outputFile = path.join(musicDir, 'playlist.json');

// Ensure music directory exists
if (!fs.existsSync(musicDir)) {
  fs.mkdirSync(musicDir, { recursive: true });
}

try {
  const files = fs.readdirSync(musicDir)
    .filter(file => {
      const lower = file.toLowerCase();
      return lower.endsWith('.mp3') || lower.endsWith('.wav') || lower.endsWith('.ogg');
    });

  const playlist = files.map(file => `/music/${file}`);

  fs.writeFileSync(outputFile, JSON.stringify(playlist, null, 2));
  console.log(`✓ Generated playlist with ${files.length} songs at ${outputFile}`);
} catch (error) {
  console.error('Error generating playlist:', error);
  // Create empty playlist if failed
  fs.writeFileSync(outputFile, JSON.stringify([], null, 2));
}