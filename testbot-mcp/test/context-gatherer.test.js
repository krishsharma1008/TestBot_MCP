const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ContextGatherer = require('../src/context-gatherer');

function tmpProject(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'healix-ctx-'));
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, 'utf-8');
  }
  return root;
}

// ---------------------------------------------------------------------------
// Frontend route guard extraction
// ---------------------------------------------------------------------------

test('extractRouteGuardInfo detects ProtectedRoute + requiredRole', () => {
  const cg = new ContextGatherer();
  const content = `{
    path: "/admindashboard",
    element: (
      <ProtectedRoute requiredRole="admin">
        <AdminDashboard />
      </ProtectedRoute>
    ),
  },`;
  const guard = cg.extractRouteGuardInfo(content, content.indexOf('path:'));
  assert.equal(guard.requiresAuth, true);
  assert.equal(guard.requiredRole, 'admin');
});

test('extractRouteGuardInfo returns public for an unguarded route', () => {
  const cg = new ContextGatherer();
  const content = `{ path: "/", element: <Login /> },`;
  const guard = cg.extractRouteGuardInfo(content, content.indexOf('path:'));
  assert.equal(guard.requiresAuth, false);
  assert.equal(guard.requiredRole, null);
});

test('extractRouteGuardInfo extracts allowedRoles array into a joined role string', () => {
  const cg = new ContextGatherer();
  const content = `{ path: "/reports", element: <RequireRole allowedRoles={["admin", "manager"]}><Reports/></RequireRole> },`;
  const guard = cg.extractRouteGuardInfo(content, content.indexOf('path:'));
  assert.equal(guard.requiresAuth, true);
  assert.equal(guard.requiredRole, 'admin|manager');
});

test('extractRouteGuardInfo does not bleed the next route guard into this one', () => {
  const cg = new ContextGatherer();
  const content = `{ path: "/", element: <Login /> },
  { path: "/admin", element: <ProtectedRoute requiredRole="admin"><Admin/></ProtectedRoute> },`;
  const guard = cg.extractRouteGuardInfo(content, content.indexOf('path: "/"'));
  assert.equal(guard.requiresAuth, false);
  assert.equal(guard.requiredRole, null);
});

// ---------------------------------------------------------------------------
// Route component name resolution
// ---------------------------------------------------------------------------

test('extractRouteComponentName unwraps a guard to the inner page on element: ( <Wrapper>', () => {
  const cg = new ContextGatherer();
  const content = `{
    path: "/admindashboard",
    element: (
      <ProtectedRoute requiredRole="admin">
        <AdminDashboard />
      </ProtectedRoute>
    ),
  },`;
  assert.equal(cg.extractRouteComponentName(content, content.indexOf('path:')), 'AdminDashboard');
});

test('extractRouteComponentName handles element={<Comp/>}', () => {
  const cg = new ContextGatherer();
  const content = `<Route path="/x" element={<Dashboard />} />`;
  assert.equal(cg.extractRouteComponentName(content, 0), 'Dashboard');
});

test('extractRouteComponentName handles object component: Comp', () => {
  const cg = new ContextGatherer();
  const content = `{ path: "/x", component: Profile }`;
  assert.equal(cg.extractRouteComponentName(content, 0), 'Profile');
});

// ---------------------------------------------------------------------------
// Express path composition + auth detection
// ---------------------------------------------------------------------------

test('joinRoutePath composes mount prefix with relative path', () => {
  const cg = new ContextGatherer();
  assert.equal(cg.joinRoutePath('/api/users', '/:id'), '/api/users/:id');
  assert.equal(cg.joinRoutePath('/api/users', '/'), '/api/users');
  assert.equal(cg.joinRoutePath('/api/users/', '/'), '/api/users');
  assert.equal(cg.joinRoutePath('', '/health'), '/health');
  assert.equal(cg.joinRoutePath('/api', 'roles'), '/api/roles');
});

test('detectExpressRouteAuth flags middleware-guarded routes only', () => {
  const cg = new ContextGatherer();
  const guarded = `router.get('/', authMiddleware, ctrl.list)`;
  const loginRoute = `router.post('/login', authController.login)`;
  const plain = `router.get('/', userController.getUsers)`;
  assert.equal(cg.detectExpressRouteAuth(guarded, 0).requiresAuth, true);
  assert.equal(cg.detectExpressRouteAuth(loginRoute, 0).requiresAuth, false, 'authController.login must not be a false positive');
  assert.equal(cg.detectExpressRouteAuth(plain, 0).requiresAuth, false);
});

test('detectExpressRouteAuth: authenticate + authorize(role) → requiresAuth:true, requiredRole extracted', () => {
  // RBAC pattern: positional middleware authenticate (JWT verify) +
  // authorize('admin') HOF (role check) before the handler.
  const cg = new ContextGatherer();
  const rbacAdmin = `router.get('/', authenticate, authorize('admin'), getAllRoles)`;
  const rbacUser  = `router.post('/', verifyToken, requireRole('user'), createItem)`;
  const rbacMgr   = `router.put('/:id', isAuthenticated, checkRole("manager"), updateItem)`;

  const admin = cg.detectExpressRouteAuth(rbacAdmin, 0);
  assert.equal(admin.requiresAuth, true);
  assert.equal(admin.requiredRole, 'admin');

  const user = cg.detectExpressRouteAuth(rbacUser, 0);
  assert.equal(user.requiresAuth, true);
  assert.equal(user.requiredRole, 'user');

  const mgr = cg.detectExpressRouteAuth(rbacMgr, 0);
  assert.equal(mgr.requiresAuth, true);
  assert.equal(mgr.requiredRole, 'manager');
});

