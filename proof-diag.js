async function run() {
  try {
    const res = await fetch('http://localhost:3000/api/songs?vibe=global-top-50&refresh=1');
    const data = await res.json();
    const songs = data.songs || [];
    
    console.log('--- PROOF POINTS ---');
    console.log('3. Demo Flag Status:');
    console.log('  demo:', data.demo !== undefined ? data.demo : 'Not present in response');

    console.log('\n1 & 2. First 20 Tracks (ID : Name):');
    for (let i = 0; i < Math.min(20, songs.length); i++) {
      console.log(`  ${String(i + 1).padStart(2, ' ')}. ${songs[i].id} : ${songs[i].name}`);
    }
    
    const uniqueTitles = new Set(songs.map(s => s.name));
    const uniqueArtists = new Set(songs.map(s => s.artist));
    const uniqueArtwork = new Set(songs.map(s => s.albumArt).filter(Boolean));
    
    console.log('\n4. Unique Value Counts (out of ' + songs.length + ' total tracks):');
    console.log('  Unique song titles:', uniqueTitles.size);
    console.log('  Unique artists:', uniqueArtists.size);
    console.log('  Unique album artworks:', uniqueArtwork.size);

  } catch (err) {
    console.error(err);
  }
}
run();
