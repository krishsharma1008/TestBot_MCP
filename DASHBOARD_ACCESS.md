# How to Access TestBot Dashboard and Playwright Report

## ✅ Everything is Ready!

Your tests have been run and all reports are generated with full artifacts (traces, videos, screenshots).

## 🚀 Quick Access

### Option 1: Using HTTP Server (Recommended - No CORS issues)

An HTTP server is currently running on port 8888.

**Access the dashboard:**
```
http://localhost:8888/dashboard/public/index.html
```

**Access Playwright HTML report directly:**
```
http://localhost:8888/testbot-reports/playwright-report/index.html
```

**Or use the launch script:**
```bash
cd /Users/krishsharma/Desktop/QA_Final
./start-dashboard-server.sh
```

### Option 2: Direct File Access (May have CORS limitations)

```
file:///Users/krishsharma/Desktop/QA_Final/dashboard/public/index.html
```

## 📊 What You'll See

### TestBot Dashboard Features:
- ✅ **28 tests** all passed
- 📈 **Pass rate:** 100%
- 📊 **Visual charts** and metrics
- 🔍 **Search and filter** tests
- 📝 **Test details** with artifacts

### Playwright HTML Report Features:
- 🎥 **Video recordings** of test execution
- 📸 **Screenshots** at key moments
- 🔍 **Trace viewer** with:
  - Step-by-step action timeline
  - Network requests/responses
  - Console logs
  - DOM snapshots
  - Screenshots at each action

## 🎯 How to View Artifacts

### From TestBot Dashboard:

1. **Open dashboard:** http://localhost:8888/dashboard/public/index.html

2. **Click "View Full Playwright Report"** button at the bottom
   - Opens complete Playwright HTML report
   - All traces, videos, screenshots integrated

3. **Or click "Details"** on any test to see:
   - Test information
   - Error details (if failed)
   - Artifacts (videos, traces, screenshots)

### From Playwright HTML Report:

1. **Open report:** http://localhost:8888/testbot-reports/playwright-report/index.html

2. **Click on any test** to view:
   - Full trace with step-by-step execution
   - Video playback
   - Screenshots
   - Network activity
   - Console logs

3. **Use the trace viewer:**
   - Click on actions to see DOM state
   - View network requests
   - Inspect console output
   - Step through test execution

## 📁 File Locations

```
QA_Final/
├── dashboard/public/index.html          # TestBot Dashboard
├── testbot-reports/
│   ├── latest.json                      # Test results data
│   ├── playwright-report/               # Playwright HTML report
│   │   ├── index.html                   # Main report file
│   │   ├── data/                        # Test data
│   │   └── trace/                       # Trace files
│   └── artifacts/                       # All test artifacts
│       ├── */video.webm                 # Videos
│       ├── */trace.zip                  # Traces
│       └── */test-finished-*.png        # Screenshots
└── examples/sample-project/
    ├── test-results/                    # Original test artifacts
    └── playwright-report/               # Original report
```

## 🛠️ Managing the Server

### Check if server is running:
```bash
lsof -i:8888
```

### Stop the server:
```bash
lsof -ti:8888 | xargs kill
```

### Start the server again:
```bash
cd /Users/krishsharma/Desktop/QA_Final
./start-dashboard-server.sh
```

### Or manually:
```bash
cd /Users/krishsharma/Desktop/QA_Final
python3 -m http.server 8888
```

## 🔍 Verifying Artifacts

### Check artifacts were captured:
```bash
find testbot-reports/artifacts -name "*.webm" | wc -l   # Videos
find testbot-reports/artifacts -name "*.zip" | wc -l    # Traces
find testbot-reports/artifacts -name "*.png" | wc -l    # Screenshots
```

### Example output (your results):
- Videos: Found
- Traces: 28 tests (all have traces)
- Screenshots: Found for UI tests

## 📝 Next Steps

1. **View the dashboard** at http://localhost:8888/dashboard/public/index.html

2. **Click "View Full Playwright Report"** to see all artifacts

3. **Explore individual tests:**
   - Click on any test in the Playwright report
   - View the trace with step-by-step execution
   - Watch video playback
   - See screenshots

4. **To run tests again:**
   ```bash
   cd examples/sample-project
   npm test
   ```
   Then the report will auto-update!

## 💡 Tips

- **Trace viewer** is the most powerful debugging tool - use it to understand test failures
- **Videos** help visualize what the test did
- **Screenshots** capture the exact state at specific moments
- **Network logs** in traces show all API calls
- **Console logs** in traces show all console output

## 🐛 Troubleshooting

### Dashboard shows no data:
- Refresh the page: http://localhost:8888/dashboard/public/index.html
- Check latest.json exists: `ls testbot-reports/latest.json`

### Playwright report button doesn't work:
- Verify report exists: `ls testbot-reports/playwright-report/index.html`
- Use direct URL: http://localhost:8888/testbot-reports/playwright-report/index.html

### CORS errors:
- Make sure you're using `http://localhost:8888/...` URLs (not `file://...`)
- Server must be running: `lsof -i:8888`

### No artifacts showing:
- Check artifacts directory: `ls -R testbot-reports/artifacts/ | head -20`
- Re-run tests to regenerate: `cd examples/sample-project && npm test`

## ✅ Current Status

- ✓ Tests executed: 28 tests, all passed
- ✓ Playwright HTML report generated
- ✓ Artifacts captured (videos, traces, screenshots)
- ✓ Reports copied to testbot-reports/
- ✓ HTTP server running on port 8888
- ✓ Dashboard accessible via browser
- ✓ "View Full Playwright Report" button working

**You're all set! Open the dashboard and explore your test results!**
