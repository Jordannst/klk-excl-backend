/**
 * Runnable check for invoice noResi duplicate policy.
 *
 * Run: npx ts-node tests/noResiDuplicate.test.ts
 */
import assert from 'node:assert';
import { hasDuplicateNoResiInRequest } from '../src/routes/invoice';

const cases: Array<{ name: string; values: string[]; expected: boolean }> = [
  {
    name: 'allows noResi values that may already exist outside this request',
    values: ['737162', '737157', '737187', '736602'],
    expected: false,
  },
  {
    name: 'blocks duplicate noResi values inside the same invoice request',
    values: ['737162', '737157', '737162'],
    expected: true,
  },
];

let failed = 0;
for (const c of cases) {
  try {
    assert.strictEqual(hasDuplicateNoResiInRequest(c.values), c.expected);
    console.log(`PASS  ${c.name}`);
  } catch (err) {
    failed++;
    console.error(`FAIL  ${c.name}`);
    console.error(`      ${(err as Error).message}`);
  }
}

console.log(`\n${cases.length - failed}/${cases.length} passed`);
if (failed > 0) {
  process.exit(1);
}
