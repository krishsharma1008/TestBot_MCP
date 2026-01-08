# Project Startup Guide

This guide explains how to start the entire ShipCruiseTour POC project with a single command.

## Quick Start

### Option 1: Using npm (Recommended)
```bash
npm start
```

### Option 2: Using Batch File (Double-click)
Simply double-click `start-project.bat` in the project root directory.

### Option 3: Using PowerShell Directly
```powershell
.\start-project.ps1
```

## What Gets Started

The startup script automatically:

1. **Checks Prerequisites**
   - Verifies PHP is installed
   - Verifies Node.js and npm are installed

2. **Installs Dependencies**
   - Runs `npm install` if `node_modules` doesn't exist

3. **Starts PHP Development Server**
   - Launches PHP server on `http://localhost:8000`
   - Serves from `website/public` directory
   - Runs in background

4. **Runs Playwright Tests**
   - Executes all frontend and backend tests
   - Generates `test-results.json`

5. **Builds Custom Dashboard**
   - Processes test results
   - Creates custom dashboard in `custom-report/` directory
   - Automatically opens dashboard in browser

## Requirements

- **PHP** (version 7.4 or higher recommended)
- **Node.js** (version 14 or higher)
- **npm** (comes with Node.js)

## Stopping the Server

Press `Ctrl+C` in the terminal to stop the PHP server.

To manually stop the PHP server:
```powershell
Get-Job | Stop-Job
Get-Job | Remove-Job
```

## Accessing the Application

- **Website**: http://localhost:8000
- **Custom Dashboard**: `custom-report/index.html` (opens automatically)
- **Playwright Report**: Run `npm run test:report`

## Troubleshooting

### Port 8000 Already in Use
If port 8000 is already in use, the script will detect the existing server and continue with tests.

### PHP Not Found
Ensure PHP is installed and added to your system PATH.

### Tests Fail
The script will continue and build the dashboard even if tests fail, using available results.

### PowerShell Execution Policy Error
If you get an execution policy error, run:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

## Manual Commands

If you prefer to run components separately:

```bash
# Start PHP server only
cd website/public
php -S localhost:8000

# Run tests only
npm test

# Build dashboard only
npm run dashboard:build

# View Playwright HTML report
npm run test:report
```
