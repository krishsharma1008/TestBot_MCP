# 🌊 Windsurf Cascade (Codex 5.1) Integration Guide

## Overview

This AI Agent system is now configured to work with **Windsurf Cascade using Codex 5.1** model for intelligent test failure analysis and fixing.

## Configuration

### Current Setup

```env
AI_PROVIDER=windsurf
AI_MODEL=cascade-codex-5.1
```

This configuration tells the system to:
1. Use Windsurf IDE integration mode
2. Request analysis from Cascade with Codex 5.1 model
3. Save analysis requests as markdown files for you to process

## How It Works

### Step 1: Run the Workflow

```bash
npm start
```

This will:
- ✅ Start your PHP server
- ✅ Run all Playwright tests
- ✅ Generate the test dashboard
- ✅ Process all 10 test failures with artifacts
- ✅ Save analysis requests to `ai-agent-requests/` folder

### Step 2: Analysis Requests Created

The system creates one `.md` file per failure:

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

### Step 3: Analyze with Cascade

For each `.md` file:

1. **Open in Windsurf IDE** (you're already using it!)
2. **Select all content** (Ctrl+A)
3. **Send to Cascade** using the chat panel
4. **Specify Codex 5.1** if not already selected
5. **Copy the JSON response** from Cascade
6. **Save as** `{test-name}-response.json` in the same folder

### Step 4: Apply Fixes Automatically

```bash
npm start
```

The system will:
- ✅ Load all your Cascade responses
- ✅ Apply the suggested fixes automatically
- ✅ Run tests again to verify
- ✅ Generate reports
- ✅ Create GitHub PR (if configured)

## Analysis Request Format

Each `.md` file contains:

```markdown
# 🔍 Test Failure Analysis Request

> **AI Model**: Please use Windsurf Cascade with **Codex 5.1** for this analysis

## 📋 Test Information
- Test Name: user can login and see dropdown with name
- File: frontend/authenticated.spec.js
- Error Line: 16
- Duration: 19042ms

## ❌ Error Details
[Complete error message with stack trace]

## 💻 Code Context
[30 lines of code around the error]

## 📸 Screenshots (1)
![Screenshot](data:image/png;base64,iVBORw0KGgo...)
[Embedded as base64 - Cascade can "see" the screenshot!]

## 🎥 Videos (1)
- video.webm

## 🎯 Analysis Request for Windsurf Cascade (Codex 5.1)

**Instructions for Cascade AI:**
1. Analyze the test failure with all context
2. Identify the root cause
3. Provide precise fix with exact code changes
4. Return JSON response
```

## Expected Cascade Response

Cascade should return a JSON object like this:

```json
{
  "analysis": "The test expects lowercase 'shreyes' but the button displays 'Shreyes' with capital S and extra whitespace. This is a case sensitivity and whitespace trimming issue.",
  "rootCause": "The username display logic doesn't account for case sensitivity in the test assertion, and there's extra whitespace in the rendered HTML.",
  "fix": {
    "description": "Update the test to use case-insensitive matching and handle whitespace",
    "changes": [
      {
        "file": "tests/frontend/authenticated.spec.js",
        "action": "replace",
        "lineStart": 16,
        "lineEnd": 16,
        "oldCode": "await expect(button).toContainText(creds.username.split('@')[0].split('.')[0]);",
        "newCode": "const expectedName = creds.username.split('@')[0].split('.')[0];\n    await expect(button).toContainText(expectedName, { ignoreCase: true });"
      }
    ]
  },
  "confidence": 0.95,
  "affectedFiles": ["tests/frontend/authenticated.spec.js"],
  "testingStrategy": "Re-run the test to verify it passes with case-insensitive matching"
}
```

## Saving Cascade Responses

**Important**: Save the JSON response exactly as Cascade provides it.

1. Copy the entire JSON object from Cascade
2. Save to: `ai-agent-requests/{test-name}-response.json`
3. Ensure it's valid JSON (no markdown code blocks, no extra text)

Example filename:
```
ai-agent-requests/user-can-login-and-see-dropdown-with-name-response.json
```

## Batch Processing

You can analyze all 10 failures at once:

1. **Open all `.md` files** in Windsurf
2. **Ask Cascade**: "Analyze all these test failures and provide individual JSON responses for each"
3. **Save each response** to its corresponding `-response.json` file
4. **Run `npm start`** to apply all fixes

## Benefits of Cascade Codex 5.1

### 🎯 Superior Code Understanding
- Codex 5.1 is specifically trained on code
- Better at understanding test frameworks (Playwright)
- More accurate root cause analysis

### 📸 Visual Context
- Can analyze screenshots embedded in the requests
- Understands UI state from images
- Better frontend test debugging

### 🔧 Precise Fixes
- Generates exact code changes
- Understands project context
- Provides high-confidence solutions

## Verification

After Cascade provides fixes and they're applied:

```bash
npm start
```

The workflow will:
1. Apply all fixes from response files
2. Run tests again
3. Show which tests now pass
4. Generate final report

## Example Complete Workflow

```bash
# First run - generate analysis requests
$ npm start
✅ Processed 10 test failure(s) with artifacts
📄 Request saved: ai-agent-requests/test-1.md (1/10)
📄 Request saved: ai-agent-requests/test-2.md (2/10)
...

# You analyze with Cascade and save responses

# Second run - apply fixes
$ npm start
✅ Using existing response (1/10)
✅ Using existing response (2/10)
...
✅ Applied 10 fix(es)
✅ Tests re-run: 8 now passing!
✅ PR created with fixes
```

## Tips for Working with Cascade

### 1. Provide Full Context
The `.md` files include everything Cascade needs:
- Error messages
- Code context
- Screenshots
- Stack traces

### 2. Ask for Clarification
If Cascade's response isn't clear, ask:
> "Can you explain why this fix works?"
> "Are there any edge cases to consider?"

### 3. Verify Confidence
The system only applies fixes with confidence ≥ 0.7
You can adjust this in `ai-agent.config.js`:
```js
minConfidence: 0.8  // Require higher confidence
```

### 4. Review Before Applying
Check the response JSON before saving:
- Is the fix logical?
- Are the line numbers correct?
- Is the confidence appropriate?

## Troubleshooting

### "No response file found"
- Make sure you saved the JSON to the correct filename
- Check that it's valid JSON (use a JSON validator)
- Ensure no markdown code blocks (```json) in the file

### "Invalid JSON response"
- Copy only the JSON object from Cascade
- Remove any markdown formatting
- Ensure all quotes and brackets match

### "Low confidence fix skipped"
- Cascade wasn't confident enough (< 0.7)
- Review the analysis manually
- You can lower `minConfidence` if needed

## Advanced: Direct Integration

For future enhancement, we could integrate directly with Cascade's API:

```javascript
// Future: Direct API integration
const response = await cascade.analyze({
  model: 'codex-5.1',
  context: payload,
  screenshots: base64Images
});
```

Currently using file-based workflow for maximum control and transparency.

## Summary

✅ **Configured**: Windsurf Cascade with Codex 5.1  
✅ **Analysis Requests**: Saved as `.md` files with full context  
✅ **Screenshots**: Embedded as base64 for visual analysis  
✅ **Responses**: Save as JSON files  
✅ **Automation**: Fixes applied automatically on next run  

**You're all set to use Cascade for intelligent test failure analysis!** 🎉

---

**Next Steps:**
1. Run `npm start` to generate analysis requests
2. Open `.md` files in Windsurf
3. Analyze with Cascade (Codex 5.1)
4. Save responses as JSON
5. Run `npm start` again to apply fixes
