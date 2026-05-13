# AgentReplay — Specification v0.1

## Status

Alpha demo. Subject to change before v1.0. Format is versioned (`"version": "0.1"`) so existing records will continue to verify under future revisions.

## Motivation

Agents are hard to reproduce. The same prompt run twice usually returns different output because the non-determinism lives at the boundaries — the LLM call, the tool call, the clock, the random number generator, the network response. Anyone trying to debug a misbehaving agent or audit one for compliance hits the same wall: the only thing they have is a log of what happened *that* time, and no way to re-run it.

AgentReplay treats those boundaries as first-class. A recorder wraps every external call an agent makes and captures `(canonical(input) → output)` as a trace. A replayer wraps the same boundaries and serves the recorded outputs back in place of the real call. The agent's controller code re-executes unchanged. If the controller is deterministic given its boundary outputs (and most agent controllers are), the replay produces byte-identical final output and a byte-identical step trace.

The protocol does not require a particular agent framework, LLM, or tool runtime. It defines the trace format, the recording protocol, the replay protocol, and the drift semantics. Any code that routes its external calls through the recorder/replayer wrapper is replayable.

## Overview

Two operations on the wire:

**Recording.** An agent runs in record mode. Each boundary call is intercepted: the canonical hash of the input is computed, the real boundary is invoked, the output is captured, and a step is appended to the trace. At the end of the run, the trace is written as a single JSON document.

**Replay.** An agent runs in replay mode against an existing trace. Each boundary call is intercepted: the canonical hash of the input is computed and compared against the next expected step. On match, the recorded output is returned (the real boundary is not invoked). On mismatch, replay drift is reported.

After replay, the final output is canonicalized and compared to the recorded final output. 100% byte-identical match = replay fidelity verified.

## Normative requirements

The keywords MUST, MUST NOT, SHOULD, SHOULD NOT, MAY in this document follow RFC 2119.

### Replay record schema (v0.1)

A replay record MUST be a JSON object with the following fields:

| Field | Type | Required | Notes |
|---|---|---|---|
| `version` | string | yes | MUST be `"0.1"` for this spec revision |
| `trace_id` | string | yes | Free-form identifier; SHOULD be a deterministic function of the run inputs |
| `agent.name` | string | yes | Identifier of the agent that produced the trace |
| `agent.version` | string | yes | Version string of the agent |
| `input` | any JSON value | yes | The initial input passed to the agent |
| `steps` | array | yes | Ordered array of step objects (may be empty) |
| `steps[].step_id` | integer | yes | Zero-based, MUST be strictly increasing and contiguous (0, 1, 2, …) |
| `steps[].boundary` | string | yes | Free-form identifier of the boundary that was invoked (e.g., `"llm.decide"`, `"tool.calculator"`, `"clock"`) |
| `steps[].input_hash` | string | yes | `"sha256:" + base64url(SHA256(canonical(step_input)))` |
| `steps[].input` | any JSON value | no | The full canonical input. MAY be omitted when `input_hash` suffices (for compactness) |
| `steps[].output` | any JSON value | yes | The output the boundary returned. Replayer serves this back during replay |
| `steps[].timestamp` | string | no | ISO-8601 UTC. Informational only; not used for replay |
| `output` | any JSON value | yes | The agent's final output |
| `metadata` | object | no | Free-form. Implementations MAY use this for run-specific context. Not used for replay |

### Canonical input hashing

The `input_hash` MUST be computed as:

```
"sha256:" + base64url(SHA256(canonical(input)))
```

Where `canonical(input)` is RFC 8785 (JCS) canonical JSON: UTF-8 encoding, lexicographically sorted object keys, no insignificant whitespace, numbers in shortest round-trippable form. `base64url(…)` is unpadded base64url (RFC 4648 §5).

### Recording protocol

A conforming recorder MUST:

1. Intercept every boundary call routed through the recorder wrapper.
2. Compute `input_hash` per the canonical hashing rule above.
3. Invoke the real boundary with the canonical input.
4. Append a step `{step_id, boundary, input_hash, input, output, timestamp?}` to the in-progress trace.
5. Return the output to the caller unchanged.

If the boundary throws, the recorder MUST surface the error to the caller and MUST NOT append a step for that call. Partial traces from failed runs are not interchangeable.

