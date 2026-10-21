# Part B — ArchVision AI System Maintenance Plan

## B.1 Maintenance Objectives

This plan defines how ArchVision AI should be maintained after deployment while protecting private architectural material and research records. It is a proposed operating plan, not evidence that production monitoring, backups, service-level objectives, or deployment automation are already configured. It follows the application's actual split between React/React Router browser workflows, the Puter Worker, user-scoped KV/filesystem records, shared public assets, and explicit browser-side AI calls.

Maintenance should preserve correctness of project ownership and version history, keep private and public data boundaries explicit, sustain compatibility with evolving dependencies and Puter interfaces, and protect reproducibility through versioned generation inputs and fidelity rubrics. Evidence should be retained without collecting source images, tokens, or unnecessary personal/research information.

## B.2 Corrective, Adaptive, Perfective and Preventive Maintenance

| Category | ArchVision application | Example work and controls |
|---|---|---|
| Corrective | Repair a demonstrated failure in upload, Worker authorization, image retrieval, settings/analysis persistence, render commit, quota response, research calculation or export | Reproduce with a sanitized fixture; isolate whether browser, Worker, KV, filesystem or provider failed; add a regression case; preserve previous render; review privacy consequences; monitor after approved release |
| Adaptive | Respond to changes in Puter SDK/API identity injection, KV/filesystem behavior, AI model identifiers/interfaces, React Router/Vite, Node.js, supported browsers or hosting runtime | Review vendor change notes and current deployment requirements; update lockfile/config in a branch; verify mock contracts and staging behavior; document any model/prompt/rubric/schema migration and compatibility window |
| Perfective | Improve architecture workflow, settings discoverability, accessible controls, research dashboard responsiveness, image loading and user-requested capabilities | Gather user evidence; define measurable acceptance criteria; avoid exposing private study data; check responsive and keyboard workflows; measure before/after performance rather than asserting improvement |
| Preventive | Reduce future defects and security/data loss risk | Review advisories and dependencies; maintain test coverage across owner checks, public serialization, quota and partial failures; verify recovery procedures; monitor storage references; review cache/revocation and upload assumptions; remove sensitive diagnostics |

No maintenance change may silently alter previously recorded analysis, render provenance, research pairing, or rubric interpretation. Such changes require schema/version review and preservation of original records.

## B.3 Monitoring and Maintenance Schedule

The following schedule is proposed. Roles can be combined on a small capstone team, but the person implementing a high-risk security change should not be its sole reviewer where a second reviewer is available.

| Frequency | Activity | Responsible role | Expected action | Evidence to retain |
|---|---|---|---|---|
| Daily during active use | Service availability and Worker error review | Operations/developer | Review available host/Worker health and error signals; distinguish platform outage from application failure; do not collect user images or tokens | Dated availability/error summary with redacted identifiers |
| Daily during active use | AI failure, quota and latency review | Application maintainer | Review explicit authorization denials, generation/analysis failures and durations where platform telemetry permits; investigate unexpected quota consumption; avoid retries that could incur cost | Aggregated counts and sanitized incident references |
| Daily during active use | Security events | Security owner | Triage repeated unauthorized access, invalid upload, unexpected public access, and anomalous Worker errors | Restricted incident record; no credentials or plan content |
| Weekly | Private asset and project consistency | Data/application maintainer | Spot-check controlled test records: project references, source/render availability, version pointers and public/private state; reconcile only with an approved procedure | Checklist and anonymized test project IDs |
| Weekly | Regression suite and acceptance follow-ups | Developer/QA | Run typecheck, unit/component/mock integration tests, build and diff checks in a working environment; follow blocked failures without relabeling | Command logs, test count, warnings, commit identifier |
| Weekly | User feedback and usability | Product/UX owner | Triage workflow friction, keyboard barriers, confusing errors and user requests | Redacted issue summaries and decisions |
| Monthly | Dependency/security review | Developer/security reviewer | Inspect package advisories and release changes; assess Node/npm, React Router, Vite, Puter SDK and transitive packages; update in a branch with lockfile | Advisory snapshot date, dependency diff, review and test record |
| Monthly | Performance and storage review | Developer/operations | Review image load sizes, retrieval errors, generation latency, memory reports and dashboard responsiveness if instrumentation exists | Aggregated metrics and reproducible profile; no raw image retention |
| Monthly | Research data and export review | Research lead/privacy reviewer | Check access, retention, pseudonymization limitations, export redaction and participant/study-code handling | Review record and approved export schema |
| Quarterly | Recovery exercise | Operations/data owner | Restore source from Git; rehearse configuration recovery and documented data recovery with test records; verify escalation contacts | Exercise plan, timings, gaps, follow-up actions |
| Quarterly | Accessibility and security control review | QA/security owner | Revisit keyboard/screen-reader path, ownership, upload validation, sharing/unsharing and public asset exposure | Manual checklist and issue references |
| Event-driven | Puter, model, runtime or browser change | Maintainer | Assess compatibility; use a staging/test account; test failure and rollback; version model/prompt/schema/rubric effects | Change assessment and approval record |
| Event-driven | Incident, suspected exposure, data corruption or quota anomaly | Incident lead | Contain sharing/affected route, preserve sanitized evidence, assess scope and notify stakeholders through approved channels; recover and review | Incident timeline, decisions, impact and post-incident actions |

