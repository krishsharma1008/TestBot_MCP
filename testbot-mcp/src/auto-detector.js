/**
 * Auto-Detector
 * Automatically detects project settings from files and configuration.
 * Supports JavaScript/TypeScript, Python, Java, Go, Ruby, Rust, PHP, and more.
 */

const fs = require('fs');
const path = require('path');
const Logger = require('./logger');

class AutoDetector {
  findFileRelative(projectPath, filename, maxDepth = 3) {
    const skipDirs = new Set([
      '.git',
      'node_modules',
      '.venv',
      'venv',
      '__pycache__',
      '.pytest_cache',
      '.mypy_cache',
      '.next',
      'dist',
      'build',
    ]);

    const walk = (currentDir, depth) => {
      if (depth > maxDepth) return null;

      let entries = [];
      try {
        entries = fs.readdirSync(currentDir, { withFileTypes: true });
      } catch {
        return null;
      }

      for (const entry of entries) {
        if (entry.isFile() && entry.name === filename) {
          return path.relative(projectPath, path.join(currentDir, entry.name));
        }
      }

      for (const entry of entries) {
        if (!entry.isDirectory() || skipDirs.has(entry.name)) continue;
        const result = walk(path.join(currentDir, entry.name), depth + 1);
        if (result) return result;
      }

      return null;
    };

    return walk(projectPath, 0);
  }

  /**
   * Detect project settings from the given path
   * @param {string} projectPath - Path to the project root
   * @returns {Object} Detected settings
   */
  async detect(projectPath) {
    const resolvedPath = path.resolve(projectPath);

    // Detect language and ecosystem first
    const langInfo = this.detectLanguageAndEcosystem(resolvedPath);

    // Read various config files
    const packageJson = this.readPackageJson(resolvedPath);
    const playwrightConfig = this.readPlaywrightConfig(resolvedPath);
    const envFile = this.readEnvFile(resolvedPath);

    // Detect settings (language-aware)
    const projectName = this.detectProjectName(resolvedPath, packageJson, langInfo);
    const port = this.detectPort(packageJson, envFile, playwrightConfig, langInfo, resolvedPath);
    const baseURL = this.detectBaseURL(packageJson, envFile, playwrightConfig, port);
    const startCommand = this.detectStartCommand(packageJson, langInfo, resolvedPath, port);
    const testDirs = this.scanTestDirs(resolvedPath);

    // Detect whether the repo contains both a frontend and a backend (monorepo split, or
    // Next.js/Rails-style fullstack in one process). Returns an array of services with
    // `{ role, port, baseURL, startCommand, path, framework }`. For a single-service repo
    // we still return one element so downstream code has a uniform shape.
    // NOTE: this runs BEFORE compose detection so that a repo with both a
    // docker-compose.yml (for dev databases) AND separate frontend/backend directories
    // always gets the multi-service card layout — compose only wins as a fallback when
    // the directory scan finds nothing to split.
    const detectedServices = this.detectServices(resolvedPath, {
      packageJson,
      playwrightConfig,
      envFile,
      langInfo,
      topLevelPort: port,
      topLevelBaseURL: baseURL,
      topLevelStartCommand: startCommand,
    });

    // A docker-compose / compose file is treated as a single unit only when the
    // directory scan above did NOT find a genuine multi-service split (i.e. it
    // fell back to the single-service path). If there are 2+ sub-service
    // directories, Healix manages them directly and compose is left alone.
    const composeStack = detectedServices.length <= 1
      ? this.detectComposeStack(resolvedPath)
      : null;

    let services;
    let apiOnly;
    let backendDependency = null;
    let effectiveStartCommand;
    let effectiveBaseURL;
    let effectivePort;

    if (composeStack) {
      services = [{
        role: 'fullstack',
        host: 'localhost',
        port: composeStack.port,
        baseURL: composeStack.baseURL,
        startCommand: composeStack.command,
        path: '.',
        framework: 'docker-compose',
      }];
      apiOnly = false;
      effectiveStartCommand = composeStack.command;
      effectiveBaseURL = composeStack.baseURL;
      effectivePort = composeStack.port;
    } else {
      services = detectedServices;

      apiOnly = services.length > 0 && services.every((s) => s.role === 'backend');

      // When the repo is frontend-only (single frontend service, no backend to launch),
      // try to discover the external backend it expects to talk to so the config UI can
      // warn the user to start it first. Skipped for multi-service / fullstack / api-only
      // repos where a backend is already being launched or isn't needed.
      if (services.length === 1 && services[0].role === 'frontend') {
        backendDependency = this.detectBackendDependency(resolvedPath, envFile, packageJson);
      }

      // When root-level detection found no startCommand (e.g. monorepo with no root
      // package.json), derive the primary startCommand and baseURL from the frontend
      // service so the config UI pre-fills a runnable command instead of falling back
      // to the generic 'npm run dev' in the wrong directory.
      effectiveStartCommand = startCommand;
      effectiveBaseURL = baseURL;
      effectivePort = port;
      if (!effectiveStartCommand && services.length > 0) {
        const feSvc = services.find((s) => s.role === 'frontend' || s.role === 'fullstack');
        if (feSvc && feSvc.startCommand && feSvc.path && feSvc.path !== '.') {
          effectiveStartCommand = `cd ${feSvc.path} && ${feSvc.startCommand}`;
          if (!effectiveBaseURL && feSvc.baseURL) effectiveBaseURL = feSvc.baseURL;
          if (!effectivePort && feSvc.port) effectivePort = feSvc.port;
        }
      }
    }

    const settings = {
      projectPath: resolvedPath,
      projectName,
      language: langInfo.language,
      ecosystem: langInfo.ecosystem,
      port: effectivePort,
      baseURL: effectiveBaseURL,
      startCommand: effectiveStartCommand,
      hasPlaywright: !!playwrightConfig,
      hasJira: this.detectJiraConfig(envFile),
      testDirs,
      packageJson,
      playwrightConfig,
      services,
      apiOnly,
      backendDependency,
      composeStack,
    };

    Logger.debug('AutoDetector', 'Finished detection', {
      projectName,
      language: langInfo.language,
      hasPlaywright: settings.hasPlaywright,
      serviceCount: services.length,
      services: services.map((s) => ({ role: s.role, port: s.port })),
      apiOnly,
      backendDependency,
      composeStack,
    });
    return settings;
  }

