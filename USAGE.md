# USAGE

This is an alpha. Things will break. Open an issue if anything trips you up.

## Run the demo (one command)

```bash
bash full-cycle.sh
```

This installs deps, runs the test suite, runs the benchmark, and runs three calibration runs (asserting byte-identical output).

## Commands

### `agent-replay record <agent.mjs> <input.json>`

Run the agent in record mode. Writes the canonical replay record JSON to stdout. The agent module must export:

- `runAgent(input, wrapper)` — the controller; calls `wrapper.boundary(name, input)` for each external call
- `backends` — a map of boundary name to async backend function
- default export — agent metadata `{ name, version }`

See `src/toy-agent-cli-adapter.mjs` for the reference shape.

### `agent-replay verify <agent.mjs> <record.json>`

Replay the record against the agent. Exits 0 on byte-identical fidelity, exits 2 on drift. Prints the drift report to stdout.

### `agent-replay diff <a.json> <b.json>`

Compare two records. Exits 0 on identical, exits 2 on divergent. Prints the first divergence.

## Requirements

- Node.js 20+
- npm

## What you should see

```
$ bash full-cycle.sh
=== install ===
...
=== test ===
✓ 50+ tests passed
=== benchmark (single run) ===
{"external_network_calls":0,"fail":0,"failures":[],"pass":30,"total":30}
=== calibrate (3 byte-identical runs) ===
... three matching SHA-256 hashes ...
=== full cycle complete ===
```
