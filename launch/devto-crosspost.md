---
title: "Record your agent. Replay byte-identical, every time."
published: false
description: "A primitive for deterministic agent replay. Wrap your boundary calls in the recorder, get back a portable trace. Replay it and the agent re-executes against the recorded outputs."
canonical_url: https://accuoa.github.io/agent-replay/launch
tags: ai, agents, opensource, debugging
---

## Why I built this

A few months back I was trying to reproduce a bug in an agent that had run two days earlier in production. Same prompt, same input data. Different output, every time I tried to reproduce it. The agent was making LLM calls (non-deterministic by default), reading the clock (different every call), and calling a tool that hit a third-party API whose response had drifted. Three sources of non-determinism, zero of them isolated.

What I wanted was a way to say: "here is the trace of what actually happened that day — re-run the agent's logic against this recorded trace and tell me if my fix changes anything." Not a debugger, not a profiler — just a way to make agent runs reproducible after the fact. The pieces I needed existed (hashing inputs, mocking boundaries) but they weren't packaged as a primitive anyone could pick up and use.

`agent-replay` is that primitive. Wrap your boundary calls in the recorder, get a portable trace. Replay the trace and the agent re-executes against the recorded outputs — byte-identical final output, byte-identical step sequence. The reference implementation includes a tiny toy agent (Fibonacci) and a 30-fixture benchmark that locks 100% replay fidelity in three byte-identical runs.

## What's broken today

Agent non-determinism is the default, not the exception. An agent that touches an LLM, reads the system clock, generates a random value, or calls any external API is non-deterministic in at least one dimension. In practice, production agents are non-deterministic in three or more.

The three core sources are unavoidable: **LLM sampling** (temperature > 0 means different tokens every run), **clock and random** (time-based IDs, random seeds, jitter), and **network** (API responses drift, rate-limit behavior changes, third-party state evolves). None of these is wrong — they're necessary. But zero of them are isolated by default, and that isolation is what reproducibility requires.

Current approaches fall into two camps. Logging captures what happened but can't replay it — you get a record, not a runnable trace. Deterministic re-run attempts (fixed seed, replayed prompt) only control the inputs you thought of; the sources you missed still fire live. Screen-capture and session recording tools work at the UI layer and can't reconstruct the agent's internal step sequence.

None of these gives you: "re-run the agent's logic exactly as it ran on Tuesday, verify my fix, without touching any live service."

The result is that debugging a production agent today means running it again and hoping the non-determinism doesn't matter. Auditing a production run means trusting logs that were written by the same process that had the bug. Neither is good enough as agents move into regulated and high-stakes environments.

## Spec walkthrough

The spec defines two operations and one portable document format.

