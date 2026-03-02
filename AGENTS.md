# AGENTS.md

## Cursor Cloud specific instructions

### Overview

TestBot MCP is an AI-powered MCP (Model Context Protocol) testing agent. The repo is an npm workspace with three main packages:

| Package | Path | Description |
|---------|------|-------------|
| `@testbot/mcp` | `testbot-mcp/` | Core MCP server (Node.js, stdio transport) |
| `@testbot/dashboard` | `dashboard/` | Static HTML/CSS/JS dashboard for test results |
| Sample Express App | `examples/sample-project/` | Demo app used for testing (not in workspace) |

There is also a static marketing website in `website/` (plain HTML, no build step).

### Running services

- **MCP server**: `node testbot-mcp/src/index.js` — uses stdio transport, so it starts and waits for MCP messages on stdin. It will print "Testbot MCP server started" to stderr on success.
- **Sample Express app**: `node examples/sample-project/src/index.js` — runs on port 3000.
- **Dashboard**: Serve `dashboard/public/` with any static file server, e.g. `npx serve dashboard/public -p 8080`.

### Testing

- Playwright tests live in `examples/sample-project/tests/`. Run with: `cd examples/sample-project && npx playwright test`
- The Playwright config (`examples/sample-project/playwright.config.js`) has a `webServer` block that auto-starts the Express app via `npm start`, so you can run tests without manually starting the server.
- Only Chromium is needed for tests (configured as "Desktop Chrome" project).

### Key gotchas

- The `examples/sample-project/` directory is **not** part of the npm workspaces defined in the root `package.json`. Its dependencies must be installed separately: `cd examples/sample-project && npm install`.
- Playwright browsers must be installed separately: `cd examples/sample-project && npx playwright install --with-deps chromium`.
- The MCP server test script is a no-op (`echo "No tests yet"`), so `npm test` at the root only echoes that message.
- AI features (OpenAI test generation, Sarvam/Cascade/Windsurf failure analysis) require API keys set in `.env`. The app gracefully degrades without them — template-based test generation is used as a fallback.
- Environment variables are configured via `.env` files; see `.env.example` at both the repo root and `testbot-mcp/.env.example`.
