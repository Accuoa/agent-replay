import { describe, it, expect } from 'vitest';
import { runToyAgent, toyBackends } from '../src/toy-agent.mjs';
import { createRecorder } from '../src/recorder.mjs';
import { createReplayer } from '../src/replayer.mjs';

describe('toy agent', () => {
  it('computes fibonacci(0) = 0', async () => {
    const rec = createRecorder({ agent: { name: 'toy', version: '1.0' }, input: { n: 0 }, backends: toyBackends });
    const out = await runToyAgent({ n: 0 }, rec);
    rec.finalize({ output: out });
    expect(out).toEqual({ fibonacci: 0 });
  });

  it('computes fibonacci(5) = 5', async () => {
    const rec = createRecorder({ agent: { name: 'toy', version: '1.0' }, input: { n: 5 }, backends: toyBackends });
    const out = await runToyAgent({ n: 5 }, rec);
    rec.finalize({ output: out });
    expect(out).toEqual({ fibonacci: 5 });
  });

  it('computes fibonacci(10) = 55', async () => {
    const rec = createRecorder({ agent: { name: 'toy', version: '1.0' }, input: { n: 10 }, backends: toyBackends });
    const out = await runToyAgent({ n: 10 }, rec);
    rec.finalize({ output: out });
    expect(out).toEqual({ fibonacci: 55 });
  });

  it('record + replay round-trip: replay returns the same final output', async () => {
    const rec = createRecorder({ agent: { name: 'toy', version: '1.0' }, input: { n: 7 }, backends: toyBackends });
    const out1 = await runToyAgent({ n: 7 }, rec);
    const record = rec.finalize({ output: out1 });
    const rep = createReplayer(record);
    const out2 = await runToyAgent({ n: 7 }, rep);
    const result = rep.finalize({ output: out2 });
    expect(out2).toEqual(out1);
    expect(result.ok).toBe(true);
    expect(result.drifts).toEqual([]);
  });

  it('emits n+1 llm.decide steps and n tool.calculator steps for fibonacci(n)', async () => {
    const rec = createRecorder({ agent: { name: 'toy', version: '1.0' }, input: { n: 3 }, backends: toyBackends });
    await runToyAgent({ n: 3 }, rec);
    const record = rec.finalize({ output: { fibonacci: 2 } });
    const decideCount = record.steps.filter((s) => s.boundary === 'llm.decide').length;
    const calcCount = record.steps.filter((s) => s.boundary === 'tool.calculator').length;
    expect(decideCount).toBe(4); // n+1
    expect(calcCount).toBe(3);   // n
  });
});
