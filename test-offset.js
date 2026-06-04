const https = require('https');

async function testOffset(offset) {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const tokenData = await tokenRes.json();
  const token = tokenData.access_token;

  const res = await fetch(`https://api.spotify.com/v1/search?q=test&type=track&limit=10&offset=${offset}&market=US`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  console.log(`offset=${offset} status:`, res.status);
  const text = await res.text();
  console.log(text.substring(0, 200));
}

testOffset(990);
testOffset(50);
