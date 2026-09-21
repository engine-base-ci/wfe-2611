#!/usr/bin/env bash
# 自動テストが作った口座だけを消す（あなたが手で作ったものは触らない）。
#   bash scripts/dev/clean-qa.sh
# 消す対象は宛先が qa- / delivered+ で始まるもの（tests/_lib/api.ts の uniqEmail・realMailEmail）。
set -uo pipefail
cd "$(dirname "$0")/../.."
PG=${PG_CONTAINER:-kaname-pg}
DB=${DB_NAME:-kaname_test}
SQL=$(cat <<'EOS'
with qa as (
  select id from kaname_auth."user" where email like 'qa-%' or email like 'delivered+%'
), mem as (
  select id, tenant_id from members where auth_user_id in (select id from qa)
), ten as (
  select distinct tenant_id as id from mem
)
select count(*) from ten;
EOS
)
n=$(docker exec "$PG" psql -U postgres -d "$DB" -tAc "$SQL" 2>/dev/null | tr -d ' ')
docker exec "$PG" psql -U postgres -d "$DB" -q -c "
do \$\$
declare t uuid;
begin
  for t in
    select distinct m.tenant_id from members m
    join kaname_auth.\"user\" u on u.id = m.auth_user_id
    where u.email like 'qa-%' or u.email like 'delivered+%'
  loop
    -- 子から順に消す（外部キーの向きに従う）
    delete from permissions where tenant_id = t;
    delete from members      where tenant_id = t;
    delete from scopes       where tenant_id = t;
    delete from layers       where tenant_id = t;
    delete from tenants      where id = t;
  end loop;
  delete from kaname_auth.pending_signup where email like 'qa-%' or email like 'delivered+%';
  delete from kaname_auth.\"user\"        where email like 'qa-%' or email like 'delivered+%';
end \$\$;" 2>&1 | grep -v "^$" | tail -3
left=$(docker exec "$PG" psql -U postgres -d "$DB" -tAc "select count(*) from kaname_auth.\"user\"" 2>/dev/null | tr -d ' ')
echo "自動テストの会社 ${n:-0} 社を消した。残っている利用者 ${left:-?} 人（手で作ったものだけ）"