**The Replay Record** is a JSON document containing everything needed to replay an agent run. Its top-level fields are `version`, `trace_id`, an `agent` block (name and version), `input` (the initial agent input), `steps` (ordered array of boundary invocations), `output` (the agent's final output), and an optional `metadata` block. The record is self-contained — no external store, no live service required at replay time.

Each step in the `steps` array carries:
- `step_id` — zero-based, strictly increasing
- `boundary` — free-form identifier (e.g. `"llm.decide"`, `"tool.calculator"`, `"clock"`)
- `input_hash` — `"sha256:" + base64url(SHA256(canonical(input)))` per RFC 8785 JCS
- `input` — optional; full canonical input for readability
- `output` — the value the replayer will serve back

A minimal record looks like this:

```json
{
  "version": "0.1",
  "trace_id": "fib-run-001",
  "agent": { "name": "fibonacci-agent", "version": "0.1.0" },
  "input": { "n": 7 },
  "steps": [
    {
      "step_id": 0,
      "boundary": "llm.decide",
      "input_hash": "sha256:X3cQ7vA2mNp...",
      "input": { "prompt": "compute fib(7)" },
      "output": { "choice": "recurse", "next_n": 6 }
    }
  ],
  "output": { "result": 13 }
}
```

**The recording protocol** has five steps: (1) hash the agent's input, (2) for each boundary call — any call that is non-deterministic or has external effects — intercept before it fires, invoke the real boundary, record the input hash and the live response, advance the step cursor, (3) capture the agent's final output, (4) assemble the replay record, (5) emit to a portable JSON file. If a boundary throws, the recorder surfaces the error to the caller and does not append a step — partial traces from failed runs are not replayable.

**The replay protocol** has six steps: (1) load the replay record, (2) hash the agent's current input and assert it matches the recorded `input_hash`, (3) initialize the step cursor at zero, (4) for each boundary call, intercept it, assert the input hash matches the recorded step at cursor, return the recorded output without firing the real call, advance the cursor, (5) assert cursor equals total step count, (6) assert the agent's final output matches the recorded output byte-for-byte.

The spec defines **six drift categories** that replay can detect and report:

| Category | Trigger |
|---|---|
| Boundary drift | Observed boundary identifier ≠ expected |
| Input drift | Observed input hash ≠ expected |
| Output drift | Recorded output produces a different downstream input (surfaces at next step as input drift) |
| Short-replay drift | Agent finishes before all recorded steps are consumed |
| Long-replay drift | Agent invokes a boundary after all recorded steps are consumed |
| Tail drift | Final agent output ≠ recorded final output |

In **strict mode** (default), the first drift halts replay and exits non-zero. In **lenient mode** (opt-in), replay continues and produces a cumulative drift report.

The **determinism contract** is on the implementer: all non-deterministic operations MUST be routed through a boundary wrapper. This includes LLM calls, tool calls, HTTP requests, file reads/writes, `Date.now()`, `Math.random()`, and environment variable reads. Pure computation — sorting, hashing, arithmetic — is never a boundary. If a non-deterministic call is made outside a wrapper, replay will silently diverge. The spec lists minimum required boundaries explicitly.

## The numbers

The benchmark runs 30 hand-built fixtures across five categories: linear (happy-path record and replay), rerecord (re-recording produces an identical trace), mid-tamper (a step's recorded output is modified), output-tamper (the final output field is modified), and input-tamper (the initial input hash is modified). Every fixture is labeled; expected behavior — pass or specific drift category — is declared alongside input.

Network footprint is audited rather than mocked. The benchmark wraps Node.js `http` and `https` and logs every outbound call to `logs/network.jsonl`. The final assertion is that the log is empty. It is.

Determinism is verified by running the engine three times with identical inputs and comparing outputs byte-for-byte. All three runs produce identical results. The locked SHA-256 of all three runs is:

```
7C0BF8021A4FC922F4594523202522A917CC963CBB660DE2016F98DC8DB2D8D7
```

"Strong band" requires 100% fidelity across all five categories, zero external calls, and three byte-identical runs. The 30-fixture count is honest — it is not a massive corpus. But the methodology is: every fixture is hand-built, every category is labeled, the output is deterministic, and you can reproduce it with nothing beyond `node`.

## Try it

Clone and run the full cycle:

```bash
# Clone and install
git clone https://github.com/Accuoa/agent-replay
cd agent-replay && npm install

# Record a run
agent-replay record src/toy-agent-cli-adapter.mjs examples/input-fibonacci.json > rec.json

# Verify replay fidelity
agent-replay verify src/toy-agent-cli-adapter.mjs rec.json

# Diff two records
agent-replay diff rec.json rec-modified.json
```

Or run the one-liner that installs, runs the test suite (57/57), runs the benchmark (30/30), and runs calibration:

```bash
bash full-cycle.sh
```

Expected final output: Strong band, SHA-256 matching the locked value above.

## Limitations

Several things are deliberately out of scope for v0.1:

- **No real LLM at replay time.** The reference implementation uses a toy Fibonacci agent; adapting to a real LLM adapter is left to the implementer.
- **Steps are atomic.** Partial or streaming boundary calls are not supported.
- **Traces are linear.** Branching or parallel step sequences are not represented.
- **No streaming output.** Tokens as they arrive are not captured at the boundary level.
- **No format compatibility.** No compatibility with OpenAI Assistants thread format or LangChain trace format.
- **No record signing.** Key rotation and record signing are tracked as v0.2 candidates via agent-reputation composition.

All of these are tracked in [OPEN_QUESTIONS.md](https://github.com/Accuoa/agent-replay/blob/main/OPEN_QUESTIONS.md).

## What's next

AgentReplay composes directly with three other projects in the portfolio.

**With agent-reputation (Plan 8).** Replay records become signed attestation evidence — a verifier can replay the trace and confirm the signature matches, giving reputation scores that are grounded in reproducible execution rather than self-report. The composition is documented in ARCHITECTURE.md; the normative `metadata.attestation` field is a v0.2 candidate once agent-reputation has at least one real attestor.

**With p2p-agent-discovery (Plan 9).** A manifest can carry an `execution_evidence` field linking to a replay record, so consumers can inspect a verifiable trace before deciding to invoke an agent. Discovery finds agents by what they claim to do; a replay record is the evidence backing that claim.

**With memorystore (Plan 1).** Memory reads and writes are boundaries — replayable like any other. Once memory operations are routed through the recorder protocol, memory-backed agents become fully replayable with no special casing.

Likely v0.2 candidates: record signing via agent-reputation's Ed25519 scheme, a standard `attestation_ref` field on replay records, parallel step support, and a streaming boundary protocol. Weigh in on priorities in [OPEN_QUESTIONS.md](https://github.com/Accuoa/agent-replay/blob/main/OPEN_QUESTIONS.md).

---

GitHub repo + full spec: [github.com/Accuoa/agent-replay](https://github.com/Accuoa/agent-replay)

Normative spec: [SPEC.md](https://github.com/Accuoa/agent-replay/blob/main/SPEC.md)

Open design questions: [OPEN_QUESTIONS.md](https://github.com/Accuoa/agent-replay/blob/main/OPEN_QUESTIONS.md)
