#!/bin/bash

# Start Dashboard Server
# This script starts a local HTTP server to avoid CORS issues

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
PORT=8888

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo ""
echo "======================================"
echo "  TestBot Dashboard Server"
echo "======================================"
echo ""

# Check if port is already in use
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null ; then
    echo -e "${YELLOW}Port $PORT is already in use${NC}"
    PID=$(lsof -ti:$PORT)
    echo "Kill existing server? (y/n)"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        kill $PID
        sleep 1
    else
        echo "Using existing server"
    fi
fi

# Start server
cd "$PROJECT_ROOT"
echo -e "${BLUE}Starting HTTP server on port $PORT...${NC}"
python3 -m http.server $PORT > /dev/null 2>&1 &
SERVER_PID=$!
sleep 2

# Check if server started successfully
if ps -p $SERVER_PID > /dev/null; then
    echo -e "${GREEN}✓ Server started successfully!${NC}"
    echo ""
    echo "======================================"
    echo "  Access URLs:"
    echo "======================================"
    echo ""
    echo -e "${GREEN}Dashboard:${NC}"
    echo "  http://localhost:$PORT/dashboard/public/index.html"
    echo ""
    echo -e "${GREEN}Playwright HTML Report:${NC}"
    echo "  http://localhost:$PORT/testbot-reports/playwright-report/index.html"
    echo ""
    echo -e "${YELLOW}Opening dashboard in browser...${NC}"
    open "http://localhost:$PORT/dashboard/public/index.html" 2>/dev/null || \
    xdg-open "http://localhost:$PORT/dashboard/public/index.html" 2>/dev/null || \
    echo "Please open: http://localhost:$PORT/dashboard/public/index.html"
    echo ""
    echo "======================================"
    echo "Server is running (PID: $SERVER_PID)"
    echo "Press Ctrl+C to stop"
    echo "======================================"
    echo ""
    
    # Keep script running
    wait $SERVER_PID
else
    echo -e "${RED}✗ Failed to start server${NC}"
    exit 1
fi
