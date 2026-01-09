#!/usr/bin/env pwsh
# AI Agent Setup Script for Windows

Write-Host "🤖 AI Agent Setup Wizard" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host ""

# Check if Node.js is installed
Write-Host "Checking Node.js installation..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js $nodeVersion found" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js not found. Please install Node.js first." -ForegroundColor Red
    Write-Host "Download from: https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

# Install dependencies
Write-Host ""
Write-Host "Installing dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Dependencies installed" -ForegroundColor Green

# Create .env file if it doesn't exist
Write-Host ""
if (Test-Path ".env") {
    Write-Host "⚠️  .env file already exists" -ForegroundColor Yellow
    $overwrite = Read-Host "Do you want to reconfigure? (y/N)"
    if ($overwrite -ne "y" -and $overwrite -ne "Y") {
        Write-Host "Skipping .env configuration" -ForegroundColor Yellow
        exit 0
    }
}

Write-Host "Setting up AI provider configuration..." -ForegroundColor Yellow
Write-Host ""

# Choose AI provider
Write-Host "Select your AI provider:" -ForegroundColor Cyan
Write-Host "1. OpenAI (GPT-4) - Recommended for automation"
Write-Host "2. Anthropic (Claude) - Great for complex analysis"
Write-Host "3. Windsurf IDE - No API key needed (manual mode)"
Write-Host ""
$providerChoice = Read-Host "Enter choice (1-3)"

$provider = ""
$apiKey = ""
$model = ""

switch ($providerChoice) {
    "1" {
        $provider = "openai"
        $model = "gpt-4"
        Write-Host ""
        Write-Host "Get your OpenAI API key from: https://platform.openai.com/api-keys" -ForegroundColor Yellow
        $apiKey = Read-Host "Enter your OpenAI API key"
    }
    "2" {
        $provider = "anthropic"
        $model = "claude-3-5-sonnet-20241022"
        Write-Host ""
        Write-Host "Get your Anthropic API key from: https://console.anthropic.com/" -ForegroundColor Yellow
        $apiKey = Read-Host "Enter your Anthropic API key"
    }
    "3" {
        $provider = "windsurf"
        $model = ""
        Write-Host ""
        Write-Host "✅ Windsurf mode selected (no API key needed)" -ForegroundColor Green
    }
    default {
        Write-Host "❌ Invalid choice" -ForegroundColor Red
        exit 1
    }
}

# GitHub token (optional)
Write-Host ""
Write-Host "GitHub Personal Access Token (optional, for PR creation)" -ForegroundColor Cyan
Write-Host "Get token from: https://github.com/settings/tokens" -ForegroundColor Yellow
Write-Host "Required scopes: repo, workflow" -ForegroundColor Yellow
Write-Host "Press Enter to skip if you don't want PR creation" -ForegroundColor Gray
$githubToken = Read-Host "Enter your GitHub token (or press Enter to skip)"

# Create .env file
Write-Host ""
Write-Host "Creating .env file..." -ForegroundColor Yellow

$envContent = @"
# AI Provider Configuration
AI_PROVIDER=$provider

"@

if ($apiKey) {
    $envContent += @"
# AI API Key
AI_API_KEY=$apiKey

"@
}

if ($model) {
    $envContent += @"
# AI Model
AI_MODEL=$model

"@
}

if ($githubToken) {
    $envContent += @"
# GitHub Personal Access Token
GITHUB_TOKEN=$githubToken

"@
}

$envContent += @"
# Base URL for tests
BASE_URL=http://localhost:8000
"@

Set-Content -Path ".env" -Value $envContent
Write-Host "✅ .env file created" -ForegroundColor Green

# Test configuration
Write-Host ""
Write-Host "Testing configuration..." -ForegroundColor Yellow
if (Test-Path ".env") {
    Write-Host "✅ Configuration file exists" -ForegroundColor Green
} else {
    Write-Host "❌ Configuration file not created" -ForegroundColor Red
    exit 1
}

# Summary
Write-Host ""
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host "✅ Setup Complete!" -ForegroundColor Green
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host ""
Write-Host "Configuration Summary:" -ForegroundColor Cyan
Write-Host "  AI Provider: $provider" -ForegroundColor White
if ($model) {
    Write-Host "  AI Model: $model" -ForegroundColor White
}
if ($githubToken) {
    Write-Host "  GitHub PR: Enabled" -ForegroundColor White
} else {
    Write-Host "  GitHub PR: Disabled" -ForegroundColor White
}
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "  1. Run tests: npm test" -ForegroundColor White
Write-Host "  2. Run AI agent: npm run ai-agent" -ForegroundColor White
Write-Host "  3. View reports in: ai-agent-reports/" -ForegroundColor White
Write-Host ""
Write-Host "Documentation:" -ForegroundColor Cyan
Write-Host "  Quick Start: AI_AGENT_QUICKSTART.md" -ForegroundColor White
Write-Host "  Full Docs: AI_AGENT_README.md" -ForegroundColor White
Write-Host "  Windsurf Guide: WINDSURF_INTEGRATION.md" -ForegroundColor White
Write-Host ""
Write-Host "Happy automated fixing! 🚀" -ForegroundColor Green
