import { chromium, firefox, Browser, Page } from 'playwright';
import { Step, StepResult } from './types';

export class PlaywrightExecutor {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private headless: boolean;
  private slowMo: number;
  private keepOpen: boolean;

  constructor(headless: boolean = false, slowMo: number = 100, keepOpen: boolean = false) {
    this.headless = headless;
    this.slowMo = slowMo;
    this.keepOpen = keepOpen;
  }

  async init(): Promise<void> {
    console.log('🦊 Launching Firefox browser...');
    this.browser = await firefox.launch({
      headless: this.headless,
      slowMo: this.slowMo,
    });
    this.page = await this.browser.newPage();
    console.log('✅ Browser ready');
  }

  async close(): Promise<void> {
    if (this.browser) {
      if (this.keepOpen) {
        console.log('⏸️  Browser staying open (press Ctrl+C to close)...');
        await new Promise(() => {}); // Keep open indefinitely
      }
      await this.browser.close();
      this.browser = null;
      this.page = null;
      console.log('🔒 Browser closed');
    }
  }

  async executeStep(step: Step): Promise<StepResult> {
    if (!this.page) {
      throw new Error('Browser not initialized. Call init() first.');
    }

    const startTime = Date.now();
    const result: StepResult = {
      step_id: step.id,
      success: false,
      duration_ms: 0,
      observations: {},
    };

    try {
      console.log(`⚡ Executing: ${step.type} ${step.selector || step.url || ''}`);

      switch (step.type) {
        case 'navigate':
          if (!step.url) throw new Error('Navigate requires url');
          await this.page.goto(step.url, { 
            waitUntil: 'load',
            timeout: 30000 
          });
          // Wait a moment for page to stabilize
          await this.page.waitForTimeout(1000);
          try {
            result.observations!.current_url = this.page.url();
            result.observations!.page_title = await this.page.title();
          } catch (e) {
            // Page might still be navigating, use basic info
            result.observations!.current_url = step.url;
            result.observations!.page_title = 'Page loading...';
          }
          break;

        case 'click':
          if (!step.selector) throw new Error('Click requires selector');
          try {
            await this.page.click(step.selector, { timeout: step.timeout || 10000 });
          } catch (e) {
            console.log('⚠️  Click failed, trying alternatives...');
            try {
              // Try force click first
              await this.page.click(step.selector, { timeout: 5000, force: true });
              console.log('✅ Force click succeeded');
            } catch (e2) {
              // Try finding by text content as fallback
              console.log('⚠️  Trying to find element by visible text...');
              const selectorText = step.selector.replace(/[.#\[\]]/g, '');
              const textSelector = `text=${selectorText}`;
              try {
                await this.page.click(textSelector, { timeout: 5000 });
                console.log('✅ Text-based click succeeded');
              } catch (e3) {
                // If it's a submit button, try pressing Enter on the last input
                if (step.selector.includes('submit') || step.selector.includes('search')) {
                  console.log('⚠️  Submit button failed, pressing Enter on search input...');
                  const inputs = await this.page.$$('input[type="text"], input[type="search"], input:not([type])');
                  if (inputs.length > 0) {
                    await inputs[inputs.length - 1].press('Enter');
                    console.log('✅ Enter key pressed');
                  } else {
                    throw e3;
                  }
                } else {
                  throw e3;
                }
              }
            }
          }
          break;

        case 'type':
          if (!step.selector || !step.text) throw new Error('Type requires selector and text');
          try {
            await this.page.fill(step.selector, step.text, { timeout: step.timeout || 10000 });
          } catch (e) {
            // Retry with force if element exists but is hidden
            console.log('⚠️  Element hidden, trying force type...');
            await this.page.click(step.selector, { timeout: step.timeout || 10000, force: true });
            await this.page.fill(step.selector, step.text, { timeout: step.timeout || 10000, force: true });
          }
          break;

        case 'scroll':
          const amount = step.amount || 500;
          await this.page.evaluate((pixels) => window.scrollBy(0, pixels), amount);
          break;

        case 'wait':
          if (!step.selector) throw new Error('Wait requires selector');
          // Wait for element to be attached (not necessarily visible)
          try {
            await this.page.waitForSelector(step.selector, { 
              timeout: step.timeout || 10000,
              state: 'attached' // Element exists in DOM, even if hidden
            });
            result.observations!.element_found = true;
          } catch (e) {
            console.log('⚠️  Exact selector failed, trying simplified versions...');
            
            // Try removing pseudo-selectors like :first-child
            const simplifiedSelector = step.selector.replace(/:(first|last|nth)-child(\(\d+\))?/g, '');
            if (simplifiedSelector !== step.selector) {
              try {
                await this.page.waitForSelector(simplifiedSelector, { 
                  timeout: 5000,
                  state: 'attached'
                });
                console.log('✅ Simplified selector worked');
                result.observations!.element_found = true;
                break;
              } catch (e2) {
                // Continue to next fallback
              }
            }
            
            // Try just the first class or ID
            const firstPart = step.selector.split(/[\s>+~]/)[0];
            if (firstPart && firstPart !== step.selector) {
              try {
                await this.page.waitForSelector(firstPart, { 
                  timeout: 5000,
                  state: 'attached'
                });
                console.log('✅ Base selector worked');
                result.observations!.element_found = true;
                break;
              } catch (e3) {
                // All fallbacks failed
              }
            }
            
            throw e; // Re-throw original error if all fallbacks fail
          }
          break;

        case 'extract_text':
          if (!step.selector) throw new Error('Extract text requires selector');
          const text = await this.page.textContent(step.selector);
          result.observations!.extracted_text = text || '';
          break;

        case 'press_enter':
          if (!step.selector) throw new Error('Press Enter requires selector');
          await this.page.press(step.selector, 'Enter', { timeout: step.timeout || 10000 });
          break;

        default:
          throw new Error(`Unknown step type: ${step.type}`);
      }

      result.success = true;
      console.log(`✅ Success: ${step.type}`);
    } catch (error) {
      result.success = false;
      result.error = error instanceof Error ? error.message : String(error);
      console.log(`❌ Failed: ${step.type} - ${result.error}`);

      // Screenshot on error
      try {
        const screenshot = await this.page.screenshot({ type: 'png' });
        result.screenshot = screenshot.toString('base64');
      } catch (screenshotError) {
        console.log('⚠️  Could not capture screenshot');
      }
    }

    result.duration_ms = Date.now() - startTime;
    return result;
  }

  async getCurrentState(): Promise<{
    url: string;
    title: string;
  }> {
    if (!this.page) {
      return { url: '', title: '' };
    }

    return {
      url: this.page.url(),
      title: await this.page.title(),
    };
  }
}
