async function run() {
  try {
    const res = await fetch('http://localhost:3000/api/songs?vibe=global-top-50');
    const data = await res.json();
    const songs = data.songs || [];
    
    console.log('--- API Route / Client-side Data Layer ---');
    console.log('Data source (demo flag):', !!data.demo);
    console.log('Data source (cached flag):', !!data.cached);
    console.log('Total returned:', songs.length);
    
    const uniqueIds = new Set(songs.map(s => s.id));
    console.log('Unique track IDs:', uniqueIds.size);
    
    const uniqueArtwork = new Set(songs.map(s => s.albumArt).filter(Boolean));
    console.log('Unique album artwork URLs:', uniqueArtwork.size);
    
    const artCounts = new Map();
    for (const s of songs) {
      if (s.albumArt) {
        artCounts.set(s.albumArt, (artCounts.get(s.albumArt) || 0) + 1);
      }
    }
    const topArts = [...artCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    console.log('\nSample of duplicate artwork URLs (top 5 frequencies):');
    topArts.forEach(([url, count]) => {
      console.log(`  ${count}x: ${url}`);
    });

  } catch (err) {
    console.error(err);
  }
}
run();
