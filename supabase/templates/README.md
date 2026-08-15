# Auth email templates

KeyTopia-branded templates for every email Supabase Auth can send. Dark card
layout matching the app (background `#0b1020`, card `#131a35`, accent
`#3ec9a7`), with the logo served from the project's public storage bucket.
Each file's `<title>` doubles as the production email subject.

| File | When it's sent |
| --- | --- |
| `magic_link.html` | passwordless sign-in link — the email almost every user gets |
| `confirmation.html` | welcome + confirm email on signup (when confirmations are on) |
| `invite.html` | dashboard-issued user invitations |
| `recovery.html` | password reset (KeyTopia is passwordless, but the slot exists) |
| `email_change.html` | confirm a change of account email |
| `reauthentication.html` | 6-digit OTP for sensitive actions |
| `password_changed.html` | notification after a password change |
| `email_changed.html` | notification after an email change |

## Local

Wired up in `supabase/config.toml` — `npm run db:restart` after editing, then
catch them in Mailpit with `npm run db:mail`.

## Production

```bash
npm run deploy:templates
```

Pushes content + subjects to the hosted project through the Management API.
Needs `SUPABASE_ACCESS_TOKEN` in `.env.local`
(create at https://supabase.com/dashboard/account/tokens).

## Template variables

- `{{ .ConfirmationURL }}` — the action link (sign-in, confirm, reset…)
- `{{ .Token }}` — 6-digit OTP
- `{{ .SiteURL }}` — the project's site URL
- `{{ .Email }}` / `{{ .NewEmail }}` / `{{ .OldEmail }}` — addresses involved

Full list: https://supabase.com/docs/guides/auth/auth-email-templates
