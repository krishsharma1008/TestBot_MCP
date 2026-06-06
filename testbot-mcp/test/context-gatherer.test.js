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
  assert.equal(cg.detectExpressRouteAuth(guarded, 0), true);
  assert.equal(cg.detectExpressRouteAuth(loginRoute, 0), false, 'authController.login must not be a false positive');
  assert.equal(cg.detectExpressRouteAuth(plain, 0), false);
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
  assert.deepEqual(create.requestBody.fields, ['rolename', 'permissions']);
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
  assert.deepEqual(createUser.requestBody.fields, ['name', 'email']);

  fs.rmSync(root, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Integration: client-side fetch/axios discovery
// ---------------------------------------------------------------------------

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
