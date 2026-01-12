const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

class PlaywrightMCPGenerator {
  constructor(config) {
    this.config = config;
    this.baseURL = config.baseURL || process.env.BASE_URL || 'http://localhost:8000';
    this.browser = null;
    this.context = null;
    this.page = null;
  }

  async initialize() {
    if (!this.browser) {
      console.log('🎭 Initializing Playwright browser for test generation...');
      this.browser = await chromium.launch({
        headless: this.config.headless !== false,
        timeout: 30000
      });
      this.context = await this.browser.newContext({
        viewport: { width: 1280, height: 720 },
        recordVideo: this.config.recordVideo ? { dir: 'test-generation-videos' } : undefined
      });
      this.page = await this.context.newPage();
    }
  }

  async cleanup() {
    if (this.page) await this.page.close();
    if (this.context) await this.context.close();
    if (this.browser) await this.browser.close();
    this.browser = null;
    this.context = null;
    this.page = null;
  }

  async generateTestsFromStory(storyDetails) {
    console.log(`\n🤖 Generating tests with Playwright MCP for: ${storyDetails.key}`);
    
    try {
      await this.initialize();
      
      const scenarios = this.extractTestScenarios(storyDetails);
      const testCode = await this.buildExecutableTestCode(storyDetails, scenarios);
      
      const filename = this.getTestFilename(storyDetails.key);
      const testsDir = path.join(process.cwd(), 'tests', 'jira-generated');
      
      if (!fs.existsSync(testsDir)) {
        fs.mkdirSync(testsDir, { recursive: true });
      }
      
      const filepath = path.join(testsDir, filename);
      fs.writeFileSync(filepath, testCode, 'utf-8');
      
      console.log(`✅ Generated executable test file: ${filepath}`);
      
      return {
        filepath,
        testCode,
        scenarios: scenarios.length,
        mcpGenerated: true
      };
    } catch (error) {
      console.error(`❌ MCP generation failed: ${error.message}`);
      throw error;
    }
  }

  extractTestScenarios(storyDetails) {
    const scenarios = [];
    
    for (const criterion of storyDetails.acceptanceCriteria) {
      const scenario = this.parseGherkinStyle(criterion);
      if (scenario) {
        scenarios.push(scenario);
      } else {
        scenarios.push({
          description: criterion,
          given: [],
          when: [],
          then: []
        });
      }
    }
    
    return scenarios;
  }

  parseGherkinStyle(criterion) {
    const gherkinPattern = /(Given|When|Then|And)\s+(.+)/gi;
    const matches = [...criterion.matchAll(gherkinPattern)];
    
    if (matches.length === 0) return null;
    
    const scenario = {
      description: criterion,
      given: [],
      when: [],
      then: []
    };
    
    let currentType = null;
    
    for (const match of matches) {
      const keyword = match[1].toLowerCase();
      const step = match[2].trim();
      
      if (keyword === 'given') {
        currentType = 'given';
        scenario.given.push(step);
      } else if (keyword === 'when') {
        currentType = 'when';
        scenario.when.push(step);
      } else if (keyword === 'then') {
        currentType = 'then';
        scenario.then.push(step);
      } else if (keyword === 'and' && currentType) {
        scenario[currentType].push(step);
      }
    }
    
    return scenario;
  }

  async buildExecutableTestCode(storyDetails, scenarios) {
    const imports = this.determineImports(storyDetails);
    const testCases = [];
    
    for (let i = 0; i < scenarios.length; i++) {
      const scenario = scenarios[i];
      const testCase = await this.buildExecutableTestCase(scenario, i, storyDetails);
      testCases.push(testCase);
    }
    
    return `${imports}

test.describe('${storyDetails.key}: ${this.sanitizeString(storyDetails.summary)}', () => {
  // Story: ${storyDetails.summary}
  // Status: ${storyDetails.status}
  // Priority: ${storyDetails.priority}
  // Generated with Playwright MCP
  
${testCases.join('\n\n')}
});
`;
  }

  determineImports(storyDetails) {
    const baseImports = `const { test, expect } = require('@playwright/test');`;
    
    const needsAuth = storyDetails.summary.toLowerCase().includes('login') ||
                      storyDetails.summary.toLowerCase().includes('authenticated') ||
                      storyDetails.acceptanceCriteria.some(ac => 
                        ac.toLowerCase().includes('logged in') || 
                        ac.toLowerCase().includes('authenticated')
                      );
    
    if (needsAuth) {
      return `${baseImports}
const { loginViaUI, ensureLoggedOut } = require('../utils/auth');`;
    }
    
    return baseImports;
  }

