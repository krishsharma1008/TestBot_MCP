#!/bin/bash

# Verification script for Playwright HTML Report button integration
# This script tests that the "View Full Playwright Report" button works correctly

set -e

echo "======================================"
echo "Playwright Report Button Verification"
echo "======================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
SAMPLE_PROJECT="$PROJECT_ROOT/examples/sample-project"
TESTBOT_REPORTS="$PROJECT_ROOT/testbot-reports"
DASHBOARD="$PROJECT_ROOT/dashboard/public"

# Step 1: Check Playwright config has HTML reporter
echo "Step 1: Checking Playwright configuration..."
if grep -q "html.*outputFolder.*playwright-report" "$SAMPLE_PROJECT/playwright.config.js"; then
    echo -e "${GREEN}✓${NC} HTML reporter is configured in playwright.config.js"
else
    echo -e "${RED}✗${NC} HTML reporter is NOT configured in playwright.config.js"
    echo "  Add this to the reporter array:"
    echo "  ['html', { outputFolder: 'playwright-report', open: 'never' }]"
    exit 1
fi

# Step 2: Check if @playwright/mcp is installed
echo ""
echo "Step 2: Checking Playwright MCP installation..."
if [ -d "$PROJECT_ROOT/node_modules/@playwright/mcp" ]; then
    echo -e "${GREEN}✓${NC} @playwright/mcp is installed"
else
    echo -e "${YELLOW}!${NC} @playwright/mcp is not installed"
    echo "  Installing now..."
    cd "$PROJECT_ROOT" && npm install --save-dev @playwright/mcp
    echo -e "${GREEN}✓${NC} @playwright/mcp installed successfully"
fi

# Step 3: Check ReportGenerator has copyPlaywrightHTMLReport method
echo ""
echo "Step 3: Checking ReportGenerator implementation..."
if grep -q "copyPlaywrightHTMLReport" "$PROJECT_ROOT/testbot-mcp/src/report-generator.js"; then
    echo -e "${GREEN}✓${NC} copyPlaywrightHTMLReport method exists"
else
    echo -e "${RED}✗${NC} copyPlaywrightHTMLReport method is missing"
    exit 1
fi

if grep -q "copyDirectoryRecursive" "$PROJECT_ROOT/testbot-mcp/src/report-generator.js"; then
    echo -e "${GREEN}✓${NC} copyDirectoryRecursive method exists"
else
    echo -e "${RED}✗${NC} copyDirectoryRecursive method is missing"
    exit 1
fi

# Step 4: Check dashboard button link
echo ""
echo "Step 4: Checking dashboard button configuration..."
if grep -q "testbot-reports/playwright-report/index.html" "$DASHBOARD/index.html"; then
    echo -e "${GREEN}✓${NC} Button links to correct path"
else
    echo -e "${RED}✗${NC} Button link is incorrect"
    exit 1
fi

if grep -q "checkPlaywrightReport" "$DASHBOARD/index.html"; then
    echo -e "${GREEN}✓${NC} Report availability checker is present"
else
    echo -e "${RED}✗${NC} Report availability checker is missing"
    exit 1
fi

# Step 5: Test file structure
echo ""
echo "Step 5: Checking directory structure..."

if [ ! -d "$SAMPLE_PROJECT" ]; then
    echo -e "${RED}✗${NC} Sample project directory not found"
    exit 1
else
    echo -e "${GREEN}✓${NC} Sample project exists"
fi

if [ ! -d "$DASHBOARD" ]; then
    echo -e "${RED}✗${NC} Dashboard directory not found"
    exit 1
else
    echo -e "${GREEN}✓${NC} Dashboard exists"
fi

# Create testbot-reports directory if it doesn't exist
if [ ! -d "$TESTBOT_REPORTS" ]; then
    echo -e "${YELLOW}!${NC} testbot-reports directory doesn't exist, creating..."
    mkdir -p "$TESTBOT_REPORTS"
fi
echo -e "${GREEN}✓${NC} testbot-reports directory exists"

# Step 6: Check for existing Playwright report
echo ""
echo "Step 6: Checking for existing reports..."

PLAYWRIGHT_REPORT_EXISTS=false
if [ -f "$SAMPLE_PROJECT/playwright-report/index.html" ]; then
    echo -e "${GREEN}✓${NC} Playwright HTML report exists in sample-project"
    PLAYWRIGHT_REPORT_EXISTS=true
else
    echo -e "${YELLOW}!${NC} Playwright HTML report not found in sample-project"
    echo "  Run 'cd examples/sample-project && npm test' to generate it"
fi

if [ -f "$TESTBOT_REPORTS/playwright-report/index.html" ]; then
    echo -e "${GREEN}✓${NC} Playwright HTML report exists in testbot-reports"
else
    echo -e "${YELLOW}!${NC} Playwright HTML report not found in testbot-reports"
    if [ "$PLAYWRIGHT_REPORT_EXISTS" = true ]; then
        echo "  Report will be copied when TestBot generates next report"
    else
        echo "  Generate report first, then run TestBot"
    fi
fi

# Step 7: Summary
echo ""
echo "======================================"
echo "Verification Summary"
echo "======================================"
echo ""
echo "Configuration:"
echo -e "  - Playwright config: ${GREEN}✓${NC}"
echo -e "  - Report generator: ${GREEN}✓${NC}"
echo -e "  - Dashboard button: ${GREEN}✓${NC}"
echo -e "  - Directory structure: ${GREEN}✓${NC}"
echo ""

if [ "$PLAYWRIGHT_REPORT_EXISTS" = true ]; then
    echo -e "${GREEN}All checks passed!${NC}"
    echo ""
    echo "To view the report:"
    echo "  1. Open: file://$DASHBOARD/index.html"
    echo "  2. Click 'View Full Playwright Report' button"
    echo ""
else
    echo -e "${YELLOW}Setup is correct, but no report generated yet.${NC}"
    echo ""
    echo "To generate and test the full flow:"
    echo "  1. cd examples/sample-project"
    echo "  2. npm test"
    echo "  3. Run TestBot to generate report"
    echo "  4. Open: file://$DASHBOARD/index.html"
    echo "  5. Click 'View Full Playwright Report' button"
    echo ""
fi

echo "For more information, see:"
echo "  - PLAYWRIGHT_REPORT_BUTTON_FIX.md"
echo "  - PLAYWRIGHT_MCP_GUIDE.md"
echo ""
