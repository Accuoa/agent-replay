# Benchmark data

30 fixture records covering 5 verification scenarios:

| Range | Category | Description |
|---|---|---|
| 1–6 | linear-N | Clean toy-agent recording for n=1..6; verifier should pass |
| 7–12 | rerecord-N | Independent re-recording of the same n; verifier should still pass |
| 13–18 | mid-tamper-N | Middle step's input_hash mutated; replayer detects input drift, agent throws |
| 19–24 | output-tamper-N | Final output mutated; verifier reports tail drift |
| 25–30 | input-tamper-N | Record input mutated; replayer detects input drift on step 0, agent throws |

Each fixture pair is one line of `samples.jsonl` (input) and one line of `expected.jsonl` (golden):

```json
{ "mode": "strict", "name": "linear-3", "record": { ... } }
{ "name": "linear-3", "result": { "drifts": [], "observed_output": { "fibonacci": 2 }, "ok": true } }
```

To regenerate (timestamps and trace_id differ each run, but `step_id`, `boundary`, `input_hash`, and `output` are stable):

```bash
node benchmark/generate-fixtures.mjs
```
