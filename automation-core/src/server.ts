import express, { Request, Response } from 'express';
import cors from 'cors';
import { PlaywrightExecutor } from './executor';
import { TaskPlan, StepResult } from './types';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

let executor: PlaywrightExecutor | null = null;

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    browser_ready: executor !== null,
    timestamp: new Date().toISOString()
  });
});

// Initialize browser
app.post('/browser/init', async (req: Request, res: Response) => {
  try {
    if (executor) {
      return res.json({ success: true, message: 'Browser already initialized' });
    }

    const { headless = false, slowMo = 800, keepOpen = false } = req.body;
    
    executor = new PlaywrightExecutor(headless, slowMo, keepOpen);
    await executor.init();

    res.json({
      success: true,
      message: 'Browser initialized',
      config: { headless, slowMo, keepOpen }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Close browser
app.post('/browser/close', async (req: Request, res: Response) => {
  try {
    if (!executor) {
      return res.json({ success: true, message: 'Browser already closed' });
    }

    await executor.close();
    executor = null;

    res.json({ success: true, message: 'Browser closed' });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Execute a single step
app.post('/execute/step', async (req: Request, res: Response) => {
  try {
    if (!executor) {
      return res.status(400).json({
        success: false,
        error: 'Browser not initialized. Call /browser/init first'
      });
    }

    const step = req.body;
    const result = await executor.executeStep(step);

    res.json({
      success: true,
      result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Execute a full task plan
app.post('/execute/plan', async (req: Request, res: Response) => {
  try {
    const { plan, autoInit = true, autoClose = false } = req.body as {
      plan: TaskPlan;
      autoInit?: boolean;
      autoClose?: boolean;
    };

    if (!plan || !plan.steps || !Array.isArray(plan.steps)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid plan format. Expected { plan: TaskPlan }'
      });
    }

    // Auto-initialize if requested
    if (autoInit && !executor) {
      executor = new PlaywrightExecutor(false, 800, false);
      await executor.init();
    }

    if (!executor) {
      return res.status(400).json({
        success: false,
        error: 'Browser not initialized. Call /browser/init or set autoInit=true'
      });
    }

    const results: StepResult[] = [];
    let allSuccess = true;

    for (const step of plan.steps) {
      const result = await executor.executeStep(step);
      results.push(result);

      if (!result.success) {
        allSuccess = false;
        break; // Stop on first failure
      }
    }

    // Auto-close if requested
    if (autoClose && executor) {
      await executor.close();
      executor = null;
    }

    res.json({
      success: allSuccess,
      task_id: plan.task_id,
      total_steps: plan.steps.length,
      completed_steps: results.length,
      results
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Get current browser state
app.get('/browser/state', async (req: Request, res: Response) => {
  try {
    if (!executor) {
      return res.status(400).json({
        success: false,
        error: 'Browser not initialized'
      });
    }

    const state = await executor.getCurrentState();
    res.json({
      success: true,
      state
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🦊 Foxy-AI Automation Core Server`);
  console.log(`📡 Listening on http://localhost:${PORT}`);
  console.log(`🔍 Health: http://localhost:${PORT}/health`);
  console.log(``);
  console.log(`Available endpoints:`);
  console.log(`  POST /browser/init      - Initialize Firefox browser`);
  console.log(`  POST /browser/close     - Close browser`);
  console.log(`  GET  /browser/state     - Get current browser state`);
  console.log(`  POST /execute/step      - Execute a single step`);
  console.log(`  POST /execute/plan      - Execute a full task plan`);
  console.log(`  GET  /health            - Health check`);
  console.log(``);
});

// Cleanup on exit
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down...');
  if (executor) {
    await executor.close();
  }
  process.exit(0);
});
