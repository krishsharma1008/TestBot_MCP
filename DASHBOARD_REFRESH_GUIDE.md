# TestBot Dashboard Refresh Guide

## Issue: Dashboard Not Updating

If you see old data in the TestBot dashboard, it's usually due to **browser caching**.

## Quick Solution

### Method 1: Hard Refresh (Recommended)
When the dashboard opens, press:
- **Mac**: `Cmd + Shift + R`
- **Windows/Linux**: `Ctrl + Shift + R`

This forces the browser to bypass cache and load fresh data.

### Method 2: Use the Refresh Script
```bash
cd /Users/krishsharma/Desktop/QA_Final
./refresh-dashboard.sh
```

This opens the dashboard with cache-busting parameters.

### Method 3: Close All Browser Tabs
1. Close ALL tabs showing the TestBot dashboard
2. Quit your browser completely
3. Run TestBot again - it will open a fresh instance

## Understanding the Dashboard Flow

### When Reports Are Generated

TestBot creates reports in two locations:

1. **Project-specific**: `[your-project]/testbot-reports/report-*.json`
   - Timestamped reports with full history

2. **Dashboard location**: `QA_Final/dashboard/public/report.json`
   - This is what the dashboard actually displays
   - Gets overwritten each run

### How It Works

```
TestBot Run → Generate Report → Copy to Dashboard → Open Browser
                                      ↓
                              dashboard/public/report.json
                                      ↓
                                 Dashboard Loads
```

## Configuration UI Behavior

### When Does It Show?

The configuration UI **only appears** when:
1. TestBot detects **NO existing tests** in the project
2. AND `OPENAI_API_KEY` is set in `.env`

### Why Didn't It Show for Airtime Project?

Your `airtime-micro-loans-poc` project already has tests in `tests/generated/`, so TestBot skipped the config UI and just ran the existing tests.

### To Regenerate Tests

To force the configuration UI and regenerate tests:

1. **Option A: Delete existing tests**
   ```bash
   cd /Users/krishsharma/Desktop/airtime-micro-loans-poc
   rm -rf tests/generated/
   # Now run TestBot - config UI will appear
   ```

2. **Option B: Run TestBot with generateTests parameter** (via MCP)
   ```json
   {
     "projectPath": "/path/to/project",
     "generateTests": true,
     "testType": "both"
   }
   ```

## Current Dashboard Data

The dashboard currently shows:
- **Project**: Micro loans
- **Tests**: 63 total (53 passed, 10 failed)
- **Pass Rate**: 84%
- **Generated**: Jan 28, 2026 at 11:08 AM

## Troubleshooting

### Quick Diagnostic Tool

Run this command to diagnose dashboard issues:

```bash
node scripts/debug-dashboard.js [project-path]
```

This tool checks:
- Dashboard files exist and are valid
- Report timestamps and staleness
- Playwright configuration
- Test results files
- And provides specific recommendations

### Dashboard Shows 0 Tests (Most Common Issue)

**Symptoms:**
- Dashboard loads but shows "0 total tests"
- Old data persists even after running tests
- Report exists but contains no test data

**Root Cause:**
The Playwright configuration is missing the JSON output file setting.

**Fix:**
Update your `playwright.config.js`:

```javascript
// WRONG - outputs to stdout only
reporter: 'json',

// CORRECT - outputs to file for TestBot
reporter: [['json', { outputFile: 'test-results.json' }]],
```

**Verify the fix:**
```bash
# After running tests, check if file was created
ls -la test-results.json

# Should show file with content (not 0 bytes)
```

### Dashboard Shows Wrong Project

If the dashboard shows data from a different project:

1. Check which report was last copied:
   ```bash
   cat dashboard/public/report-metadata.json
   ```

2. The dashboard always shows the **most recent** TestBot run
3. Each TestBot run overwrites `dashboard/public/report.json`

### Dashboard Won't Load at All

1. Verify the report exists:
   ```bash
   ls -lh dashboard/public/report.json
   ```

2. Check if it's valid JSON:
   ```bash
   cat dashboard/public/report.json | jq '.metadata'
   ```

