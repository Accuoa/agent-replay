import { describe, it, expect } from 'vitest';
import { RecordSchema, parseRecord } from '../src/schema/record.mjs';

const validRecord = {
  version: '0.1',
  trace_id: 'trace:test-1',
  agent: { name: 'toy', version: '1.0' },
  input: { n: 5 },
  steps: [
    {
      step_id: 0,
      boundary: 'llm.decide',
      input_hash: 'sha256:abcdef',
      output: { action: 'compute' },
    },
    {
      step_id: 1,
      boundary: 'tool.calculator',
      input_hash: 'sha256:ghijkl',
      output: { result: 42 },
    },
  ],
  output: { result: 42 },
};

describe('RecordSchema', () => {
  it('accepts a valid record', () => {
    expect(() => parseRecord(validRecord)).not.toThrow();
  });

  it('rejects missing version', () => {
    const bad = { ...validRecord };
    delete bad.version;
    expect(() => parseRecord(bad)).toThrow();
  });

  it('rejects version other than 0.1', () => {
    expect(() => parseRecord({ ...validRecord, version: '0.2' })).toThrow();
  });

  it('accepts empty steps array (agent with no boundary calls)', () => {
    expect(() => parseRecord({ ...validRecord, steps: [] })).not.toThrow();
  });

  it('rejects step with negative step_id', () => {
    const bad = {
      ...validRecord,
      steps: [{ step_id: -1, boundary: 'x', input_hash: 'sha256:y', output: null }],
    };
    expect(() => parseRecord(bad)).toThrow();
  });

  it('rejects step with non-contiguous step_id', () => {
    const bad = {
      ...validRecord,
      steps: [
        { step_id: 0, boundary: 'a', input_hash: 'sha256:1', output: null },
        { step_id: 2, boundary: 'b', input_hash: 'sha256:2', output: null },
      ],
    };
    expect(() => parseRecord(bad)).toThrow(/contiguous/);
  });

  it('rejects step with malformed input_hash', () => {
    const bad = {
      ...validRecord,
      steps: [{ step_id: 0, boundary: 'x', input_hash: 'not-a-hash', output: null }],
    };
    expect(() => parseRecord(bad)).toThrow();
  });

  it('allows steps[].input to be omitted', () => {
    const minimal = {
      ...validRecord,
      steps: validRecord.steps.map(({ input, ...rest }) => rest),
    };
    expect(() => parseRecord(minimal)).not.toThrow();
  });
});
