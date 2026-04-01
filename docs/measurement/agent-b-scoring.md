# Agent B Scoring Pipeline

Agent B does not produce a black-box score directly. It records evidence as `ScoreObservation`, then aggregates deltas.

## Pipeline

1. **Rule extraction**  
   Parse latest user message to `rule signals` (e.g. `request_unknowns`, `ask_matrix`).
2. **Probe matching**  
   If an active probe exists and signal aligns, mark source as `probe`; otherwise `spontaneous`.
3. **Observation generation**  
   Persist `signalIds`, `evidenceText`, `mbtiDelta`, `faaDelta`, `confidence`, `rationale`.
4. **Aggregation**  
   Repeated similar signals decay with multipliers: first `1.0`, second `0.6`, third+ `0.3`.

## Why this is explainable

- Every score movement is linked to one or more observations.
- Each observation includes `rationale` and `evidenceText`.
- Debug mode can show observation trace per turn.

