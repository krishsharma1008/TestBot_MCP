# Jira Dashboard Integration

This integration displays your Jira board directly in the test dashboard and automatically syncs test results back to Jira.

## 🎯 Features

- **Visual Jira Board**: See your stories organized by status (To Do, In Progress, Done)
- **Test-Story Mapping**: Each test is linked to its Jira story
- **Automatic Status Updates**: Test results automatically update Jira board
  - ✅ All tests passing → Story moves to **Done**
  - ❌ Any tests failing → Story moves to **In Progress**
  - 📋 No tests yet → Story stays in **To Do**
- **Rich Story Cards**: View test results, pass rates, and priorities
- **Integrated Dashboard**: Jira info appears alongside test results

## 🚀 Quick Start

### 1. Run Tests with Jira Integration

```bash
npm run test:jira
```

This will:
1. Run all Playwright tests
2. Map tests to Jira stories
3. Update Jira board based on results
4. Build dashboard with Jira integration

### 2. View the Dashboard

Open `custom-report/index.html` in your browser to see:
- Jira board with three columns (To Do, In Progress, Done)
- Test results table with Jira story links
- Story details with test pass/fail rates

## 📋 How It Works

### Test-to-Story Mapping

Tests are automatically linked to Jira stories by:
1. **Story key in filename**: `mscship_1.spec.js` → `MSCSHIP-1`
2. **Story key in test title**: `test('MSCSHIP-1: User login', ...)` → `MSCSHIP-1`
3. **Story key in describe block**: `describe('MSCSHIP-1: Login Feature', ...)` → `MSCSHIP-1`

### Automatic Board Updates

After tests run, the system:
1. Analyzes test results for each story
2. Calculates pass rate
3. Updates Jira story status:
   - **To Done**: If all tests pass (100% pass rate)
   - **To In Progress**: If any tests fail (< 100% pass rate)
   - **Stays in To Do**: If no tests exist yet

### Dashboard Display

The dashboard shows:
- **Jira Board Section**: Visual kanban board with your stories
- **Story Cards**: Show test count, pass/fail, and pass rate
- **Test Table**: Each test row shows its linked Jira story
- **Story Details Modal**: Click any story to see all related tests

## 🎨 Dashboard Features

### Jira Board View

```
┌─────────────┬─────────────┬─────────────┐
│   To Do     │ In Progress │    Done     │
├─────────────┼─────────────┼─────────────┤
│ MSCSHIP-3   │ MSCSHIP-1   │ MSCSHIP-2   │
│ 0 tests     │ 5 tests     │ 3 tests     │
│             │ 3 passed    │ 3 passed    │
│             │ 2 failed    │ 0 failed    │
│             │ 60% pass    │ 100% pass   │
└─────────────┴─────────────┴─────────────┘
```

### Story Card Information

Each card shows:
- Story key and summary
- Priority badge
- Test statistics (total, passed, failed)
- Pass rate progress bar
- Update indicator (if status needs changing)

### Test Table Integration

The test results table includes a "Jira Story" column showing:
- Story key (clickable link to Jira)
- Current story status badge

## 🔧 Commands

| Command | Description |
|---------|-------------|
| `npm run test:jira` | Run tests + update Jira + build dashboard |
| `npm run test:jira:no-update` | Run tests + build dashboard (no Jira updates) |
| `npm run jira:enrich` | Enrich dashboard with Jira data + update board |
| `npm run jira:enrich:no-update` | Enrich dashboard only (no board updates) |
| `npm run jira:update-board` | Update Jira board based on latest test results |

## 📝 Workflow Examples

### Example 1: Daily Testing

```bash
# Run tests and update Jira automatically
npm run test:jira
```

**What happens:**
1. Tests run
2. Results mapped to stories
3. Jira board updated automatically
4. Dashboard built with Jira integration
5. Open `custom-report/index.html` to view

### Example 2: Review Only (No Jira Updates)

```bash
# Run tests but don't update Jira
npm run test:jira:no-update
```

**What happens:**
1. Tests run
2. Dashboard shows what Jira updates *would* be made
3. No actual changes to Jira board
4. Good for reviewing before making changes

### Example 3: Update Jira from Existing Results

```bash
# Already ran tests, just update Jira
npm run jira:update-board
```

**What happens:**
1. Reads existing test-results.json
2. Maps to Jira stories
3. Updates Jira board
4. Rebuilds dashboard

