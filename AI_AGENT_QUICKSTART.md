# 🚀 AI Agent Quick Start Guide

Get started with automated test error fixing in 5 minutes!

## ⚡ Quick Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Choose Your AI Provider

#### Option A: OpenAI (Recommended for automation)

```bash
# Get API key from https://platform.openai.com/api-keys
echo "AI_PROVIDER=openai" > .env
echo "AI_API_KEY=sk-your-key-here" >> .env
echo "AI_MODEL=gpt-4" >> .env
```

#### Option B: Anthropic Claude

```bash
# Get API key from https://console.anthropic.com/
echo "AI_PROVIDER=anthropic" > .env
echo "AI_API_KEY=sk-ant-your-key-here" >> .env
echo "AI_MODEL=claude-3-5-sonnet-20241022" >> .env
```

#### Option C: Windsurf IDE (No API key needed)

```bash
echo "AI_PROVIDER=windsurf" > .env
```

### 3. Add GitHub Token (Optional, for PR creation)

```bash
# Get token from https://github.com/settings/tokens
# Required scopes: repo, workflow
echo "GITHUB_TOKEN=ghp_your-token-here" >> .env
```

## 🎯 Usage

### Basic Usage

```bash
# Run tests (they may fail)
npm test

# Let AI fix the errors
npm run ai-agent
```

That's it! The AI will:
1. ✅ Analyze test failures
2. ✅ Apply fixes automatically
3. ✅ Verify the fixes work
4. ✅ Generate a report
5. ✅ Create a GitHub PR

### Preview Changes First (Dry Run)

```bash
npm run ai-agent:dry-run
```

### Fix Without Creating PR

```bash
npm run ai-agent:no-pr
```

### Use Windsurf IDE

```bash
npm run ai-agent:windsurf
```

Then follow the prompts to paste into Windsurf IDE.

## 📊 View Reports

After running, open the HTML report:

```bash
# Windows
start ai-agent-reports\ai-agent-report-*.html

# Mac
open ai-agent-reports/ai-agent-report-*.html

# Linux
xdg-open ai-agent-reports/ai-agent-report-*.html
```

## 🎨 Example Output

```
🤖 AI Agent Orchestrator Starting...
═══════════════════════════════════════════════════════════════
📋 Step 1: Running tests to detect failures...
🔍 Step 2: Analyzing test failures with AI...
🔍 Analyzing 2 test failure(s)...
✅ Applied fix for: search endpoint returns cruises for ALL ports
✅ Applied fix for: cruise detail returns itinerary and rom data
🧪 Step 3: Verifying fixes...
✅ All tests passed after applying fixes!
📊 Step 4: Generating comprehensive report...
✅ Report saved to: ./ai-agent-reports/ai-agent-report-2026-01-08.html
📤 Step 5: Creating GitHub Pull Request...
✅ Pull Request created: https://github.com/your-repo/pull/123
═══════════════════════════════════════════════════════════════
✅ AI Agent completed successfully in 45.3s
```

## 🔧 Common Commands

| Command | Description |
|---------|-------------|
| `npm run ai-agent` | Run with default settings |
| `npm run ai-agent:dry-run` | Preview without changes |
| `npm run ai-agent:no-pr` | Fix without PR |
| `npm run ai-agent:windsurf` | Use Windsurf IDE |
| `npm run ai-agent:init` | Create config file |

## ⚙️ Configuration

Create `ai-agent.config.js` for custom settings:

```bash
npm run ai-agent:init
```

Then edit the file:

```javascript
module.exports = {
  aiProvider: 'openai',
  minConfidence: 0.7,  // Only apply fixes with 70%+ confidence
  createPR: true,
  autoCommit: true
};
```

## 🆘 Troubleshooting

### "AI API Key not found"
```bash
# Add to .env file
echo "AI_API_KEY=your-key-here" >> .env
```

### "Tests still failing"
```bash
# Increase confidence threshold
npm run ai-agent -- --min-confidence 0.9
```

### "No test results found"
```bash
# Make sure tests run first
npm test
npm run ai-agent
```

## 📚 Next Steps

- Read [`AI_AGENT_README.md`](./AI_AGENT_README.md) for full documentation
- Check [`WINDSURF_INTEGRATION.md`](./WINDSURF_INTEGRATION.md) for Windsurf usage
- View generated reports in `ai-agent-reports/`
- Review and merge the created Pull Request

## 💡 Pro Tips

1. **Start with dry-run** to see what changes will be made
2. **Review PRs carefully** before merging
3. **Use high confidence** (0.8+) for production
4. **Keep reports** for tracking improvements
5. **Combine with CI/CD** for continuous fixing

---

**Need help?** Check the full documentation in [`AI_AGENT_README.md`](./AI_AGENT_README.md)
