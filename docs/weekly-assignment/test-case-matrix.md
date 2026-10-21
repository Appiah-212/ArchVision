# ArchVision AI — Test Case and Coverage Matrix

Current test execution on 21 October 2026 completed successfully on direct invocation: 20 files and 140 tests passed. Initial wrapped launches transiently reported Tailwind Oxide `spawn EPERM` before initialization; direct runs of typecheck, tests and build succeeded without dependency changes. Coverage inventory below describes existing test intent; the tests remain mocked/fixture-backed and do not establish live Puter behavior.

| Feature / requirement | Test files and representative cases | Level | Coverage assessment | Live status |
|---|---|---|---|---|
| Authentication/session gating | `Navbar.test.tsx`, `Upload.test.tsx` | Component with mocked auth | Basic signed-out gating and nav UI; no live identity/session | NOT RUN |
| Upload type/size validation | `file-validation.test.ts`, `Upload.test.tsx` | Unit + component | Supported/rejected types and UI handling; no malware/decode check | NOT RUN |
| Private asset storage / project creation | `puter.action.test.ts`, `puter.worker.test.ts` | Mocked integration | Request contract, ownership and private asset validation in mocked Worker; no actual Puter filesystem ACL | NOT RUN |
| Worker API and ownership | `puter.worker.test.ts` | Mocked integration / system-level simulation | Route validation, owner checks, private/public boundaries for covered cases; unauthorized permutations incomplete | NOT RUN |
| Frontend-to-Worker API | `puter.action.test.ts`, `puter.hosting.test.ts` | Mocked integration | Methods, payloads, response validation and errors; no hosted endpoint transport | NOT RUN |
| Worker-to-KV persistence | `puter.worker.test.ts` | Mocked integration | Simulated records and route behavior; no KV durability/atomicity | NOT RUN |
| Floor-plan analysis schema and correction | `floor-plan-analysis.test.ts`, `FloorPlanAnalysisPanel.test.tsx`, `ai.action.test.ts` | Unit + component + mocked AI integration | Structured response parsing, conservative fallback, UI review; no model accuracy or live provider | NOT RUN |
| Design controls/configuration | `render-configuration.test.ts`, `ArchitecturalDesignSettingsPanel.test.tsx`, Worker tests | Unit + component + mocked integration | Config validation and save contract; live persistence not tested | NOT RUN |
| AI generation and modes | `ai.action.test.ts`, `generation-prompt.test.ts`, `generation-workflow.test.ts`, `GenerationModeSelector.test.tsx` | Unit + component + mocked integration | Prompt/model options, baseline/enhanced preconditions and workflow; no billed AI call | NOT RUN |
| Authorization, quota, generation lock | `puter.worker.test.ts`, `puter.action.test.ts` | Mocked integration / system-level simulation | Authorization, 429 and selected lock/failure cases; real quota, race and billing unverified | NOT RUN |
| Render versioning/history/retrieval | `render-version.test.ts`, `RenderHistoryPanel.test.tsx`, `RenderComparisonPanel.test.tsx`, `puter.action.test.ts` | Unit + component + mocked integration | Version shape, selection/comparison and mocked image retrieval; live retrieval/reload absent | NOT RUN |
| Structural fidelity | `fidelity-evaluation.test.ts`, Worker tests | Unit + mocked integration | Six-criterion scoring, unassessable logic, schema and export privacy; inter-rater validity not established | NOT RUN |
| Research calculations/dashboard | `research-evaluation.test.ts`, `ResearchRoute.test.tsx`, Worker tests | Unit + component + mocked integration | Pairing/calculation/route visibility and authorization cases; research validity and live KV unverified | NOT RUN |
| Public sharing/unsharing | `puter.worker.test.ts`, `puter.hosting.test.ts` | Mocked integration / system-level simulation | Sanitization and selected state changes; hosting ACL/CDN revocation unverified | NOT RUN |
| JSON/CSV exports | `research-evaluation.test.ts`, `fidelity-evaluation.test.ts` | Unit / system-level simulation | Redaction and formula guarding; manual file inspection pending | NOT RUN |
| Responsive behavior/accessibility | No dedicated responsive/accessibility suite identified | Manual acceptance | Keyboard, screen reader, viewport behavior not established | NOT RUN |
| SSR/deployment runtime | Build command / manual M26 | Build/system | Production client and SSR bundle built; starting the artifact in a real host remains unverified | NOT RUN |

