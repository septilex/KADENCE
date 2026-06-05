import { fetchSongsByVibe } from '../lib/musicProvider';

async function run() {
  console.log('Starting diagnostics...');
  const start = Date.now();
  
  try {
    const songs = await fetchSongsByVibe('global-top-50', 1000, 0);
    const end = Date.now();
    
    console.log(`\n--- Diagnostic Results ---`);
    console.log(`Total tracks returned: ${songs.length}`);
    
    const uniqueIds = new Set(songs.map(s => s.id));
    console.log(`Unique track IDs: ${uniqueIds.size}`);
    
    const uniqueArtworks = new Set(songs.map(s => s.albumArt).filter(a => a));
    console.log(`Unique album artworks: ${uniqueArtworks.size}`);
    
    const uniqueArtists = new Set(songs.map(s => s.artist));
    console.log(`Unique artists: ${uniqueArtists.size}`);
    
    const withPreviews = songs.filter(s => s.previewUrl).length;
    console.log(`Tracks with preview URLs: ${withPreviews} (${Math.round(withPreviews / songs.length * 100)}%)`);
    
    console.log(`Average API response time: ${end - start}ms`);
    
  } catch (err) {
    console.error('Diagnostics failed:', err);
  }
}

run();
