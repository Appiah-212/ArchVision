# Part A — System Testing and Documentation

**Assessment scope:** ArchVision AI, current repository state on 21 October 2026. This report covers Parts A and B only; Part C is intentionally excluded.

## A.1 Testing Objectives

Testing evaluates whether ArchVision's current workflows and data controls behave as intended, identifies gaps between isolated tests and deployment evidence, and establishes a repeatable evidence trail. The targets are functional correctness, persistence and version integrity, authorization and privacy boundaries, resilience to partial failures, usability, and reproducibility of research assessments. A passing mock test can support a code-level claim but cannot establish that Puter identity, storage, KV, hosting, quota, or model services work in production.

## A.2 System Scope and Testing Environment

The reviewed system is a React 19 / TypeScript application using React Router SSR, Vite, Tailwind, and the Puter SDK. Browser code handles session interaction, local validation, authorized calls and explicit AI operations. `lib/puter.worker.js` implements API routes, ownership validation, KV records, private assets, sharing, quotas and generation authorization. AI image generation runs in the browser after Worker authorization. The principal data flow and external-service limitations are described in the Phase 2 architecture and security review.

The repository is on branch `evaluation`, tracking `origin/evaluation`, at commit `c003572` (`Security and final validation`). The working tree was clean before evidence creation. Node and npm were available; local dependencies were present. The environment reported Node `v24.11.0` and npm `11.6.1`. Initial command launches through the PowerShell/cmd wrapper failed to spawn the Tailwind Oxide native binding (`spawn EPERM`) before checks began. Direct executions from the project workspace succeeded: typecheck exited 0, all 20 test files / 140 tests passed, build exited 0, and `git diff --check` exited 0. The initial launch issue is therefore treated as invocation-context/environment friction rather than an application defect. Clean captured summaries of the successful executions are in `evidence/logs/`.

The Phase 2 report's 20-file / 140-test result was independently reproduced in this assignment and again during this review. No live service, browser, AI request, deployment, or hosted Worker was used. Screenshot capture and browser automation are unavailable in this Codex environment; screenshots are pending manual capture.

## A.3 Testing Methodology and Levels

The repository contains 20 Vitest test files, configured for Vitest and jsdom (see `vitest.config.ts` and `test/setup.ts`). Component tests use React Testing Library; service and Worker tests use fixtures and mocked SDK/request/storage interfaces. These levels are classified as follows:

| Level | ArchVision evidence | What the level establishes |
|---|---|---|
| Unit | Pure validation, scoring, prompt, configuration, version and workflow helpers | Deterministic rules for supplied inputs |
| Component | Upload, analysis, design settings, generation selector, render panels, navigation and research route | UI rendering and interactions under mocked context |
| Mocked integration | `puter.action`, `puter.hosting`, `ai.action` and Worker route tests | Contract behavior across components with mocked Puter/storage/network boundaries |
| System-level simulation | Multi-step mocked flows such as authorization → generation commit, evaluation/export, research pairing and sanitized sharing | Selected cross-module paths in a controlled fixture environment |
| Live system | None executed | Requires real browser, account, Worker, KV/filesystem, public hosting and/or model service |
| Acceptance | Existing 26-case manual matrix | User-facing workflow and environment validation; all cases remain NOT RUN |

The methods intentionally do not equate mocked integrations with live Puter verification. No external standard is asserted as formally implemented or certified.

## A.4 Integration Testing

The test inventory provides some automated evidence for authentication context, upload validation, Worker ownership and schemas, private storage request contracts, AI authorization, versioning, fidelity scoring, research calculations, sharing sanitization and export formatting. This evidence is mainly unit, component, mocked integration and system-level simulation. It does not exercise the real Puter account context, Worker runtime, storage ACLs, KV consistency, hosted URL revocation, network behavior or live model output.