## Test levels and claims

- **Unit:** pure helper, validation, schema, prompt, scoring, version and calculation logic under fixtures.
- **Component:** React render and interaction in jsdom with controlled/mocked context.
- **Mocked integration:** API/SDK/Worker/storage boundary calls replaced by mocks or fixture functions.
- **System-level simulation:** selected multi-module scenarios assembled with mocked dependencies; not a live deployment.
- **Live system:** real authenticated browser, hosted Worker, actual KV/filesystem, public hosting and provider interactions. None were executed.
- **Acceptance:** existing manual cases MA-01–MA-26 in `manual-acceptance-checklist.md`; all are NOT RUN.

## Issue register

Classifications below distinguish environment blockers from source-level limitations and potential risks. There are no newly reproduced application defects from this run.

| Issue ID | Severity | Affected module | Reproduction procedure | Observed behavior | Expected behavior | Evidence | Resolution status | Proposed action |
|---|---|---|---|---|---|---|---|---|
| ISS-01 | Low; transient environment/invocation | Local Vite/Tailwind toolchain | Initial wrapped command launch; then invoke the same project commands directly | Wrapper launch emitted native binding `spawn EPERM`; direct workspace typecheck, tests and build succeeded unchanged | Commands complete reliably in the normal VS Code project terminal | Initial and direct results in evidence logs / assignment execution record | Resolved for this run; underlying wrapper-context cause not isolated | Use direct project terminal invocation; if recurrence persists there, inspect local native binding and process policy without changing app code |
| ISS-02 | High | Worker KV/filesystem persistence | Interrupt between asset write and project metadata write; inspect for orphan/missing references | Source uses multiple calls; transaction/CAS guarantees not established | No false success and recoverable consistency across failures | Phase 2 security review; `lib/puter.worker.js`, `lib/puter.action.ts` | Confirmed architectural limitation; runtime reproduction not performed | Design reconciliation/idempotency using verified provider capabilities; add failure-injection tests |
| ISS-03 | Medium–High | Generation lock/quota | Trigger expiry/reacquisition timing and downstream failure after authorization | Source documents non-atomic get/decrement release and non-refund paths; not reproduced live | Correct lease ownership and transparent, approved charge accounting | Phase 2 security review; Worker generation routes | Potential concurrency/accounting risk | Validate platform primitives; test race, TTL, authorization rollback and downstream failures |
| ISS-04 | High | Public assets/sharing | Share disposable project, unshare, request former public URLs after propagation | Sanitization exists in source/mocks; actual ACL/cache revocation unknown | Public project and assets become inaccessible after unshare within documented interval | Phase 2 security review; Worker share/revoke logic | Unresolved external dependency | Controlled staging test with provider; document propagation and escalation |
| ISS-05 | Medium | Upload validation | Submit signature-matching but malformed image or image with hazardous payload | Signature prefix is checked; full decode/scan not established | Invalid content safely rejected per threat model | Phase 2 security review; Worker upload routes | Confirmed scope limitation, not demonstrated exploit | Define bounded decode/re-encode or provider-supported scan after threat review |
| ISS-06 | Medium | Browser object URL/image loading | Open project with many large render versions; navigate repeatedly while profiling | Project loading may fetch all version images; common URL disposal lifecycle not found | Bounded memory/network use and reliable cleanup | Phase 2 security review; project loading code | Potential performance/memory risk; not measured | Profile controlled large fixture; implement cleanup/lazy loading only through approved change |
| ISS-07 | Medium | Research dashboard/review/export | Compare public/study export and blind-review views with linkage threat model | Pseudonymization is not anonymity; stable details/free text linkable; blinding is presentation-only | Claims accurately reflect limitations and exported data is reviewed | Phase 2 security review and research methodology docs | Confirmed methodological limitation | Use study codes, minimize free text, restrict exports, separate reviewers if secure blinding is required |
| ISS-08 | Medium | Operations/monitoring | Inspect repository for centralized monitoring/alerting | No centralized remote logging/alerting implementation found | Production operations can detect and triage errors without sensitive payloads | Phase 2 deployment readiness; repository search | Confirmed operational gap | Select approved aggregate telemetry and alert ownership before deployment |

No resolution is attributed to this assignment. Severity is a planning assessment, not a formal incident classification.