## 🎯 Story Status Logic

### Moving to "Done"

A story moves to Done when:
- All linked tests pass (100% pass rate)
- At least one test exists for the story

### Moving to "In Progress"

A story moves to In Progress when:
- Any linked test fails (< 100% pass rate)
- Tests exist but some are failing

### Staying in "To Do"

A story stays in To Do when:
- No tests exist yet for the story
- Story is newly created

## 📊 Dashboard Sections

### 1. Jira Board Stats

Quick overview cards showing:
- Number of stories in To Do
- Number of stories in In Progress  
- Number of stories in Done

### 2. Jira Board Columns

Three-column kanban view:
- **To Do**: Stories without tests or new stories
- **In Progress**: Stories with failing tests
- **Done**: Stories with all tests passing

### 3. Story Details Modal

Click any story card to see:
- Full story summary
- Current status and priority
- Assignee information
- Complete test results
- Pass rate visualization
- List of all related tests with status

### 4. Test Results Table

Enhanced with Jira column showing:
- Story key (links to Jira)
- Story status badge
- Quick access to story details

## 🔄 Integration with Existing Workflow

The Jira dashboard integrates seamlessly with your existing setup:

```
Tests Run → AI Agent (if failed) → Jira Update → Dashboard Build
```

### With AI Agent

```bash
# Full workflow with AI fixes
npm run test:jira
```

If tests fail:
1. AI agent analyzes failures
2. AI applies fixes
3. Tests re-run
4. Jira board updates based on final results

### Manual Control

```bash
# Run tests only
npm test

# Then manually enrich and update
npm run jira:enrich

# Or just enrich without updating Jira
npm run jira:enrich:no-update
```

## 🎨 Customization

### Custom Status Mapping

Edit `jira-integration.config.js`:

```javascript
module.exports = {
  // Map your custom Jira statuses
  statusMapping: {
    'To Do': ['Backlog', 'New', 'Open'],
    'In Progress': ['In Development', 'In Review', 'Testing'],
    'Done': ['Closed', 'Resolved', 'Complete']
  }
};
```

### Custom Test Mapping

Tests are mapped by pattern matching. To customize:

1. **Use story key in filename**: `mscship-123-login.spec.js`
2. **Use story key in test title**: `test('MSCSHIP-123: should login', ...)`
3. **Use story key in describe**: `describe('MSCSHIP-123: Login', ...)`

## 🐛 Troubleshooting

### No Jira Data in Dashboard

**Problem**: Dashboard doesn't show Jira section

**Solution**:
```bash
# Ensure you've run the enrichment
npm run jira:enrich

# Check if files exist
ls custom-report/jira-enriched-data.json
ls custom-report/jira-board-view.json
```

### Tests Not Linked to Stories

**Problem**: Tests show "—" in Jira Story column

**Solution**:
- Add story key to test filename, title, or describe block
- Format: `PROJECTKEY-NUMBER` (e.g., `MSCSHIP-1`)
- Re-run: `npm run jira:enrich`

### Jira Board Not Updating

**Problem**: Stories don't move on Jira board

**Solution**:
1. Check Jira credentials in `.env`
2. Verify API token has write permissions
3. Check available transitions: Some statuses may not allow direct transitions
4. Review logs in `.jira-cache/board-update-log.json`

### Wrong Story Status

**Problem**: Story moved to wrong column

**Solution**:
- Check test results - ensure tests are actually passing/failing
- Verify story key mapping is correct
- Review `jira-enriched-data.json` to see calculated results

## 📚 Files Generated

| File | Description |
|------|-------------|
| `custom-report/jira-enriched-data.json` | Complete Jira data with test results |
| `custom-report/jira-board-view.json` | Board view organized by status |
| `.jira-cache/test-story-mapping.json` | Test-to-story mapping cache |
| `.jira-cache/board-update-log.json` | History of board updates |

## 🔗 Related Documentation

- [Jira Integration Overview](./JIRA_INTEGRATION_README.md)
- [Quick Start Guide](./JIRA_INTEGRATION_QUICKSTART.md)
- [Architecture](./JIRA_INTEGRATION_ARCHITECTURE.md)
- [AI Agent Documentation](./AI_AGENT_README.md)

---

**Happy Testing with Jira Integration! 🚀**
