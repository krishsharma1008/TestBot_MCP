# 🌊 Windsurf IDE Workflow Guide

## How to Use Windsurf Mode

When you run `npm start` with Windsurf mode (`AI_PROVIDER=windsurf`), the system will:

1. ✅ Start server
2. ✅ Run tests
3. ✅ Generate dashboard
4. ✅ Process all failures with artifacts
5. ⏳ **Save analysis requests for each failure**
6. ⏸️ **Wait for you to analyze with Windsurf**

## 📁 Where to Find Analysis Requests

After running `npm start`, check the `ai-agent-requests/` folder:

```
ai-agent-requests/
├── user-can-login-and-see-dropdown-with-name.md
├── logged-in-user-can-access-reservation-page.md
├── user-can-logout-from-navbar-dropdown.md
├── opening-cruise-detail-renders-modal-with-reser.md
├── searching-cruises-by-navire-triggers-results-u.md
├── should-submit-contact-form-via-mock-handler.md
├── should-submit-contact-form-via-real-handler-an.md
├── search-endpoint-returns-cruises-for-ALL-ports.md
├── cruise-detail-returns-itinerary-and-rom-data.md
└── cruise-detail-handles-burst-traffic.md
```

## 🔄 Step-by-Step Process

### Step 1: Run the Workflow
```bash
npm start
```

The system will process all failures and save analysis requests.

### Step 2: Analyze with Windsurf

For each `.md` file in `ai-agent-requests/`:

1. **Open the file** in Windsurf IDE
2. **Read the complete analysis request** (includes error, code, screenshots)
3. **Ask Windsurf AI** to analyze it
4. **Copy the JSON response** from Windsurf
5. **Save as** `{test-name}-response.json` in the same folder

### Step 3: Run Workflow Again

```bash
npm start
```

The system will:
- Detect existing response files
- Load the AI analysis
- Apply the suggested fixes
- Verify fixes work
- Create PR

## 📝 Example Workflow

### First Run:
```bash
$ npm start

✅ Processed 10 test failure(s) with artifacts
📄 Request saved: ai-agent-requests/user-can-login-and-see-dropdown-with-name.md
⏳ Awaiting Windsurf analysis...
[... 9 more ...]
```

### You Analyze with Windsurf:
1. Open `user-can-login-and-see-dropdown-with-name.md`
2. Send to Windsurf AI
3. Get response like:
```json
{
  "analysis": "The test expects lowercase 'shreyes' but gets 'Shreyes' with extra whitespace",
  "rootCause": "Case sensitivity and whitespace in username display",
  "fix": {
    "description": "Use case-insensitive match and trim whitespace",
    "changes": [{
      "file": "tests/frontend/authenticated.spec.js",
      "action": "replace",
      "lineStart": 16,
      "lineEnd": 16,
      "oldCode": "await expect(button).toContainText(creds.username.split('@')[0].split('.')[0]);",
      "newCode": "await expect(button).toContainText(creds.username.split('@')[0].split('.')[0], { ignoreCase: true });"
    }]
  },
  "confidence": 0.95
}
```
4. Save as `user-can-login-and-see-dropdown-with-name-response.json`

### Second Run:
```bash
$ npm start

✅ Processed 10 test failure(s) with artifacts
✅ Using existing response (1/10)
✅ Applied fix for: user can login and see dropdown with name
[... continues ...]
```

## 🎯 Benefits of This Approach

### ✅ No Manual Copy-Paste
- Analysis requests saved as files
- Responses loaded automatically
- No terminal interaction needed

### ✅ Batch Processing
- Analyze all 10 failures at once
- Save all responses
- Run workflow once to apply all fixes

### ✅ Review Before Apply
- See all AI suggestions first
- Modify responses if needed
- Control which fixes to apply

### ✅ Incremental Progress
- Analyze a few failures at a time
- Re-run to apply completed analyses
- System remembers what's done

## 📊 Analysis Request Format

Each `.md` file contains:

```markdown
# 🔍 Test Failure Analysis Request

## 📋 Test Information
- Test Name: user can login and see dropdown with name
- File: frontend/authenticated.spec.js
- Error Line: 16

## ❌ Error Details
expect(locator).toContainText(expected) failed
[full error message]

## 💻 Code Context
[30 lines of code around the error]

## 📸 Screenshots (1)
![Screenshot](data:image/png;base64,iVBORw0KGgo...)

## 🎥 Videos (1)
- video.webm

## Analysis Request
Please provide JSON response with:
- analysis
- rootCause
- fix (with changes array)
- confidence
- affectedFiles
```

## 🔧 Tips

### Analyze Multiple Failures Together
Open all `.md` files and ask Windsurf:
> "Analyze all these test failures and provide individual JSON responses for each"

### Modify AI Suggestions
Edit the response JSON before saving if you want different fixes.

### Skip Low-Confidence Fixes
The system automatically skips fixes with confidence < 0.7 (configurable).

### Batch Apply
Save all responses, then run `npm start` once to apply all fixes.

## 🚀 Quick Commands

```bash
# Run workflow
npm start

# Check analysis requests
ls ai-agent-requests/*.md

# Check responses
ls ai-agent-requests/*-response.json

# Clean up (start fresh)
rm -rf ai-agent-requests/
```

## 📈 Progress Tracking

The system shows:
```
✅ Processed 10 test failure(s) with artifacts
📄 Request saved: ai-agent-requests/test-1.md (1/10)
📄 Request saved: ai-agent-requests/test-2.md (2/10)
...
✅ Using existing response (3/10)
⏳ Awaiting Windsurf analysis... (7/10)
```

You can see which analyses are complete and which are pending.

## 🎉 Complete Example

```bash
# First run - generates requests
$ npm start
# Output: 10 .md files created in ai-agent-requests/

# Analyze with Windsurf
# (Open files, get AI responses, save as *-response.json)

# Second run - applies fixes
$ npm start
# Output: Loads responses, applies fixes, creates PR

# Done! ✅
```

---

**No manual terminal interaction required!**  
**Just files in, files out, then apply fixes automatically.**
