# 🏗️ AI Agent Architecture

Technical documentation for the AI-powered automated test fixing system.

## 📐 System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    AI Agent Orchestrator                     │
│                     (orchestrator.js)                        │
└──────────────┬──────────────────────────────────────────────┘
               │
       ┌───────┴───────┐
       │               │
       ▼               ▼
┌─────────────┐ ┌─────────────┐ ┌──────────────┐
│   Error     │ │    Code     │ │   GitHub     │
│  Analyzer   │ │   Fixer     │ │ PR Creator   │
└─────────────┘ └─────────────┘ └──────────────┘
       │               │               │
       ▼               ▼               ▼
┌─────────────┐ ┌─────────────┐ ┌──────────────┐
│ AI Provider │ │ File System │ │  GitHub API  │
│ (OpenAI/    │ │  (Backup &  │ │              │
│ Anthropic/  │ │   Apply)    │ │              │
│ Windsurf)   │ │             │ │              │
└─────────────┘ └─────────────┘ └──────────────┘
```

## 🔧 Core Components

### 1. Error Analyzer (`error-analyzer.js`)

**Purpose**: Detects and analyzes test failures using AI

**Key Methods**:
- `analyzeTestFailures(testResults)` - Main entry point
- `extractFailures(testResults)` - Parses Playwright test results
- `analyzeFailure(failure)` - Sends to AI for analysis
- `buildAnalysisPrompt(context)` - Creates AI prompt
- `callAI(prompt)` - Routes to appropriate AI provider

**AI Provider Support**:
- OpenAI GPT-4/3.5
- Anthropic Claude
- Windsurf IDE (manual mode)

**Output**:
```javascript
{
  hasErrors: true,
  failures: [...],
  analysisResults: [
    {
      failure: {...},
      analysis: "Detailed explanation",
      suggestedFix: {
        description: "...",
        changes: [...]
      },
      confidence: 0.95,
      affectedFiles: [...]
    }
  ]
}
```

### 2. Code Fixer (`code-fixer.js`)

**Purpose**: Applies AI-suggested fixes to codebase

**Key Methods**:
- `applyFixes(analysisResults)` - Apply all fixes
- `applyFix(analysisResult)` - Apply single fix
- `applyChange(filePath, change)` - Modify file
- `replaceLines(lines, change)` - Replace code
- `verifyFixes()` - Run tests to verify
- `rollbackFixes()` - Undo changes

**Safety Features**:
- Automatic backup creation
- Confidence threshold filtering
- Dry-run mode
- Rollback capability
- Fuzzy matching for code location

**Change Types**:
- `replace` - Replace lines of code
- `insert` - Insert new code
- `delete` - Remove code

### 3. GitHub PR Creator (`github-pr-creator.js`)

**Purpose**: Creates Pull Requests with fixes

**Key Methods**:
- `createPR(analysisResults, fixResults)` - Main workflow
- `createBranch()` - Create feature branch
- `commitChanges(message)` - Commit fixes
- `pushBranch(branchName)` - Push to remote
- `createGitHubPR(branchName, prDetails)` - Create PR via API
- `generatePRDetails()` - Create PR description

**PR Structure**:
- Title: `🤖 AI Fix: Resolve N test failure(s)`
- Body: Detailed analysis, fixes, and recommendations
- Branch: `ai-fix-{timestamp}`
- Labels: Optional (configurable)
- Reviewers: Optional (configurable)

### 4. Orchestrator (`orchestrator.js`)

**Purpose**: Coordinates the entire workflow

**Workflow Steps**:
1. Run tests
2. Analyze failures
3. Apply fixes
4. Verify fixes
5. Generate reports
6. Create PR

**Configuration**:
```javascript
{
  aiProvider: 'openai',
  apiKey: '...',
  model: 'gpt-4',
  githubToken: '...',
  minConfidence: 0.7,
  createPR: true,
  autoCommit: true,
  rollbackOnFailure: false
}
```

### 5. Main Entry Point (`index.js`)

**Purpose**: CLI interface and configuration loader

**Features**:
- Command-line argument parsing
- Configuration file loading
- Environment variable support
- Help system
- Initialization wizard

## 🔄 Data Flow

### 1. Test Results → Error Detection

```javascript
// Playwright test-results.json
{
  "suites": [
    {
      "tests": [
        {
          "title": "test name",
          "status": "failed",
          "errors": [
            {
              "message": "404 Not Found",
              "location": { "line": 9, "column": 5 }
            }
          ]
        }
      ]
    }
  ]
}
```

### 2. Error Context → AI Prompt

```javascript
{
  testName: "search endpoint returns cruises",
  file: "tests/backend/api.spec.js",
  errorMessage: "404 Not Found",
  line: 9,
  codeContext: "...", // 20 lines around error
  fullFileContent: "..." // entire file
}
```

### 3. AI Response → Fix Instructions

```javascript
{
  analysis: "The endpoint URL has a typo...",
  rootCause: "Typo in endpoint URL",
  fix: {
    description: "Fix the typo",
    changes: [
      {
        file: "tests/backend/api.spec.js",
        action: "replace",
        lineStart: 9,
        lineEnd: 9,
        oldCode: "/cuirses/search",
        newCode: "/cruises/search"
      }
    ]
  },
  confidence: 0.95
}
```

### 4. Fix Application → File Modification

```javascript
// Before
const response = await request.post('/cuirses/search', {

// After (with backup created)
const response = await request.post('/cruises/search', {
```

### 5. Results → Report Generation

```javascript
{
  summary: {
    totalFailures: 2,
    fixesApplied: 2,
    successRate: "100%"
  },
  failures: [...],
  fixes: [...],
  verification: { allTestsPassed: true }
}
```

## 🎨 Report Generation

### HTML Report Structure

```html
<div class="container">
  <header>AI Agent Report</header>
  <section class="summary">
    <!-- Statistics cards -->
  </section>
  <section class="failures">
    <!-- Each failure with analysis -->
  </section>
  <section class="fixes">
    <!-- Applied fixes -->
  </section>
  <section class="verification">
    <!-- Test results -->
  </section>
</div>
```

### Report Features

- Responsive design
- Color-coded confidence levels
- Expandable code sections
- Metadata tracking
- Export capabilities

## 🔐 Security Considerations

### API Key Management

- Never commit API keys
- Use environment variables
- Support `.env` files
- Validate before use

### Code Safety

- Backup before changes
- Confidence thresholds
- Dry-run mode
- Manual review required

### GitHub Integration

- Token scope validation
- Branch protection
- PR review requirements
- Audit trail

## 🧪 Testing Strategy

### Unit Tests (Future)

```javascript
describe('ErrorAnalyzer', () => {
  it('should extract failures from test results');
  it('should build correct AI prompts');
  it('should parse AI responses');
});

describe('CodeFixer', () => {
  it('should create backups before changes');
  it('should apply replace changes correctly');
  it('should rollback on failure');
});
```

### Integration Tests (Future)

```javascript
describe('AI Agent Workflow', () => {
  it('should handle complete workflow');
  it('should create PR with correct format');
  it('should handle multiple failures');
});
```

## 📊 Performance Considerations

### AI API Calls

- **Rate limiting**: Respect provider limits
- **Batching**: Process multiple errors efficiently
- **Caching**: Consider caching similar errors
- **Timeouts**: Handle slow responses

### File Operations

- **Streaming**: For large files
- **Atomic writes**: Prevent corruption
- **Backup cleanup**: Remove old backups
- **Parallel processing**: Multiple files

### Git Operations

- **Shallow clones**: Faster operations
- **Sparse checkout**: Only needed files
- **Compression**: Reduce network usage

## 🔧 Extension Points

### Custom AI Providers

```javascript
// Add to error-analyzer.js
async callCustomProvider(prompt) {
  // Your implementation
  return {
    analysis: "...",
    fix: {...},
    confidence: 0.9
  };
}
```

### Custom Fix Strategies

```javascript
// Add to code-fixer.js
applyCustomChange(filePath, change) {
  // Your implementation
}
```

### Custom Report Formats

```javascript
// Add to orchestrator.js
generateCustomReport(data) {
  // Your implementation
  return reportContent;
}
```

## 🐛 Error Handling

### Graceful Degradation

1. **AI API failure**: Log and continue with manual mode
2. **File not found**: Skip and report
3. **Git operation failure**: Provide manual instructions
4. **Test failure**: Optionally rollback

### Error Recovery

```javascript
try {
  await orchestrator.run();
} catch (error) {
  if (error.type === 'AI_API_ERROR') {
    // Fallback to manual mode
  } else if (error.type === 'GIT_ERROR') {
    // Provide manual git commands
  }
}
```

## 📈 Metrics & Monitoring

### Key Metrics

- Success rate of fixes
- Confidence score distribution
- Time to fix
- API costs
- PR merge rate

### Logging

```javascript
console.log('🔍 Analyzing failure:', testName);
console.log('✅ Applied fix with confidence:', confidence);
console.log('⚠️  Low confidence, skipping:', testName);
console.error('❌ Failed to apply fix:', error);
```

## 🚀 Future Enhancements

1. **Learning System**: Track which fixes work best
2. **Multi-language Support**: Beyond JavaScript
3. **IDE Plugins**: Direct integration
4. **Team Collaboration**: Shared fix database
5. **Cost Optimization**: Smart provider selection
6. **Parallel Processing**: Multiple failures at once
7. **Incremental Fixes**: Apply fixes one at a time
8. **A/B Testing**: Compare different AI models

## 📚 Dependencies

### Required

- `@playwright/test` - Test framework
- `node-fetch` - HTTP requests for AI APIs

### Optional

- `dotenv` - Environment variable management
- `chalk` - Colored terminal output
- `ora` - Loading spinners

## 🔗 Integration Points

### CI/CD Systems

- GitHub Actions
- GitLab CI
- Jenkins
- CircleCI

### Issue Trackers

- GitHub Issues
- Jira
- Linear

### Monitoring

- Sentry
- DataDog
- New Relic

---

**Version**: 1.0.0  
**Last Updated**: 2026-01-08  
**Maintainer**: AI Agent Team
