# Healix — User Setup Guide

Everything you need to install and run Healix in your AI IDE.

---

## System Requirements

| Requirement | Minimum | Notes |
|-------------|---------|-------|
| Node.js | 18+ | Required. [Download here](https://nodejs.org) |
| Python | 3.8+ | Recommended. Enables AI-assisted browser exploration |
| Operating System | Windows 10/11, macOS 12+, Linux | |

> **Python is not mandatory.** If Python is missing, Healix falls back to a simpler browser exploration mode. You can still generate and run tests — AI-assisted exploration just won't be available.

---

## Step 1 — Get Your API Key

1. Sign up or log in at your Healix dashboard
2. Go to **API Keys** in the sidebar
3. Create a new key and copy it — you'll need it in Step 2

---

## Step 2 — Add Healix to Your IDE

Choose your IDE below and add the config block. Replace `your-key-here` with the API key from Step 1.

### Claude Desktop

File location:
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "healix": {
      "command": "npx",
      "args": ["-y", "@zapminds/mcp"],
      "env": {
        "HEALIX_API_KEY": "your-key-here",
        "HEALIX_DASHBOARD_URL": "https://healix.vercel.app"
      }
    }
  }
}
```

### Cursor

File location: `.cursor/mcp.json` in your project folder, or `~/.cursor/mcp.json` globally.

```json
{
  "mcpServers": {
    "healix": {
      "command": "npx",
      "args": ["-y", "@zapminds/mcp"],
      "env": {
        "HEALIX_API_KEY": "your-key-here",
        "HEALIX_DASHBOARD_URL": "https://healix.vercel.app"
      }
    }
  }
}
```

### Claude Code (Terminal / CLI)

File location:
- **Project-level:** `.claude/settings.json` in your project root (only applies to that project)
- **Global:** `~/.claude.json` (applies to all projects)

```json
{
  "mcpServers": {
    "healix": {
      "command": "npx",
      "args": ["-y", "@zapminds/mcp"],
      "env": {
        "HEALIX_API_KEY": "your-key-here",
        "HEALIX_DASHBOARD_URL": "https://healix.vercel.app"
      }
    }
  }
}
```

Or add it directly from the terminal:

```bash
claude mcp add healix -- npx -y @zapminds/mcp
```

Then set the environment variables in the config file manually.

### Windsurf

File location: `~/.codeium/windsurf/mcp_config.json`

```json
{
  "mcpServers": {
    "healix": {
      "command": "npx",
      "args": ["-y", "@zapminds/mcp"],
      "env": {
        "HEALIX_API_KEY": "your-key-here",
        "HEALIX_DASHBOARD_URL": "https://healix.vercel.app"
      }
    }
  }
}
```

After saving, **restart your IDE** for the changes to take effect.

---

## Step 3 — Install Playwright Browsers

Healix uses Playwright to run tests. Install the required browser binaries once:

```bash
npx playwright install chromium
```

---

## Step 4 — Verify It's Working

In your IDE, ask the AI:

> "Test my app using Healix"

Healix will auto-detect your project, launch your app, and begin the test generation pipeline.

---

## Optional — Enable AI-Assisted Browser Exploration

If Python is installed, Healix uses `browser-use` to explore your app more intelligently. This happens automatically — Healix will install `browser-use` via pip on first run if Python is available on your PATH.

To check if Python is on your PATH:

```bash
python --version   # or python3 --version
```

If it's not installed, [download Python here](https://www.python.org/downloads/). Make sure to check **"Add Python to PATH"** during installation on Windows.

---

## Troubleshooting

**`healix` tool doesn't appear in my IDE**
- Ensure you restarted the IDE after saving the config
- Check the config file has valid JSON (no trailing commas, correct brackets)
- Confirm Node.js 18+ is installed: `node --version`

**Tests fail with browser errors**
- Run `npx playwright install chromium` and try again

**AI browser exploration isn't working**
- Check Python is installed and on PATH: `python --version`
- Try manually: `pip install browser-use`

**`HEALIX_API_KEY` is invalid or unauthorized**
- Generate a new key from your Healix dashboard
- Make sure there are no extra spaces when pasting the key into the config

---

## Updating Healix

No action needed. `npx` always fetches the latest version when your IDE starts. You will automatically get updates.

To pin a specific version (not recommended):

```json
"args": ["-y", "@zapminds/mcp@2.0.1"]
```
