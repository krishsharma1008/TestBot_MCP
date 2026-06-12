'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const {
  registerExtractor,
  resolveExtractor,
  extractRoleAware,
  filterFilesByExtensions,
  resolveRouteFromPath,
  inferRoleFromTag,
  inferInputRole,
  _resetForTesting,
} = require('../src/source-extractors/role-aware-base');

// Reset extractor registry between tests that modify it
function withCleanRegistry(fn) {
  return async (t) => {
    _resetForTesting();
    try {
      await fn(t);
    } finally {
      _resetForTesting();
    }
  };
}

// ---------------------------------------------------------------------------
// inferRoleFromTag
// ---------------------------------------------------------------------------

test('inferRoleFromTag maps HTML semantic elements', () => {
  assert.equal(inferRoleFromTag('button'), 'button');
  assert.equal(inferRoleFromTag('a'), 'link');
  assert.equal(inferRoleFromTag('img'), 'image');
  assert.equal(inferRoleFromTag('nav'), 'navigation');
  assert.equal(inferRoleFromTag('main'), 'main');
  assert.equal(inferRoleFromTag('header'), 'banner');
  assert.equal(inferRoleFromTag('footer'), 'contentinfo');
  assert.equal(inferRoleFromTag('aside'), 'complementary');
  assert.equal(inferRoleFromTag('select'), 'combobox');
  assert.equal(inferRoleFromTag('textarea'), 'textbox');
});

test('inferRoleFromTag maps heading tags h1-h6', () => {
  for (let i = 1; i <= 6; i++) {
    assert.equal(inferRoleFromTag(`h${i}`), 'heading', `h${i} should be heading`);
  }
});

test('inferRoleFromTag returns null for input (type required)', () => {
  assert.equal(inferRoleFromTag('input'), null);
});

test('inferRoleFromTag handles custom component name patterns', () => {
  // Button patterns: starts with "button" or ends with "button"
  assert.equal(inferRoleFromTag('PrimaryButton'), 'button');
  assert.equal(inferRoleFromTag('IconButton'), 'button');
  assert.equal(inferRoleFromTag('SubmitButton'), 'button');
  // Heading patterns: starts with "heading" or "title"
  assert.equal(inferRoleFromTag('Heading'), 'heading');
  assert.equal(inferRoleFromTag('Title'), 'heading');
  assert.equal(inferRoleFromTag('TitleBar'), 'heading');
  assert.equal(inferRoleFromTag('HeadingOne'), 'heading');
});

test('inferRoleFromTag maps Link design-system component', () => {
  assert.equal(inferRoleFromTag('Link'), 'link');
});

test('inferRoleFromTag maps Checkbox and Radio custom components', () => {
  assert.equal(inferRoleFromTag('Checkbox'), 'checkbox');
  assert.equal(inferRoleFromTag('Radio'), 'radio');
});

test('inferRoleFromTag returns null for unknown tags', () => {
  assert.equal(inferRoleFromTag('div'), null);
  assert.equal(inferRoleFromTag('span'), null);
  assert.equal(inferRoleFromTag('ul'), null);
  assert.equal(inferRoleFromTag('SomeCustomWidget'), null);
});

test('inferRoleFromTag is case-insensitive for HTML tags', () => {
  assert.equal(inferRoleFromTag('BUTTON'), 'button');
  assert.equal(inferRoleFromTag('NAV'), 'navigation');
  assert.equal(inferRoleFromTag('H1'), 'heading');
});

test('inferRoleFromTag returns null for null/empty input', () => {
  assert.equal(inferRoleFromTag(null), null);
  assert.equal(inferRoleFromTag(''), null);
  assert.equal(inferRoleFromTag(undefined), null);
});

// ---------------------------------------------------------------------------
// inferInputRole
// ---------------------------------------------------------------------------

test('inferInputRole maps text input types to textbox', () => {
  const textTypes = ['text', 'email', 'password', 'tel', 'url', 'search', 'number', 'date', 'time', 'datetime-local'];
  for (const t of textTypes) {
    assert.equal(inferInputRole(t), 'textbox', `type=${t} should be textbox`);
  }
});

test('inferInputRole maps checkbox and radio correctly', () => {
  assert.equal(inferInputRole('checkbox'), 'checkbox');
  assert.equal(inferInputRole('radio'), 'radio');
});

test('inferInputRole maps submit/button/reset to button', () => {
  assert.equal(inferInputRole('submit'), 'button');
  assert.equal(inferInputRole('button'), 'button');
  assert.equal(inferInputRole('reset'), 'button');
});

test('inferInputRole maps file to button', () => {
  assert.equal(inferInputRole('file'), 'button');
});

test('inferInputRole maps range to slider', () => {
  assert.equal(inferInputRole('range'), 'slider');
});

test('inferInputRole maps color to textbox', () => {
  assert.equal(inferInputRole('color'), 'textbox');
});

