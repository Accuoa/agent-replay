import { createReplayer } from './replayer.mjs';

/**
 * Verify a replay record by re-running the agent under a replayer.
 * Returns { ok, drifts, observed_output }.
 *
 * - record: a parsed replay record (per RecordSchema)
 * - runAgent: async function (input, wrapper) => output; calls wrapper.boundary(name, input)
 * - options.mode: 'strict' (default) or 'lenient'
 */
export async function verifyRecord(record, runAgent, options = {}) {
  const mode = options.mode ?? 'strict';
  const replayer = createReplayer(record, { mode });
  let observed;
  try {
    observed = await runAgent(record.input, replayer);
  } catch (err) {
    return {
      ok: false,
      drifts: [{ category: 'throw', message: String(err.message ?? err) }],
      observed_output: undefined,
    };
  }
  const final = replayer.finalize({ output: observed });
  return { ok: final.ok, drifts: final.drifts, observed_output: observed };
}
