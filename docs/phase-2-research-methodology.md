# Phase 2 research methodology and integrity notes

The existing `docs/phase-2.6-experimental-protocol.md` remains the authoritative pilot protocol and data dictionary. This document records code-verified behavior and constraints found during Phase 2.7; it does not change the rubric or protocol.

## Comparison unit and provenance

An experiment stores protocol/rubric versions, dataset ID, conditions, status and paired comparisons. Each pair selects a registered source project, one saved baseline version and one saved enhanced version from that same project. Optional evaluation IDs must belong to the exact render and rubric. The Worker checks approved registration, project/dataset associations, modes, and evaluation provenance. The experiment snapshots selected version IDs, model/prompt/configuration/revision metadata and generated times.

This establishes application-level record associations. It does not prove that submitted image bytes were produced by the recorded model. Generation executes in the browser after Worker authorization; the Worker has no provider-signed provenance check. Treat provenance as application-recorded metadata, not cryptographic attestation.

## Fidelity score

Rubric `archvision-structural-fidelity-v1` contains six equally weighted criteria: room count, room function, spatial relationship, major walls, doors/windows, and missing/invented features. Preserved=2, partially preserved=1, not preserved=0. `CANNOT_DETERMINE` contributes no points and is excluded from the applicable denominator.

```text
score = round((points / (2 × applicable criteria)) × 10000) / 100
coverage = applicable criteria / 6
```

With zero applicable criteria, the score is `null` and status is `INSUFFICIENT_EVIDENCE`. Otherwise status is `COMPLETE`. Validators recompute aggregates from the six ratings.

## Paired summaries

Only numeric scores from complete assessments enter score means. If both sides have numeric scores:

```text
paired difference = enhanced score − baseline score
```

If either score is missing or insufficient, the difference remains null; missing is not converted to zero. Coverage is reported separately and differences are flagged. Descriptive summaries include sample size, mean, median, minimum, maximum, sample SD when n≥2, and missing count. Generation success/latency use retained outcomes only; old failures may be unavailable.

No significance test is implemented and the dashboard does not establish superiority. Avoid causal claims from a convenience pilot without a prespecified adequately powered design and suitable analysis.

## Qualitative review and blinding

The UI randomizes baseline/enhanced to A/B and records the mapping. The Worker retains saved reviews and prevents silent replacement. The UI hides mode labels in the review panel, but this is not secure blinding: the owner can inspect generation metadata elsewhere. Use a separate reviewer process if concealment matters. Reviewer codes and comments can still identify people or plans.

## Exports and privacy

Research exports are built from stored experiment, dataset, version and evaluation records. They omit owner identity, raw project IDs/names, private image references, and full approved analysis snapshots; they retain pseudonymous plan labels, record IDs, required provenance, scores and comments. Fidelity-specific exports also omit project/reviewer identifiers and private source/settings/analysis details. CSV values are quoted and formula guarded, including formula markers preceded by whitespace/control characters.

Pseudonymization is not guaranteed anonymity. Stable IDs, rare plan attributes, metadata and free-text comments may permit linkage. Review exports before sharing and minimize reviewer/architectural details.

## Integrity limitations

- Historical failures may be incomplete, affecting recorded success rates.
- An owner can manipulate their browser requests; Worker checks do not attest model origin.
- KV read/validate/write checks are not transactional; concurrent workspace changes can race.
- Analysis is reference information, not ground truth. Visual ratings are not geometric measurements.
- Any rubric change requires a new rubric version and protocol amendment.