test('inferInputRole returns null for hidden', () => {
  assert.equal(inferInputRole('hidden'), null);
});

test('inferInputRole defaults to textbox for no/unknown type', () => {
  assert.equal(inferInputRole(undefined), 'textbox');
  assert.equal(inferInputRole(''), 'textbox');
  assert.equal(inferInputRole('unknown-type'), 'textbox');
});

test('inferInputRole is case-insensitive', () => {
  assert.equal(inferInputRole('EMAIL'), 'textbox');
  assert.equal(inferInputRole('CHECKBOX'), 'checkbox');
  assert.equal(inferInputRole('Submit'), 'button');
});

// ---------------------------------------------------------------------------
// filterFilesByExtensions
// ---------------------------------------------------------------------------

test('filterFilesByExtensions returns matching files', () => {
  const files = ['app/page.tsx', 'app/layout.ts', 'app/style.css', 'lib/util.js'];
  const result = filterFilesByExtensions(files, ['.tsx', '.ts']);
  assert.deepEqual(result, ['app/page.tsx', 'app/layout.ts']);
});

test('filterFilesByExtensions is case-insensitive', () => {
  const files = ['App.TSX', 'App.jsx'];
  const result = filterFilesByExtensions(files, ['.tsx']);
  assert.equal(result.length, 1);
  assert.equal(result[0], 'App.TSX');
});

test('filterFilesByExtensions returns empty for no match', () => {
  const files = ['a.py', 'b.rb', 'c.go'];
  assert.deepEqual(filterFilesByExtensions(files, ['.tsx', '.jsx']), []);
});

test('filterFilesByExtensions handles empty/null input gracefully', () => {
  assert.deepEqual(filterFilesByExtensions(null, ['.tsx']), []);
  assert.deepEqual(filterFilesByExtensions([], ['.tsx']), []);
  assert.deepEqual(filterFilesByExtensions(['a.tsx'], null), []);
  assert.deepEqual(filterFilesByExtensions(['a.tsx'], []), []);
});

test('filterFilesByExtensions skips non-string file entries', () => {
  const files = ['a.tsx', null, undefined, 42, 'b.tsx'];
  const result = filterFilesByExtensions(files, ['.tsx']);
  assert.deepEqual(result, ['a.tsx', 'b.tsx']);
});

// ---------------------------------------------------------------------------
// resolveRouteFromPath
// ---------------------------------------------------------------------------

test('resolveRouteFromPath returns null when paths are missing', () => {
  assert.equal(resolveRouteFromPath({ projectPath: null, sourceFile: '/a.tsx', framework: 'next' }), null);
  assert.equal(resolveRouteFromPath({ projectPath: '/proj', sourceFile: null, framework: 'next' }), null);
});

test('resolveRouteFromPath resolves Next.js app router file to route', () => {
  const route = resolveRouteFromPath({
    projectPath: '/project',
    sourceFile: '/project/app/dashboard/page.tsx',
    framework: 'next',
  });
  assert.equal(route, '/dashboard');
});

test('resolveRouteFromPath resolves nested Next.js app router route', () => {
  const route = resolveRouteFromPath({
    projectPath: '/project',
    sourceFile: '/project/app/settings/profile/page.tsx',
    framework: 'next',
  });
  assert.equal(route, '/settings/profile');
});

test('resolveRouteFromPath resolves Next.js pages router file to route', () => {
  const route = resolveRouteFromPath({
    projectPath: '/project',
    sourceFile: '/project/pages/about.tsx',
    framework: 'next',
  });
  assert.equal(route, '/about');
});

test('resolveRouteFromPath strips index from pages router', () => {
  const route = resolveRouteFromPath({
    projectPath: '/project',
    sourceFile: '/project/pages/products/index.tsx',
    framework: 'next',
  });
  assert.equal(route, '/products');
});

test('resolveRouteFromPath skips route groups in app router', () => {
  const route = resolveRouteFromPath({
    projectPath: '/project',
    sourceFile: '/project/app/(dashboard)/overview/page.tsx',
    framework: 'next',
  });
  assert.equal(route, '/overview');
});

test('resolveRouteFromPath handles nextjs alias', () => {
  const route = resolveRouteFromPath({
    projectPath: '/project',
    sourceFile: '/project/app/home/page.tsx',
    framework: 'nextjs',
  });
  assert.equal(route, '/home');
});

test('resolveRouteFromPath returns null for vite-react (no convention)', () => {
  const route = resolveRouteFromPath({
    projectPath: '/project',
    sourceFile: '/project/src/pages/Home.tsx',
    framework: 'vite-react',
  });
  assert.equal(route, null);
});

test('resolveRouteFromPath returns null for unknown framework', () => {
  const route = resolveRouteFromPath({
    projectPath: '/project',
    sourceFile: '/project/src/pages/Home.tsx',
    framework: 'unknown-framework',
  });
  assert.equal(route, null);
});

