# Hub real UI: closed V3 integration

Local-only candidate based on hub-prefs-resilience-candidate-20261108. No deployment, credentials, activation, database, Auth settings or billing changes.

Files to integrate into the current application branch:
- src/lib/qa-tool-bridge.ts
- src/components/QaToolAccess.tsx
- src/pages/AppViewer.tsx (import and staging-only component placement)
- src/test/qa-tool-bridge.test.tsx
- src/test/qa-tool-ui.test.tsx
Previous preferences patch is inherited; apply separately if not yet present. Do not replace the whole current repository with this historical candidate.

The real AppViewer staging route now mounts the closed QA component for adsengine/vision-x only. Shipped QA_GATE.enabled is false and owner/window unset. Disabled state creates no iframe, request or code. Production rendering is unchanged. Activation is not part of this delivery and requires separately approved and validated QA server configuration.

Browser contract agreed with Ads and Vision workers: analyticalx.tool-sso.v1; exact ready keys protocol/type/app/nonce/challenge; exact hub:code keys protocol/type/app/nonce/code; exact hub:logout keys protocol/type/app/nonce. 43-character base64url values. Exact iframe Window and fixed QA origin; no wildcard. Both applications use their real root route '/'. Browser protocol version is separate from backend V3 version.

Hub calls only the fixed own-QA Supabase V3 user authorize/revoke route. Existing user session bearer stays in Hub memory and the own-QA request header, never in postMessage, URL or storage. Grants/code cannot be issued without owner identity, ready/active account, no financial/administrative block, exact Hub QA origin and bounded window. Authorization one-shot; no automatic retry. Late completions are dropped after close/session changes. Expiry closes 65 seconds before configured window/JWT end. Close/pagehide/unmount closes bridge and attempts server revocation once after an attempted authorize, without asserting unconfirmed remote success. It does not log out the entire Hub account or claim all sessions ended.

Validation uses synthetic fixtures and mock fetch only, plus existing full offline suite, typecheck and staging build. See final-tests.json, VALIDATION.json, final-*.log. No hosted positive authentication, CSP/frame embedding, live V3 issuance, grant redemption, database access or business functionality was tested. Existing deployed QA settings remain untouched.

Remaining gate: reviewed integration into latest Hub branch, coordinated closed QA preview build, then explicit approval/server setup and owner-present hosted end-to-end verification. Passing this UI build alone does not validate Vision/Ads analysis, plans or historical data.

## Lifecycle review corrections
The QA run is terminal after close, regardless of revocation success. The in-memory shutdown coordinator retains pending requests across unmount and records uncertain revocation. Ordinary Hub logout blocks local session adoption immediately, closes QA peers and waits at most 10.5s for revocation before signOut; signOut continues after failure. No retry/new cycle is started. UI reports uncertain revocation separately.

## Hosted QA publication scope
Only PR1 branch qa/hub-adsengine-sso-20261105 is changed. Full app is under qa/hub-real. Root application and old qa/tool-sso harness are retained. Current main changes (north-star and Lovable preview storage at root) are merged, not erased; migrated QA app intentionally uses owned storage instead of restoring Lovable broker behavior. The build only accepts deploy-preview / review1 / exact site ID / exact Hub preview origin, and refuses gate activation. No financial or production backend is bundled; /api/* returns503.

## Explicit future activation gates (not performed)
- Separate approval and reviewed bounded owner/window configuration for Hub, Ads and Vision, and actual V3 QA server bindings/credentials.
- Hub build currently rejects any enabled QA_GATE and ships CSP frame-src 'none'. A reviewed future change must permit only the two exact QA tool origins for frames; connect-src is already restricted to self and the QA Supabase origin. Keep Hub frame-ancestors none.
- Both tools must explicitly permit framing only by exact Hub QA origin through their own frame-ancestors, retain same-origin browser API transport, fixed audiences, and deny production origins.
- Hosted test must verify preview protection, login identity, full broker contract, cancellation/revocation, effective headers, no production traffic, and logout. Pagehide remains best-effort, never proof of remote revocation.
- Gatefalse remains effective even though UI source exists. No request/code/credential was issued by this implementation work.
