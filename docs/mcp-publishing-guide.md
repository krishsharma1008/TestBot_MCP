# MCP Publishing & Release Guide

Developer reference for publishing, versioning, and managing `@zapminds/healix-mcp` on npm.

---

## Overview

This monorepo contains two packages:

```
TestBot_MCP/
├── testbot-mcp/    ← npm package (@zapminds/healix-mcp) — runs on the user's machine
└── webapp/         ← Next.js backend — runs on Vercel/RemoteServer
```

**The MCP package does not run on a server.** It is a CLI tool that AI IDEs (Claude, Cursor, Windsurf) download via `npx` and run locally. It calls your Healix webapp over HTTP using `HEALIX_API_URL` + `HEALIX_API_KEY`.

---

## Prerequisites

- npm account at [npmjs.com](https://npmjs.com)
- Member of the `zapminds` npm org
- Logged in locally: `npm login` (verify with `npm whoami`)
- Working directory: always `cd testbot-mcp` before any npm commands

---

## 1. Publishing a New Version

### Step 1 — Bump the version

```bash
cd testbot-mcp

npm version patch   # bug fixes:    2.0.1 → 2.0.2
npm version minor   # new features: 2.0.1 → 2.1.0
npm version major   # breaking:     2.0.1 → 3.0.0
```

Use `--no-git-tag-version` if you want to control the commit/tag manually (see Section 5).

### Step 2 — Publish to npm

```bash
npm publish
```

`prepublishOnly` runs `esbuild` automatically before uploading. Only the files listed in the `files` field of `package.json` are included:

```
bin/        ← healix-mcp CLI entrypoint
dist/       ← esbuild bundle
dashboard/
scripts/
mcp-launcher.js
```

### Step 3 — Push to GitHub

```bash
git push && git push --tags
```

Use prefixed tags to keep the monorepo history clean (see Section 5).

---

## 2. Safe Release Workflow (Recommended)

Publish to a `next` tag first so `latest` is never affected until you're confident the release works.

### Publish as a pre-release

```bash
cd testbot-mcp
npm version patch --no-git-tag-version   # bumps package.json only
npm publish --tag next
```

### Test it yourself

```bash
npx @zapminds/healix-mcp@next
```

Configure your IDE to use `@zapminds/healix-mcp@next` temporarily and verify the new version works end-to-end.

### Promote to latest (if it works)

```bash
npm dist-tag add @zapminds/healix-mcp@2.0.2 latest
npm dist-tag rm @zapminds/healix-mcp next

# Commit and tag
git add testbot-mcp/package.json
git commit -m "chore: release @zapminds/healix-mcp v2.0.2"
git tag mcp-v2.0.2
git push && git push --tags
```

### Discard if it breaks

```bash
npm deprecate @zapminds/healix-mcp@2.0.2 "bad release, do not use"
# latest tag was never changed — existing users are unaffected
```

---

## 3. Rolling Back a Bad Release

If a bad version was already promoted to `latest`:

### Step 1 — Point `latest` back to the working version

```bash
npm dist-tag add @zapminds/healix-mcp@2.0.1 latest
```

Users running `npx @zapminds/healix-mcp` (no version pinned) immediately get `2.0.1` again.

### Step 2 — Deprecate the bad version

```bash
npm deprecate @zapminds/healix-mcp@2.0.2 "broken release, reverted to 2.0.1"
```

Users who somehow have `2.0.2` will see a warning when they next install.

> **Note:** npm does not allow unpublishing after 72 hours. Deprecation + re-tagging is the correct rollback strategy.

---

## 4. Version Tags Quick Reference

| Command | What it does |
|---------|-------------|
| `npm dist-tag ls @zapminds/healix-mcp` | List all tags and which version they point to |
| `npm dist-tag add @zapminds/healix-mcp@X.Y.Z latest` | Promote a version to latest |
| `npm dist-tag add @zapminds/healix-mcp@X.Y.Z next` | Tag a version as next |
| `npm dist-tag rm @zapminds/healix-mcp next` | Remove the next tag |
| `npm deprecate @zapminds/healix-mcp@X.Y.Z "reason"` | Warn users off a version |
| `npm info @zapminds/healix-mcp` | Inspect published package metadata |
| `npm pack --dry-run` | Preview what will be uploaded without publishing |

---

## 5. Git Tagging in a Monorepo

Since `webapp/` and `testbot-mcp/` share one repo, prefix tags to avoid ambiguity:

```bash
# After bumping version, instead of letting npm version auto-tag:
npm version patch --no-git-tag-version

git add testbot-mcp/package.json
git commit -m "chore: bump @zapminds/healix-mcp to 2.0.2"
git tag mcp-v2.0.2        # ← prefixed tag, clearly scoped to MCP
git push && git push --tags
npm publish
```

| Tag format | Scope |
|------------|-------|
| `mcp-v2.0.2` | MCP npm package release |
| `webapp-v1.3.0` | Webapp release (if ever needed) |

---

## 6. Vercel & Webapp Deploys

The webapp deploys independently of the MCP package. Vercel is configured to watch `webapp/` only — changes to `testbot-mcp/` do not trigger a deploy.

When you change a webapp API route that the MCP calls, do both in the same PR so they stay in sync. Deploy the webapp first, then publish the MCP package.

---

## 7. How End Users Install & Configure

Users add this block to their IDE config (e.g. `claude_desktop_config.json` for Claude Desktop):

```json
{
  "mcpServers": {
    "healix": {
      "command": "npx",
      "args": ["-y", "@zapminds/healix-mcp"],
      "env": {
        "HEALIX_API_KEY": "their-key-here",
        "HEALIX_API_URL": "https://your-vercel-app.vercel.app"
      }
    }
  }
}
```

- `npx` downloads the latest version automatically on first use and caches it
- No version pinned = users always get `latest` transparently on IDE restart
- Users obtain their `HEALIX_API_KEY` from the Healix webapp dashboard

---

## 8. Checklist Before Every Release

- [ ] Run tests: `npm run test` inside `testbot-mcp/`
- [ ] Verify the build: `npm run build` — confirm `dist/index.js` is generated
- [ ] Dry-run the publish: `npm pack --dry-run` — confirm only intended files are included
- [ ] Check `HEALIX_API_URL` in your Vercel deployment is live and healthy
- [ ] If API routes changed, deploy webapp before publishing the MCP package
- [ ] Use `--tag next` for any release you're not 100% confident in

---

## 9. Scenario Cheatsheet

| Scenario | Commands |
|----------|----------|
| Routine bug fix | `npm version patch` → `npm publish` → `git push --tags` |
| New feature | `npm version minor` → `npm publish` → `git push --tags` |
| Breaking change | `npm version major` → `npm publish` → update user docs |
| Risky / uncertain release | `npm publish --tag next` → test → `npm dist-tag add ... latest` |
| Roll back latest | `npm dist-tag add @zapminds/healix-mcp@<good-version> latest` |
| Warn users off a version | `npm deprecate @zapminds/healix-mcp@<bad-version> "reason"` |
| Check what's live | `npm info @zapminds/healix-mcp` |
| Check all tags | `npm dist-tag ls @zapminds/healix-mcp` |
