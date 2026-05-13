# Examples

A walkthrough showing the record → verify → diff cycle on the toy Fibonacci agent.

## 1. Record

```bash
agent-replay record src/toy-agent-cli-adapter.mjs examples/input-fibonacci.json > examples/record-fibonacci.json
```

## 2. Verify

```bash
agent-replay verify src/toy-agent-cli-adapter.mjs examples/record-fibonacci.json
```

Expected output: `{"drifts":[],"ok":true}`.

## 3. Diff (against itself for sanity)

```bash
agent-replay diff examples/record-fibonacci.json examples/record-fibonacci.json
```

Expected output: `identical`.

## 4. Diff (tampered)

Copy the record, modify its `output` field, and diff:

```bash
cp examples/record-fibonacci.json examples/record-tampered.json
# edit examples/record-tampered.json to change output
agent-replay diff examples/record-fibonacci.json examples/record-tampered.json
```

Expected: a divergence report identifying the differing field (kind=output).
