# Local Agentopia setup

Agentopia now uses a local Supabase project named `agentopia-local`. Its configuration and setup records are in `.supabase/local`, which is ignored by Git. Application data persists in the Docker volume `supabase_db_agentopia-local`.

## Open the app

- App: http://127.0.0.1:5173/login
- Supabase database dashboard: http://127.0.0.1:55323
- Supabase API: http://127.0.0.1:55321
- PostgreSQL: `127.0.0.1:55322`, database `postgres`
- Local email inbox: http://127.0.0.1:55324

Enter your email in the app, choose **Login or Sign up**, then enter your name and create a password. This is a fresh database, so previous hosted accounts are not present. Local email signup is enabled and does not require an email confirmation. New accounts receive the standard `user` role. Two persistent local accounts are configured: `admin@agentopia.local` has administrator access, and `user@agentopia.local` has standard user access. Their generated passwords were supplied in the setup chat and are not stored in this document.

Google login is hidden for this local setup because no Google authentication client is configured. AI responses, email delivery, and other external integrations need their own service configuration and credentials. This setup verifies the database and account login; it does not establish that those external features work.

## Restart after closing Docker or restarting Windows

Start Docker Desktop, then run these commands from the Agentopia project directory:

```powershell
./scripts/start-local-backend.ps1
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

The backend startup script preserves existing database data. Run it from its saved location; it changes into the separate local Supabase directory before invoking the CLI. Keep `.supabase/local/supabase/functions` available because the function runtime mounts that directory.

The public `check-email-exists` function is included in the local runtime and uses the project's existing implementation. To serve it explicitly while debugging:

```powershell
Set-Location .supabase/local
supabase functions serve check-email-exists
```

Local connection values are in `.env.local`. The previous version was preserved in `.supabase/local/env.local.before-local-setup`. Backend credentials are in `.supabase/local/status.json`; keep that file private.

## What was restored and verified

The saved `database/schema/current_remote_schema.sql` supplied the initial application schema. The local setup applied 178 subsequent and prerequisite migrations, including the final migrations dated January 2026. The resulting database contains 99 application tables.

Some historical migrations assume a populated hosted database or an older Supabase version. The local migration runner in `.supabase/local/apply-migrations.ps1` records the compatibility fixes and tracks completed migrations in `agentopia_local_setup.applied_migrations`. It preserves the original SQL files. These fixes cover missing prerequisites, renamed tables, obsolete references, empty-database statistics, and newer encryption extension return values.

Signup needed the profile creation trigger restored and the contact-management trigger's function lookup path set to `public, extensions`. Without that path, Supabase's authentication service could not find the nested contact-management function and rolled back new accounts. New accounts now receive a profile and standard user role automatically.

The checks used disposable accounts created only in this local database. They verified email lookup for new and existing users, signup, automatic profile creation, the user role, password login, and rejection of an incorrect password. Browser verification signed in through the application's form and reached the Agents page. All disposable accounts were removed after the checks.

The authentication regression check is available at `.supabase/local/verify-auth.mjs`:

```powershell
node .supabase/local/verify-auth.mjs
```

Database changes were applied in transactions so failed migration attempts rolled back. This local setup is independent of the other Supabase project on ports `54321`–`54324`.
