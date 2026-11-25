# Cloudflare team workspace

Cloudflare Worker + D1 + Access. Only the generic interface and implementation are public. Workspace content, personnel, membership and task seed data stay outside this repository.

## Deploy

1. Deploy this directory as a Cloudflare Worker, using `wrangler deploy` and `wrangler.jsonc`. The Worker fails closed until Access is configured.
2. Create a dedicated D1 database, bind it as `DB`, and apply `schema.sql` once. Load the separately held private seed through an administrator connection. Never put private data under `public/`, in Git history or deployment assets.
3. Set up Cloudflare Zero Trust, enable the One-time PIN identity provider, and protect the entire production Worker hostname with an Access self-hosted application. Include only the approved team email addresses and require the `item.com` email domain. Keep preview URLs disabled.
4. Set `ACCESS_TEAM_DOMAIN` to the actual team hostname ending in `.cloudflareaccess.com`, and `ACCESS_AUD` to this application's audience identifier. The server checks JWT signature, issuer, audience, expiry and exact company-email domain; merely supplying an email header grants no access.
5. For every explicitly approved team email, add a row to the private `members` table. Authentication alone does not confer membership. Disable its row to revoke access. No enrollment API is exposed.
6. Verify anonymous denial, a valid invited email-code login, nonmember denial, updates between two separate team sessions, stale-edit conflict handling, sign-out and membership revocation. Then point the GitHub Pages access link at the protected Worker URL.

Updates use a version-checked conditional write. A SQLite trigger records each committed change atomically in the private audit table. Workstream owners are fixed; task assignments are editable. Data refreshes every 20 seconds. There is no browser-local task database.

## Checks

Run `node --test tests/*.test.mjs` on Node 22+ with the built-in SQLite module. Tests cover signed JWT validation, unauthorized callers, membership, cross-origin writes, task updates, audit history, stale writes and revocation. They use generated signing keys and a local SQLite database; production Access and email delivery require live validation.

A standard Cloudflare Workers subdomain can be used initially; a company-owned custom hostname is preferable for ongoing business use. Do not change any existing domain or homepage without a separate deliberate routing change.
