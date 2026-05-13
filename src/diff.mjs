import { canonicalize } from './canonical.mjs';

/**
 * Compare two records and return the first divergence, or { identical: true }.
 *
 * Divergence kinds: 'input', 'agent', 'step-count', 'step', 'output'.
 * For kind='step', includes index and field ('boundary' | 'input_hash' | 'output').
 */
export function diffRecords(a, b) {
  if (canonicalize(a.agent) !== canonicalize(b.agent)) {
    return {
      identical: false,
      divergence: { kind: 'agent', a_value: a.agent, b_value: b.agent },
    };
  }
  if (canonicalize(a.input) !== canonicalize(b.input)) {
    return {
      identical: false,
      divergence: { kind: 'input', a_value: a.input, b_value: b.input },
    };
  }
  if (a.steps.length !== b.steps.length) {
    return {
      identical: false,
      divergence: { kind: 'step-count', a_value: a.steps.length, b_value: b.steps.length },
    };
  }
  for (let i = 0; i < a.steps.length; i++) {
    const sa = a.steps[i];
    const sb = b.steps[i];
    if (sa.boundary !== sb.boundary) {
      return {
        identical: false,
        divergence: { kind: 'step', index: i, field: 'boundary', a_value: sa.boundary, b_value: sb.boundary },
      };
    }
    if (sa.input_hash !== sb.input_hash) {
      return {
        identical: false,
        divergence: { kind: 'step', index: i, field: 'input_hash', a_value: sa.input_hash, b_value: sb.input_hash },
      };
    }
    if (canonicalize(sa.output) !== canonicalize(sb.output)) {
      return {
        identical: false,
        divergence: { kind: 'step', index: i, field: 'output', a_value: sa.output, b_value: sb.output },
      };
    }
  }
  if (canonicalize(a.output) !== canonicalize(b.output)) {
    return {
      identical: false,
      divergence: { kind: 'output', a_value: a.output, b_value: b.output },
    };
  }
  return { identical: true };
}
