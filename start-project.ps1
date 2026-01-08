# ShipCruiseTour POC - Automated Startup Script
# This script starts the PHP server, runs Playwright tests, and builds the custom dashboard

$ErrorActionPreference = "Continue"

# Helper functions
function Write-Success {
    param([string]$message)
    Write-Host "[SUCCESS] $message" -ForegroundColor Green
}

function Write-Info {
    param([string]$message)
    Write-Host "[INFO] $message" -ForegroundColor Cyan
}

function Write-Err {
    param([string]$message)
    Write-Host "[ERROR] $message" -ForegroundColor Red
}

function Write-Header {
    param([string]$message)
    Write-Host "`n========================================" -ForegroundColor Yellow
    Write-Host $message -ForegroundColor Yellow
    Write-Host "========================================`n" -ForegroundColor Yellow
}

# Get project root directory
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectRoot

Write-Header "Starting ShipCruiseTour POC Project"

# Step 1: Check prerequisites
Write-Header "Checking Prerequisites"

# Check PHP
try {
    $phpVersion = php -v 2>&1 | Select-Object -First 1
    Write-Success "PHP is installed: $phpVersion"
} catch {
    Write-Err "PHP is not installed or not in PATH"
    exit 1
}

# Check Node.js
try {
    $nodeVersion = node -v
    Write-Success "Node.js is installed: $nodeVersion"
} catch {
    Write-Err "Node.js is not installed or not in PATH"
    exit 1
}

# Check npm
try {
    $npmVersion = npm -v
    Write-Success "npm is installed: v$npmVersion"
} catch {
    Write-Err "npm is not installed or not in PATH"
    exit 1
}

# Step 2: Install dependencies if needed
Write-Header "Checking Dependencies"

if (-not (Test-Path "node_modules")) {
    Write-Info "Installing npm dependencies..."
    npm install
    Write-Success "Dependencies installed"
} else {
    Write-Success "Dependencies already installed"
}

# Step 3: Start PHP server
Write-Header "Starting PHP Development Server"

$phpServerPath = Join-Path $ProjectRoot "website\public"
$phpPort = 8000
$baseUrl = "http://localhost:$phpPort"

