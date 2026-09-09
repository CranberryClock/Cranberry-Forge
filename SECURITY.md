# Security policy

## Supported versions

Cranberry Forge is pre-1.0. Fixes target the latest revision on `main`; older snapshots are not separately maintained.

## Reporting a vulnerability

Do not post credentials, personal data, or exploit details in a public issue. Use **Security → Report a vulnerability** if private reporting is available on this repository. If that option is unavailable, open a minimal issue requesting a private reporting channel without disclosing the vulnerability itself.

Once a private channel is established, include the affected package or route, impact, reproduction steps, and proposed mitigation. No response-time guarantee is currently offered.

## Integration boundaries

- The optional HTTP companion is for trusted local development, not an authenticated production service. Do not expose it publicly without appropriate authentication, authorization, input/resource limits, and operational hardening.
- Local saves and deterministic random seeds are not trusted server authority. Validate untrusted data at application boundaries.
- Your application owns authentication, multiplayer state, secure persistence, and deployment policy.
- Never commit credentials, environment files, private deployment manifests, customer data, or personal logs. Git history can retain files removed from the latest revision.
