# ArchVision AI Phase 2.6 Experimental Protocol

**Protocol version:** `archvision-pilot-v1`  
**Status:** Implementation and protocol preparation complete; no experiment results are claimed here. Populate records only from authorized plans, existing renders, and completed human assessments.

## Objective, question, and hypotheses

Research question: Does the enhanced, floor-plan-aware generation pipeline produce more structurally consistent conceptual visualizations than the baseline renderer when both use the same source floor plan?

Null hypothesis for a later adequately powered analysis: the paired mean structural fidelity assessment difference (enhanced minus baseline) is zero. Directional research hypothesis: the enhanced condition has a higher paired rubric score. This is a hypothesis, not a result. Phase 2.6 currently provides descriptive summaries and does not compute significance tests.

## Dataset selection

Register only source plans for which the project owner has documented ownership or permission to use them. Assign an anonymous plan identifier and dataset identifier. Record source category, complexity, inclusion and exclusion criteria, and permission status/notes. Exclude a pending or explicitly excluded plan from comparison pairing. A pilot may start small and expand toward 10–20 representative plans as resources and permissions allow. No sample plans or outcomes are supplied by the application.

## Conditions and controlled variables

For each paired comparison, select an existing baseline render and an existing enhanced render from the same owner project/source image. The Worker validates exact project, render mode, evaluation record, and rubric associations. Do not regenerate automatically from the dashboard. Any generation requires a separate, explicit owner action through the existing quota-controlled generation workflow.

Use the same source floor plan, the same `archvision-structural-fidelity-v1` rubric, and human review instructions in both conditions. The record preserves exact render-version identifiers, model identifiers, prompt-template versions, configuration snapshots, approved-analysis revision identifiers, and the associated fidelity evaluation IDs. Differences in model/prompt/configuration/date and stochastic image output may remain uncontrolled; record known differences for each pair. Shared source identity does not imply scientific equivalence.

## Reviewer procedure and rubric

Review the original raster plan, the selected visualization, and (where available) the approved interpretation snapshot as reference material. The approved analysis is not ground truth. Rate each of six equally weighted criteria: room count consistency; room function consistency; spatial relationship consistency; major wall arrangement; door and window preservation; missing or invented features. For each choose `PRESERVED` (2), `PARTIALLY_PRESERVED` (1), `NOT_PRESERVED` (0), or `CANNOT_DETERMINE` (excluded). Explain judgments with reviewer notes and supporting evidence. Record visibility uncertainty, observations, discrepancies, and limitations. Do not score photorealism or attractiveness as architectural fidelity. Do not assume enhanced generation is superior.

The dashboard can present a pair in randomized A/B order and retain the mapping for later decoding. This is an operational aid, not a secure blinded study: owners can see project/render metadata elsewhere in the same application. Use a separate review session/procedure to reduce mode disclosure. Use reviewer codes instead of real names. Each comparison currently stores at most one immutable qualitative review; independent fidelity assessment records remain associated with their render versions and reviewer identifiers for future agreement analysis.

## Data collection and analysis

Each experiment stores dataset and protocol identifiers, paired comparisons, render/evaluation IDs, generation provenance snapshots, controlled/uncontrolled conditions, status, notes, and limitations. Dataset and experiment records are private to the authenticated owner. Experiment comparisons are append-only; prior comparison details and completed qualitative reviews cannot be overwritten. Corrections should be represented with new source records and a new experiment/protocol version rather than silently rewriting prior observations.

For an evaluation with applicable rubric criteria, score = `(sum of awarded points / (2 × applicable criteria)) × 100`. `CANNOT_DETERMINE` is not zero and is omitted from the denominator. Zero applicable criteria produces `INSUFFICIENT_EVIDENCE` and a null score. Coverage is applicable criteria divided by six. Pair difference is enhanced score minus baseline score and is null unless both scores are numeric. One-sided, missing, and insufficient-evidence results are not silently replaced with zero. Coverage differences greater than one criterion are flagged.

