# Community post — HackerNews Show HN

> Channel: HackerNews Show HN
> Audience: working engineers building agent systems
> Tone: technical, no marketing fluff

---

**Show HN: agent-replay — deterministic replay for agents (30/30 fidelity, 0 network calls)**

https://github.com/Accuoa/agent-replay

---

The practical problem: you have an agent that misbehaved in production two days ago. You have logs. You do not have a way to re-run the agent's logic against what actually happened and verify that your fix changes anything — because the LLM sampling, the clock, and the third-party API calls are all live. Run it again and you get a different execution path.

agent-replay is a primitive that addresses this at the boundary level. Instead of trying to control the agent's environment, you record every call that crosses a non-deterministic boundary (LLM calls, clock reads, HTTP requests, random reads) as a step in a portable JSON trace. On replay, the replayer intercepts the same boundary calls and serves the recorded outputs back without touching any live service. The agent's controller code re-executes unchanged.

If the controller is deterministic given its boundary outputs — and most agent controllers are, because they're just code — the replay produces byte-identical final output and a byte-identical step sequence.

**The trace format** is a JSON document: `version`, `trace_id`, an `agent` block, `input`, an ordered `steps` array, and `output`. Each step carries a boundary identifier, a SHA-256 hash of the canonical input (RFC 8785 JCS), and the recorded output. The format is self-contained — nothing external is needed to replay a trace.

**The replayer** matches each boundary call by asserting that the observed `(boundary, input_hash)` pair matches the recorded step at the current cursor position. Six drift categories are reported: boundary drift, input drift, output drift, short-replay, long-replay, and tail drift. Strict mode halts on first drift; lenient mode collects all drifts.

**Benchmark:** 30 hand-built fixtures across five categories (linear, rerecord, mid-tamper, output-tamper, input-tamper). Network is audited via a fetch wrapper, not mocked — the assertion is that `logs/network.jsonl` is empty after a full run. Three runs, byte-identical. SHA-256 locked at `7C0BF8021A4FC922F4594523202522A917CC963CBB660DE2016F98DC8DB2D8D7`. Result: Strong band (100% fidelity, 0 external calls, 3 identical runs).

The reference implementation uses a toy Fibonacci agent. Streaming boundaries, parallel steps, and LangChain/OpenAI trace format compatibility are explicitly out of scope for v0.1 — tracked in OPEN_QUESTIONS.md.

The design composes with signed attestation (Plan 8) and agent discovery (Plan 9): a replay record is the concrete evidence backing a capability claim.

Repo: https://github.com/Accuoa/agent-replay  
Normative spec: https://github.com/Accuoa/agent-replay/blob/main/SPEC.md  
Open questions: https://github.com/Accuoa/agent-replay/blob/main/OPEN_QUESTIONS.md  
MIT.