test('resolveRouteFromPath handles src/ prefix in Next.js', () => {
  const route = resolveRouteFromPath({
    projectPath: '/project',
    sourceFile: '/project/src/app/checkout/page.tsx',
    framework: 'next',
  });
  assert.equal(route, '/checkout');
});

// ---------------------------------------------------------------------------
// registerExtractor / resolveExtractor
// ---------------------------------------------------------------------------

test('registerExtractor and resolveExtractor round-trip', withCleanRegistry(() => {
  const mockExtractor = {
    name: 'test-extractor',
    supportedFrameworks: ['test-fw'],
    extract: () => ({ elements: [] }),
  };
  registerExtractor(['test-fw'], mockExtractor);
  assert.equal(resolveExtractor('test-fw'), mockExtractor);
}));

test('resolveExtractor is case-insensitive', withCleanRegistry(() => {
  const mockExtractor = {
    name: 'test-extractor',
    supportedFrameworks: ['MYFX'],
    extract: () => ({ elements: [] }),
  };
  registerExtractor(['MYFX'], mockExtractor);
  assert.equal(resolveExtractor('myfx'), mockExtractor);
  assert.equal(resolveExtractor('MYFX'), mockExtractor);
}));

test('resolveExtractor returns null for unregistered framework', withCleanRegistry(() => {
  assert.equal(resolveExtractor('not-registered'), null);
  assert.equal(resolveExtractor(null), null);
  assert.equal(resolveExtractor(''), null);
}));

test('registerExtractor throws for invalid extractor (no extract fn)', withCleanRegistry(() => {
  assert.throws(() => {
    registerExtractor(['fw'], { name: 'bad' });
  }, /implement extract/i);
}));

test('registerExtractor throws for extractor without name', withCleanRegistry(() => {
  assert.throws(() => {
    registerExtractor(['fw'], { extract: () => {} });
  }, /name/i);
}));

test('registerExtractor can register same extractor for multiple frameworks', withCleanRegistry(() => {
  const ext = { name: 'multi', supportedFrameworks: ['a', 'b'], extract: () => ({ elements: [] }) };
  registerExtractor(['a', 'b'], ext);
  assert.equal(resolveExtractor('a'), ext);
  assert.equal(resolveExtractor('b'), ext);
}));

// ---------------------------------------------------------------------------
// extractRoleAware
// ---------------------------------------------------------------------------

test('extractRoleAware returns supported=false for empty context', withCleanRegistry(() => {
  const result = extractRoleAware(null);
  assert.equal(result.supported, false);
  assert.deepEqual(result.elements, []);
}));

test('extractRoleAware returns supported=false when files is empty', withCleanRegistry(() => {
  const result = extractRoleAware({ projectPath: '/proj', files: [], framework: 'next' });
  assert.equal(result.supported, false);
}));

test('extractRoleAware returns supported=false for unknown framework', withCleanRegistry(() => {
  const result = extractRoleAware({ projectPath: '/proj', files: ['/proj/page.tsx'], framework: 'unknown-fw' });
  assert.equal(result.supported, false);
  assert.ok(result.warning.includes('unknown-fw'));
}));

test('extractRoleAware calls registered extractor and returns elements', withCleanRegistry(() => {
  const fakeElements = [{ role: 'button', accessibleName: 'Test', isDynamic: false, attributes: {}, sourceFile: '/f.tsx', route: null }];
  const ext = {
    name: 'fake-jsx',
    supportedFrameworks: ['fake-fw'],
    extract: () => ({ elements: fakeElements }),
  };
  registerExtractor(['fake-fw'], ext);

  const result = extractRoleAware({ projectPath: '/proj', files: ['/proj/page.tsx'], framework: 'fake-fw' });
  assert.equal(result.supported, true);
  assert.equal(result.extractor, 'fake-jsx');
  assert.equal(result.elements.length, 1);
  assert.equal(result.elements[0].role, 'button');
}));

test('extractRoleAware handles extractor that throws', withCleanRegistry(() => {
  const ext = {
    name: 'throwing-extractor',
    supportedFrameworks: ['crash-fw'],
    extract: () => { throw new Error('Extractor exploded'); },
  };
  registerExtractor(['crash-fw'], ext);

  const result = extractRoleAware({ projectPath: '/proj', files: ['/proj/page.tsx'], framework: 'crash-fw' });
  assert.equal(result.supported, false);
  assert.ok(result.warning.includes('exploded') || result.warning.includes('throwing-extractor'));
}));

test('extractRoleAware handles extractor returning null elements', withCleanRegistry(() => {
  const ext = {
    name: 'null-extractor',
    supportedFrameworks: ['null-fw'],
    extract: () => ({ elements: null }),
  };
  registerExtractor(['null-fw'], ext);

  const result = extractRoleAware({ projectPath: '/proj', files: ['/proj/page.tsx'], framework: 'null-fw' });
  assert.equal(result.supported, true);
  assert.deepEqual(result.elements, []);
}));
