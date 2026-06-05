import fs from 'fs';
import path from 'path';

const extractedPath = 'C:/Users/praji/.gemini/antigravity-ide/brain/046a3f0f-26fe-4471-a35d-33bbb2c4afd5/scratch/extracted.json';
const extracted = JSON.parse(fs.readFileSync(extractedPath, 'utf-8'));

async function searchITunes(title: string, artist: string, retries = 5): Promise<any> {
  const mainArtist = artist.split(',')[0].trim();
  const term = encodeURIComponent(`${title} ${mainArtist}`);
  const url = `https://itunes.apple.com/search?term=${term}&media=music&entity=song&limit=5`;
  
  try {
    const res = await fetch(url);
    if (res.status === 403 || res.status === 429) {
      if (retries > 0) {
        console.log(`Rate limit hit. Waiting 5s...`);
        await new Promise(r => setTimeout(r, 5000));
        return searchITunes(title, artist, retries - 1);
      }
      return null;
    }
    const text = await res.text();
    if (text.includes('Rate limit') && retries > 0) {
      console.log(`Rate limit text hit. Waiting 5s...`);
      await new Promise(r => setTimeout(r, 5000));
      return searchITunes(title, artist, retries - 1);
    }
    const data = JSON.parse(text);
    if (data.results && data.results.length > 0) {
      return data.results[0];
    }
    
    // Fallback
    const fallbackTerm = encodeURIComponent(title);
    const fallbackUrl = `https://itunes.apple.com/search?term=${fallbackTerm}&media=music&entity=song&limit=5`;
    const fallbackRes = await fetch(fallbackUrl);
    if (fallbackRes.status === 403 || fallbackRes.status === 429) {
      if (retries > 0) {
        console.log(`Rate limit hit on fallback. Waiting 5s...`);
        await new Promise(r => setTimeout(r, 5000));
        return searchITunes(title, artist, retries - 1);
      }
    }
    const ftext = await fallbackRes.text();
    if (ftext.includes('Rate limit') && retries > 0) {
      console.log(`Rate limit text hit on fallback. Waiting 5s...`);
      await new Promise(r => setTimeout(r, 5000));
      return searchITunes(title, artist, retries - 1);
    }
    const fallbackData = JSON.parse(ftext);
    if (fallbackData.results && fallbackData.results.length > 0) {
      return fallbackData.results[0];
    }

  } catch (err) {
    console.error(`Error fetching ${title}`, err);
  }
  return null;
}

// Simple deterministic hash for popularity
function generateHashNumber(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0; 
  }
  return Math.abs(hash);
}

function generatePopularity(id: string): number {
  return 40 + (generateHashNumber(id) % 60); 
}

const getGenreColor = (genres: string[]): string => {
  const g = genres[0]?.toLowerCase() || '';
  if (g.includes('pop')) return '#ff3366';
  if (g.includes('hip-hop') || g.includes('rap')) return '#ff9933';
  if (g.includes('dance') || g.includes('electronic')) return '#33ccff';
  if (g.includes('rock') || g.includes('metal')) return '#cc33ff';
  if (g.includes('r&b') || g.includes('soul')) return '#9933ff';
  if (g.includes('indie') || g.includes('alternative')) return '#33ff99';
  if (g.includes('latin') || g.includes('reggaeton')) return '#ffcc00';
  if (g.includes('country')) return '#ff6600';
  if (g.includes('k-pop')) return '#ff66cc';
  return '#1db954'; // Default KADENCE green
};

function assignNodePhysics(idStr: string) {
  const hash = generateHashNumber(idStr);
  const r1 = (hash % 100) / 100;
  const r2 = ((hash >> 4) % 100) / 100;
  const r3 = ((hash >> 8) % 100) / 100;
  return {
    x: (r1 - 0.5) * 1200,
    y: (r2 - 0.5) * 1200,
    z: (r3 - 0.5) * 1200,
    vx: (r1 - 0.5) * 0.4,
    vy: (r2 - 0.5) * 0.4,
    scale: 0.5 + (r3 * 1.5)
  };
}

async function run() {
  const songs = [];
  
  for (let i = 0; i < extracted.length; i++) {
    const { title, artist } = extracted[i];
    console.log(`Processing ${i+1}/${extracted.length}: ${title} - ${artist}`);
    
    const track = await searchITunes(title, artist);
    if (!track) {
      console.warn(`--> Not found on iTunes: ${title}`);
      continue;
    }
    
    const id = track.trackId.toString();
    const popularity = generatePopularity(id);
    const genres = [track.primaryGenreName, 'Dev Special'];
    const physics = assignNodePhysics(id);
    const scaleFactor = 0.3 + (popularity / 100) * 1.2;

    const artworkUrl100 = track.artworkUrl100 || '';
    const albumArt = artworkUrl100.replace('100x100bb', '600x600bb');

    const songNode = {
      id,
      name: track.trackName,
      artist: track.artistName,
      album: track.collectionName || 'Unknown Album',
      albumArt,
      previewUrl: track.previewUrl || null,
      spotifyUrl: track.trackViewUrl || '',
      popularity,
      genres,
      color: getGenreColor(genres),
      scale: scaleFactor,
      x: physics.x,
      y: physics.y,
      z: physics.z,
      vx: physics.vx,
      vy: physics.vy
    };
    
    songs.push(songNode);
    // Be nice to the API
    await new Promise(r => setTimeout(r, 200));
  }
  
  console.log(`Successfully mapped ${songs.length} out of ${extracted.length} songs.`);
  
  const fileContent = `// Auto-generated Dev Special Dataset
import { SongNode } from './types';

export const devSpecialData: SongNode[] = ${JSON.stringify(songs, null, 2)};
`;

  fs.writeFileSync('lib/devSpecialData.ts', fileContent);
  console.log('Saved to lib/devSpecialData.ts');
}

run();
