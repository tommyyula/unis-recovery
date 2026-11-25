# Team workspace

Private team checklist interface, designed for deployment as a GitHub Pages project site.

Only the generic interface belongs in this public repository. Team membership, workspace information and task data must live in an authenticated database.

## Setup status

Production authentication and database configuration are pending. The page currently displays a setup-pending message and does not provide access to team data.

Set `config.js` to the approved Supabase project URL and public publishable key. Never commit a service-role key, private seed data, account lists or incident records.

For GitHub Pages, publish the `main` branch root. The project path is `/unis-recovery/`. All assets use relative paths.