  /**
   * Detect frontend and backend services inside a single repo.
   *
   * Strategy (content-based, not name-based):
   *  - Enumerate candidate service directories: the repo root, every immediate
   *    sub-directory, the children of `apps/` and `packages/`, and any paths named
   *    by workspace globs (package.json `workspaces`, pnpm-workspace.yaml). A dir is
   *    a candidate only if it carries its own manifest (package.json / pyproject /
   *    go.mod / Cargo.toml / pom.xml / etc.).
   *  - Classify each candidate by inferring its role from its OWN dependencies
   *    (frontend / backend / fullstack), not from its directory name. Dirs with no
   *    clear app signal (e.g. a workspace root that only carries tooling deps) infer
   *    a null role and are dropped.
   *  - If two or more real services are found, the repo is multi-service. Otherwise
   *    we fall back to a single service mirroring the top-level detection.
   *
   * Regression guard: a single fullstack app (Next.js, Rails, etc.) is NOT split,
   * because its `app/` / `api/` sub-dirs have no manifest of their own and so are
   * never picked up as separate services.
   *
   * Returns an array of `{ role, path, port, baseURL, startCommand, framework }`.
   * When the repo is a single service the array has one entry whose values mirror
   * the top-level detection so callers can always iterate.
   */
  detectServices(projectPath, opts) {
    const { packageJson, langInfo, topLevelPort, topLevelBaseURL, topLevelStartCommand } = opts;

    // Classify the root plus every manifest-bearing candidate directory.
    const classified = [];
    const rootSvc = this.inspectServiceDir(projectPath, projectPath);
    if (rootSvc) classified.push(rootSvc);
    for (const dir of this.enumerateServiceDirs(projectPath, packageJson)) {
      const svc = this.inspectServiceDir(dir, projectPath);
      if (svc) classified.push(svc);
    }

    let services;
    if (classified.length >= 2) {
      // Genuine multi-service repo (frontend + backend, microservices, etc.).
      // Sort so frontend/fullstack come before backends — this guarantees that
      // the frontend keeps its detected port and the backend is the one bumped
      // when both auto-detect to the same default (e.g. 3000).
      const roleOrder = { fullstack: 0, frontend: 1, backend: 2 };
      classified.sort((a, b) => (roleOrder[a.role] ?? 3) - (roleOrder[b.role] ?? 3));
      services = classified;
    } else {
      // Single-service (the common case): mirror top-level detection so behavior
      // is identical to before for plain apps.
      const role = this.inferRoleFromTopLevel(packageJson, langInfo, projectPath);
      services = [{
        role,                       // 'frontend' | 'backend' | 'fullstack'
        path: '.',
        port: topLevelPort,
        baseURL: topLevelBaseURL,
        startCommand: topLevelStartCommand,
        framework: this.inferFrameworkLabel(packageJson, langInfo),
      }];
    }

    // Enforce port uniqueness. Services are sorted frontend-first above, so the
    // primary (frontend/fullstack) wins its port and any subsequent duplicate is
    // bumped — typically the backend.
    const portsSeen = new Set();
    for (const svc of services) {
      if (!svc || !svc.port) continue;
      if (portsSeen.has(svc.port)) {
        // Find the next free port above 4000 (avoids well-known ports).
        let newPort = Math.max(svc.port, 4000) + (portsSeen.size);
        while (portsSeen.has(newPort)) newPort++;
        svc.port = newPort;
        svc.baseURL = svc.baseURL ? svc.baseURL.replace(/:\d+/, `:${newPort}`) : `http://localhost:${newPort}`;
        svc.portConflictResolved = true;
      }
      portsSeen.add(svc.port);
    }

    return services;
  }

  /**
   * Enumerate candidate service directories beneath the repo root. A directory is
   * a candidate only when it carries its own manifest. Returns absolute paths,
   * de-duplicated, excluding the root itself (the caller classifies root separately).
   */
  enumerateServiceDirs(projectPath, rootPackageJson) {
    const skip = new Set([
      'node_modules', '.git', '.venv', 'venv', '__pycache__', '.pytest_cache',
      '.mypy_cache', '.next', 'dist', 'build', 'out', 'coverage', '.turbo',
      '.cache', 'public', 'static', 'assets', 'docs', 'doc', 'scripts', '.github',
      'test', 'tests', '__tests__', 'spec', 'specs', 'e2e', 'playwright',
      '.healix', 'healix-reports', 'examples', 'example', 'demo', 'demos',
      'sample', 'samples', 'storybook', '.storybook', 'fixtures',
    ]);

    const found = new Set();
    const addIfManifest = (absDir) => {
      if (this.dirHasManifest(absDir)) found.add(absDir);
    };

    // 1. Workspace globs (package.json workspaces + pnpm-workspace.yaml).
    for (const glob of this.readWorkspaceGlobs(projectPath, rootPackageJson)) {
      for (const dir of this.resolveWorkspaceGlob(projectPath, glob)) addIfManifest(dir);
    }

    // 2. Immediate sub-directories, plus one level into apps/ and packages/.
    let entries = [];
    try {
      entries = fs.readdirSync(projectPath, { withFileTypes: true });
    } catch { /* ignore */ }

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.') || skip.has(entry.name)) continue;
      const abs = path.join(projectPath, entry.name);
      addIfManifest(abs);

      if (entry.name === 'apps' || entry.name === 'packages') {
        let sub = [];
        try {
          sub = fs.readdirSync(abs, { withFileTypes: true });
        } catch { /* ignore */ }
        for (const s of sub) {
          if (s.isDirectory() && !s.name.startsWith('.') && !skip.has(s.name)) {
            addIfManifest(path.join(abs, s.name));
          }
        }
      }
    }