The repository currently shows no centralized production monitoring or alerting implementation. The actions above require platform capabilities and account access to be confirmed before adoption.

## B.4 Bug Fixes and Enhancement Management

Use the controlled workflow **Issue Reported → Triage → Severity Classification → Prioritization → Assigned Fix → Testing → Review → Release Approval → Monitoring → Closure**. Each issue records a concise reproduction, affected version/module, data sensitivity, expected and observed outcomes, evidence location, owner and status. Screenshots/logs must be redacted and use controlled test records.

| Priority | Examples and handling | Target response (proposed) |
|---|---|---|
| Critical | Suspected exposure of private plans, cross-owner access, token compromise, widespread data loss. Restrict affected sharing/operation where feasible, preserve evidence, notify responsible owner, use a reviewed hotfix and verify revocation/recovery | Immediate triage; containment begins as soon as an authorized operator is available; updates at agreed incident intervals |
| High | Core upload, retrieval, generation commit, project persistence or quota control unavailable for users | Same working day triage; prioritize safe service restoration and data integrity over new features |
| Normal | Isolated UI/validation/export defect without exposure or broad data loss | Schedule by impact and reproducibility; regression test before release |
| Enhancement | Workflow, accessibility, dashboard or performance improvement | Product/research review, acceptance criteria, privacy and cost assessment, prioritize against maintenance capacity |
| Technical debt | Missing reconciliation, non-atomic lock release, blob URL lifecycle or incomplete failure observability | Track as explicit risk-reduction work; avoid silently expanding scope in unrelated fixes |

Emergency hotfixes should be limited to the smallest safe change, reviewed by another person where possible, tested against the relevant regression cases, approved by the release owner, and followed by a complete review and changelog entry. Communicate user impact, workaround, status and closure without exposing private data. Proposed response intervals are planning goals, not existing service commitments.

## B.5 Version Control and Configuration Management

Repository evidence shows branches `main`, `development`, `testing`, and `evaluation`, with `evaluation` tracking `origin/evaluation`; tags `v0.1.0` through `v0.4.0`; and a Git remote named `origin`. This demonstrates branch/tag/remote objects only. The repository evidence reviewed does not establish required pull-request checks, branch protections, release automation or an active GitHub maintenance workflow. No commit or push is part of this assignment.

Recommended controls:

- Keep `main` releasable; use `development` for integration if the team continues that convention. Create short-lived `feature/<topic>` and `hotfix/<issue>` branches from the appropriate base.
- Submit a pull request with issue link, scope, risk, migration/configuration impact, test evidence and rollback notes. Require review for authorization, storage, sharing, quota, schemas and research exports. Avoid direct release edits.
- Run typecheck, unit/component/mock integration tests, production build, and diff checks in CI after environment binding issues are resolved. Add live staging validation as a separately labeled gate, never as a mock result.
- Use semantic versioning only when release practices and compatibility meaning are agreed. Tag reviewed release commits, retain a human-readable changelog, and map deployed application/Worker revisions to the tag.
- Roll back application code to a known-good tag when needed, then separately assess KV/filesystem migrations, public assets and configuration: code rollback alone cannot reverse data writes or revoke public URLs.

Configuration inventory and controls:

| Configuration | Management recommendation |
|---|---|
| Node.js/npm | Record supported runtime (Dockerfile currently targets Node 24 Alpine); pin/standardize the team runtime and verify CI/staging parity |
| `package.json` / `package-lock.json` | Commit together; use lockfile-based reproducible installs; review dependency updates and avoid unreviewed package drift |
| Environment variables | Document name, purpose, exposure class and environment; keep secrets outside source and logs. `VITE_*` values are client-visible, including `VITE_PUTER_WORKER_URL`; never put credentials there |
| Puter Worker endpoint/storage | Review endpoint and platform environment for each deployment; verify Worker revision, KV/filesystem namespaces and public hosting behavior in controlled staging |
| AI model identifiers | Treat changes as experimental configuration. Record provider/model ID and date with generation metadata; validate output format, cost/quota and reproducibility implications |
| Prompt templates | Maintain explicit prompt template versions; review prompt changes against fixed fixtures and human acceptance criteria; preserve old provenance |
| Fidelity rubric | Version rubric changes, document definitions and scoring rules, and do not recompute old assessments silently |
| Data schemas | Validate on both browser and Worker; add migration/backward compatibility tests; preserve legacy render representation; plan recovery before any migration |
| Docker/hosting | Review Dockerfile, Node runtime, server entry, port/health checks and host settings together; test built artifact in staging before approval |

