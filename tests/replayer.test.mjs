import { describe, it, expect } from 'vitest';
import { hashInput } from '../src/hash.mjs';
import { createReplayer } from '../src/replayer.mjs';

function makeRecord(steps, output = 'done') {
  return {
    version: '0.1',
    trace_id: 'trace:test',
    agent: { name: 'test', version: '1.0' },
    input: {},
    steps,
    output,
  };
}

describe('createReplayer', () => {
  it('serves recorded output when boundary and input_hash match', async () => {
    const rec = makeRecord([
      { step_id: 0, boundary: 'x', input_hash: hashInput({ a: 1 }), output: { result: 'ok' } },
    ]);
    const rep = createReplayer(rec);
    const out = await rep.boundary('x', { a: 1 });
    expect(out).toEqual({ result: 'ok' });
  });

  it('strict: throws on boundary mismatch', async () => {
    const rec = makeRecord([
      { step_id: 0, boundary: 'a', input_hash: hashInput({}), output: null },
    ]);
    const rep = createReplayer(rec);
    await expect(rep.boundary('b', {})).rejects.toThrow(/boundary/);
  });

  it('strict: throws on input_hash mismatch', async () => {
    const rec = makeRecord([
      { step_id: 0, boundary: 'a', input_hash: hashInput({ x: 1 }), output: null },
    ]);
    const rep = createReplayer(rec);
    await expect(rep.boundary('a', { x: 2 })).rejects.toThrow(/input/);
  });

  it('strict: throws on long-replay (more calls than recorded)', async () => {
    const rec = makeRecord([
      { step_id: 0, boundary: 'a', input_hash: hashInput({}), output: null },
    ]);
    const rep = createReplayer(rec);
    await rep.boundary('a', {});
    await expect(rep.boundary('a', {})).rejects.toThrow(/long.?replay/i);
  });

  it('lenient: accumulates drifts without throwing', async () => {
    const rec = makeRecord([
      { step_id: 0, boundary: 'a', input_hash: hashInput({}), output: 'x' },
    ]);
    const rep = createReplayer(rec, { mode: 'lenient' });
    const out = await rep.boundary('b', {}); // boundary drift
    expect(out).toBeNull();
    const result = rep.finalize({ output: 'done' });
    expect(result.drifts.length).toBeGreaterThan(0);
    expect(result.ok).toBe(false);
  });

  it('finalize: returns { ok: true, drifts: [] } when output matches and cursor is at end', async () => {
    const rec = makeRecord([], { final: 42 });
    const rep = createReplayer(rec);
    const result = rep.finalize({ output: { final: 42 } });
    expect(result.ok).toBe(true);
    expect(result.drifts).toEqual([]);
  });

  it('finalize: reports tail-drift when final output differs', async () => {
    const rec = makeRecord([], { final: 42 });
    const rep = createReplayer(rec);
    const result = rep.finalize({ output: { final: 99 } });
    expect(result.ok).toBe(false);
    expect(result.drifts[0].category).toBe('tail');
  });

  it('finalize: reports short-replay when cursor has not reached end', async () => {
    const rec = makeRecord([
      { step_id: 0, boundary: 'a', input_hash: hashInput({}), output: null },
    ]);
    const rep = createReplayer(rec);
    const result = rep.finalize({ output: 'done' });
    expect(result.ok).toBe(false);
    expect(result.drifts.some((d) => d.category === 'short-replay')).toBe(true);
  });
});
