import { describe, it, expect } from 'vitest';
import { diffRecords } from '../src/diff.mjs';
import { hashInput } from '../src/hash.mjs';

function rec(steps, output = 'done') {
  return {
    version: '0.1',
    trace_id: 'trace:test',
    agent: { name: 'test', version: '1.0' },
    input: {},
    steps,
    output,
  };
}

describe('diffRecords', () => {
  it('returns identical for byte-identical records', () => {
    const a = rec([{ step_id: 0, boundary: 'x', input_hash: hashInput({}), output: 1 }]);
    const b = rec([{ step_id: 0, boundary: 'x', input_hash: hashInput({}), output: 1 }]);
    expect(diffRecords(a, b).identical).toBe(true);
  });

  it('detects input divergence', () => {
    const a = rec([], 'x');
    a.input = { n: 1 };
    const b = rec([], 'x');
    b.input = { n: 2 };
    const result = diffRecords(a, b);
    expect(result.identical).toBe(false);
    expect(result.divergence.kind).toBe('input');
  });

  it('detects step-count divergence', () => {
    const a = rec([{ step_id: 0, boundary: 'a', input_hash: hashInput({}), output: 1 }]);
    const b = rec([]);
    const result = diffRecords(a, b);
    expect(result.identical).toBe(false);
    expect(result.divergence.kind).toBe('step-count');
  });

  it('detects step-boundary divergence and reports index', () => {
    const a = rec([
      { step_id: 0, boundary: 'a', input_hash: hashInput({}), output: 1 },
      { step_id: 1, boundary: 'b', input_hash: hashInput({}), output: 2 },
    ]);
    const b = rec([
      { step_id: 0, boundary: 'a', input_hash: hashInput({}), output: 1 },
      { step_id: 1, boundary: 'c', input_hash: hashInput({}), output: 2 },
    ]);
    const result = diffRecords(a, b);
    expect(result.identical).toBe(false);
    expect(result.divergence.kind).toBe('step');
    expect(result.divergence.index).toBe(1);
    expect(result.divergence.field).toBe('boundary');
  });

  it('detects step-input_hash divergence', () => {
    const a = rec([{ step_id: 0, boundary: 'a', input_hash: hashInput({ x: 1 }), output: 1 }]);
    const b = rec([{ step_id: 0, boundary: 'a', input_hash: hashInput({ x: 2 }), output: 1 }]);
    const result = diffRecords(a, b);
    expect(result.divergence.field).toBe('input_hash');
  });

  it('detects step-output divergence', () => {
    const a = rec([{ step_id: 0, boundary: 'a', input_hash: hashInput({}), output: 1 }]);
    const b = rec([{ step_id: 0, boundary: 'a', input_hash: hashInput({}), output: 2 }]);
    const result = diffRecords(a, b);
    expect(result.divergence.field).toBe('output');
  });

  it('detects final-output divergence', () => {
    const a = rec([], { final: 1 });
    const b = rec([], { final: 2 });
    const result = diffRecords(a, b);
    expect(result.divergence.kind).toBe('output');
  });
});
