#!/usr/bin/env node

const AIAgentOrchestrator = require('./orchestrator');
const fs = require('fs');
const path = require('path');

async function main() {
  const configPath = path.join(process.cwd(), 'ai-agent.config.js');
  let config = {};

  if (fs.existsSync(configPath)) {
    config = require(configPath);
    console.log('✅ Loaded configuration from ai-agent.config.js');
  } else {
    console.log('ℹ️  No config file found, using environment variables and defaults');
  }

  const args = process.argv.slice(2);
  const flags = parseFlags(args);

  const finalConfig = {
    ...config,
    ...flags
  };

  if (flags.help) {
    showHelp();
    process.exit(0);
  }

  if (flags.init) {
    initializeConfig();
    process.exit(0);
  }

  const orchestrator = new AIAgentOrchestrator(finalConfig);
  
  try {
    const results = await orchestrator.run();
    
    if (results.success) {
      console.log('\n✅ AI Agent completed successfully!');
      process.exit(0);
    } else {
      console.log('\n❌ AI Agent encountered errors');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  }
}

function parseFlags(args) {
  const flags = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--dry-run':
        flags.dryRun = true;
        break;
      case '--no-pr':
        flags.createPR = false;
        break;
      case '--no-commit':
        flags.autoCommit = false;
        break;
      case '--provider':
        flags.aiProvider = args[++i];
        break;
      case '--model':
        flags.model = args[++i];
        break;
      case '--api-key':
        flags.apiKey = args[++i];
        break;
      case '--github-token':
        flags.githubToken = args[++i];
        break;
      case '--min-confidence':
        flags.minConfidence = parseFloat(args[++i]);
        break;
      case '--rollback-on-failure':
        flags.rollbackOnFailure = true;
        break;
      case '--help':
      case '-h':
        flags.help = true;
        break;
      case '--init':
        flags.init = true;
        break;
    }
  }
  
  return flags;
}

function showHelp() {
  console.log(`
🤖 AI Agent - Automated Test Error Fixing

USAGE:
  npm run ai-agent [options]

OPTIONS:
  --dry-run                  Run without making actual changes
  --no-pr                    Don't create a GitHub Pull Request
  --no-commit                Don't commit changes automatically
  --provider <name>          AI provider (openai, anthropic, windsurf)
  --model <name>             AI model to use
  --api-key <key>            AI API key
  --github-token <token>     GitHub personal access token
  --min-confidence <0-1>     Minimum confidence threshold (default: 0.7)
  --rollback-on-failure      Rollback changes if tests still fail
  --init                     Create a configuration file
  --help, -h                 Show this help message

ENVIRONMENT VARIABLES:
  AI_PROVIDER                AI provider (openai, anthropic, windsurf)
  AI_API_KEY                 API key for AI provider
  AI_MODEL                   AI model to use
  GITHUB_TOKEN               GitHub personal access token

EXAMPLES:
  # Run with OpenAI
  npm run ai-agent -- --provider openai --api-key sk-xxx

  # Run with Anthropic Claude
  npm run ai-agent -- --provider anthropic --api-key sk-ant-xxx

  # Dry run (no changes)
  npm run ai-agent -- --dry-run

  # Run without creating PR
  npm run ai-agent -- --no-pr

  # Use Windsurf IDE (manual mode)
  npm run ai-agent -- --provider windsurf

CONFIGURATION:
  Create an ai-agent.config.js file in your project root:
  
  module.exports = {
    aiProvider: 'openai',
    apiKey: process.env.AI_API_KEY,
    model: 'gpt-4',
    githubToken: process.env.GITHUB_TOKEN,
    minConfidence: 0.7,
    createPR: true,
    autoCommit: true
  };

For more information, see AI_AGENT_README.md
`);
}

function initializeConfig() {
  const configContent = `module.exports = {
  // AI Provider: 'openai', 'anthropic', or 'windsurf'
  aiProvider: process.env.AI_PROVIDER || 'openai',
  
  // API Key for AI provider
  apiKey: process.env.AI_API_KEY,
  
  // AI Model to use
  model: process.env.AI_MODEL || 'gpt-4',
  
  // GitHub Personal Access Token
  githubToken: process.env.GITHUB_TOKEN,
  
  // Minimum confidence threshold for applying fixes (0-1)
  minConfidence: 0.7,
  
  // Automatically create Pull Request
  createPR: true,
  
  // Automatically commit changes
  autoCommit: true,
  
  // Base branch for PRs
  baseBranch: 'main',
  
  // Branch prefix for AI fixes
  branchPrefix: 'ai-fix',
  
  // Rollback changes if tests still fail
  rollbackOnFailure: false,
  
  // Report directory
  reportDir: './ai-agent-reports'
};
`;

  const configPath = path.join(process.cwd(), 'ai-agent.config.js');
  
  if (fs.existsSync(configPath)) {
    console.log('⚠️  Configuration file already exists at ai-agent.config.js');
    return;
  }
  
  fs.writeFileSync(configPath, configContent, 'utf-8');
  console.log('✅ Created ai-agent.config.js');
  console.log('\nNext steps:');
  console.log('1. Edit ai-agent.config.js with your settings');
  console.log('2. Set environment variables (AI_API_KEY, GITHUB_TOKEN)');
  console.log('3. Run: npm run ai-agent');
}

if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = AIAgentOrchestrator;
