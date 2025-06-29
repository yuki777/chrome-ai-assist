#!/usr/bin/env node

// Test script to verify extension ID and Native Messaging setup

console.log('🔍 Chrome AI Assist - Native Messaging Configuration Test\n');

import fs from 'fs';
import { spawn } from 'child_process';

const manifestPath = `${process.env.HOME}/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.chrome_ai_assist.mcp_bridge.json`;

console.log('1️⃣  Checking Native Messaging manifest...');
console.log(`   Path: ${manifestPath}`);

try {
  const manifestContent = fs.readFileSync(manifestPath, 'utf8');
  const manifest = JSON.parse(manifestContent);
  
  console.log('   ✅ Manifest file exists');
  console.log(`   📂 Host path: ${manifest.path}`);
  console.log(`   🔗 Allowed origins: ${manifest.allowed_origins.join(', ')}`);
  
  // Extract extension ID from allowed_origins
  const extensionId = manifest.allowed_origins[0]?.match(/chrome-extension:\/\/([a-z]+)\//)?.[1];
  if (extensionId) {
    console.log(`   🆔 Extension ID: ${extensionId}`);
  }
  
  console.log('\n2️⃣  Checking host.js file...');
  if (fs.existsSync(manifest.path)) {
    console.log('   ✅ Host script exists');
    console.log(`   📁 Host location: ${manifest.path}`);
  } else {
    console.log('   ❌ Host script not found');
  }
  
  console.log('\n3️⃣  Testing host execution...');
  const hostProcess = spawn('node', [manifest.path], {
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  let hostStarted = false;
  
  hostProcess.stderr.on('data', (data) => {
    const line = data.toString();
    if (line.includes('Native host started')) {
      hostStarted = true;
      console.log('   ✅ Host script runs successfully');
      hostProcess.kill();
    }
  });
  
  hostProcess.on('error', (error) => {
    console.log(`   ❌ Host execution failed: ${error.message}`);
  });
  
  setTimeout(() => {
    if (!hostStarted) {
      console.log('   ⚠️  Host didn\'t start within 2 seconds');
      hostProcess.kill();
    }
    
    console.log('\n4️⃣  Next steps:');
    console.log('   1. Ensure Chrome is completely closed');
    console.log('   2. Restart Chrome');
    console.log('   3. Go to chrome://extensions/');
    console.log('   4. Click "Reload" on Chrome AI Assist extension');
    console.log('   5. Check if extension ID matches:', extensionId);
    console.log('   6. Test the extension on a DocBase page');
    
    process.exit(0);
  }, 2000);
  
} catch (error) {
  console.log(`   ❌ Error reading manifest: ${error.message}`);
  console.log('\n💡 Solution:');
  console.log('   Run the install script to set up Native Messaging:');
  console.log('   cd native-host && ./install.sh');
}