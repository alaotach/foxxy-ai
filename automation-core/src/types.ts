// Types matching Python backend schema
export interface Step {
  id: string;
  type: 'navigate' | 'click' | 'type' | 'scroll' | 'wait' | 'extract_text' | 'press_enter';
  selector?: string;
  text?: string;
  url?: string;
  amount?: number;
  timeout?: number;
}

export interface TaskPlan {
  task_id: string;
  steps: Step[];
  created_at?: string;
}

export interface StepResult {
  step_id: string;
  success: boolean;
  error?: string;
  observations?: {
    extracted_text?: string;
    element_found?: boolean;
    current_url?: string;
    page_title?: string;
  };
  screenshot?: string; // Base64
  duration_ms: number;
}

export interface ExecutionFeedback {
  task_id: string;
  completed_steps: StepResult[];
  current_url?: string;
  page_title?: string;
  dom_summary?: string;
}

export interface ExecutorConfig {
  headless: boolean;
  slowMo: number;
  screenshotOnError: boolean;
  backendUrl: string;
}
