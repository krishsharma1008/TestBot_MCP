# @zapminds/mcp — Publish Log

**Date:** 2026-05-28  
**Package:** `@zapminds/mcp`  
**Version:** `2.0.0`  
**Executor:** Claude Code (claude-sonnet-4-6)

---

## Pre-flight checks

- `.npmignore` confirmed: `dist/` line removed ✅
- `package.json` `"files"`: `bin/`, `dist/`, `dashboard/`, `scripts/`, `mcp-launcher.js` ✅
- `bin/healix-mcp.js` requires `../dist/index.js` (class export) ✅
- `prepublishOnly` runs `npm run build` automatically ✅

---

## Step 1 — Install esbuild

**Command:** `npm install --save-dev esbuild` (in `testbot-mcp/`)

**Output:**
```
added 1 package, and audited 713 packages in 6s
186 packages are looking for funding
7 vulnerabilities (2 moderate, 5 high)
```

**Status:** ✅ esbuild installed successfully

---

## Step 2 — Build bundle

**Command:** `npm run build` (in `testbot-mcp/`)

**Output:**
```
> @zapminds/mcp@2.0.0 build
> esbuild src/index.js --bundle --platform=node --target=node18 --outfile=dist/index.js --minify --format=cjs --external:sharp --external:@playwright/test --external:@playwright/mcp --external:fsevents --external:bufferutil --external:utf-8-validate

  dist\index.js  1.1mb

Done in 200ms
```

**Status:** ✅ Bundle created — `dist/index.js` 1.1 MB

---

## Step 3 — Audit tarball contents (dry run)

**Command:** `npm pack --dry-run` (in `testbot-mcp/`)

**Output:**
```
npm notice 📦  @zapminds/mcp@2.0.0
npm notice Tarball Contents
npm notice 8.2kB    README.md
npm notice 229B     bin/healix-mcp.js
npm notice 39.7kB   dashboard/public/config-form.html
npm notice 10.5kB   dist/agent-context-requester.js        ← STALE
npm notice 19.5kB   dist/artifact-uploader.js              ← STALE
npm notice 16.9kB   dist/auto-detector.js                  ← STALE
npm notice 150B     dist/bin/healix-mcp.js                 ← STALE (wrong require path)
npm notice 15.4kB   dist/config-ui-launcher.js             ← STALE
npm notice 76.3kB   dist/context-gatherer.js               ← STALE
npm notice 5.7kB    dist/dashboard-launcher.js             ← STALE
npm notice 39.7kB   dist/dashboard/public/config-form.html ← STALE
npm notice 1.2MB    dist/index.js                          ← CORRECT (new bundle)
npm notice 367.3kB  dist/index.js.map                      ← STALE (source map)
npm notice 7.2kB    dist/logger.js                         ← STALE
npm notice 489B     dist/mcp-launcher.js                   ← STALE
npm notice ...more stale files...
npm notice 19.2kB   scripts/browser_use_runner.py
npm notice package size: 497.9 kB / unpacked: 2.2 MB / total files: 26
```

**Status:** ⚠️ ISSUE — stale individual source files from a previous build still in `dist/`. Only `dist/index.js` should exist. Also `dist/index.js.map` (source map leak) and `dist/bin/healix-mcp.js` (wrong require path) are present.

**Resolution:** Clean `dist/` entirely, then rebuild.

---

## Step 3b — Clean dist/ and rebuild

**Commands:**
1. `Remove-Item -Recurse -Force dist/` (in `testbot-mcp/`)
2. `npm run build`

**Output:**
```
> @zapminds/mcp@2.0.0 build
> esbuild src/index.js --bundle --platform=node --target=node18 --outfile=dist/index.js --minify --format=cjs ...

  dist\index.js  1.1mb

Done in 96ms
```

**Status:** ✅ Clean build — only `dist/index.js` (1.1 MB) produced

---

## Step 3c — Re-audit tarball (after clean build)

**Command:** `npm pack --dry-run`

**Output:**
```
npm notice 📦  @zapminds/mcp@2.0.0
npm notice Tarball Contents
npm notice 8.2kB    README.md
npm notice 229B     bin/healix-mcp.js
npm notice 39.7kB   dashboard/public/config-form.html
npm notice 1.2MB    dist/index.js
npm notice 488B     mcp-launcher.js
npm notice 1.4kB    package.json
npm notice 19.2kB   scripts/browser_use_runner.py
npm notice Tarball Details
npm notice name:          @zapminds/mcp
npm notice version:       2.0.0
npm notice filename:      zapminds-mcp-2.0.0.tgz
npm notice package size:  294.7 kB
npm notice unpacked size: 1.2 MB
npm notice total files:   7
```