| ID | Objective / components | Preconditions and procedure | Expected behavior | Current observation / status | Evidence |
|---|---|---|---|---|---|
| IT-01 | Authentication and Worker authorization: UI, Puter context, Worker | Mock signed-out/signed-in contexts; call protected route with/without owner context | Sign-in gating and owner checks; foreign private data denied | Relevant component and Worker mocked tests exist; live identity injection unverified. **BLOCKED live** | `test/Navbar.test.tsx`, `test/Upload.test.tsx`, `test/puter.worker.test.ts`; no runtime log |
| IT-02 | Upload validation and private file storage: Upload, validator, Worker filesystem | Unit-test MIME/size/signature; mocked upload and project save | Invalid input rejected; private file associated with owner project | Local rules/request behavior covered; real filesystem privacy and orphan cleanup unverified. **BLOCKED live** | `test/file-validation.test.ts`, `test/Upload.test.tsx`, `test/puter.action.test.ts`, Worker tests |
| IT-03 | Frontend-to-Worker communication | Mock SDK `exec` responses for project, settings, analysis and generation routes | Correct route/method/body and visible error propagation | Contract tests exist; hosted endpoint and transport unverified. **BLOCKED live** | `test/puter.action.test.ts`, `test/puter.hosting.test.ts` |
| IT-04 | Worker-to-KV persistence | Fixture-backed Worker route save/retrieve tests | Owner-scoped records validate and reload | Simulated route behavior exists; KV atomicity/durability not verified. **BLOCKED live** | `test/puter.worker.test.ts` |
| IT-05 | Floor-plan analysis, correction and approval | Mock AI output, schema validation, UI edit/save | Conservative validated result; explicit human approval and revision | Unit/component/mock routes exist; model accuracy and live persistence unverified. **BLOCKED live** | `test/floor-plan-analysis.test.ts`, `test/FloorPlanAnalysisPanel.test.tsx`, Worker tests |
| IT-06 | Architectural configuration persistence | Save valid configuration and reject invalid schema | Valid settings reload; invalid settings rejected; no analysis mutation | Component and mocked route coverage exists; live reload unverified. **BLOCKED live** | `test/render-configuration.test.ts`, `test/ArchitecturalDesignSettingsPanel.test.tsx`, Worker tests |
| IT-07 | Baseline and enhanced generation | Mock authorization, prompt/model call, upload and commit contracts | Baseline fixed prompt; enhanced requires approved analysis/configuration; version snapshots provenance | Workflow and SDK calls are mocked; no live or billable generation run. **BLOCKED live** | `test/ai.action.test.ts`, `test/generation-workflow.test.ts`, Worker tests |
| IT-08 | AI authorization and quota enforcement | Worker fixtures test quota and project lock paths | Daily limit response, no unauthorized execution, one active project generation | Mock route coverage exists. Live quota accounting and post-authorization charge behavior remain unverified. **BLOCKED live** | `test/puter.worker.test.ts`, `test/puter.action.test.ts` |
| IT-09 | Render versioning and retrieval | Fixture versions; switch active render and retrieve images | Append version, retain prior render, restore selected version | Version/panel tests and mocked retrieval contracts exist; actual files/KV recovery unverified. **BLOCKED live** | `test/render-version.test.ts`, `test/RenderHistoryPanel.test.tsx`, `test/puter.action.test.ts` |
| IT-10 | Structural fidelity evaluation | Rate fixture render; revise and export | Six-criterion rules, insufficient evidence handling and redacted exports | Unit and route tests exist; human reliability/real export workflow unverified. **BLOCKED live** | `test/fidelity-evaluation.test.ts`, `test/puter.worker.test.ts` |
| IT-11 | Research comparisons and calculations | Fixture pairs and known values | Correct difference/missing-value rules, pairing and export values | Unit, route component and Worker tests exist; research data collection validity is outside this automated evidence. **BLOCKED live** | `test/research-evaluation.test.ts`, `test/ResearchRoute.test.tsx`, Worker tests |
| IT-12 | Public sharing, unsharing and privacy isolation | Mock owner/public records and asset calls | Public serialization removes private data; unshare revokes public access | Source/mock evidence exists; hosted ACL/cache revocation after unshare is unverified. **BLOCKED live** | Worker tests, Phase 2 security review |
| IT-13 | JSON and CSV exports | Fixture-backed exports with private values/formula-leading strings | Valid files; redaction and CSV formula guarding | Export rules covered in research/fidelity tests; manual artifact inspection pending. **BLOCKED live** | `test/research-evaluation.test.ts`, `test/fidelity-evaluation.test.ts` |

