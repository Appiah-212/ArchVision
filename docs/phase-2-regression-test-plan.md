# Phase 2.7 regression and manual validation plan

## Automated checks

```powershell
npm run typecheck
npm run test:run
npm run build
git diff --check
npm audit --offline
```

Tests use Vitest/jsdom, mocked Puter SDK/Worker routes and fixture data. They do not authenticate to live Puter, verify hosted storage, or call a billable model. Test files present include:

`ai.action.test.ts`, `floor-plan-analysis.test.ts`, `FloorPlanAnalysisPanel.test.tsx`, `render-configuration.test.ts`, `ArchitecturalDesignSettingsPanel.test.tsx`, `generation-prompt.test.ts`, `generation-workflow.test.ts`, `GenerationModeSelector.test.tsx`, `render-version.test.ts`, `RenderHistoryPanel.test.tsx`, `RenderComparisonPanel.test.tsx`, `fidelity-evaluation.test.ts`, `puter.worker.test.ts`, `puter.action.test.ts`, `puter.hosting.test.ts`, `research-evaluation.test.ts`, `ResearchRoute.test.tsx`, `file-validation.test.ts`, `Upload.test.tsx`, and `Navbar.test.tsx`.

Coverage includes schemas/scoring/benchmark behavior, upload rules, owner checks/persistence, generation authorization, history, sharing, privacy boundaries and route rendering. It is mocked and does not exhaust every unauthorized permutation. Automated tests must not call live `puter.ai` or spend quota.

### Phase 2.7 run record

- `npm run typecheck`: **passed**.
- `npm run test:run`: **passed** — 20 test files, 140 tests passed, 0 failed.
- `npm run build`: **passed** — React Router client and SSR bundles produced.
- `git diff --check`: **passed**; Git printed Windows LF-to-CRLF working-copy notices for edited text files.
- `npm audit --offline --json`: **0 reported vulnerabilities** in the locally available audit data; this is not a current online registry audit.
- Warnings: Vitest reports jsdom setup was created in 20 environments and dominates tracked environment time; it recommends `vmThreads` or disabling isolation. Isolation was retained. Build reports two `COMMONJS_VARIABLE_IN_ESM` warnings from `@heyputer/puter.js` polyfills (`localStorage.js` and `xhrshim.js`) and a Vite/Rolldown plugin timing warning (React Router resolve/transform callbacks). Build still succeeds.
- The Vite config reports 2,195 transformed client modules; this is a build metric, not a runtime performance benchmark.

## Manual validation

All actual-result, pass/fail and screenshot fields are intentionally blank. Fill them only after the real steps. Live AI checks are optional, explicit, and limited to one analysis and one generation per mode on a controlled plan. Check quota before each; do not retry automatically.

| ID | Type / feature | Prerequisites | Steps | Expected result | Actual result | Pass/fail | Evidence screenshot |
| --- | --- | --- | --- | --- | --- | --- | --- |
| M01 | Mock authentication | Test runner | Test signed-out/signed-in contexts. | Signed-out protected actions request sign-in. |  |  |  |
| M02 | Live session | Controlled Puter account | Sign in, refresh, sign out, revisit. | Session and protected-page state are accurate. |  |  |  |
| M03 | Upload validation | Browser | Try unsupported/oversized files, then supported raster image. | Invalid files rejected; valid image previews. |  |  |  |
| M04 | Private source persistence | Controlled test plan | Upload, navigate away, return, refresh. | Owner can retrieve source; it remains private. |  |  |  |
| M05 | Cross-owner access | Two controlled accounts | Request other owner’s private project and asset. | No private record/image returned. |  |  |  |
| M06 | MIME/signature | Mock Worker tests | Upload declared PNG with non-PNG bytes; then valid signature. | Mismatch rejected without write; valid supported image accepted. |  |  |  |
| M07 | Analysis approval | Owner project; optional one live analysis | Request analysis, edit findings, approve/save, reload. | Explicit review; approved revision persists. |  |  |  |
| M08 | Analysis errors | Mock provider/storage | Simulate malformed AI response and save failure. | Invalid output not approved; error visible; quota behavior recorded. |  |  |  |
| M09 | Design settings | Owner project | Save preset/custom values, reload; send invalid API settings in mock. | Valid settings persist; invalid values rejected; analysis unchanged. |  |  |  |
| M10 | Baseline render | Quota available; optional one live render | Explicitly start a baseline render; inspect history/reload. | Baseline provenance/version persists; old render retained. |  |  |  |
| M11 | Enhanced render | Approved analysis/settings; quota available | Explicitly start one enhanced render. | Authorization requires inputs and snapshots them to version. |  |  |  |
| M12 | Quota/duplicate click | Mock Worker | Test quota limit, concurrent requests, AI/upload/commit failures. | 429 at limit; one active generation; no automatic retries; charge behavior documented. |  |  |  |
| M13 | Version history | Project with two versions | Switch active version; edit name/notes; reload. | Correct image selected; provenance unchanged. |  |  |  |
| M14 | Legacy compatibility | Legacy fixture | Load legacy project; add a new render in controlled staging. | Legacy image represented and retained; new version appended. |  |  |  |
| M15 | Fidelity scoring | Saved render | Rate six criteria with some/all cannot determine; save/reload/revise. | Exclusion and insufficient-evidence rules correct; revision retains original. |  |  |  |
| M16 | Fidelity export privacy | Saved assessment with test identifiers | Download JSON/CSV and inspect fields in text editor. | Direct IDs, private source, settings and analysis omitted; formulas escaped. |  |  |  |
| M17 | Dataset/pair validation | Project with both modes | Register plan; pair one existing baseline and enhanced render. | Pair references same approved source and exact versions. |  |  |  |
| M18 | Research metrics/export | Fixture-backed records | Compare displayed values with hand calculations; export both formats. | Difference is enhanced minus baseline; missing is not zero; exports match records. |  |  |  |
| M19 | Dashboard visibility | Saved experiment | Open Research, visit project and return, refresh. | Saved record remains; metrics hidden until explicit show action. |  |  |  |
| M20 | Blinded review | Pair without saved review | Open A/B, comment, save, attempt replacement. | Mapping retained; review immutable; no secure-blinding claim. |  |  |  |
| M21 | Research authorization | Two accounts, saved workspace | Try cross-owner read/write, edit pair, replace review, delete history. | Cross-owner denied; append-only records retained. |  |  |  |
| M22 | Public share | Owner project | Share; fetch public record signed out/as another account. | Only selected hosted images and approved public fields appear. |  |  |  |
| M23 | Unshare/revoke | Shared test project | Unshare; request record and former URLs. | Record unavailable, assets revoked after propagation, private project works. |  |  |  |
| M24 | Partial failures | Mock storage/KV | Fail writes/commit/public update/unshare cleanup at each boundary. | No previous successful render lost; no false success; recovery documented. |  |  |  |
| M25 | Keyboard/accessibility | Browser and keyboard/screen reader | Traverse upload, settings, analysis, history, fidelity, research, export. | Labels, focus, validation, status/error and disabled controls are understandable. |  |  |  |
| M26 | SSR/runtime | Built artifact and staging | Build/start on deployment runtime; visit public/private routes. | SSR routes render without missing config/browser API failure. |  |  |  |

## Reporting

Record exact test totals, test files, command status, build warnings and audit scope in the final report. Manual tests remain **not run** until actual verification and evidence are supplied. Mock results do not verify live Puter behavior.
