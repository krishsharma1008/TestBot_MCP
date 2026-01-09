# Quick Start Guide - Automated Error Fix Workflow

## What's Been Set Up

✅ **Deliberate Error Planted**
- File: `website/app/controllers/HomeController.php` (line 21)
- Error: `$navireData->getAllNavire()` (undefined variable)
- This will cause a PHP fatal error when the home page loads

✅ **Fix Script Created**
- File: `scripts/fix-deliberate-errors.js`
- Automatically detects and fixes the deliberate error
- Tested and working locally

✅ **GitHub Actions Workflow**
- File: `.github/workflows/auto-fix-errors.yml`
- Triggers on manual dispatch or push to main
- Creates PR with automated fixes

## How to Trigger the Workflow

### Option 1: Commit and Push (Recommended)
```bash
git add .
git commit -m "feat: Add automated error detection and fix workflow"
git push origin main
```

The workflow will automatically:
1. Detect the deliberate error
2. Run the fix script
3. Create a PR with the fix

### Option 2: Manual Trigger via GitHub
1. Go to your GitHub repository
2. Click on "Actions" tab
3. Select "Auto Fix Deliberate Errors" workflow
4. Click "Run workflow" button
5. Select branch and click "Run workflow"

### Option 3: Test Locally First
```bash
# See the error detection and fix in action
node scripts/fix-deliberate-errors.js

# Output will show:
# ✅ Found error in: website/app/controllers/HomeController.php
# ✓ Fixed successfully!
```

## What to Expect

### When Workflow Runs:
1. **Detection Phase**: Searches for `DELIBERATE_ERROR` comments
2. **Fix Phase**: Applies automated fixes
3. **PR Creation**: Creates a new PR with:
   - Branch: `auto-fix/deliberate-errors-{run_number}`
   - Title: "🤖 Auto-fix: Resolve deliberate errors"
   - Labels: `automated`, `bug-fix`, `poc`
   - Detailed description of changes

### PR Content:
The PR will include:
- Fixed code (replacing `$navireData` with `$navire`)
- Workflow run details
- Note about POC demonstration
- Explanation that AI can fix simple errors but not complex ones

## Files Created/Modified

### New Files:
- `.github/workflows/auto-fix-errors.yml` - GitHub Actions workflow
- `scripts/fix-deliberate-errors.js` - Error detection and fix script
- `WORKFLOW_POC.md` - Comprehensive documentation
- `QUICKSTART.md` - This file

### Modified Files:
- `website/app/controllers/HomeController.php` - Contains deliberate error

## Next Steps

1. **Commit all changes** to your repository
2. **Push to GitHub** to trigger the workflow
3. **Monitor the Actions tab** to see the workflow run
4. **Review the PR** that gets created
5. **Merge the PR** to apply the fix
6. **Verify** the error is resolved

## Testing the Error

To see the error in action before the fix:
```bash
# Start your PHP server
php -S localhost:8000 -t website/public

# Visit http://localhost:8000
# You should see: Fatal error: Uncaught Error: Undefined variable $navireData
```

After the PR is merged, the error will be gone.

## Important Notes

⚠️ **This is a POC demonstration**
- The workflow can only fix predefined, simple errors
- Complex bugs require manual intervention
- The AI demonstrates partial automation capabilities

✅ **What Works**
- Detecting errors with specific patterns
- Applying regex-based fixes
- Creating PRs with detailed information

❌ **What Doesn't Work (By Design)**
- Fixing complex logic errors
- Detecting unknown error patterns
- Fixing architectural issues

## Troubleshooting

**Workflow doesn't trigger?**
- Check if `.github/workflows/` directory exists
- Verify workflow file has `.yml` extension
- Ensure you pushed to the correct branch

**No PR created?**
- Check workflow logs in Actions tab
- Verify the error pattern exists in the file
- Ensure GitHub token has PR creation permissions

**Script fails locally?**
- Verify Node.js is installed (`node --version`)
- Check file paths are correct
- Ensure the error pattern matches exactly

---

**Ready to go!** Commit and push to see the magic happen! 🚀
