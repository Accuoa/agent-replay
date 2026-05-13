#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRecorder } from './recorder.mjs';
import { verifyRecord } from './verify.mjs';
import { diffRecords } from './diff.mjs';
import { canonicalize } from './canonical.mjs';
import { parseRecord } from './schema/record.mjs';

const args = process.argv.slice(2);

function fail(msg, code = 1) {
  process.stderr.write(`error: ${msg}\n`);
  process.exit(code);
}

async function importAgent(agentPath) {
  const abs = resolve(agentPath);
  const url = pathToFileURL(abs).href;
  const mod = await import(url);
  if (typeof mod.runAgent !== 'function') {
    fail(`agent at ${agentPath} does not export runAgent`);
  }
  if (typeof mod.backends !== 'object' || mod.backends === null) {
    fail(`agent at ${agentPath} does not export backends`);
  }
  const meta = mod.default ?? { name: 'unknown', version: '0.0.0' };
  return { runAgent: mod.runAgent, backends: mod.backends, meta };
}

async function cmdRecord(agentPath, inputPath) {
  if (!agentPath || !inputPath) fail('record requires <agent.mjs> <input.json>');
  const { runAgent, backends, meta } = await importAgent(agentPath);
  let input;
  try {
    input = JSON.parse(readFileSync(inputPath, 'utf-8'));
  } catch (e) {
    fail(`could not parse input: ${e.message}`);
  }
  const recorder = createRecorder({ agent: meta, input, backends });
  const output = await runAgent(input, recorder);
  const record = recorder.finalize({ output });
  process.stdout.write(canonicalize(record) + '\n');
}

async function cmdVerify(agentPath, recordPath) {
  if (!agentPath || !recordPath) fail('verify requires <agent.mjs> <record.json>');
  const { runAgent } = await importAgent(agentPath);
  let record;
  try {
    record = parseRecord(JSON.parse(readFileSync(recordPath, 'utf-8')));
  } catch (e) {
    fail(`could not read or parse record: ${e.message}`);
  }
  const result = await verifyRecord(record, runAgent);
  process.stdout.write(canonicalize({ ok: result.ok, drifts: result.drifts }) + '\n');
  if (!result.ok) process.exit(2);
}

function cmdDiff(aPath, bPath) {
  if (!aPath || !bPath) fail('diff requires <a.json> <b.json>');
  let a, b;
  try {
    a = JSON.parse(readFileSync(aPath, 'utf-8'));
    b = JSON.parse(readFileSync(bPath, 'utf-8'));
  } catch (e) {
    fail(`could not read or parse record: ${e.message}`);
  }
  const result = diffRecords(a, b);
  if (result.identical) {
    process.stdout.write('identical\n');
    return;
  }
  process.stdout.write(canonicalize(result) + '\n');
  process.exit(2);
}

async function main() {
  const [cmd, ...rest] = args;
  if (cmd === 'record') return cmdRecord(rest[0], rest[1]);
  if (cmd === 'verify') return cmdVerify(rest[0], rest[1]);
  if (cmd === 'diff') return cmdDiff(rest[0], rest[1]);
  fail(`unknown command: ${args.join(' ')}`);
}

await main();
