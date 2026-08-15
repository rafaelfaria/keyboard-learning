#!/usr/bin/env bash
# Point the hosted Supabase project's auth mailer at Resend over SMTP.
#
# Supabase's built-in mailer is capped at a handful of emails per hour and sends
# from a shared address — fine for testing, not for real sign-ins. This wires
# the production project to Resend so magic links come from @keytopia.app.
#
# One-time prerequisites (dashboard work, can't be scripted):
#   1. https://resend.com — create an account.
#   2. Domains → Add Domain → keytopia.app, then add the DNS records Resend
#      shows (SPF + DKIM) at the domain's DNS provider and wait for "Verified".
#   3. API Keys → Create API Key (name it "keytopia-supabase", "Sending access"
#      is enough).
#
# Needs in .env.local (or the environment):
#   RESEND_API_KEY          the key from step 3 (starts with re_)
#   SUPABASE_ACCESS_TOKEN   personal token from https://supabase.com/dashboard/account/tokens
#   SUPABASE_PROJECT_REF    defaults to KeyTopia's project ref
#   SMTP_SENDER_EMAIL       falls back to RESEND_FROM_EMAIL, then hello@keytopia.app
#                           (must be on the verified domain)
set -euo pipefail

RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
BLUE=$'\033[0;34m'
YELLOW=$'\033[1;33m'
NC=$'\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

load_env_file() {
  local file="$1"
  [[ -f "$file" ]] || return 0
  echo -e "${BLUE}Loading environment variables from ${file#$PROJECT_ROOT/}...${NC}"
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="$(echo "$line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
    [[ -z "$line" || "$line" == \#* ]] && continue
    if [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; then
      local key="${line%%=*}"
      local value="${line#*=}"
      value="$(echo "$value" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
      if [[ "$value" == \"*\" && "$value" == *\" ]]; then
        value="${value:1:${#value}-2}"
      elif [[ "$value" == \'*\' && "$value" == *\' ]]; then
        value="${value:1:${#value}-2}"
      fi
      if [[ -z "${!key:-}" ]]; then export "$key=$value"; fi
    fi
  done < "$file"
}

load_env_file "$PROJECT_ROOT/.env.local"
load_env_file "$PROJECT_ROOT/supabase/.env.local"

RESEND_API_KEY="${RESEND_API_KEY:-}"
SUPABASE_ACCESS_TOKEN="${SUPABASE_ACCESS_TOKEN:-}"
SUPABASE_PROJECT_REF="${SUPABASE_PROJECT_REF:-xfthivblhhbhokcptygh}"
SMTP_SENDER_EMAIL="${SMTP_SENDER_EMAIL:-${RESEND_FROM_EMAIL:-hello@keytopia.app}}"
SMTP_SENDER_NAME="${SMTP_SENDER_NAME:-KeyTopia}"

if [[ -z "$RESEND_API_KEY" ]]; then
  echo -e "${RED}Error: RESEND_API_KEY is not set.${NC}"
  echo "Create one at https://resend.com/api-keys and add it to .env.local"
  exit 1
fi
if [[ -z "$SUPABASE_ACCESS_TOKEN" ]]; then
  echo -e "${RED}Error: SUPABASE_ACCESS_TOKEN is not set.${NC}"
  echo "Create one at https://supabase.com/dashboard/account/tokens and add it to .env.local"
  exit 1
fi

# Sanity-check the Resend key and domain verification before touching Supabase:
# a typo'd key or unverified domain would otherwise break every sign-in email.
echo -e "${BLUE}Checking Resend API key and domain status...${NC}"
DOMAINS_JSON="$(curl -sS -w "\n%{http_code}" https://api.resend.com/domains \
  -H "Authorization: Bearer $RESEND_API_KEY")"
DOMAINS_CODE="$(echo "$DOMAINS_JSON" | tail -n 1)"
DOMAINS_BODY="$(echo "$DOMAINS_JSON" | sed '$d')"

if [[ "$DOMAINS_CODE" != "200" ]]; then
  echo -e "${YELLOW}⚠ Could not list Resend domains (HTTP $DOMAINS_CODE).${NC}"
  echo "  A key with 'Sending access' only can't list domains — that's fine,"
  echo "  but make sure the sender domain is verified in the Resend dashboard."
else
  python3 - <<'PY' "$DOMAINS_BODY" "$SMTP_SENDER_EMAIL"
import json, sys
body = json.loads(sys.argv[1])
sender_domain = sys.argv[2].split("@")[-1].lower()
domains = body.get("data", [])
match = next((d for d in domains if d.get("name", "").lower() == sender_domain), None)
if match is None:
    print(f"  ⚠ Domain '{sender_domain}' not found in Resend — add and verify it first.")
    sys.exit(1)
status = match.get("status", "unknown")
if status != "verified":
    print(f"  ⚠ Domain '{sender_domain}' is '{status}', not 'verified' — finish DNS setup first.")
    sys.exit(1)
print(f"  ✓ Domain '{sender_domain}' is verified in Resend.")
PY
fi

API_URL="https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/config/auth"

echo -e "${BLUE}Configuring Supabase auth SMTP -> Resend for project $SUPABASE_PROJECT_REF...${NC}"

PAYLOAD="$(python3 - <<'PY' "$SMTP_SENDER_EMAIL" "$SMTP_SENDER_NAME" "$RESEND_API_KEY"
import json, sys
print(json.dumps({
  "external_email_enabled": True,
  "smtp_host": "smtp.resend.com",
  "smtp_port": "465",
  "smtp_user": "resend",
  "smtp_pass": sys.argv[3],
  "smtp_admin_email": sys.argv[1],
  "smtp_sender_name": sys.argv[2],
  # The Resend free tier allows 3,000/month; 100/hour is a sane auth ceiling.
  "rate_limit_email_sent": 100,
}))
PY
)"

RESPONSE="$(curl -sS -w "\n%{http_code}" -X PATCH \
  "$API_URL" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")"

HTTP_CODE="$(echo "$RESPONSE" | tail -n 1)"
BODY="$(echo "$RESPONSE" | sed '$d')"

if [[ "$HTTP_CODE" == "200" ]]; then
  echo -e "${GREEN}✓ Supabase auth now sends through Resend as \"$SMTP_SENDER_NAME <$SMTP_SENDER_EMAIL>\".${NC}"
  echo ""
  echo "Verify in the dashboard:"
  echo "  https://supabase.com/dashboard/project/$SUPABASE_PROJECT_REF/settings/auth"
  echo "Then send yourself a magic link from the production site to confirm delivery."
else
  echo -e "${RED}✗ Failed to update SMTP settings${NC}"
  echo "HTTP Status: $HTTP_CODE"
  echo "Response:"
  echo "$BODY"
  exit 1
fi
