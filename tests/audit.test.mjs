import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAuditedFetch, truncateAuditLog, countExternalCalls } from '../src/audit.mjs';

function makeLogPath() {
  return join(mkdtempSync(join(tmpdir(), 'agent-replay-audit-')), 'audit.jsonl');
}

describe('audit wrapper', () => {
  let logPath;
  beforeEach(() => {
    logPath = makeLogPath();
  });

  it('logs internal calls as internal=true and counts zero external', async () => {
    const fakeFetch = async () => ({ status: 200 });
    const audited = createAuditedFetch({
      logPath,
      internalHosts: ['localhost'],
      baseFetch: fakeFetch,
    });
    await audited('http://localhost/health');
    expect(existsSync(logPath)).toBe(true);
    const lines = readFileSync(logPath, 'utf-8').trim().split('\n').map(JSON.parse);
    expect(lines).toHaveLength(1);
    expect(lines[0].internal).toBe(true);
    expect(countExternalCalls(logPath)).toBe(0);
  });

  it('logs external calls as internal=false and counts them', async () => {
    const fakeFetch = async () => ({ status: 200 });
    const audited = createAuditedFetch({
      logPath,
      internalHosts: ['localhost'],
      baseFetch: fakeFetch,
    });
    await audited('https://example.com/api');
    expect(countExternalCalls(logPath)).toBe(1);
  });

  it('truncateAuditLog empties the file', async () => {
    const fakeFetch = async () => ({ status: 200 });
    const audited = createAuditedFetch({
      logPath,
      internalHosts: [],
      baseFetch: fakeFetch,
    });
    await audited('https://example.com/api');
    truncateAuditLog(logPath);
    expect(countExternalCalls(logPath)).toBe(0);
  });

  it('countExternalCalls returns 0 when log does not exist', () => {
    expect(countExternalCalls('/nonexistent/audit.jsonl')).toBe(0);
  });
});
