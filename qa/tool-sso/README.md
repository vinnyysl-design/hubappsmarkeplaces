# Private SSO QA foundation

This isolated PR serves only the closed identity/session harness. No app data,
Auth session, database credential, Storage, billing, tracking or Gerador calls.
The production source files remain intact. The Netlify build base is scoped to
this directory; its build refuses contexts other than deploy-preview.

Netlify team protection must be verified before opening this PR. Production stays
public on its existing artifact. Do not merge this branch into production.

The API returns 503 until separately reviewed identity, service and private DB
bindings are installed. This preview is not proof that real SSO already works.
Framing is initially denied; set only the two verified preview origins later,
after the identity gate is qualified. No password entry or email flow exists here.

Publication scope: closed, team-protected Deploy Preview only, for HTTPS/artifact/503 verification. Real SSO and all data bindings remain disabled.
