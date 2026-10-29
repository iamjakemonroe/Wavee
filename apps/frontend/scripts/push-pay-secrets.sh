#!/usr/bin/env bash
# Puts the Worker's payment secrets on Cloudflare (live payments):
#   FLW_SECRET_KEY and FLW_WEBHOOK_HASH, the same as Utopia's (one Flutterwave
#   account, one webhook: Utopia's web-pay-hook passes Wavee's events on, with
#   the same secret hash), read from Utopia's git-ignored env/flutterwave.env;
#   and SUPABASE_SERVICE_ROLE_KEY, Wavee's own (Supabase dashboard > the Wavee
#   project > Project settings > API keys > service_role), pasted when asked.
# Run from anywhere: apps/frontend/scripts/push-pay-secrets.sh
set -euo pipefail
cd "$(dirname "$0")/.."
KEYS="${UTOPIA_ENV:-$HOME/Desktop/Projects/ProjectX/utopia/env/flutterwave.env}"
[ -f "$KEYS" ] || { echo "Missing $KEYS" >&2; exit 1; }
value() { grep -E "^$1=" "$KEYS" | head -1 | cut -d= -f2-; }
secret=$(value FLW_SECRET_KEY)
hash=$(value FLW_WEBHOOK_HASH)
case "$secret" in FLWSECK*) ;; *) echo "FLW_SECRET_KEY in $KEYS should start with FLWSECK." >&2; exit 1 ;; esac
[ "${#hash}" -ge 16 ] || { echo "FLW_WEBHOOK_HASH in $KEYS is missing or short." >&2; exit 1; }
printf '%s' "$secret" | npx wrangler secret put FLW_SECRET_KEY
printf '%s' "$hash" | npx wrangler secret put FLW_WEBHOOK_HASH
echo "Now paste Wavee's service_role key (it isn't shown):"
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
echo "Done. Check: curl -s -X POST https://wavee.kaivon.app/api/pay/status  (want {\"on\":true,\"test\":false})"
