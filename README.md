# AgentReplay

> Status: alpha demo

A primitive for deterministic agent replay. Wrap your agent's boundary calls (LLM, tools, clock, randomness) in the recorder, get back a portable trace. Replay the trace and the agent re-executes against the recorded outputs — byte-identical final output, byte-identical step sequence, every time.

Read the [spec](./SPEC.md) for the normative trace format and replay protocol. The [architecture](./ARCHITECTURE.md) document covers the reference implementation. The [reference implementation](./src/) is a Node.js CLI plus a toy agent that demonstrates the full record → verify cycle.

## Quick example

```bash
agent-replay record src/toy-agent-cli-adapter.mjs examples/input-fibonacci.json > rec.json
agent-replay verify src/toy-agent-cli-adapter.mjs rec.json
agent-replay diff rec.json rec-modified.json
```

## Headline metric

**100% replay fidelity (30/30) — 0 external network calls — Strong band — three byte-identical runs.**

See [benchmark/](./benchmark/) and [calibration.md](./calibration.md).

## Composes with

- [agent-reputation](https://github.com/Accuoa/agent-reputation) — a replay record can be signed and attested. Plan 8 envelope plugs into `metadata.attestation` on the record.
- [p2p-agent-discovery](https://github.com/Accuoa/p2p-agent-discovery) — a replay record is evidence for a manifest's capability claim.
- [memorystore](https://github.com/Accuoa/memorystore) — memory operations are a boundary, replay-able like any other.

## Open questions

See [OPEN_QUESTIONS.md](./OPEN_QUESTIONS.md). Honest list of unresolved design decisions — feedback welcome.

## Landing page

[accuoa.github.io/agent-replay](https://accuoa.github.io/agent-replay)

## License

MIT — see [LICENSE](./LICENSE).
