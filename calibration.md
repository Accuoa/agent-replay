# Calibration

**Locked headline:** 100% replay fidelity (30/30) — 0 external network calls — Strong band — 3 byte-identical runs.

## Method

`benchmark/calibrate.sh` runs `npm run benchmark` three times sequentially and asserts byte-identical stdout across all three. The benchmark loads 30 fixture records, runs the verifier under an audited fetch wrapper, compares canonical-JSON output to the golden file, and reports pass/fail and external network calls.

## Fidelity bands

| Band | Threshold |
|---|---|
| Strong | 30/30 + 0 external calls + 3 byte-identical runs |
| Adequate | 27–29 / 30 + 0 external calls + 3 byte-identical runs |
| Weak | < 27 / 30 OR any external calls OR run drift |

## Result

```json
{"external_network_calls":0,"fail":0,"failures":[],"pass":30,"total":30}
```

Three byte-identical runs (sha256 hashes match):

- `logs/calibration/run-1.json`
- `logs/calibration/run-2.json`
- `logs/calibration/run-3.json`

SHA256 (all three): `7C0BF8021A4FC922F4594523202522A917CC963CBB660DE2016F98DC8DB2D8D7`

## Reproducibility note

The 30 fixture records are committed to `benchmark/data/samples.jsonl` after running the generator once. The recorder embeds a `trace_id` containing a timestamp and a random suffix; once the dataset is frozen those values are fixed. The verifier and the matcher are pure functions of the record; replay is fully deterministic against the frozen snapshot.

Re-running `generate-fixtures.mjs` produces a structurally equivalent dataset with different `trace_id` values; that's expected. The calibration would re-lock against the new snapshot.
