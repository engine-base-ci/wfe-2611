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
# 証跡の表は DELETE を禁じるトリガを持つ（本番では正しい）。dev の後片付けの間だけ外す
docker exec "$PG" psql -U postgres -d "$DB" -q -c "
set session_replication_role = replica;
do \$\$
declare t uuid; r text; i int;
begin
  for t in
    select distinct m.tenant_id from members m
    join kaname_auth.\"user\" u on u.id = m.auth_user_id
    where u.email like 'qa-%' or u.email like 'delivered+%'
  loop
    -- tenant_id を持つ表を全部消してから親を消す（表どうしの参照があるので 3 周まわす）
    for i in 1..3 loop
      for r in
        select table_name from information_schema.columns
        where table_schema = 'public' and column_name = 'tenant_id' and table_name <> 'tenants'
      loop
        begin
          execute format('delete from %I where tenant_id = \$1', r) using t;
        exception when foreign_key_violation then null;  -- 次の周で消える
        end;
      end loop;
    end loop;
    delete from scopes  where tenant_id = t;
    delete from layers  where tenant_id = t;
    delete from tenants where id = t;
  end loop;
  delete from kaname_auth.pending_signup where email like 'qa-%' or email like 'delivered+%';
  delete from kaname_auth.\"user\"        where email like 'qa-%' or email like 'delivered+%';
end \$\$;
set session_replication_role = origin;" 2>&1 | grep -v "^$" | tail -3
left=$(docker exec "$PG" psql -U postgres -d "$DB" -tAc "select count(*) from kaname_auth.\"user\"" 2>/dev/null | tr -d ' ')
echo "自動テストの会社 ${n:-0} 社を消した。残っている利用者 ${left:-?} 人（手で作ったものだけ）"
