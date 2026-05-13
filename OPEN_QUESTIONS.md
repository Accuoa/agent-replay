# Open Questions

This document is intentionally honest about what's not yet settled.

## Q1: Should `steps[].input` be required or optional?

**Context.** The replayer only needs `input_hash` to verify a step. Including the full `input` makes traces self-describing (humans can read them, diff tools can show field-level changes) but doubles trace size and risks leaking sensitive content (prompts, tool args).

**Options.**
- A: Optional. Recorders MAY omit it for compactness or privacy; default to "included."
- B: Required. Self-describing traces always.
- C: Required for some boundaries (e.g., `tool.*`), optional for others (e.g., `llm.*`).

**Current lean.** A. Defaults to included in v0.1; trace size is acceptable for the toy agent. Privacy-sensitive deployments can omit.

## Q2: How to handle controller non-determinism that is not a "boundary"?

**Context.** Some controllers contain non-determinism that is hard to wrap as a boundary — say, an unstable sort order from an object built up step-by-step. The replayer won't catch this until the next boundary call surfaces an input_hash mismatch, at which point the user sees "input drift" without an obvious cause.

**Options.**
- A: Document the contract clearly (controllers MUST be deterministic given boundary outputs) and trust implementers.
- B: Provide a `replayCheckpoint(name, value)` boundary that records an intermediate-value hash for sanity-checking.
- C: Run the agent twice in record mode and refuse to write a trace if the two runs differ.

**Current lean.** A for v0.1, with B added in v0.2 if the toy-agent test suite shows real cases where developers want a checkpoint.

## Q3: Should boundary identifiers have a normative namespace?

**Context.** Free-form strings like `"llm.decide"` and `"tool.calculator"` are easy but allow collisions. A namespace like `"<vendor>.<resource>.<verb>"` would be more rigorous.

**Options.**
- A: Free-form forever, let conventions emerge.
- B: Recommend a `<resource>.<verb>` convention (informative, not normative).
- C: Normatively specify a namespace registry.

**Current lean.** B for v0.1. The reference implementation uses `<resource>.<verb>` style; spec calls it out as recommended.

## Q4: How does this compose with agent-reputation (Plan 8)?

**Context.** Plan 8 attestations sign a claim "Agent X succeeded at task Y." A replay record is exactly the evidence for that claim.

**Options.**
- A: Document the composition pattern; no normative wire field in v0.1.
- B: Add a normative `metadata.attestation` field in v0.1 that follows the Plan 8 envelope.
- C: Defer entirely until Plan 8 has adoption.

**Current lean.** A. Document in SPEC.md and ARCHITECTURE.md; add the normative envelope in v0.2 once Plan 8 has at least one real attestor in the wild.

## Q5: What's the right granularity for a "step"?

**Context.** A single LLM call could be one step (input → output) or many (one step per streamed token). The toy agent uses single-step per LLM/tool call.

**Options.**
- A: One step per boundary invocation. Atomic.
- B: Allow streaming sub-steps within a step.
- C: Let the recorder configure granularity.

**Current lean.** A in v0.1. Streaming is explicitly out of scope.

**Feedback wanted.** Open an issue or DM.
