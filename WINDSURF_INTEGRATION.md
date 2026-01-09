# 🌊 Windsurf IDE Integration Guide

This guide explains how to use the AI Agent system with Windsurf IDE for manual AI-assisted error fixing.

## 🎯 Overview

Windsurf IDE integration allows you to:
1. Automatically detect and extract test failures
2. Generate detailed analysis prompts
3. Paste prompts into Windsurf IDE
4. Get AI-powered fix suggestions
5. Automatically apply fixes and create PRs

## 🚀 Quick Start

### 1. Run AI Agent in Windsurf Mode

```bash
npm run ai-agent:windsurf
```

### 2. Follow the Interactive Workflow

The system will:
1. Run your tests
2. Detect failures
3. Generate analysis prompts
4. Wait for your input

### 3. Use Windsurf IDE

1. **Copy the generated prompt** from the terminal
2. **Open Windsurf IDE**
3. **Paste the prompt** into the AI chat
4. **Copy the AI response** (must be valid JSON)
5. **Paste back** into the terminal

### 4. Automatic Fix Application

The system will:
- Parse the AI response
- Apply suggested fixes
- Verify the fixes
- Generate reports
- Create a GitHub PR

## 📋 Detailed Workflow

### Step 1: Test Execution

```bash
npm run ai-agent:windsurf
```

Output:
```
🤖 AI Agent Orchestrator Starting...
═══════════════════════════════════════════════════════════════
📋 Step 1: Running tests to detect failures...
```

### Step 2: Error Detection

If tests fail, you'll see:
```
🔍 Step 2: Analyzing test failures with AI...
🔍 Analyzing 2 test failure(s)...
```

### Step 3: Prompt Generation

The system generates a detailed prompt:

```
📝 AI Analysis Prompt Generated:
────────────────────────────────────────────────────────────────
You are an expert software engineer analyzing a test failure...

**Test Information:**
- Test Name: search endpoint returns cruises for ALL ports
- File: tests/backend/api.spec.js
- Error Line: 9

**Error Message:**
404 Not Found

**Code Context:**
...

Please provide your response in the following JSON format:
{
  "analysis": "...",
  "rootCause": "...",
  "fix": {...}
}
────────────────────────────────────────────────────────────────
```

### Step 4: Windsurf IDE Interaction

1. **Select and copy** the entire prompt (from "You are an expert..." to the end)

2. **Open Windsurf IDE** and start a new chat

3. **Paste the prompt** and wait for the AI response

4. **Copy the JSON response** - it should look like:

```json
{
  "analysis": "The test is failing because the endpoint URL has a typo...",
  "rootCause": "Typo in endpoint URL: '/cuirses/search' should be '/cruises/search'",
  "fix": {
    "description": "Fix the typo in the endpoint URL",
    "changes": [
      {
        "file": "tests/backend/api.spec.js",
        "action": "replace",
        "lineStart": 9,
        "lineEnd": 9,
        "oldCode": "const response = await request.post('/cuirses/search', {",
        "newCode": "const response = await request.post('/cruises/search', {"
      }
    ]
  },
  "confidence": 0.95,
  "affectedFiles": ["tests/backend/api.spec.js"],
  "testingRecommendations": "Run the test suite to verify the fix"
}
```

### Step 5: Paste Response

Back in the terminal:

```
⚠️  Windsurf IDE Integration:
Please copy the above prompt and paste it into Windsurf IDE.
The AI will analyze the error and suggest fixes.

Waiting for manual input of AI response...

Paste the AI response JSON (press Ctrl+D or Ctrl+Z when done):
```

**Paste the JSON** and press:
- **Windows**: `Ctrl+Z` then `Enter`
- **Mac/Linux**: `Ctrl+D`

### Step 6: Automatic Processing

The system will:
```
✅ Applied fix for: search endpoint returns cruises for ALL ports

🧪 Step 4: Verifying fixes...
✅ All tests passed after applying fixes!

📊 Step 5: Generating comprehensive report...
✅ JSON report saved: ./ai-agent-reports/ai-agent-report-...json
✅ HTML report saved: ./ai-agent-reports/ai-agent-report-...html

📤 Step 6: Creating GitHub Pull Request...
✅ Created branch: ai-fix-1704700800000
✅ Changes committed
✅ Pushed branch: ai-fix-1704700800000
✅ Pull Request created: https://github.com/.../pull/123
```

## 🎨 Windsurf IDE Tips

### Getting Better Responses

1. **Be specific in prompts** - The generated prompts are detailed, don't modify them
2. **Request JSON format** - Always ensure Windsurf returns valid JSON
3. **Include context** - The prompts include full file context for better analysis
4. **Ask for confidence** - Responses include confidence scores

### Example Windsurf Conversation

**You (paste the prompt):**
```
You are an expert software engineer analyzing a test failure...
[full prompt]
```

