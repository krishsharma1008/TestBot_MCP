# 🤖 AI Agent - Automated Test Error Fixing System

An intelligent system that automatically detects test failures, analyzes them using AI, applies fixes, and creates GitHub Pull Requests without manual intervention.

## 🌟 Features

- **Automatic Error Detection**: Captures test failures from Playwright test runs
- **AI-Powered Analysis**: Uses OpenAI, Anthropic Claude, or Windsurf IDE to analyze errors
- **Intelligent Code Fixing**: Automatically applies suggested fixes to your codebase
- **GitHub Integration**: Creates Pull Requests with detailed reports
- **Comprehensive Reporting**: Generates beautiful HTML and JSON reports
- **Safety Features**: Backup creation, dry-run mode, rollback capability
- **Multiple AI Providers**: Support for OpenAI, Anthropic, and Windsurf IDE

## 📋 Table of Contents

- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [AI Providers](#ai-providers)
- [Workflow](#workflow)
- [Command Line Options](#command-line-options)
- [Reports](#reports)
- [Troubleshooting](#troubleshooting)

## 🚀 Installation

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and add your API keys:

```env
AI_PROVIDER=openai
AI_API_KEY=your_openai_api_key_here
AI_MODEL=gpt-4
GITHUB_TOKEN=your_github_token_here
```

### 3. Initialize Configuration (Optional)

```bash
npm run ai-agent:init
```

This creates an `ai-agent.config.js` file that you can customize.

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `AI_PROVIDER` | AI provider: `openai`, `anthropic`, or `windsurf` | Yes |
| `AI_API_KEY` | API key for your AI provider | Yes (except windsurf) |
| `AI_MODEL` | Specific model to use | No |
| `GITHUB_TOKEN` | GitHub Personal Access Token | No (for PR creation) |

### Configuration File

Create or edit `ai-agent.config.js`:

```javascript
module.exports = {
  // AI Provider
  aiProvider: 'openai',
  apiKey: process.env.AI_API_KEY,
  model: 'gpt-4',
  
  // GitHub Settings
  githubToken: process.env.GITHUB_TOKEN,
  baseBranch: 'main',
  branchPrefix: 'ai-fix',
  
  // Behavior
  minConfidence: 0.7,        // Only apply fixes with 70%+ confidence
  createPR: true,            // Automatically create PRs
  autoCommit: true,          // Automatically commit changes
  rollbackOnFailure: false,  // Rollback if tests still fail
  
  // Output
  reportDir: './ai-agent-reports'
};
```

## 📖 Usage

### Basic Usage

Run the AI agent after tests fail:

```bash
npm run ai-agent
```

### Common Workflows

#### 1. Test, Analyze, and Fix Automatically

```bash
# Run tests (they may fail)
npm test

# Let AI agent analyze and fix
npm run ai-agent
```

#### 2. Dry Run (Preview Changes)

```bash
npm run ai-agent:dry-run
```

This shows what changes would be made without actually applying them.

#### 3. Fix Without Creating PR

```bash
npm run ai-agent:no-pr
```

Applies fixes but doesn't create a GitHub Pull Request.

#### 4. Use Windsurf IDE Integration

```bash
npm run ai-agent:windsurf
```

This mode outputs prompts that you can paste into Windsurf IDE for analysis.

## 🤖 AI Providers

### OpenAI (GPT-4)

**Setup:**
1. Get API key from https://platform.openai.com/api-keys
2. Set environment variables:
   ```bash
   AI_PROVIDER=openai
   AI_API_KEY=sk-...
   AI_MODEL=gpt-4
   ```

**Recommended Models:**
- `gpt-4` - Best quality, slower
- `gpt-4-turbo-preview` - Fast and capable
- `gpt-3.5-turbo` - Fastest, lower cost

### Anthropic (Claude)

**Setup:**
1. Get API key from https://console.anthropic.com/
2. Set environment variables:
   ```bash
   AI_PROVIDER=anthropic
   AI_API_KEY=sk-ant-...
   AI_MODEL=claude-3-5-sonnet-20241022
   ```

**Recommended Models:**
- `claude-3-5-sonnet-20241022` - Best balance
- `claude-3-opus-20240229` - Highest quality

### Windsurf IDE

**Setup:**
1. No API key needed
2. Set environment variable:
   ```bash
   AI_PROVIDER=windsurf
   ```

**How it works:**
1. AI agent generates analysis prompts
2. Copy prompts into Windsurf IDE
3. Paste AI responses back
4. Agent applies fixes

## 🔄 Workflow

The AI Agent follows this automated workflow:

```
1. Run Tests
   ↓
2. Detect Failures
   ↓
3. Extract Error Context
   ↓
4. AI Analysis
   ↓
5. Generate Fixes
   ↓
6. Apply Changes (with backup)
   ↓
7. Verify Fixes
   ↓
8. Generate Report
   ↓
9. Create GitHub PR
```

### Detailed Steps

#### Step 1: Test Execution
- Runs `npm test` to execute Playwright tests
- Captures test results in JSON format

#### Step 2: Error Detection
- Parses test results
- Extracts failed tests with error details
- Gathers code context around failures

#### Step 3: AI Analysis
- Sends error context to AI provider
- Receives detailed analysis and fix suggestions
- Evaluates confidence scores

#### Step 4: Fix Application
- Creates backups of files
- Applies code changes
- Only applies fixes with confidence ≥ threshold

#### Step 5: Verification
- Runs tests again
- Checks if fixes resolved issues
- Optional rollback if tests still fail

#### Step 6: Reporting
- Generates HTML and JSON reports
- Includes analysis, fixes, and results
- Saves to `ai-agent-reports/`

#### Step 7: PR Creation
- Creates new branch
- Commits changes
- Pushes to GitHub
- Creates Pull Request with detailed description

## 🎛️ Command Line Options

```bash
npm run ai-agent -- [options]
```

| Option | Description |
|--------|-------------|
| `--dry-run` | Preview changes without applying |
| `--no-pr` | Don't create GitHub PR |
| `--no-commit` | Don't commit changes |
| `--provider <name>` | AI provider (openai/anthropic/windsurf) |
| `--model <name>` | Specific AI model |
| `--api-key <key>` | AI API key |
| `--github-token <token>` | GitHub token |
| `--min-confidence <0-1>` | Minimum confidence threshold |
| `--rollback-on-failure` | Rollback if tests fail |
| `--init` | Create config file |
| `--help` | Show help |

### Examples

```bash
# Use specific provider and model
npm run ai-agent -- --provider openai --model gpt-4

# Higher confidence threshold
npm run ai-agent -- --min-confidence 0.9

# Rollback on failure
npm run ai-agent -- --rollback-on-failure

# Dry run with no PR
npm run ai-agent -- --dry-run --no-pr
```

## 📊 Reports

### Report Locations

Reports are saved to `ai-agent-reports/`:

```
ai-agent-reports/
├── ai-agent-report-2026-01-08T10-30-00.json
├── ai-agent-report-2026-01-08T10-30-00.html
└── latest-report.json
```

### HTML Report

Beautiful, interactive HTML report with:
- Summary statistics
- Detailed failure analysis
- Applied fixes
- Verification results
- Confidence scores

### JSON Report

Machine-readable report containing:
```json
{
  "metadata": {
    "timestamp": "2026-01-08T10:30:00.000Z",
    "aiProvider": "openai",
    "model": "gpt-4"
  },
  "summary": {
    "totalFailures": 3,
    "fixesApplied": 2,
    "successRate": "66.7%"
  },
  "failures": [...],
  "analyses": [...],
  "fixes": [...]
}
```

## 🔧 Troubleshooting

### Common Issues

#### 1. "AI API Key not found"

**Solution:**
```bash
# Set in .env file
AI_API_KEY=your_key_here

# Or pass via command line
npm run ai-agent -- --api-key your_key_here
```

#### 2. "GitHub token not found"

**Solution:**
- Get token from https://github.com/settings/tokens
- Required scopes: `repo`, `workflow`
- Set `GITHUB_TOKEN` in `.env`

#### 3. "Tests still failing after fixes"

**Possible causes:**
- Low confidence fixes applied
- Complex issues requiring manual intervention
- Incorrect error analysis

**Solutions:**
- Increase `minConfidence` threshold
- Use `--rollback-on-failure` flag
- Review AI analysis in reports
- Apply fixes manually

#### 4. "No test results found"

**Solution:**
- Ensure Playwright is configured to output JSON
- Check `playwright.config.js` has JSON reporter
- Verify `test-results.json` is created

#### 5. "Failed to create PR"

**Possible causes:**
- Invalid GitHub token
- No changes to commit
- Branch already exists

**Solutions:**
- Verify GitHub token has correct permissions
- Check if fixes were actually applied
- Delete existing branch or use different prefix

### Debug Mode

For detailed logging:

```bash
# Set environment variable
DEBUG=ai-agent:* npm run ai-agent
```

## 🛡️ Safety Features

### Automatic Backups

Before applying any fix, the system creates backups:
```
original-file.js
original-file.js.backup.1704700800000
```

### Rollback Capability

If tests fail after fixes:
```bash
npm run ai-agent -- --rollback-on-failure
```

### Dry Run Mode

Preview all changes without applying:
```bash
npm run ai-agent:dry-run
```

### Confidence Thresholds

Only apply fixes meeting confidence threshold:
```javascript
// In config
minConfidence: 0.7  // 70% or higher
```

## 🔐 Security Best Practices

1. **Never commit API keys** - Use `.env` file (already in `.gitignore`)
2. **Limit GitHub token scope** - Only `repo` and `workflow`
3. **Review PRs before merging** - AI fixes should be reviewed
4. **Use dry-run first** - Test on non-critical branches
5. **Keep backups** - Don't delete `.backup` files immediately

## 📈 Integration with CI/CD

### GitHub Actions Example

```yaml
name: AI Agent Auto-Fix

on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM
  workflow_dispatch:

jobs:
  auto-fix:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install
      
      - name: Run AI Agent
        env:
          AI_PROVIDER: openai
          AI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: npm run ai-agent
```

## 🤝 Contributing

To extend the AI Agent:

1. **Add new AI provider**: Edit `ai-agent/error-analyzer.js`
2. **Custom fix strategies**: Modify `ai-agent/code-fixer.js`
3. **Enhanced reporting**: Update `ai-agent/orchestrator.js`

## 📝 License

Same as parent project.

## 🆘 Support

For issues or questions:
1. Check this documentation
2. Review generated reports in `ai-agent-reports/`
3. Open an issue on GitHub
4. Check Playwright test configuration

## 🎯 Best Practices

1. **Start with dry-run** - Always test with `--dry-run` first
2. **Review AI suggestions** - Don't blindly merge PRs
3. **Incremental fixes** - Fix one issue at a time initially
4. **Monitor confidence** - Track which confidence levels work best
5. **Keep reports** - Archive reports for analysis
6. **Update regularly** - Keep AI models and dependencies updated

---

**Happy automated fixing! 🚀**
