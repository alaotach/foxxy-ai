import axios from 'axios';
import { TaskPlan, ExecutionFeedback, StepResult } from './types';
import { PlaywrightExecutor } from './executor';
import * as dotenv from 'dotenv';

dotenv.config();

export class AutomationCore {
  private executor: PlaywrightExecutor;
  private backendUrl: string;

  constructor(backendUrl?: string, headless: boolean = false, slowMo?: number, keepOpen: boolean = false) {
    this.backendUrl = backendUrl || process.env.BACKEND_URL || 'http://localhost:8000';
    const slow = slowMo ?? parseInt(process.env.SLOW_MO || '500');
    this.executor = new PlaywrightExecutor(headless, slow, keepOpen);
  }

  async fetchPlan(prompt: string): Promise<TaskPlan> {
    console.log(`🧠 Requesting plan from backend: "${prompt}"`);
    const response = await axios.post(`${this.backendUrl}/plan`, { prompt });
    console.log(`✅ Plan received: ${response.data.steps.length} steps`);
    return response.data;
  }

  async executePlan(plan: TaskPlan): Promise<ExecutionFeedback> {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🚀 Executing Task: ${plan.task_id}`);
    console.log(`${'='.repeat(60)}\n`);

    await this.executor.init();

    const completedSteps: StepResult[] = [];

    try {
      for (let i = 0; i < plan.steps.length; i++) {
        const step = plan.steps[i];
        console.log(`\n[${i + 1}/${plan.steps.length}] Step: ${step.id}`);

        const result = await this.executor.executeStep(step);
        completedSteps.push(result);

        // Stop execution if step failed
        if (!result.success) {
          console.log(`\n⚠️  Execution stopped due to failure at step ${i + 1}`);
          break;
        }
      }

      const state = await this.executor.getCurrentState();

      const feedback: ExecutionFeedback = {
        task_id: plan.task_id,
        completed_steps: completedSteps,
        current_url: state.url,
        page_title: state.title,
      };

      return feedback;
    } finally {
      await this.executor.close();
    }
  }

  async sendFeedback(feedback: ExecutionFeedback): Promise<void> {
    console.log(`\n📤 Sending feedback to backend...`);
    await axios.post(`${this.backendUrl}/feedback`, { 
      task_id: feedback.task_id,
      feedback 
    });
    console.log(`✅ Feedback sent`);
  }

  async run(prompt: string): Promise<void> {
    try {
      // Step 1: Get plan from Python backend
      const plan = await this.fetchPlan(prompt);

      // Step 2: Execute the plan
      const feedback = await this.executePlan(plan);

      // Step 3: Send results back to backend
      await this.sendFeedback(feedback);

      // Summary
      const succeeded = feedback.completed_steps.filter(s => s.success).length;
      const failed = feedback.completed_steps.filter(s => !s.success).length;

      console.log(`\n${'='.repeat(60)}`);
      console.log(`📊 Execution Summary`);
      console.log(`${'='.repeat(60)}`);
      console.log(`✅ Succeeded: ${succeeded}`);
      console.log(`❌ Failed: ${failed}`);
      console.log(`📍 Final URL: ${feedback.current_url}`);
      console.log(`📄 Page Title: ${feedback.page_title}`);
      console.log(`${'='.repeat(60)}\n`);
    } catch (error) {
      console.error('❌ Automation failed:', error);
      throw error;
    }
  }

  // Execute provided steps directly (for extension use)
  async executeSteps(steps: any[]): Promise<StepResult[]> {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🚀 Executing ${steps.length} steps from extension`);
    console.log(`${'='.repeat(60)}\n`);

    await this.executor.init();

    const completedSteps: StepResult[] = [];

    try {
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        console.log(`\n[${i + 1}/${steps.length}] Step: ${step.id}`);

        const result = await this.executor.executeStep(step);
        completedSteps.push(result);

        if (!result.success) {
          console.log(`\n⚠️  Execution stopped due to failure at step ${i + 1}`);
          break;
        }
      }

      return completedSteps;
    } finally {
      await this.executor.close();
    }
  }
}