**Windsurf AI:**
```json
{
  "analysis": "The test is failing due to a typo in the API endpoint URL. The endpoint '/cuirses/search' should be '/cruises/search'. This is causing a 404 Not Found error.",
  "rootCause": "Typo in endpoint URL at line 9 of tests/backend/api.spec.js",
  "fix": {
    "description": "Correct the typo in the endpoint URL from '/cuirses/search' to '/cruises/search'",
    "changes": [
      {
        "file": "tests/backend/api.spec.js",
        "action": "replace",
        "lineStart": 9,
        "lineEnd": 9,
        "oldCode": "  const response = await request.post('/cuirses/search', {",
        "newCode": "  const response = await request.post('/cruises/search', {"
      }
    ]
  },
  "confidence": 0.98,
  "affectedFiles": ["tests/backend/api.spec.js"],
  "testingRecommendations": "Run the full test suite with 'npm test' to ensure the endpoint is now accessible and returns the expected cruise data."
}
```

## 🔧 Troubleshooting

### Issue: "Failed to parse JSON input"

**Cause:** Invalid JSON format from Windsurf

**Solution:**
1. Ensure you copied the complete JSON response
2. Check for missing braces or quotes
3. Use a JSON validator before pasting
4. Ask Windsurf to "provide valid JSON only"

### Issue: "No response received"

**Cause:** Didn't press Ctrl+D/Ctrl+Z after pasting

**Solution:**
- Windows: Press `Ctrl+Z` then `Enter`
- Mac/Linux: Press `Ctrl+D`

### Issue: "Low confidence fixes skipped"

**Cause:** AI confidence below threshold (default 0.7)

**Solution:**
1. Review the analysis in the report
2. Lower threshold: `--min-confidence 0.5`
3. Apply fixes manually based on suggestions

## 🎯 Best Practices

### 1. Review Before Applying

Always review the AI's suggested fixes in Windsurf before pasting back.

### 2. Iterative Fixing

Fix one error at a time:
```bash
# Fix first error
npm run ai-agent:windsurf

# Run tests again
npm test

# Fix next error
npm run ai-agent:windsurf
```

### 3. Save Conversations

Keep Windsurf IDE conversations for reference:
- Document complex fixes
- Learn from AI reasoning
- Improve future prompts

### 4. Combine with Dry Run

Test the process first:
```bash
npm run ai-agent -- --provider windsurf --dry-run
```

## 🔄 Comparison with Automated Modes

| Feature | Windsurf Mode | OpenAI/Anthropic |
|---------|---------------|------------------|
| API Key Required | ❌ No | ✅ Yes |
| Cost | Free (IDE included) | Pay per API call |
| Speed | Manual (slower) | Automatic (faster) |
| Control | Full review | Automated |
| Learning | See AI reasoning | Black box |
| Best For | Learning, complex issues | CI/CD, bulk fixes |

## 💡 Advanced Usage

### Multiple Errors

For multiple test failures, the system will:
1. Generate prompts for each failure
2. Wait for responses one at a time
3. Apply all fixes together
4. Create a single PR with all changes

### Custom Analysis

You can modify the AI response before pasting:
- Adjust confidence scores
- Modify fix suggestions
- Add additional changes
- Change affected files

### Integration with Windsurf Features

Use Windsurf IDE features:
- **Code context**: Windsurf can access your full codebase
- **Multi-file fixes**: Ask for changes across multiple files
- **Refactoring**: Request broader refactoring suggestions
- **Documentation**: Generate comments and docs

## 📚 Example Session

Complete example of fixing a test failure:

```bash
$ npm run ai-agent:windsurf

🤖 AI Agent Orchestrator Starting...
📋 Step 1: Running tests to detect failures...
🔍 Step 2: Analyzing test failures with AI...
🔍 Analyzing 1 test failure(s)...

📝 AI Analysis Prompt Generated:
────────────────────────────────────────────────────────────────
You are an expert software engineer analyzing a test failure...

**Test Information:**
- Test Name: cruise detail returns itinerary and rom data
- File: tests/backend/api.spec.js
- Error Line: 37

**Error Message:**
404 Not Found

**Code Context:**
[code shown]

Please provide your response in JSON format...
────────────────────────────────────────────────────────────────

⚠️  Windsurf IDE Integration:
Paste the AI response JSON (press Ctrl+D when done):

[You paste the JSON response from Windsurf]

✅ Applied fix for: cruise detail returns itinerary and rom data
🧪 Verifying fixes...
✅ All tests passed!
📊 Report saved: ./ai-agent-reports/ai-agent-report-...html
📤 Pull Request: https://github.com/.../pull/124

✅ AI Agent completed successfully!
```

## 🎓 Learning Resources

1. **Windsurf IDE Documentation**: Learn about AI features
2. **Prompt Engineering**: Improve AI responses
3. **Test-Driven Development**: Write better tests
4. **Code Review**: Review AI suggestions critically

## 🆘 Getting Help

If you encounter issues:

1. Check the generated reports in `ai-agent-reports/`
2. Review Windsurf IDE's response format
3. Validate JSON before pasting
4. Try with `--dry-run` first
5. Open an issue with:
   - The generated prompt
   - Windsurf's response
   - Error messages

---

**Happy AI-assisted debugging with Windsurf! 🌊**
