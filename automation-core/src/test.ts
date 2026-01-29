import { PlaywrightExecutor } from './executor';
import { Step } from './types';

async function testExecutor() {
  console.log('🧪 Testing Playwright Executor\n');

  const executor = new PlaywrightExecutor(false, 500);
  await executor.init();

  const steps: Step[] = [
    {
      id: 'test-1',
      type: 'navigate',
      url: 'https://example.com',
    },
    {
      id: 'test-2',
      type: 'wait',
      selector: 'h1',
      timeout: 5000,
    },
    {
      id: 'test-3',
      type: 'extract_text',
      selector: 'h1',
    },
    {
      id: 'test-4',
      type: 'scroll',
      amount: 300,
    },
  ];

  for (const step of steps) {
    const result = await executor.executeStep(step);
    console.log('\nResult:', JSON.stringify(result, null, 2));
  }

  await executor.close();
  console.log('\n✅ Test complete!');
}

testExecutor().catch(console.error);
