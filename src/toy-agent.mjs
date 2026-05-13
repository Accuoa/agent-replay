/**
 * Toy agent backends. These are the "real" boundary implementations for the
 * toy agent — mock LLM (deterministic state machine) and mock calculator (sum).
 */
export const toyBackends = {
  'llm.decide': async ({ state }) => {
    if (state.remaining > 0) {
      return { action: 'compute', a: state.a, b: state.b };
    }
    return { action: 'done', result: state.a };
  },
  'tool.calculator': async ({ a, b }) => {
    return { sum: a + b };
  },
};

/**
 * Toy agent controller. Computes Fibonacci(n) via the boundary interface.
 *
 * - Calls llm.decide each loop iteration to choose the next action.
 * - Calls tool.calculator to compute the next Fibonacci sum.
 *
 * The controller is deterministic given boundary outputs. Either a recorder or
 * a replayer can be passed in; the controller does not know or care which.
 */
export async function runToyAgent(input, recOrReplayer) {
  let state = { a: 0, b: 1, remaining: input.n };
  while (true) {
    const next = await recOrReplayer.boundary('llm.decide', { state });
    if (next.action === 'done') {
      return { fibonacci: next.result };
    }
    const calc = await recOrReplayer.boundary('tool.calculator', {
      a: state.a,
      b: state.b,
    });
    state = { a: state.b, b: calc.sum, remaining: state.remaining - 1 };
  }
}
