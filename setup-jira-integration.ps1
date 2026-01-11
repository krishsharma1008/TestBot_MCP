#!/usr/bin/env pwsh

# Jira Integration Setup Script for Windows
# This script helps you set up the Jira integration quickly

Write-Host ""
Write-Host "🎯 Jira Integration Setup" -ForegroundColor Cyan
Write-Host "=" * 60
Write-Host ""

# Check if .env exists
if (Test-Path ".env") {
    Write-Host "✅ .env file found" -ForegroundColor Green
    $createNew = Read-Host "Do you want to update Jira credentials? (y/N)"
    if ($createNew -ne "y" -and $createNew -ne "Y") {
        Write-Host "Skipping .env update" -ForegroundColor Yellow
        $skipEnv = $true
    }
} else {
    Write-Host "Creating .env file..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
}

if (-not $skipEnv) {
    Write-Host ""
    Write-Host "📝 Please provide your Jira credentials:" -ForegroundColor Cyan
    Write-Host ""
    
    $jiraUrl = Read-Host "Jira Base URL (e.g., https://yourcompany.atlassian.net)"
    $jiraEmail = Read-Host "Jira Email"
    $jiraToken = Read-Host "Jira API Token" -AsSecureString
    $jiraTokenPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($jiraToken))
    $jiraProject = Read-Host "Jira Project Key (e.g., PROJ)"
    
    # Update .env file
    $envContent = Get-Content ".env" -Raw
    $envContent = $envContent -replace "JIRA_BASE_URL=.*", "JIRA_BASE_URL=$jiraUrl"
    $envContent = $envContent -replace "JIRA_EMAIL=.*", "JIRA_EMAIL=$jiraEmail"
    $envContent = $envContent -replace "JIRA_API_TOKEN=.*", "JIRA_API_TOKEN=$jiraTokenPlain"
    $envContent = $envContent -replace "JIRA_PROJECT_KEY=.*", "JIRA_PROJECT_KEY=$jiraProject"
    
    Set-Content ".env" $envContent
    
    Write-Host ""
    Write-Host "✅ .env file updated" -ForegroundColor Green
}

# Create config file if it doesn't exist
if (-not (Test-Path "jira-integration.config.js")) {
    Write-Host ""
    Write-Host "Creating jira-integration.config.js..." -ForegroundColor Yellow
    Copy-Item "jira-integration.config.example.js" "jira-integration.config.js"
    Write-Host "✅ Config file created" -ForegroundColor Green
}

Write-Host ""
Write-Host "🔧 Installing dependencies..." -ForegroundColor Cyan
npm install

Write-Host ""
Write-Host "🧪 Testing Jira connection..." -ForegroundColor Cyan
npm run jira:init

Write-Host ""
Write-Host "=" * 60
Write-Host "✨ Setup Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Run 'npm run jira:sync' to generate tests for all stories"
Write-Host "2. Run 'npm run jira:detect' to detect changes and run regression"
Write-Host "3. Run 'npm run jira:watch' to continuously monitor for changes"
Write-Host ""
Write-Host "For more information, see JIRA_INTEGRATION_QUICKSTART.md"
Write-Host ""
