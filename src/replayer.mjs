import { hashInput } from './hash.mjs';
import { canonicalize } from './canonical.mjs';

/**
 * Create a replayer. Returns { boundary, finalize }.
 *
 * Operates in 'strict' (default) or 'lenient' mode. Strict mode throws on
 * first drift; lenient mode accumulates drifts and returns them via finalize.
 *
 * Drift categories: boundary, input, long-replay, short-replay, tail.
 */
export function createReplayer(record, options = {}) {
  const mode = options.mode ?? 'strict';
  if (mode !== 'strict' && mode !== 'lenient') {
    throw new Error(`replayer: unknown mode "${mode}"`);
  }
  const steps = record.steps ?? [];
  let cursor = 0;
  const drifts = [];

  function reportDrift(category, details) {
    const drift = { category, cursor, ...details };
    drifts.push(drift);
    if (mode === 'strict') {
      const msg = `replay drift: ${category} at cursor ${cursor}: ${JSON.stringify(details)}`;
      throw new Error(msg);
    }
  }

  async function boundary(name, callInput) {
    if (cursor >= steps.length) {
      reportDrift('long-replay', { boundary: name });
      return null;
    }
    const expected = steps[cursor];
    const observedHash = hashInput(callInput);
    if (expected.boundary !== name) {
      reportDrift('boundary', {
        expected_boundary: expected.boundary,
        observed_boundary: name,
      });
      cursor++;
      return null;
    }
    if (expected.input_hash !== observedHash) {
      reportDrift('input', {
        boundary: name,
        expected_hash: expected.input_hash,
        observed_hash: observedHash,
      });
      cursor++;
      return null;
    }
    cursor++;
    return expected.output;
  }

  function finalize({ output } = {}) {
    if (cursor < steps.length) {
      drifts.push({
        category: 'short-replay',
        cursor,
        consumed: cursor,
        total: steps.length,
      });
    }
    if (canonicalize(output) !== canonicalize(record.output)) {
      drifts.push({
        category: 'tail',
        expected_output: record.output,
        observed_output: output,
      });
    }
    return { ok: drifts.length === 0, drifts };
  }

  return { boundary, finalize };
}