Any configuration or model/prompt/rubric change should have a proposal, owner, impact assessment, fixture/staging tests, reviewer approval, documentation, release identifier and rollback procedure. Secrets and private research data must not appear in configuration files committed to Git.

## B.6 Security and Data Protection

Apply least privilege to Worker, KV, filesystem and account access. Revalidate ownership and schemas server-side; treat browser-supplied IDs and generation bytes as untrusted. Verify private asset ACL and cache behavior using controlled accounts. Validate invalid file type, size and content signature, recognizing that signature checks do not fully decode or scan image content. Review sanitized public serialization and test unshare against both public records and hosted asset URLs after platform propagation.

Restrict log content to operational metadata needed for diagnosis. Do not log tokens, image bytes, floor-plan analysis, reviewer identity, free-text research comments, or sensitive URLs. Research exports are pseudonymized but may remain linkable through stable IDs, rare plan characteristics and comments; review before external sharing. The current blind-review presentation is not secure blinding. Retention and deletion periods should be defined with research governance requirements before production use.

## B.7 Backup, Recovery and Rollback

The reviewed repository establishes Git source history and tags, but does not establish that hosted project KV records, images, configuration, or research data have backups. Puter transaction, snapshot, retention and recovery guarantees were not verified. The following are proposals that require validation with the provider/account owner.

| Asset/failure | Proposed recovery | Verification and limitation |
|---|---|---|
| Source code | Restore known release tag/commit from Git; retain lockfile and build/runtime configuration | Rebuild and compare identified artifact; repository rollback does not restore user data |
| Failed application release | Route to a prior approved app version where hosting permits; record current/target version | Recheck private/public routes and Worker compatibility; rollback cannot undo public exposure or KV writes |
| Project metadata | Use provider-supported export/snapshot if available; otherwise design and test owner-authorized export/reconciliation before relying on recovery | No Puter KV backup capability is assumed; verify semantics and retention first |
| Private/public images | Confirm provider backup/export and ACL restoration behavior; maintain approved recovery copies only if privacy, cost and retention policy permit | Do not create unapproved duplicate stores; verify URL revocation and ownership after restore |
| Configuration | Maintain reviewed non-secret config templates in Git; store secrets in platform secret management and document authorized recovery | Never back up secrets into repository or screenshot evidence |
| KV/filesystem inconsistency | Inventory project/version references and asset existence; use a reviewed, idempotent repair script or manual procedure in staging first | Reconcile without deleting any referenced successful version; test partial writes and retries |
| Failed schema migration | Back up/export according to verified provider capability; use versioned, reversible or additive migration; stop writes if integrity is uncertain | No transaction guarantee assumed; preserve old fields until compatibility is proven |
| Puter outage | Communicate degraded mode; avoid repeated billable requests; preserve local status and retry only under controlled idempotency policy | Application availability depends on platform; recovery time cannot be promised until provider status and local behavior are known |

Before deployment, name a recovery owner, document escalation paths, record recovery point/time objectives as team-approved targets, and rehearse with non-sensitive test data. Do not claim RPO/RTO until measured.

## B.8 Risk Identification and Mitigation

Likelihood and impact are qualitative planning estimates (Low/Medium/High), not measured incident frequencies or platform statistics. Priority combines estimated likelihood and impact with sensitivity of affected data.

