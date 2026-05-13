# Twitter / X thread — AgentReplay launch

## 1/

100% replay fidelity (30/30) — 0 external network calls — Strong band — 3 byte-identical runs.

New: agent-replay — a primitive for deterministic agent replay. Wrap your boundary calls; replay byte-identical. ↓

## 2/

The problem: you can't reproduce a production agent bug.

Same prompt, same input. Different output every time — because LLM sampling, the clock, and third-party APIs are all non-deterministic. And none of them are isolated.

## 3/

agent-replay treats those boundaries as first-class.

A recorder wraps every external call and captures (input → output) as a step. A replayer serves the recorded outputs back. The agent's logic re-executes unchanged — no live calls.

## 4/

The Replay Record is a portable JSON document: trace_id, agent name/version, initial input, ordered steps, final output.

Each step: boundary name + sha256 input hash + recorded output. Self-contained. Everything needed for replay lives inside the file.

## 5/

Canonical input hashing: SHA256 over RFC 8785 JCS (sorted keys, no whitespace, shortest numbers).

Same input → same hash, always. That's what makes step matching deterministic — the replayer asserts hash equality, not value equality.

## 6/

Six drift categories the replayer can catch: boundary drift, input drift, output drift, short-replay, long-replay, tail drift.

Strict mode halts on first drift. Lenient mode collects all drifts and reports at the end.

## 7/

Benchmark: 30 fixtures × 5 categories (linear, rerecord, mid-tamper, output-tamper, input-tamper).

Network audited via fetch wrapper — not mocked. 0 external calls. 3 byte-identical runs. SHA256: 7C0BF802... Strong band.

## 8/

Try it:

agent-replay record toy-agent.mjs input.json > rec.json
agent-replay verify toy-agent.mjs rec.json
agent-replay diff rec.json rec-modified.json

Or: bash full-cycle.sh — installs, tests (57/57), benchmark (30/30), calibration.

## 9/

Composes with the portfolio:

Plan 8 (agent-reputation): replay records → signed attestation evidence.
Plan 9 (p2p-agent-discovery): manifest carries execution_evidence linking to a replay record.
Plan 1 (memorystore): memory reads are boundaries — replayable like any other.

## 10/

Spec, reference impl, 30-fixture benchmark, full-cycle:
https://github.com/Accuoa/agent-replay

Apache-2.0. Open questions + v0.2 candidates:
https://github.com/Accuoa/agent-replay/blob/main/OPEN_QUESTIONS.md
