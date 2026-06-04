const fs = require('fs');

// SPOTIFY CREDENTIALS
// Replace these with your actual Spotify Developer credentials to run this audit.
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || 'YOUR_CLIENT_ID';
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || 'YOUR_CLIENT_SECRET';

const playlists = [
  { name: 'Global Top 50', id: '37i9dQZEVXbMDoHDwVN2tF' },
  { name: 'Viral 50', id: '37i9dQZEVXbLiRSasKsNU9' },
  { name: 'New Music Friday', id: '37i9dQZF1DX4JAvHpjipBk' },
  { name: 'Hip-Hop Central', id: '37i9dQZF1DX0XUsuxWHRQd' },
  { name: 'Pop Rising', id: '37i9dQZF1DWUa8ZRTfalHk' },
  { name: 'Dance Hits', id: '37i9dQZF1DX0BcQWzuB7ZO' },
  { name: 'Mood Booster', id: '37i9dQZF1DX3rxVfibe1L0' },
  { name: 'Chill Hits', id: '37i9dQZF1DX4WYpdVIP10k' }
];

async function getSpotifyToken() {
  const params = new URLSearchParams();
  params.append('grant_type', 'client_credentials');
  
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(SPOTIFY_CLIENT_ID + ':' + SPOTIFY_CLIENT_SECRET).toString('base64')
    },
    body: params
  });
  
  const data = await res.json();
  if (!data.access_token) {
    throw new Error('Failed to get Spotify Token. Did you set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET?');
  }
  return data.access_token;
}

async function getDeezerPreview(isrc) {
  try {
    const res = await fetch(`https://api.deezer.com/track/isrc:${isrc}`);
    const data = await res.json();
    if (data.error) return null;
    return data.preview || null;
  } catch (err) {
    return null;
  }
}

async function main() {
  console.log('Starting KADENCE Audio Validation Audit...\n');
  let token;
  try {
    token = await getSpotifyToken();
    console.log('✓ Authenticated with Spotify');
  } catch (err) {
    console.error(err.message);
    console.log('\nPlease run:');
    console.log('$env:SPOTIFY_CLIENT_ID="your_id"; $env:SPOTIFY_CLIENT_SECRET="your_secret"; node kadence_audit.js');
    process.exit(1);
  }

  const report = [];
  let globalTotalTested = 0;
  let globalTotalMatches = 0;

  for (const pl of playlists) {
    console.log(`\nAnalyzing: ${pl.name}...`);
    
    // 1. Fetch first 50 tracks from Spotify
    const res = await fetch(`https://api.spotify.com/v1/playlists/${pl.id}/tracks?limit=50`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const data = await res.json();
    if (!data.items) {
      console.log(`  Failed to fetch playlist data for ${pl.name}`);
      continue;
    }

    let tracksTested = 0;
    let successfulMatches = 0;
    let failedMatches = 0;

    for (const item of data.items) {
      if (!item.track) continue;
      
      const isrc = item.track.external_ids?.isrc;
      if (!isrc) {
        failedMatches++;
        tracksTested++;
        continue;
      }

      // 2 & 3. Query Deezer using ISRC and check for preview URL
      const previewUrl = await getDeezerPreview(isrc);
      
      if (previewUrl) {
        successfulMatches++;
      } else {
        failedMatches++;
      }
      tracksTested++;
      
      // Delay slightly to respect rate limits
      await new Promise(r => setTimeout(r, 100)); 
    }

    const matchPercentage = ((successfulMatches / tracksTested) * 100).toFixed(2);
    
    console.log(`  - Total Tested: ${tracksTested}`);
    console.log(`  - Success: ${successfulMatches}`);
    console.log(`  - Failed: ${failedMatches}`);
    console.log(`  - Match %: ${matchPercentage}%`);

    report.push({
      Chart: pl.name,
      Tested: tracksTested,
      Success: successfulMatches,
      Failed: failedMatches,
      MatchRate: matchPercentage + '%'
    });

    globalTotalTested += tracksTested;
    globalTotalMatches += successfulMatches;
  }

  console.log('\n======================================');
  console.log('FINAL AUDIT REPORT');
  console.log('======================================');
  console.table(report);
  console.log('\nOVERALL MATCH RATE: ' + ((globalTotalMatches / globalTotalTested) * 100).toFixed(2) + '%');
}

main();
