import { hashInput } from './hash.mjs';

/**
 * Create a recorder. Returns { boundary, finalize }.
 *
 * - boundary(name, input) async: looks up backends[name], invokes it, appends
 *   a step { step_id, boundary, input_hash, input, output, timestamp }, returns output.
 * - finalize({ output, metadata? }) returns a complete record JSON object.
 *
 * Throws if a boundary is invoked with an unknown name.
 * If the backend throws, the recorder rethrows and does NOT append a step.
 */
export function createRecorder({ agent, input, backends }) {
  const steps = [];
  let nextStepId = 0;
  const traceId = `trace:${agent.name}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;

  async function boundary(name, callInput) {
    const backend = backends?.[name];
    if (typeof backend !== 'function') {
      throw new Error(`recorder: no backend for boundary "${name}"`);
    }
    const input_hash = hashInput(callInput);
    const output = await backend(callInput);
    steps.push({
      step_id: nextStepId++,
      boundary: name,
      input_hash,
      input: callInput,
      output,
      timestamp: new Date().toISOString(),
    });
    return output;
  }

  function finalize({ output, metadata } = {}) {
    const rec = {
      version: '0.1',
      trace_id: traceId,
      agent,
      input,
      steps,
      output,
    };
    if (metadata !== undefined) rec.metadata = metadata;
    return rec;
  }

  return { boundary, finalize };
}
