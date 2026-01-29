import fetch from 'node-fetch';

const AUTOMATION_CORE_URL = 'http://localhost:3000';

// Example task: Go to GitHub and click login
const testPlan = {
  task_id: 'test-task-123',
  task_description: 'Go to GitHub and click login button',
  steps: [
    {
      id: 1,
      type: 'navigate',
      url: 'https://github.com',
      description: 'Navigate to GitHub homepage'
    },
    {
      id: 2,
      type: 'wait',
      selector: 'a[href="/login"]',
      timeout: 5000,
      description: 'Wait for login button to appear'
    },
    {
      id: 3,
      type: 'click',
      selector: 'a[href="/login"]',
      description: 'Click the Sign in button'
    },
    {
      id: 4,
      type: 'wait',
      selector: '#login_field',
      timeout: 5000,
      description: 'Wait for login form'
    },
    {
      id: 5,
      type: 'extract_text',
      selector: 'h1',
      description: 'Extract page heading'
    }
  ],
  context: {
    current_url: '',
    page_title: ''
  }
};

async function testAutomationCore() {
  console.log('🦊 Testing Automation Core Integration\n');

  try {
    // 1. Check health
    console.log('1️⃣ Checking health...');
    const healthResponse = await fetch(`${AUTOMATION_CORE_URL}/health`);
    const health = await healthResponse.json();
    console.log('   ✅ Health:', health);
    console.log('');

    // 2. Execute plan
    console.log('2️⃣ Executing plan...');
    console.log(`   Task: ${testPlan.task_description}`);
    console.log(`   Steps: ${testPlan.steps.length}`);
    console.log('');

    const executeResponse = await fetch(`${AUTOMATION_CORE_URL}/execute/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan: testPlan,
        autoInit: true,
        autoClose: false // Keep browser open
      })
    });

    const result = await executeResponse.json();
    
    console.log('3️⃣ Results:');
    console.log(`   Success: ${result.success}`);
    console.log(`   Completed: ${result.completed_steps}/${result.total_steps}`);
    console.log('');

    console.log('4️⃣ Step Details:');
    result.results.forEach((stepResult: any, i: number) => {
      const status = stepResult.success ? '✅' : '❌';
      console.log(`   ${status} Step ${i + 1}: ${stepResult.step_id}`);
      if (stepResult.observations?.extracted_text) {
        console.log(`      Extracted: "${stepResult.observations.extracted_text}"`);
      }
      if (stepResult.error) {
        console.log(`      Error: ${stepResult.error}`);
      }
    });
    console.log('');

    // 3. Get browser state
    console.log('5️⃣ Getting browser state...');
    const stateResponse = await fetch(`${AUTOMATION_CORE_URL}/browser/state`);
    const stateData = await stateResponse.json();
    if (stateData.success) {
      console.log(`   URL: ${stateData.state.url}`);
      console.log(`   Title: ${stateData.state.title}`);
    }
    console.log('');

    console.log('✅ Test complete! Browser will stay open for inspection.');
    console.log('💡 Close manually or call POST /browser/close');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('');
    console.log('💡 Make sure automation-core server is running:');
    console.log('   cd automation-core');
    console.log('   npm run server');
  }
}

testAutomationCore();
