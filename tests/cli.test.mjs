import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const CLI = join(process.cwd(), 'src', 'cli.mjs');
const TOY_AGENT = join(process.cwd(), 'src', 'toy-agent-cli-adapter.mjs');

function runCli(args, opts = {}) {
  return execFileSync('node', [CLI, ...args], { encoding: 'utf-8', ...opts });
}

describe('cli: record + verify + diff (end-to-end)', () => {
  let tmp;
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'agent-replay-cli-'));
  });

  it('record produces a valid record on stdout', () => {
    const inputPath = join(tmp, 'input.json');
    writeFileSync(inputPath, JSON.stringify({ n: 5 }));
    const out = runCli(['record', TOY_AGENT, inputPath]);
    const rec = JSON.parse(out);
    expect(rec.version).toBe('0.1');
    expect(rec.output).toEqual({ fibonacci: 5 });
    expect(rec.steps.length).toBeGreaterThan(0);
  });

  it('verify exits 0 on a valid record', () => {
    const inputPath = join(tmp, 'input.json');
    writeFileSync(inputPath, JSON.stringify({ n: 5 }));
    const out = runCli(['record', TOY_AGENT, inputPath]);
    const recPath = join(tmp, 'rec.json');
    writeFileSync(recPath, out);
    const verifyOut = runCli(['verify', TOY_AGENT, recPath]);
    expect(verifyOut).toContain('ok');
  });

  it('verify exits non-zero on a tampered record', () => {
    const inputPath = join(tmp, 'input.json');
    writeFileSync(inputPath, JSON.stringify({ n: 5 }));
    const recRaw = runCli(['record', TOY_AGENT, inputPath]);
    const rec = JSON.parse(recRaw);
    rec.output = { fibonacci: 999 };
    const recPath = join(tmp, 'rec.json');
    writeFileSync(recPath, JSON.stringify(rec));
    let err;
    try {
      runCli(['verify', TOY_AGENT, recPath]);
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.status).not.toBe(0);
  });

  it('diff exits 0 on identical records', () => {
    const inputPath = join(tmp, 'input.json');
    writeFileSync(inputPath, JSON.stringify({ n: 3 }));
    const rec = runCli(['record', TOY_AGENT, inputPath]);
    const aPath = join(tmp, 'a.json');
    const bPath = join(tmp, 'b.json');
    writeFileSync(aPath, rec);
    writeFileSync(bPath, rec);
    const out = runCli(['diff', aPath, bPath]);
    expect(out).toContain('identical');
  });

  it('diff exits non-zero on divergent records', () => {
    const inputPath = join(tmp, 'input.json');
    writeFileSync(inputPath, JSON.stringify({ n: 3 }));
    const recA = runCli(['record', TOY_AGENT, inputPath]);
    const parsed = JSON.parse(recA);
    parsed.output = { fibonacci: 999 };
    const aPath = join(tmp, 'a.json');
    const bPath = join(tmp, 'b.json');
    writeFileSync(aPath, recA);
    writeFileSync(bPath, JSON.stringify(parsed));
    let err;
    try {
      runCli(['diff', aPath, bPath]);
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.status).not.toBe(0);
  });
});
