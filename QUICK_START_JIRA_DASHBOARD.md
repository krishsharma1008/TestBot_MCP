# 🚀 Quick Start: Jira Dashboard Integration

## Prerequisites

Before starting, ensure you have:
- ✅ Node.js installed
- ✅ Jira account with API access
- ✅ Jira API token (get from https://id.atlassian.com/manage-profile/security/api-tokens)

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Configure Jira Credentials

Your `.env` file is already configured with:
```
JIRA_BASE_URL=https://shreyespd12.atlassian.net
JIRA_EMAIL=shreyespd12@gmail.com
JIRA_API_TOKEN=ATATT3xFfGF0V8DlJGNOz-00-EtwLE9oJ4T-v5DVOb1vjngq6qWcDgZRM57C9x9Fjs5HvFKquuzhtzCBafh8LKCFqQ0VG4j43kc1H5cjJYzCycVGBxtNKZcMrkDyWFbYqQJAD0MfaFDF3H82JCFVtC0XVUTapIxmdo2AiixkWPcv0AQyCQZz28w=601F1701
JIRA_PROJECT_KEY=MSCSHIP
```

✅ **Your Jira is already configured!**

## Step 3: Test Jira Connection

```bash
npm run jira:init
```

This will verify your Jira credentials are working.

## Step 4: Run the Complete Workflow

### **Option A: Full Automated Workflow (Recommended)**

```bash
npm run test:jira
```

This single command will:
1. ✅ Run all Playwright tests
2. 📊 Map tests to Jira stories
3. 🔄 Update Jira board based on results
4. 🎨 Build dashboard with Jira integration
5. 🤖 Run AI agent if tests fail (optional)

### **Option B: Step-by-Step Workflow**

If you prefer to run each step manually:

```bash
# Step 1: Run tests
npm test

# Step 2: Enrich dashboard with Jira data and update board
npm run jira:enrich

# Step 3: Build dashboard
npm run dashboard:build
```

## Step 5: View the Dashboard

Open the dashboard in your browser:

```bash
# Windows
start custom-report/index.html

# Mac/Linux
open custom-report/index.html
```

Or manually navigate to: `custom-report/index.html`

## 🎯 What You'll See

### **Jira Board Section**
Three columns showing your stories:
- **To Do**: Stories without tests or new stories
- **In Progress**: Stories with failing tests
- **Done**: Stories with all tests passing

### **Test Results Table**
Enhanced with a "Jira Story" column showing:
- Story key (clickable link to Jira)
- Current story status

### **Story Details**
Click any story card to see:
- Complete test results
- Pass/fail rates
- Story information

## 📝 How Test-Story Mapping Works

Tests are automatically linked to Jira stories by detecting story keys in:

### **Method 1: Filename**
```javascript
// File: tests/frontend/mscship-1-login.spec.js
// Automatically links to MSCSHIP-1
```

### **Method 2: Test Title**
```javascript
test('MSCSHIP-1: User should be able to login', async ({ page }) => {
  // Test code
});
```

### **Method 3: Describe Block**
```javascript
describe('MSCSHIP-1: Login Feature', () => {
  test('should login successfully', async ({ page }) => {
    // Test code
  });
});
```

## 🔄 Automatic Jira Board Updates

After tests run, stories automatically move:

| Test Results | Jira Status |
|--------------|-------------|
| ✅ All tests passing (100%) | → **Done** |
| ❌ Any tests failing (< 100%) | → **In Progress** |
| 📋 No tests yet | → **To Do** |

## 🛠️ Common Commands

| Command | What It Does |
|---------|--------------|
| `npm run test:jira` | **Full workflow** - Run tests + update Jira + build dashboard |
| `npm run test:jira:no-update` | Run tests + build dashboard (no Jira updates) |
| `npm run jira:enrich` | Enrich dashboard + update Jira board |
| `npm run jira:enrich:no-update` | Enrich dashboard only (no Jira updates) |
| `npm run jira:init` | Test Jira connection |
| `npm test` | Run tests only |
| `npm run dashboard:build` | Build dashboard only |

## 📊 Example Workflow

### **Scenario: Daily Testing**

```bash
# Morning: Run full workflow
npm run test:jira
```

**What happens:**
1. All tests run
2. Results mapped to Jira stories
3. Jira board updates automatically:
   - `MSCSHIP-1` (2 tests, all passing) → Moves to **Done**
   - `MSCSHIP-2` (5 tests, 2 failing) → Moves to **In Progress**
   - `MSCSHIP-3` (no tests) → Stays in **To Do**
4. Dashboard built with Jira integration
5. Open `custom-report/index.html` to view results

### **Scenario: Review Before Updating Jira**

```bash
# Run tests but don't update Jira yet
npm run test:jira:no-update

# Review dashboard to see what would change
# Open custom-report/index.html

# If happy with changes, update Jira manually
npm run jira:update-board
```

## 🎨 Dashboard Features

### **1. Jira Board Stats**
Quick overview cards:
- Number of stories in To Do
- Number of stories in In Progress
- Number of stories in Done

### **2. Kanban Board**
Visual board with story cards showing:
- Story key and summary
- Priority badge
- Test statistics (total, passed, failed)
- Pass rate progress bar
- Update indicators

### **3. Story Details Modal**
Click any story to see:
- Full story information
- All related tests
- Pass/fail breakdown
- Recommended status changes

### **4. Test Results Table**
Each test row shows:
- Test name
- Suite
- **Jira Story** (with link)
- Status
- Duration
- Actions

## 🐛 Troubleshooting

### **Issue: "Jira connection failed"**

**Solution:**
1. Check `.env` file has correct credentials
2. Verify API token is valid
3. Test connection: `npm run jira:init`

### **Issue: "No Jira data in dashboard"**

**Solution:**
```bash
# Run enrichment
npm run jira:enrich

# Verify files exist
dir custom-report\jira-enriched-data.json
dir custom-report\jira-board-view.json

# Rebuild dashboard
npm run dashboard:build
```

### **Issue: "Tests not linked to stories"**

**Solution:**
1. Add story key to test filename, title, or describe block
2. Format: `PROJECTKEY-NUMBER` (e.g., `MSCSHIP-1`)
3. Re-run: `npm run jira:enrich`

### **Issue: "Jira board not updating"**

**Solution:**
1. Check Jira API token has write permissions
2. Verify story transitions are available in your Jira workflow
3. Review logs: `.jira-cache\board-update-log.json`
4. Try dry run first: `npm run test:jira:no-update`

## 📁 Generated Files

After running the workflow, you'll find:

```
custom-report/
├── index.html                    # Main dashboard
├── jira-enriched-data.json      # Jira data with test results
└── jira-board-view.json         # Board organized by status

.jira-cache/
├── test-story-mapping.json      # Test-to-story mapping
└── board-update-log.json        # History of board updates
```

## 🎯 Next Steps

1. **Run the workflow**: `npm run test:jira`
2. **Open dashboard**: `custom-report/index.html`
3. **Check Jira board**: Visit your Jira board to see updated statuses
4. **Create more tests**: Link them to stories using story keys

## 📚 Additional Documentation

- [Jira Dashboard Features](./JIRA_DASHBOARD_README.md)
- [Jira Integration Overview](./JIRA_INTEGRATION_README.md)
- [Architecture Details](./JIRA_INTEGRATION_ARCHITECTURE.md)
- [AI Agent Documentation](./AI_AGENT_README.md)

---

## 🚀 TL;DR - Just Run This

```bash
# Install dependencies (first time only)
npm install

# Run the complete workflow
npm run test:jira

# Open dashboard
start custom-report/index.html
```

**That's it! Your tests will run, Jira board will update, and dashboard will show everything.** 🎉