“Blocked live” records the missing live-service execution; it is not a failing mock result. The automated Vitest suite ran successfully, but does not verify live Puter services.

## A.5 System Testing

The requested end-to-end workflow—authentication → upload → project creation → AI analysis → human approval → design configuration → enhanced generation → render versioning → fidelity assessment → research dashboard → export—has not been executed end to end. Existing tests cover fragments and simulated combinations. Each live stage needs browser interaction and, at analysis/generation steps, an explicitly authorized AI call. This run made no such requests.

Baseline generation is represented in mocked prompt/workflow tests. Project retrieval after refresh, actual invalid file rejection, AI-provider failures, live storage failures, quota exhaustion, cross-account denial, share revocation, responsive behavior, keyboard access and actual exports require the browser checklist. Failure injection is present in selected mocked route paths, but does not establish service recovery. The production client and SSR bundles built successfully; starting the artifact in a host and exercising runtime routes remain untested.

## A.6 Acceptance Testing

The existing 26-case Phase 2 matrix has been retained and expanded into an ordered executable checklist at `manual-acceptance-checklist.md`. Its original coverage includes mocked/live session, uploads, private storage, cross-owner reads, signature checking, analysis approval/errors, settings, baseline/enhanced generation, quota/locking, versioning, legacy compatibility, fidelity and export privacy, research pairing/metrics/blinding/authorization, sharing/revocation, partial failures, accessibility and SSR. All actual-result, status and evidence fields remain **NOT RUN** until the user executes the steps. The checklist calls out second-account, private-session, existing-render, explicit AI and invalid-input prerequisites.

## A.7 Test Procedures, Results, and Evidence

| Command | Result on 21 Oct 2026 | Duration | Interpretation |
|---|---:|---:|---|
| `node --version` | Exit 0; `v24.11.0` | 0.118 s | Environment available |
| `npm --version` | Exit 0; `11.6.1` | 0.553 s | Environment available |
| `npm run typecheck` | Exit 0 | ~5 s | React Router type generation and TypeScript validation completed |
| `npm run test:run` | Exit 0; 20 files, 140 tests passed, 0 failed | 61.99 s | Vitest suite completed; 75% tracked environment time was jsdom initialization (20 environments; 634.67 s aggregate tracked time) |
| `npm run build` | Exit 0 | ~15 s total | Client and SSR bundles completed; 2,195 client modules, 31 SSR modules |
| `git diff --check` | Exit 0 | 0.124 s | No whitespace errors in current diff at time of command |

The wrapper attempts emitted transient native-binding `EPERM` failures. Direct tool executions from the workspace then completed successfully without changing dependencies. The successful build reported two `COMMONJS_VARIABLE_IN_ESM` warnings from `@heyputer/puter.js` polyfills (`localStorage.js`, `xhrshim.js`) and a `PLUGIN_TIMINGS` notice: React Router callbacks accounted for about 74% of the 8.9-second client build; these warnings did not fail the build. Vitest reported jsdom initialization overhead and suggested `vmThreads` or disabling isolation; isolation remains enabled. No dependency or application source was changed to obtain these results.

Evidence files: `evidence/logs/node-version.log`, `npm-version.log`, `typecheck.log`, `test-run.log`, `build.log`, and `git-diff-check.log`. Screenshot requests A1–A12 are **PENDING MANUAL CAPTURE**; see `evidence-index.md` for detailed actions and names. Do not include credentials, personal data, private floor plans, or tokens in screenshots.

## A.8 Bugs, Issues, and System Limitations

The code review identifies unresolved risks documented in the Phase 2 security review, not newly reproduced runtime defects. IDs and actions are in the matrix `test-case-matrix.md` under issue register.