**Checks:**
- ✅ `dist/index.js` present (1.2 MB bundle)
- ✅ `bin/healix-mcp.js` present (npm bin shim)
- ✅ `scripts/browser_use_runner.py` present
- ✅ `dashboard/public/config-form.html` present
- ✅ No `src/` files
- ✅ No stale `dist/` files
- ✅ No source maps
- ✅ Total 7 files — clean

**Status:** ✅ Tarball contents verified

---

## Step 4 — npm login

**Command:** `npm login` (interactive — run manually)

**npm user:** `seyerhs`

**Status:** ✅ Logged in successfully

---

## Step 5 — Publish

**Command:** `npm publish --access public` (in `testbot-mcp/`)

**prepublishOnly triggered:** rebuild ran cleanly (dist\index.js 1.1mb, 7 files, 294.7 kB packed)

**Error:**
```
npm error code EOTP
npm error This operation requires a one-time password from your authenticator.
npm error You can provide a one-time password by passing --otp=<code> to the command you ran.
```

**Status:** ⏸ PAUSED — 2FA OTP required. User must re-run with `--otp=XXXXXX`.

---

## Step 5b — Publish (retry with browser-based 2FA)

**Command:** `npm publish --access public` (in `testbot-mcp/`)

**Output:**
```
> @zapminds/mcp@2.0.0 prepublishOnly
> npm run build

> @zapminds/mcp@2.0.0 build
> esbuild src/index.js --bundle --platform=node --target=node18 --outfile=dist/index.js --minify --format=cjs ...

  dist\index.js  1.1mb

Done in 81ms

npm notice 📦  @zapminds/mcp@2.0.0
npm notice Tarball Contents
npm notice 8.2kB    README.md
npm notice 229B     bin/healix-mcp.js
npm notice 39.7kB   dashboard/public/config-form.html
npm notice 1.2MB    dist/index.js
npm notice 488B     mcp-launcher.js
npm notice 1.4kB    package.json
npm notice 19.2kB   scripts/browser_use_runner.py
npm notice Tarball Details
npm notice name:          @zapminds/mcp
npm notice version:       2.0.0
npm notice filename:      zapminds-mcp-2.0.0.tgz
npm notice package size:  294.7 kB
npm notice unpacked size: 1.2 MB
npm notice shasum:        0176cc5018e022e41cfcc8ca3479e148c75374e0
npm notice integrity:     sha512-6dYRI5veESEnv[...]TChFzMZTSXsaA==
npm notice total files:   7

npm notice Publishing to https://registry.npmjs.org/ with tag latest and public access
Authenticate your account at:
https://www.npmjs.com/auth/cli/4ec88765-fb07-4efa-a1ff-150da4584951
Press ENTER to open in the browser...

+ @zapminds/mcp@2.0.0
```

**Status:** ✅ PUBLISHED SUCCESSFULLY

---

---

## Publish 2.0.1 — README update

**Reason:** Updated README (removed code/OpenAI references, rewrote as user-facing setup + how-it-works doc)

**Version bump:** `2.0.0` → `2.0.1` via `npm version patch`

**Tarball:**
```
npm notice 📦  @zapminds/mcp@2.0.1
npm notice 3.4kB    README.md
npm notice 229B     bin/healix-mcp.js
npm notice 39.7kB   dashboard/public/config-form.html
npm notice 1.2MB    dist/index.js
npm notice 488B     mcp-launcher.js
npm notice 1.4kB    package.json
npm notice 19.2kB   scripts/browser_use_runner.py
npm notice package size: 293.0 kB / unpacked: 1.2 MB / total files: 7

+ @zapminds/mcp@2.0.1
```

**Status:** ✅ PUBLISHED SUCCESSFULLY

---

## Final Summary

| Step | Result |
|------|--------|
| Install esbuild | ✅ |
| Build (`dist/index.js` 1.1 MB) | ✅ |
| Fix: removed stale `dist/` files | ✅ |
| Tarball audit (7 files, 294.7 kB) | ✅ |
| npm login (user: `seyerhs`) | ✅ |
| npm publish with 2FA | ✅ |
| README rewrite (no code/OpenAI refs) | ✅ |
| Publish 2.0.1 with updated README | ✅ |

**Package live at:** https://www.npmjs.com/package/@zapminds/mcp  
**Latest version:** `2.0.1`  
**Tag:** `latest`  
**Published:** 2026-05-28

