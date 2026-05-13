# AgentReplay Architecture

This document describes how the reference implementation is structured and the design decisions behind it. The normative protocol lives in [SPEC.md](./SPEC.md).

## Why this is a primitive, not a product

AgentReplay does not ship an agent framework, a model provider, or a tool runtime. It ships the trace format, the recorder/replayer wrappers, and the verifier. Anyone routing their boundary calls through the wrappers gets replayability — independent of which framework, model, or tools they use.

The product framing is "a primitive that proves a thing is possible." The thing being proven: an agent built with explicit boundary boundaries can be replayed deterministically against a recorded trace, with byte-identical output.

## Goals

1. Deterministic — given the same trace and same controller code, replay produces byte-identical final output and step sequence, every time, across operating systems.
2. Zero external dependencies during replay — no network calls, no service lookups. Boundary outputs are served from the recorded trace.
3. Framework-agnostic — the wrapper interface is a single function `boundary(name, input) → output`. Any code that uses this interface is replayable.
4. Composable with the rest of the Accuoa portfolio (Plan 8 attestations, Plan 9 manifests, Plan 1 memory).

## Components

| Component | Path | Role |
|---|---|---|
| Canonical JSON | `src/canonical.mjs` | RFC 8785 implementation (verbatim reuse from Plan 9) |
| Audit wrapper | `src/audit.mjs` | Network-call detector for the benchmark (verbatim reuse from Plan 9) |
| Hash utility | `src/hash.mjs` | `sha256:<base64url>` of canonical JSON |
| Recorder | `src/recorder.mjs` | `createRecorder()` → `(name, input) → output` wrapper that logs each call |
| Replayer | `src/replayer.mjs` | `createReplayer(record)` → `(name, input) → output` wrapper that consumes the record |
| Schema | `src/schema/record.mjs` | Zod validator for the replay record format |
| Toy agent | `src/toy-agent.mjs` | A small deterministic agent loop that uses a mock LLM + mock calculator tool, demonstrates record/replay end-to-end |
| Verifier | `src/verify.mjs` | Runs an agent in replay mode, compares final output, reports drift |
| Differ | `src/diff.mjs` | Compares two records, reports the first divergent step |
| CLI | `src/cli.mjs` | `agent-replay record\|verify\|diff` |

## Data flow

```
RECORD MODE
  └─ caller invokes toyAgent({ recorder })
  └─ toyAgent calls boundary("llm.decide", { ...input })
      └─ recorder:
          ├─ canonical_hash = sha256:base64url(SHA256(canonical(input)))
          ├─ real_output = actually call the LLM (mock in fixtures)
          ├─ append step { step_id, boundary, input_hash, input, output, timestamp }
          └─ return real_output to toyAgent
  └─ toyAgent continues with output, possibly invokes more boundaries
  └─ toyAgent returns final output
  └─ recorder.finalize({ input, output, agent_meta }) → record JSON
  └─ caller writes record.json

REPLAY MODE
  └─ caller invokes toyAgent({ replayer: createReplayer(record) })
  └─ toyAgent calls boundary("llm.decide", { ...input })
      └─ replayer:
          ├─ canonical_hash = sha256:base64url(SHA256(canonical(input)))
          ├─ peek steps[cursor]
          ├─ if boundary or input_hash mismatches: throw / report drift
          ├─ else: advance cursor, return steps[cursor].output
  └─ toyAgent continues, replayer serves recorded outputs back at each boundary
  └─ toyAgent returns final output
  └─ verifier: compare canonical(actual_output) against canonical(record.output)
  └─ exit 0 on match, non-zero on drift
```

## Determinism guarantees

- All canonical JSON output uses RFC 8785 (UTF-8, sorted keys, no whitespace, normalized numbers).
- The hash is SHA-256 over the canonical bytes, encoded as unpadded base64url.
- The replayer cursor advances monotonically; tie-breaking is not needed because traces are linear.
- Closed wrapper interface — boundary identifiers are strings, inputs are JSON, outputs are JSON. No callbacks, closures, or class instances cross the wrapper.
- The benchmark fixes the FIXED_TIME for any `clock` boundary; the toy agent uses the `clock` boundary instead of `Date.now()`.

## Composition with Plan 8 and Plan 9

**Plan 8 (agent-reputation):** A replay record MAY include `metadata.attestation` containing an Ed25519 signature over the canonical record minus that field. This lets a third party attest "I observed this agent succeed at task X, and here is the byte-identical trace." The reference implementation does not currently sign records; users can compose the two primitives manually. Future v1.1 may add a normative `attestation` envelope.

**Plan 9 (p2p-agent-discovery):** An agent manifest can claim a capability. A replay record demonstrates the agent actually performs that capability. A consumer doing discovery (Plan 9) MAY filter manifests by "has at least N attested replay records" once the composition is wired up.

## Test strategy

- **Unit tests** (`tests/`) for each pure function: canonical, hash, recorder boundary logging, replayer cursor advancement, schema validation, drift category detection.
- **Integration tests** for the toy agent + recorder/replayer round-trip.
- **CLI tests** for `agent-replay record|verify|diff`.
- **Benchmark suite** (`benchmark/`) — 30 fixture records covering: linear traces, branching-via-condition traces, expired-clock traces, drift-detection traces (one record paired with a deliberately-broken replay), output-only traces. Pass = byte-identical replay output across three reruns of every fixture.
- **Calibration script** (`benchmark/calibrate.sh`) — three byte-identical runs of the full benchmark.

## Headline metric

**100% replay fidelity (30/30) — 0 external network calls — Strong band — three byte-identical runs.**

The Strong band requires:
- 30/30 fixture records replay to byte-identical final output and step traces.
- Zero external network calls observed across all benchmark runs (verified by the audit wrapper).
- Three sequential benchmark runs produce byte-identical aggregate output (calibration script enforces this).

## Build / runtime

- Node.js 20+
- Zod (verbatim from Plan 9) for schema validation.
- Native `node:crypto` (`createHash`) for SHA-256. No third-party crypto.
- Vitest for tests.
- Astro for the docs site (existing scaffold under `docs/`).

## Out of scope for v0.1

- Real LLM execution at replay time. Replay always uses recorded outputs.
- Streaming or partial-response replay. Atomic step grain only.
- Branching or non-linear traces. Linear step sequence only.
- Time-travel debugging or interactive replay.
- Compatibility shims with OpenAI Assistants API or Anthropic message format.
- Trace compression / large-input elision.
- Trace signing on the wire (deferred to Plan 8 composition).
