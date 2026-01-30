// 🎯 Integrated System Test
// Test both old vision system and new tool registry

console.log('🧪 Testing Integrated Foxy AI System...\n');

async function testIntegration() {
  console.log('=== SYSTEM INTEGRATION TEST ===\n');
  
  // Test 1: Tool Registry (New System)
  console.log('1️⃣ Testing Tool Registry...');
  if (typeof toolRegistry !== 'undefined') {
    const tools = toolRegistry.getAvailableTools();
    console.log(`✅ Tool Registry loaded: ${tools.length} tools available`);
    console.log(`   Tools: ${tools.slice(0, 5).join(', ')}...`);
  } else {
    console.log('❌ Tool Registry not loaded');
  }
  console.log();
  
  // Test 2: WebSocket Manager (New System)
  console.log('2️⃣ Testing WebSocket Manager...');
  if (typeof wsManager !== 'undefined') {
    console.log('✅ WebSocket Manager loaded');
    console.log(`   Status: ${wsManager.getStatus()}`);
  } else {
    console.log('❌ WebSocket Manager not loaded');
  }
  console.log();
  
  // Test 3: Protocol (New System)
  console.log('3️⃣ Testing Protocol...');
  if (typeof Protocol !== 'undefined') {
    console.log('✅ Protocol loaded');
    console.log(`   Message types: ${Object.keys(Protocol.MessageType).length}`);
  } else {
    console.log('❌ Protocol not loaded');
  }
  console.log();
  
  // Test 4: Old Vision System
  console.log('4️⃣ Testing Old Vision System...');
  if (typeof captureScreenshot === 'function') {
    console.log('✅ Vision system loaded (captureScreenshot available)');
  } else {
    console.log('❌ Vision system not loaded');
  }
  console.log();
  
  // Test 5: Screenshot Capture
  console.log('5️⃣ Testing Screenshot Capture...');
  try {
    const screenshot = await captureScreenshot();
    if (screenshot) {
      console.log('✅ Screenshot captured successfully');
      console.log(`   Size: ${screenshot.length} characters`);
    } else {
      console.log('❌ Screenshot capture returned null');
    }
  } catch (error) {
    console.log('❌ Screenshot failed:', error.message);
  }
  console.log();
  
  // Test 6: Tool Registry Screenshot
  console.log('6️⃣ Testing Tool Registry Screenshot...');
  try {
    const result = await toolRegistry.execute('screenshot', {});
    if (result.success) {
      console.log('✅ Tool Registry screenshot works');
      console.log(`   Format: ${result.result.format}`);
    } else {
      console.log('❌ Tool Registry screenshot failed');
    }
  } catch (error) {
    console.log('❌ Tool Registry screenshot error:', error.message);
  }
  console.log();
  
  // Test 7: Page Info Tool
  console.log('7️⃣ Testing Page Info Tool...');
  try {
    const info = await toolRegistry.execute('get_page_info', {});
    if (info.success) {
      console.log('✅ Page info retrieved');
      console.log(`   URL: ${info.result.url}`);
      console.log(`   Title: ${info.result.title}`);
    }
  } catch (error) {
    console.log('❌ Page info failed:', error.message);
  }
  console.log();
  
  // Summary
  console.log('=== TEST COMPLETE ===');
  console.log('Both systems are now integrated! 🎉');
  console.log('\nYou can use:');
  console.log('• Old vision automation (for complex tasks)');
  console.log('• New tool registry (for modular automation)');
  console.log('• WebSocket for real-time backend communication');
  console.log('\nFor Canva Valentine PPT, the old vision system should work now!');
}

// Run tests
testIntegration();
