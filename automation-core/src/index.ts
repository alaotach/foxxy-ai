import express from 'express';
import cors from 'cors';
import { AutomationCore } from './core';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

console.log('🦊 Foxy AI - Automation Core Server');
console.log('=' .repeat(60));
console.log('Listening for commands from extension...');
console.log('Server: http://localhost:3000');
console.log('=' .repeat(60));

// Execute automation task from extension
app.post('/execute', async (req, res) => {
  const { prompt, steps } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  console.log(`\n📨 Received from extension: "${prompt}"`);

  try {
    const keepOpen = process.env.KEEP_OPEN === 'true';
    const core = new AutomationCore(undefined, false, undefined, keepOpen);
    
    if (steps) {
      // Execute provided steps directly
      console.log('📋 Executing provided steps...');
      const results = await core.executeSteps(steps);
      res.json({ success: true, results });
    } else {
      // Plan and execute
      const result = await core.run(prompt);
      res.json({ success: true, result });
    }
  } catch (error) {
    console.error('❌ Execution error:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'Foxy AI Automation Core' });
});

app.listen(PORT, () => {
  console.log(`✅ Server ready on port ${PORT}`);
});