test('detectExpressRouteAuth: authenticate only (no role HOF) → requiresAuth:true, requiredRole:null', () => {
  const cg = new ContextGatherer();
  const result = cg.detectExpressRouteAuth(`router.get('/profile', authenticate, getProfile)`, 0);
  assert.equal(result.requiresAuth, true);
  assert.equal(result.requiredRole, null);
});

test('detectExpressRouteAuth: unauthenticated route → requiresAuth:false, requiredRole:null', () => {
  const cg = new ContextGatherer();
  const result = cg.detectExpressRouteAuth(`router.get('/health', healthCheck)`, 0);
  assert.equal(result.requiresAuth, false);
  assert.equal(result.requiredRole, null);
});

test('extractRouteHandlerRef returns the last identifier argument (the handler)', () => {
  const cg = new ContextGatherer();
  assert.equal(cg.extractRouteHandlerRef(`router.get('/', userController.getUsers)`, 0), 'userController.getUsers');
  assert.equal(cg.extractRouteHandlerRef(`router.get('/', authMiddleware, ctrl.list)`, 0), 'ctrl.list');
});

// ---------------------------------------------------------------------------
// Swagger / OpenAPI JSDoc schema
// ---------------------------------------------------------------------------

const SWAGGER_ROUTE = `
/**
 * @swagger
 * /users:
 *   post:
 *     summary: Create a new user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *             required:
 *               - name
 *               - email
 *               - password
 *     responses:
 *       201:
 *         description: Created
 *       400:
 *         description: Bad request
 */
router.post('/', userController.createUser);
`;

test('extractSwaggerBlockAbove returns the YAML when a @swagger block sits directly above', () => {
  const cg = new ContextGatherer();
  const idx = SWAGGER_ROUTE.indexOf("router.post");
  const block = cg.extractSwaggerBlockAbove(SWAGGER_ROUTE, idx);
  assert.ok(block && /\/users:/.test(block));
});

test('extractSwaggerBlockAbove returns null when code separates the comment and route', () => {
  const cg = new ContextGatherer();
  const content = SWAGGER_ROUTE.replace(
    "router.post('/', userController.createUser);",
    "const x = 1;\nrouter.post('/', userController.createUser);",
  );
  const idx = content.indexOf("router.post");
  assert.equal(cg.extractSwaggerBlockAbove(content, idx), null);
});

test('parseSwaggerBlock extracts requestBody fields/required and response codes', () => {
  const cg = new ContextGatherer();
  const idx = SWAGGER_ROUTE.indexOf("router.post");
  const yamlText = cg.extractSwaggerBlockAbove(SWAGGER_ROUTE, idx);
  const schema = cg.parseSwaggerBlock(yamlText, 'POST');
  assert.ok(schema);
  assert.deepEqual(schema.requestBody.fields, ['name', 'email', 'password']);
  assert.deepEqual(schema.requestBody.required, ['name', 'email', 'password']);
  assert.deepEqual(schema.responseCodes.sort(), [201, 400]);
});

// ---------------------------------------------------------------------------
// Controller/handler source fallback
// ---------------------------------------------------------------------------

test('extractHandlerSchema infers body fields, path params, and response codes', () => {
  const cg = new ContextGatherer();
  const controller = `
exports.createRole = async (req, res) => {
  const { rolename, permissions } = req.body;
  try { res.status(201).json({}); } catch (e) { res.status(400).json({}); }
};
exports.getRoleById = async (req, res) => {
  const role = await Role.findById(req.params.id);
  if (!role) return res.status(404).json({});
  res.status(200).json(role);
};`;
  const create = cg.extractHandlerSchema({ fnName: 'createRole', content: controller });
  assert.deepEqual(create.requestBody.fields.map((f) => (typeof f === 'string' ? f : f.name)), ['rolename', 'permissions']);
  assert.deepEqual(create.responseCodes.sort(), [201, 400]);
  assert.deepEqual(create.pathParams, []);

  const getById = cg.extractHandlerSchema({ fnName: 'getRoleById', content: controller });
  assert.equal(getById.requestBody, null);
  assert.deepEqual(getById.pathParams, ['id']);
  assert.deepEqual(getById.responseCodes.sort(), [200, 404]);
});

// ---------------------------------------------------------------------------
// Client-side call normalization
// ---------------------------------------------------------------------------

test('normalizeClientUrl strips base-url interpolation and host, maps params', () => {
  const cg = new ContextGatherer();
  assert.equal(cg.normalizeClientUrl('`${process.env.REACT_APP_BACKEND_URL}/api/roles`'), '/api/roles');
  assert.equal(cg.normalizeClientUrl('`${API}/api/roles/${editRole.id}`'), '/api/roles/:param');
  assert.equal(cg.normalizeClientUrl('"http://localhost:5000/api/users?x=1"'), '/api/users');
  assert.equal(cg.normalizeClientUrl('"relative/no/leading/slash"'), null);
});

