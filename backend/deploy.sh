#!/usr/bin/env bash
# Deploy Butterbase serverless functions from backend/functions/.
#
# Usage:
#   BUTTERBASE_API_KEY=bb_sk_... ./backend/deploy.sh [function-name ...]
#
# With no arguments, deploys every configured function. The service key is
# read from the environment and must never be committed to this repo.
set -euo pipefail

APP_ID="app_48ul5eszfv7v"
API_BASE="https://api.butterbase.ai"
DIR="$(cd "$(dirname "$0")/functions" && pwd)"

if [[ -z "${BUTTERBASE_API_KEY:-}" ]]; then
  echo "error: set BUTTERBASE_API_KEY in the environment" >&2
  exit 1
fi

# name|auth|path|impersonation|description
CONFIGS=(
  "guest-enroll|none|/guest-enroll|false|Guest checkout: unclaimed pending enrollment + Stripe Checkout session. Public endpoint; pricing computed server-side."
  "claim-enrollments|required|/claim-enrollments|false|Attaches unclaimed enrollments to the caller by verified email match."
  "complete-registration|required|/complete-registration|false|Saves the post-payment registration form for an enrollment the caller owns."
  "class-availability|none|/class-availability|false|Public seat availability (confirmed + fresh pending holds) for a schedule."
  "enroll-guard|required|/enroll|false|Logged-in enrollment with server-side pricing, dynamic product, and Stripe Checkout. Redirect URLs point to the static olivistart.com frontend."
  "stripe-webhook|none|/stripe-webhook|false|Payment fulfillment: re-verifies order status via the billing API, then confirms enrollment and creates home bookings. Idempotent.",
  "sync-enrollment-payment|required|/sync-enrollment-payment|false|On-demand payment sync: reads order status from the billing API as the caller and confirms the enrollment if paid. Called by account/checkout-success pages since billing has no webhook forward.",
  "manage-account|required|/manage-account|false|Account management: update contact info on own enrollments, change password via forgot/reset-password email-code flow.",
  "manage-students|required|/manage-students|false|Student profile CRUD. Parents manage their own children; admin can manage any.",
  "manage-artwork|required|/manage-artwork|false|Artwork photo lifecycle: presigned upload/download URLs and delete, gated on student ownership. Storage calls use the service key."
)

deploy_one() {
  local name="$1" auth="$2" path="$3" impersonation="$4" desc="$5"
  local file="$DIR/$name.js"
  [[ -f "$file" ]] || { echo "error: $file not found" >&2; return 1; }

  python3 - "$name" "$auth" "$path" "$impersonation" "$desc" "$file" <<'PY' > /tmp/bb-deploy-payload.json
import json, os, sys
name, auth, path, impersonation, desc, file = sys.argv[1:7]
payload = {
    "name": name,
    "description": desc,
    "code": open(file).read(),
    "triggers": [{"type": "http", "config": {"auth": auth, "path": path, "method": "POST"}}],
    "allow_service_key_impersonation": impersonation == "true",
    # SERVICE_KEY: the platform does not inject a REST-usable service key into
    # ctx.env, so functions that call billing endpoints receive it here
    # (encrypted at rest, never in the repo).
    "envVars": {"SITE_URL": "https://olivistart.com", "SERVICE_KEY": os.environ["BUTTERBASE_API_KEY"]},
}
json.dump(payload, sys.stdout)
PY

  local out
  out=$(curl -sS -m 30 -X POST \
    -H "Authorization: Bearer $BUTTERBASE_API_KEY" \
    -H "Content-Type: application/json" \
    --data @/tmp/bb-deploy-payload.json \
    "$API_BASE/v1/$APP_ID/functions")
  if echo "$out" | grep -q '"deployedAt"'; then
    echo "deployed: $name"
  else
    echo "FAILED: $name" >&2
    echo "$out" >&2
    return 1
  fi
}

selected=("$@")
for cfg in "${CONFIGS[@]}"; do
  IFS='|' read -r name auth path impersonation desc <<<"$cfg"
  if [[ ${#selected[@]} -gt 0 ]]; then
    match=false
    for s in "${selected[@]}"; do [[ "$s" == "$name" ]] && match=true; done
    $match || continue
  fi
  deploy_one "$name" "$auth" "$path" "$impersonation" "$desc"
done