### Replay protocol

A conforming replayer MUST:

1. Maintain a cursor over the `steps` array, starting at index 0.
2. Intercept every boundary call routed through the replayer wrapper.
3. Compute `input_hash` of the actual input per the canonical hashing rule.
4. Compare against `steps[cursor]`:
   - If `boundary` and `input_hash` both match: return `steps[cursor].output` to the caller; advance cursor.
   - If either field mismatches: report drift (see Drift semantics).
5. After the agent completes its run, compare the agent's final output to `record.output`:
   - If `canonical(actual_output) == canonical(record.output)`: replay fidelity is **verified**.
   - Else: report a tail-drift (final output differs).
6. If the cursor has not reached the end of `steps` after the agent completes, report a short-replay drift (the agent invoked fewer boundary calls than recorded).

### Drift semantics

The replayer operates in one of two modes:

- **Strict mode (default).** On the first drift, replay halts and exits non-zero. The replayer MUST identify the cursor index, the expected `(boundary, input_hash)`, and the observed `(boundary, input_hash)`.
- **Lenient mode (opt-in).** Replay continues past drift; each drift is appended to a divergence report. The replayer exits zero if and only if no drifts were recorded.

Drift categories:

| Category | Trigger |
|---|---|
| Boundary drift | `steps[cursor].boundary` ≠ observed boundary identifier |
| Input drift | `steps[cursor].input_hash` ≠ observed input hash |
| Output drift | Returning recorded output produces a different downstream input than expected (only detected at the next step, surfaces as input drift there) |
| Short-replay drift | Agent finishes before all recorded steps are consumed |
| Long-replay drift | Agent invokes a boundary after all recorded steps are consumed |
| Tail drift | Final agent output ≠ recorded final output |

### Determinism contract

A trace is replayable if and only if the agent's controller code is deterministic given the boundary outputs. The contract on the implementer:

- All non-deterministic operations MUST be routed through a boundary wrapper. This includes (but is not limited to): LLM calls, tool calls, HTTP requests, file reads/writes, the current time (wrap as `clock`), random number generation (wrap as `random`), environment variable reads (wrap as `env`).
- Controller code MUST NOT call `Date.now()`, `Math.random()`, or `process.env` directly. Use the wrapped equivalents.
- Boundary outputs MUST be serializable JSON values. Outputs containing functions, symbols, or circular references are not replayable.

Implementations SHOULD provide lint rules or runtime guards that flag direct non-deterministic calls. The reference implementation includes a minimal example.

### Error handling

| Failure | Behavior |
|---|---|
| Malformed record JSON | Caller-side error, exit non-zero, identify the bad file |
| Record fails schema | Caller-side error, exit non-zero |
| Drift during strict replay | Exit non-zero, report category + cursor + expected vs. observed |
| Drift during lenient replay | Continue; cumulative drift count is the exit code (capped at 255) |
| Recorder boundary throws | Surface to caller; do not append a step; partial trace is not emitted |

## Test vectors

The reference implementation ships 30 recorded sessions of a toy agent under [benchmark/data/](./benchmark/data/) along with golden replay outputs. Each fixture covers a specific replay scenario (linear, branching-via-condition, expired-clock, drift-detection, output-only).

## Reference implementation

A minimal Node.js reference implementation lives in [src/](./src/) with the CLI exposed as `agent-replay record|verify|diff`. See [USAGE.md](./USAGE.md) and [examples/](./examples/).

## Composition with the rest of the portfolio

- **agent-reputation (Plan 8).** A trace MAY carry a signed attestation that the trace is an honest record of an actual run. The signature lives in `metadata.attestation`, follows the agent-reputation Ed25519 envelope, and signs the canonical record minus `metadata.attestation`. Optional in v0.1.
- **p2p-agent-discovery (Plan 9).** A trace MAY be used as evidence of a capability claim in a published agent manifest. The composition pattern is documented in [ARCHITECTURE.md](./ARCHITECTURE.md); no normative wire field in v0.1.
- **memorystore (Plan 1).** Memory reads/writes are boundaries — replay-able like any other.

## Open questions

See [OPEN_QUESTIONS.md](./OPEN_QUESTIONS.md).

## Changelog

- v0.1 — initial draft (2026-05-13)
