#!/usr/bin/env node

// Direct API test to verify the token and post ID work

import https from 'https';

const API_TOKEN = 'docbase_YMFu3GP9x7tZYJozemFWTMeyC9ZriUVd5tdnRaFQsNjv7keZPxsFiNPH7jUkhr8o';
const POST_ID = 3791373;

console.log('🧪 Testing DocBase API directly...\n');

const options = {
  hostname: 'api.docbase.io',
  port: 443,
  path: `/teams/media-sys/posts/${POST_ID}`,
  method: 'GET',
  headers: {
    'X-DocBaseToken': API_TOKEN,
    'User-Agent': 'Chrome-AI-Assist-Test/1.0'
  }
};

const req = https.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log(`Headers:`, res.headers);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const post = JSON.parse(data);
      console.log('\n📄 Post found:');
      console.log(`   ID: ${post.id}`);
      console.log(`   Title: ${post.title}`);
      console.log(`   Author: ${post.user.name}`);
      console.log(`   Created: ${post.created_at}`);
      console.log(`   URL: ${post.url}`);
      console.log(`   Tags: ${post.tags?.join(', ') || 'none'}`);
      console.log(`   Body preview: ${post.body.substring(0, 100)}...`);
      console.log('\n✅ API test successful!');
    } catch (e) {
      console.error('❌ Failed to parse response:', e.message);
      console.log('Raw response:', data);
    }
  });
});

req.on('error', (e) => {
  console.error('❌ Request failed:', e.message);
});

req.setTimeout(10000, () => {
  console.error('❌ Request timed out');
  req.destroy();
});

req.end();