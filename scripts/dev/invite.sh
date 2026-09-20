#!/usr/bin/env bash
# 招待の URL を 1 本作る（招待の画面＝T-U-35 メンバー がまだ無いので、それまでの代わり）。
#   bash scripts/dev/invite.sh [staff|viewer]
set -euo pipefail
cd "$(dirname "$0")/../.."
ROLE="${1:-staff}"
PG=kaname-pg
BASE="${BASE:-http://127.0.0.1:3124}"
API="${API:-http://127.0.0.1:3011}"
EMAIL="invite-$(date +%s)@example.com"
PW="correct-horse-battery-1"
# 招く側の会社を 1 つ作る
TOKEN_JSON=$(curl -s -X POST "$API/api/auth-ext/sign-up" -H 'content-type: application/json' \
  -d "{\"email\":\"boss-$(date +%s)@example.com\",\"password\":\"$PW\",\"company_name\":\"招く会社\"}")
USER_ID=$(printf '%s' "$TOKEN_JSON" | /opt/homebrew/bin/python3 -c 'import sys,json;print(json.load(sys.stdin)["data"]["user_id"])')
TOKEN=$(/opt/homebrew/bin/python3 -c 'import secrets,base64;print(base64.urlsafe_b64encode(secrets.token_bytes(24)).decode().rstrip("="))')
HASH=$(printf '%s' "$TOKEN" | shasum -a 256 | cut -d' ' -f1)
docker exec "$PG" psql -U postgres -d kaname_test -qtAc \
  "insert into invitations (tenant_id, email, role_id, token_hash, expires_at, created_by)
   select m.tenant_id, '$EMAIL', '$ROLE', '$HASH', now() + interval '7 days', m.id
   from members m where m.auth_user_id = '$USER_ID'" >/dev/null
echo "招待（$ROLE）: $BASE/invite/$TOKEN"
echo "  この URL をブラウザに貼ってください。名前とパスワードを入れると参加できます。"
