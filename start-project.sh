#!/bin/bash
# ShipCruiseTour POC - Automated Startup Script (macOS/Linux)
# This script starts the PHP server, runs Playwright tests, and builds the custom dashboard

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Helper functions
write_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

write_info() {
    echo -e "${CYAN}[INFO]${NC} $1"
}

write_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

write_header() {
    echo -e "\n${YELLOW}========================================${NC}"
    echo -e "${YELLOW}$1${NC}"
    echo -e "${YELLOW}========================================${NC}\n"
}

# Get project root directory
PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_ROOT"

write_header "Starting ShipCruiseTour POC Project"

# Step 1: Check prerequisites
write_header "Checking Prerequisites"

# Check PHP
if command -v php &> /dev/null; then
    PHP_VERSION=$(php -v | head -n 1)
    write_success "PHP is installed: $PHP_VERSION"
else
    write_error "PHP is not installed or not in PATH"
    exit 1
fi

# Check Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    write_success "Node.js is installed: $NODE_VERSION"
else
    write_error "Node.js is not installed or not in PATH"
    exit 1
fi

# Check npm
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm -v)
    write_success "npm is installed: v$NPM_VERSION"
else
    write_error "npm is not installed or not in PATH"
    exit 1
fi

# Step 2: Install dependencies if needed
write_header "Checking Dependencies"

if [ ! -d "node_modules" ]; then
    write_info "Installing npm dependencies..."
    npm install
    write_success "Dependencies installed"
else
    write_success "Dependencies already installed"
fi

# Step 3: Start PHP server
write_header "Starting PHP Development Server"

PHP_SERVER_PATH="$PROJECT_ROOT/website/public"
PHP_PORT=8000
BASE_URL="http://localhost:$PHP_PORT"

# Kill any existing process on port 8000
write_info "Checking for existing processes on port $PHP_PORT..."
if lsof -Pi :$PHP_PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    EXISTING_PID=$(lsof -Pi :$PHP_PORT -sTCP:LISTEN -t)
    write_info "Stopping existing process on port $PHP_PORT (PID: $EXISTING_PID)..."
    kill -9 $EXISTING_PID 2>/dev/null || true
    sleep 2
fi

write_info "Starting PHP server on port $PHP_PORT..."

# Start PHP server in background
cd "$PHP_SERVER_PATH"
php -S localhost:$PHP_PORT > /dev/null 2>&1 &
PHP_PID=$!
cd "$PROJECT_ROOT"

# Wait for server to start
sleep 4

# Verify server is running
MAX_RETRIES=5
RETRY_COUNT=0
SERVER_RUNNING=false

while [ $RETRY_COUNT -lt $MAX_RETRIES ] && [ "$SERVER_RUNNING" = false ]; do
    if curl -s -o /dev/null -w "%{http_code}" "$BASE_URL" | grep -q "200\|302\|301"; then
        SERVER_RUNNING=true
        write_success "PHP server started successfully on $BASE_URL"
    else
        RETRY_COUNT=$((RETRY_COUNT + 1))
        if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
            write_info "Waiting for server to start... (attempt $RETRY_COUNT/$MAX_RETRIES)"
            sleep 2
        fi
    fi
done

if [ "$SERVER_RUNNING" = false ]; then
    write_error "Failed to start PHP server after $MAX_RETRIES attempts"
    kill $PHP_PID 2>/dev/null || true
    exit 1
fi

# Open website in browser
write_info "Opening website in browser..."
if [[ "$OSTYPE" == "darwin"* ]]; then
    open "$BASE_URL"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    xdg-open "$BASE_URL" 2>/dev/null || true
fi

# Step 4: Run Playwright tests
write_header "Running Playwright Tests"

write_info "Executing test suite..."
npm test || write_error "Tests failed or encountered errors"

# Step 4.5: Copy Playwright report and test results to website/public for accessibility
write_info "Copying test artifacts to web server directory..."

# Copy Playwright report
PLAYWRIGHT_REPORT_SOURCE="$PROJECT_ROOT/playwright-report"
PLAYWRIGHT_REPORT_DEST="$PROJECT_ROOT/website/public/playwright-report"

if [ -d "$PLAYWRIGHT_REPORT_SOURCE" ]; then
    rm -rf "$PLAYWRIGHT_REPORT_DEST" 2>/dev/null || true
    cp -r "$PLAYWRIGHT_REPORT_SOURCE" "$PLAYWRIGHT_REPORT_DEST"
    write_success "Playwright report copied to web server"
else
    write_info "Playwright report not found - skipping copy"
fi