# Kill any existing process on port 8000
Write-Info "Checking for existing processes on port $phpPort..."
$existingProcess = Get-NetTCPConnection -LocalPort $phpPort -ErrorAction SilentlyContinue
if ($existingProcess) {
    $processId = $existingProcess.OwningProcess
    Write-Info "Stopping existing process on port $phpPort (PID: $processId)..."
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

Write-Info "Starting PHP server on port $phpPort..."

# Start PHP server in background
$phpJob = Start-Job -ScriptBlock {
    param($path, $port)
    Set-Location $path
    php -S localhost:$port
} -ArgumentList $phpServerPath, $phpPort

# Wait for server to start
Start-Sleep -Seconds 4

# Verify server is running
$maxRetries = 5
$retryCount = 0
$serverRunning = $false

while ($retryCount -lt $maxRetries -and -not $serverRunning) {
    try {
        $response = Invoke-WebRequest -Uri $baseUrl -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
        $serverRunning = $true
        Write-Success "PHP server started successfully on $baseUrl"
    } catch {
        $retryCount++
        if ($retryCount -lt $maxRetries) {
            Write-Info "Waiting for server to start... (attempt $retryCount/$maxRetries)"
            Start-Sleep -Seconds 2
        }
    }
}

if (-not $serverRunning) {
    Write-Err "Failed to start PHP server after $maxRetries attempts"
    Stop-Job $phpJob -ErrorAction SilentlyContinue
    Remove-Job $phpJob -ErrorAction SilentlyContinue
    exit 1
}

# Open website in browser
Write-Info "Opening website in browser..."
Start-Process $baseUrl

# Step 4: Run Playwright tests
Write-Header "Running Playwright Tests"

Write-Info "Executing test suite..."
$testResult = $null
try {
    npm test
    Write-Success "Tests completed"
} catch {
    Write-Err "Tests failed or encountered errors"
}

# Step 4.5: Copy Playwright report and test results to website/public for accessibility
Write-Info "Copying test artifacts to web server directory..."

# Copy Playwright report
$playwrightReportSource = Join-Path $ProjectRoot "playwright-report"
$playwrightReportDest = Join-Path $ProjectRoot "website\public\playwright-report"

if (Test-Path $playwrightReportSource) {
    # Remove old report if exists
    if (Test-Path $playwrightReportDest) {
        Remove-Item -Path $playwrightReportDest -Recurse -Force -ErrorAction SilentlyContinue
    }
    
    # Copy new report
    Copy-Item -Path $playwrightReportSource -Destination $playwrightReportDest -Recurse -Force
    Write-Success "Playwright report copied to web server"
} else {
    Write-Info "Playwright report not found - skipping copy"
}

# Copy test-results (contains screenshots, videos, traces)
$testResultsSource = Join-Path $ProjectRoot "test-results"
$testResultsDest = Join-Path $ProjectRoot "website\public\test-results"

if (Test-Path $testResultsSource) {
    # Remove old results if exists
    if (Test-Path $testResultsDest) {
        Remove-Item -Path $testResultsDest -Recurse -Force -ErrorAction SilentlyContinue
    }
    
    # Copy new results
    Copy-Item -Path $testResultsSource -Destination $testResultsDest -Recurse -Force
    Write-Success "Test results (screenshots, videos) copied to web server"
} else {
    Write-Info "Test results not found - skipping copy"
}

# Step 5: Build custom dashboard
Write-Header "Building Custom Dashboard"

try {
    npm run dashboard:build
    Write-Success "Dashboard built successfully"
} catch {
    Write-Err "Failed to build dashboard"
}

# Step 6: Start dashboard server
Write-Header "Starting Dashboard Server"

$dashboardServerPath = Join-Path $ProjectRoot "custom-reporter"
$dashboardPort = 3000
$dashboardUrl = "http://localhost:$dashboardPort/dashboard-template.html"

# Kill any existing process on port 3000
$existingDashboardProcess = Get-NetTCPConnection -LocalPort $dashboardPort -ErrorAction SilentlyContinue
if ($existingDashboardProcess) {
    $processId = $existingDashboardProcess.OwningProcess
    Write-Info "Stopping existing process on port $dashboardPort (PID: $processId)..."
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

Write-Info "Starting dashboard server on port $dashboardPort..."

# Start dashboard server in background
$dashboardJob = Start-Job -ScriptBlock {
    param($path, $port)
    Set-Location $path
    php -S localhost:$port
} -ArgumentList $dashboardServerPath, $dashboardPort

# Wait for dashboard server to start
Start-Sleep -Seconds 3

# Verify dashboard server is running
$dashboardRetries = 3
$dashboardRetryCount = 0
$dashboardRunning = $false

while ($dashboardRetryCount -lt $dashboardRetries -and -not $dashboardRunning) {
    try {
        $response = Invoke-WebRequest -Uri $dashboardUrl -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
        $dashboardRunning = $true
        Write-Success "Dashboard server started successfully on $dashboardUrl"
    } catch {
        $dashboardRetryCount++
        if ($dashboardRetryCount -lt $dashboardRetries) {
            Write-Info "Waiting for dashboard server... (attempt $dashboardRetryCount/$dashboardRetries)"
            Start-Sleep -Seconds 2
        }
    }
}

if (-not $dashboardRunning) {
    Write-Err "Failed to start dashboard server, but continuing..."
    $dashboardJob = $null
}

# Step 7: Open dashboard and website
Write-Header "Project Started Successfully"

if ($dashboardRunning) {
    Write-Info "Opening dashboard in browser..."
    Start-Process $dashboardUrl
} else {
    Write-Info "Dashboard server not running - skipping browser open"
}

# Summary
Write-Header "Summary"
Write-Success "Website: $baseUrl"
Write-Success "Dashboard: $dashboardUrl"
Write-Success "PHP Server: Running on port $phpPort"
Write-Success "Dashboard Server: Running on port $dashboardPort"
Write-Success "Playwright Report: Run 'npm run test:report' to view"

Write-Info "`nPress Ctrl+C to stop all servers and exit"
Write-Info "To view running jobs, use: Get-Job"
Write-Info "To stop servers manually, use: Get-Job | Stop-Job; Get-Job | Remove-Job"

# Keep script running to maintain both servers
Write-Info "`nKeeping servers alive... (Press Ctrl+C to stop)"
try {
    # Wait for both jobs
    $jobs = @($phpJob)
    if ($dashboardJob) {
        $jobs += $dashboardJob
    }
    Wait-Job $jobs
} finally {
    # Cleanup both servers
    Stop-Job $phpJob -ErrorAction SilentlyContinue
    Remove-Job $phpJob -ErrorAction SilentlyContinue
    if ($dashboardJob) {
        Stop-Job $dashboardJob -ErrorAction SilentlyContinue
        Remove-Job $dashboardJob -ErrorAction SilentlyContinue
    }
    Write-Info "`nAll servers stopped"
}
