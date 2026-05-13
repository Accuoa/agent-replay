#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyRecord } from '../src/verify.mjs';
import { runToyAgent } from '../src/toy-agent.mjs';
import { canonicalize } from '../src/canonical.mjs';
import { createAuditedFetch, truncateAuditLog, countExternalCalls } from '../src/audit.mjs';
import { score } from './score.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, 'data');
const LOGS = join(dirname(__dirname), 'logs');
mkdirSync(LOGS, { recursive: true });

const SAMPLES = join(DATA, 'samples.jsonl');
const EXPECTED = join(DATA, 'expected.jsonl');
const ACTUAL = join(LOGS, 'actual.jsonl');
const AUDIT = join(LOGS, 'audit.jsonl');

truncateAuditLog(AUDIT);
globalThis.fetch = createAuditedFetch({
  logPath: AUDIT,
  internalHosts: [],
  baseFetch: async () => {
    throw new Error('benchmark runs offline - no fetch allowed');
  },
});

const samples = readFileSync(SAMPLES, 'utf-8').trim().split('\n').map(JSON.parse);

const actualLines = [];
for (const s of samples) {
  const result = await verifyRecord(s.record, runToyAgent, { mode: s.mode });
  // Normalize undefined observed_output to null (canonicalize(undefined) is invalid JSON)
  const observedOutput = result.observed_output === undefined ? null : result.observed_output;
  actualLines.push(
    canonicalize({
      name: s.name,
      result: { ok: result.ok, drifts: result.drifts, observed_output: observedOutput },
    }),
  );
}
writeFileSync(ACTUAL, actualLines.join('\n') + '\n');

const result = score(ACTUAL, EXPECTED);
const external = countExternalCalls(AUDIT);

const report = {
  total: result.total,
  pass: result.pass,
  fail: result.total - result.pass,
  external_network_calls: external,
  failures: result.failures,
};

process.stdout.write(canonicalize(report) + '\n');
process.exit(result.pass === result.total && external === 0 ? 0 : 1);
