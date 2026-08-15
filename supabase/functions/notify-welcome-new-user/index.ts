// Supabase Edge Function (Deno): send the KeyTopia welcome email once per user.
//
// Invoked by a database webhook on auth.users (see docs/supabase-setup.md).
// Fires on the first moment an account really exists for KeyTopia's flows:
//   - OAuth (Google): INSERT arrives with email_confirmed_at already set.
//   - Magic link: the row is INSERTed unconfirmed when the link is requested,
//     then an UPDATE sets email_confirmed_at when it is clicked.
// Both event types are accepted; the gate is "confirmed email we have not
// welcomed before", enforced by public.welcome_emails (PK user_id).
//
// Secrets (supabase secrets set, or supabase/functions/.env locally):
//   RESEND_API_KEY          required to actually send
//   WELCOME_WEBHOOK_SECRET  optional; when set, requests must carry it in the
//                           x-welcome-secret header
//   RESEND_FROM_EMAIL       default hello@keytopia.app
//   SITE_URL                default https://keytopia.app

import { createClient } from 'npm:@supabase/supabase-js@2';

const RESEND_API_URL = 'https://api.resend.com/emails';
const LOGO_URL =
  'https://xfthivblhhbhokcptygh.supabase.co/storage/v1/object/public/app/public/logo-512.png';

interface AuthUserRecord {
  id: string;
  email: string | null;
  email_confirmed_at?: string | null;
  raw_user_meta_data?: Record<string, unknown> | null;
}

