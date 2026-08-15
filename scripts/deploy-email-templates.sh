#!/usr/bin/env bash
# Deploy KeyTopia's auth email templates to the hosted Supabase project.
#
# Local dev needs none of this — config.toml wires the same templates into the
# Docker stack. This script pushes them to production via the Management API,
# using each template's <title> as the email subject.
#
# Needs in .env.local (or the environment):
#   SUPABASE_ACCESS_TOKEN   personal token from https://supabase.com/dashboard/account/tokens
#   SUPABASE_PROJECT_REF    defaults to KeyTopia's project ref
set -euo pipefail

RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[1;33m'
BLUE=$'\033[0;34m'
NC=$'\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

TEMPLATES_DIR="$PROJECT_ROOT/supabase/templates"
DEFAULT_SUBJECT="KeyTopia"

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
      # Values already set in the environment win over the file.
      if [[ -z "${!key:-}" ]]; then export "$key=$value"; fi
    fi
  done < "$file"
}

load_env_file "$PROJECT_ROOT/.env.local"
load_env_file "$PROJECT_ROOT/supabase/.env.local"

SUPABASE_ACCESS_TOKEN="${SUPABASE_ACCESS_TOKEN:-}"
SUPABASE_PROJECT_REF="${SUPABASE_PROJECT_REF:-xfthivblhhbhokcptygh}"

if [[ -z "$SUPABASE_ACCESS_TOKEN" ]]; then
  echo -e "${RED}Error: SUPABASE_ACCESS_TOKEN is not set.${NC}"
  echo "Create one at https://supabase.com/dashboard/account/tokens and add it to .env.local"
  exit 1
fi

if [[ ! -d "$TEMPLATES_DIR" ]]; then
  echo -e "${RED}Error: templates directory not found: $TEMPLATES_DIR${NC}"
  exit 1
fi

SUPABASE_ACCESS_TOKEN="$(echo "$SUPABASE_ACCESS_TOKEN" | sed 's/^[=[:space:]]*//;s/[[:space:]]*$//')"

echo -e "${GREEN}Deploying email templates to project:${NC} $SUPABASE_PROJECT_REF"
echo ""

API_URL="https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/config/auth"

echo -e "${BLUE}Fetching current auth config...${NC}"
CURRENT_CONFIG_JSON="$(curl -sS -X GET \
  "$API_URL" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Accept: application/json")"

if [[ -z "$CURRENT_CONFIG_JSON" ]]; then
  echo -e "${RED}Error: Empty response from GET $API_URL${NC}"
  exit 1
fi

TEMPLATE_FILES=(
  "invite.html"
  "confirmation.html"
  "recovery.html"
  "magic_link.html"
  "email_change.html"
  "reauthentication.html"
  "password_changed.html"
  "email_changed.html"
)

PAIRS_FILE="$(mktemp)"
cleanup() { rm -f "$PAIRS_FILE"; }
trap cleanup EXIT

FOUND_COUNT=0
for f in "${TEMPLATE_FILES[@]}"; do
  p="$TEMPLATES_DIR/$f"
  if [[ -f "$p" ]]; then
    echo -e "${GREEN}✓${NC} Found: $f"
    printf "%s\t%s\n" "$f" "$p" >> "$PAIRS_FILE"
    FOUND_COUNT=$((FOUND_COUNT + 1))
  else
    echo -e "${YELLOW}⚠${NC} Missing: $f"
  fi
done

if [[ "$FOUND_COUNT" -eq 0 ]]; then
  echo -e "${RED}Error: No templates found in $TEMPLATES_DIR${NC}"
  exit 1
fi

echo ""
echo -e "${BLUE}Building payload (subjects from <title>)...${NC}"

PAYLOAD_AND_PLAN="$(
python3 - <<'PY' "$PAIRS_FILE" "$CURRENT_CONFIG_JSON" "$DEFAULT_SUBJECT"
import json, re, sys, pathlib

pairs_path = pathlib.Path(sys.argv[1])
current = json.loads(sys.argv[2])
default_subject = sys.argv[3]
keys = set(current.keys())

