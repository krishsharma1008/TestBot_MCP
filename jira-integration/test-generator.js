const fs = require('fs');
const path = require('path');

class TestGenerator {
  constructor(config) {
    this.config = config;
    this.testsDir = path.join(process.cwd(), 'tests', 'jira-generated');
    this.templateDir = path.join(process.cwd(), 'jira-integration', 'templates');
    
    if (!fs.existsSync(this.testsDir)) {
      fs.mkdirSync(this.testsDir, { recursive: true });
    }
  }

  async generateTestsFromStory(storyDetails, aiProvider = null) {
    console.log(`\n📝 Generating tests for story: ${storyDetails.key} - ${storyDetails.summary}`);
    
    const testScenarios = this.extractTestScenarios(storyDetails);
    
    if (aiProvider && this.config.useAI) {
      return await this.generateWithAI(storyDetails, testScenarios, aiProvider);
    } else {
      return this.generateFromTemplate(storyDetails, testScenarios);
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

  generateFromTemplate(storyDetails, scenarios) {
    const testCode = this.buildTestCode(storyDetails, scenarios);
    const filename = this.getTestFilename(storyDetails.key);
    const filepath = path.join(this.testsDir, filename);
    
    fs.writeFileSync(filepath, testCode, 'utf-8');
    
    console.log(`✅ Generated test file: ${filepath}`);
    
    return {
      filepath,
      testCode,
      scenarios: scenarios.length
    };
  }

  buildTestCode(storyDetails, scenarios) {
    const imports = this.determineImports(storyDetails);
    const testCases = scenarios.map((scenario, index) => 
      this.buildTestCase(scenario, index, storyDetails)
    ).join('\n\n');
    
    return `${imports}

test.describe('${storyDetails.key}: ${this.sanitizeString(storyDetails.summary)}', () => {
  // Story: ${storyDetails.summary}
  // Status: ${storyDetails.status}
  // Priority: ${storyDetails.priority}
  
${testCases}
});
`;
  }

  determineImports(storyDetails) {
    const baseImports = `const { test, expect } = require('@playwright/test');`;
    
    // Determine if authentication is needed
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

  buildTestCase(scenario, index, storyDetails) {
    const testName = scenario.description.substring(0, 80);
    const steps = this.generateTestSteps(scenario, storyDetails);
    
    return `  test('${this.sanitizeString(testName)}', async ({ page }) => {
    // Acceptance Criteria: ${this.sanitizeString(scenario.description)}
${steps}
  });`;
  }

  generateTestSteps(scenario, storyDetails) {
    const steps = [];
    
    // Given steps (setup)
    for (const given of scenario.given) {
      steps.push(this.convertToPlaywrightStep(given, 'given', storyDetails));
    }
    
    // When steps (actions)
    for (const when of scenario.when) {
      steps.push(this.convertToPlaywrightStep(when, 'when', storyDetails));
    }
    
    // Then steps (assertions)
    for (const then of scenario.then) {
      steps.push(this.convertToPlaywrightStep(then, 'then', storyDetails));
    }
    
    // If no structured steps, add placeholder
    if (steps.length === 0) {
      steps.push('    // TODO: Implement test steps for this scenario');
      steps.push('    // Navigate to the appropriate page');
      steps.push('    // await page.goto(\'/path\');');
      steps.push('    // Add your test logic here');
    }
    
    return steps.join('\n');
  }

  convertToPlaywrightStep(step, type, storyDetails) {
    const lowerStep = step.toLowerCase();
    
    // Navigation patterns
    if (lowerStep.includes('navigate') || lowerStep.includes('go to') || lowerStep.includes('visit')) {
      const pageMatch = step.match(/(?:navigate to|go to|visit)\s+(?:the\s+)?([a-z]+\s+page|\/[a-z\/]+)/i);
      if (pageMatch) {
        const page = pageMatch[1].replace(' page', '').replace(/\s+/g, '');
        return `    await page.goto('/${page}');`;
      }
      return `    // await page.goto('/path'); // ${step}`;
    }
    
    // Click patterns
    if (lowerStep.includes('click') || lowerStep.includes('press')) {
      const elementMatch = step.match(/(?:click|press)\s+(?:on\s+)?(?:the\s+)?["']?([a-z\s]+)["']?/i);
      if (elementMatch) {
        const element = elementMatch[1].trim();
        return `    await page.locator('button:has-text("${element}")').click(); // ${step}`;
      }
      return `    // await page.click('selector'); // ${step}`;
    }
    
    // Input/Fill patterns
    if (lowerStep.includes('enter') || lowerStep.includes('type') || lowerStep.includes('fill')) {
      return `    // await page.fill('input[name="field"]', 'value'); // ${step}`;
    }
    
    // Select patterns
    if (lowerStep.includes('select')) {
      return `    // await page.selectOption('select', 'option'); // ${step}`;
    }
    
    // Assertion patterns
    if (type === 'then') {
      if (lowerStep.includes('should see') || lowerStep.includes('should display')) {
        const textMatch = step.match(/should (?:see|display)\s+["']?([^"']+)["']?/i);
        if (textMatch) {
          const text = textMatch[1].trim();
          return `    await expect(page.locator('text=${text}')).toBeVisible(); // ${step}`;
        }
      }
      
      if (lowerStep.includes('should be') || lowerStep.includes('should have')) {
        return `    // await expect(page).toHaveURL(/expected/); // ${step}`;
      }
      
      return `    // Add assertion for: ${step}`;
    }
    
    return `    // ${step}`;
  }

  async generateWithAI(storyDetails, scenarios, aiProvider) {
    console.log('🤖 Using AI to generate enhanced test code...');
    
    const prompt = this.buildAIPrompt(storyDetails, scenarios);
    
    try {
      const aiResponse = await aiProvider.generateTestCode(prompt);
      const testCode = this.extractCodeFromAIResponse(aiResponse);
      
      const filename = this.getTestFilename(storyDetails.key);
      const filepath = path.join(this.testsDir, filename);
      
      fs.writeFileSync(filepath, testCode, 'utf-8');
      
      console.log(`✅ Generated AI-enhanced test file: ${filepath}`);
      
      return {
        filepath,
        testCode,
        scenarios: scenarios.length,
        aiGenerated: true
      };
    } catch (error) {
      console.warn('⚠️  AI generation failed, falling back to template:', error.message);
      return this.generateFromTemplate(storyDetails, scenarios);
    }
  }

  buildAIPrompt(storyDetails, scenarios) {
    return `Generate a Playwright test file for the following Jira user story:

Story Key: ${storyDetails.key}
Summary: ${storyDetails.summary}
Description: ${storyDetails.description}
Status: ${storyDetails.status}
Priority: ${storyDetails.priority}

Acceptance Criteria:
${storyDetails.acceptanceCriteria.map((ac, i) => `${i + 1}. ${ac}`).join('\n')}

Requirements:
1. Use Playwright test framework with JavaScript
2. Include proper imports (use '../utils/auth' if authentication is needed)
3. Create test cases for each acceptance criterion
4. Use descriptive test names
5. Add proper assertions
6. Include comments for clarity
7. Use page object patterns where appropriate
8. Handle async/await properly
9. Add appropriate waits and timeouts

Generate a complete, runnable Playwright test file.`;
  }

  extractCodeFromAIResponse(response) {
    // Extract code from markdown code blocks
    const codeBlockMatch = response.match(/```(?:javascript|js)?\n([\s\S]+?)\n```/);
    if (codeBlockMatch) {
      return codeBlockMatch[1];
    }
    return response;
  }

  getTestFilename(storyKey) {
    return `${storyKey.toLowerCase().replace(/-/g, '_')}.spec.js`;
  }

  sanitizeString(str) {
    return str.replace(/'/g, "\\'").replace(/\n/g, ' ').trim();
  }

  async updateExistingTest(storyDetails) {
    const filename = this.getTestFilename(storyDetails.key);
    const filepath = path.join(this.testsDir, filename);
    
    if (!fs.existsSync(filepath)) {
      console.log(`ℹ️  Test file doesn't exist, creating new one`);
      return await this.generateTestsFromStory(storyDetails);
    }
    
    console.log(`📝 Updating existing test file: ${filepath}`);
    
    const existingContent = fs.readFileSync(filepath, 'utf-8');
    const scenarios = this.extractTestScenarios(storyDetails);
    const newTestCode = this.buildTestCode(storyDetails, scenarios);
    
    fs.writeFileSync(filepath, newTestCode, 'utf-8');
    
    console.log(`✅ Updated test file: ${filepath}`);
    
    return {
      filepath,
      testCode: newTestCode,
      scenarios: scenarios.length,
      updated: true
    };
  }

  async deleteTest(storyKey) {
    const filename = this.getTestFilename(storyKey);
    const filepath = path.join(this.testsDir, filename);
    
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
      console.log(`🗑️  Deleted test file: ${filepath}`);
      return true;
    }
    
    return false;
  }
}

module.exports = TestGenerator;
