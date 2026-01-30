#!/bin/bash

# TestBot Dashboard Refresh Script
# Forces the dashboard to reload with the latest report

echo "🔄 Refreshing TestBot Dashboard..."

DASHBOARD_DIR="$(cd "$(dirname "$0")" && pwd)/dashboard/public"

if [ ! -f "$DASHBOARD_DIR/report.json" ]; then
    echo "❌ No report found at $DASHBOARD_DIR/report.json"
    echo "Run TestBot first to generate a report."
    exit 1
fi

TIMESTAMP=$(date +%s)000
DASHBOARD_URL="file://$DASHBOARD_DIR/index.html?t=$TIMESTAMP"

echo "📊 Dashboard URL: $DASHBOARD_URL"
echo "✨ Opening dashboard in browser..."

# Open in default browser
if command -v open &> /dev/null; then
    # macOS
    open "$DASHBOARD_URL"
elif command -v xdg-open &> /dev/null; then
    # Linux
    xdg-open "$DASHBOARD_URL"
elif command -v start &> /dev/null; then
    # Windows (Git Bash)
    start "$DASHBOARD_URL"
else
    echo "❌ Could not detect browser opener"
    echo "📋 Please open this URL manually: $DASHBOARD_URL"
fi

echo ""
echo "💡 Tips:"
echo "  - If you see old data, press Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)"
echo "  - This forces a hard refresh bypassing the cache"
echo ""
echo "✅ Done!"
