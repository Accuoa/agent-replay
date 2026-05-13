import { describe, it, expect } from 'vitest';
import { runToyAgent, toyBackends } from '../src/toy-agent.mjs';
import { createRecorder } from '../src/recorder.mjs';
import { verifyRecord } from '../src/verify.mjs';

async function recordToy(n) {
  const rec = createRecorder({ agent: { name: 'toy', version: '1.0' }, input: { n }, backends: toyBackends });
  const out = await runToyAgent({ n }, rec);
  return rec.finalize({ output: out });
}

describe('verifyRecord', () => {
  it('returns ok=true for an unmodified record', async () => {
    const record = await recordToy(5);
    const result = await verifyRecord(record, runToyAgent);
    expect(result.ok).toBe(true);
    expect(result.drifts).toEqual([]);
    expect(result.observed_output).toEqual({ fibonacci: 5 });
  });

  it('returns ok=false for a record with a tampered output', async () => {
    const record = await recordToy(5);
    record.output = { fibonacci: 99 };
    const result = await verifyRecord(record, runToyAgent);
    expect(result.ok).toBe(false);
    expect(result.drifts.some((d) => d.category === 'tail')).toBe(true);
  });

  it('returns ok=false for a record with a tampered step output', async () => {
    const record = await recordToy(5);
    record.steps[0].output = { action: 'done', result: 99 };
    const result = await verifyRecord(record, runToyAgent);
    expect(result.ok).toBe(false);
  });

  it('supports lenient mode', async () => {
    const record = await recordToy(3);
    record.output = { fibonacci: 999 };
    const result = await verifyRecord(record, runToyAgent, { mode: 'lenient' });
    expect(result.ok).toBe(false);
    expect(result.drifts.length).toBeGreaterThan(0);
  });
});
