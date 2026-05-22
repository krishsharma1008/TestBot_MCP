const assert = require('node:assert/strict');
const test = require('node:test');

const ReportGenerator = require('../src/report-generator');

const reporter = new ReportGenerator();

test('categoryFromCatTag reads a11y synonyms', () => {
  assert.equal(reporter.categoryFromCatTag('[CAT:a11y] something'), 'a11y');
  assert.equal(reporter.categoryFromCatTag('[CAT:accessibility] something'), 'a11y');
  assert.equal(reporter.categoryFromCatTag('[CAT:wcag] something'), 'a11y');
  assert.equal(reporter.categoryFromCatTag('[CAT:aria] something'), 'a11y');
});

test('categoryFromCatTag reads authz synonyms', () => {
  assert.equal(reporter.categoryFromCatTag('[CAT:rbac]'), 'authz');
  assert.equal(reporter.categoryFromCatTag('[CAT:api_auth]'), 'authz');
  assert.equal(reporter.categoryFromCatTag('[CAT:authorization]'), 'authz');
  assert.equal(reporter.categoryFromCatTag('[CAT:authz]'), 'authz');
  assert.equal(reporter.categoryFromCatTag('[CAT:permission]'), 'authz');
  assert.equal(reporter.categoryFromCatTag('[CAT:permissions]'), 'authz');
});

test('categoryFromCatTag reads validation synonyms', () => {
  assert.equal(reporter.categoryFromCatTag('[CAT:form_validation]'), 'validation');
  assert.equal(reporter.categoryFromCatTag('[CAT:api_negative]'), 'validation');
  assert.equal(reporter.categoryFromCatTag('[CAT:boundary_validation]'), 'validation');
  assert.equal(reporter.categoryFromCatTag('[CAT:boundary]'), 'validation');
  assert.equal(reporter.categoryFromCatTag('[CAT:input_validation]'), 'validation');
  assert.equal(reporter.categoryFromCatTag('[CAT:validation]'), 'validation');
});

test('categoryFromCatTag reads filter_logic synonyms', () => {
  assert.equal(reporter.categoryFromCatTag('[CAT:filter_logic]'), 'filter_logic');
  assert.equal(reporter.categoryFromCatTag('[CAT:filter]'), 'filter_logic');
  assert.equal(reporter.categoryFromCatTag('[CAT:search]'), 'filter_logic');
  assert.equal(reporter.categoryFromCatTag('[CAT:query]'), 'filter_logic');
  assert.equal(reporter.categoryFromCatTag('[CAT:qac-filter]'), 'filter_logic');
});

test('categoryFromCatTag reads http_contract synonyms', () => {
  assert.equal(reporter.categoryFromCatTag('[CAT:http_contract]'), 'http_contract');
  assert.equal(reporter.categoryFromCatTag('[CAT:contract]'), 'http_contract');
  assert.equal(reporter.categoryFromCatTag('[CAT:status_code]'), 'http_contract');
});

test('categoryFromCatTag api_contract → filter_logic when surrounding text mentions filter/search/query', () => {
  assert.equal(
    reporter.categoryFromCatTag('users search results [CAT:api_contract]'),
    'filter_logic'
  );
  assert.equal(
    reporter.categoryFromCatTag('[CAT:api_contract] filter sort order'),
    'filter_logic'
  );
  assert.equal(
    reporter.categoryFromCatTag('qac-filter check [CAT:api_contract]'),
    'filter_logic'
  );
  assert.equal(
    reporter.categoryFromCatTag('GET /things?query=foo [CAT:api_contract]'),
    'filter_logic'
  );
});

test('categoryFromCatTag api_contract → http_contract otherwise', () => {
  assert.equal(
    reporter.categoryFromCatTag('POST /things returns 201 [CAT:api_contract]'),
    'http_contract'
  );
});

test('categoryFromCatTag returns null when no tag is present', () => {
  assert.equal(reporter.categoryFromCatTag('plain title without any tag'), null);
  assert.equal(reporter.categoryFromCatTag(''), null);
  assert.equal(reporter.categoryFromCatTag('[NOT_CAT:a11y]'), null);
});

test('inferQaCategory reads [CAT:] from test.title', () => {
  assert.equal(
    reporter.inferQaCategory({ title: '[CAT:a11y] aria-label missing on button' }),
    'a11y'
  );
});

test('inferQaCategory reads [CAT:] from test.suite', () => {
  assert.equal(
    reporter.inferQaCategory({ title: 'click submit', suite: '[CAT:authz] admin routes' }),
    'authz'
  );
});

test('inferQaCategory reads [CAT:] from test.body', () => {
  assert.equal(
    reporter.inferQaCategory({ title: 'noop', body: 'await expect(page).toHaveURL(/login/); // [CAT:validation]' }),
    'validation'
  );
});

test('inferQaCategory reads [CAT:] from test.source / snippet / error / errorMessage', () => {
  assert.equal(
    reporter.inferQaCategory({ source: '[CAT:filter_logic] ' }),
    'filter_logic'
  );
  assert.equal(
    reporter.inferQaCategory({ snippet: '/* [CAT:http_contract] */' }),
    'http_contract'
  );
  assert.equal(
    reporter.inferQaCategory({ error: '[CAT:authz] forbidden' }),
    'authz'
  );
  assert.equal(
    reporter.inferQaCategory({ errorMessage: '[CAT:a11y] missing alt text' }),
    'a11y'
  );
});