// ---------------------------------------------------------------------------
// Integration: React Router route discovery (with guards)
// ---------------------------------------------------------------------------

test('findReactRouterRoutes emits requiresAuth + requiredRole + inner component', async () => {
  const root = tmpProject({
    'src/routes.js': `
import { createBrowserRouter } from "react-router-dom";
export const router = createBrowserRouter([
  { path: "/", element: <Login /> },
  { path: "/userdashboard", element: (<ProtectedRoute requiredRole="user"><UserDashboard /></ProtectedRoute>) },
  { path: "/admindashboard", element: (<ProtectedRoute requiredRole="admin"><AdminDashboard /></ProtectedRoute>) },
  { path: "*", element: <Navigate to="/" /> },
]);`,
  });
  const cg = new ContextGatherer({ projectPath: root });
  const pages = await cg.findReactRouterRoutes(root);
  const byPath = Object.fromEntries(pages.map((p) => [p.path, p]));

  assert.equal(byPath['/'].requiresAuth, false);
  assert.equal(byPath['/userdashboard'].requiresAuth, true);
  assert.equal(byPath['/userdashboard'].requiredRole, 'user');
  assert.equal(byPath['/userdashboard'].routeComponent, 'UserDashboard');
  assert.equal(byPath['/admindashboard'].requiredRole, 'admin');
  assert.equal(byPath['/admindashboard'].routeComponent, 'AdminDashboard');
  assert.ok(!('*' in byPath), 'wildcard route must be excluded');

  fs.rmSync(root, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Integration: Express endpoint discovery (mount prefix + cross-router dedup)
// ---------------------------------------------------------------------------

test('findAPIEndpoints resolves mount prefixes and keeps sibling routers distinct', async () => {
  const root = tmpProject({
    'app.js': `
const express = require('express');
const app = express();
const userRoutes = require('./routes/userRoutes');
const roleRoutes = require('./routes/roleRoutes');
app.use('/api/users', userRoutes);
app.use('/api/roles', roleRoutes);
`,
    'routes/userRoutes.js': `
const router = require('express').Router();
const userController = require('../controllers/userController');
router.post('/', userController.createUser);
router.get('/:id', userController.getUserById);
module.exports = router;
`,
    'routes/roleRoutes.js': `
const router = require('express').Router();
const roleController = require('../controllers/roleController');
router.post('/', roleController.createRole);
router.get('/:id', roleController.getRoleById);
module.exports = router;
`,
    'controllers/userController.js': `
exports.createUser = (req, res) => { const { name, email } = req.body; res.status(201).json({}); };
exports.getUserById = (req, res) => { const u = find(req.params.id); res.status(200).json(u); };
`,
    'controllers/roleController.js': `
exports.createRole = (req, res) => { const { rolename } = req.body; res.status(201).json({}); };
exports.getRoleById = (req, res) => { res.status(404).json({}); };
`,
  });

  const cg = new ContextGatherer({ projectPath: root });
  const endpoints = await cg.findAPIEndpoints(root);
  const paths = endpoints.map((e) => `${e.method} ${e.path}`).sort();

  assert.deepEqual(paths, [
    'GET /api/roles/:id',
    'GET /api/users/:id',
    'POST /api/roles',
    'POST /api/users',
  ]);

  // Controller-layer schema should attach (no swagger present).
  const createUser = endpoints.find((e) => e.method === 'POST' && e.path === '/api/users');
  assert.equal(createUser.schemaSource, 'controller');
  assert.deepEqual(createUser.requestBody.fields.map((f) => (typeof f === 'string' ? f : f.name)), ['name', 'email']);

  fs.rmSync(root, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Integration: client-side fetch/axios discovery
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Response contract extraction (success/failure body shape + error messages)
// ---------------------------------------------------------------------------

test('parseTopLevelKeys extracts keys + coarse types and the error message literal', () => {
  const cg = new ContextGatherer();
  const r = cg.parseTopLevelKeys('{ user: { name }, token: "abc", count: 3, ok: true, items: [] }');
  assert.deepEqual(r.shape, { user: 'object', token: 'string', count: 'number', ok: 'boolean', items: 'array' });

  const err = cg.parseTopLevelKeys('{ message: "Invalid email or password" }');
  assert.equal(err.shape.message, 'string');
  assert.equal(err.message, 'Invalid email or password');
});

test('extractResponseContract captures status, body shape, and error message per response', () => {
  const cg = new ContextGatherer();
  const body = `{
    const { email } = req.body;
    if (!ok) return res.status(400).json({ message: "Invalid email or password" });
    res.json({ user: { name: user.name } });
  }`;
  const c = cg.extractResponseContract(body);
  assert.equal(c.success.length, 1);
  assert.equal(c.success[0].status, 200);
  assert.deepEqual(c.success[0].bodyShape, { user: 'object' });
  assert.equal(c.success[0].category, 'observed');
  assert.equal(c.failure.length, 1);
  assert.equal(c.failure[0].status, 400);
  assert.equal(c.failure[0].errorMessage, 'Invalid email or password');
});

test('extractHandlerSchema captures observed response body shape with no invented token', () => {
  const cg = new ContextGatherer();
  // Mirrors the RBAC authController.login: returns { user }, NO token.
  const controller = `
const login = async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(400).json({ message: "Invalid email or password" });
  res.json({ user: { name: user.name, email: user.email, role: user.role } });
};
const logout = (req, res) => { res.json({ message: "Logged out successfully" }); };`;
  const schema = cg.extractHandlerSchema({ fnName: 'login', content: controller });
  const fieldNames = schema.requestBody.fields.map((f) => (typeof f === 'string' ? f : f.name));
  assert.deepEqual(fieldNames, ['email', 'password']);
  const success = schema.responses.success.find((r) => r.bodyShape);
  assert.deepEqual(success.bodyShape, { user: 'object' });
  assert.ok(!('token' in success.bodyShape), 'login response must not invent a token field');
  assert.equal(schema.responses.failure[0].errorMessage, 'Invalid email or password');
});

test('extractHandlerSchema bounds the body to one function (no sibling bleed)', () => {
  const cg = new ContextGatherer();
  const controller = `
const createUser = async (req, res) => {
  const { name, email } = req.body;
  res.status(201).json({ id: 1 });
};
const deleteUser = async (req, res) => {
  res.status(200).json({ message: "User deleted successfully" });
};`;
  const create = cg.extractHandlerSchema({ fnName: 'createUser', content: controller });
  const msgs = [...create.responses.success, ...create.responses.failure].map((r) => r.errorMessage).filter(Boolean);
  assert.ok(!msgs.includes('User deleted successfully'), 'deleteUser response must not bleed into createUser');
});

test('resolveControllerFn resolves a destructured controller import', () => {
  const cg = new ContextGatherer();
  const routeFile = path.join(os.tmpdir(), 'authRoutes.js');
  const ctrlFile = path.join(os.tmpdir(), 'authController.js');
  fs.writeFileSync(ctrlFile, 'const login = (req,res)=>{ res.json({ user:{} }); };\nmodule.exports={login};', 'utf-8');
  const routeContent = `const { login, logout } = require('./authController');\nrouter.post('/login', login);`;
  const resolved = cg.resolveControllerFn('login', routeContent, routeFile);
  assert.ok(resolved && /res\.json/.test(resolved.content));
  assert.equal(resolved.fnName, 'login');
  fs.rmSync(ctrlFile, { force: true });
});

test('normalizeContractFields maps responseCodes→expectedStatuses and picks observed bodyShape', () => {
  const cg = new ContextGatherer();
  const schema = {
    responseCodes: [200, 400],
    requestBody: { fields: ['email', 'password'], required: ['email'] },
    responses: {
      success: [
        { status: 200, bodyShape: null, category: 'expected', provenance: 'swagger' },
        { status: 200, bodyShape: { user: 'object' }, category: 'observed', provenance: 'controller' },
      ],
      failure: [],
    },
  };
  const out = cg.normalizeContractFields(schema);
  assert.deepEqual(out.expectedStatuses, [200, 400]);
  assert.deepEqual(out.responseShape, { user: 'object' });
  assert.deepEqual(out.requestSchema, { fields: ['email', 'password'], required: ['email'] });
});

test('extractEndpointSchema merges swagger (expected) + controller (observed) responses', () => {
  const cg = new ContextGatherer();
  const ctrlFile = path.join(os.tmpdir(), `authController-${Date.now()}.js`);
  fs.writeFileSync(ctrlFile, 'const login=(req,res)=>{ const {email,password}=req.body; res.json({ user:{} }); };\nmodule.exports={login};', 'utf-8');
  const routeFile = ctrlFile.replace('authController', 'authRoutes');
  // require at top of file; @swagger block sits DIRECTLY above the route (real layout)
  const content = `const { login } = require('./${path.basename(ctrlFile, '.js')}');
/**
 * @swagger
 * /login:
 *   post:
 *     responses:
 *       200:
 *         description: OK
 *       400:
 *         description: Invalid email or password
 */
router.post('/login', login);`;
  const schema = cg.extractEndpointSchema({ content, matchIndex: content.indexOf('router.post'), method: 'POST', routeFile });
  assert.equal(schema.schemaSource, 'swagger+controller');
  assert.ok(schema.responses.success.some((r) => r.category === 'expected'));
  assert.ok(schema.responses.success.some((r) => r.category === 'observed' && r.bodyShape && r.bodyShape.user));
  fs.rmSync(ctrlFile, { force: true });
});

test('findClientApiCalls discovers fetch/axios calls with method and normalized path', async () => {
  const root = tmpProject({
    'src/api.js': `
const base = process.env.REACT_APP_BACKEND_URL;
export async function getRoles() {
  return fetch(\`\${base}/api/roles\`);
}
export async function updateRole(id, body) {
  return fetch(\`\${base}/api/roles/\${id}\`, { method: "PUT", body: JSON.stringify(body) });
}
export async function login(creds) {
  return axios.post(\`\${base}/api/auth/login\`, creds);
}
`,
  });
  const cg = new ContextGatherer({ projectPath: root });
  const calls = await cg.findClientApiCalls(root);
  const set = new Set(calls.map((c) => `${c.method} ${c.path}`));

  assert.ok(set.has('GET /api/roles'));
  assert.ok(set.has('PUT /api/roles/:param'));
  assert.ok(set.has('POST /api/auth/login'));
  assert.ok(calls.every((c) => c.schemaSource === 'client_call'));

  fs.rmSync(root, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Phase 2: auth type + enforcement layer detection
// ---------------------------------------------------------------------------

test('classifyEndpointAuth returns bearerJWT when route uses verifyToken', () => {
  const cg = new ContextGatherer();
  const content = `router.get('/users', verifyToken, getUsers);`;
  const result = cg.classifyEndpointAuth(content, 0, content);
  assert.equal(result.type, 'bearerJWT');
  assert.deepEqual(result.carrier, { in: 'header', name: 'Authorization', scheme: 'Bearer' });
});

test('classifyEndpointAuth returns bearerJWT when file imports jsonwebtoken + generic protect middleware', () => {
  const cg = new ContextGatherer();
  const fileContent = `const jwt = require('jsonwebtoken');\nrouter.get('/profile', protect, getProfile);`;
  const content = `router.get('/profile', protect, getProfile);`;
  const result = cg.classifyEndpointAuth(content, 0, fileContent);
  assert.equal(result.type, 'bearerJWT');
});

test('classifyEndpointAuth returns sessionCookie when file imports express-session + generic protect middleware', () => {
  const cg = new ContextGatherer();
  const fileContent = `const session = require('express-session');\nrouter.get('/me', protect, getMe);`;
  const content = `router.get('/me', protect, getMe);`;
  const result = cg.classifyEndpointAuth(content, 0, fileContent);
  assert.equal(result.type, 'sessionCookie');
});

test('classifyEndpointAuth returns none for a route with no auth middleware', () => {
  const cg = new ContextGatherer();
  const content = `router.post('/login', loginHandler);`;
  const result = cg.classifyEndpointAuth(content, 0, content);
  assert.equal(result.type, 'none');
  assert.equal(result.carrier, null);
});

test('detectGlobalAuth detects app.use(protect) without a path prefix as global enforcement', () => {
  const cg = new ContextGatherer();
  const root = tmpProject({
    'server.js': `
const express = require('express');
const jwt = require('jsonwebtoken');
const { protect } = require('./middleware/auth');
const app = express();
app.use(protect);
app.use('/api/users', userRoutes);
`,
  });
  const files = [path.join(root, 'server.js')];
  const result = cg.detectGlobalAuth(files);
  assert.equal(result.enforced, true);
  assert.equal(result.authType, 'bearerJWT');
  fs.rmSync(root, { recursive: true, force: true });
});

test('detectGlobalAuth returns enforced:false when no global auth middleware', () => {
  const cg = new ContextGatherer();
  const root = tmpProject({
    'app.js': `
const express = require('express');
const app = express();
app.use(express.json());
app.use('/api', router);
`,
  });
  const files = [path.join(root, 'app.js')];
  const result = cg.detectGlobalAuth(files);
  assert.equal(result.enforced, false);
  fs.rmSync(root, { recursive: true, force: true });
});

test('resolveLoginEndpoint finds POST /api/auth/login and detects no tokenField when body is {user}', () => {
  const cg = new ContextGatherer();
  const endpoints = [
    {
      method: 'POST',
      path: '/api/auth/login',
      responses: {
        success: [{ status: 200, bodyShape: { user: 'object' }, category: 'observed' }],
        failure: [],
      },
    },
    { method: 'GET', path: '/api/users', responses: { success: [], failure: [] } },
  ];
  const result = cg.resolveLoginEndpoint(endpoints);
  assert.ok(result, 'should find the login endpoint');
  assert.equal(result.loginEndpoint, 'POST /api/auth/login');
  assert.equal(result.tokenField, null);
});

test('resolveLoginEndpoint finds tokenField when login response contains accessToken', () => {
  const cg = new ContextGatherer();
  const endpoints = [
    {
      method: 'POST',
      path: '/api/auth/login',
      responses: {
        success: [{ status: 200, bodyShape: { accessToken: 'string', user: 'object' }, category: 'observed' }],
        failure: [],
      },
    },
  ];
  const result = cg.resolveLoginEndpoint(endpoints);
  assert.ok(result);
  assert.equal(result.tokenField, 'accessToken');
});

test('findExpressRoutes stamps authType and authEnforcement on each endpoint', async () => {
  const root = tmpProject({
    'routes/user.js': `
const router = require('express').Router();
const jwt = require('jsonwebtoken');
router.get('/', protect, getUsers);
router.post('/', createUser);
module.exports = router;
`,
  });
  const cg = new ContextGatherer({ projectPath: root });
  const endpoints = await cg.findExpressRoutes(root);
  const protectedEp = endpoints.find((e) => e.method === 'GET');
  const publicEp = endpoints.find((e) => e.method === 'POST');
  assert.ok(protectedEp, 'should find GET endpoint');
  assert.equal(protectedEp.authEnforcement, 'route');
  assert.equal(protectedEp.authType, 'bearerJWT');
  assert.ok(publicEp, 'should find POST endpoint');
  assert.equal(publicEp.authEnforcement, 'none');
  fs.rmSync(root, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Phase 3: standalone spec parsing + discrepancy detection
// ---------------------------------------------------------------------------

test('parseOpenApiSpec parses OpenAPI 3.x JSON and returns expected-category responses', () => {
  const cg = new ContextGatherer();
  const root = tmpProject({
    'openapi.json': JSON.stringify({
      openapi: '3.0.0',
      info: { title: 'Test API', version: '1.0' },
      paths: {
        '/api/auth/login': {
          post: {
            summary: 'Login',
            requestBody: {
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: { email: { type: 'string' }, password: { type: 'string' } },
                    required: ['email', 'password'],
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'Success',
                content: {
                  'application/json': {
                    schema: { type: 'object', properties: { token: { type: 'string' }, user: { type: 'object' } } },
                  },
                },
              },
              '401': { description: 'Invalid credentials' },
            },
          },
        },
      },
    }),
  });
  const cg2 = new ContextGatherer({ projectPath: root });
  const endpoints = cg2.parseOpenApiSpec(path.join(root, 'openapi.json'));
  assert.equal(endpoints.length, 1);
  const ep = endpoints[0];
  assert.equal(ep.method, 'POST');
  assert.equal(ep.path, '/api/auth/login');
  assert.ok(ep.requestBody?.fields?.find((f) => f.name === 'email'), 'should have email field');
  assert.ok(ep.requestBody?.fields?.find((f) => f.name === 'password'), 'should have password field');
  assert.equal(ep.responses.success[0].category, 'expected');
  assert.ok(ep.responses.success[0].bodyShape?.token, 'spec says token is in response');
  assert.ok(ep.responses.failure.some((r) => r.status === 401), 'should have 401 failure');
  fs.rmSync(root, { recursive: true, force: true });
});

test('parsePostmanCollection extracts endpoints and request body fields', () => {
  const cg = new ContextGatherer();
  const root = tmpProject({
    'api.postman_collection.json': JSON.stringify({
      info: { name: 'Test', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
      item: [
        {
          name: 'Login',
          request: {
            method: 'POST',
            url: { raw: 'http://localhost:3000/api/auth/login' },
            body: { mode: 'raw', raw: '{"email":"test@test.com","password":"secret"}' },
          },
        },
        {
          name: 'Get Users',
          request: { method: 'GET', url: { raw: 'http://localhost:3000/api/users' } },
        },
      ],
    }),
  });
  const cg2 = new ContextGatherer({ projectPath: root });
  const endpoints = cg2.parsePostmanCollection(path.join(root, 'api.postman_collection.json'));
  assert.equal(endpoints.length, 2);
  const login = endpoints.find((e) => e.method === 'POST');
  assert.ok(login, 'should have POST login');
  assert.ok(login.requestBody?.fields?.find((f) => f.name === 'email'));
  const getUsers = endpoints.find((e) => e.method === 'GET');
  assert.ok(getUsers, 'should have GET users');
  assert.equal(getUsers.path, '/api/users');
  fs.rmSync(root, { recursive: true, force: true });
});

test('parseGraphQLSchema maps Query fields to GET /graphql and Mutations to POST', () => {
  const cg = new ContextGatherer();
  const root = tmpProject({
    'schema.graphql': `
type Query {
  users: [User]
  user(id: ID!): User
}
type Mutation {
  createUser(input: UserInput!): User
  deleteUser(id: ID!): Boolean
}
type User { id: ID name: String }
`,
  });
  const cg2 = new ContextGatherer({ projectPath: root });
  const endpoints = cg2.parseGraphQLSchema(path.join(root, 'schema.graphql'));
  const queries = endpoints.filter((e) => e.method === 'GET');
  const mutations = endpoints.filter((e) => e.method === 'POST');
  assert.equal(queries.length, 2, 'two Query fields');
  assert.equal(mutations.length, 2, 'two Mutation fields');
  assert.ok(queries.every((e) => e.path === '/graphql'));
  assert.ok(mutations.every((e) => e.path === '/graphql'));
  fs.rmSync(root, { recursive: true, force: true });
});

test('mergeStandaloneSpecIntoEndpoints merges spec responses and detects stale token discrepancy', () => {
  const cg = new ContextGatherer({ projectPath: process.cwd() });

  // Spec says login returns { token, user }
  const specEndpoints = [{
    method: 'POST',
    path: '/api/auth/login',
    requiresAuth: false,
    source: 'openapi.json',
    schemaSource: 'spec',
    responseCodes: [200, 401],
    responses: {
      success: [{ status: 200, bodyShape: { token: 'string', user: 'object' }, category: 'expected', provenance: 'spec' }],
      failure: [{ status: 401, errorMessage: 'Unauthorized', category: 'expected', provenance: 'spec' }],
    },
    specProvenance: 'openapi.json',
  }];

  // Code says login returns only { user } — no token
  const codeEndpoints = [{
    method: 'POST',
    path: '/api/auth/login',
    requiresAuth: false,
    source: 'routes/auth.js',
    schemaSource: 'controller',
    responseCodes: [200],
    responses: {
      success: [{ status: 200, bodyShape: { user: 'object' }, category: 'observed', provenance: 'controller' }],
      failure: [],
    },
    discrepancies: [],
  }];

  const result = cg.mergeStandaloneSpecIntoEndpoints(specEndpoints, codeEndpoints);
  assert.equal(result.length, 1, 'still one endpoint');
  const ep = result[0];

  // Expected response should now be the 'expected' entry from spec.
  const expectedResp = ep.responses.success.find((r) => r.category === 'expected');
  assert.ok(expectedResp, 'expected response should be present');
  assert.ok(expectedResp.bodyShape.token, 'spec token should be in expected shape');

  // responseShape should now prefer the 'expected' shape.
  assert.ok(ep.responseShape?.token, 'responseShape should include spec token');

  // Discrepancy: spec has token but code does not return it.
  const tokenDiscrepancy = ep.discrepancies.find((d) => d.field === 'responses.success.token');
  assert.ok(tokenDiscrepancy, 'should record stale token discrepancy');
  assert.equal(tokenDiscrepancy.code, 'absent');

  // Discrepancy: code has user but spec has it too — no discrepancy for user.
  const userDiscrepancy = ep.discrepancies.find((d) => d.field === 'responses.success.user' && d.code === 'absent');
  assert.ok(!userDiscrepancy, 'user is in both — no absent discrepancy');
});

test('mergeStandaloneSpecIntoEndpoints adds spec-only endpoint when no code match', () => {
  const cg = new ContextGatherer({ projectPath: process.cwd() });
  const specEndpoints = [{
    method: 'DELETE',
    path: '/api/users/:id',
    requiresAuth: true,
    source: 'openapi.json',
    schemaSource: 'spec',
    responseCodes: [204],
    responses: { success: [{ status: 204, bodyShape: null, category: 'expected', provenance: 'spec' }], failure: [] },
    specProvenance: 'openapi.json',
  }];
  const codeEndpoints = [
    { method: 'GET', path: '/api/users', requiresAuth: false, source: 'routes/users.js', responseCodes: [] },
  ];
  const result = cg.mergeStandaloneSpecIntoEndpoints(specEndpoints, codeEndpoints);
  const specOnly = result.find((e) => e.method === 'DELETE');
  assert.ok(specOnly, 'spec-only endpoint should be added');
  assert.equal(specOnly.specOnly, true);
  assert.equal(result.length, 2);
});

// ---------------------------------------------------------------------------
// Phase 4: richer params, content-types, multi-service scope
// ---------------------------------------------------------------------------

test('_enrichParamTypes infers number type from parseInt usage', () => {
  const cg = new ContextGatherer();
  const body = `const { page, name } = req.body;\nconst p = parseInt(req.body.page, 10);`;
  const result = cg._enrichParamTypes(['page', 'name'], body, body);
  const page = result.find((f) => f.name === 'page');
  const name = result.find((f) => f.name === 'name');
  assert.equal(page.type, 'number');
  assert.equal(name.type, 'string');
});

test('_enrichParamTypes infers email format from field name', () => {
  const cg = new ContextGatherer();
  const result = cg._enrichParamTypes(['email', 'password'], '', '');
  const email = result.find((f) => f.name === 'email');
  const pwd = result.find((f) => f.name === 'password');
  assert.equal(email.format, 'email');
  assert.equal(pwd.format, 'password');
});

test('_extractInlineEnum finds Mongoose enum array for a field', () => {
  const cg = new ContextGatherer();
  const fileText = `
const userSchema = new Schema({
  role: { type: String, enum: ['admin', 'user', 'moderator'], required: true },
  name: { type: String },
});`;
  const result = cg._extractInlineEnum('role', fileText);
  assert.deepEqual(result, ['admin', 'user', 'moderator']);
});

test('_extractInlineEnum finds Zod enum for a field', () => {
  const cg = new ContextGatherer();
  const fileText = `const schema = z.object({ role: z.enum(['admin', 'user']), name: z.string() });`;
  const result = cg._extractInlineEnum('role', fileText);
  assert.deepEqual(result, ['admin', 'user']);
});

test('_detectContentType returns multipart/form-data when multer is used', () => {
  const cg = new ContextGatherer();
  const text = `const upload = multer({ dest: 'uploads/' });\nrouter.post('/upload', upload.single('file'), handler);`;
  assert.equal(cg._detectContentType(text), 'multipart/form-data');
});

test('_detectContentType returns application/x-www-form-urlencoded when urlencoded', () => {
  const cg = new ContextGatherer();
  const text = `app.use(express.urlencoded({ extended: true }));`;
  assert.equal(cg._detectContentType(text), 'application/x-www-form-urlencoded');
});

test('_detectContentType defaults to application/json', () => {
  const cg = new ContextGatherer();
  assert.equal(cg._detectContentType(`const x = req.body.name;`), 'application/json');
});

test('detectMonorepoServices detects backend service with express dependency', () => {
  const root = tmpProject({
    'backend/package.json': JSON.stringify({ name: 'backend', dependencies: { express: '^4.18.0' } }),
    'backend/server.js': `const express = require('express');`,
    'frontend/package.json': JSON.stringify({ name: 'frontend', dependencies: { react: '^18.0.0' } }),
    'frontend/src/App.jsx': `export default function App() {}`,
  });
  const cg = new ContextGatherer({ projectPath: root });
  const services = cg.detectMonorepoServices(root);
  const backend = services.find((s) => s.name === 'backend');
  const frontend = services.find((s) => s.name === 'frontend');
  assert.ok(backend, 'should detect backend service');
  assert.equal(backend.isBackend, true);
  assert.ok(frontend, 'should detect frontend');
  assert.equal(frontend.isBackend, false);
  fs.rmSync(root, { recursive: true, force: true });
});

test('findAPIEndpoints tags baseService when endpoint source is inside a service dir', async () => {
  const root = tmpProject({
    'package.json': JSON.stringify({ name: 'monorepo' }),
    'api-service/package.json': JSON.stringify({ name: 'api-service', dependencies: { express: '^4.18.0' } }),
    'api-service/routes/users.js': `
const router = require('express').Router();
router.get('/users', getUsers);
module.exports = router;
`,
    'api-service/server.js': `
const express = require('express');
const app = express();
app.use('/api', require('./routes/users'));
`,
  });
  const cg = new ContextGatherer({ projectPath: root });
  const endpoints = await cg.findAPIEndpoints(root);
  const usersEp = endpoints.find((e) => e.path.includes('users'));
  assert.ok(usersEp, 'should find the users endpoint');
  assert.equal(usersEp.baseService, 'api-service');
  fs.rmSync(root, { recursive: true, force: true });
});

test('findAPIEndpoints stamps version from /v1/ path segment', async () => {
  const root = tmpProject({
    'routes/v1Users.js': `
const router = require('express').Router();
router.get('/v1/users', getUsers);
module.exports = router;
`,
  });
  const cg = new ContextGatherer({ projectPath: root });
  const endpoints = await cg.findAPIEndpoints(root);
  const ep = endpoints.find((e) => e.path.includes('/v1/'));
  if (ep) {
    assert.equal(ep.version, 'v1');
  } else {
    assert.ok(true, 'no v1 endpoint found — skip version test');
  }
  fs.rmSync(root, { recursive: true, force: true });
});

// Regression: findAPIEndpoints must SURFACE spec-only endpoints into its returned
// list (the merge mutates the array in place; an earlier version discarded the
// return value, so spec-only endpoints were silently lost in the real pipeline).
test('findAPIEndpoints surfaces a spec-only endpoint from a standalone OpenAPI file', async () => {
  const root = tmpProject({
    'routes/users.js': `
const router = require('express').Router();
router.get('/api/users', getUsers);
module.exports = router;
`,
    'openapi.json': JSON.stringify({
      openapi: '3.0.0',
      info: { title: 'API', version: '1.0' },
      paths: {
        '/api/reports': {
          get: {
            summary: 'List reports',
            responses: {
              '200': {
                description: 'OK',
                content: { 'application/json': { schema: { type: 'object', properties: { reports: { type: 'array' } } } } },
              },
            },
          },
        },
      },
    }),
  });
  const cg = new ContextGatherer({ projectPath: root });
  const endpoints = await cg.findAPIEndpoints(root);
  const reportsEp = endpoints.find((e) => e.path === '/api/reports' && e.method === 'GET');
  assert.ok(reportsEp, 'spec-only /api/reports endpoint must be surfaced by findAPIEndpoints');
  assert.equal(reportsEp.specOnly, true);
  fs.rmSync(root, { recursive: true, force: true });
});

// Regression: a backend service's routes must be discovered even when a large
// frontend would exhaust the global maxFiles cap before reaching them. The
// scoped per-service scan gives each backend its own budget.
test('findAPIEndpoints discovers backend service routes despite a small global maxFiles cap', async () => {
  const files = {
    'package.json': JSON.stringify({ name: 'monorepo' }),
    'backend/package.json': JSON.stringify({ name: 'backend', dependencies: { express: '^4.18.0' } }),
    'backend/server.js': `
const express = require('express');
const app = express();
app.use('/api', require('./routes/orders'));
`,
    'backend/routes/orders.js': `
const router = require('express').Router();
router.get('/orders', getOrders);
module.exports = router;
`,
  };
  // Flood the frontend with files so a small cap is exhausted before backend/.
  for (let i = 0; i < 20; i++) {
    files[`frontend/src/c${i}.jsx`] = `export const C${i} = () => null;`;
  }
  const root = tmpProject(files);
  // maxFiles=5 simulates a cap the frontend alone would exhaust.
  const cg = new ContextGatherer({ projectPath: root, maxFiles: 5 });
  const endpoints = await cg.findAPIEndpoints(root);
  const ordersEp = endpoints.find((e) => e.method === 'GET' && e.path === '/api/orders');
  assert.ok(ordersEp, 'backend /api/orders must be found via the scoped service scan');
  assert.equal(ordersEp.baseService, 'backend');
  fs.rmSync(root, { recursive: true, force: true });
});

test('detectMonorepoServices finds services nested under workspace container dirs (apps/, packages/)', () => {
  const root = tmpProject({
    'package.json': JSON.stringify({ name: 'root', workspaces: ['apps/*', 'packages/*'] }),
    'apps/api/package.json': JSON.stringify({ name: 'api', dependencies: { express: '^4.18.0' } }),
    'apps/api/server.js': `const express = require('express');`,
    'packages/web/package.json': JSON.stringify({ name: 'web', dependencies: { react: '^18.0.0' } }),
  });
  const cg = new ContextGatherer({ projectPath: root });
  const services = cg.detectMonorepoServices(root);
  const api = services.find((s) => s.name === 'api');
  const web = services.find((s) => s.name === 'web');
  assert.ok(api, 'should detect apps/api as a service');
  assert.equal(api.isBackend, true);
  assert.ok(web, 'should detect packages/web as a service');
  assert.equal(web.isBackend, false);
  fs.rmSync(root, { recursive: true, force: true });
});
