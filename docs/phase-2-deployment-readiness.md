# Phase 2.7 deployment readiness

## Status

**Prepared for review; not deployed.** Repository checks cover build/type/mock-test behavior only. This report does not claim production security or penetration testing. Worker platform identity, private/public storage, live quota, and hosted asset revocation still need controlled validation.

## Release checklist

| Check | Status | Evidence/action |
| --- | --- | --- |
| TypeScript typecheck | **Passed** | `npm run typecheck` |
| Mocked regression suite | **Passed: 20 files, 140 tests** | `npm run test:run`; 0 failed |
| Production build | **Passed** | `npm run build`; client and SSR bundles produced |
| Diff validation | **Passed** | `git diff --check`; only Windows line-ending notices |
| Dependency audit | **Offline snapshot: 0 reported vulnerabilities** | Run online `npm audit` before release; cached advisory data is not current registry assurance |
| Worker endpoint | Manual pending | Confirm `VITE_PUTER_WORKER_URL` targets intended deployed Worker and current routes |
| Secrets/configuration | Source review | `VITE_*` values are public; no secrets in client bundle; platform secrets remain server-side |
| Auth/ownership | Mocked coverage; live pending | Verify owner and second-account access in staging |
| Private storage | Mocked coverage; live pending | Verify ACL isolation, response cache, file limit and signature checks |
| Sharing/unsharing | Source/mock review; live pending | Verify public serialization and hosted URL/CDN revocation |
| Persistence/reload | Mocked coverage; live pending | Exercise analysis, settings, versions, fidelity records, workspace and project reload |
| Quota/locks | Mocked coverage; live pending | Validate with a controlled account; no automated AI calls |
| Research integrity | Unit/mocked coverage; manual review pending | Compare fixture calculations and actual exports with source records |
| Accessibility/manual UX | Not run | Complete M25 in `phase-2-regression-test-plan.md` |
| Manual end-to-end | Not run | Complete applicable M01–M26; attach evidence |
| Deployment approval | Not performed | User approval remains necessary before deployment |

## Prerequisites and configuration

- Use `package-lock.json` with `npm ci`. Dockerfile targets Node 24 Alpine; Docker was not run.
- Set `VITE_PUTER_WORKER_URL` at build time. It is a public endpoint and must not contain a secret.
- Verify Puter authentication, Worker routes, caller KV/filesystem permissions, shared KV access, AI entitlement and public hosting setup in the target account.
- Confirm deployed Worker source matches `lib/puter.worker.js`; this workflow does not deploy it.
- Verify the host supports the built React Router server entry, expected Node runtime and port/health checks.

## Rollback and monitoring

No release was deployed and no rollback performed. Before deployment record application/Worker versions, preserve required research records, and define platform rollback steps. Code rollback does not reverse KV changes or revoke already published URLs.

The repository has some local timing/error logs but no centralized audit log or alerting implementation was found. Avoid logging tokens, images, analyses, reviewer identifiers, or research text. Use platform monitoring for Worker errors, quota denials, lock conflicts, file failures, and public revocation outcomes after confirming the available signals.

## Open release gates

1. Live staging check of identity injection and private/public storage boundaries.
2. Live share/unshare and CDN revocation check.
3. Controlled partial-failure/recovery validation across asset/KV calls.
4. Manual UX/accessibility completion.
5. Current online dependency audit.
6. Owner review of export contents and pseudonymization limitations.
7. Confirm Worker endpoint/version; deployment remains outside this milestone.

Build warnings: Puter SDK polyfills emit two `COMMONJS_VARIABLE_IN_ESM` compatibility warnings (`localStorage.js`, `xhrshim.js`). Vite/Rolldown also reports React Router plugin timing. These did not fail the build. Vitest reports jsdom environment startup cost and suggests a different pool/isolation option; isolation remains enabled to preserve test separation.