| Finding | Classification | Evidence-based interpretation |
|---|---|---|
| Initial wrapped command launch could not spawn Tailwind native binding (`spawn EPERM`) | Transient invocation/environment issue | Occurred only on initial wrapped invocation; direct workspace executions passed without dependency/source changes |
| Broad fallback behavior in `analyzeFloorPlan()` | Source-reviewed reliability concern; not a reproduced runtime defect | `lib/ai.action.ts` returns a minimal fallback for broad output/parse and otherwise unexpected caught errors. This can conceal provider/network/runtime failures as a valid-looking empty analysis; no live provider failure was induced |
| Visualizer project-loading effect does not handle rejected `getProjectById()` | Source-reviewed error-handling concern; not a reproduced runtime defect | `app/routes/visualizer.$id.tsx` invokes `loadProject()` without catch/finally. A rejected load may become an unhandled promise rejection and leave `isProjectLoading` true; no live storage rejection was induced |
| Multi-call KV and asset writes can partially persist | Confirmed architectural limitation | Source review documents separate operations without transaction/CAS guarantees; recovery behavior not live-tested |
| Generation lock release is get/decrement and may race after TTL/reacquisition | Potential concurrency risk | Source-level operation sequence; not reproduced under real concurrency |
| AI/model or downstream upload/commit failures may consume quota after authorization | Source-observed limitation | No refund/reconciliation behavior for every downstream failure; not measured live |
| Public asset/CDN revocation and storage ACL behavior depend on Puter | Unverified external dependency | Source sanitization and mocked tests do not prove hosted revocation |
| Signature check does not decode or scan image content | Confirmed validation limitation | Signature check is narrower than full parsing/malware screening |
| Upload can precede project metadata save and leave orphan asset | Potential data consistency issue | Multi-call source workflow; not reproduced against live storage |
| Blob URL lifecycle and loading every render may increase memory/network use | Potential performance issue | Source review; no profiling measurement |
| Research pseudonymization does not guarantee anonymity; blind review is not secure blinding | Confirmed methodological limitation | Stable attributes/free text can link records; UI hides labels only in one view |
| No centralized remote monitoring/alerting found in repository | Confirmed operational gap | No centralized telemetry implementation found in reviewed repository |

No application bug is claimed as corrected by this assignment. See existing `docs/phase-2-security-review.md` for source-specific controls and its remaining-risk register.

## A.9 Corrective Actions and Outstanding Work

1. If `spawn EPERM` recurs in the normal VS Code project terminal, characterize that shell/process environment; direct workspace runs passed in this review.
2. Execute the 26 browser cases in order where safe. Use an isolated test project and avoid private real plans. Do not run AI cases without explicit quota authorization; no automatic retries.
3. Use a second controlled account/private session for isolation and revocation tests. Confirm behavior with deployed Worker version and hosting configuration before claiming live security.
4. Complete manual export inspection, keyboard/accessibility review, responsiveness and restart/retrieval checks.
5. Preserve screenshots and manually recorded actual results in the evidence directory. A screenshot is supporting evidence, not a substitute for textual observations.
6. Prioritize failure reconciliation, lock ownership/atomicity, quota accounting, public revocation verification and research privacy review in maintenance planning.

## A.10 Evaluation of Testing Effectiveness

The existing suite is broad across application logic and UI surfaces, and its separation of mock behavior from live service claims is methodologically appropriate. The successful run establishes that the current mocked/unit/component suite passes in this environment. Fixture tests cannot establish identity-provider behavior, ACL isolation, service availability, quota billing, cache revocation, real model quality, deployed runtime compatibility or browser accessibility. The manual matrix targets these gaps and remains unexecuted.

Comprehensive layered testing improves reliability by checking rules before integration, stability by exercising failures and reloads, and security by testing owner boundaries and serialization. Reproducible, versioned render/evaluation records support research integrity and user confidence when inputs, model identifiers, prompts, rubric versions and limitations are retained. These benefits depend on evidence that distinguishes simulation from live results; the current package therefore reports blocked runs and pending acceptance work plainly.