test('inferQaCategory tag overrides misleading filename', () => {
  // The file path screams "filter" but the [CAT:a11y] tag in the title is authoritative.
  assert.equal(
    reporter.inferQaCategory({
      title: '[CAT:a11y] color contrast on results',
      file: 'tests/generated/filter-results.spec.ts',
    }),
    'a11y'
  );
});

test('fuzzy fallback no longer hijacks a11y tests with the word "validation"', () => {
  // No [CAT:] tag — fuzzy path. Title mentions "validation" but is really an a11y test.
  // a11y is checked FIRST, so aria-label wins over the word "validation".
  assert.equal(
    reporter.inferQaCategory({
      title: 'aria-label present on submit despite client validation hint',
    }),
    'a11y'
  );
});

test('fuzzy fallback no longer matches a11y on the bare word "interactive"', () => {
  // Old behavior matched /interactive/ → a11y. New behavior must not.
  assert.equal(
    reporter.inferQaCategory({ title: 'interactive component renders' }),
    'functional'
  );
});

test('fuzzy fallback still finds real a11y signals', () => {
  assert.equal(
    reporter.inferQaCategory({ title: 'submit has aria-label "Save"' }),
    'a11y'
  );
  assert.equal(
    reporter.inferQaCategory({ title: 'keyboard nav works on modal' }),
    'a11y'
  );
  assert.equal(
    reporter.inferQaCategory({ title: 'wcag color contrast at 4.5:1' }),
    'a11y'
  );
});

test('fuzzy fallback finds authz on 403 / permission denied / forbidden', () => {
  assert.equal(reporter.inferQaCategory({ title: 'returns 403 for non-admin' }), 'authz');
  assert.equal(reporter.inferQaCategory({ title: 'permission denied on /admin' }), 'authz');
  assert.equal(reporter.inferQaCategory({ title: 'forbidden for guest user' }), 'authz');
});

test('fuzzy fallback drops the bare word "validation"', () => {
  // Without one of the tightened signals, a generic "validation" title falls through to functional.
  assert.equal(
    reporter.inferQaCategory({ title: 'data validation passes' }),
    'functional'
  );
});

test('fuzzy fallback finds http_contract on status code language', () => {
  assert.equal(reporter.inferQaCategory({ title: 'POST /things returns 201 response' }), 'http_contract');
  assert.equal(reporter.inferQaCategory({ title: 'content-type header is application/json' }), 'http_contract');
});

test('Headline wi1d5l rollup acceptance: {P0:1, P1:3, P2:4}', () => {
  // 8 synthetic failures matching the wi1d5l shape. The 4 a11y titles deliberately
  // contain the misleading words "filter", "validation", "permission", "interactive".
  const failures = [
    {
      // 1 authz P0
      title: '[CAT:authz] admin-only endpoint accessible to guests',
      file: 'tests/generated/admin-rbac.spec.ts',
    },
    {
      // 1 http_contract P1
      title: '[CAT:http_contract] POST /things returns 200 instead of 201',
      file: 'tests/generated/things-contract.spec.ts',
    },
    {
      // 1 validation P1
      title: '[CAT:validation] required field accepts whitespace-only input',
      file: 'tests/generated/form-validation.spec.ts',
    },
    {
      // 1 filter_logic P1
      title: '[CAT:filter_logic] search results ignore active filter',
      file: 'tests/generated/results-filter.spec.ts',
    },
    {
      // a11y P2 with "filter" in title — must NOT misclassify as filter_logic
      title: '[CAT:a11y] color contrast on filter sidebar fails 4.5:1',
      file: 'tests/generated/results-filter.spec.ts',
    },
    {
      // a11y P2 with "validation" in title — must NOT misclassify as validation
      title: '[CAT:a11y] aria-invalid set when validation fires',
      file: 'tests/generated/form-a11y.spec.ts',
    },
    {
      // a11y P2 with "permission" in title — must NOT misclassify as authz
      title: '[CAT:a11y] screen-reader announces permission dialog',
      file: 'tests/generated/perm-modal-a11y.spec.ts',
    },
    {
      // a11y P2 with "interactive" in title — must NOT default to a11y on bare keyword either
      // but is correctly tagged a11y, so the tag wins.
      title: '[CAT:a11y] keyboard nav on interactive modal',
      file: 'tests/generated/modal-a11y.spec.ts',
    },
  ];

  const rollup = { P0: 0, P1: 0, P2: 0, P3: 0 };
  for (const t of failures) {
    const category = reporter.inferQaCategory(t);
    const severity = reporter.severityForQaCategory(category, t);
    rollup[severity] = (rollup[severity] || 0) + 1;
  }

  assert.deepEqual(
    rollup,
    { P0: 1, P1: 3, P2: 4, P3: 0 },
    `Expected wi1d5l rollup {P0:1,P1:3,P2:4}, got ${JSON.stringify(rollup)}`
  );
});