# Map local filenames -> Supabase "slug" used in mailer keys
# Subjects use:  mailer_subjects_<slug>
# Content uses:  mailer_templates_<slug>_content
slug_by_file = {
  "invite.html": "invite",
  "confirmation.html": "confirmation",
  "recovery.html": "recovery",
  "magic_link.html": "magic_link",
  "email_change.html": "email_change",
  "reauthentication.html": "reauthentication",
  "password_changed.html": "password_changed_notification",
  "email_changed.html": "email_changed_notification",
}

def extract_title(html: str):
  m = re.search(r"<title[^>]*>(.*?)</title>", html, flags=re.I | re.S)
  if not m:
    return None
  title = re.sub(r"\s+", " ", m.group(1)).strip()
  return title or None

payload = {}
plan = []
warnings = []

for line in pairs_path.read_text(encoding="utf-8").splitlines():
  if not line.strip():
    continue
  filename, path = line.split("\t", 1)
  slug = slug_by_file.get(filename)
  if not slug:
    warnings.append(f"{filename}: no slug mapping, skipped")
    continue

  html = pathlib.Path(path).read_text(encoding="utf-8")

  content_key = f"mailer_templates_{slug}_content"
  subject_key = f"mailer_subjects_{slug}"

  if content_key not in keys:
    warnings.append(f"{filename}: content key not present in GET config: {content_key} (cannot update content)")
  else:
    payload[content_key] = html

  title = extract_title(html)

  if subject_key not in keys:
    if title:
      warnings.append(f"{filename}: found <title> but subject key not present in GET config: {subject_key}")
    plan.append(f"{filename}: subject not updated (missing key {subject_key})")
    continue

  if title:
    payload[subject_key] = title
    plan.append(f"{filename}: subject <- <title> '{title}' (key={subject_key})")
  else:
    existing = current.get(subject_key)
    existing_str = "" if existing is None else str(existing).strip()
    if existing_str == "":
      payload[subject_key] = default_subject
      plan.append(f"{filename}: no <title>; subject empty -> fallback '{default_subject}' (key={subject_key})")
    else:
      plan.append(f"{filename}: no <title>; preserve existing subject (key={subject_key})")

print(json.dumps({"payload": payload, "plan": plan, "warnings": warnings}))
PY
)"

FINAL_PAYLOAD="$(python3 - <<'PY' "$PAYLOAD_AND_PLAN"
import json, sys
print(json.dumps(json.loads(sys.argv[1])["payload"]))
PY
)"

PLAN="$(python3 - <<'PY' "$PAYLOAD_AND_PLAN"
import json, sys
for line in json.loads(sys.argv[1])["plan"]:
  print(line)
PY
)"

WARNINGS="$(python3 - <<'PY' "$PAYLOAD_AND_PLAN"
import json, sys
for w in json.loads(sys.argv[1])["warnings"]:
  print(w)
PY
)"

echo -e "${BLUE}Plan:${NC}"
echo "$PLAN" | sed 's/^/  - /'

if [[ -n "$WARNINGS" ]]; then
  echo ""
  echo -e "${YELLOW}Warnings:${NC}"
  echo "$WARNINGS" | sed 's/^/  - /'
fi

if [[ "$FINAL_PAYLOAD" == "{}" ]]; then
  echo -e "${RED}Error: payload is empty. Nothing to PATCH.${NC}"
  exit 1
fi

echo ""
echo -e "${YELLOW}Patching auth config...${NC}"

set +e
RESPONSE="$(curl -sS -w "\n%{http_code}" -X PATCH \
  "$API_URL" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$FINAL_PAYLOAD")"
CURL_EXIT=$?
set -e

if [[ $CURL_EXIT -ne 0 ]]; then
  echo -e "${RED}✗ curl failed (exit code $CURL_EXIT)${NC}"
  exit 1
fi

HTTP_CODE="$(echo "$RESPONSE" | tail -n 1)"
BODY="$(echo "$RESPONSE" | sed '$d')"

if [[ "$HTTP_CODE" == "200" ]]; then
  echo -e "${GREEN}✓ Successfully deployed templates + subjects (from <title> where present).${NC}"
  echo ""
  echo "Dashboard:"
  echo "  https://supabase.com/dashboard/project/$SUPABASE_PROJECT_REF/auth/templates"
else
  echo -e "${RED}✗ Failed to deploy${NC}"
  echo "HTTP Status: $HTTP_CODE"
  echo "Response:"
  echo "$BODY"
  exit 1
fi
