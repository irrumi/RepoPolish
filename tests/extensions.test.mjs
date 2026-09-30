import test from 'node:test';
import assert from 'node:assert/strict';
import { quickStartRule } from '../dist/rules/readme-quick-start.js';
import { markdown } from '../dist/markdown.js';

test('example rule keeps presentation advice subjective and language scoped', () => {
  const context = {
    readmePath: 'README.md',
    readme: markdown('# Hello\nIntroduction'),
    language: 'en',
  };
  assert.equal(quickStartRule.check(context)[0].verification, 'inferred');
  assert.equal(quickStartRule.metadata.severity, 'suggestion');
  assert.deepEqual(quickStartRule.check({ ...context, language: 'ru' }), []);
  assert.deepEqual(
    quickStartRule.check({
      ...context,
      readme: markdown('# Hello\n## Examples'),
    }),
    [],
  );
});
