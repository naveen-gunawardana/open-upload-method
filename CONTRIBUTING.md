# Contributing

OQM v2 should be decided by data, not by whoever has the best promo slider.

## Submit test results (most valuable)

1. Run the protocol in [docs/TEST-PROTOCOL.md](docs/TEST-PROTOCOL.md).
2. Open an issue titled `results: <date> <upload route>` and attach your `RESULTS.csv`.
   Remove account names. Include your OQM version (`oqm --version`) and FFmpeg version.
3. A failed method is a useful result. Please post nulls too.

## Code

- Python 3.10+, standard library only. FFmpeg is the only external tool.
- Every new patch must be:
  - a separate ID in `oqm/patches.py` `CATALOG`, with `seen_in` and an honest `evidence` line
  - off in the `none` and `minimal` profiles
  - covered by a test in `tests/`, and must pass `verify` (video and primary audio bit-identical)
- Run tests: `python -m unittest discover tests`

## Ground rules

- No branding, watermarks, telemetry or caption injection, ever.
- No claim in docs without a source or a reproducible test.
