# @zapminds/mcp

**AI-powered end-to-end test generation and execution for any web app — directly from your IDE or Agentic CLI.**

Healix MCP connects your IDE (Cursor, Windsurf, Claude Code(cli,desktop)) to the Healix platform. Point it at your running app, and it automatically explores, generates, and runs a full  test suite — then surfaces results in the Healix dashboard.

---

## What it does

- **Explores your app** — automatically discovers pages, forms, user flows, and authentication patterns
- **Generates a full test suite** — produces Playwright tests covering public flows, authenticated flows per role, and backend/API contracts
- **Runs the tests** — executes tests in three tiers: unauthenticated, per-role authenticated, and API/backend
- **Triages failures** — classifies each failure with a root cause and suggested fix
- **generates artifacts** — screenshots, videos, and traces are stored and linked in your dashboard
- **Opens your results** — after every run, a deep-link takes you straight to the run report

---

## Setup

### 1. Get an API key

Sign in to the Healix dashboard and generate an API key from your account settings.

### 2. Add to your IDE

Paste this into your IDE's MCP config file:

```json
{
  "mcpServers": {
    "healix": {
      "command": "npx",
      "args": ["-y", "@zapminds/mcp"],
      "env": {
        "HEALIX_API_KEY": "your-api-key-here",
        "HEALIX_API_URL": "https://your-healix-webapp-url.com"
      }
    }
  }
}
```

| IDE | Config file |
|-----|-------------|
| Cursor | `~/.cursor/mcp.json` |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` |
| Claude Desktop (Mac) | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Claude Desktop (Windows) | `%APPDATA%\Claude\claude_desktop_config.json` |
| VS Code | `.vscode/mcp.json` in your workspace |

### 3. Run

In your IDE, ask the AI assistant:

> "Test this project using Healix mcp"

Healix will auto-detect your app's port and framework, then kick off the full process.

---

## How it works

```
Your IDE
   └─► healix_test_my_app
            │
            ├─ 1. Auto-detect your app (port, framework, start command)
            ├─ 2. Launch your app
            ├─ 3. Explore — discover pages, flows, and auth patterns
            ├─ 4. Generate tests — full Playwright suite via Healix AI
            ├─ 5. Inject credentials — per-role auth state
            ├─ 6. Run tests
            │       ├─ Tier A: Public (no auth)
            │       ├─ Tier B: Authenticated (one project per role)
            │       └─ Tier C: API / backend
            ├─ 7. Triage failures — classify root cause + suggest fixes
            ├─ 8. Generate artifacts — screenshots, videos, traces
            └─ 9. Open dashboard → your run report
```

All AI processing happens on the Healix platform. The MCP package installed in your IDE is a thin client — it only needs your `HEALIX_API_KEY`.

---

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `HEALIX_API_KEY` | Yes | Your API key from the Healix dashboard |
| `HEALIX_API_URL` | Yes | Base URL of the Healix webapp instance |

---

## Requirements

- Node.js ≥ 18
- python (optional for better exploration)
- A running web app to test
- A Healix API key