The dashboard reports sample size, mean, median, min, max, sample standard deviation (only where n ≥ 2), missing observations, unassessable criteria, criterion-level mean rubric points, discrepancy counts, recorded render latency, recorded historical success/failure outcomes, incomplete pairs, and available workspace retrieval latency. Success rates are based only on retained history; older failed attempts may not be recoverable. Retrieval latency measures the current workspace load and is not a per-plan project-store benchmark. These metrics are descriptive. No inference of statistical significance or superiority is made.

## Privacy and exports

The Worker authenticates every read/write, scopes KV storage by owner, verifies that registrations and paired renders/evaluations belong to owner projects, and does not include research records in public serialization. Floor-plan images remain in existing private asset storage and are not included in exports. JSON/CSV exports include the anonymous plan identifier, experiment/protocol/rubric identifiers, render/evaluation IDs, generation metadata, configuration snapshots, analysis revision numbers, ratings, scores, coverage, latency, missing evidence, notes/limitations, and benchmark summaries. Raw project IDs, project names, owner identifiers, private image asset references, and approved analysis snapshots are excluded. Exports can contain sensitive reviewer comments and should be stored and shared accordingly.

## Threats to validity and limitations

- Subjective ratings may vary by reviewer; no inter-rater statistic is implemented yet.
- Perspective, occlusion, image composition, and rendering style can affect visibility. Cannot-determine ratings and coverage must be reported.
- The approved AI floor-plan interpretation can be incomplete or wrong and is a reference only.
- Baseline and enhanced outputs may differ in prompt, configuration, generation date, stochastic sampling, or retained model settings.
- Existing historical records may not include every failed generation attempt or operational latency observation.
- Small or convenience samples may not generalize. Descriptive pilot results cannot establish causality or statistical significance.
- The rubric measures human visual structural fidelity. It does not measure geometric accuracy, CAD/BIM validity, building-code compliance, or engineering suitability.
- A/B ordering reduces direct mode cues in the review panel but does not guarantee reviewer blinding.

## Reproducibility checklist

Retain protocol and rubric versions; anonymous dataset identifier; inclusion/exclusion and permission notes; exact project/render/evaluation IDs in private storage; generation model/prompt/configuration snapshots; approved-analysis revision; reviewer code and timestamps; per-criterion rating/evidence/visibility notes; missingness and limitations; and the exported JSON/CSV version. Do not edit or replace historical evaluations/comparisons to improve a result. The browser export contains a sanitized research dataset and its data dictionary.

## Export data dictionary

| Field | Meaning |
| --- | --- |
| `anonymousPlanIdentifier` | Research pseudonym assigned at registration. |
| `experimentId` | Stable experiment record identifier. |
| `protocolVersion` / `evaluationRubricVersion` | Methods and rubric versions applied. |
| `baselineRenderVersionId` / `enhancedRenderVersionId` | Exact existing render versions compared. |
| `generationMode`, `modelIdentifier`, `promptTemplateVersion` | Recorded generation condition metadata. |
| `configurationSnapshot` | Render settings captured with the selected version, or null. |
| `analysisRevision` | Approved interpretation revision used at generation, or null. |
| `criterion rating` | Human rubric rating; `CANNOT_DETERMINE` remains distinct from a zero-point rating. |
| `fidelityScore` | Rubric score 0–100, or null for insufficient evidence. Not geometric accuracy. |
| `coverage` | Number of applicable criteria out of six. |
| `generationLatencyMs` | Stored generation duration for the selected render, when available. |
| `missingEvidence` | True when either selected assessment is missing or insufficient. |
| `pairedDifference` | Enhanced score minus baseline score; null when not evaluable. |
| `limitations` | Pair-specific limitations and uncontrolled differences. |

## Phase boundary

Phase 2.6 supplies registry, paired experiment records, descriptive benchmarking, exports, and protocol preparation. It does not populate a dataset, conduct an experiment, report research outcomes, run paid generation, provide statistical-significance testing, or implement Phase 2.7.