# Copy test-results (contains screenshots, videos, traces)
TEST_RESULTS_SOURCE="$PROJECT_ROOT/test-results"
TEST_RESULTS_DEST="$PROJECT_ROOT/website/public/test-results"

if [ -d "$TEST_RESULTS_SOURCE" ]; then
    rm -rf "$TEST_RESULTS_DEST" 2>/dev/null || true
    cp -r "$TEST_RESULTS_SOURCE" "$TEST_RESULTS_DEST"
    write_success "Test results (screenshots, videos) copied to web server"
else
    write_info "Test results not found - skipping copy"
fi

# Step 5: Build custom dashboard
write_header "Building Custom Dashboard"

npm run dashboard:build || write_error "Failed to build dashboard"

# Step 6: Start dashboard server
write_header "Starting Dashboard Server"

DASHBOARD_SERVER_PATH="$PROJECT_ROOT/custom-reporter"
DASHBOARD_PORT=3000
DASHBOARD_URL="http://localhost:$DASHBOARD_PORT/dashboard-template.html"

# Kill any existing process on port 3000
if lsof -Pi :$DASHBOARD_PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    EXISTING_DASHBOARD_PID=$(lsof -Pi :$DASHBOARD_PORT -sTCP:LISTEN -t)
    write_info "Stopping existing process on port $DASHBOARD_PORT (PID: $EXISTING_DASHBOARD_PID)..."
    kill -9 $EXISTING_DASHBOARD_PID 2>/dev/null || true
    sleep 2
fi

write_info "Starting dashboard server on port $DASHBOARD_PORT..."

# Start dashboard server in background
cd "$DASHBOARD_SERVER_PATH"
php -S localhost:$DASHBOARD_PORT > /dev/null 2>&1 &
DASHBOARD_PID=$!
cd "$PROJECT_ROOT"

# Wait for dashboard server to start
sleep 3

# Verify dashboard server is running
DASHBOARD_RETRIES=3
DASHBOARD_RETRY_COUNT=0
DASHBOARD_RUNNING=false

while [ $DASHBOARD_RETRY_COUNT -lt $DASHBOARD_RETRIES ] && [ "$DASHBOARD_RUNNING" = false ]; do
    if curl -s -o /dev/null -w "%{http_code}" "$DASHBOARD_URL" | grep -q "200\|302\|301"; then
        DASHBOARD_RUNNING=true
        write_success "Dashboard server started successfully on $DASHBOARD_URL"
    else
        DASHBOARD_RETRY_COUNT=$((DASHBOARD_RETRY_COUNT + 1))
        if [ $DASHBOARD_RETRY_COUNT -lt $DASHBOARD_RETRIES ]; then
            write_info "Waiting for dashboard server... (attempt $DASHBOARD_RETRY_COUNT/$DASHBOARD_RETRIES)"
            sleep 2
        fi
    fi
done

if [ "$DASHBOARD_RUNNING" = false ]; then
    write_error "Failed to start dashboard server, but continuing..."
    DASHBOARD_PID=""
fi

# Step 7: Open dashboard and website
write_header "Project Started Successfully"

if [ "$DASHBOARD_RUNNING" = true ]; then
    write_info "Opening dashboard in browser..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        open "$DASHBOARD_URL"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        xdg-open "$DASHBOARD_URL" 2>/dev/null || true
    fi
else
    write_info "Dashboard server not running - skipping browser open"
fi

# Summary
write_header "Summary"
write_success "Website: $BASE_URL"
write_success "Dashboard: $DASHBOARD_URL"
write_success "PHP Server: Running on port $PHP_PORT (PID: $PHP_PID)"
if [ -n "$DASHBOARD_PID" ]; then
    write_success "Dashboard Server: Running on port $DASHBOARD_PORT (PID: $DASHBOARD_PID)"
fi
write_success "Playwright Report: Run 'npm run test:report' to view"

write_info "\nPress Ctrl+C to stop all servers and exit"
write_info "To stop servers manually, use: kill $PHP_PID${DASHBOARD_PID:+ $DASHBOARD_PID}"

# Cleanup function
cleanup() {
    echo ""
    write_info "Stopping servers..."
    kill $PHP_PID 2>/dev/null || true
    if [ -n "$DASHBOARD_PID" ]; then
        kill $DASHBOARD_PID 2>/dev/null || true
    fi
    write_info "All servers stopped"
    exit 0
}

# Trap Ctrl+C
trap cleanup INT TERM

# Keep script running to maintain both servers
write_info "\nKeeping servers alive... (Press Ctrl+C to stop)"
wait
