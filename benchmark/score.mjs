import { readFileSync } from 'node:fs';
import { canonicalize } from '../src/canonical.mjs';

/**
 * Compare two JSONL files line-by-line. Returns passing/failed counts and
 * the names of any mismatches. The result body is compared via canonical JSON.
 */
export function score(actualPath, expectedPath) {
  const actualLines = readFileSync(actualPath, 'utf-8').trim().split('\n');
  const expectedLines = readFileSync(expectedPath, 'utf-8').trim().split('\n');
  if (actualLines.length !== expectedLines.length) {
    throw new Error(
      `line count mismatch: actual ${actualLines.length} vs expected ${expectedLines.length}`,
    );
  }
  const failures = [];
  let pass = 0;
  for (let i = 0; i < actualLines.length; i++) {
    const a = JSON.parse(actualLines[i]);
    const e = JSON.parse(expectedLines[i]);
    if (a.name !== e.name) {
      failures.push({ index: i, reason: `name mismatch: ${a.name} vs ${e.name}` });
      continue;
    }
    const ac = canonicalize(a.result);
    const ec = canonicalize(e.result);
    if (ac === ec) {
      pass++;
    } else {
      failures.push({ index: i, name: a.name, reason: 'result mismatch' });
    }
  }
  return { total: actualLines.length, pass, failures };
}