  async buildExecutableTestCase(scenario, index, storyDetails) {
    const testName = scenario.description.substring(0, 80);
    const steps = await this.generateExecutableSteps(scenario, storyDetails);
    
    return `  test('${this.sanitizeString(testName)}', async ({ page }) => {
    // Acceptance Criteria: ${this.sanitizeString(scenario.description)}
${steps}
  });`;
  }

  async generateExecutableSteps(scenario, storyDetails) {
    const steps = [];
    const pageUrl = this.inferPageUrl(scenario, storyDetails);
    
    // Add navigation if we can infer the page
    if (pageUrl) {
      steps.push(`    await page.goto('${pageUrl}');`);
      steps.push(`    await page.waitForLoadState('networkidle');`);
      steps.push('');
      
      // Try to discover elements on the page
      try {
        await this.page.goto(`${this.baseURL}${pageUrl}`, { 
          waitUntil: 'networkidle',
          timeout: 10000 
        });
        
        // Generate steps based on discovered elements
        const discoveredSteps = await this.discoverAndGenerateSteps(scenario, storyDetails);
        steps.push(...discoveredSteps);
      } catch (error) {
        console.warn(`⚠️  Could not navigate to ${pageUrl}: ${error.message}`);
        // Fallback to pattern-based generation
        steps.push(...this.generateFallbackSteps(scenario));
      }
    } else {
      // No page URL inferred, use pattern-based generation
      steps.push(...this.generateFallbackSteps(scenario));
    }
    
    return steps.join('\n');
  }

  async discoverAndGenerateSteps(scenario, storyDetails) {
    const steps = [];
    
    // Process Given steps (setup/navigation)
    for (const given of scenario.given) {
      const step = await this.convertToExecutableStep(given, 'given', storyDetails);
      if (step) steps.push(step);
    }
    
    // Process When steps (actions)
    for (const when of scenario.when) {
      const step = await this.convertToExecutableStep(when, 'when', storyDetails);
      if (step) steps.push(step);
    }
    
    // Process Then steps (assertions)
    for (const then of scenario.then) {
      const step = await this.convertToExecutableStep(then, 'then', storyDetails);
      if (step) steps.push(step);
    }
    
    return steps;
  }

  async convertToExecutableStep(stepText, type, storyDetails) {
    const lowerStep = stepText.toLowerCase();
    
    // Click patterns - try to find the actual element
    if (lowerStep.includes('click') || lowerStep.includes('press')) {
      const buttonText = this.extractQuotedText(stepText) || this.extractButtonText(stepText);
      if (buttonText) {
        // Try to find the button on the page
        try {
          const selector = await this.findBestSelector(buttonText, 'button');
          if (selector) {
            return `    await page.locator('${selector}').click();`;
          }
        } catch (error) {
          // Fallback to text-based selector
        }
        return `    await page.getByRole('button', { name: /${buttonText}/i }).click();`;
      }
      return `    // await page.click('selector'); // ${stepText}`;
    }
    
    // Input/Fill patterns - discover actual input fields
    if (lowerStep.includes('enter') || lowerStep.includes('type') || lowerStep.includes('fill')) {
      const fieldName = this.extractFieldName(stepText);
      if (fieldName) {
        try {
          const selector = await this.findInputSelector(fieldName);
          if (selector) {
            return `    await page.locator('${selector}').fill('test value');`;
          }
        } catch (error) {
          // Fallback
        }
        return `    await page.getByLabel(/${fieldName}/i).fill('test value');`;
      }
      return `    // await page.fill('input[name="field"]', 'value'); // ${stepText}`;
    }
    
    // Select patterns
    if (lowerStep.includes('select')) {
      const optionText = this.extractQuotedText(stepText);
      if (optionText) {
        return `    await page.selectOption('select', '${optionText}');`;
      }
      return `    // await page.selectOption('select', 'option'); // ${stepText}`;
    }
    
    // Assertion patterns - discover actual elements
    if (type === 'then') {
      if (lowerStep.includes('should see') || lowerStep.includes('should display') || lowerStep.includes('should have')) {
        const expectedText = this.extractExpectedText(stepText);
        if (expectedText) {
          // Try to find the element with this text
          try {
            const exists = await this.page.locator(`text=${expectedText}`).count() > 0;
            if (exists) {
              return `    await expect(page.locator('text=${expectedText}')).toBeVisible();`;
            }
          } catch (error) {
            // Element not found, generate flexible assertion
          }
          
          // Check if it's about a form field
          if (lowerStep.includes('input') || lowerStep.includes('field') || lowerStep.includes('textarea')) {
            const fieldType = this.extractFieldType(stepText);
            if (fieldType) {
              return `    await expect(page.locator('${fieldType}')).toBeVisible();`;
            }
          }
          
          return `    await expect(page.getByText(/${expectedText}/i)).toBeVisible();`;
        }
      }
      
      if (lowerStep.includes('should be') && lowerStep.includes('url')) {
        return `    await expect(page).toHaveURL(/expected/);`;
      }
      
      return `    // Add assertion for: ${stepText}`;
    }
    
    return `    // ${stepText}`;
  }

