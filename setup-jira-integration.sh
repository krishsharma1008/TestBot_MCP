#!/bin/bash

# Jira Integration Setup Script for Unix/Linux/Mac
# This script helps you set up the Jira integration quickly

echo ""
echo "🎯 Jira Integration Setup"
echo "============================================================"
echo ""

# Check if .env exists
if [ -f ".env" ]; then
    echo "✅ .env file found"
    read -p "Do you want to update Jira credentials? (y/N): " createNew
    if [ "$createNew" != "y" ] && [ "$createNew" != "Y" ]; then
        echo "Skipping .env update"
        skipEnv=true
    fi
else
    echo "Creating .env file..."
    cp .env.example .env
fi

if [ "$skipEnv" != "true" ]; then
    echo ""
    echo "📝 Please provide your Jira credentials:"
    echo ""
    
    read -p "Jira Base URL (e.g., https://yourcompany.atlassian.net): " jiraUrl
    read -p "Jira Email: " jiraEmail
    read -sp "Jira API Token: " jiraToken
    echo ""
    read -p "Jira Project Key (e.g., PROJ): " jiraProject
    
    # Update .env file
    sed -i.bak "s|JIRA_BASE_URL=.*|JIRA_BASE_URL=$jiraUrl|" .env
    sed -i.bak "s|JIRA_EMAIL=.*|JIRA_EMAIL=$jiraEmail|" .env
    sed -i.bak "s|JIRA_API_TOKEN=.*|JIRA_API_TOKEN=$jiraToken|" .env
    sed -i.bak "s|JIRA_PROJECT_KEY=.*|JIRA_PROJECT_KEY=$jiraProject|" .env
    rm .env.bak
    
    echo ""
    echo "✅ .env file updated"
fi

# Create config file if it doesn't exist
if [ ! -f "jira-integration.config.js" ]; then
    echo ""
    echo "Creating jira-integration.config.js..."
    cp jira-integration.config.example.js jira-integration.config.js
    echo "✅ Config file created"
fi

echo ""
echo "🔧 Installing dependencies..."
npm install

echo ""
echo "🧪 Testing Jira connection..."
npm run jira:init

echo ""
echo "============================================================"
echo "✨ Setup Complete!"
echo ""
echo "Next steps:"
echo "1. Run 'npm run jira:sync' to generate tests for all stories"
echo "2. Run 'npm run jira:detect' to detect changes and run regression"
echo "3. Run 'npm run jira:watch' to continuously monitor for changes"
echo ""
echo "For more information, see JIRA_INTEGRATION_QUICKSTART.md"
echo ""
