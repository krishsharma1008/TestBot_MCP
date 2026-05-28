# Dead & Legacy Code Removal Log

Date: 2026-05-28  
Branch: `mcp-publish`

---

## Deleted Files

| File | Lines | Reason |
|---|---|---|
| `src/source-analysis.js` | ~327 | Complete dead module — `analyzeProjectSource` was never `require()`d anywhere in the codebase |
| `test-browser-open.js` | 44 | Ad-hoc debug script for manual Windows browser-open smoke test; not wired to any npm script, test runner, or CI workflow |
| `test-mcp-payload.js` | 36 | Ad-hoc debug script with a **hardcoded absolute path** to a local project (`c:\Users\ShreyesPrabhuDesai\PersProjects\thea`); not portable and not wired to anything |
| `scripts/localhost-smoke.js` | 153 | Orphaned dev smoke harness — not referenced in `package.json` scripts, `.github/workflows/`, or any automation; purely manual |

---

## Removed Methods from `src/webapp-client.js`

### Dead `ENDPOINT_TIMEOUTS_MS` entries

| Key | Value | Reason |
|---|---|---|
| `validate` | `6_000` | Only used by the removed `validateKey()` method |
| `ingest` | `60_000` | Only used by the removed `ingestTestRun()` method |
| `planExploration` | `600_000` | Only used by the removed `planExploration()` method |
| `generateTests` | `1_200_000` | Only used by the removed `generateTests()` method (own comment called it "legacy monolithic code-gen") |

### Dead Methods

| Method | Route | Reason |
|---|---|---|
| `validateKey()` | `POST /api/mcp-auth/validate` | Never called from `index.js`, `pipeline-worker.js`, or any other src file; API key validity is learned implicitly from 401 responses |
| `generateTests()` | `POST /api/generate-tests` | Legacy monolithic generation; fully replaced by `generateTestsForAgent()` + `generateTestsAsync()` + `pollGenerationJob()` — confirmed zero callers |
| `planExploration()` | `POST /api/exploration/plan` | Webapp route exists and works but this client method was never wired into the pipeline; no caller anywhere in the codebase |
| `ingestTestRun()` | `POST /api/test-runs/ingest` | Never called through `WebappClient`; `report-generator.js` calls the same endpoint via a raw `fetch` directly, bypassing this wrapper entirely |

---

## Removed from `module.exports` (functions remain in-module; internal callers unaffected)

### `src/browser-use-driver.js`

| Export | Reason |
|---|---|
| `resolvePython` | Only called internally inside `driveExploration()`; no external consumer |
| `isBrowserUseInstalled` | Only called internally inside `driveExploration()`; no external consumer |
| `calibrateStepTimeoutS` | Only called internally; no external consumer |
| `STEP_TIMEOUT_MIN_S` | Only used internally in `calibrateStepTimeoutS()`; no external consumer |
| `STEP_TIMEOUT_MAX_S` | Only used internally in `calibrateStepTimeoutS()`; no external consumer |
| `RUNNER_SCRIPT` | Only used internally inside `driveExploration()`; no external consumer |

### `src/model-ladder.js`

| Export | Reason |
|---|---|
| `isLadderAdvanceableError` | Only called internally inside `runWithLadder()`; no external consumer |

### `src/failure-triage/pipeline-error-classifier.js`

| Export | Reason |
|---|---|
| `CLASSIFIERS` | Only used internally inside `classifyPipelineErrorFromStderr()`; no external consumer |
| `mergeWithClassification` | Defined and referenced only within this module; no external consumer |

### `src/failure-triage/evidence-bundler.js`

| Export | Reason |
|---|---|
| `bundleOne` | Comment said "exported for unit tests" but no test file imports it; called internally by `bundleFailures()` |
| `extractTestBlock` | Only called internally inside `bundleOne()`; no external consumer |
| `findAcceptanceCriterion` | Only called internally inside `bundleOne()`; no external consumer |
| `findExplorationRoute` | Only called internally; no external consumer |
| `resolveTierAndRole` | Only called internally; no external consumer |
| `redact` | Only called internally; no external consumer |

### `src/failure-triage/agent-response.js`

| Export | Reason |
|---|---|
| `verifyPatchAgainstDisk` | Called internally inside `buildAgentResponse()`; no external consumer |
| `autoApplyKillSwitchOn` | Called internally inside `buildAgentResponse()`; no external consumer |

### `src/tier-isolation.js`

| Export | Reason |
|---|---|
| `TIER0_REL` | Only used internally inside `tierDirs()`; no external consumer |
| `TIER1_REL` | Only used internally inside `tierDirs()`; no external consumer |
| `LEGACY_REL` | Only used internally inside `tierDirs()`; no external consumer |
| `TIER0_FILENAMES` | Only used internally inside `isTier0Path()`; no external consumer |
| `mirrorInto` | Only called internally inside `syncLegacyView()`; no external consumer |

### `src/artifact-uploader.js`

| Export | Reason |
|---|---|
| `isCredentialFile` | Called internally (credential deny-list); no external consumer |
| `CREDENTIAL_DENY_PATTERNS` | Only used inside `isCredentialFile()`; no external consumer |