| ID | Risk | Likelihood | Impact | Priority | Preventive measures | Mitigation | Contingency | Responsible role |
|---|---|---:|---:|---:|---|---|---|---|
| R-01 | Unauthorized access to private architectural information | Medium | High | High | Owner checks, schema validation, least privilege, cross-account tests | Restrict affected route/account; inspect sanitized logs and scope | Suspend sharing/route; notify authorized owner; verify access recovery | Security owner |
| R-02 | Puter platform outage | Medium | High | High | Availability checks, avoid unnecessary calls, document dependencies | Identify platform vs app failure; preserve records and user status | Pause dependent workflow; communicate; resume after controlled health check | Operations |
| R-03 | Failed image or metadata persistence | Medium | High | High | Validate upload/commit sequence; reference checks; failure injection | Reconcile asset and project references; retain previous render | Restore only from verified provider recovery or approved copy | Data/application maintainer |
| R-04 | KV/file-storage inconsistency | Medium | High | High | Idempotent operations where possible; integrity review; no assumed transactions | Compare references and recover missing/stranded objects safely | Disable destructive actions until reconciled | Data owner |
| R-05 | Public image revocation failure | Low–Medium | High | High | Controlled unshare tests; cache and ACL review | Revoke public object/URL using verified provider mechanism | Escalate to platform; suspend public sharing | Security/operations |
| R-06 | AI model unavailable or behavior changes | Medium | Medium–High | High | Record model IDs, version prompts, validate outputs and fallback behavior | Mark run failed; preserve input/provenance; avoid silent baseline fallback | Pause AI features or use explicitly approved alternative | AI/application maintainer |
| R-07 | AI quota exhaustion or unexpected consumption | Medium | Medium | Medium–High | Authorization gate, visible quota, no automatic retry, audit failures | Stop repeated calls; inspect authorization/failure sequence | Wait for reset or obtain explicit quota authorization | Product/operations owner |
| R-08 | Dependency vulnerability | Medium | High | High | Monthly advisory review, lockfile, reviewed updates | Assess exploitability and affected route; patch and test | Restrict vulnerable functionality or roll back | Developer/security reviewer |
| R-09 | Render-history data loss | Low–Medium | High | High | Append-only versions, reference checks, recovery test | Stop cleanup; restore from verified backup if available | Preserve remaining versions and document irrecoverable gap | Data owner |
| R-10 | Large-image performance degradation | Medium | Medium | Medium | Measure file sizes/latency; test realistic sizes; manage object URLs | Reduce unnecessary image loads; investigate memory/network profile | Temporarily limit supported workflow with clear notice | Developer/UX |
| R-11 | Failed update or configuration drift | Medium | High | High | Reviewed config, environment inventory, lockfile, release record | Compare effective config to approved baseline | Roll back known-good configuration/version | Release owner |
| R-12 | Research assessment corruption or linkage | Low–Medium | High | High | Schema/provenance checks, append-only review, export review, access limits | Freeze affected experiment/export; compare records and revisions | Restore only from verified source; disclose limitations to research lead | Research/data steward |
| R-13 | Accessibility/usability barrier | Medium | Medium | Medium | Keyboard/manual review, semantic labels, feedback channel | Prioritize blocked critical workflow | Provide accessible alternative until fix is released | QA/UX owner |

## B.9 Maintenance Performance Indicators

No current production measurements are available in this assignment. Indicators below should be instrumented only with privacy-conscious, aggregate data and reviewed monthly. Establish targets after a baseline period rather than inventing current service performance.

| Indicator | Definition | Monitoring and review |
|---|---|---|
| Mean time to detect (MTTD) | Mean interval from incident start (or first measurable symptom) to detection | Timestamp incident reports and available alert events; review by severity monthly |
| Mean time to resolve (MTTR) | Mean interval from detection to service restoration/mitigation | Incident timeline with restore and closure timestamps; separate permanent fix time |
| Application error rate | Failed application/Worker requests divided by observed requests, segmented by route/status | Aggregate provider or approved telemetry; exclude sensitive payloads; review trend and unknown denominator |
| AI-generation success rate | Completed authorized generation operations divided by authorized generation attempts | Use generation status and approved aggregate telemetry; distinguish provider, upload and commit failures |
| Average generation latency | Mean time from authorization/start to committed render, by mode/model | Use stored duration where reliable; report sample size and percentile alongside mean |
| Test pass rate | Passed executed automated cases divided by executed cases; blocked suites reported separately | CI/test logs per commit; do not count skipped/blocked tests as passing |
| Storage/retrieval failure rate | Failed asset or metadata read/write operations divided by observed operations | Instrument operation outcomes without filenames or image content; reconcile with user reports |
| High-severity vulnerability remediation time | Time from verified high-severity advisory/defect triage to mitigation or patch | Restricted vulnerability register with detection, triage and closure timestamps |

## B.10 Conclusion

ArchVision's maintenance priorities arise from its real trust boundaries: private source plans and generated images, owner-scoped project records, shared public copies, browser-triggered AI calls, and research provenance. The maintenance program should combine incident correction with platform adaptation, targeted usability work and prevention of privacy, consistency and reproducibility failures. Its procedures remain proposed until roles, provider capabilities, monitoring and recovery are validated. Measured indicators and controlled release evidence should guide future decisions; no production health or backup claim is made here.
