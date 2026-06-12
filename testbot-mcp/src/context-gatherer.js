/**
 * Context Gatherer
 * Gathers codebase context for intelligent test generation
 * Works with AI agents (Cursor/Windsurf) to understand the codebase
 * Enhanced version with deep code analysis for OpenAI test generation
 */

const fs = require('fs');
const path = require('path');
const Logger = require('./logger');
const { extractQaContracts } = require('./qa-contracts');

// Optional YAML parser for inline @swagger / OpenAPI JSDoc blocks. When absent,
// endpoint schema extraction degrades to controller/handler source analysis.
let yaml = null;
try { yaml = require('js-yaml'); } catch { /* optional */ }

// Common client-side route-guard wrapper component names. When a route's
// element is wrapped in one of these, the route is auth-gated and the page
// behind it should be explored under an authenticated session.
const ROUTE_GUARD_RE = /\b(ProtectedRoute|PrivateRoute|RequireAuth|RequireRole|RequireRoles|AuthGuard|RoleGuard|AuthRoute|AuthenticatedRoute|GuardedRoute|RestrictedRoute|Protected|Authenticated)\b/;

class ContextGatherer {
  constructor(config = {}) {
    this.config = {
      projectPath: config.projectPath || process.cwd(),
      language: config.language || 'javascript',
      maxFiles: config.maxFiles || 50,
      maxFileSize: config.maxFileSize || 50000, // 50KB max per file
      includeFileContents: config.includeFileContents !== false,
      ...config,
    };

    this.fileCache = new Map();
    this.skipDirs = new Set([
      'node_modules',
      '.git',
      '.next',
      'dist',
      'build',
      'coverage',
      'out',
      'vendor',
      'target',
      'public',
      'static',
      'assets',
      'generated',
      'gen',
    ]);
  }

