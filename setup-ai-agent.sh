#!/bin/bash
# AI Agent Setup Script for Unix/Linux/Mac

echo "🤖 AI Agent Setup Wizard"
echo "============================================================"
echo ""

# Check if Node.js is installed
echo "Checking Node.js installation..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js first."
    echo "Download from: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node --version)
echo "✅ Node.js $NODE_VERSION found"

# Install dependencies
echo ""
echo "Installing dependencies..."
npm install
if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi
echo "✅ Dependencies installed"

# Create .env file if it doesn't exist
echo ""
if [ -f ".env" ]; then
    echo "⚠️  .env file already exists"
    read -p "Do you want to reconfigure? (y/N): " overwrite
    if [ "$overwrite" != "y" ] && [ "$overwrite" != "Y" ]; then
        echo "Skipping .env configuration"
        exit 0
    fi
fi

echo "Setting up AI provider configuration..."
echo ""

# Choose AI provider
echo "Select your AI provider:"
echo "1. OpenAI (GPT-4) - Recommended for automation"
echo "2. Anthropic (Claude) - Great for complex analysis"
echo "3. Windsurf IDE - No API key needed (manual mode)"
echo ""
read -p "Enter choice (1-3): " provider_choice

provider=""
api_key=""
model=""

case $provider_choice in
    1)
        provider="openai"
        model="gpt-4"
        echo ""
        echo "Get your OpenAI API key from: https://platform.openai.com/api-keys"
        read -p "Enter your OpenAI API key: " api_key
        ;;
    2)
        provider="anthropic"
        model="claude-3-5-sonnet-20241022"
        echo ""
        echo "Get your Anthropic API key from: https://console.anthropic.com/"
        read -p "Enter your Anthropic API key: " api_key
        ;;
    3)
        provider="windsurf"
        model=""
        echo ""
        echo "✅ Windsurf mode selected (no API key needed)"
        ;;
    *)
        echo "❌ Invalid choice"
        exit 1
        ;;
esac

# GitHub token (optional)
echo ""
echo "GitHub Personal Access Token (optional, for PR creation)"
echo "Get token from: https://github.com/settings/tokens"
echo "Required scopes: repo, workflow"
echo "Press Enter to skip if you don't want PR creation"
read -p "Enter your GitHub token (or press Enter to skip): " github_token

# Create .env file
echo ""
echo "Creating .env file..."

cat > .env << EOF
# AI Provider Configuration
AI_PROVIDER=$provider

EOF

if [ -n "$api_key" ]; then
    cat >> .env << EOF
# AI API Key
AI_API_KEY=$api_key

EOF
fi

if [ -n "$model" ]; then
    cat >> .env << EOF
# AI Model
AI_MODEL=$model

EOF
fi

if [ -n "$github_token" ]; then
    cat >> .env << EOF
# GitHub Personal Access Token
GITHUB_TOKEN=$github_token

EOF
fi

cat >> .env << EOF
# Base URL for tests
BASE_URL=http://localhost:8000
EOF

echo "✅ .env file created"

# Test configuration
echo ""
echo "Testing configuration..."
if [ -f ".env" ]; then
    echo "✅ Configuration file exists"
else
    echo "❌ Configuration file not created"
    exit 1
fi

# Summary
echo ""
echo "============================================================"
echo "✅ Setup Complete!"
echo "============================================================"
echo ""
echo "Configuration Summary:"
echo "  AI Provider: $provider"
[ -n "$model" ] && echo "  AI Model: $model"
if [ -n "$github_token" ]; then
    echo "  GitHub PR: Enabled"
else
    echo "  GitHub PR: Disabled"
fi
echo ""
echo "Next Steps:"
echo "  1. Run tests: npm test"
echo "  2. Run AI agent: npm run ai-agent"
echo "  3. View reports in: ai-agent-reports/"
echo ""
echo "Documentation:"
echo "  Quick Start: AI_AGENT_QUICKSTART.md"
echo "  Full Docs: AI_AGENT_README.md"
echo "  Windsurf Guide: WINDSURF_INTEGRATION.md"
echo ""
echo "Happy automated fixing! 🚀"
