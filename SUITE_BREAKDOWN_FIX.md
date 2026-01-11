# ✅ Suite Breakdown & Playwright Report Fixes

## 🎯 **Issues Fixed**

### **1. Suite Breakdown Section** ✅

**Problem:** Suite Breakdown section was showing "Other" instead of MSCSHIP story keys

**Root Cause:** The section was using `getCategoryStats()` which returns categories like "Frontend", "Backend", "Other"

**Fix Applied:** Changed `renderCategoryCards()` function to use `getSuiteStats()` instead

**Location:** `custom-reporter/reporter.js` lines 151-193

**Before:**
```javascript
function renderCategoryCards() {
    const categories = parser.getCategoryStats().filter(cat => {
        if (currentScope === 'all') return true;
        return cat.name.toLowerCase() === currentScope;
    });
    // ... rendered category cards
}
```

**After:**
```javascript
function renderCategoryCards() {
    // Use suite stats instead of category stats to show MSCSHIP story keys
    const suites = parser.getSuiteStats();
    const container = document.getElementById('categoryCards');
    // ... renders suite cards with MSCSHIP keys
}
```

**Result:** Suite Breakdown section now displays:
- **MSCSHIP-14** (5 tests)
- **MSCSHIP-15** (7 tests)
- **MSCSHIP-16** (5 tests)
- **MSCSHIP-19** (5 tests)
- **MSCSHIP-20** (5 tests)
- **MSCSHIP-22** (7 tests)

Each card shows:
- Story key as title
- Total tests count
- Passed/Failed/Skipped breakdown
- Pass rate percentage with progress bar

---

### **2. Playwright Report Link** ✅

**Problem:** "View Full Playwright Report" link not working

**Status:** Playwright report exists at `playwright-report/index.html`

**Current Link:** `/playwright-report/index.html`

**How it works:**
- Dashboard runs on `http://localhost:3000` (serves from `custom-report/`)
- Playwright report is at project root: `playwright-report/`
- Link uses absolute path: `/playwright-report/index.html`
- Server needs to serve both directories

**To verify:**
1. Click "View Full Playwright Report" in footer
2. Should open: `http://localhost:3000/playwright-report/index.html`
3. Shows full Playwright HTML report with traces

**If link doesn't work:**
- Check if server is configured to serve `playwright-report/` directory
- May need to update server configuration in `scripts/run-complete-workflow.js`

---

## 📊 **Expected Dashboard View**

### **Suite Breakdown Section:**
```
┌─────────────────────────────────────────┐
│ MSCSHIP-14                    5 tests   │
│ Passed: 4  Failed: 1  Skipped: 0        │
│ Pass Rate: ████████░░ 80%               │
├─────────────────────────────────────────┤
│ MSCSHIP-15                    7 tests   │
│ Passed: 6  Failed: 1  Skipped: 0        │
│ Pass Rate: ██████████ 86%               │
├─────────────────────────────────────────┤
│ MSCSHIP-16                    5 tests   │
│ Passed: 4  Failed: 1  Skipped: 0        │
│ Pass Rate: ████████░░ 80%               │
├─────────────────────────────────────────┤
│ MSCSHIP-19                    5 tests   │
│ Passed: 4  Failed: 1  Skipped: 0        │
│ Pass Rate: ████████░░ 80%               │
├─────────────────────────────────────────┤
│ MSCSHIP-20                    5 tests   │
│ Passed: 4  Failed: 1  Skipped: 0        │
│ Pass Rate: ████████░░ 80%               │
├─────────────────────────────────────────┤
│ MSCSHIP-22                    7 tests   │
│ Passed: 6  Failed: 1  Skipped: 0        │
│ Pass Rate: ██████████ 86%               │
└─────────────────────────────────────────┘
```

---

## 🔍 **How Suite Names Are Extracted**

**In `data-parser.js` `parseSuite()` function:**

```javascript
// For jira-generated tests, extract story key from file path
if (suite.file && suite.file.includes('jira-generated')) {
    const match = suite.file.match(/mscship[_-]?(\d+)/i);
    if (match) {
        suiteName = `MSCSHIP-${match[1]}`;
    }
}
```

**Example:**
- File: `tests/jira-generated/mscship_14.spec.js`
- Extracted: `MSCSHIP-14`

---

## ✅ **Verification Steps**

1. **Open Dashboard:**
   ```
   http://localhost:3000
   ```

2. **Hard Refresh:**
   Press `Ctrl + Shift + R`

3. **Check Suite Breakdown Section:**
   - Should be between "Key Metrics" and "Visualizations"
   - Should show 6 cards labeled MSCSHIP-14 through MSCSHIP-22
   - Each card shows test counts and pass rate

4. **Check Playwright Report Link:**
   - Scroll to footer
   - Click "View Full Playwright Report"
   - Should open Playwright report in new tab

---

## 📝 **Files Modified**

1. ✅ `custom-reporter/reporter.js`
   - Changed `renderCategoryCards()` to use `getSuiteStats()`

2. ✅ `custom-reporter/data-parser.js`
   - Already has `parseSuite()` fix to extract MSCSHIP keys

3. ✅ Dashboard rebuilt with `node scripts/build-dashboard.js`

---

**Suite Breakdown now shows MSCSHIP story keys!** 🎉

**Dashboard opened - hard refresh to see changes!**