  readFileCached(filePath, options = {}) {
    const maxBytes = Number(options.maxBytes || this.config.maxFileSize);

    try {
      const stats = fs.statSync(filePath);
      if (!options.allowLarge && stats.size > maxBytes) {
        return null;
      }

      const cached = this.fileCache.get(filePath);
      if (cached && cached.mtimeMs === stats.mtimeMs && cached.size === stats.size) {
        return cached.content;
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      this.fileCache.set(filePath, {
        mtimeMs: stats.mtimeMs,
        size: stats.size,
        content,
      });

      if (this.fileCache.size > this.config.maxFiles * 10) {
        this.fileCache.clear();
      }

      return content;
    } catch {
      return null;
    }
  }

  /**
   * Get source file extensions based on project language
   */
  getSourceExtensions(language = this.config.language) {
    const extensionMap = {
      javascript: ['.js', '.jsx', '.ts', '.tsx', '.mjs'],
      python: ['.py'],
      java: ['.java', '.kt'],
      kotlin: ['.java', '.kt'],
      go: ['.go'],
      rust: ['.rs'],
      ruby: ['.rb', '.erb'],
      php: ['.php'],
      elixir: ['.ex', '.exs'],
      csharp: ['.cs'],
      swift: ['.swift'],
      unknown: ['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.go', '.rb', '.php'],
    };
    return extensionMap[language] || extensionMap.unknown;
  }

  /**
   * Gather context from the codebase automatically
   * This is used when the AI agent doesn't provide structured context
   */
  async gatherAutomatically() {
    const projectPath = this.config.projectPath;
    
    Logger.info('ContextGatherer', 'Gathering codebase context automatically...');
    
    const context = {
      pages: [],
      apiEndpoints: [],
      workflows: [],
      components: [],
      forms: [],
      dataModels: [],
      authPatterns: [],
      qaContracts: null,
      projectStructure: {},
    };
    
    // Scan for page/route definitions
    context.pages = await this.findPages(projectPath);
    Logger.info('ContextGatherer', `Found pages/routes`, { count: context.pages.length });
    
    // Scan for API endpoints
    context.apiEndpoints = await this.findAPIEndpoints(projectPath);
    Logger.info('ContextGatherer', `Found API endpoints`, { count: context.apiEndpoints.length });
    
    // Extract forms and validation
    context.forms = await this.findForms(projectPath);
    Logger.info('ContextGatherer', `Found forms`, { count: context.forms.length });
    
    // Extract data models/schemas
    context.dataModels = await this.findDataModels(projectPath);
    Logger.info('ContextGatherer', `Found data models`, { count: context.dataModels.length });
    
    // Detect authentication patterns
    context.authPatterns = await this.detectAuthPatterns(projectPath);
    Logger.info('ContextGatherer', `Detected auth patterns`, { count: context.authPatterns.length });
    
    // Get project structure summary
    context.projectStructure = this.getProjectStructure(projectPath);
    
    // Identify common workflows from routes
    context.workflows = this.inferWorkflows(context.pages, context.apiEndpoints, context.forms);
    Logger.info('ContextGatherer', `Inferred workflows`, { count: context.workflows.length });

    context.qaContracts = this.extractQaContracts(projectPath, context);
    Logger.info('ContextGatherer', 'Derived QA contracts', context.qaContracts?.summary || {});
    
    return context;
  }

  /**
   * Gather rich context with file contents for OpenAI
   * Returns more detailed context suitable for AI test generation
   */
  async gatherRichContext() {
    const projectPath = this.config.projectPath;
    
    Logger.info('ContextGatherer', 'Gathering rich codebase context for AI...');
    
    // Get basic context first
    const basicContext = await this.gatherAutomatically();
    
    // Enhance with file contents
    const richContext = {
      ...basicContext,
      fileContents: {},
      componentDetails: [],
      apiSchemas: [],
      envVariables: [],
      dependencies: {},
      navigationGraph: { nodes: [], edges: [] },
      selectorHints: [],
      mockableApiContracts: [],
      sourceContext: {
        files: [],
        assertableText: [],
        routePaths: [],
        testIds: [],
        sourceFilesAnalyzed: 0,
      },
    };
    
    // Read package.json for dependencies
    richContext.dependencies = this.readPackageJson(projectPath);
    Logger.info('ContextGatherer', `Found dependencies`, { count: Object.keys(richContext.dependencies.dependencies || {}).length });
    
    // Get env variable names (not values)
    richContext.envVariables = this.getEnvVariableNames(projectPath);
    Logger.info('ContextGatherer', `Found env variables`, { count: richContext.envVariables.length });
    
    // Extract detailed component info
    richContext.componentDetails = await this.extractComponentDetails(projectPath);
    Logger.info('ContextGatherer', `Extracted component details`, { count: richContext.componentDetails.length });
    
    // Extract API schemas from endpoints
    richContext.apiSchemas = await this.extractAPISchemas(projectPath, basicContext.apiEndpoints);
    Logger.info('ContextGatherer', `Extracted API schemas`, { count: richContext.apiSchemas.length });
    
    // Read key file contents (limited)
    if (this.config.includeFileContents) {
      richContext.fileContents = await this.readKeyFiles(projectPath);
      Logger.info('ContextGatherer', `Read key files`, { count: Object.keys(richContext.fileContents).length });
    }

    richContext.navigationGraph = this.buildNavigationGraph(richContext.pages);
    richContext.selectorHints = this.collectSelectorHints(richContext.pages, richContext.forms);
    richContext.mockableApiContracts = this.extractMockableApiContracts(
      projectPath,
      richContext.apiEndpoints,
      richContext.forms
    );
    richContext.sourceContext = this.extractSourceContext(
      projectPath,
      richContext.pages,
      richContext.projectStructure?.framework
    );
    richContext.qaContracts = this.extractQaContracts(projectPath, richContext);
    richContext.extractionConfidence = {
      selectorHints: richContext.selectorHints.length > 0 ? 0.9 : 0.5,
      navigationGraph: (richContext.navigationGraph.edges || []).length > 0 ? 0.85 : 0.4,
      forms: (richContext.forms || []).length > 0 ? 0.9 : 0.5,
      apiContracts: (richContext.mockableApiContracts || []).length > 0 ? 0.9 : 0.5,
      sourceContext: (richContext.sourceContext.files || []).length > 0 ? 0.9 : 0.35,
    };
    richContext.extractionSources = {
      selectorHints: 'pages+forms',
      navigationGraph: 'page-link-analysis',
      forms: 'jsx-tsx-form-parsing',
      apiContracts: 'endpoint-handler-parsing',
      sourceContext: 'route-source-and-component-literal-parsing',
      qaContracts: 'source-derived-filter-delete-form-contracts',
    };
    
    return richContext;
  }

  extractQaContracts(projectPath, context) {
    return extractQaContracts({
      projectPath,
      context,
      readFile: (filePath, options) => this.readFileCached(filePath, options),
    });
  }

  /**
   * Find forms and their validation rules
   */
  async findForms(projectPath) {
    const forms = [];
    const srcDir = path.join(projectPath, 'src');
    const searchDir = fs.existsSync(srcDir) ? srcDir : projectPath;
    const files = this.findFiles(searchDir, ['.js', '.jsx', '.ts', '.tsx']);
    
    for (const file of files.slice(0, this.config.maxFiles)) {
      try {
        const content = this.readFileCached(file);
        if (!content) continue;
        const fileFormsData = this.extractFormsFromFile(content, file);
        forms.push(...fileFormsData);
      } catch (error) {
        // Ignore errors
      }
    }
    
    return forms;
  }

  /**
   * Extract form data from a file
   */
  extractFormsFromFile(content, filePath) {
    const forms = [];
    
    // Detect form elements
    const formMatchRecords = Array.from(content.matchAll(/<form[^>]*>[\s\S]*?<\/form>/gi));
    const formMatches = formMatchRecords.map((match) => match[0]);
    const formHookMatchRecords = Array.from(content.matchAll(/useForm\s*\([^)]*\)/gi));
    const formHookMatches = formHookMatchRecords.map((match) => match[0]);
    const labelsMap = new Map();

    const attrValue = (tag, attrName) => {
      const match = String(tag || '').match(new RegExp(`\\b${attrName}=["']([^"']*)["']`, 'i'));
      return match?.[1] || null;
    };
    const fieldRequiredByValidation = (fieldName, tag = '') => {
      const name = String(fieldName || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rawTag = String(tag || '');
      if (/\brequired(?:\s*=\s*(?:\{?\s*true\s*\}?|["']true["']))?\b/i.test(rawTag)) return true;
      if (/\baria-required\s*=\s*(?:["']true["']|\{\s*true\s*\})/i.test(rawTag)) return true;
      if (/\brules\s*=\s*\{\s*\{[\s\S]{0,180}\brequired\b/i.test(rawTag)) return true;
      if (!name) return false;
      const registerPattern = new RegExp(`\\bregister\\s*\\(\\s*['"\`]${name}['"\`]\\s*,\\s*\\{[\\s\\S]{0,240}\\brequired\\b`, 'i');
      if (registerPattern.test(content)) return true;
      const controllerPattern = new RegExp(`\\bname\\s*=\\s*['"\`]${name}['"\`][\\s\\S]{0,320}\\brules\\s*=\\s*\\{\\s*\\{[\\s\\S]{0,180}\\brequired\\b`, 'i');
      if (controllerPattern.test(content)) return true;
      const zodPattern = new RegExp(`\\b${name}\\s*:\\s*z\\.(?:string|number|coerce\\.number)\\s*\\([^)]*\\)(?:\\s*\\.\\s*(?:min\\s*\\(\\s*1\\b|nonempty\\s*\\(|email\\s*\\())`, 'i');
      return zodPattern.test(content);
    };
    const upsertField = (field) => {
      const key = String(field.name || field.id || '').trim();
      if (!key) return;
      const existing = fields.find((item) => item.name === key);
      if (existing) {
        existing.required = Boolean(existing.required || field.required);
        existing.label = existing.label || field.label || null;
        existing.placeholder = existing.placeholder || field.placeholder || null;
        existing.testId = existing.testId || field.testId || null;
        existing.ariaLabel = existing.ariaLabel || field.ariaLabel || null;
        return;
      }
      fields.push(field);
    };

    const labelMatches = content.matchAll(/<label\b([^>]*)>([\s\S]*?)<\/label>/gi);
    for (const match of labelMatches) {
      const targetId = String(attrValue(match[1], 'htmlFor') || attrValue(match[1], 'for') || '').trim();
      const labelText = String(match[2] || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      if (targetId && labelText) {
        labelsMap.set(targetId, labelText);
      }
    }
    
    // Extract form fields
    const fields = [];
    
    // Input fields
    const inputMatches = content.matchAll(/<(?:input|Input)\b[^>]*>/gi);
    for (const match of inputMatches) {
      const tag = match[0];
      const name = attrValue(tag, 'name') || attrValue(tag, 'id');
      if (!name) continue;
      const id = attrValue(tag, 'id');
      const type = attrValue(tag, 'type') || 'text';
      const placeholder = attrValue(tag, 'placeholder');
      const testId = attrValue(tag, 'data-testid');
      const ariaLabel = attrValue(tag, 'aria-label');
      upsertField({
        name,
        type,
        required: fieldRequiredByValidation(name, tag),
        id: id || null,
        label: labelsMap.get(id || '') || null,
        placeholder: placeholder || null,
        testId: testId || null,
        ariaLabel: ariaLabel || null,
        role: 'textbox',
      });
    }
    
    // Select fields
    const selectMatches = content.matchAll(/<(?:select|Select)\b[^>]*>/gi);
    for (const match of selectMatches) {
      const tag = match[0];
      const name = attrValue(tag, 'name') || attrValue(tag, 'id');
      if (!name) continue;
      const id = attrValue(tag, 'id');
      const testId = attrValue(tag, 'data-testid');
      const ariaLabel = attrValue(tag, 'aria-label');
      upsertField({
        name,
        type: 'select',
        required: fieldRequiredByValidation(name, tag),
        id: id || null,
        label: labelsMap.get(id || '') || null,
        placeholder: null,
        testId: testId || null,
        ariaLabel: ariaLabel || null,
        role: 'combobox',
      });
    }
    
    // Textarea
    const textareaMatches = content.matchAll(/<(?:textarea|Textarea)\b[^>]*>/gi);
    for (const match of textareaMatches) {
      const tag = match[0];
      const name = attrValue(tag, 'name') || attrValue(tag, 'id');
      if (!name) continue;
      const id = attrValue(tag, 'id');
      const placeholder = attrValue(tag, 'placeholder');
      const testId = attrValue(tag, 'data-testid');
      const ariaLabel = attrValue(tag, 'aria-label');
      upsertField({
        name,
        type: 'textarea',
        required: fieldRequiredByValidation(name, tag),
        id: id || null,
        label: labelsMap.get(id || '') || null,
        placeholder: placeholder || null,
        testId: testId || null,
        ariaLabel: ariaLabel || null,
        role: 'textbox',
      });
    }

    const genericFieldMatches = content.matchAll(/<(?:Controller|FormField|Field|TextField|Input|Textarea|Select)\b[^>]*\bname=["']([^"']+)["'][^>]*>/gi);
    for (const match of genericFieldMatches) {
      const tag = match[0];
      const name = String(match[1] || '').trim();
      if (!name) continue;
      const id = attrValue(tag, 'id');
      const placeholder = attrValue(tag, 'placeholder');
      const testId = attrValue(tag, 'data-testid');
      const ariaLabel = attrValue(tag, 'aria-label');
      upsertField({
        name,
        type: /Select/i.test(tag) ? 'select' : (/Textarea/i.test(tag) ? 'textarea' : 'text'),
        required: fieldRequiredByValidation(name, tag),
        id: id || null,
        label: labelsMap.get(id || '') || null,
        placeholder: placeholder || null,
        testId: testId || null,
        ariaLabel: ariaLabel || null,
        role: /Select/i.test(tag) ? 'combobox' : 'textbox',
      });
    }

    const registerMatches = content.matchAll(/\bregister\s*\(\s*['"`]([^'"`]+)['"`](?:\s*,\s*\{([\s\S]{0,300}?)\})?/gi);
    for (const match of registerMatches) {
      const name = String(match[1] || '').trim();
      if (!name) continue;
      const options = String(match[2] || '');
      upsertField({
        name,
        type: /email/i.test(name) ? 'email' : 'text',
        required: /\brequired\b/i.test(options) || fieldRequiredByValidation(name),
        id: null,
        label: null,
        placeholder: null,
        testId: null,
        ariaLabel: null,
        role: 'textbox',
      });
    }

    const zodFieldMatches = content.matchAll(/\b([A-Za-z_][\w]*)\s*:\s*z\.(?:string|number|coerce\.number)\s*\([^)]*\)((?:\s*\.\s*\w+\s*\([^)]*\))*)/g);
    for (const match of zodFieldMatches) {
      const name = String(match[1] || '').trim();
      const chain = String(match[2] || '');
      if (!name || !/(?:\.min\s*\(\s*1\b|\.nonempty\s*\(|\.email\s*\()/i.test(chain)) continue;
      upsertField({
        name,
        type: /\.email\s*\(/i.test(chain) || /email/i.test(name) ? 'email' : 'text',
        required: true,
        id: null,
        label: null,
        placeholder: null,
        testId: null,
        ariaLabel: null,
        role: 'textbox',
      });
    }

    const submitButtons = [];
    const submitMatches = content.matchAll(/<(?:button|Button)[^>]*>([\s\S]*?)<\/(?:button|Button)>/gi);
    for (const match of submitMatches) {
      const tag = match[0];
      const text = String(match[1] || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      const typeMatch = tag.match(/\btype=["']([^"']+)["']/i);
      const testIdMatch = tag.match(/\bdata-testid=["']([^"']+)["']/i);
      const ariaLabelMatch = tag.match(/\baria-label=["']([^"']+)["']/i);
      const buttonType = (typeMatch?.[1] || '').toLowerCase();
      if (buttonType === 'submit' || /submit|save|continue|login|sign in|register/i.test(text)) {
        submitButtons.push({
          text,
          type: buttonType || 'button',
          testId: testIdMatch?.[1] || null,
          ariaLabel: ariaLabelMatch?.[1] || null,
        });
      }
    }
    
    // Validation patterns
    const validationPatterns = [];
    if (content.includes('required')) validationPatterns.push('required');
    if (content.includes('pattern=') || content.includes('regex')) validationPatterns.push('pattern');
    if (content.includes('minLength') || content.includes('min=')) validationPatterns.push('minLength');
    if (content.includes('maxLength') || content.includes('max=')) validationPatterns.push('maxLength');
    if (content.includes('email')) validationPatterns.push('email');
    
    if (fields.length > 0 || formMatches.length > 0 || formHookMatches.length > 0) {
      const primaryFormIndex = Number.isFinite(formMatchRecords[0]?.index)
        ? formMatchRecords[0].index
        : (Number.isFinite(formHookMatchRecords[0]?.index) ? formHookMatchRecords[0].index : 0);
      const formTag = formMatches[0] || '';
      const actionMatch = formTag.match(/\baction=["']([^"']+)["']/i);
      const methodMatch = formTag.match(/\bmethod=["']([^"']+)["']/i);
      const componentName = this.extractNearestComponentName(content, primaryFormIndex);
      const selectorHints = fields
        .flatMap((field) => [field.testId, field.label, field.placeholder, field.name])
        .filter(Boolean)
        .slice(0, 20);

      forms.push({
        file: path.relative(this.config.projectPath, filePath),
        fields: fields.slice(0, 20), // Limit fields
        validationPatterns,
        hasFormElement: formMatches.length > 0,
        usesFormHook: formHookMatches.length > 0,
        labels: Array.from(labelsMap.values()).slice(0, 20),
        submitButtons: submitButtons.slice(0, 10),
        action: actionMatch?.[1] || null,
        method: (methodMatch?.[1] || 'POST').toUpperCase(),
        componentName,
        selectorHints,
      });
    }
    
    return forms;
  }

  /**
   * Find data models and schemas
   */
  async findDataModels(projectPath) {
    const models = [];
    
    // Look for common model locations
    const modelDirs = [
      'models', 'src/models', 'lib/models',
      'schemas', 'src/schemas', 'lib/schemas',
      'types', 'src/types', 'lib/types',
      'prisma', 'drizzle',
    ];
    
    for (const modelDir of modelDirs) {
      const fullPath = path.join(projectPath, modelDir);
      if (!fs.existsSync(fullPath)) continue;
      
      const files = this.findFiles(fullPath, ['.js', '.ts', '.prisma', '.json']);
      
      for (const file of files.slice(0, 20)) {
        try {
          const content = this.readFileCached(file, { allowLarge: true });
          if (!content) continue;
          const fileModels = this.extractModelsFromFile(content, file);
          models.push(...fileModels);
        } catch (error) {
          // Ignore errors
        }
      }
    }
    
    // Also check for TypeScript interfaces/types in src
    const srcDir = path.join(projectPath, 'src');
    if (fs.existsSync(srcDir)) {
      const tsFiles = this.findFiles(srcDir, ['.ts', '.tsx']).filter(f => 
        f.includes('type') || f.includes('interface') || f.includes('schema')
      );
      
      for (const file of tsFiles.slice(0, 10)) {
        try {
          const content = this.readFileCached(file, { allowLarge: true });
          if (!content) continue;
          const fileModels = this.extractModelsFromFile(content, file);
          models.push(...fileModels);
        } catch (error) {
          // Ignore errors
        }
      }
    }
    
    return models;
  }

  /**
   * Extract models from file content
   */
  extractModelsFromFile(content, filePath) {
    const models = [];
    
    // TypeScript interfaces
    const interfaceMatches = content.matchAll(/interface\s+(\w+)\s*\{([^}]+)\}/g);
    for (const match of interfaceMatches) {
      const fields = this.parseTypeFields(match[2]);
      models.push({
        name: match[1],
        type: 'interface',
        fields,
        file: path.basename(filePath),
      });
    }
    
    // TypeScript types
    const typeMatches = content.matchAll(/type\s+(\w+)\s*=\s*\{([^}]+)\}/g);
    for (const match of typeMatches) {
      const fields = this.parseTypeFields(match[2]);
      models.push({
        name: match[1],
        type: 'type',
        fields,
        file: path.basename(filePath),
      });
    }
    
    // Prisma models
    const prismaMatches = content.matchAll(/model\s+(\w+)\s*\{([^}]+)\}/g);
    for (const match of prismaMatches) {
      const fields = this.parsePrismaFields(match[2]);
      models.push({
        name: match[1],
        type: 'prisma',
        fields,
        file: path.basename(filePath),
      });
    }
    
    // Mongoose schemas
    const mongooseMatches = content.matchAll(/new\s+Schema\s*\(\s*\{([^}]+)\}/g);
    for (const match of mongooseMatches) {
      models.push({
        name: 'MongooseSchema',
        type: 'mongoose',
        rawSchema: match[1].substring(0, 500),
        file: path.basename(filePath),
      });
    }
    
    return models;
  }

  /**
   * Parse TypeScript type fields
   */
  parseTypeFields(fieldsStr) {
    const fields = [];
    const fieldMatches = fieldsStr.matchAll(/(\w+)(\?)?:\s*([^;,\n]+)/g);
    
    for (const match of fieldMatches) {
      fields.push({
        name: match[1],
        optional: !!match[2],
        type: match[3].trim(),
      });
    }
    
    return fields.slice(0, 20);
  }

  /**
   * Parse Prisma model fields
   */
  parsePrismaFields(fieldsStr) {
    const fields = [];
    const lines = fieldsStr.split('\n').filter(l => l.trim());
    
    for (const line of lines) {
      const match = line.match(/^\s*(\w+)\s+(\w+)(\?)?/);
      if (match) {
        fields.push({
          name: match[1],
          type: match[2],
          optional: !!match[3],
        });
      }
    }
    
    return fields.slice(0, 20);
  }

  /**
   * Detect authentication patterns
   */
  async detectAuthPatterns(projectPath) {
    const patterns = [];
    const srcDir = path.join(projectPath, 'src');
    const searchDir = fs.existsSync(srcDir) ? srcDir : projectPath;
    const files = this.findFiles(searchDir, ['.js', '.jsx', '.ts', '.tsx']);
    
    let hasJWT = false;
    let hasSession = false;
    let hasOAuth = false;
    let hasBasicAuth = false;
    let hasNextAuth = false;
    let hasClerk = false;
    let hasAuth0 = false;
    let hasCookieAuth = false;
    
    for (const file of files.slice(0, this.config.maxFiles)) {
      try {
        const content = this.readFileCached(file);
        if (!content) continue;
        
        if (content.includes('jwt') || content.includes('jsonwebtoken')) hasJWT = true;
        if (content.includes('session') || content.includes('getSession')) hasSession = true;
        if (content.includes('oauth') || content.includes('OAuth')) hasOAuth = true;
        if (content.includes('BasicAuth') || content.includes('basic-auth')) hasBasicAuth = true;
        if (content.includes('next-auth') || content.includes('NextAuth')) hasNextAuth = true;
        if (content.includes('@clerk') || content.includes('clerk')) hasClerk = true;
        if (content.includes('@auth0') || content.includes('auth0')) hasAuth0 = true;
        if (
          content.includes('createSupabaseServerClient') ||
          content.includes('createServerComponentClient') ||
          content.includes('@supabase/ssr') ||
          content.includes('supabase/auth-helpers') ||
          (content.includes('cookies()') && content.includes('supabase'))
        ) hasCookieAuth = true;
      } catch (error) {
        // Ignore errors
      }
    }
    
    if (hasNextAuth) patterns.push({ type: 'NextAuth', description: 'NextAuth.js authentication' });
    if (hasClerk) patterns.push({ type: 'Clerk', description: 'Clerk authentication service' });
    if (hasAuth0) patterns.push({ type: 'Auth0', description: 'Auth0 authentication service' });
    if (hasCookieAuth) patterns.push({ type: 'Cookie', description: 'Cookie/session-based authentication — login response contains no token field; use request.newContext() cookie jar for authenticated API tests', cookieBased: true });
    if (hasJWT && !hasCookieAuth) patterns.push({ type: 'JWT', description: 'JSON Web Token authentication' });
    if (hasSession && !hasCookieAuth) patterns.push({ type: 'Session', description: 'Session-based authentication' });
    if (hasOAuth) patterns.push({ type: 'OAuth', description: 'OAuth authentication' });
    if (hasBasicAuth) patterns.push({ type: 'Basic', description: 'Basic HTTP authentication' });
    
    return patterns;
  }

  /**
   * Read package.json for dependencies
   */
  readPackageJson(projectPath) {
    const pkgPath = path.join(projectPath, 'package.json');
    
    try {
      const content = this.readFileCached(pkgPath, { allowLarge: true, maxBytes: 5000000 });
      if (!content) return {};
      const pkg = JSON.parse(content);
      
      return {
        name: pkg.name,
        version: pkg.version,
        dependencies: pkg.dependencies || {},
        devDependencies: pkg.devDependencies || {},
        scripts: pkg.scripts || {},
      };
    } catch (error) {
      return {};
    }
  }

  /**
   * Get environment variable names (not values)
   */
  getEnvVariableNames(projectPath) {
    const envVars = new Set();
    
    // Read .env.example or .env.sample
    const envFiles = ['.env.example', '.env.sample', '.env.local.example'];
    
    for (const envFile of envFiles) {
      const envPath = path.join(projectPath, envFile);
      if (fs.existsSync(envPath)) {
        try {
          const content = this.readFileCached(envPath, { allowLarge: true, maxBytes: 500000 });
          if (!content) continue;
          const matches = content.matchAll(/^([A-Z_][A-Z0-9_]*)=/gm);
          for (const match of matches) {
            envVars.add(match[1]);
          }
        } catch (error) {
          // Ignore errors
        }
      }
    }
    
    // Scan source for process.env usage
    const srcDir = path.join(projectPath, 'src');
    if (fs.existsSync(srcDir)) {
      const files = this.findFiles(srcDir, ['.js', '.ts', '.jsx', '.tsx']);
      for (const file of files.slice(0, 30)) {
        try {
          const content = this.readFileCached(file);
          if (!content) continue;
          const matches = content.matchAll(/process\.env\.([A-Z_][A-Z0-9_]*)/g);
          for (const match of matches) {
            envVars.add(match[1]);
          }
        } catch (error) {
          // Ignore errors
        }
      }
    }
    
    return Array.from(envVars);
  }

  /**
   * Extract detailed component information
   */
  async extractComponentDetails(projectPath) {
    const components = [];
    const componentDirs = ['components', 'src/components', 'app/components'];
    
    for (const compDir of componentDirs) {
      const fullPath = path.join(projectPath, compDir);
      if (!fs.existsSync(fullPath)) continue;
      
      const files = this.findFiles(fullPath, ['.js', '.jsx', '.ts', '.tsx']);
      
      for (const file of files.slice(0, 30)) {
        try {
          const content = this.readFileCached(file);
          if (!content) continue;
          const componentData = this.extractComponentFromFile(content, file);
          if (componentData) {
            components.push(componentData);
          }
        } catch (error) {
          // Ignore errors
        }
      }
    }
    
    return components;
  }

  /**
   * Extract component data from file
   */
  extractComponentFromFile(content, filePath) {
    // Find component name
    const nameMatch = content.match(/(?:export\s+(?:default\s+)?)?(?:function|const)\s+(\w+)/);
    if (!nameMatch) return null;
    
    const name = nameMatch[1];
    
    // Extract props
    const props = [];
    const propsMatch = content.match(/(?:interface|type)\s+\w*Props\s*(?:=\s*)?\{([^}]+)\}/);
    if (propsMatch) {
      const propMatches = propsMatch[1].matchAll(/(\w+)(\?)?:\s*([^;,\n]+)/g);
      for (const match of propMatches) {
        props.push({
          name: match[1],
          optional: !!match[2],
          type: match[3].trim(),
        });
      }
    }
    
    // Detect state hooks
    const stateHooks = [];
    const stateMatches = content.matchAll(/useState\s*(?:<[^>]+>)?\s*\(\s*([^)]*)\)/g);
    for (const match of stateMatches) {
      stateHooks.push({ initialValue: match[1].substring(0, 50) });
    }
    
    // Detect event handlers
    const eventHandlers = [];
    const handlerMatches = content.matchAll(/(?:on|handle)([A-Z]\w+)\s*(?:=|:|\()/g);
    for (const match of handlerMatches) {
      if (!eventHandlers.includes(match[1])) {
        eventHandlers.push(match[1]);
      }
    }
    
    return {
      name,
      file: path.relative(this.config.projectPath, filePath),
      props: props.slice(0, 10),
      stateHooks: stateHooks.slice(0, 5),
      eventHandlers: eventHandlers.slice(0, 10),
      hasUseEffect: content.includes('useEffect'),
      hasUseRef: content.includes('useRef'),
      usesRouter: content.includes('useRouter') || content.includes('useNavigate'),
    };
  }

  /**
   * Extract API schemas from endpoint files
   */
  async extractAPISchemas(projectPath, endpoints) {
    const schemas = [];
    
    // Look for common schema/validation files
    const schemaDirs = [
      'src/schemas', 'schemas', 'src/validators', 'validators',
      'src/api', 'pages/api', 'app/api',
    ];
    
    for (const schemaDir of schemaDirs) {
      const fullPath = path.join(projectPath, schemaDir);
      if (!fs.existsSync(fullPath)) continue;
      
      const files = this.findFiles(fullPath, ['.js', '.ts']);
      
      for (const file of files.slice(0, 20)) {
        try {
          const content = this.readFileCached(file);
          if (!content) continue;
          
          // Zod schemas
          const zodMatches = content.matchAll(/(?:const|export\s+const)\s+(\w+Schema)\s*=\s*z\.object\s*\(\s*\{([^}]+)\}/g);
          for (const match of zodMatches) {
            schemas.push({
              name: match[1],
              type: 'zod',
              file: path.basename(file),
              fields: this.parseZodFields(match[2]),
            });
          }
          
          // Yup schemas
          const yupMatches = content.matchAll(/(?:const|export\s+const)\s+(\w+Schema)\s*=\s*(?:Yup|yup)\.object\s*\(\s*\{([^}]+)\}/g);
          for (const match of yupMatches) {
            schemas.push({
              name: match[1],
              type: 'yup',
              file: path.basename(file),
              rawSchema: match[2].substring(0, 300),
            });
          }
        } catch (error) {
          // Ignore errors
        }
      }
    }
    
    return schemas;
  }

  /**
   * Parse Zod schema fields
   */
  parseZodFields(fieldsStr) {
    const fields = [];
    const fieldMatches = fieldsStr.matchAll(/(\w+):\s*z\.(\w+)/g);
    
    for (const match of fieldMatches) {
      fields.push({
        name: match[1],
        type: match[2],
      });
    }
    
    return fields.slice(0, 15);
  }

  /**
   * Read key files for context
   */
  async readKeyFiles(projectPath) {
    const fileContents = {};
    
    // Key files to read
    const keyFiles = [
      'README.md',
      'src/app/page.tsx', 'src/app/page.js',
      'pages/index.tsx', 'pages/index.js',
      'src/pages/index.tsx', 'src/pages/index.js',
      'src/App.tsx', 'src/App.js',
      'src/index.tsx', 'src/index.js',
    ];
    
    for (const keyFile of keyFiles) {
      const fullPath = path.join(projectPath, keyFile);
      if (fs.existsSync(fullPath)) {
        try {
          const stat = fs.statSync(fullPath);
          if (stat.size < this.config.maxFileSize) {
            const content = this.readFileCached(fullPath);
            if (!content) continue;
            fileContents[keyFile] = content.substring(0, 5000); // Limit to 5KB
          }
        } catch (error) {
          // Ignore errors
        }
      }
    }
    
    return fileContents;
  }

  /**
   * Get project structure summary
   */
  getProjectStructure(projectPath) {
    const structure = {
      hasTypeScript: false,
      hasSrcDir: false,
      hasAppDir: false,
      hasPagesDir: false,
      hasPublicDir: false,
      hasTestsDir: false,
      framework: 'unknown',
      directories: [],
    };
    
    try {
      const entries = fs.readdirSync(projectPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        
        if (entry.isDirectory()) {
          structure.directories.push(entry.name);
          
          if (entry.name === 'src') structure.hasSrcDir = true;
          if (entry.name === 'app') structure.hasAppDir = true;
          if (entry.name === 'pages') structure.hasPagesDir = true;
          if (entry.name === 'public') structure.hasPublicDir = true;
          if (['tests', 'test', '__tests__', 'e2e', 'spec'].includes(entry.name)) {
            structure.hasTestsDir = true;
          }
        } else {
          if (entry.name === 'tsconfig.json') structure.hasTypeScript = true;
          if (entry.name === 'next.config.js' || entry.name === 'next.config.mjs') {
            structure.framework = 'nextjs';
          }
          if (entry.name === 'vite.config.js' || entry.name === 'vite.config.ts') {
            structure.framework = structure.framework === 'unknown' ? 'vite' : structure.framework;
          }
          if (entry.name === 'nuxt.config.js' || entry.name === 'nuxt.config.ts') {
            structure.framework = 'nuxt';
          }
        }
      }
      
      // Check src/app for Next.js app router
      if (fs.existsSync(path.join(projectPath, 'src', 'app'))) {
        structure.hasAppDir = true;
        structure.framework = 'nextjs';
      }
    } catch (error) {
      // Ignore errors
    }
    
    return structure;
  }

  /**
   * Find pages/routes in the codebase
   */
  async findPages(projectPath) {
    const pages = [];
    
    // Next.js pages
    const nextPagesDir = path.join(projectPath, 'pages');
    const nextAppDir = path.join(projectPath, 'app');
    const srcPagesDir = path.join(projectPath, 'src', 'pages');
    const srcAppDir = path.join(projectPath, 'src', 'app');
    
    // Check Next.js pages directory
    for (const pagesDir of [nextPagesDir, srcPagesDir]) {
      if (fs.existsSync(pagesDir)) {
        const nextPages = this.scanNextPages(pagesDir, '');
        pages.push(...nextPages);
      }
    }
    
    // Check Next.js app directory
    for (const appDir of [nextAppDir, srcAppDir]) {
      if (fs.existsSync(appDir)) {
        const appPages = this.scanNextAppDir(appDir, '');
        pages.push(...appPages);
      }
    }

    for (const appDir of this.findNestedFrameworkDirs(projectPath, ['app', path.join('src', 'app')])) {
      if (appDir === nextAppDir || appDir === srcAppDir) continue;
      const appPages = this.scanNextAppDir(appDir, '');
      pages.push(...appPages);
    }
    
    // React Router - scan for route definitions
    const routerPages = await this.findReactRouterRoutes(projectPath);
    pages.push(...routerPages);
    
    // Vue Router
    const vuePages = await this.findVueRoutes(projectPath);
    pages.push(...vuePages);

    // Multi-language route detection
    const langRoutes = await this.findMultiLangRoutes(projectPath);
    pages.push(...langRoutes);

    // If no pages found, create default
    if (pages.length === 0) {
      pages.push({
        path: '/',
        description: 'Home page',
        components: [],
        interactions: ['navigation'],
      });
    }
    
    return pages;
  }

  /**
   * Scan Next.js pages directory
   */
  scanNextPages(dir, basePath) {
    const pages = [];
    
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        // Skip special files
        if (entry.name.startsWith('_') || entry.name.startsWith('.')) continue;
        if (entry.name === 'api') continue; // API routes handled separately
        
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          // Dynamic route [param]
          const routePart = entry.name.startsWith('[') 
            ? `:${entry.name.replace(/[\[\]]/g, '')}` 
            : entry.name;
          
          const subPages = this.scanNextPages(fullPath, `${basePath}/${routePart}`);
          pages.push(...subPages);
        } else if (entry.isFile() && this.isPageFile(entry.name)) {
          const pageName = entry.name.replace(/\.(js|jsx|ts|tsx)$/, '');
          const routePath = pageName === 'index' 
            ? basePath || '/'
            : `${basePath}/${pageName}`;
          const uiHints = this.extractPageUIHints(fullPath);
          
          pages.push({
            path: routePath,
            sourceFile: path.relative(this.config.projectPath, fullPath),
            description: this.formatPageName(routePath),
            components: uiHints.components,
            interactions: uiHints.interactions,
            buttons: uiHints.buttons,
            links: uiHints.links,
            testIds: uiHints.testIds,
            ariaRoles: uiHints.ariaRoles,
            navigationTargets: uiHints.navigationTargets,
            selectorHints: uiHints.selectorHints,
          });
        }
      }
    } catch (error) {
      // Ignore errors
    }
    
    return pages;
  }

  /**
   * Scan Next.js app directory
   */
  scanNextAppDir(dir, basePath) {
    const pages = [];
    
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.name.startsWith('_') || entry.name.startsWith('.')) continue;
        if (entry.name === 'api') continue;
        
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          // Check for page.js/tsx
          const pageFile = ['page.js', 'page.jsx', 'page.ts', 'page.tsx']
            .map(f => path.join(fullPath, f))
            .find(f => fs.existsSync(f));
          
          const routePart = entry.name.startsWith('(') 
            ? '' // Route groups don't affect URL
            : entry.name.startsWith('[') 
              ? `:${entry.name.replace(/[\[\]]/g, '')}`
              : entry.name;
          
          const newBasePath = routePart ? `${basePath}/${routePart}` : basePath;
          
          if (pageFile) {
            const uiHints = this.extractPageUIHints(pageFile);
            pages.push({
              path: newBasePath || '/',
              sourceFile: path.relative(this.config.projectPath, pageFile),
              description: this.formatPageName(newBasePath || '/'),
              components: uiHints.components,
              interactions: uiHints.interactions,
              buttons: uiHints.buttons,
              links: uiHints.links,
              testIds: uiHints.testIds,
              ariaRoles: uiHints.ariaRoles,
              navigationTargets: uiHints.navigationTargets,
              selectorHints: uiHints.selectorHints,
            });
          }
          
          // Recurse into subdirectories
          const subPages = this.scanNextAppDir(fullPath, newBasePath);
          pages.push(...subPages);
        }
      }
    } catch (error) {
      // Ignore errors
    }
    
    return pages;
  }

  /**
   * Find React Router route definitions
   */
  async findReactRouterRoutes(projectPath) {
    const pages = [];
    const routePatterns = [
      /path=["'`]([^"'`]+)["'`]/g,
      /path\s*:\s*["'`]([^"'`]+)["'`]/g,
      /Route\s+path=["'`]([^"'`]+)["'`]/g,
      /<Route[^>]+path=["'`]([^"'`]+)["'`]/g,
    ];
    
    const srcDir = path.join(projectPath, 'src');
    const files = this.findFiles(fs.existsSync(srcDir) ? srcDir : projectPath, ['.js', '.jsx', '.ts', '.tsx']);
    
    for (const file of files.slice(0, this.config.maxFiles)) {
      try {
        const content = this.readFileCached(file);
        if (!content) continue;
        
        for (const pattern of routePatterns) {
          let match;
          while ((match = pattern.exec(content)) !== null) {
            const rawRoutePath = match[1];
            const routePath = rawRoutePath === '' ? '/' : (rawRoutePath.startsWith('/') ? rawRoutePath : `/${rawRoutePath}`);
            if (routePath && !routePath.includes('*') && !pages.some(p => p.path === routePath)) {
              const uiHints = this.extractPageUIHints(file);
              const guard = this.extractRouteGuardInfo(content, match.index);
              pages.push({
                path: routePath,
                sourceFile: path.relative(this.config.projectPath, file),
                routeComponent: this.extractRouteComponentName(content, match.index),
                requiresAuth: guard.requiresAuth,
                requiredRole: guard.requiredRole,
                description: this.formatPageName(routePath),
                components: uiHints.components,
                interactions: uiHints.interactions,
                buttons: uiHints.buttons,
                links: uiHints.links,
                testIds: uiHints.testIds,
                ariaRoles: uiHints.ariaRoles,
                navigationTargets: uiHints.navigationTargets,
                selectorHints: uiHints.selectorHints,
              });
            }
          }
        }
      } catch (error) {
        // Ignore read errors
      }
    }
    
    return pages;
  }

  /**
   * Find Vue Router route definitions
   */
  async findVueRoutes(projectPath) {
    const pages = [];
    const routerFile = ['router/index.js', 'router/index.ts', 'router.js', 'router.ts']
      .map(f => path.join(projectPath, 'src', f))
      .find(f => fs.existsSync(f));
    
    if (!routerFile) return pages;
    
    try {
      const content = this.readFileCached(routerFile, { allowLarge: true });
      if (!content) return pages;
      const pathPattern = /path:\s*["'`]([^"'`]+)["'`]/g;
      
      let match;
      while ((match = pathPattern.exec(content)) !== null) {
        const routePath = match[1];
        if (routePath && !pages.some(p => p.path === routePath)) {
          const uiHints = this.extractPageUIHints(routerFile);
          pages.push({
            path: routePath,
            sourceFile: path.relative(this.config.projectPath, routerFile),
            description: this.formatPageName(routePath),
            components: uiHints.components,
            interactions: uiHints.interactions,
            buttons: uiHints.buttons,
            links: uiHints.links,
            testIds: uiHints.testIds,
            ariaRoles: uiHints.ariaRoles,
            navigationTargets: uiHints.navigationTargets,
            selectorHints: uiHints.selectorHints,
          });
        }
      }
    } catch (error) {
      // Ignore errors
    }
    
    return pages;
  }

  /**
   * Find API endpoints in the codebase
   */
  async findAPIEndpoints(projectPath) {
    const endpoints = [];
    
    // Next.js API routes
    const apiDirs = [
      path.join(projectPath, 'pages', 'api'),
      path.join(projectPath, 'src', 'pages', 'api'),
      path.join(projectPath, 'app', 'api'),
      path.join(projectPath, 'src', 'app', 'api'),
    ];
    
    for (const apiDir of apiDirs) {
      if (fs.existsSync(apiDir)) {
        const apiEndpoints = this.scanAPIRoutes(apiDir, '/api');
        endpoints.push(...apiEndpoints);
      }
    }

    for (const apiDir of this.findNestedFrameworkDirs(projectPath, [
      path.join('pages', 'api'),
      path.join('src', 'pages', 'api'),
      path.join('app', 'api'),
      path.join('src', 'app', 'api'),
    ])) {
      if (apiDirs.includes(apiDir)) continue;
      endpoints.push(...this.scanAPIRoutes(apiDir, '/api'));
    }
    
    const normParams = (p) => String(p).replace(/:[^/]+/g, ':p');

    // Multi-service (monorepo) scope. The global Express scan is capped at
    // maxFiles, so in a repo with a large frontend the cap can be exhausted
    // before a backend service's routes are reached — and even when a route
    // file IS reached, its entry file (server.js) may be truncated, yielding a
    // WRONG unprefixed path. To avoid both gaps, each backend service directory
    // is scanned on its OWN file budget (correct, service-local mount-prefix
    // resolution), and the global scan drops anything that lives inside a backend
    // service dir — the scoped scan owns those routes authoritatively.
    const services = this.detectMonorepoServices(projectPath);
    const backendServices = services.filter((s) => s.isBackend);

    const isInBackendService = (src) => {
      if (!src) return false;
      const abs = path.resolve(this.config.projectPath, src);
      return backendServices.some((svc) => abs === svc.path || abs.startsWith(svc.path + path.sep));
    };

    // Scoped per-service Express scan (authoritative for routes under a service).
    for (const svc of backendServices) {
      const svcEndpoints = await this.findExpressRoutes(svc.path);
      for (const ep of svcEndpoints) {
        ep.baseService = svc.name;
        const dup = endpoints.some(
          (e) => e.method === ep.method && normParams(e.path) === normParams(ep.path) && e.baseService === ep.baseService,
        );
        if (!dup) endpoints.push(ep);
      }
    }

    // Global recursive Express scan — keeps root-level routes and single-service
    // repos working, but skips routes already owned by a scoped service scan.
    const expressEndpoints = await this.findExpressRoutes(projectPath);
    for (const ep of expressEndpoints) {
      if (isInBackendService(ep.source)) continue;
      endpoints.push(ep);
    }

    // Multi-language API endpoint detection
    const langEndpoints = await this.findMultiLangEndpoints(projectPath);
    endpoints.push(...langEndpoints);

    // Client-side API call discovery (fetch/axios). Augments server-side route
    // detection and is the primary source for frontend-only repos that call an
    // external API. Only adds calls not already covered by a server endpoint.
    const clientEndpoints = await this.findClientApiCalls(projectPath);
    for (const ce of clientEndpoints) {
      const dup = endpoints.some((e) => e.method === ce.method && normParams(e.path) === normParams(ce.path));
      if (!dup) endpoints.push(ce);
    }

    // If no endpoints found, add health check
    if (endpoints.length === 0) {
      endpoints.push({
        method: 'GET',
        path: '/api/health',
        description: 'Health check endpoint',
        requiresAuth: false,
        authType: 'none',
        authEnforcement: 'none',
        synthetic: true,
        source: 'healix_fallback',
      });
    }

    // Phase 3: discover and merge standalone spec files (OpenAPI, Postman, GraphQL).
    const specFiles = this.findApiSpecFiles(projectPath);
    if (specFiles.length) {
      const specEndpoints = specFiles.flatMap((sf) => this.parseStandaloneSpec(sf));
      this.mergeStandaloneSpecIntoEndpoints(specEndpoints, endpoints);
    }

    // Phase 4: tag each endpoint with baseService (monorepo) and version prefix.
    // `services` was computed above for the scoped multi-service scan; reuse it.
    const VERSION_RE = /\/v(\d+(?:\.\d+)?)\//i;
    for (const ep of endpoints) {
      // baseService: which service directory owns this endpoint's source file.
      // Endpoints from the scoped per-service scan are already tagged; this
      // backfills baseService for endpoints found by the global scan.
      if (!ep.baseService && ep.source && services.length) {
        const absSource = path.resolve(projectPath, ep.source);
        for (const svc of services) {
          if (absSource.startsWith(svc.path + path.sep)) { ep.baseService = svc.name; break; }
        }
      }
      // version: extract v1/v2 from path.
      if (!ep.version) {
        const vm = (ep.path || '').match(VERSION_RE);
        if (vm) ep.version = `v${vm[1]}`;
      }
    }

    // Post-processing: link login endpoint + tokenField to token-based endpoints,
    // and stamp client-only enforcement on endpoints that have no backend enforcement
    // but where the project has frontend-only auth gates (localStorage / route guards).
    const loginInfo = this.resolveLoginEndpoint(endpoints);
    const hasFrontendOnlyAuth = this._detectFrontendOnlyAuth(projectPath);

    for (const ep of endpoints) {
      // Ensure all endpoints have authType/authEnforcement fields.
      if (!ep.authType) ep.authType = 'none';
      if (!ep.authEnforcement) ep.authEnforcement = 'none';

      // Elevate to client-only when frontend auth gates exist but backend has no enforcement.
      if (ep.authEnforcement === 'none' && hasFrontendOnlyAuth) {
        ep.authEnforcement = 'client-only';
      }

      // Link login endpoint + tokenField when auth is token-based.
      if (loginInfo && (ep.authType === 'bearerJWT' || ep.authType === 'customHeader')) {
        ep.loginEndpoint = ep.loginEndpoint || loginInfo.loginEndpoint;
        if (loginInfo.tokenField) ep.tokenField = ep.tokenField || loginInfo.tokenField;
      }
    }

    return endpoints;
  }

  /**
   * Detect frontend-only auth patterns: localStorage tokens, sessionStorage auth,
   * or React Router / Vue Router guard components without any backend enforcement.
   * Used to label endpoints as 'client-only' when the backend is open but the
   * frontend restricts access via guards.
   */
  _detectFrontendOnlyAuth(projectPath) {
    const FRONTEND_DIRS = ['src', 'client', 'frontend', 'app', 'pages', 'components'];
    const FRONTEND_AUTH_RE = /localStorage\.(getItem|setItem)\s*\(\s*['"`][^'"`]*(token|auth|user)[^'"`]*['"`]/i;
    const STORAGE_AUTH_RE = /sessionStorage\.(getItem|setItem)\s*\(\s*['"`][^'"`]*(token|auth)[^'"`]*['"`]/i;

    for (const dir of FRONTEND_DIRS) {
      const fullDir = path.join(projectPath, dir);
      if (!fs.existsSync(fullDir)) continue;
      try {
        const files = this.findFiles(fullDir, ['.js', '.jsx', '.ts', '.tsx']).slice(0, 30);
        for (const file of files) {
          const content = this.readFileCached(file);
          if (!content) continue;
          if (FRONTEND_AUTH_RE.test(content) || STORAGE_AUTH_RE.test(content)) return true;
        }
      } catch { /* ignore */ }
    }
    return false;
  }

  // ─── Phase 4: Multi-service scope, content-type, param enrichment ───────────

  /**
   * Detect independent services in a monorepo: any directory with its own
   * package.json. Scans immediate subdirectories AND one level inside common
   * workspace container dirs (packages/, apps/, services/) so pnpm/turbo/nx
   * layouts like apps/backend or packages/api are found. Used to tag endpoints
   * with `baseService` and to give each backend its own scan budget.
   *
   * Returns [{ name, path, isBackend }].
   */
  detectMonorepoServices(projectPath) {
    const services = [];
    const seen = new Set();
    const SKIP = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', 'out', '.next', 'vendor', 'generated']);
    const CONTAINERS = new Set(['packages', 'apps', 'services', 'servers', 'modules']);

    const consider = (dir, name) => {
      const abs = path.resolve(dir);
      if (seen.has(abs)) return;
      if (!fs.existsSync(path.join(abs, 'package.json'))) return;
      seen.add(abs);
      services.push({ name, path: abs, isBackend: this._isBackendService(abs) });
    };

    const scanLevel = (root, depth) => {
      let entries = [];
      try { entries = fs.readdirSync(root, { withFileTypes: true }); } catch { return; }
      for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith('.') || SKIP.has(entry.name)) continue;
        const subPath = path.join(root, entry.name);
        consider(subPath, entry.name);
        // Descend one level into workspace container dirs (packages/*, apps/*, …).
        if (depth === 0 && CONTAINERS.has(entry.name.toLowerCase())) {
          scanLevel(subPath, depth + 1);
        }
      }
    };

    scanLevel(projectPath, 0);
    return services;
  }

  /**
   * Return true when a directory looks like a backend service: has a known server
   * framework in its package.json deps, or has a routes/ directory or server.js entry.
   */
  _isBackendService(dirPath) {
    try {
      const raw = this.readFileCached(path.join(dirPath, 'package.json'), { allowLarge: true, maxBytes: 200000 });
      const pkg = raw ? JSON.parse(raw) : {};
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (['express', 'fastify', 'koa', '@hapi/hapi', 'hapi', 'restify', '@nestjs/core'].some((d) => deps[d])) return true;
    } catch { /* ignore */ }
    return (
      fs.existsSync(path.join(dirPath, 'routes')) ||
      fs.existsSync(path.join(dirPath, 'src', 'routes')) ||
      fs.existsSync(path.join(dirPath, 'server.js')) ||
      fs.existsSync(path.join(dirPath, 'app.js'))
    );
  }

  // ─── Phase 3: Standalone spec file parsing + discrepancy detection ──────────

  /**
   * Discover standalone API spec files in the project tree.
   * Searches the project root and common spec directories.
   * Returns [{ filePath, format: 'openapi'|'postman'|'graphql' }].
   */
  findApiSpecFiles(projectPath) {
    const specs = [];
    const OPENAPI_RE = /(?:openapi|swagger|api[-_]?spec|api[-_]?docs?)\.(?:json|ya?ml)$/i;
    const POSTMAN_RE = /\.postman_collection\.json$/i;
    const GRAPHQL_RE = /(?:schema\.graphql|\.graphql|\.gql)$/i;

    const searchRoots = [
      projectPath,
      path.join(projectPath, 'docs'),
      path.join(projectPath, 'api'),
      path.join(projectPath, 'spec'),
      path.join(projectPath, 'openapi'),
      path.join(projectPath, 'swagger'),
      path.join(projectPath, 'src'),
    ];

    const seen = new Set();
    for (const root of searchRoots) {
      if (!fs.existsSync(root)) continue;
      try {
        const entries = fs.readdirSync(root, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isFile()) continue;
          const full = path.resolve(root, entry.name);
          if (seen.has(full)) continue;
          seen.add(full);
          if (OPENAPI_RE.test(entry.name)) specs.push({ filePath: full, format: 'openapi' });
          else if (POSTMAN_RE.test(entry.name)) specs.push({ filePath: full, format: 'postman' });
          else if (GRAPHQL_RE.test(entry.name)) specs.push({ filePath: full, format: 'graphql' });
        }
      } catch { /* ignore */ }
    }
    return specs;
  }

  /**
   * Dispatch to the right parser based on spec format.
   */
  parseStandaloneSpec({ filePath, format }) {
    switch (format) {
      case 'openapi': return this.parseOpenApiSpec(filePath);
      case 'postman': return this.parsePostmanCollection(filePath);
      case 'graphql': return this.parseGraphQLSchema(filePath);
      default: return [];
    }
  }

  /**
   * Parse an OpenAPI 2.x (Swagger) or 3.x spec file into normalized endpoint
   * objects. Response bodies carry category:'expected', provenance:'spec' so the
   * generator treats them as authoritative assertion targets.
   */
  parseOpenApiSpec(filePath) {
    try {
      const raw = this.readFileCached(filePath, { allowLarge: true, maxBytes: 2000000 });
      if (!raw) return [];
      let doc;
      if (/\.ya?ml$/i.test(filePath)) {
        if (!yaml) return []; // js-yaml not installed
        doc = yaml.load(raw);
      } else {
        doc = JSON.parse(raw);
      }
      if (!doc || typeof doc !== 'object' || !doc.paths) return [];

      const isV3 = !!doc.openapi;
      const basePath = doc.basePath || '';
      const globalSecurity = doc.security || [];
      const endpoints = [];

      for (const [routePath, pathItem] of Object.entries(doc.paths)) {
        for (const method of ['get', 'post', 'put', 'patch', 'delete', 'head', 'options']) {
          const op = pathItem[method];
          if (!op || typeof op !== 'object') continue;

          const fullPath = basePath ? `${basePath}${routePath}` : routePath;

          // Request body
          let requestBody = null;
          if (isV3 && op.requestBody) {
            const schema = op.requestBody?.content?.['application/json']?.schema;
            const fields = this._schemaPropsToFields(schema);
            if (fields.length) {
              requestBody = { contentType: 'application/json', fields, required: schema?.required || [], provenance: 'spec' };
            }
          } else if (!isV3) {
            const bodyParam = (op.parameters || []).find((p) => p.in === 'body');
            if (bodyParam?.schema) {
              const fields = this._schemaPropsToFields(bodyParam.schema);
              if (fields.length) {
                requestBody = { contentType: 'application/json', fields, required: bodyParam.schema.required || [], provenance: 'spec' };
              }
            }
          }

          // Path + query params
          const allParams = [...(pathItem.parameters || []), ...(op.parameters || [])];
          const pathParams = allParams.filter((p) => p.in === 'path').map((p) => p.name);
          const queryParams = allParams.filter((p) => p.in === 'query').map((p) => p.name);

          // Responses
          const successResponses = [];
          const failureResponses = [];
          const responseCodes = [];
          for (const [statusStr, respObj] of Object.entries(op.responses || {})) {
            const status = parseInt(statusStr, 10);
            if (isNaN(status)) continue;
            responseCodes.push(status);

            const schema = isV3
              ? respObj?.content?.['application/json']?.schema
              : respObj?.schema;
            const bodyShape = schema ? this._schemaPropsToShape(schema) : null;
            const errorMessage = typeof respObj.description === 'string' && status >= 400
              ? respObj.description : null;

            const entry = { status, bodyShape, errorMessage, category: 'expected', provenance: 'spec' };
            if (status >= 200 && status < 300) successResponses.push(entry);
            else if (status >= 400) failureResponses.push(entry);
          }

          const security = op.security !== undefined ? op.security : globalSecurity;
          const requiresAuth = security.length > 0;

          endpoints.push({
            method: method.toUpperCase(),
            path: fullPath,
            description: op.summary || op.operationId || `${method.toUpperCase()} ${fullPath}`,
            requiresAuth,
            source: path.relative(this.config.projectPath, filePath),
            schemaSource: 'spec',
            ...(requestBody ? { requestBody } : {}),
            ...(pathParams.length ? { pathParams } : {}),
            ...(queryParams.length ? { queryParams } : {}),
            responseCodes,
            responses: { success: successResponses, failure: failureResponses },
            specProvenance: filePath,
          });
        }
      }
      return endpoints;
    } catch { return []; }
  }

  /**
   * Parse a Postman Collection v2.x file into normalized endpoint objects.
   * Request body fields are extracted from raw JSON bodies.
   */
  parsePostmanCollection(filePath) {
    try {
      const raw = this.readFileCached(filePath, { allowLarge: true, maxBytes: 2000000 });
      if (!raw) return [];
      const col = JSON.parse(raw);
      const out = [];
      this._flattenPostmanItems(col.item || [], out, filePath);
      return out;
    } catch { return []; }
  }

  _flattenPostmanItems(items, out, filePath) {
    for (const item of items || []) {
      if (Array.isArray(item.item)) { this._flattenPostmanItems(item.item, out, filePath); continue; }
      const req = item.request;
      if (!req) continue;

      const method = String(req.method || 'GET').toUpperCase();
      let rawUrl = typeof req.url === 'string' ? req.url : (req.url?.raw || '');
      rawUrl = rawUrl.replace(/\{\{[^}]+\}\}/g, ':param');
      const pathMatch = rawUrl.match(/(?:https?:\/\/[^/]+)?(\/[^?#]*)/);
      const epPath = pathMatch ? pathMatch[1] : (rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`);

      let requestBody = null;
      if (req.body?.mode === 'raw' && req.body.raw) {
        try {
          const parsed = JSON.parse(req.body.raw);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            const fields = Object.keys(parsed).map((k) => ({
              name: k, type: typeof parsed[k], required: false, provenance: 'spec',
            }));
            if (fields.length) requestBody = { contentType: 'application/json', fields, required: [], provenance: 'spec' };
          }
        } catch { /* non-JSON body */ }
      }

      out.push({
        method,
        path: epPath || '/',
        description: item.name || `${method} ${epPath}`,
        requiresAuth: false,
        source: path.relative(this.config.projectPath, filePath),
        schemaSource: 'spec',
        ...(requestBody ? { requestBody } : {}),
        responseCodes: [],
        responses: { success: [], failure: [] },
        specProvenance: filePath,
      });
    }
  }

  /**
   * Parse a GraphQL SDL schema file. Maps Query fields to GET /graphql and
   * Mutation fields to POST /graphql so they appear in the endpoint list.
   */
  parseGraphQLSchema(filePath) {
    try {
      const raw = this.readFileCached(filePath, { allowLarge: true, maxBytes: 500000 });
      if (!raw) return [];
      const endpoints = [];
      const typeRe = /type\s+(Query|Mutation)\s*\{([^}]+)\}/gs;
      let m;
      while ((m = typeRe.exec(raw)) !== null) {
        const kind = m[1];
        const body = m[2];
        const method = kind === 'Mutation' ? 'POST' : 'GET';
        const fieldRe = /(\w+)\s*(?:\([^)]*\))?\s*:/g;
        let fm;
        while ((fm = fieldRe.exec(body)) !== null) {
          const fieldName = fm[1];
          if (/^__/.test(fieldName)) continue;
          endpoints.push({
            method,
            path: '/graphql',
            description: `${kind}.${fieldName}`,
            requiresAuth: false,
            source: path.relative(this.config.projectPath, filePath),
            schemaSource: 'spec',
            responseCodes: [],
            responses: { success: [], failure: [] },
            specProvenance: filePath,
            graphqlOperation: fieldName,
            graphqlKind: kind,
          });
        }
      }
      return endpoints;
    } catch { return []; }
  }

  /**
   * Convert a JSON Schema `properties` map to a flat array of field descriptors.
   */
  _schemaPropsToFields(schema) {
    if (!schema?.properties) return [];
    return Object.entries(schema.properties).map(([name, prop]) => ({
      name,
      type: prop.type || (prop.$ref ? 'object' : 'unknown'),
      required: (schema.required || []).includes(name),
      provenance: 'spec',
    }));
  }

  /**
   * Convert a JSON Schema node to a flat shape map { fieldName: 'type' }.
   * Handles object (properties) and array-of-objects (items.properties).
   */
  _schemaPropsToShape(schema) {
    if (!schema) return null;
    if (schema.properties) {
      const shape = {};
      for (const [k, v] of Object.entries(schema.properties)) {
        shape[k] = v.type || (v.$ref ? 'object' : 'unknown');
      }
      return Object.keys(shape).length ? shape : null;
    }
    if (schema.type === 'array' && schema.items?.properties) {
      const inner = this._schemaPropsToShape(schema.items);
      return inner ? { _array: true, ...inner } : null;
    }
    return null;
  }

  /**
   * Merge standalone spec endpoints into the code-discovered endpoint list.
   *
   * Interface fields (path, method, requestBody) ← CODE wins (must be runnable).
   * Expected behavior (responses) ← SPEC wins (labeled 'expected', assertion target).
   * Observed behavior (code responses) ← kept, labeled 'observed'.
   * Discrepancies → recorded when spec and code disagree on response shape fields.
   *
   * Spec-only endpoints (not yet in code) are appended with specOnly:true.
   */
  mergeStandaloneSpecIntoEndpoints(specEndpoints, codeEndpoints) {
    if (!specEndpoints.length) return codeEndpoints;

    const normPath = (p) => String(p || '').replace(/:[^/]+/g, ':p').replace(/\{[^}]+\}/g, ':p').toLowerCase();
    const key = (ep) => `${String(ep.method || 'GET').toUpperCase()} ${normPath(ep.path)}`;

    const codeMap = new Map();
    for (const ep of codeEndpoints) codeMap.set(key(ep), ep);

    // Deduplicate spec endpoints from potentially multiple spec files.
    const specMap = new Map();
    for (const ep of specEndpoints) {
      const k = key(ep);
      if (!specMap.has(k)) {
        specMap.set(k, { ...ep, responses: { success: [...(ep.responses?.success || [])], failure: [...(ep.responses?.failure || [])] } });
      } else {
        const ex = specMap.get(k);
        ex.responses.success.push(...(ep.responses?.success || []));
        ex.responses.failure.push(...(ep.responses?.failure || []));
      }
    }

    // Mutate codeEndpoints in place so spec-only endpoints persist for callers
    // that ignore the return value (findAPIEndpoints passes its array directly).
    for (const [k, specEp] of specMap) {
      const codeEp = codeMap.get(k);
      if (!codeEp) {
        // Endpoint documented in spec but not yet found in code.
        codeEndpoints.push({ ...specEp, specOnly: true });
        continue;
      }

      // Prepend spec (expected) responses before code (observed) ones so
      // normalizeContractFields picks 'expected' as the primary shape.
      const codeResponses = codeEp.responses || { success: [], failure: [] };
      codeEp.responses = {
        success: [...(specEp.responses.success || []), ...(codeResponses.success || [])],
        failure: [...(specEp.responses.failure || []), ...(codeResponses.failure || [])],
      };

      // Update responseShape/responseSchema to use the 'expected' shape when available.
      const primaryExpected = codeEp.responses.success.find((r) => r?.category === 'expected' && r?.bodyShape);
      if (primaryExpected) {
        codeEp.responseShape = primaryExpected.bodyShape;
        codeEp.responseSchema = primaryExpected.bodyShape;
      }

      // Backfill requestBody from spec when code didn't extract it.
      if (specEp.requestBody?.fields?.length && !codeEp.requestBody?.fields?.length) {
        codeEp.requestBody = specEp.requestBody;
        codeEp.requestSchema = { fields: specEp.requestBody.fields, required: specEp.requestBody.required || [] };
      }

      // Merge response codes.
      const allCodes = [...new Set([...(codeEp.responseCodes || []), ...(specEp.responseCodes || [])])];
      if (allCodes.length) { codeEp.responseCodes = allCodes; codeEp.expectedStatuses = allCodes; }

      // Detect discrepancies between spec expected shape and code observed shape.
      codeEp.discrepancies = codeEp.discrepancies || [];
      this._detectResponseDiscrepancies(codeEp, specEp);

      codeEp.schemaSource = codeEp.schemaSource ? `${codeEp.schemaSource}+spec` : 'spec';
    }

    return codeEndpoints;
  }

  /**
   * Compare spec (expected) success response shapes against code (observed) shapes.
   * Fields in spec but absent in code → stale doc or missing implementation.
   * Fields in code but absent in spec → undocumented field.
   */
  _detectResponseDiscrepancies(codeEp, specEp) {
    const specSuccess = (specEp.responses?.success || []).filter((r) => r?.bodyShape);
    const codeSuccess = (codeEp.responses?.success || []).filter((r) => r?.category === 'observed' && r?.bodyShape);
    if (!specSuccess.length || !codeSuccess.length) return;

    const specShape = specSuccess[0].bodyShape;
    const codeShape = codeSuccess[0].bodyShape;

    for (const [field, specType] of Object.entries(specShape || {})) {
      if (!(field in (codeShape || {}))) {
        codeEp.discrepancies.push({
          field: `responses.success.${field}`,
          spec: specType,
          code: 'absent',
          specSource: specEp.specProvenance || 'spec',
          note: 'field in spec not returned by controller — stale doc or missing implementation',
        });
      }
    }

    for (const [field, codeType] of Object.entries(codeShape || {})) {
      if (!(field in (specShape || {}))) {
        codeEp.discrepancies.push({
          field: `responses.success.${field}`,
          spec: 'absent',
          code: codeType,
          specSource: specEp.specProvenance || 'spec',
          note: 'field returned by controller not documented in spec',
        });
      }
    }
  }

  /**
   * Scan API routes directory
   */
  scanAPIRoutes(dir, basePath) {
    const endpoints = [];
    
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.name.startsWith('_') || entry.name.startsWith('.')) continue;
        
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          const optionalCatchAll = entry.name.match(/^\[\[\.\.\.([^\]]+)\]\]$/);
          const catchAll = entry.name.match(/^\[\.\.\.([^\]]+)\]$/);
          const dynamicSegment = entry.name.match(/^\[([^\]]+)\]$/);
          const routePart = optionalCatchAll
            ? ''
            : catchAll
              ? `:${catchAll[1]}`
              : dynamicSegment
                ? `:${dynamicSegment[1]}`
                : entry.name;
          
          const subEndpoints = this.scanAPIRoutes(
            fullPath,
            routePart ? `${basePath}/${routePart}` : basePath,
          );
          endpoints.push(...subEndpoints);
        } else if (this.isPageFile(entry.name)) {
          const routeName = entry.name.replace(/\.(js|jsx|ts|tsx)$/, '');
          const routePath = routeName === 'index' || routeName === 'route'
            ? basePath
            : `${basePath}/${routeName}`;
          
          // Detect HTTP methods from file content
          const methods = this.detectHTTPMethods(fullPath);
          
          for (const method of methods) {
            endpoints.push({
              method,
              path: routePath,
              description: `${method} ${routePath}`,
              requiresAuth: this.detectAuthRequired(fullPath),
              source: path.relative(this.config.projectPath, fullPath),
            });
          }
        }
      }
    } catch (error) {
      // Ignore errors
    }
    
    return endpoints;
  }

  /**
   * Find Express.js route definitions.
   *
   * Resolves `app.use('/prefix', routerVar)` mount points so router-file paths
   * become their real absolute URLs (e.g. `router.get('/:id')` in userRoutes.js
   * mounted at `/api/users` → `GET /api/users/:id`). Without prefix resolution,
   * sibling routers that share relative paths (`/`, `/:id`) collapse into each
   * other and entire route groups are silently lost.
   */
  async findExpressRoutes(projectPath) {
    const endpoints = [];
    const routePatterns = [
      /(app|router)\.(get|post|put|patch|delete)\s*\(\s*["'`]([^"'`]+)["'`]/gi,
    ];

    const files = this.findFiles(projectPath, ['.js', '.ts']);
    const mountMap = this.resolveExpressMounts(files);
    const globalAuth = this.detectGlobalAuth(files);

    for (const file of files.slice(0, this.config.maxFiles)) {
      // Skip node_modules and test files
      if (file.includes('node_modules') || file.includes('.spec.') || file.includes('.test.')) continue;

      try {
        const content = this.readFileCached(file);
        if (!content) continue;

        const mountPrefix = mountMap.get(path.resolve(file)) || '';

        for (const pattern of routePatterns) {
          pattern.lastIndex = 0;
          let match;
          while ((match = pattern.exec(content)) !== null) {
            const registrar = match[1].toLowerCase(); // 'app' or 'router'
            const method = match[2].toUpperCase();
            const relPath = match[3];
            // `app.<method>(...)` paths are already absolute; only `router.*`
            // paths inherit the mount prefix discovered from app.use(...).
            const fullPath = registrar === 'app'
              ? this.joinRoutePath('', relPath)
              : this.joinRoutePath(mountPrefix, relPath);
            const auth = this.detectExpressRouteAuth(content, match.index);
            const authClass = this.classifyEndpointAuth(content, match.index, content);

            // Enforcement layer: route-level > global app.use > none.
            const authEnforcement = auth.requiresAuth
              ? 'route'
              : (globalAuth.enforced ? 'global' : 'none');
            // Auth type: route-level classifier wins; fall back to global type.
            const authType = auth.requiresAuth
              ? authClass.type
              : (globalAuth.enforced ? globalAuth.authType : 'none');
            const authCarrier = auth.requiresAuth
              ? authClass.carrier
              : (globalAuth.enforced ? globalAuth.carrier : null);

            if (!endpoints.some(e => e.method === method && e.path === fullPath)) {
              const schema = this.extractEndpointSchema({ content, matchIndex: match.index, method, routeFile: file });
              endpoints.push({
                method,
                path: fullPath,
                description: schema.summary || `${method} ${fullPath}`,
                requiresAuth: auth.requiresAuth || globalAuth.enforced,
                ...(auth.requiredRole ? { requiredRole: auth.requiredRole } : {}),
                authType,
                authEnforcement,
                ...(authCarrier ? { authCarrier } : {}),
                source: path.relative(this.config.projectPath, file),
                ...(schema.requestBody ? { requestBody: schema.requestBody } : {}),
                ...(schema.pathParams && schema.pathParams.length ? { pathParams: schema.pathParams } : {}),
                ...(schema.queryParams && schema.queryParams.length ? { queryParams: schema.queryParams } : {}),
                ...(schema.schemaSource ? { schemaSource: schema.schemaSource } : {}),
                ...this.normalizeContractFields(schema),
              });
            }
          }
        }
      } catch (error) {
        // Ignore errors
      }
    }

    return endpoints;
  }

  /**
   * Build a map of router-file → mount prefix by parsing entry files
   * (app.js/server.js/index.js/main.js) for `require` aliases and the
   * `app.use('/prefix', alias)` calls that mount them.
   */
  resolveExpressMounts(files) {
    const map = new Map();
    const entries = files.filter((f) =>
      /(?:app|server|index|main)\.(?:js|ts)$/i.test(path.basename(f)) && !f.includes('node_modules'));

    for (const entry of entries) {
      const content = this.readFileCached(entry);
      if (!content || !content.includes('app.use')) continue;

      // const userRoutes = require('./routes/userRoutes')
      const requireMap = new Map();
      const reqRe = /(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*require\(\s*["'`](\.[^"'`]+)["'`]\s*\)/g;
      let rm;
      while ((rm = reqRe.exec(content)) !== null) {
        const resolved = this.resolveRequirePath(entry, rm[2]);
        if (resolved) requireMap.set(rm[1], resolved);
      }

      // app.use('/api/users', userRoutes)
      const useRe = /app\.use\(\s*["'`](\/[^"'`]*)["'`]\s*,\s*([A-Za-z0-9_$]+)\s*\)/g;
      let um;
      while ((um = useRe.exec(content)) !== null) {
        const resolved = requireMap.get(um[2]);
        if (resolved) map.set(resolved, um[1]);
      }

      // Inline form: app.use('/api', require('./routes/users'))
      const useInlineRe = /app\.use\(\s*["'`](\/[^"'`]*)["'`]\s*,\s*require\(\s*["'`](\.[^"'`]+)["'`]\s*\)\s*\)/g;
      let uim;
      while ((uim = useInlineRe.exec(content)) !== null) {
        const resolved = this.resolveRequirePath(entry, uim[2]);
        if (resolved) map.set(resolved, uim[1]);
      }
    }

    return map;
  }

  resolveRequirePath(fromFile, reqPath) {
    const base = path.resolve(path.dirname(fromFile), reqPath);
    const candidates = [base, `${base}.js`, `${base}.ts`, path.join(base, 'index.js'), path.join(base, 'index.ts')];
    for (const c of candidates) {
      try {
        if (fs.existsSync(c) && fs.statSync(c).isFile()) return path.resolve(c);
      } catch { /* ignore */ }
    }
    return null;
  }

  joinRoutePath(prefix, rel) {
    const p = String(prefix || '').replace(/\/+$/, '');
    let r = String(rel || '');
    if (!r.startsWith('/')) r = `/${r}`;
    if (r === '/') return p || '/';
    return `${p}${r}`.replace(/\/{2,}/g, '/');
  }

  /**
   * Decide whether an Express route is auth-gated by inspecting the middleware
   * arguments of the route registration itself (between the path string and the
   * handler) — not a file-wide keyword scan, which mislabels login/logout
   * routes that merely live in an auth-named file.
   *
   * Returns { requiresAuth: boolean, requiredRole: string|null }.
   * requiredRole is extracted from HOF middleware calls like authorize('admin'),
   * requireRole('user'), checkRole("manager"), hasRole('admin').
   */
  detectExpressRouteAuth(content, matchIndex = 0) {
    const text = String(content || '');

    // Find the opening paren of the route call, then walk to its matching close
    // paren using balanced depth — handles nested parens like authorize('admin').
    const openParen = text.indexOf('(', matchIndex);
    if (openParen === -1) return { requiresAuth: false, requiredRole: null };

    let depth = 0;
    let closeParen = -1;
    const scanLimit = Math.min(text.length, openParen + 600);
    for (let i = openParen; i < scanLimit; i++) {
      if (text[i] === '(') depth++;
      else if (text[i] === ')') {
        depth--;
        if (depth === 0) { closeParen = i; break; }
      }
    }
    const call = text.slice(openParen, closeParen > -1 ? closeParen + 1 : openParen + 500);

    // Named auth middleware passed as positional arguments before the handler.
    const AUTH_MW_RE = /\b(authenticate|authorize|requireAuth|requireRole|requiredRole|verifyToken|isAuthenticated|ensureAuth|protect|checkRole|checkAuth|authMiddleware|authGuard|passport|verifyJWT|ensureLoggedIn|jwtMiddleware|bearerAuth|tokenAuth)\b/i;
    const requiresAuth = AUTH_MW_RE.test(call);

    // Role extracted from HOF middleware: authorize('admin'), requireRole('user'),
    // checkRole("manager"), hasRole('admin'), permit('editor'), can('read').
    const ROLE_HOF_RE = /\b(?:authorize|requireRole|checkRole|hasRole|permit|can)\s*\(\s*['"`]([^'"`]+)['"`]/i;
    const roleMatch = call.match(ROLE_HOF_RE);
    const requiredRole = roleMatch ? roleMatch[1] : null;

    return { requiresAuth: requiresAuth || !!requiredRole, requiredRole };
  }

  /**
   * Classify the auth mechanism for an endpoint based on the middleware
   * found in the route call and the surrounding file content.
   *
   * Returns { type, carrier } where:
   *   type: 'none'|'apiKey'|'basic'|'bearerJWT'|'oauth2'|'sessionCookie'|'customHeader'
   *   carrier: { in, name, scheme } | null
   */
  classifyEndpointAuth(content, matchIndex = 0, fileContent = '') {
    const text = String(content || '');
    const file = String(fileContent || '');

    // Extract the balanced route call so we only look at middleware args.
    const openParen = text.indexOf('(', matchIndex);
    if (openParen === -1) return { type: 'none', carrier: null };
    let depth = 0;
    let closeParen = -1;
    const scanLimit = Math.min(text.length, openParen + 600);
    for (let i = openParen; i < scanLimit; i++) {
      if (text[i] === '(') depth++;
      else if (text[i] === ')') { depth--; if (depth === 0) { closeParen = i; break; } }
    }
    const call = text.slice(openParen, closeParen > -1 ? closeParen + 1 : openParen + 500);

    // JWT / Bearer
    const callHasJWT = /\b(jwt|verifyToken|bearerAuth|verifyJWT|jwtMiddleware)\b/i.test(call);
    const fileHasJWT = /\b(jwt|jsonwebtoken|jose)\b/i.test(file);
    const callHasGenericAuth = /\b(authenticate|protect|requireAuth|authMiddleware|authGuard|ensureAuth)\b/i.test(call);
    if (callHasJWT || (fileHasJWT && callHasGenericAuth)) {
      return { type: 'bearerJWT', carrier: { in: 'header', name: 'Authorization', scheme: 'Bearer' } };
    }

    // Session / cookie
    const callHasSession = /\b(session|passport\.session|cookieSession|sessionMiddleware)\b/i.test(call);
    const fileHasSession = /\b(express-session|cookie-session|passport)\b/i.test(file);
    if (callHasSession || (fileHasSession && callHasGenericAuth)) {
      return { type: 'sessionCookie', carrier: { in: 'cookie', name: 'connect.sid' } };
    }

    // API key
    if (/\b(apiKey|api[-_]key)\b/i.test(call) || /x-api-key/i.test(call)) {
      const inQuery = /\b(apikey|api_key)\b.*query/i.test(call);
      return { type: 'apiKey', carrier: inQuery ? { in: 'query', name: 'apikey' } : { in: 'header', name: 'x-api-key' } };
    }

    // Basic auth
    if (/\b(basicAuth|basic-auth|BasicAuth)\b/i.test(call)) {
      return { type: 'basic', carrier: { in: 'header', name: 'Authorization', scheme: 'Basic' } };
    }

    // OAuth / passport
    if (/\b(oauth|passport\.authenticate)\b/i.test(call)) {
      return { type: 'oauth2', carrier: null };
    }

    // Generic auth middleware — infer type from file-level imports
    if (callHasGenericAuth) {
      if (fileHasJWT) return { type: 'bearerJWT', carrier: { in: 'header', name: 'Authorization', scheme: 'Bearer' } };
      if (fileHasSession) return { type: 'sessionCookie', carrier: { in: 'cookie', name: 'connect.sid' } };
      return { type: 'customHeader', carrier: null };
    }

    return { type: 'none', carrier: null };
  }

  /**
   * Scan entry files (app.js / server.js / index.js / main.js) for
   * `app.use(authMiddleware)` without a path prefix — which means every route
   * is covered by that middleware (global enforcement).
   *
   * Returns { enforced: boolean, authType: string, carrier: object|null }.
   */
  detectGlobalAuth(files) {
    const AUTH_NAME_RE = /\b(authenticate|authorize|requireAuth|verifyToken|isAuthenticated|ensureAuth|protect|checkAuth|authMiddleware|authGuard|verifyJWT|bearerAuth|tokenAuth)\b/;
    const entries = (files || []).filter((f) =>
      /(?:app|server|index|main)\.(?:js|ts)$/i.test(path.basename(f)) && !f.includes('node_modules'));

    for (const entry of entries) {
      const content = this.readFileCached(entry);
      if (!content || !content.includes('app.use')) continue;

      // app.use(authFn) — no path prefix.  Must NOT be app.use('/prefix', ...)
      // Simplified: look for `app.use(` where the first arg is NOT a string.
      const globalUseRe = /app\.use\(\s*([A-Za-z0-9_$.]+)\s*[,)]/g;
      let match;
      while ((match = globalUseRe.exec(content)) !== null) {
        const arg = match[1];
        if (AUTH_NAME_RE.test(arg)) {
          const hasJWT = /\b(jwt|jsonwebtoken|jose)\b/i.test(content);
          const hasSession = /\b(express-session|cookie-session|passport)\b/i.test(content);
          const authType = hasJWT ? 'bearerJWT' : hasSession ? 'sessionCookie' : 'customHeader';
          const carrier = hasJWT
            ? { in: 'header', name: 'Authorization', scheme: 'Bearer' }
            : hasSession ? { in: 'cookie', name: 'connect.sid' } : null;
          return { enforced: true, authType, carrier };
        }
      }
    }
    return { enforced: false, authType: 'none', carrier: null };
  }

  /**
   * After all endpoints are built, search for the login/token endpoint and
   * return its path + the response field carrying the token (when token-based).
   * Returns { loginEndpoint: string, tokenField: string|null } or null.
   */
  resolveLoginEndpoint(endpoints) {
    const LOGIN_PATH_RE = /\/(login|signin|auth\/login|auth\/token|token)\b/i;
    const TOKEN_FIELD_RE = /^(token|accessToken|access_token|jwt|id_token|authToken)$/i;

    for (const ep of endpoints || []) {
      if ((ep.method || 'GET').toUpperCase() !== 'POST') continue;
      if (!LOGIN_PATH_RE.test(ep.path || '')) continue;

      const successShapes = (ep.responses?.success || []).filter((r) => r?.bodyShape);
      for (const r of successShapes) {
        const tokenField = Object.keys(r.bodyShape || {}).find((k) => TOKEN_FIELD_RE.test(k));
        if (tokenField) return { loginEndpoint: `POST ${ep.path}`, tokenField };
      }
      // Login endpoint exists but returns no token (e.g. {user} only).
      if (successShapes.length > 0) {
        return { loginEndpoint: `POST ${ep.path}`, tokenField: null };
      }
    }
    return null;
  }

  /**
   * Extract request/response schema for an Express route, following the
   * fallback chain: (1) inline @swagger / OpenAPI JSDoc directly above the
   * route, (2) the resolved controller/handler function body (req.body /
   * req.params / req.query / res.status). Returns {} when nothing is found.
   */
  extractEndpointSchema({ content, matchIndex, method, routeFile }) {
    // Layer 1: inline @swagger JSDoc block immediately above the route (intent).
    const swaggerYaml = this.extractSwaggerBlockAbove(content, matchIndex);
    const fromSpec = swaggerYaml ? this.parseSwaggerBlock(swaggerYaml, method) : null;

    // Layer 2: controller/handler source analysis (implementation/observed).
    const handlerRef = this.extractRouteHandlerRef(content, matchIndex);
    const controller = handlerRef ? this.resolveControllerFn(handlerRef, content, routeFile) : null;
    const fromCode = controller ? this.extractHandlerSchema(controller) : null;

    if (!fromSpec && !fromCode) return {};

    // Merge: interface facts (request body / params) prefer the implementation
    // since the test must conform to it; response contracts are kept from BOTH
    // sources (spec = expected, controller = observed) so the generator can tell
    // intent from evidence. This is the lightweight merge; full spec/code
    // reconciliation + discrepancies lands in the standalone-spec phase.
    const merged = {
      summary: fromSpec?.summary || fromCode?.summary || null,
      requestBody: fromCode?.requestBody || fromSpec?.requestBody || null,
      pathParams: [...new Set([...(fromCode?.pathParams || []), ...(fromSpec?.pathParams || [])])],
      queryParams: [...new Set([...(fromCode?.queryParams || []), ...(fromSpec?.queryParams || [])])],
      responseCodes: [...new Set([...(fromCode?.responseCodes || []), ...(fromSpec?.responseCodes || [])])],
      responses: {
        success: [...(fromSpec?.responses?.success || []), ...(fromCode?.responses?.success || [])],
        failure: [...(fromSpec?.responses?.failure || []), ...(fromCode?.responses?.failure || [])],
      },
      schemaSource: fromSpec && fromCode ? 'swagger+controller' : (fromSpec ? 'swagger' : 'controller'),
    };
    return merged;
  }

  /**
   * Map an extracted schema onto the field names the downstream generator and
   * planner actually read (see openai-generator buildPrioritizedContextPayload).
   * Fixes the historical mismatch where the gatherer emitted only `responseCodes`
   * while the generator read `expectedStatuses`/`responseShape`/`requestSchema`.
   * Response shapes carry their category ('observed' vs 'expected') via the
   * `responses` object so the generator asserts exact bodies only when expected.
   */
  normalizeContractFields(schema = {}) {
    const out = {};
    const codes = Array.isArray(schema.responseCodes) ? schema.responseCodes : [];
    if (codes.length) {
      out.responseCodes = codes;
      out.expectedStatuses = codes;
    }
    if (schema.responses && (schema.responses.success?.length || schema.responses.failure?.length)) {
      out.responses = schema.responses;
      const primarySuccess = (schema.responses.success || []).find((r) => r && r.bodyShape);
      if (primarySuccess) {
        out.responseShape = primarySuccess.bodyShape;
        out.responseSchema = primarySuccess.bodyShape;
      }
    }
    if (schema.requestBody && Array.isArray(schema.requestBody.fields)) {
      out.requestSchema = {
        fields: schema.requestBody.fields,
        required: Array.isArray(schema.requestBody.required) ? schema.requestBody.required : [],
      };
    }
    return out;
  }

  /** Find the nearest preceding JSDoc block containing @swagger / @openapi. */
  extractSwaggerBlockAbove(content, matchIndex) {
    const before = String(content || '').slice(0, matchIndex);
    const lastClose = before.lastIndexOf('*/');
    if (lastClose === -1) return null;
    // Only accept the comment if it sits directly above the route (no other
    // code statements between the comment and the route registration).
    const between = before.slice(lastClose + 2).trim();
    if (between && !/^[)\];,]*$/.test(between)) return null;
    const open = before.lastIndexOf('/**', lastClose);
    if (open === -1) return null;
    const block = before.slice(open, lastClose);
    if (!/@swagger|@openapi/i.test(block)) return null;
    // Strip the JSDoc framing (` * `) to recover raw YAML, dropping the
    // `@swagger` marker line itself.
    return block
      .replace(/^\/\*\*?/, '')
      .split('\n')
      .map((line) => line.replace(/^\s*\*\s?/, ''))
      .filter((line) => !/^\s*@(swagger|openapi)\s*$/i.test(line))
      .join('\n');
  }

  /** Parse a swagger YAML block into a normalized schema for the given method. */
  parseSwaggerBlock(yamlText, method) {
    if (!yaml) return null;
    let doc;
    try { doc = yaml.load(yamlText); } catch { return null; }
    if (!doc || typeof doc !== 'object') return null;

    for (const pathKey of Object.keys(doc)) {
      const methods = doc[pathKey];
      if (!methods || typeof methods !== 'object') continue;
      const entry = methods[String(method).toLowerCase()];
      if (!entry || typeof entry !== 'object') continue;

      const result = { summary: entry.summary || null };

      const schema = entry.requestBody?.content?.['application/json']?.schema;
      if (schema?.properties) {
        result.requestBody = {
          fields: Object.keys(schema.properties),
          required: Array.isArray(schema.required) ? schema.required : [],
        };
      }

      const params = Array.isArray(entry.parameters) ? entry.parameters : [];
      result.pathParams = params.filter((p) => p?.in === 'path').map((p) => p.name).filter(Boolean);
      result.queryParams = params.filter((p) => p?.in === 'query').map((p) => p.name).filter(Boolean);

      result.responseCodes = entry.responses
        ? Object.keys(entry.responses).map((c) => parseInt(c, 10)).filter(Number.isFinite)
        : [];

      // Spec-declared response bodies are EXPECTED behavior (intent), distinct
      // from controller-observed shapes. Inline-only: $ref components living in a
      // separate JSDoc block are resolved later by the standalone spec parser.
      const success = [];
      const failure = [];
      for (const [code, resp] of Object.entries(entry.responses || {})) {
        const status = parseInt(code, 10);
        if (!Number.isFinite(status)) continue;
        const respSchema = resp?.content?.['application/json']?.schema;
        const bodyShape = respSchema?.properties
          ? Object.fromEntries(Object.keys(respSchema.properties).map((k) => [k, respSchema.properties[k]?.type || 'unknown']))
          : null;
        const entryObj = {
          status,
          bodyShape,
          errorMessage: status >= 400 ? (resp?.description || null) : null,
          category: 'expected',
          provenance: 'swagger',
        };
        (status >= 400 ? failure : success).push(entryObj);
      }
      result.responses = { success, failure };

      return result;
    }
    return null;
  }

  /** Pull the last identifier argument (the handler) from a route registration. */
  extractRouteHandlerRef(content, matchIndex) {
    const window = String(content || '').slice(matchIndex, matchIndex + 400);
    const open = window.indexOf('(');
    const close = window.indexOf(')', open);
    if (open < 0 || close < 0) return null;
    const args = window.slice(open + 1, close).replace(/^\s*["'`][^"'`]*["'`]\s*,?/, '');
    const ids = args.match(/[A-Za-z_$][A-Za-z0-9_$.]*/g) || [];
    return ids.length ? ids[ids.length - 1] : null;
  }

  /** Resolve `ctrl.fn` to the controller file + function name and its source. */
  resolveControllerFn(handlerRef, routeFileContent, routeFile) {
    if (!handlerRef) return null;
    const dot = handlerRef.indexOf('.');
    const obj = dot > -1 ? handlerRef.slice(0, dot) : handlerRef;
    const fnName = dot > -1 ? handlerRef.slice(dot + 1) : handlerRef;

    let controllerFile = routeFile;
    if (dot > -1) {
      // `const ctrl = require('./controller')` then `ctrl.fn`
      const reqRe = new RegExp(`(?:const|let|var)\\s+${obj.replace(/\$/g, '\\$')}\\s*=\\s*require\\(\\s*["'\`](\\.[^"'\`]+)["'\`]`, 'm');
      const m = routeFileContent.match(reqRe);
      if (m) {
        const resolved = this.resolveRequirePath(routeFile, m[1]);
        if (resolved) controllerFile = resolved;
      }
    } else {
      // Destructured import: `const { login, logout } = require('./authController')`
      const destrRe = new RegExp(`(?:const|let|var)\\s*\\{[^}]*\\b${fnName.replace(/\$/g, '\\$')}\\b[^}]*\\}\\s*=\\s*require\\(\\s*["'\`](\\.[^"'\`]+)["'\`]`, 'm');
      const m = routeFileContent.match(destrRe);
      if (m) {
        const resolved = this.resolveRequirePath(routeFile, m[1]);
        if (resolved) controllerFile = resolved;
      }
    }
    const content = this.readFileCached(controllerFile);
    if (!content) return null;
    return { fnName, content };
  }

  /** Infer schema from a controller function body (req.body/params/query, res.status). */
  extractHandlerSchema({ fnName, content }) {
    const text = String(content || '');
    // Locate the function definition; bound the body to the next sibling export.
    const defRe = new RegExp(`(?:exports\\.${fnName}|(?:async\\s+)?function\\s+${fnName}|${fnName}\\s*[:=])`, 'm');
    const start = text.search(defRe);
    if (start === -1) return null;
    // Bound the body to THIS function's own braces (handles both
    // `function fn(req,res){...}` and `const fn = async (req,res) => {...}`),
    // so sibling handlers in the same controller file don't bleed in.
    let sigEnd = text.indexOf(')', start);
    if (sigEnd === -1) sigEnd = text.indexOf('=>', start);
    const bodyOpen = sigEnd > -1 ? text.indexOf('{', sigEnd) : text.indexOf('{', start);
    const body = (bodyOpen > -1 ? this.sliceBalanced(text, bodyOpen) : null) || text.slice(start, start + 1500);

    const rawBodyFields = new Set();
    const destructure = body.match(/(?:const|let|var)\s*\{([^}]+)\}\s*=\s*req\.body/);
    if (destructure) {
      destructure[1].split(',').forEach((s) => {
        const name = s.trim().split(':')[0].replace(/\.\.\./, '').trim();
        if (name) rawBodyFields.add(name);
      });
    }
    for (const m of body.matchAll(/req\.body\.([A-Za-z0-9_$]+)/g)) rawBodyFields.add(m[1]);

    const pathParams = [...new Set([...body.matchAll(/req\.params\.([A-Za-z0-9_$]+)/g)].map((m) => m[1]))];
    const queryParams = [...new Set([...body.matchAll(/req\.query\.([A-Za-z0-9_$]+)/g)].map((m) => m[1]))];

    // Enrich body fields with inferred types, formats, and inline enums.
    const enrichedFields = this._enrichParamTypes([...rawBodyFields], body, text);

    // Detect request content type (json vs multipart vs urlencoded).
    const contentType = this._detectContentType(text);

    // Response contract: success/failure body shapes + literal error messages,
    // captured from res.json()/res.status(n).json()/res.send(). Everything here
    // is OBSERVED behavior (what the code returns), NOT an assertion target.
    const responses = this.extractResponseContract(body);
    const responseCodes = [...new Set([
      ...[...body.matchAll(/res\s*\.\s*status\(\s*(\d{3})\s*\)/g)].map((m) => parseInt(m[1], 10)),
      ...responses.success.map((r) => r.status),
      ...responses.failure.map((r) => r.status),
    ])];

    return {
      summary: null,
      requestBody: enrichedFields.length
        ? { contentType, fields: enrichedFields, required: [] }
        : null,
      pathParams,
      queryParams,
      responseCodes,
      responses,
    };
  }

  /**
   * Infer types, formats, and enum values for body/param field names from
   * how they are used in the controller body and from their name conventions.
   *
   * Returns [{ name, type, format?, enum? }].
   */
  _enrichParamTypes(fieldNames, body, fileText = '') {
    const text = String(body || '');
    const file = String(fileText || '');
    return fieldNames.map((name) => {
      const descriptor = { name, type: 'string' };

      // Integer/number from parseInt/Number coercion
      if (new RegExp(`(?:parseInt|Number)\\s*\\(\\s*(?:req\\.body\\.)?${name}\\b`).test(text)) {
        descriptor.type = 'number';
      } else if (new RegExp(`parseFloat\\s*\\(\\s*(?:req\\.body\\.)?${name}\\b`).test(text)) {
        descriptor.type = 'number';
      } else if (new RegExp(`(?:req\\.body\\.)?${name}\\s*===?\\s*['"]true['"]`).test(text) ||
                 new RegExp(`Boolean\\s*\\(\\s*(?:req\\.body\\.)?${name}\\b`).test(text)) {
        descriptor.type = 'boolean';
      } else if (/(?:price|amount|count|quantity|age|score|rating|total|limit|offset|page|size)/i.test(name)) {
        descriptor.type = 'number';
      }

      // Format hints from field name conventions
      if (/email/i.test(name)) descriptor.format = 'email';
      else if (/password|pass/i.test(name)) descriptor.format = 'password';
      else if (/(?:date|_at|At|createdAt|updatedAt)$/i.test(name)) descriptor.format = 'date-time';
      else if (/^url$|Url$/i.test(name)) descriptor.format = 'uri';

      // Inline enum: z.enum([...]) or { enum: [...] } near the field name in the file
      const enumVals = this._extractInlineEnum(name, file);
      if (enumVals) descriptor.enum = enumVals;

      return descriptor;
    });
  }

  /**
   * Extract enum values for a given field name from Zod, Mongoose, or Joi
   * patterns found in the surrounding file text.
   * Returns string[] or null.
   */
  _extractInlineEnum(fieldName, fileText) {
    const text = String(fileText || '');
    // Zod: fieldName: z.enum(['a','b','c'])
    const zodRe = new RegExp(`\\b${fieldName}\\s*:\\s*z\\.enum\\s*\\(\\s*(\\[[^\\]]+\\])`, 'm');
    const zodMatch = text.match(zodRe);
    if (zodMatch) return this._parseStringArray(zodMatch[1]);

    // Mongoose: fieldName: { ..., enum: ['a','b','c'] }
    const mongoRe = new RegExp(`\\b${fieldName}\\s*:\\s*\\{[^}]*enum\\s*:\\s*(\\[[^\\]]+\\])`, 'm');
    const mongoMatch = text.match(mongoRe);
    if (mongoMatch) return this._parseStringArray(mongoMatch[1]);

    // Joi: fieldName: Joi.string().valid('a','b','c') or .allow(...)
    const joiRe = new RegExp(`\\b${fieldName}\\s*:\\s*Joi\\.\\w+\\(\\)[^;\\n]*\\.(?:valid|allow)\\(([^)]+)\\)`, 'm');
    const joiMatch = text.match(joiRe);
    if (joiMatch) {
      const vals = [...joiMatch[1].matchAll(/['"`]([^'"`]+)['"`]/g)].map((m) => m[1]);
      return vals.length ? vals : null;
    }

    return null;
  }

  /**
   * Parse a JS array literal string like `['admin','user']` into string[].
   */
  _parseStringArray(arrayStr) {
    const matches = [...String(arrayStr || '').matchAll(/['"`]([^'"`]+)['"`]/g)];
    const vals = matches.map((m) => m[1]);
    return vals.length ? vals : null;
  }

  /**
   * Detect the request content type used by a route/controller by scanning
   * for multer/busboy (multipart), urlencoded middleware, or SSE signals.
   * Returns the MIME type string; defaults to 'application/json'.
   */
  _detectContentType(text) {
    if (/\b(?:multer|upload\.(?:single|array|fields|any)|busboy|formidable|multipart)\b/i.test(text)) {
      return 'multipart/form-data';
    }
    if (/\b(?:urlencoded|application\/x-www-form-urlencoded)\b/i.test(text)) {
      return 'application/x-www-form-urlencoded';
    }
    return 'application/json';
  }

  /**
   * Scan a handler body for response calls and extract, per status, the
   * top-level response body shape and any literal error message. Returns
   * { success: [...], failure: [...] }, each entry labeled category:'observed'
   * with provenance:'controller'. Matches res.json(...), res.status(n).json(...),
   * res.send(...), with or without a leading `return`.
   */
  extractResponseContract(body) {
    const success = [];
    const failure = [];
    const text = String(body || '');
    const re = /res\s*\.\s*(?:status\(\s*(\d{3})\s*\)\s*\.\s*)?(?:json|send)\s*\(/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      const status = m[1] ? parseInt(m[1], 10) : 200;
      const rest = text.slice(re.lastIndex);
      const lead = rest.match(/^\s*/)[0].length;
      let bodyShape = null;
      let errorMessage = null;
      if (rest[lead] === '{') {
        const objText = this.sliceBalanced(rest, lead);
        if (objText) {
          const parsed = this.parseTopLevelKeys(objText);
          bodyShape = Object.keys(parsed.shape).length ? parsed.shape : null;
          errorMessage = parsed.message;
        }
      }
      const entry = { status, bodyShape, errorMessage, category: 'observed', provenance: 'controller' };
      (status >= 400 ? failure : success).push(entry);
    }
    return { success, failure };
  }

  /**
   * Return the balanced substring starting at the bracket char at `startIdx`
   * within `str` (handles {}, [], (), nested, and string literals). Null if
   * unbalanced within a bounded window.
   */
  sliceBalanced(str, startIdx) {
    let depth = 0;
    let inStr = null;
    const limit = Math.min(str.length, startIdx + 4000);
    for (let i = startIdx; i < limit; i++) {
      const c = str[i];
      if (inStr) {
        if (c === '\\') { i++; continue; }
        if (c === inStr) inStr = null;
        continue;
      }
      if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
      if (c === '{' || c === '[' || c === '(') depth++;
      else if (c === '}' || c === ']' || c === ')') {
        depth--;
        if (depth === 0) return str.slice(startIdx, i + 1);
      }
    }
    return null;
  }

  /**
   * Extract top-level keys (with a coarse value type) from a JS object literal
   * string `{...}`. Also returns the literal string value of a `message`/`error`
   * key when present. Handles quoted keys, shorthand props, and nesting.
   */
  parseTopLevelKeys(objText) {
    const shape = {};
    let message = null;
    const inner = String(objText || '').slice(1, -1);
    let depth = 0;
    let inStr = null;
    let expectKey = true;
    let i = 0;
    while (i < inner.length) {
      const c = inner[i];
      if (inStr) {
        if (c === '\\') { i += 2; continue; }
        if (c === inStr) inStr = null;
        i++;
        continue;
      }
      if (c === '"' || c === "'" || c === '`') { inStr = c; i++; continue; }
      if (c === '{' || c === '[' || c === '(') { depth++; i++; continue; }
      if (c === '}' || c === ']' || c === ')') { depth--; i++; continue; }
      if (depth === 0 && c === ',') { expectKey = true; i++; continue; }
      if (depth === 0 && expectKey && /\S/.test(c)) {
        const slice = inner.slice(i);
        const km = slice.match(/^\s*(?:['"`]([^'"`]+)['"`]|([A-Za-z0-9_$]+))\s*:/);
        if (km) {
          const key = km[1] || km[2];
          const afterColon = i + km[0].length;
          const vLead = inner.slice(afterColon).match(/^\s*/)[0].length;
          const vStart = afterColon + vLead;
          const vChar = inner[vStart];
          shape[key] = this.inferValueType(vChar, inner.slice(vStart));
          if ((key === 'message' || key === 'error') && (vChar === '"' || vChar === "'" || vChar === '`')) {
            const sm = inner.slice(vStart).match(/^['"`]([^'"`]*)['"`]/);
            if (sm) message = sm[1];
          }
          i = afterColon;
          expectKey = false;
          continue;
        }
        const sk = slice.match(/^\s*(?:\.\.\.)?([A-Za-z0-9_$]+)\s*(?=[,}]|$)/);
        if (sk) {
          shape[sk[1]] = 'unknown';
          i += sk[0].length;
          expectKey = false;
          continue;
        }
      }
      i++;
    }
    return { shape, message };
  }

  /** Coarse value-type inference for a response field's value. */
  inferValueType(ch, rest) {
    if (ch === '"' || ch === "'" || ch === '`') return 'string';
    if (ch === '[') return 'array';
    if (ch === '{') return 'object';
    if (ch !== undefined && /[0-9-]/.test(ch)) return 'number';
    if (/^(?:true|false)\b/.test(String(rest || ''))) return 'boolean';
    return 'unknown';
  }

  /**
   * Discover API calls made from client code (fetch / axios). Used as the third
   * fallback in the endpoint chain: when a project has no server-side routes or
   * controllers in-repo (e.g. a frontend talking to an external API), the calls
   * the UI actually makes are the authoritative endpoint list.
   *
   * Template-literal base URLs (`${process.env.API_URL}/api/x`) are stripped to
   * the path, and interpolated segments (`${id}`) become `:param`.
   */
  async findClientApiCalls(projectPath) {
    const endpoints = [];
    const seen = new Set();
    const urlLiteral = '(`[^`]+`|"[^"]+"|\'[^\']+\')';
    const fetchRe = new RegExp(`fetch\\s*\\(\\s*${urlLiteral}`, 'g');
    const axiosMethodRe = new RegExp(`axios\\s*\\.\\s*(get|post|put|patch|delete)\\s*\\(\\s*${urlLiteral}`, 'gi');
    const axiosConfigRe = new RegExp(`axios\\s*\\(\\s*\\{[^}]*?url\\s*:\\s*${urlLiteral}`, 'gi');

    const files = this.findFiles(projectPath, ['.js', '.jsx', '.ts', '.tsx']);

    for (const file of files.slice(0, this.config.maxFiles)) {
      if (file.includes('node_modules') || file.includes('.spec.') || file.includes('.test.')) continue;
      try {
        const content = this.readFileCached(file);
        if (!content) continue;
        const rel = path.relative(this.config.projectPath, file);

        const add = (method, rawUrl, atIndex) => {
          const apiPath = this.normalizeClientUrl(rawUrl);
          if (!apiPath) return;
          const key = `${method} ${apiPath}`;
          if (seen.has(key)) return;
          seen.add(key);
          endpoints.push({ method, path: apiPath, description: `${method} ${apiPath}`, requiresAuth: false, source: rel, schemaSource: 'client_call' });
        };

        for (const m of content.matchAll(fetchRe)) {
          // fetch defaults to GET unless its own options object specifies a
          // method. The search is bounded to this call's options object so it
          // never picks up the method of a later, unrelated fetch call.
          add(this.extractFetchMethod(content, m.index + m[0].length), m[1], m.index);
        }
        for (const m of content.matchAll(axiosMethodRe)) add(m[1].toUpperCase(), m[2], m.index);
        for (const m of content.matchAll(axiosConfigRe)) {
          // axios({ url, method }) — method lives in the same object literal;
          // bound the search to that object (up to its first closing brace).
          const after = content.slice(m.index, m.index + 400);
          const objEnd = after.indexOf('}');
          const scope = objEnd > -1 ? after.slice(0, objEnd) : after;
          const methodMatch = scope.match(/method\s*:\s*["'`](GET|POST|PUT|PATCH|DELETE)["'`]/i);
          add((methodMatch ? methodMatch[1] : 'GET').toUpperCase(), m[1], m.index);
        }
      } catch { /* ignore */ }
    }

    return endpoints;
  }

  /** Reduce a client-side fetch/axios URL literal to a comparable API path. */
  normalizeClientUrl(raw) {
    let s = String(raw || '').replace(/^[`'"]|[`'"]$/g, '');
    s = s.replace(/^https?:\/\/[^/]+/, '');   // strip absolute host
    s = s.replace(/^\$\{[^}]+\}/, '');         // strip leading ${BASE_URL}
    s = s.replace(/\$\{[^}]+\}/g, ':param');   // remaining interpolations → :param
    s = s.split('?')[0].split('#')[0];          // drop query/hash
    if (!s.startsWith('/')) return null;
    if (s.length > 1) s = s.replace(/\/+$/, '');
    return s;
  }

  /**
   * Determine a fetch() call's HTTP method. Returns GET when the call has no
   * options object; otherwise reads `method` from the options object that
   * immediately follows the URL — scanned with balanced braces so the search
   * cannot leak into a subsequent fetch call.
   */
  extractFetchMethod(content, afterUrlIndex) {
    const rest = String(content || '').slice(afterUrlIndex);
    const lead = (rest.match(/^\s*/) || [''])[0].length;
    if (rest[lead] !== ',') return 'GET'; // fetch(url) → GET
    const braceStart = rest.indexOf('{', lead);
    if (braceStart === -1) return 'GET';
    let depth = 0;
    let end = -1;
    for (let i = braceStart; i < rest.length && i < braceStart + 800; i++) {
      const ch = rest[i];
      if (ch === '{') depth++;
      else if (ch === '}') { depth--; if (depth === 0) { end = i; break; } }
    }
    const opts = end > -1 ? rest.slice(braceStart, end + 1) : rest.slice(braceStart, braceStart + 300);
    const mm = opts.match(/method\s*:\s*["'`](GET|POST|PUT|PATCH|DELETE)["'`]/i);
    return mm ? mm[1].toUpperCase() : 'GET';
  }

  /**
   * Find routes/pages in non-JS projects (Python, Java, Go, Ruby, PHP)
   */
  async findMultiLangRoutes(projectPath) {
    const pages = [];
    const lang = this.config.language;
    if (lang === 'javascript') return pages; // Already handled

    const extensions = this.getSourceExtensions();
    const srcDir = path.join(projectPath, 'src');
    const searchDir = fs.existsSync(srcDir) ? srcDir : projectPath;
    const files = this.findFiles(searchDir, extensions);

    const routePatterns = {
      python: [
        // Flask: @app.route('/path')
        /@(?:app|blueprint|bp)\s*\.\s*route\s*\(\s*["']([^"']+)["']/g,
        // FastAPI: @app.get('/path')
        /@(?:app|router)\s*\.\s*(?:get|post|put|delete|patch)\s*\(\s*["']([^"']+)["']/g,
        // Django: path('url/', view)
        /path\s*\(\s*["']([^"']+)["']/g,
      ],
      java: [
        // Spring: @RequestMapping("/path"), @GetMapping("/path")
        /@(?:Request|Get|Post|Put|Delete|Patch)Mapping\s*\(\s*(?:value\s*=\s*)?["']([^"']+)["']/g,
      ],
      go: [
        // http.HandleFunc("/path", handler)
        /(?:HandleFunc|Handle)\s*\(\s*["']([^"']+)["']/g,
        // Gin: r.GET("/path", handler)
        /\.\s*(?:GET|POST|PUT|DELETE|PATCH)\s*\(\s*["']([^"']+)["']/g,
      ],
      ruby: [
        // Rails: get '/path', to: 'controller#action'
        /(?:get|post|put|patch|delete|root)\s+["']([^"']+)["']/g,
        // resources :users
        /resources?\s+:(\w+)/g,
      ],
      php: [
        // Laravel: Route::get('/path', ...)
        /Route::(?:get|post|put|patch|delete)\s*\(\s*["']([^"']+)["']/g,
      ],
    };

    const patterns = routePatterns[lang] || [];
    if (patterns.length === 0) return pages;

    for (const file of files.slice(0, this.config.maxFiles)) {
      if (file.includes('node_modules') || file.includes('test') || file.includes('spec')) continue;
      try {
        const content = this.readFileCached(file);
        if (!content) continue;
        for (const pattern of patterns) {
          let match;
          // Reset lastIndex for reuse
          pattern.lastIndex = 0;
          while ((match = pattern.exec(content)) !== null) {
            const routePath = match[1].startsWith('/') ? match[1] : `/${match[1]}`;
            if (!pages.some(p => p.path === routePath)) {
              pages.push({
                path: routePath,
                description: this.formatPageName(routePath),
                components: [],
                interactions: ['navigation'],
                source: path.relative(projectPath, file),
              });
            }
          }
        }
      } catch (e) { /* ignore */ }
    }

    return pages;
  }

  /**
   * Find API endpoints in non-JS projects (Python, Java, Go, Ruby, PHP)
   */
  async findMultiLangEndpoints(projectPath) {
    const endpoints = [];
    const srcDir = path.join(projectPath, 'src');
    const searchDir = fs.existsSync(srcDir) ? srcDir : projectPath;

    const endpointPatterns = {
      python: [
        // Flask/FastAPI with method
        { regex: /@(?:app|router|bp)\s*\.\s*(get|post|put|delete|patch)\s*\(\s*["']([^"']+)["']/gi, methodIdx: 1, pathIdx: 2 },
        // Flask @app.route with methods=['GET', 'POST']
        { regex: /@(?:app|bp)\s*\.route\s*\(\s*["']([^"']+)["'][^)]*methods\s*=\s*\[([^\]]+)\]/gi, methodIdx: 2, pathIdx: 1, parseMethodList: true },
      ],
      java: [
        { regex: /@GetMapping\s*\(\s*(?:value\s*=\s*)?["']([^"']+)["']/gi, method: 'GET', pathIdx: 1 },
        { regex: /@PostMapping\s*\(\s*(?:value\s*=\s*)?["']([^"']+)["']/gi, method: 'POST', pathIdx: 1 },
        { regex: /@PutMapping\s*\(\s*(?:value\s*=\s*)?["']([^"']+)["']/gi, method: 'PUT', pathIdx: 1 },
        { regex: /@DeleteMapping\s*\(\s*(?:value\s*=\s*)?["']([^"']+)["']/gi, method: 'DELETE', pathIdx: 1 },
        { regex: /@PatchMapping\s*\(\s*(?:value\s*=\s*)?["']([^"']+)["']/gi, method: 'PATCH', pathIdx: 1 },
      ],
      go: [
        { regex: /\.\s*(GET|POST|PUT|DELETE|PATCH)\s*\(\s*["']([^"']+)["']/gi, methodIdx: 1, pathIdx: 2 },
        { regex: /HandleFunc\s*\(\s*["']([^"']+)["']/gi, method: 'GET', pathIdx: 1 },
      ],
      ruby: [
        { regex: /(get|post|put|patch|delete)\s+["']([^"']+)["']/gi, methodIdx: 1, pathIdx: 2 },
      ],
      php: [
        { regex: /Route::(get|post|put|patch|delete)\s*\(\s*["']([^"']+)["']/gi, methodIdx: 1, pathIdx: 2 },
      ],
      csharp: [
        { regex: /\[HttpGet(?:\(\s*["']([^"']*)["']\s*\))?\][\s\S]{0,600}?\[Route\s*\(\s*["']([^"']+)["']\s*\)\]/gi, method: 'GET', pathIdx: 2, optionalPathIdx: 1 },
        { regex: /\[Route\s*\(\s*["']([^"']+)["']\s*\)\][\s\S]{0,600}?\[HttpGet(?:\(\s*["']([^"']*)["']\s*\))?\]/gi, method: 'GET', pathIdx: 1, optionalPathIdx: 2 },
        { regex: /\[HttpPost(?:\(\s*["']([^"']*)["']\s*\))?\][\s\S]{0,600}?\[Route\s*\(\s*["']([^"']+)["']\s*\)\]/gi, method: 'POST', pathIdx: 2, optionalPathIdx: 1 },
        { regex: /\[Route\s*\(\s*["']([^"']+)["']\s*\)\][\s\S]{0,600}?\[HttpPost(?:\(\s*["']([^"']*)["']\s*\))?\]/gi, method: 'POST', pathIdx: 1, optionalPathIdx: 2 },
        { regex: /app\.Map(Get|Post|Put|Delete|Patch)\s*\(\s*["']([^"']+)["']/gi, methodIdx: 1, pathIdx: 2 },
      ],
    };

    const configuredLanguage = this.config.language || 'javascript';
    const languages = configuredLanguage === 'javascript'
      ? ['python', 'java', 'go', 'ruby', 'php', 'csharp']
      : [configuredLanguage];

    const joinRoutePaths = (base, child) => {
      const left = String(base || '').trim();
      const right = String(child || '').trim();
      const joined = `${left ? `/${left.replace(/^\/+|\/+$/g, '')}` : ''}${right ? `/${right.replace(/^\/+/, '')}` : ''}`;
      return joined.replace(/\/+/g, '/') || '/';
    };

    for (const lang of languages) {
      const patterns = endpointPatterns[lang] || [];
      if (patterns.length === 0) continue;

      const extensions = this.getSourceExtensions(lang);
      const files = this.findFiles(searchDir, extensions);

      for (const file of files.slice(0, this.config.maxFiles)) {
        if (file.includes('node_modules') || file.includes('test') || file.includes('spec') || file.includes('migration')) continue;
        try {
          const content = this.readFileCached(file);
          if (!content) continue;
          const hasAuth = content.includes('auth') || content.includes('token') || content.includes('permission');

          if (lang === 'java') {
            const baseMatch = content.match(/@RequestMapping\s*\(\s*(?:value\s*=\s*)?["']([^"']+)["']/i);
            const classBasePath = baseMatch?.[1] || '';
            const springMethodPattern = /@(Get|Post|Put|Delete|Patch)Mapping(?:\s*\(\s*(?:value\s*=\s*)?["']([^"']*)["'][^)]*\))?/gi;
            for (const match of content.matchAll(springMethodPattern)) {
              const method = match[1].toUpperCase();
              const localPath = match[2] || '';
              const fullPath = joinRoutePaths(classBasePath, localPath);
              if (!endpoints.some(e => e.method === method && e.path === fullPath)) {
                endpoints.push({
                  method,
                  path: fullPath,
                  description: `${method} ${fullPath}`,
                  requiresAuth: hasAuth,
                  source: path.relative(projectPath, file),
                  sourceRoutePath: localPath,
                  sourceRouteBase: classBasePath,
                });
              }
            }
            continue;
          }

          for (const patternDef of patterns) {
            let match;
            patternDef.regex.lastIndex = 0;
            while ((match = patternDef.regex.exec(content)) !== null) {
              let method = patternDef.method || match[patternDef.methodIdx].toUpperCase();
              const basePath = match[patternDef.pathIdx];
              const optionalPath = patternDef.optionalPathIdx ? match[patternDef.optionalPathIdx] : '';
              const routePath = optionalPath
                ? `${String(basePath || '').replace(/\/$/, '')}/${String(optionalPath).replace(/^\//, '')}`
                : basePath;

              if (patternDef.parseMethodList) {
                // Parse methods=['GET', 'POST'] style
                const methods = routePath; // In this pattern pathIdx=1, methodIdx=2
                const methodList = match[patternDef.methodIdx].replace(/["'\s]/g, '').split(',');
                for (const m of methodList) {
                  if (!endpoints.some(e => e.method === m.toUpperCase() && e.path === match[patternDef.pathIdx])) {
                    endpoints.push({
                      method: m.toUpperCase(),
                      path: match[patternDef.pathIdx],
                      description: `${m.toUpperCase()} ${match[patternDef.pathIdx]}`,
                      requiresAuth: hasAuth,
                      source: path.relative(projectPath, file),
                    });
                  }
                }
                continue;
              }

              const fullPath = routePath.startsWith('/') ? routePath : `/${routePath}`;
              if (!endpoints.some(e => e.method === method && e.path === fullPath)) {
                endpoints.push({
                  method,
                  path: fullPath,
                  description: `${method} ${fullPath}`,
                  requiresAuth: hasAuth,
                  source: path.relative(projectPath, file),
                });
              }
            }
          }
        } catch (e) { /* ignore */ }
      }
    }

    return endpoints;
  }

  /**
   * Infer common workflows from pages, endpoints, and forms
   */
  inferWorkflows(pages, endpoints, forms = []) {
    const workflows = [];
    
    // Auth workflow
    const hasLogin = pages.some(p => p.path.includes('login') || p.path.includes('signin'));
    const hasRegister = pages.some(p => p.path.includes('register') || p.path.includes('signup'));
    const hasAuthEndpoint = endpoints.some(e => e.path.includes('auth') || e.path.includes('login'));
    
    if (hasLogin || hasAuthEndpoint) {
      workflows.push({
        name: 'User Authentication',
        description: 'Complete login flow with validation',
        steps: [
          'Navigate to login page',
          'Verify login form is visible',
          'Enter valid credentials',
          'Submit form',
          'Verify successful login and redirect',
          'Test invalid credentials error handling',
        ],
        relatedPages: pages.filter(p => p.path.includes('login') || p.path.includes('signin')),
        relatedEndpoints: endpoints.filter(e => e.path.includes('auth') || e.path.includes('login')),
      });
    }
    
    if (hasRegister) {
      workflows.push({
        name: 'User Registration',
        description: 'Complete signup flow with validation',
        steps: [
          'Navigate to registration page',
          'Verify all form fields are visible',
          'Test form validation (empty fields, invalid email)',
          'Fill in valid user details',
          'Submit form',
          'Verify account created and proper redirect',
        ],
        relatedPages: pages.filter(p => p.path.includes('register') || p.path.includes('signup')),
      });
    }
    
    // Dashboard workflow
    const hasDashboard = pages.some(p => 
      p.path.includes('dashboard') || p.path.includes('home') || p.path === '/'
    );
    
    if (hasDashboard) {
      workflows.push({
        name: 'Dashboard Navigation',
        description: 'Verify dashboard loads and displays data',
        steps: [
          'Navigate to dashboard',
          'Verify dashboard loads without errors',
          'Check main components are visible',
          'Test any interactive elements',
          'Verify data displays correctly',
        ],
        relatedPages: pages.filter(p => p.path.includes('dashboard') || p.path === '/'),
      });
    }
    
    // Profile/Settings workflow
    const hasProfile = pages.some(p => 
      p.path.includes('profile') || p.path.includes('settings') || p.path.includes('account')
    );
    
    if (hasProfile) {
      workflows.push({
        name: 'User Profile Management',
        description: 'View and update user profile',
        steps: [
          'Navigate to profile/settings page',
          'Verify current user data displays',
          'Update profile information',
          'Submit changes',
          'Verify changes are saved',
        ],
        relatedPages: pages.filter(p => 
          p.path.includes('profile') || p.path.includes('settings') || p.path.includes('account')
        ),
      });
    }
    
    // CRUD workflows based on API endpoints
    const crudResources = new Set();
    for (const endpoint of endpoints) {
      const resourceMatch = endpoint.path.match(/\/api\/(\w+)/);
      if (resourceMatch && !['auth', 'login', 'logout', 'health'].includes(resourceMatch[1])) {
        crudResources.add(resourceMatch[1]);
      }
    }
    
    for (const resource of Array.from(crudResources).slice(0, 3)) {
      const resourceEndpoints = endpoints.filter(e => e.path.includes(`/api/${resource}`));
      const hasGet = resourceEndpoints.some(e => e.method === 'GET');
      const hasPost = resourceEndpoints.some(e => e.method === 'POST');
      const hasPut = resourceEndpoints.some(e => e.method === 'PUT');
      const hasDelete = resourceEndpoints.some(e => e.method === 'DELETE');
      
      if (hasGet || hasPost) {
        const steps = [];
        if (hasGet) steps.push(`List all ${resource}`);
        if (hasPost) steps.push(`Create new ${resource}`);
        if (hasGet) steps.push(`View ${resource} details`);
        if (hasPut) steps.push(`Update ${resource}`);
        if (hasDelete) steps.push(`Delete ${resource}`);
        steps.push('Verify all operations complete successfully');
        
        workflows.push({
          name: `${resource.charAt(0).toUpperCase() + resource.slice(1)} Management`,
          description: `CRUD operations for ${resource}`,
          steps,
          relatedEndpoints: resourceEndpoints,
        });
      }
    }
    
    // Form-based workflows
    const significantForms = forms.filter(f => f.fields.length >= 3);
    if (significantForms.length > 0 && workflows.length < 5) {
      for (const form of significantForms.slice(0, 2)) {
        workflows.push({
          name: `Form Submission: ${path.basename(form.file, path.extname(form.file))}`,
          description: 'Test form with validation',
          steps: [
            'Navigate to page with form',
            'Test required field validation',
            'Test input format validation',
            'Fill form with valid data',
            'Submit and verify success',
          ],
          formFields: form.fields,
          validationPatterns: form.validationPatterns,
        });
      }
    }
    
    // If no specific workflows, add basic
    if (workflows.length === 0) {
      workflows.push({
        name: 'Basic Navigation',
        description: 'Verify app loads and basic navigation works',
        steps: [
          'Load home page',
          'Verify page renders without errors',
          'Check for console errors',
          'Test navigation to different sections',
          'Verify responsive design',
        ],
      });
    }
    
    return workflows;
  }

  /**
   * Helper: Check if file is a page file
   */
  isPageFile(filename) {
    return /\.(js|jsx|ts|tsx)$/.test(filename)
      && !/\.d\.ts$/i.test(filename)
      && !/\.(?:min|bundle|chunk|compiled)\.(?:mjs|cjs|jsx?|tsx?)$/i.test(filename)
      && !filename.includes('.test.')
      && !filename.includes('.spec.');
  }

  findNestedFrameworkDirs(projectPath, relativeCandidates, maxDepth = 2) {
    const found = [];
    const root = path.resolve(projectPath);
    const skip = new Set([...this.skipDirs, 'tests', 'healix-reports']);
    const walk = (dir, depth) => {
      if (depth > maxDepth) return;
      let entries = [];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith('.') || skip.has(entry.name)) continue;
        const child = path.join(dir, entry.name);
        for (const rel of relativeCandidates) {
          const candidate = path.join(child, rel);
          if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
            found.push(candidate);
          }
        }
        walk(child, depth + 1);
      }
    };
    walk(root, 1);
    return [...new Set(found)];
  }

  /**
   * Helper: Format page name from path
   */
  formatPageName(routePath) {
    if (routePath === '/' || routePath === '') return 'Home page';
    return routePath
      .split('/')
      .filter(Boolean)
      .map(part => part.replace(/[:\[\]]/g, '').replace(/-/g, ' '))
      .join(' ')
      .replace(/^\w/, c => c.toUpperCase()) + ' page';
  }

  /**
   * Helper: Find files with given extensions
   */
  findFiles(dir, extensions, files = []) {
    if (!fs.existsSync(dir)) return files;
    if (files.length >= this.config.maxFiles) return files;
    
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.name.startsWith('.') || this.skipDirs.has(entry.name)) continue;
        
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          this.findFiles(fullPath, extensions, files);
        } else if (extensions.some(ext => entry.name.endsWith(ext))) {
          files.push(fullPath);
        }
        
        if (files.length >= this.config.maxFiles) break;
      }
    } catch (error) {
      // Ignore errors
    }
    
    return files;
  }

  /**
   * Helper: Extract component names from file
   */
  extractComponents(filePath) {
    const components = [];
    
    try {
      const content = this.readFileCached(filePath);
      if (!content) return [];
      
      // Look for imported components
      const importPattern = /import\s+(\w+)/g;
      let match;
      while ((match = importPattern.exec(content)) !== null) {
        const name = match[1];
        if (name[0] === name[0].toUpperCase() && !['React', 'Component', 'Fragment'].includes(name)) {
          components.push(name);
        }
      }
      
      // Limit to first 5
      return components.slice(0, 5);
    } catch (error) {
      return [];
    }
  }

  /**
   * Helper: Extract interactions from file
   */
  extractInteractions(filePath) {
    const interactions = [];
    
    try {
      const content = this.readFileCached(filePath);
      if (!content) return [];
      
      // Look for form elements
      if (content.includes('<form') || content.includes('<Form')) {
        interactions.push('form submission');
      }
      if (content.includes('<input') || content.includes('<Input')) {
        interactions.push('input fields');
      }
      if (content.includes('<button') || content.includes('<Button')) {
        interactions.push('buttons');
      }
      if (content.includes('onClick') || content.includes('onSubmit')) {
        interactions.push('click handlers');
      }
      if (content.includes('<Link') || content.includes('<a ')) {
        interactions.push('navigation links');
      }
      
      return [...new Set(interactions)];
    } catch (error) {
      return [];
    }
  }

  /**
   * Helper: Detect HTTP methods from API file
   */
  detectHTTPMethods(filePath) {
    const methods = [];
    
    try {
      const content = this.readFileCached(filePath);
      if (!content) return ['GET'];
      
      // Next.js API handlers
      if (content.includes('export async function GET') || content.includes('export function GET')) {
        methods.push('GET');
      }
      if (content.includes('export async function POST') || content.includes('export function POST')) {
        methods.push('POST');
      }
      if (content.includes('export async function PUT') || content.includes('export function PUT')) {
        methods.push('PUT');
      }
      if (content.includes('export async function DELETE') || content.includes('export function DELETE')) {
        methods.push('DELETE');
      }
      
      // Express-style handlers
      if (content.includes('req.method')) {
        if (content.includes("'GET'") || content.includes('"GET"')) methods.push('GET');
        if (content.includes("'POST'") || content.includes('"POST"')) methods.push('POST');
        if (content.includes("'PUT'") || content.includes('"PUT"')) methods.push('PUT');
        if (content.includes("'DELETE'") || content.includes('"DELETE"')) methods.push('DELETE');
      }
      
      // Default to GET if nothing detected
      if (methods.length === 0) {
        methods.push('GET');
      }
      
      return [...new Set(methods)];
    } catch (error) {
      return ['GET'];
    }
  }

  /**
   * Helper: Detect if auth is required
   */
  detectAuthRequired(filePath) {
    try {
      const content = this.readFileCached(filePath);
      if (!content) return false;
      return content.includes('auth') || 
             content.includes('token') || 
             content.includes('session') ||
             content.includes('getServerSession') ||
             content.includes('requireAuth');
    } catch (error) {
      return false;
    }
  }

  extractRouteComponentName(content, matchIndex = 0) {
    const afterRoutePath = String(content || '').slice(Math.max(0, matchIndex), matchIndex + 700);

    // Tolerate `element={ ( <Comp` and `element: ( <Comp` — JSX may sit behind
    // an optional brace, parens, and arbitrary whitespace/newlines.
    const elementMatch = afterRoutePath.match(/element\s*[:=]\s*\{?\s*\(?\s*<\s*([A-Z][A-Za-z0-9_]*)/);
    if (elementMatch) {
      const comp = elementMatch[1];
      // When the element is a route guard wrapper (ProtectedRoute, etc.), the
      // meaningful page component is the one nested inside it — look past the
      // wrapper for the next JSX component.
      if (ROUTE_GUARD_RE.test(comp)) {
        const afterGuard = afterRoutePath.slice(elementMatch.index + elementMatch[0].length);
        const inner = afterGuard.match(/<\s*([A-Z][A-Za-z0-9_]*)/);
        if (inner) return inner[1];
      }
      return comp;
    }

    const componentMatch = afterRoutePath.match(/(?:component|Component)\s*=\s*\{\s*([A-Z][A-Za-z0-9_]*)\s*\}/);
    if (componentMatch) return componentMatch[1];

    const objectComponentMatch = afterRoutePath.match(/(?:component|Component)\s*:\s*([A-Z][A-Za-z0-9_]*)\b/);
    if (objectComponentMatch) return objectComponentMatch[1];

    return null;
  }

  /**
   * Detect route-level auth gating from a guard wrapper (ProtectedRoute,
   * PrivateRoute, RequireAuth, etc.) and extract the role it requires. The
   * window is bounded to the current route's definition (up to the next
   * `path:`/`path=`) so we never attribute the next route's guard to this one.
   */
  extractRouteGuardInfo(content, matchIndex = 0) {
    const rest = String(content || '').slice(matchIndex + 1);
    const nextPath = rest.search(/\bpath\s*[:=]\s*["'`]/);
    const window = nextPath > -1 ? rest.slice(0, nextPath) : rest.slice(0, 600);

    const requiresAuthFromGuard = ROUTE_GUARD_RE.test(window);

    let requiredRole = null;
    const singleRole = window.match(/(?:requiredRole|requiredRoles|allowedRole|role)\s*[:=]\s*\{?\s*["']([^"']+)["']/);
    if (singleRole) {
      requiredRole = singleRole[1];
    } else {
      const roleArray = window.match(/(?:allowedRoles|requiredRoles|roles)\s*[:=]\s*\{?\s*\[([^\]]+)\]/);
      if (roleArray) {
        requiredRole = roleArray[1]
          .split(',')
          .map((s) => s.replace(/["'\s]/g, ''))
          .filter(Boolean)
          .join('|') || null;
      }
    }

    return { requiresAuth: requiresAuthFromGuard || !!requiredRole, requiredRole };
  }

  extractNearestComponentName(content, targetIndex = 0) {
    const text = String(content || '');
    const index = Math.max(0, Number.isFinite(targetIndex) ? targetIndex : 0);
    const componentPattern = /(?:export\s+default\s+)?function\s+([A-Z][A-Za-z0-9_]*)\s*\(|(?:export\s+)?(?:const|let|var)\s+([A-Z][A-Za-z0-9_]*)\s*=\s*(?:\([^)]*\)|[A-Za-z0-9_]+)?\s*=>|(?:export\s+)?(?:const|let|var)\s+([A-Z][A-Za-z0-9_]*)\s*=\s*function\b/g;
    let match;
    let nearest = null;
    while ((match = componentPattern.exec(text)) !== null) {
      if (match.index > index) break;
      nearest = {
        name: match[1] || match[2] || match[3],
        index: match.index,
      };
    }
    return nearest?.name || null;
  }

  normalizeSourceLiteral(value) {
    return String(value || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim();
  }

  shouldKeepSourceLiteral(value) {
    const text = this.normalizeSourceLiteral(value);
    if (text.length < 2 || text.length > 100) return false;
    if (/^https?:\/\//i.test(text)) return false;
    if (/^\.+\//.test(text)) return false;
    if (/\.(tsx?|jsx?|css|svg|png|jpe?g|json)$/i.test(text)) return false;
    if (/^[{}[\](),.;:]+$/.test(text)) return false;
    if (/^(className|children|props|return|import|export|from|true|false|null|undefined)$/i.test(text)) return false;

    const tokens = text.split(/\s+/);
    const dashTokenCount = tokens.filter((token) => token.includes('-') || token.includes(':')).length;
    if (tokens.length >= 5 && dashTokenCount >= Math.ceil(tokens.length * 0.6)) return false;

    // Short lowercase machine values are usually enum values, CSS tokens, or ids.
    // Keep capitalized short labels such as "Todo", "Review", and "Standup".
    if (/^[a-z0-9_-]{2,12}$/.test(text) && !/[A-Z]/.test(value)) return false;

    return true;
  }

  extractStableSourceStrings(content) {
    const literals = [];
    const add = (raw) => {
      const text = this.normalizeSourceLiteral(raw);
      if (this.shouldKeepSourceLiteral(text)) literals.push(text);
    };

    for (const match of String(content || '').matchAll(/>\s*([^<>{}]{2,100})\s*</g)) {
      add(match[1]);
    }

    for (const match of String(content || '').matchAll(/\b(?:aria-label|title|placeholder|alt|data-testid)=\{?\s*["'`]([^"'`{}]{2,100})["'`]\s*\}?/g)) {
      add(match[1]);
    }

    for (const match of String(content || '').matchAll(/(?:label|title|name|text|summary|description|status|priority|assignee|dueDate)\s*:\s*["'`]([^"'`{}]{2,100})["'`]/g)) {
      add(match[1]);
    }

    for (const match of String(content || '').matchAll(/["'`]([^"'`{}<>]{2,100})["'`]/g)) {
      add(match[1]);
    }

    return [...new Set(literals)].slice(0, 80);
  }

  findLikelyComponentFile(projectPath, componentName) {
    if (!componentName) return null;
    const candidates = [
      path.join(projectPath, 'src', 'pages', `${componentName}.tsx`),
      path.join(projectPath, 'src', 'pages', `${componentName}.jsx`),
      path.join(projectPath, 'src', 'components', `${componentName}.tsx`),
      path.join(projectPath, 'src', 'components', `${componentName}.jsx`),
      path.join(projectPath, 'pages', `${componentName}.tsx`),
      path.join(projectPath, 'pages', `${componentName}.jsx`),
      path.join(projectPath, 'components', `${componentName}.tsx`),
      path.join(projectPath, 'components', `${componentName}.jsx`),
    ];
    return candidates.find((candidate) => fs.existsSync(candidate)) || null;
  }

  classifySourceContextFile(relativePath) {
    if (/\/pages\//.test(relativePath)) return 'page';
    if (/\/components\//.test(relativePath)) return 'component';
    if (/\/data\//.test(relativePath)) return 'data';
    if (/app\.(tsx?|jsx?)$/i.test(relativePath)) return 'router';
    return 'source';
  }

  extractSourceContext(projectPath, pages = [], framework = null) {
    const candidates = new Set();
    const addFile = (filePath) => {
      if (!filePath) return;
      const absolute = path.isAbsolute(filePath) ? filePath : path.join(projectPath, filePath);
      if (!fs.existsSync(absolute)) return;
      if (/\.(spec|test)\.(tsx?|jsx?)$/i.test(absolute)) return;
      if (absolute.includes(`${path.sep}tests${path.sep}`)) return;
      candidates.add(absolute);
    };

    for (const page of pages || []) {
      addFile(page.sourceFile);
      const componentFile = this.findLikelyComponentFile(projectPath, page.routeComponent);
      addFile(componentFile);
    }

    for (const root of [
      'src/pages',
      'src/components',
      'src/data',
      'src/App.tsx',
      'src/App.jsx',
      'src/App.js',
      'app',
      'pages',
      'components',
    ]) {
      const fullPath = path.join(projectPath, root);
      if (!fs.existsSync(fullPath)) continue;
      const stat = fs.statSync(fullPath);
      if (stat.isFile()) {
        addFile(fullPath);
      } else {
        for (const file of this.findFiles(fullPath, ['.js', '.jsx', '.ts', '.tsx']).slice(0, 80)) {
          addFile(file);
        }
      }
    }

    const routePaths = new Set();
    const testIds = new Set();
    const assertableText = new Set();
    const files = [];
    let hashRoutingDetected = false;

    for (const filePath of [...candidates].slice(0, 120)) {
      const content = this.readFileCached(filePath, { allowLarge: true, maxBytes: 500000 });
      if (!content) continue;

      const relativePath = path.relative(projectPath, filePath);
      const fileRoutePaths = new Set();
      const fileTestIds = new Set();
      if (/withHashLocation\s*\(|HashLocationStrategy|useHash\s*:\s*true/i.test(content)) {
        hashRoutingDetected = true;
      }

      for (const match of content.matchAll(/\b(?:path|to|href)=["'`]([^"'`]+)["'`]/g)) {
        const routePath = String(match[1] || '').trim();
        if (routePath.startsWith('/')) {
          routePaths.add(routePath);
          fileRoutePaths.add(routePath);
          if (routePath.includes('#/')) hashRoutingDetected = true;
        }
      }
      for (const match of content.matchAll(/(?:router\.push|navigate)\(\s*["'`]([^"'`]+)["'`]\s*\)/g)) {
        const routePath = String(match[1] || '').trim();
        if (routePath.startsWith('/')) {
          routePaths.add(routePath);
          fileRoutePaths.add(routePath);
          if (routePath.includes('#/')) hashRoutingDetected = true;
        }
      }
      for (const match of content.matchAll(/data-testid=["'`]([^"'`]+)["'`]/g)) {
        testIds.add(match[1]);
        fileTestIds.add(match[1]);
      }

      const fileText = this.extractStableSourceStrings(content);
      fileText.forEach((text) => assertableText.add(text));

      const components = this.extractComponents(filePath);
      const entry = {
        file: relativePath,
        kind: this.classifySourceContextFile(relativePath),
        routePaths: [...fileRoutePaths].slice(0, 20),
        components: components.slice(0, 10),
        testIds: [...fileTestIds].slice(0, 20),
        assertableText: fileText.slice(0, 30),
      };

      if (
        entry.routePaths.length > 0 ||
        entry.components.length > 0 ||
        entry.testIds.length > 0 ||
        entry.assertableText.length > 0 ||
        /(pages|components|data|App\.)/.test(relativePath)
      ) {
        files.push(entry);
      }
    }

    files.sort((a, b) => {
      const kindRank = { page: 0, router: 1, component: 2, data: 3, source: 4 };
      const aRank = kindRank[a.kind] ?? 9;
      const bRank = kindRank[b.kind] ?? 9;
      if (aRank !== bRank) return aRank - bRank;
      return a.file.localeCompare(b.file);
    });

    // Role-aware element extraction — framework-agnostic dispatch. When the
    // current framework has no registered extractor (e.g. plain JS app or
    // unrecognized stack), `extractRoleAware` returns supported:false and we
    // simply omit `elements` from the result. Downstream consumers fall back
    // to the legacy flat assertableText corpus and the run is not blocked.
    let roleAwareElements = [];
    try {
      const { extractRoleAware } = require('./source-extractors');
      const absoluteFiles = [...candidates].slice(0, 120);
      const roleResult = extractRoleAware({
        projectPath,
        files: absoluteFiles,
        framework: framework || 'unknown',
        projectInfo: { routingMode: hashRoutingDetected ? 'hash' : 'path' },
      });
      if (roleResult.supported) {
        // Cap to avoid bloating the context payload sent to the model.
        roleAwareElements = (roleResult.elements || []).slice(0, 400);
      }
    } catch {
      // Best-effort: never let role-aware extraction break the legacy path.
    }

    return {
      files: files.slice(0, 40),
      assertableText: [...assertableText].slice(0, 220),
      routePaths: [...routePaths].slice(0, 120),
      testIds: [...testIds].slice(0, 120),
      sourceFilesAnalyzed: files.length,
      routingMode: hashRoutingDetected ? 'hash' : 'path',
      // Role-aware tuples (framework-agnostic). Empty when no extractor matched.
      elements: roleAwareElements,
    };
  }

  extractPageUIHints(filePath) {
    const content = this.readFileCached(filePath);
    if (!content) {
      return {
        components: [],
        interactions: [],
        buttons: [],
        links: [],
        testIds: [],
        ariaRoles: [],
        navigationTargets: [],
        selectorHints: [],
      };
    }

    const components = this.extractComponents(filePath);
    const interactions = this.extractInteractions(filePath);
    const buttons = [];
    const links = [];
    const testIds = [];
    const ariaRoles = [];
    const navigationTargets = [];

    const buttonMatches = content.matchAll(/<(?:button|Button)[^>]*>([\s\S]*?)<\/(?:button|Button)>/gi);
    for (const match of buttonMatches) {
      const text = String(match[1] || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      if (text) buttons.push(text);
    }

    const anchorMatches = content.matchAll(/<(?:a|Link)[^>]*(?:href|to)=["']([^"']+)["'][^>]*>([\s\S]*?)<\/(?:a|Link)>/gi);
    for (const match of anchorMatches) {
      const target = String(match[1] || '').trim();
      const text = String(match[2] || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      if (target) {
        links.push({ text, target });
        navigationTargets.push(target);
      }
    }

    const navCallMatches = content.matchAll(/(?:router\.push|navigate)\(\s*["'`]([^"'`]+)["'`]\s*\)/g);
    for (const match of navCallMatches) {
      const target = String(match[1] || '').trim();
      if (target) navigationTargets.push(target);
    }

    const testIdMatches = content.matchAll(/data-testid=["']([^"']+)["']/g);
    for (const match of testIdMatches) {
      testIds.push(match[1]);
    }

    const roleMatches = content.matchAll(/\brole=["']([^"']+)["']/g);
    for (const match of roleMatches) {
      ariaRoles.push(match[1]);
    }

    const selectorHints = [
      ...testIds,
      ...buttons,
      ...links.map((link) => link.text),
    ].filter(Boolean);

    return {
      components: components.slice(0, 8),
      interactions: [...new Set(interactions)].slice(0, 10),
      buttons: [...new Set(buttons)].slice(0, 12),
      links: links.slice(0, 12),
      testIds: [...new Set(testIds)].slice(0, 15),
      ariaRoles: [...new Set(ariaRoles)].slice(0, 15),
      navigationTargets: [...new Set(navigationTargets)].slice(0, 20),
      selectorHints: [...new Set(selectorHints)].slice(0, 20),
    };
  }

  buildNavigationGraph(pages = []) {
    const nodes = [];
    const edges = [];

    for (const page of pages || []) {
      if (!page?.path) continue;
      nodes.push(page.path);
      for (const target of page.navigationTargets || []) {
        edges.push({
          from: page.path,
          to: target,
          confidence: target.startsWith('/') ? 0.9 : 0.5,
        });
      }
    }

    return {
      nodes: [...new Set(nodes)],
      edges: edges.slice(0, 200),
    };
  }

  collectSelectorHints(pages = [], forms = []) {
    const hints = [];

    for (const page of pages || []) {
      hints.push(...(page.selectorHints || []));
      hints.push(...(page.testIds || []));
    }

    for (const form of forms || []) {
      hints.push(...(form.selectorHints || []));
      for (const field of form.fields || []) {
        hints.push(field.testId, field.label, field.placeholder, field.name);
      }
    }

    return [...new Set(hints.filter(Boolean))].slice(0, 100);
  }

  extractMockableApiContracts(projectPath, endpoints = [], forms = []) {
    const contracts = [];
    const formsByAction = new Map();

    for (const form of forms || []) {
      if (form.action) {
        formsByAction.set(form.action, form);
      }
    }

    for (const endpoint of endpoints || []) {
      const sourceRel = endpoint.source || '';
      const sourcePath = sourceRel ? path.join(projectPath, sourceRel) : null;
      const content = sourcePath ? this.readFileCached(sourcePath, { allowLarge: true }) : null;
      const requestFields = [];
      const responseStatuses = [];

      if (content) {
        const reqJsonMatches = content.matchAll(/const\s+\{([^}]+)\}\s*=\s*await\s+req\.json\(\)/g);
        for (const match of reqJsonMatches) {
          const fields = String(match[1] || '').split(',').map((field) => field.trim()).filter(Boolean);
          requestFields.push(...fields);
        }

        const statusMatches = content.matchAll(/(?:status\s*:\s*|res\.status\()(\d{3})/g);
        for (const match of statusMatches) {
          responseStatuses.push(Number(match[1]));
        }
      }

      const consumedByForm = formsByAction.get(endpoint.path);
      contracts.push({
        id: `${endpoint.method || 'GET'} ${endpoint.path || ''}`.trim(),
        method: endpoint.method || 'GET',
        path: endpoint.path || '/',
        sourceFile: sourceRel || null,
        request: {
          fields: [...new Set(requestFields)].slice(0, 20),
        },
        responses: [...new Set(responseStatuses)].slice(0, 10),
        consumedByForms: consumedByForm ? [consumedByForm.file] : [],
      });
    }

    return contracts.slice(0, 100);
  }
}

module.exports = ContextGatherer;
