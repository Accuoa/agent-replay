import { describe, it, expect } from 'vitest';
import { createRecorder } from '../src/recorder.mjs';

describe('createRecorder', () => {
  it('records a single boundary call with input_hash and output', async () => {
    const backends = { 'tool.x': async (input) => ({ doubled: input.n * 2 }) };
    const rec = createRecorder({
      agent: { name: 'test', version: '1.0' },
      input: { initial: 1 },
      backends,
    });
    const out = await rec.boundary('tool.x', { n: 5 });
    expect(out).toEqual({ doubled: 10 });
    const record = rec.finalize({ output: { final: 10 } });
    expect(record.steps).toHaveLength(1);
    expect(record.steps[0].step_id).toBe(0);
    expect(record.steps[0].boundary).toBe('tool.x');
    expect(record.steps[0].input_hash).toMatch(/^sha256:/);
    expect(record.steps[0].output).toEqual({ doubled: 10 });
  });

  it('records multiple boundary calls in order', async () => {
    const backends = {
      'a': async (i) => ({ a: i.x }),
      'b': async (i) => ({ b: i.y }),
    };
    const rec = createRecorder({
      agent: { name: 'test', version: '1.0' },
      input: {},
      backends,
    });
    await rec.boundary('a', { x: 1 });
    await rec.boundary('b', { y: 2 });
    const record = rec.finalize({ output: 'done' });
    expect(record.steps.map((s) => s.boundary)).toEqual(['a', 'b']);
    expect(record.steps.map((s) => s.step_id)).toEqual([0, 1]);
  });

  it('returns the backend output unchanged to the caller', async () => {
    const backends = { 'x': async () => ({ deep: { nested: 42 } }) };
    const rec = createRecorder({
      agent: { name: 'test', version: '1.0' },
      input: {},
      backends,
    });
    const out = await rec.boundary('x', {});
    expect(out).toEqual({ deep: { nested: 42 } });
  });

  it('surfaces backend errors and does not append a step', async () => {
    const backends = {
      'broken': async () => {
        throw new Error('boom');
      },
    };
    const rec = createRecorder({
      agent: { name: 'test', version: '1.0' },
      input: {},
      backends,
    });
    await expect(rec.boundary('broken', {})).rejects.toThrow('boom');
    const record = rec.finalize({ output: 'partial' });
    expect(record.steps).toEqual([]);
  });

  it('throws on unknown boundary', async () => {
    const rec = createRecorder({
      agent: { name: 'test', version: '1.0' },
      input: {},
      backends: {},
    });
    await expect(rec.boundary('unknown', {})).rejects.toThrow(/no backend/);
  });

  it('finalize emits a record with version 0.1 and the agent metadata', async () => {
    const rec = createRecorder({
      agent: { name: 'myagent', version: '2.0' },
      input: { hello: 'world' },
      backends: {},
    });
    const record = rec.finalize({ output: { done: true } });
    expect(record.version).toBe('0.1');
    expect(record.agent).toEqual({ name: 'myagent', version: '2.0' });
    expect(record.input).toEqual({ hello: 'world' });
    expect(record.output).toEqual({ done: true });
    expect(record.trace_id).toBeDefined();
  });
});