  async findBestSelector(text, role = null) {
    try {
      // Try different selector strategies
      const strategies = [
        `button:has-text("${text}")`,
        `[aria-label="${text}"]`,
        `[title="${text}"]`,
        `text=${text}`
      ];
      
      for (const selector of strategies) {
        const count = await this.page.locator(selector).count();
        if (count > 0) {
          return selector;
        }
      }
    } catch (error) {
      // Selector not found
    }
    return null;
  }

  async findInputSelector(fieldName) {
    try {
      const strategies = [
        `input[name="${fieldName}"]`,
        `input[id="${fieldName}"]`,
        `input[placeholder*="${fieldName}"]`,
        `textarea[name="${fieldName}"]`
      ];
      
      for (const selector of strategies) {
        const count = await this.page.locator(selector).count();
        if (count > 0) {
          return selector;
        }
      }
    } catch (error) {
      // Selector not found
    }
    return null;
  }

  generateFallbackSteps(scenario) {
    const steps = [];
    
    for (const given of scenario.given) {
      steps.push(`    // ${given}`);
    }
    
    for (const when of scenario.when) {
      steps.push(`    // ${when}`);
    }
    
    for (const then of scenario.then) {
      steps.push(`    // ${then}`);
    }
    
    if (steps.length === 0) {
      steps.push('    // TODO: Implement test steps for this scenario');
    }
    
    return steps;
  }

  inferPageUrl(scenario, storyDetails) {
    const text = `${storyDetails.summary} ${scenario.description}`.toLowerCase();
    
    // Map common page names to URLs
    const pageMap = {
      'contact': '/contact',
      'cruise': '/cruises',
      'cruises': '/cruises',
      'home': '/',
      'index': '/',
      'login': '/login',
      'register': '/register',
      'signup': '/register',
      'about': '/about',
      'booking': '/booking',
      'book': '/booking'
    };
    
    for (const [keyword, url] of Object.entries(pageMap)) {
      if (text.includes(keyword)) {
        return url;
      }
    }
    
    return null;
  }

  extractQuotedText(text) {
    const match = text.match(/["']([^"']+)["']/);
    return match ? match[1] : null;
  }

  extractButtonText(text) {
    const patterns = [
      /(?:click|press)\s+(?:on\s+)?(?:the\s+)?["']?([a-z\s]+)["']?\s+button/i,
      /(?:click|press)\s+(?:on\s+)?(?:the\s+)?["']?([a-z\s]+)["']?/i
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match[1].trim();
    }
    
    return null;
  }

  extractFieldName(text) {
    const patterns = [
      /(?:enter|type|fill)\s+(?:in\s+)?(?:the\s+)?["']?([a-z\s]+)["']?\s+(?:field|input)/i,
      /(?:field|input)\s+(?:for\s+)?["']?([a-z\s]+)["']?/i
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match[1].trim();
    }
    
    return null;
  }

  extractExpectedText(text) {
    const patterns = [
      /should (?:see|display|have)\s+["']?([^"']+)["']?/i,
      /should (?:see|display|have)\s+(?:a|an|the)\s+([a-z\s]+)/i
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match[1].trim();
    }
    
    return null;
  }

  extractFieldType(text) {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('email')) return 'input[type="email"]';
    if (lowerText.includes('password')) return 'input[type="password"]';
    if (lowerText.includes('name')) return 'input[name*="name"]';
    if (lowerText.includes('message') || lowerText.includes('textarea')) return 'textarea';
    if (lowerText.includes('submit')) return 'button[type="submit"]';
    
    return 'input';
  }

  getTestFilename(storyKey) {
    return `${storyKey.toLowerCase().replace(/-/g, '_')}.spec.js`;
  }

  sanitizeString(str) {
    return str.replace(/'/g, "\\'").replace(/\n/g, ' ').trim();
  }
}

module.exports = PlaywrightMCPGenerator;