3. Look for console errors in browser DevTools (F12)

### Tests Pass But Don't Show in Dashboard

This means the report generation failed. Check:
1. TestBot output logs
2. Playwright reporter configuration (see "0 Tests" issue above)
3. Write permissions in the dashboard directory
4. Run the diagnostic tool: `node scripts/debug-dashboard.js`

### Browser Shows Stale Data Despite Hard Refresh

If `Cmd+Shift+R` doesn't work:

1. **Check browser console (F12)** - Look for error messages
2. **Clear all site data:**
   - Chrome: DevTools > Application > Clear Storage > Clear site data
   - Safari: Develop > Empty Caches
3. **Open in Incognito/Private window**
4. **Use the fix script:**
   ```bash
   ./scripts/fix-dashboard-now.sh
   ```

### Manual Force Refresh

If all else fails:

```bash
# 1. Copy the latest report manually
cp /path/to/your/project/testbot-reports/latest.json dashboard/public/report.json

# 2. Open with timestamp
open "file://$(pwd)/dashboard/public/index.html?t=$(date +%s)000"
```

### Common Error Messages in Console

| Error | Cause | Fix |
|-------|-------|-----|
| `Failed to load test data: 404` | report.json missing | Run TestBot to generate report |
| `Report contains 0 tests` | Playwright config issue | Add `outputFile` to reporter |
| `No suites found in data` | Invalid report format | Check test-results.json exists |
| `JSON parse error` | Corrupted report file | Delete and regenerate |

## Playwright MCP Integration

### Current Status

TestBot MCP is **separate** from Playwright MCP. They don't communicate directly.

**TestBot MCP responsibilities:**
- Detects project settings
- Generates tests (via OpenAI when no tests exist)
- Runs Playwright tests
- Analyzes failures with AI
- Generates dashboard reports

**Playwright MCP (official):**
- Separate MCP for Playwright-specific operations
- Not currently integrated with TestBot

### To Integrate Both

If you want TestBot to use the official Playwright MCP for test execution:

1. Install Playwright MCP separately
2. Modify `testbot-mcp/src/playwright-integration.js` to call Playwright MCP
3. Update TestBot to read results from Playwright MCP output

This is currently **not implemented** - TestBot uses Playwright directly via npm.

## Tips

### Always Get Fresh Data

Add this alias to your shell (~/.zshrc or ~/.bashrc):

```bash
alias testbot-refresh="cd /Users/krishsharma/Desktop/QA_Final && ./refresh-dashboard.sh"
```

Then just run:
```bash
testbot-refresh
```

### Multiple Projects

When testing multiple projects, remember:
- Each run **overwrites** the dashboard
- To keep history, check the timestamped reports in each project's `testbot-reports/` folder
- Consider running a local web server to avoid file:// URL caching issues

### Local Web Server (Advanced)

To avoid file:// caching completely:

```bash
cd /Users/krishsharma/Desktop/QA_Final/dashboard/public
python3 -m http.server 8080
```

Then open: http://localhost:8080

## Summary

**Main Issues:**
1. ✅ Browser caching (fixed with hard refresh)
2. ✅ Config UI only shows when no tests exist (by design)
3. ✅ Dashboard always shows most recent TestBot run (by design)
4. ✅ Report shows 0 tests (fix Playwright reporter config)

**Solutions:**
1. Use `Cmd+Shift+R` after each TestBot run
2. Use `./refresh-dashboard.sh` script
3. Delete `tests/generated/` to trigger config UI
4. Quit browser completely between runs if needed
5. **Run diagnostic tool:** `node scripts/debug-dashboard.js`
6. **Force fix:** `./scripts/fix-dashboard-now.sh`

**Playwright Config Checklist:**
```javascript
// Ensure your playwright.config.js has:
reporter: [['json', { outputFile: 'test-results.json' }]],
```

**Quick Commands:**
```bash
# Diagnose dashboard issues
node scripts/debug-dashboard.js

# Force refresh dashboard
./refresh-dashboard.sh

# Manual fix
./scripts/fix-dashboard-now.sh
```