interface WebhookPayload {
  type?: string;
  table?: string;
  schema?: string;
  record?: AuthUserRecord;
  old_record?: AuthUserRecord | null;
}

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** First name only, from whichever key the auth provider populated. */
function extractFirstName(meta: Record<string, unknown> | null | undefined): string | null {
  if (!meta) return null;
  const candidate =
    meta['given_name'] ?? meta['name'] ?? meta['full_name'] ?? meta['display_name'] ?? null;
  if (typeof candidate === 'string' && candidate.trim().length > 0) {
    return candidate.trim().split(/\s+/)[0];
  }
  return null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** A chunky keycap, the same visual language as the app. Pure inline CSS, email-safe. */
function keycap(letter: string): string {
  return `<td style="padding:0 5px;">
    <div style="width:44px;height:44px;background:#1a2246;border:2px solid #2c3865;border-bottom-width:5px;border-radius:12px;text-align:center;line-height:40px;font-size:20px;font-weight:700;color:#f4f6ff;">${letter}</div>
  </td>`;
}

function step(n: number, title: string, body: string): string {
  return `<tr>
    <td style="padding:0 0 18px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td valign="top" style="width:40px;padding-top:1px;">
            <div style="width:30px;height:30px;background:#3ec9a7;border-radius:50%;text-align:center;line-height:30px;font-size:14px;font-weight:700;color:#06231c;">${n}</div>
          </td>
          <td valign="top" style="padding-left:12px;font-size:15px;line-height:1.55;color:#c3cce6;">
            <strong style="display:block;color:#f4f6ff;margin-bottom:2px;">${title}</strong>
            ${body}
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
}

function buildEmailHtml(firstName: string | null, siteUrl: string): string {
  const greeting = firstName ? `Welcome aboard, ${escapeHtml(firstName)}!` : 'Welcome aboard!';
  return `<!doctype html>
<html lang="en">

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="color-scheme" content="light">
  <title>Welcome to KeyTopia</title>
</head>

<body style="margin:0;padding:0;background:#0b1020;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:#0b1020;">
    Your account is ready. Here is how the adventure works.&nbsp;&nbsp;&nbsp;
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0b1020;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;background:#131a35;border:1px solid #232d55;border-radius:18px;padding:36px;">
          <tr>
            <td align="center" style="padding-bottom:14px;">
              <a href="${siteUrl}" target="_blank" style="text-decoration:none;display:inline-block;">
                <img src="${LOGO_URL}" width="80" height="80" alt="KeyTopia"
                  style="width:80px;height:80px;display:block;border:0;border-radius:18px;">
              </a>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-bottom:22px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                ${keycap('K')}${keycap('E')}${keycap('Y')}
              </tr></table>
            </td>
          </tr>
          <tr>
            <td align="center" style="font-size:24px;font-weight:700;color:#f4f6ff;padding-bottom:8px;">${greeting}</td>
          </tr>
          <tr>
            <td align="center" style="font-size:15px;line-height:1.6;color:#c3cce6;padding-bottom:28px;">
              Your KeyTopia account is ready. Every keyboard is a world,<br>and your family just got the keys.
            </td>
          </tr>
          <tr>
            <td style="font-size:16px;font-weight:700;color:#f4f6ff;padding-bottom:14px;">How it works</td>
          </tr>
${step(1, 'Create a profile for each kid', 'Everyone gets their own world, their own pace, and their own progress. Nothing is shared between explorers.')}
${step(2, 'Play through the journey', 'Lessons live on a map. Finish one and the next island unlocks, with new keys to master along the way.')}
${step(3, 'Progress follows you everywhere', 'XP, badges and records sync to your account automatically, so any device picks up right where they left off.')}
          <tr>
            <td align="center" style="padding:10px 0 26px 0;">
              <a href="${siteUrl}" target="_blank"
                 style="display:inline-block;background:#3ec9a7;color:#06231c;font-size:16px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:12px;">
                Start exploring
              </a>
            </td>
          </tr>
          <tr>
            <td align="center" style="font-size:13px;line-height:1.6;color:#7d88a8;border-top:1px solid #232d55;padding-top:18px;">
              You are getting this because an account was just created at
              <a href="${siteUrl}" style="color:#3ec9a7;text-decoration:underline;">keytopia.app</a> with this address.<br>
              Not you? You can safely ignore this email.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>

</html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // Accepted credentials, any one suffices. All are compared in code; the
  // gateway's verify_jwt=true would NOT replace this, since it accepts any
  // valid project JWT, including the public anon key.
  //   - apikey: <sb_secret_... key>. The current Supabase convention for
  //     webhooks calling functions. SUPABASE_SECRET_KEYS is auto-injected as
  //     a JSON object keyed by key name.
  //   - Authorization: Bearer <legacy service role key>. Works until legacy
  //     JWT keys are disabled on the project.
  //   - x-welcome-secret: WELCOME_WEBHOOK_SECRET, for callers that should not
  //     hold a project key (e.g. local curl testing).
  let secretKeys: string[] = [];
  let defaultSecretKey = '';
  try {
    const parsed = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}');
    secretKeys = Object.values(parsed).filter((v): v is string => typeof v === 'string');
    if (typeof parsed['default'] === 'string') defaultSecretKey = parsed['default'];
  } catch {
    // Legacy runtime without the new env var; fall through to the other checks.
  }
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const secret = Deno.env.get('WELCOME_WEBHOOK_SECRET') || '';
  const apikeyHeader = req.headers.get('apikey') || '';
  const apikeyOk = apikeyHeader.length > 0 && secretKeys.includes(apikeyHeader);
  const bearerOk = serviceKey && req.headers.get('authorization') === `Bearer ${serviceKey}`;
  const secretOk = secret && req.headers.get('x-welcome-secret') === secret;
  if ((secretKeys.length > 0 || serviceKey || secret) && !apikeyOk && !bearerOk && !secretOk) {
    return json({ error: 'Unauthorized' }, 401);
  }

  let payload: WebhookPayload;
  try {
    payload = (await req.json()) as WebhookPayload;
  } catch {
    return json({ error: 'Invalid JSON payload' }, 400);
  }

  const record = payload.record;
  if (!record?.id) return json({ error: 'Missing record or id' }, 400);
  if (payload.schema !== 'auth' || payload.table !== 'users') {
    return json({ ignored: true, reason: 'Not an auth.users event' });
  }
  if (!record.email) {
    return json({ ignored: true, reason: 'No email on record' });
  }
  if (!record.email_confirmed_at) {
    // Magic-link INSERT before the link is clicked. The confirming UPDATE
    // will re-invoke us.
    return json({ ignored: true, reason: 'Email not confirmed yet' });
  }

  // Prefer the new secret key for the DB client; fall back to the legacy
  // service role key on runtimes that predate SUPABASE_SECRET_KEYS.
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') || '',
    defaultSecretKey || secretKeys[0] || serviceKey,
  );

  // Idempotency gate: exactly one row per user ever inserts successfully.
  const { data: claimed, error: claimError } = await supabase
    .from('welcome_emails')
    .insert({ user_id: record.id, email: record.email })
    .select('user_id')
    .maybeSingle();

  if (claimError) {
    if (claimError.code === '23505') {
      return json({ ignored: true, reason: 'Welcome already sent' });
    }
    console.error('welcome_emails claim failed', claimError);
    return json({ error: 'Could not record welcome send' }, 500);
  }
  if (!claimed) return json({ ignored: true, reason: 'Welcome already sent' });

  const resendApiKey = Deno.env.get('RESEND_API_KEY') || '';
  if (!resendApiKey) {
    console.error('RESEND_API_KEY not set; welcome email not sent', { userId: record.id });
    return json({ ignored: true, reason: 'RESEND_API_KEY not configured' });
  }

  const siteUrl = (Deno.env.get('SITE_URL') || 'https://keytopia.app').replace(/\/$/, '');
  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'hello@keytopia.app';
  const firstName = extractFirstName(record.raw_user_meta_data);

  const response = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `KeyTopia <${fromEmail}>`,
      to: [record.email],
      subject: firstName ? `Welcome to KeyTopia, ${firstName}!` : 'Welcome to KeyTopia!',
      html: buildEmailHtml(firstName, siteUrl),
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error('Resend send failed', { status: response.status, body });
    // Release the claim so a retry can send.
    await supabase.from('welcome_emails').delete().eq('user_id', record.id);
    return json({ error: 'Resend send failed' }, 502);
  }

  console.log('Welcome email sent', { userId: record.id });
  return json({ sent: true });
});
