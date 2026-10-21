# Evidence Index — ArchVision AI Weekly Assignment

**Evidence date:** 21 October 2026. **Environment:** Windows PowerShell/`cmd.exe`, Node v24.11.0, npm 11.6.1. Logs were captured from actual local command executions and include command, timestamp, exit code and duration. They do not contain application credentials or user architectural data.

## Automated command logs

| Evidence | File | Result | Contents / limitation |
|---|---|---|---|
| EV-L01 | `evidence/logs/node-version.log` | Exit 0 | `node --version`; v24.11.0 |
| EV-L02 | `evidence/logs/npm-version.log` | Exit 0 | `npm --version`; 11.6.1 |
| EV-L03 | `evidence/logs/typecheck.log` | Exit 0 | Direct workspace invocation completed React Router type generation and TypeScript validation |
| EV-L04 | `evidence/logs/test-run.log` | Exit 0 | 20 test files and 140 tests passed; duration 61.99 seconds; jsdom startup overhead reported |
| EV-L05 | `evidence/logs/build.log` | Exit 0 | Client and SSR bundles built; two Puter SDK compatibility warnings and one plugin timing notice |
| EV-L06 | `evidence/logs/git-diff-check.log` | Exit 0 | `git diff --check`; no whitespace error emitted |

The listed UTF-8 logs preserve the direct successful workspace executions. Initial wrapper launches produced a transient `spawn EPERM` native-binding error; direct executions then succeeded without installation or source changes. The current 20-file / 140-test count is independently verified by EV-L04, in addition to the historical Phase 2 record.

## Manual screenshot evidence

All screenshot entries are **PENDING MANUAL CAPTURE**. No screenshots have been created or supplied. Use Windows + Shift + S, save genuine PNGs to `evidence/screenshots/`, and ensure account details, private floor plans, tokens and personal information are not visible.

| Evidence ID | Page/terminal and actions | Expected output | What must be visible | Required PNG filename | Test case | Status |
|---|---|---|---|---|---|---|
| A1 | VS Code integrated terminal; open the final test-run log or terminal output showing `npm run test:run` result | Current test runner result, including actual blocker if unresolved; do not imply passed | Command and truthful exit/error or verified test summary; avoid account/path data where possible | `A1-terminal-test-results.png` | EV-L04 / automated suite | PENDING MANUAL CAPTURE |
| A2 | VS Code terminal; show `npm run typecheck` result | Current typecheck result or its actual blocker | Command and complete relevant error/exit | `A2-typecheck-result.png` | EV-L03 | PENDING MANUAL CAPTURE |
| A3 | VS Code terminal; show `npm run build` result | Current build result or its actual blocker | Command and complete relevant error/exit | `A3-build-result.png` | EV-L05 | PENDING MANUAL CAPTURE |
| A4 | Browser; open ArchVision landing/application page | App renders and navigation is available | Browser page and app identity; no personal/account details | `A4-application-running.png` | MA-02 or MA-25 | PENDING MANUAL CAPTURE |
| A5 | Browser; sign in to controlled account, upload synthetic test plan and create project | Project creation and image preview/project entry | Upload completion/project confirmation; use a non-sensitive synthetic plan | `A5-upload-project-created.png` | MA-03 / MA-04 | PENDING MANUAL CAPTURE |
| A6 | Browser; open test project, run one analysis only if explicitly authorized, review/correct and approve | Analysis findings and explicit approval state | Approval/revision indicator and non-sensitive result; redact plan details if private | `A6-analysis-approved.png` | MA-07 | PENDING MANUAL CAPTURE |
| A7 | Browser; open project design configuration and save supported test values | Saved architectural controls | Selected settings and save confirmation; no private plan visible | `A7-design-configuration.png` | MA-09 | PENDING MANUAL CAPTURE |
| A8 | Browser; generation selector/workflow showing baseline and enhanced modes | Both modes and their eligibility/preconditions | Mode controls and relevant state; avoid starting AI call unless authorized | `A8-generation-modes.png` | MA-10 / MA-11 | PENDING MANUAL CAPTURE |
| A9 | Browser; open history with existing render versions and comparison view | Version list and selected image comparison | Version labels/modes and comparison interface; use synthetic renders | `A9-render-history-comparison.png` | MA-13 | PENDING MANUAL CAPTURE |
| A10 | Browser; open structural fidelity assessment for existing test render | Criteria, score or assessment state | Six criteria/status and save/revision state; no personal reviewer identity | `A10-structural-fidelity.png` | MA-15 | PENDING MANUAL CAPTURE |
| A11 | Browser; open Research Evaluation with synthetic/test experiment | Research dashboard and explicit metric visibility control | Dashboard and non-sensitive calculations; redact study identifiers if needed | `A11-research-dashboard.png` | MA-18 / MA-19 | PENDING MANUAL CAPTURE |
| A12 | Browser; attempt safe unsupported small file upload | Clear invalid upload rejection | Rejection message and file type indication; no personal filenames | `A12-invalid-upload-rejected.png` | MA-03 | PENDING MANUAL CAPTURE |

A1–A3 may duplicate command logs; screenshots are optional visual corroboration. The log files are the primary automated command evidence. Never substitute a synthetic screenshot for terminal output or application state.

## Other assignment records

| Artifact | Path | State |
|---|---|---|
| Part A system testing report | `part-a-system-testing-report.md` | Created; run blockers and limitations stated |
| Part B maintenance plan | `part-b-maintenance-plan.md` | Created; proposed practices distinguished from deployed capability |
| Manual acceptance checklist | `manual-acceptance-checklist.md` | Created; 26 cases, all NOT RUN |
| Test coverage and issue matrix | `test-case-matrix.md` | Created; current execution blocked; prior count labeled historical |

