#!/usr/bin/env node
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalize } from '../src/canonical.mjs';
import { createRecorder } from '../src/recorder.mjs';
import { verifyRecord } from '../src/verify.mjs';
import { runToyAgent, toyBackends } from '../src/toy-agent.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');
mkdirSync(DATA_DIR, { recursive: true });

async function recordToy(n) {
  const rec = createRecorder({
    agent: { name: 'toy', version: '1.0' },
    input: { n },
    backends: toyBackends,
  });
  const out = await runToyAgent({ n }, rec);
  return rec.finalize({ output: out });
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

const fixtures = [];

// 1-6: linear (clean)
for (let n = 1; n <= 6; n++) {
  const record = await recordToy(n);
  fixtures.push({ name: `linear-${n}`, record, mode: 'strict' });
}

// 7-12: rerecord (clean, independent recording)
for (let n = 1; n <= 6; n++) {
  const record = await recordToy(n);
  fixtures.push({ name: `rerecord-${n}`, record, mode: 'strict' });
}

// 13-18: mid-tamper
// Mutate the middle step's input_hash so the replayer detects an 'input' drift
// when it re-hashes the live call input and finds a mismatch.
for (let n = 1; n <= 6; n++) {
  const record = await recordToy(n);
  const midIdx = Math.floor(record.steps.length / 2);
  record.steps[midIdx] = deepClone(record.steps[midIdx]);
  record.steps[midIdx].input_hash = record.steps[midIdx].input_hash + '_tampered';
  fixtures.push({ name: `mid-tamper-${n}`, record, mode: 'lenient' });
}

// 19-24: output-tamper
for (let n = 1; n <= 6; n++) {
  const record = await recordToy(n);
  record.output = { fibonacci: 999 };
  fixtures.push({ name: `output-tamper-${n}`, record, mode: 'lenient' });
}

// 25-30: input-tamper
for (let n = 1; n <= 6; n++) {
  const record = await recordToy(n);
  record.input = { n: n + 100 };
  fixtures.push({ name: `input-tamper-${n}`, record, mode: 'lenient' });
}

// Compute expected golden for each
const samples = [];
const expected = [];
for (const f of fixtures) {
  samples.push({ name: f.name, record: f.record, mode: f.mode });
  const result = await verifyRecord(f.record, runToyAgent, { mode: f.mode });
  expected.push({
    name: f.name,
    result: {
      ok: result.ok,
      drifts: result.drifts,
      // observed_output is undefined when the agent threw; normalize to null for valid JSON
      observed_output: result.observed_output ?? null,
    },
  });
}

writeFileSync(
  join(DATA_DIR, 'samples.jsonl'),
  samples.map((s) => canonicalize(s)).join('\n') + '\n',
);
writeFileSync(
  join(DATA_DIR, 'expected.jsonl'),
  expected.map((e) => canonicalize(e)).join('\n') + '\n',
);

console.log(`wrote ${fixtures.length} fixtures to ${DATA_DIR}`);
