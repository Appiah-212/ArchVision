# ArchVision AI Phase 2 security and privacy review

## Review boundary

This is a source review plus mocked tests, not a penetration test or production security certification. Puter identity injection, KV semantics, filesystem ACLs, hosting/CDN revocation, and provider data handling were not independently checked. No cloud service was changed and no live AI request was made.

## Observed controls

- Protected Worker routes require the Puter user context and generally call `auth.getUser()`. Ownership checks use that UUID for owner-scoped keys; client owner IDs are not authorization evidence.
- Private project and asset routes check ownership. Asset filenames use UUID patterns and owner-derived storage paths. Project/version/evaluation/research schemas and key associations are checked again in the Worker.
- Public responses pass through `withoutPrivateDesignData`, removing analysis, design settings, generation metadata/context, render history, and private fidelity evaluations. Public updates/sharing are owner checked.
- Upload size/type checks run in the Worker; this pass adds a matching PNG/JPEG/GIF/WebP signature check. Private asset responses are `private, no-store` and nosniff.
- Generation has a shared per-user daily counter and per-project lock; enhanced mode requires saved valid analysis/configuration. Version commit checks active authorization.
- Research pairing checks approved dataset, same registered source project, baseline/enhanced modes, exact render/evaluation/rubric links, and provenance snapshots. Paired experiment history and qualitative reviews are append-only in application validation.
- Research and fidelity scores use the versioned six-criterion rubric. CSV output is quoted and formula guarded. Research exports omit direct project identifiers and private asset references. Phase 2.7 fidelity exports omit project/reviewer identifiers, source asset references, settings, and analysis snapshots.
- AI observation/custom text is framed as untrusted in prompts; structured AI output is schema validated. React renders user text through escaped text nodes. Conceptual-use caveats appear in relevant panels.
- JSON API responses now set `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`; 5xx responses now return stable error text instead of caught exception details.

## Issues fixed in this pass

| Issue | Change | Verification |
| --- | --- | --- |
| Upload trusted claimed MIME without checking bytes. | Check supported image signature before storing private source/render files. | Worker tests accept a PNG signature and reject mismatched bytes. |
| Fidelity downloads included raw project/reviewer IDs, private source refs, configuration and analysis snapshot. | Redact these fields and include a pseudonymization limitation in JSON/CSV reports. | Export test checks removed fields and formula escaping. |
| 500 responses forwarded backend exception strings. | Drop extra error details on 5xx; expected client-error extras such as quota reset remain. | Worker persistence tests expect stable generic messages. |
| JSON responses lacked cache/nosniff headers. | Set no-store and nosniff on JSON. | Worker API header tests. |
| Shared-project private backup accepted client-supplied render history/context/evaluations. | Strip server-owned fields before merging private backup, preserving server state. | Worker shared-save regression test. |
| Previously selected metrics remained visible on re-entry to Research route. | Hide experiment metrics by default, add explicit show/hide control, clear display state on route-key change; workspace record is retained. | Research route regression test. |

## Authorization and privacy observations

Project IDs are lookup values, not secrets. Public project reads are intentionally unauthenticated; public objects are sanitized. Private asset retrieval checks owner and stored project reference. Public sharing makes only selected hosted source/active-render assets available, according to source behavior. Actual public ACL and cache revocation require live validation.

Image generation runs in the browser after Worker authorization. The Worker checks owner, current authorization context, asset naming and existence, but cannot verify that bytes came from the configured AI model. A project owner can manipulate their own browser requests. Research provenance is application-recorded, not cryptographic attestation.

Pseudonymization is not guaranteed anonymity. Stable plan/version/evaluation IDs, rare floor-plan attributes, generation settings, and free-text comments can enable linkage. Review exported files before sharing and use study codes.

## Input, output, and reliability risks

- Signature inspection is not full image decoding or malware scanning. Malformed files may still fail downstream. Upload before project metadata save can leave an orphan file.
- Project IDs are generally checked for nonempty strings but do not share one strict character/length policy. There is no common explicit JSON request-body byte limit in the reviewed Worker source.
- Schema validation limits AI structure/length but cannot establish that observations are true or eliminate prompt injection/model errors.
- Some browser diagnostics log project identifiers and platform error objects. No centralized remote logging was found; do not log tokens, raw images, analysis, reviewer identities, or research text.
- Generation and analysis share a 20-operation per-user UTC-day quota. Over-limit increments are reversed; authorization failures attempt rollback. Failures after successful authorization (AI, upload, commit, or analysis persistence) are not refunded in these routes.
- Generation lock acquisition uses KV `incr`/TTL; release is a `get` then decrement, not atomic token release. An expiry/reacquisition race is possible. Project/workspace operations use separate read/validate/write calls, not transactions or compare-and-swap.
- Source upload/project save and public asset/KV operations can be interrupted between calls. Render upload cleanup exists, and deletion checks references to protect successful prior renders, but not every multi-call path has automatic reconciliation.
- Project loading may download source, active render, and all version images into object URLs; a common disposal lifecycle was not found. Research blind preview fetches full project assets even when only two versions are needed. This is a memory/network risk, not measured performance.
- The Worker source permits `Access-Control-Allow-Origin: *`. Authorization still occurs in routes, but actual SDK credential/CORS behavior should be confirmed with Puter.
- Blind review hides mode labels in one panel only; the owner can view modes elsewhere. Do not describe this as secure blinding.

## Remaining risk register

| ID | Risk | Follow-up |
| --- | --- | --- |
| R1 | Platform identity injection, private filesystem ACLs, KV guarantees and public asset revocation are external assumptions. | Validate with controlled Puter accounts and staging. |
| R2 | Browser-submitted render bytes are not provider-attested. | Document as a research limitation; trusted server generation would require a future approved architecture change. |
| R3 | KV multi-call operations race and can partially persist. | Add idempotency/reconciliation using verified platform primitives. |
| R4 | Counter lock release is non-atomic. | Prefer an atomic lease/token primitive if supported; test TTL/reacquisition. |
| R5 | Downstream AI/persistence failures consume quota after authorization. | Make accounting visible and decide a bounded refund/reconciliation policy. |
| R6 | Research free text and stable pseudonyms can identify participants/plans. | Minimize free text and review exports before publication. |
| R7 | Blind review is not secure blinding. | Use separate reviewer workflow if concealment is methodologically required. |
| R8 | Blob URLs and fetching all historical images can raise browser memory/network use. | Add unmount/replacement revocation and load only needed review images. |
| R9 | Wildcard CORS and public cache behavior need platform verification. | Confirm staging behavior; restrict origins only if compatible with Puter. |
| R10 | Image signatures do not fully validate/scan image content. | Consider bounded decode/re-encode or scanning if supported by deployment threat model. |

The repository has useful owner checks, schema validation, quotas, private asset references, public/private serialization boundaries, and research associations. This review does not establish production security or hosted-service correctness.