    return [...found];
  }

  dirHasManifest(absDir) {
    const manifests = [
      'package.json', 'pyproject.toml', 'requirements.txt', 'Pipfile', 'setup.py',
      'manage.py', 'go.mod', 'Cargo.toml', 'Gemfile', 'composer.json', 'mix.exs',
      'pom.xml', 'build.gradle', 'build.gradle.kts',
    ];
    return manifests.some((m) => {
      try { return fs.existsSync(path.join(absDir, m)); } catch { return false; }
    });
  }

  /**
   * Read workspace package globs from package.json `workspaces` (array form or
   * `{ packages: [] }`) and pnpm-workspace.yaml.
   */
  readWorkspaceGlobs(projectPath, rootPackageJson) {
    const globs = [];
    const ws = rootPackageJson?.workspaces;
    if (Array.isArray(ws)) globs.push(...ws);
    else if (ws && Array.isArray(ws.packages)) globs.push(...ws.packages);

    try {
      const p = path.join(projectPath, 'pnpm-workspace.yaml');
      if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, 'utf-8');
        for (const line of content.split('\n')) {
          const m = line.match(/^\s*-\s*['"]?([^'"#]+?)['"]?\s*$/);
          if (m) globs.push(m[1].trim());
        }
      }
    } catch { /* ignore */ }

    return globs;
  }

  /**
   * Resolve a workspace glob to absolute directories. Handles the common forms
   * `apps/*` (one-level wildcard) and exact paths like `apps/web`. Complex globs
   * (`**`, brace expansion) are ignored — the immediate-subdir scan covers most.
   */
  resolveWorkspaceGlob(projectPath, glob) {
    const out = [];
    if (typeof glob !== 'string') return out;
    const clean = glob.replace(/\/+$/, '');

    if (clean.endsWith('/*')) {
      const base = path.join(projectPath, clean.slice(0, -2));
      try {
        for (const e of fs.readdirSync(base, { withFileTypes: true })) {
          if (e.isDirectory()) out.push(path.join(base, e.name));
        }
      } catch { /* ignore */ }
    } else if (!clean.includes('*')) {
      const abs = path.join(projectPath, clean);
      try {
        if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) out.push(abs);
      } catch { /* ignore */ }
    }

    return out;
  }

  /**
   * Inspect a directory for its own manifest, infer its role from its dependencies,
   * detect port / framework, and build a service descriptor. Returns null when the
   * directory has no clear frontend/backend signal (so workspace roots and tooling-
   * only packages don't masquerade as services).
   */
  inspectServiceDir(absDir, repoRoot) {
    // Normalize to forward slashes — `path` ends up in shell `cd` commands and in
    // the JSON sent to the config form, both of which want POSIX-style separators.
    const relPath = (path.relative(repoRoot, absDir) || '.').replace(/\\/g, '/');
    let subPackageJson = null;
    try {
      const p = path.join(absDir, 'package.json');
      if (fs.existsSync(p)) subPackageJson = JSON.parse(fs.readFileSync(p, 'utf-8'));
    } catch { /* ignore */ }

    const subLangInfo = this.detectLanguageAndEcosystem(absDir);
    const role = this.inferRole(subPackageJson, subLangInfo, absDir);
    if (!role) return null;

    const subEnvFile = this.readEnvFile(absDir);
    const subPlaywrightConfig = this.readPlaywrightConfig(absDir);

    const port = this.detectPort(subPackageJson, subEnvFile, subPlaywrightConfig, subLangInfo, absDir);
    const baseURL = this.detectBaseURL(subPackageJson, subEnvFile, subPlaywrightConfig, port);
    const startCommand = this.detectStartCommand(subPackageJson, subLangInfo, absDir, port);

    return {
      role,
      path: relPath,
      port,
      baseURL,
      startCommand,
      framework: this.inferFrameworkLabel(subPackageJson, subLangInfo),
    };
  }

  /**
   * Infer a directory's role from its dependencies. Returns 'frontend',
   * 'backend', 'fullstack', or null when there is no clear app signal (a workspace
   * root carrying only tooling deps, an unknown ecosystem, etc.).
   */
  inferRole(packageJson, langInfo, dirPath) {
    const deps = {
      ...(packageJson?.dependencies || {}),
      ...(packageJson?.devDependencies || {}),
    };

    const hasFrontend = !!(deps.next || deps.react || deps['react-dom'] || deps.vue || deps.svelte || deps.vite || deps['react-scripts'] || deps['@remix-run/react'] || deps.expo || deps['@angular/core']);
    const hasBackend = !!(deps.express || deps.fastify || deps.koa || deps['@nestjs/core'] || deps['@nestjs/common'] || deps.hapi || deps['@hapi/hapi']);

    // Next.js is fullstack by design (pages + API routes).
    if (deps.next) return 'fullstack';
    if (hasFrontend && hasBackend) return 'fullstack';
    if (hasFrontend) return 'frontend';
    if (hasBackend) return 'backend';

    // Non-JS backends / fullstack frameworks.
    if (['python', 'java', 'kotlin', 'go', 'rust', 'ruby', 'php', 'csharp', 'elixir'].includes(langInfo?.language)) {
      const hasAppRoutes = fs.existsSync(path.join(dirPath, 'src/app')) || fs.existsSync(path.join(dirPath, 'app'));
      return hasAppRoutes ? 'fullstack' : 'backend';
    }

    // JS/TS dir with a manifest but no recognizable app deps (e.g. a workspace
    // root with only turbo/lerna), or an unknown ecosystem: no clear role.
    return null;
  }

  /**
   * Decide whether a single-root project is frontend, backend, or fullstack. Used
   * for the single-service fallback, where we always want a concrete role — so an
   * ambiguous result defaults to 'fullstack' (prior behavior).
   */
  inferRoleFromTopLevel(packageJson, langInfo, projectPath) {
    return this.inferRole(packageJson, langInfo, projectPath) || 'fullstack';
  }

  /**
   * Discover the external backend a frontend-only repo expects to call, so the
   * config UI can prompt the user to start it before running tests. Returns
   * `{ url, port, source }` or null. Sources are checked in priority order:
   *   1. Env vars (.env*): VITE_API_URL, REACT_APP_API_URL, NEXT_PUBLIC_API_URL,
   *      and any *_API_URL / *_API_BASE_URL / *_BACKEND_URL.
   *   2. vite.config.* server.proxy targets.
   *   3. package.json `proxy` (CRA) and src/setupProxy.js targets.
   *   4. next.config.* rewrites() destinations.
   *   5. Fallback: a hardcoded http://localhost:PORT in a likely API-client file.
   */
  detectBackendDependency(projectPath, rootEnvFile, packageJson) {
    const toResult = (rawUrl, source) => {
      if (!rawUrl) return null;
      const url = String(rawUrl).trim().replace(/['"]$/, '').replace(/^['"]/, '');
      const match = url.match(/^https?:\/\/[^/]+/i);
      if (!match) return null;
      const origin = match[0];
      const portMatch = origin.match(/:(\d+)/);
      const port = portMatch ? parseInt(portMatch[1], 10) : null;
      return { url: origin, port, source };
    };

    // 1. Env vars across the common .env file variants.
    const envFiles = ['.env', '.env.local', '.env.development', '.env.development.local'];
    const envKeyRe = /^(?:VITE_|REACT_APP_|NEXT_PUBLIC_|NUXT_PUBLIC_|PUBLIC_)?[A-Z0-9_]*(?:API|BACKEND|SERVER)[A-Z0-9_]*_?(?:URL|BASE_URL|ORIGIN|HOST)$/;
    for (const fileName of envFiles) {
      let content;
      try {
        const p = path.join(projectPath, fileName);
        if (!fs.existsSync(p)) continue;
        content = fs.readFileSync(p, 'utf-8');
      } catch { continue; }
      for (const line of content.split('\n')) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
        if (!m) continue;
        const key = m[1];
        const value = m[2].replace(/^['"]|['"]$/g, '').trim();
        if (envKeyRe.test(key) && /^https?:\/\//i.test(value)) {
          const result = toResult(value, `env:${key} (${fileName})`);
          if (result) return result;
        }
      }
    }

    // 2. vite.config.* — server.proxy: { '/api': { target: 'http://localhost:3001' } }
    for (const cfg of ['vite.config.js', 'vite.config.ts', 'vite.config.mjs']) {
      const content = this.safeRead(path.join(projectPath, cfg));
      if (!content) continue;
      const m = content.match(/target:\s*['"`](https?:\/\/[^'"`]+)['"`]/);
      if (m) {
        const result = toResult(m[1], `vite proxy (${cfg})`);
        if (result) return result;
      }
    }

    // 3a. package.json proxy (Create React App convention).
    if (packageJson && typeof packageJson.proxy === 'string') {
      const result = toResult(packageJson.proxy, 'package.json proxy');
      if (result) return result;
    }

    // 3b. CRA src/setupProxy.js — createProxyMiddleware({ target: '...' })
    for (const sp of ['src/setupProxy.js', 'setupProxy.js']) {
      const content = this.safeRead(path.join(projectPath, sp));
      if (!content) continue;
      const m = content.match(/target:\s*['"`](https?:\/\/[^'"`]+)['"`]/);
      if (m) {
        const result = toResult(m[1], `setupProxy (${sp})`);
        if (result) return result;
      }
    }

    // 4. next.config.* rewrites — destination: 'http://localhost:3001/:path*'
    for (const cfg of ['next.config.js', 'next.config.ts', 'next.config.mjs']) {
      const content = this.safeRead(path.join(projectPath, cfg));
      if (!content) continue;
      const m = content.match(/destination:\s*['"`](https?:\/\/[^'"`]+)['"`]/);
      if (m) {
        const result = toResult(m[1], `next rewrites (${cfg})`);
        if (result) return result;
      }
    }

    // 5. Fallback: a hardcoded localhost origin in a likely API-client file.
    const candidateFiles = [
      'src/api.js', 'src/api.ts', 'src/api/index.js', 'src/api/index.ts',
      'src/lib/api.js', 'src/lib/api.ts', 'src/services/api.js', 'src/services/api.ts',
      'src/http.js', 'src/http.ts', 'src/axios.js', 'src/axios.ts',
    ];
    for (const file of candidateFiles) {
      const content = this.safeRead(path.join(projectPath, file));
      if (!content) continue;
      const m = content.match(/baseURL:\s*['"`](https?:\/\/localhost:\d+[^'"`]*)['"`]/)
        || content.match(/['"`](https?:\/\/localhost:\d+)[^'"`]*['"`]/);
      if (m) {
        const result = toResult(m[1], `hardcoded baseURL (${file})`);
        if (result) return result;
      }
    }

    return null;
  }

  safeRead(filePath) {
    try {
      if (fs.existsSync(filePath)) return fs.readFileSync(filePath, 'utf-8');
    } catch { /* ignore */ }
    return null;
  }

  /**
   * Detect a Docker Compose stack at the repo root. When a compose file defines a
   * web/app service that publishes a host port, the whole stack is treated as one
   * unit started by `docker compose up`, and that port becomes the baseURL.
   * Returns `{ file, command, port, baseURL, serviceNames }` or null. Compose files
   * that only define datastores/infra (no app service with a published port) return
   * null so the app's own start command is used instead.
   */
  detectComposeStack(projectPath) {
    const candidates = ['compose.yaml', 'compose.yml', 'docker-compose.yml', 'docker-compose.yaml'];
    let file = null;
    let content = null;
    for (const name of candidates) {
      const c = this.safeRead(path.join(projectPath, name));
      if (c != null) { file = name; content = c; break; }
    }
    if (!content) return null;

    const services = this.parseComposeServices(content);
    const names = Object.keys(services);
    if (names.length === 0) return null;

    // App services = not a known datastore image and publishing at least one host port.
    const appServices = names.filter((n) => !this.isDatastoreImage(services[n].image) && services[n].ports.length > 0);
    if (appServices.length === 0) return null;

    // Prefer a service whose name reads like the web entrypoint; else first app service.
    const preferred = ['web', 'frontend', 'app', 'client', 'ui', 'www', 'nginx', 'caddy', 'traefik', 'gateway', 'proxy'];
    let chosen = appServices.find((n) => preferred.includes(n.toLowerCase()));
    if (!chosen) chosen = appServices[0];

    let webPort = null;
    for (const mapping of services[chosen].ports) {
      const hp = this.composeHostPort(mapping);
      if (hp != null) { webPort = hp; break; }
    }
    if (webPort == null) return null;

    return {
      file,
      command: 'docker compose up',
      port: webPort,
      baseURL: `http://localhost:${webPort}/`,
      serviceNames: names,
    };
  }

  // Indentation-tolerant parse of a compose file's top-level `services:` map.
  // Captures each service's image, whether it has a build directive, and its
  // published port mappings (inline `[...]` or block `- "8080:80"` forms).
  parseComposeServices(content) {
    const lines = String(content).split(/\r?\n/);
    const services = {};
    let inServices = false;
    let servicesIndent = 0;
    let svcIndent = null;
    let current = null;
    let inPorts = false;
    let portsIndent = 0;

    for (const rawLine of lines) {
      const line = rawLine.replace(/\t/g, '  ');
      if (!line.trim() || line.trim().startsWith('#')) continue;
      const indent = line.length - line.trimStart().length;
      const trimmed = line.trim();

      if (!inServices) {
        if (/^services:\s*$/.test(trimmed)) { inServices = true; servicesIndent = indent; }
        continue;
      }

      if (inPorts) {
        if (indent > portsIndent && trimmed.startsWith('-')) {
          const item = trimmed.replace(/^-\s*/, '').replace(/['"]/g, '').trim();
          if (item) services[current].ports.push(item);
          continue;
        }
        inPorts = false;
      }

      // A new top-level key (volumes:, networks:, etc.) ends the services block.
      if (indent <= servicesIndent && /^[A-Za-z0-9_.-]+:/.test(trimmed)) break;

      if (svcIndent === null) svcIndent = indent;

      if (indent === svcIndent && /^[A-Za-z0-9_.-]+:\s*$/.test(trimmed)) {
        current = trimmed.slice(0, -1);
        services[current] = { image: null, build: false, ports: [] };
        continue;
      }
      if (!current) continue;

      const propMatch = trimmed.match(/^([A-Za-z0-9_.-]+):\s*(.*)$/);
      if (propMatch && indent > svcIndent) {
        const key = propMatch[1];
        const val = propMatch[2].trim();
        if (key === 'image') services[current].image = val.replace(/['"]/g, '');
        else if (key === 'build') services[current].build = true;
        else if (key === 'ports') {
          if (val.startsWith('[')) {
            for (const it of val.replace(/[[\]]/g, '').split(',')) {
              const c = it.replace(/['"]/g, '').trim();
              if (c) services[current].ports.push(c);
            }
          } else {
            inPorts = true;
            portsIndent = indent;
          }
        }
      }
    }
    return services;
  }

  // Extract the published host port from a compose port mapping.
  // Handles "8080:80", "127.0.0.1:8080:80", "8080:80/tcp". Returns null for
  // container-only forms ("3000") where no fixed host port is published.
  composeHostPort(mapping) {
    const noProto = String(mapping).split('/')[0];
    const parts = noProto.split(':');
    if (parts.length < 2) return null;
    const host = parts[parts.length - 2].trim();
    return /^\d+$/.test(host) ? Number(host) : null;
  }

  isDatastoreImage(image) {
    if (!image) return false;
    // Strip registry prefix and tag/digest → bare image name.
    const bare = String(image).split('@')[0].split(':')[0].split('/').pop().toLowerCase();
    const datastores = [
      'postgres', 'postgis', 'mysql', 'mariadb', 'mongo', 'mongodb', 'redis', 'valkey',
      'rabbitmq', 'elasticsearch', 'opensearch', 'memcached', 'cassandra', 'couchdb',
      'clickhouse', 'minio', 'zookeeper', 'kafka', 'nats', 'etcd', 'influxdb', 'neo4j',
      'adminer', 'pgadmin', 'mailhog', 'mailpit', 'localstack',
    ];
    return datastores.includes(bare);
  }

  inferFrameworkLabel(packageJson, langInfo) {
    const deps = {
      ...(packageJson?.dependencies || {}),
      ...(packageJson?.devDependencies || {}),
    };
    if (deps.next) return 'next';
    if (deps['@angular/core']) return 'angular';
    if (deps['@remix-run/react']) return 'remix';
    if (deps.vite && deps.react) return 'vite-react';
    if (deps.vite && deps.vue) return 'vite-vue';
    if (deps['@nestjs/core']) return 'nest';
    if (deps.express) return 'express';
    if (deps.fastify) return 'fastify';
    if (deps.expo) return 'expo';
    if (langInfo?.ecosystem) return langInfo.ecosystem;
    return langInfo?.language || 'unknown';
  }

  /**
   * Detect project language and ecosystem from marker files
   */
  detectLanguageAndEcosystem(projectPath) {
    const markers = [
      // JavaScript / Node.js
      { file: 'tsconfig.json', language: 'typescript', ecosystem: 'node' },
      { file: 'package.json', language: 'javascript', ecosystem: 'node' },
      // Python
      { file: 'pyproject.toml', language: 'python', ecosystem: 'poetry' },
      { file: 'requirements.txt', language: 'python', ecosystem: 'pip' },
      { file: 'Pipfile', language: 'python', ecosystem: 'pipenv' },
      { file: 'setup.py', language: 'python', ecosystem: 'setuptools' },
      { file: 'manage.py', language: 'python', ecosystem: 'django' },
      // Java / Kotlin
      { file: 'pom.xml', language: 'java', ecosystem: 'maven' },
      { file: 'build.gradle', language: 'java', ecosystem: 'gradle' },
      { file: 'build.gradle.kts', language: 'kotlin', ecosystem: 'gradle' },
      // Go
      { file: 'go.mod', language: 'go', ecosystem: 'go-modules' },
      // Rust
      { file: 'Cargo.toml', language: 'rust', ecosystem: 'cargo' },
      // Ruby
      { file: 'Gemfile', language: 'ruby', ecosystem: 'bundler' },
      // PHP
      { file: 'composer.json', language: 'php', ecosystem: 'composer' },
      // Elixir
      { file: 'mix.exs', language: 'elixir', ecosystem: 'mix' },
      // Swift
      { file: 'Package.swift', language: 'swift', ecosystem: 'spm' },
      // C# / .NET
      { file: '*.csproj', language: 'csharp', ecosystem: 'dotnet' },
      { file: '*.sln', language: 'csharp', ecosystem: 'dotnet' },
      // Docker (fallback)
      { file: 'Dockerfile', language: 'docker', ecosystem: 'docker' },
    ];

    for (const marker of markers) {
      if (marker.file.includes('*')) {
        // Glob-style match for *.csproj, *.sln
        const ext = marker.file.replace('*', '');
        try {
          const entries = fs.readdirSync(projectPath);
          if (entries.some(e => e.endsWith(ext))) {
            return { language: marker.language, ecosystem: marker.ecosystem };
          }
        } catch (e) { /* ignore */ }
      } else if (fs.existsSync(path.join(projectPath, marker.file))) {
        return { language: marker.language, ecosystem: marker.ecosystem };
      }
    }

    return { language: 'unknown', ecosystem: 'unknown' };
  }

  /**
   * Detect project name from language-specific config files
   */
  detectProjectName(projectPath, packageJson, langInfo) {
    // Node.js
    if (packageJson?.name) return packageJson.name;

    // Python (pyproject.toml)
    if (langInfo.ecosystem === 'poetry' || langInfo.ecosystem === 'pip') {
      try {
        const pyproject = fs.readFileSync(path.join(projectPath, 'pyproject.toml'), 'utf-8');
        const nameMatch = pyproject.match(/name\s*=\s*"([^"]+)"/);
        if (nameMatch) return nameMatch[1];
      } catch (e) { /* ignore */ }
    }

    // Go (go.mod)
    if (langInfo.language === 'go') {
      try {
        const goMod = fs.readFileSync(path.join(projectPath, 'go.mod'), 'utf-8');
        const moduleMatch = goMod.match(/module\s+(\S+)/);
        if (moduleMatch) {
          const parts = moduleMatch[1].split('/');
          return parts[parts.length - 1];
        }
      } catch (e) { /* ignore */ }
    }

    // Java (pom.xml)
    if (langInfo.ecosystem === 'maven') {
      try {
        const pom = fs.readFileSync(path.join(projectPath, 'pom.xml'), 'utf-8');
        const artifactMatch = pom.match(/<artifactId>([^<]+)<\/artifactId>/);
        if (artifactMatch) return artifactMatch[1];
      } catch (e) { /* ignore */ }
    }

    // Rust (Cargo.toml)
    if (langInfo.language === 'rust') {
      try {
        const cargo = fs.readFileSync(path.join(projectPath, 'Cargo.toml'), 'utf-8');
        const nameMatch = cargo.match(/name\s*=\s*"([^"]+)"/);
        if (nameMatch) return nameMatch[1];
      } catch (e) { /* ignore */ }
    }

    // PHP (composer.json)
    if (langInfo.language === 'php') {
      try {
        const composer = JSON.parse(fs.readFileSync(path.join(projectPath, 'composer.json'), 'utf-8'));
        if (composer.name) {
          const parts = composer.name.split('/');
          return parts[parts.length - 1];
        }
      } catch (e) { /* ignore */ }
    }

    // Ruby (Gemfile - use directory name)
    // Elixir (mix.exs)
    if (langInfo.language === 'elixir') {
      try {
        const mix = fs.readFileSync(path.join(projectPath, 'mix.exs'), 'utf-8');
        const appMatch = mix.match(/app:\s*:(\w+)/);
        if (appMatch) return appMatch[1];
      } catch (e) { /* ignore */ }
    }

    // Fallback: directory name
    return path.basename(projectPath);
  }

  /**
   * Read package.json
   */
  readPackageJson(projectPath) {
    const packagePath = path.join(projectPath, 'package.json');
    try {
      if (fs.existsSync(packagePath)) {
        return JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
      }
    } catch (error) {
      Logger.debug('AutoDetector', `Failed to read package.json`, error);
    }
    return null;
  }

  /**
   * Read playwright.config.js
   */
  readPlaywrightConfig(projectPath) {
    const configPaths = [
      path.join(projectPath, 'playwright.config.js'),
      path.join(projectPath, 'playwright.config.ts'),
    ];

    for (const configPath of configPaths) {
      try {
        if (fs.existsSync(configPath)) {
          const content = fs.readFileSync(configPath, 'utf-8');
          return this.parsePlaywrightConfig(content);
        }
      } catch (error) {
        Logger.debug('AutoDetector', `Failed to read playwright config`, error);
      }
    }
    return null;
  }

  /**
   * Parse playwright config from file content
   */
  parsePlaywrightConfig(content) {
    const config = {};

    const baseURLMatch = content.match(/baseURL:\s*['"`]([^'"`]+)['"`]/);
    if (baseURLMatch) {
      config.baseURL = baseURLMatch[1];
    }

    const envBaseURLMatch = content.match(/baseURL:\s*process\.env\.([A-Z_]+)/);
    if (envBaseURLMatch) {
      config.baseURLEnvVar = envBaseURLMatch[1];
    }

    const testDirMatch = content.match(/testDir:\s*['"`]([^'"`]+)['"`]/);
    if (testDirMatch) {
      config.testDir = testDirMatch[1];
    }

    const projectsMatch = content.match(/projects:\s*\[([^\]]+)\]/s);
    if (projectsMatch) {
      config.hasProjects = true;
    }

    return config;
  }

  /**
   * Read .env file
   */
  readEnvFile(projectPath) {
    const envPath = path.join(projectPath, '.env');
    try {
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf-8');
        const env = {};
        content.split('\n').forEach((line) => {
          const match = line.match(/^([A-Z_]+)=(.*)$/);
          if (match) {
            env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
          }
        });
        return env;
      }
    } catch (error) {
      Logger.debug('AutoDetector', `Failed to read .env`, error);
    }
    return null;
  }

  /**
   * Detect port number.
   * Priority: env vars → playwright config → package.json scripts →
   *           language/framework-specific config & source files →
   *           framework dep defaults → language defaults → 8000.
   *
   * @param {object|null} packageJson
   * @param {object|null} envFile       – already-parsed .env contents
   * @param {object|null} playwrightConfig
   * @param {object|null} langInfo
   * @param {string}      [projectPath] – enables config-file + source scanning
   */
  detectPort(packageJson, envFile, playwrightConfig, langInfo, projectPath) {
    // 1. Env file (PORT, APP_PORT, SERVER_PORT, …)
    const envPortVars = ['PORT', 'APP_PORT', 'SERVER_PORT', 'BACKEND_PORT', 'API_PORT'];
    if (envFile) {
      for (const v of envPortVars) {
        if (envFile[v]) return parseInt(envFile[v], 10);
      }
    }
    // Also scan .env.local / .env.development / .env.development.local when
    // the primary .env didn't contain a port variable.
    if (projectPath) {
      for (const ef of ['.env.local', '.env.development', '.env.development.local']) {
        const raw = this.safeRead(path.join(projectPath, ef));
        if (!raw) continue;
        for (const v of envPortVars) {
          const m = raw.match(new RegExp(`^${v}\\s*=\\s*(\\d+)`, 'm'));
          if (m) return parseInt(m[1], 10);
        }
      }
    }

    // 2. Playwright config baseURL
    if (playwrightConfig?.baseURL) {
      const match = playwrightConfig.baseURL.match(/:(\d+)/);
      if (match) return parseInt(match[1], 10);
    }

    // 3. package.json scripts (--port=N or PORT=N inline)
    if (packageJson?.scripts) {
      const scripts = JSON.stringify(packageJson.scripts);
      const portMatch = scripts.match(/--port[=\s](\d+)|PORT=(\d+)/);
      if (portMatch) return parseInt(portMatch[1] || portMatch[2], 10);
    }

    if (this.isExpoProject(packageJson)) return 8081;

    // 4. Language/framework-specific config files and source files.
    //    Checked BEFORE dep-based defaults so an explicit value wins.
    if (projectPath) {
      const fromFiles = this.detectPortFromFiles(projectPath, langInfo);
      if (fromFiles) return fromFiles;
    }

    // 5. Node.js framework defaults (dep-based)
    if (packageJson?.dependencies || packageJson?.devDependencies) {
      const deps = {
        ...(packageJson.dependencies || {}),
        ...(packageJson.devDependencies || {}),
      };
      if (deps.vite) return 5173;
      if (deps.next) return 3000;
      if (deps['@angular/core']) return 4200;
      if (deps['react-scripts']) return 3000;
      if (deps.express) return 3000;
    }

    // 6. Language-specific defaults
    const langDefaults = {
      python: 8000,
      java: 8080,
      kotlin: 8080,
      go: 8080,
      ruby: 3000,
      php: 8000,
      rust: 8080,
      csharp: 5000,
      elixir: 4000,
    };
    if (langInfo?.language && langDefaults[langInfo.language]) {
      return langDefaults[langInfo.language];
    }

    return 8000;
  }

  /**
   * Scan language/framework-specific config files and entry-point source files
   * for an explicitly declared port. Returns an integer or null.
   *
   * Coverage by ecosystem:
   *  Java/Kotlin  – application.properties / application.yml (Spring Boot)
   *  Python       – app.py / main.py (Flask app.run / uvicorn / FastAPI)
   *  Ruby         – config/puma.rb
   *  Go           – config.yaml / config.yml / main.go  (":PORT" string literal)
   *  C# / .NET    – Properties/launchSettings.json, appsettings.json
   *  Elixir       – config/dev.exs (Phoenix)
   *  PHP          – .env APP_PORT / SERVER_PORT
   *  Rust         – main.rs / src/main.rs  ("0.0.0.0:PORT" bind pattern)
   *  Node.js/TS   – app.js, server.js, index.js, main.js (and src/ variants)
   */
  detectPortFromFiles(projectPath, langInfo) {
    const lang = langInfo?.language;

    // ── Java / Kotlin (Spring Boot) ──────────────────────────────────────
    if (lang === 'java' || lang === 'kotlin') {
      for (const f of [
        'src/main/resources/application.properties', 'application.properties',
      ]) {
        const c = this.safeRead(path.join(projectPath, f));
        if (c) {
          const m = c.match(/^server\.port\s*=\s*(\d+)/m);
          if (m) return parseInt(m[1], 10);
        }
      }
      for (const f of [
        'src/main/resources/application.yml', 'src/main/resources/application.yaml',
        'application.yml', 'application.yaml',
      ]) {
        const c = this.safeRead(path.join(projectPath, f));
        if (c) {
          // `server:\n  port: 8080`
          const m = c.match(/^[ \t]*port\s*:\s*(\d+)/m);
          if (m) return parseInt(m[1], 10);
        }
      }
    }

    // ── Python ───────────────────────────────────────────────────────────
    if (lang === 'python') {
      for (const f of ['app.py', 'main.py', 'run.py', 'wsgi.py', 'asgi.py', 'server.py',
                        'src/app.py', 'src/main.py']) {
        const c = this.safeRead(path.join(projectPath, f));
        if (!c) continue;
        // Flask: app.run(port=5000) or app.run(host='0.0.0.0', port=5000)
        const flask = c.match(/\.run\([^)]*port\s*=\s*(\d+)/);
        if (flask) return parseInt(flask[1], 10);
        // uvicorn.run(app, port=8000) / uvicorn.run("app:app", port=8000)
        const uv = c.match(/uvicorn\.run\([^)]*port\s*=\s*(\d+)/);
        if (uv) return parseInt(uv[1], 10);
        // PORT = int(os.getenv("PORT", 8000)) / int(os.environ.get("PORT", 8000))
        const envGet = c.match(/PORT\s*=\s*int\s*\(\s*os\.(?:getenv|environ\.get)\s*\([^,)]+,\s*(\d+)\s*\)/);
        if (envGet) return parseInt(envGet[1], 10);
      }
    }

    // ── Ruby / Rails ─────────────────────────────────────────────────────
    if (lang === 'ruby') {
      const puma = this.safeRead(path.join(projectPath, 'config/puma.rb'));
      if (puma) {
        const m = puma.match(/port\s+ENV\.fetch\([^,)]+,\s*(\d+)\)/);
        if (m) return parseInt(m[1], 10);
        const m2 = puma.match(/port\s+(\d+)/);
        if (m2) return parseInt(m2[1], 10);
      }
    }

    // ── Go ───────────────────────────────────────────────────────────────
    if (lang === 'go') {
      for (const f of ['config.yaml', 'config.yml', 'config.json',
                        'main.go', 'cmd/main.go', 'cmd/server/main.go']) {
        const c = this.safeRead(path.join(projectPath, f));
        if (!c) continue;
        // YAML: `port: 8080`
        const yaml = c.match(/^\s*port\s*:\s*(\d+)/m);
        if (yaml) return parseInt(yaml[1], 10);
        // Go string literal: ":8080" or "0.0.0.0:8080"
        const goPort = c.match(/"(?:[0-9.]*):(\d{4,5})"/);
        if (goPort) return parseInt(goPort[1], 10);
      }
    }

    // ── C# / .NET ────────────────────────────────────────────────────────
    if (lang === 'csharp') {
      const ls = this.safeRead(path.join(projectPath, 'Properties/launchSettings.json'));
      if (ls) {
        const m = ls.match(/"applicationUrl"\s*:\s*"[^"]*:(\d+)"/);
        if (m) return parseInt(m[1], 10);
      }
      for (const f of ['appsettings.json', 'appsettings.Development.json']) {
        const c = this.safeRead(path.join(projectPath, f));
        if (!c) continue;
        const m = c.match(/"Urls"\s*:\s*"[^"]*:(\d+)"/);
        if (m) return parseInt(m[1], 10);
      }
    }

    // ── Elixir / Phoenix ─────────────────────────────────────────────────
    if (lang === 'elixir') {
      const c = this.safeRead(path.join(projectPath, 'config/dev.exs'));
      if (c) {
        const m = c.match(/http:\s*\[[^\]]*port:\s*(\d+)/);
        if (m) return parseInt(m[1], 10);
      }
    }

    // ── PHP / Laravel ─────────────────────────────────────────────────────
    if (lang === 'php') {
      // artisan serve uses APP_PORT or SERVER_PORT from .env
      const env = this.safeRead(path.join(projectPath, '.env'));
      if (env) {
        const m = env.match(/^(?:APP_PORT|SERVER_PORT)\s*=\s*(\d+)/m);
        if (m) return parseInt(m[1], 10);
      }
    }

    // ── Rust ─────────────────────────────────────────────────────────────
    if (lang === 'rust') {
      for (const f of ['src/main.rs', 'main.rs']) {
        const c = this.safeRead(path.join(projectPath, f));
        if (!c) continue;
        const m = c.match(/bind\s*\(\s*"[^"]*:(\d{4,5})"\s*\)/);
        if (m) return parseInt(m[1], 10);
        const m2 = c.match(/(?:port|PORT)\s*[:=]\s*(\d{4,5})/);
        if (m2) return parseInt(m2[1], 10);
      }
    }

    // ── Node.js / TypeScript ─────────────────────────────────────────────
    // (covers JS/TS regardless of langInfo, catches repos where language
    //  wasn't identified or is listed as 'javascript'/'typescript')
    if (!lang || ['javascript', 'typescript', 'node'].includes(lang)) {
      for (const f of [
        'app.js', 'server.js', 'index.js', 'main.js',
        'src/app.js', 'src/server.js', 'src/index.js', 'src/main.js',
        'app.ts', 'server.ts', 'index.ts', 'main.ts',
        'src/app.ts', 'src/server.ts', 'src/index.ts', 'src/main.ts',
      ]) {
        const c = this.safeRead(path.join(projectPath, f));
        if (!c) continue;
        // process.env.PORT || 5000  /  process.env.PORT ?? 5000
        const envFallback = c.match(/process\.env\.PORT\s*(?:\|\||\?\?)\s*(\d{2,5})/);
        if (envFallback) return parseInt(envFallback[1], 10);
        // app.listen(5000 / server.listen(5000
        const listen = c.match(/\.listen\(\s*(\d{4,5})/);
        if (listen) return parseInt(listen[1], 10);
        // const PORT = 5000 / let port = 5000
        const portConst = c.match(/(?:const|let|var)\s+[Pp][Oo][Rr][Tt]\s*=\s*(\d{4,5})/);
        if (portConst) return parseInt(portConst[1], 10);
      }
    }

    return null;
  }

  /**
   * Detect base URL
   */
  detectBaseURL(packageJson, envFile, playwrightConfig, port) {
    if (envFile) {
      if (envFile.BASE_URL) return envFile.BASE_URL;
      if (envFile.APP_URL) return envFile.APP_URL;
    }

    if (playwrightConfig?.baseURL && !playwrightConfig.baseURL.includes('process.env')) {
      return playwrightConfig.baseURL;
    }

    if (this.isExpoProject(packageJson)) {
      return `http://localhost:${port || 8081}`;
    }

    return `http://localhost:${port}`;
  }

  isExpoProject(packageJson) {
    if (!packageJson || typeof packageJson !== 'object') return false;
    const dependencies = {
      ...(packageJson.dependencies || {}),
      ...(packageJson.devDependencies || {}),
    };
    if (dependencies.expo || dependencies['expo-router']) {
      return true;
    }

    const scripts = packageJson.scripts || {};
    return Object.values(scripts).some((value) => /expo\s+start/i.test(String(value || '')));
  }

  /**
   * Detect start command (language-aware)
   */
  detectStartCommand(packageJson, langInfo, projectPath, port = 8000) {
    // Node.js: check package.json scripts
    if (packageJson?.scripts) {
      const scripts = packageJson.scripts;
      if (this.isExpoProject(packageJson)) {
        const resolvedPort = Number(port) || 8081;
        if (scripts.web) {
          return `npm run web -- --port ${resolvedPort}`;
        }
        if (scripts.start && /expo\s+start/i.test(String(scripts.start))) {
          return `npm run start -- --web --port ${resolvedPort}`;
        }
      }
      // Explicit names checked in priority order.
      const startScripts = [
        'dev', 'start', 'serve', 'start:dev', 'develop',
        // common backend / server-specific names
        'server', 'start:server', 'dev:server', 'start:prod', 'run', 'api', 'backend', 'app',
      ];
      for (const script of startScripts) {
        if (scripts[script]) {
          return `npm run ${script}`;
        }
      }
      // Fallback: pick the first script whose key contains "start", "dev", or "server".
      const keys = Object.keys(scripts);
      const fuzzy = keys.find((k) => /start|dev|server/i.test(k));
      if (fuzzy) return `npm run ${fuzzy}`;
    }

    // Node.js without a matching npm script: fall back to the main entry file
    // listed in package.json, or common convention filenames.
    if (packageJson && langInfo?.language !== 'python') {
      const main = packageJson.main;
      if (main && !main.includes('*')) {
        const entryFile = path.basename(main);
        return `node ${entryFile}`;
      }
      const conventions = ['server.js', 'index.js', 'app.js', 'main.js', 'src/server.js', 'src/index.js', 'src/app.js'];
      for (const f of conventions) {
        try {
          if (fs.existsSync(path.join(projectPath, f))) return `node ${f}`;
        } catch { /* ignore */ }
      }
    }

    // Language-specific start commands
    if (langInfo?.language === 'python') {
      const rootManagePy = fs.existsSync(path.join(projectPath, 'manage.py'));
      const nestedManagePy = rootManagePy ? 'manage.py' : this.findFileRelative(projectPath, 'manage.py', 4);

      if (langInfo.ecosystem === 'django' || nestedManagePy) {
        const manageDir = path.dirname(nestedManagePy);
        if (!manageDir || manageDir === '.') {
          return 'python manage.py runserver';
        }
        const normalizedDir = manageDir.replace(/\\/g, '/');
        return `cd ${normalizedDir} && python manage.py runserver`;
      }

      // Check for FastAPI / Uvicorn
      try {
        const req = fs.readFileSync(path.join(projectPath, 'requirements.txt'), 'utf-8');
        if (req.includes('fastapi') || req.includes('uvicorn')) {
          return 'uvicorn main:app --reload';
        }
        if (req.includes('flask')) {
          return 'flask run';
        }
      } catch (e) { /* ignore */ }
      try {
        const pyproject = fs.readFileSync(path.join(projectPath, 'pyproject.toml'), 'utf-8');
        if (pyproject.includes('fastapi') || pyproject.includes('uvicorn')) {
          return 'uvicorn main:app --reload';
        }
        if (pyproject.includes('flask')) {
          return 'flask run';
        }
        if (pyproject.includes('django')) {
          return 'python manage.py runserver';
        }
      } catch (e) { /* ignore */ }
      return 'python -m http.server';
    }

    if (langInfo?.language === 'java') {
      if (langInfo.ecosystem === 'maven') return 'mvn spring-boot:run';
      if (langInfo.ecosystem === 'gradle') return './gradlew bootRun';
    }

    if (langInfo?.language === 'go') return 'go run .';
    if (langInfo?.language === 'ruby') return 'rails server';
    if (langInfo?.language === 'rust') return 'cargo run';
    if (langInfo?.language === 'php') return 'php artisan serve';
    if (langInfo?.language === 'elixir') return 'mix phx.server';
    if (langInfo?.language === 'csharp') return 'dotnet run';

    return null;
  }

  /**
   * Detect Jira configuration
   */
  detectJiraConfig(envFile) {
    if (!envFile) return false;

    return !!(
      envFile.JIRA_BASE_URL ||
      envFile.JIRA_API_TOKEN ||
      envFile.JIRA_PROJECT_KEY
    );
  }

  /**
   * Scan for test directories
   */
  scanTestDirs(projectPath) {
    const testDirs = [];
    const possibleDirs = ['tests', 'test', '__tests__', 'spec', 'specs', 'e2e'];

    for (const dir of possibleDirs) {
      const fullPath = path.join(projectPath, dir);
      if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
        testDirs.push(dir);

        const subDirs = ['frontend', 'backend', 'api', 'e2e', 'unit', 'integration'];
        for (const subDir of subDirs) {
          const subPath = path.join(fullPath, subDir);
          if (fs.existsSync(subPath) && fs.statSync(subPath).isDirectory()) {
            testDirs.push(`${dir}/${subDir}`);
          }
        }
      }
    }

    return testDirs;
  }
}

module.exports = AutoDetector;
