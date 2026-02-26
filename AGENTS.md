# AGENTS.md

## Cursor Cloud specific instructions

### Project Overview
Testbot MCP is an AI-powered E2E testing agent built on the Model Context Protocol (MCP). It is an npm workspace with three main components: `testbot-mcp/` (core MCP server), `dashboard/` (static HTML results viewer), and `examples/sample-project/` (demo Express app with Playwright tests).

### Services

| Service | Start Command | Port | Notes |
|---|---|---|---|
| **Testbot MCP Server** | `node testbot-mcp/src/index.js` | stdio (no port) | Communicates via MCP stdio transport; exits when stdin closes |
| **Sample Express App** | `cd examples/sample-project && node src/index.js` | 3000 | In-memory data store; target app for Playwright tests |
| **Dashboard** | `python3 -m http.server 8888` (from repo root) | 8888 | Access at `http://localhost:8888/dashboard/public/index.html` |

### Running Tests
- **Playwright E2E tests** (sample project): `cd examples/sample-project && npx playwright test`
  - The Playwright config auto-starts the sample Express app via `webServer.command` when not already running.
  - If the sample app is already running on port 3000, tests will reuse it (`reuseExistingServer: true` outside CI).
- **testbot-mcp** has no automated tests yet (`npm test` just echoes a placeholder).

### Gotchas
- The workspace root and `examples/sample-project/` use **different Playwright versions** (root uses `@playwright/mcp ^0.0.61`, sample project uses `@playwright/test ^1.57.0`). Both need their Playwright browsers installed separately: run `npx playwright install --with-deps chromium` from both the workspace root and `examples/sample-project/`.
- No ESLint or linting configuration exists in this repo.
- AI features (test generation, failure analysis) require API keys (`OPENAI_API_KEY`, `SARVAM_API_KEY`) set in `.env`. The core test-running flow works without them.
- The dashboard loads a `report.json` from `dashboard/public/`; a pre-existing sample report is committed for demo purposes.
