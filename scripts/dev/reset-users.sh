#!/usr/bin/env bash
# 利用者を消して、新規登録からやり直せるようにする（開発の DB だけ）。
#   bash scripts/dev/reset-users.sh              … 全員消す
#   bash scripts/dev/reset-users.sh 'qa-%'       … 宛先が合うものだけ消す
# 本番の DB では動かない（名前で門番をする）。
set -uo pipefail
cd "$(dirname "$0")/../.."
PG=${PG_CONTAINER:-kaname-pg}
DB=${DB_NAME:-kaname_dev}
LIKE=${1:-%}
case "$DB" in *test*|*dev*|*local*) ;; *) echo "開発の DB ではないので止めます（$DB）"; exit 1;; esac

before=$(docker exec "$PG" psql -U postgres -d "$DB" -tAc "select count(*) from kaname_auth.\"user\"" | tr -d ' ')
# 証跡の表は DELETE を禁じるトリガを持つ（本番では正しい）。dev の後片付けの間だけ外す
docker exec "$PG" psql -U postgres -d "$DB" -q -c "
set session_replication_role = replica;
do \$\$
declare t uuid; r text; i int;
begin
  for t in
    select distinct m.tenant_id from members m
    join kaname_auth.\"user\" u on u.id = m.auth_user_id
    where u.email like '$LIKE'
  loop
    for i in 1..3 loop   -- 表どうしの参照があるので何周かまわす
      for r in
        -- 会社に属する表は public だけではない（app など他の schema にもある）。
        -- schema を決め打つと、そこだけ消し残る（実際 app.bridge_pairings が 1059 行残った）
        select table_schema||'.'||table_name from information_schema.columns
        where table_schema not in ('pg_catalog','information_schema')
          and column_name = 'tenant_id' and table_name <> 'tenants'
      loop
        begin
          execute format('delete from %s where tenant_id = \$1', r) using t;
        exception when foreign_key_violation then null;
        end;
      end loop;
    end loop;
    delete from scopes  where tenant_id = t;
    delete from layers  where tenant_id = t;
    delete from tenants where id = t;
  end loop;
end \$\$;
-- ★ ここから通常に戻す。replica のままだと外部キーの連鎖削除（user → session・account・twoFactor）も止まり、
--   利用者だけ消えて ログインのセッション・アカウント・2 段階認証 が持ち主なしで残る（2026-09-27 に 1700 行残っていた）
set session_replication_role = origin;
delete from kaname_auth.pending_signup where email like '$LIKE';
delete from kaname_auth.\"user\" where email like '$LIKE';
-- 持ち主のいない行を掃く（前の片付けの残り・連鎖が効かなかった分）
delete from kaname_auth.\"session\"   where \"userId\" not in (select id from kaname_auth.\"user\");
delete from kaname_auth.\"account\"   where \"userId\" not in (select id from kaname_auth.\"user\");
delete from kaname_auth.\"twoFactor\" where \"userId\" not in (select id from kaname_auth.\"user\");
-- 確認コード（端末の信頼・再設定）：全員を消すときは全部、一部のときは期限切れだけ
delete from kaname_auth.verification where '$LIKE' = '%' or \"expiresAt\" < now();" 2>&1 | grep -iE "error|エラー" | head -3
after=$(docker exec "$PG" psql -U postgres -d "$DB" -tAc "select count(*) from kaname_auth.\"user\"" | tr -d ' ')
orphan=$(docker exec "$PG" psql -U postgres -d "$DB" -tAc "select (select count(*) from kaname_auth.\"session\" s where not exists (select 1 from kaname_auth.\"user\" u where u.id = s.\"userId\")) + (select count(*) from kaname_auth.\"account\" a where not exists (select 1 from kaname_auth.\"user\" u where u.id = a.\"userId\")) + (select count(*) from kaname_auth.\"twoFactor\" t where not exists (select 1 from kaname_auth.\"user\" u where u.id = t.\"userId\"))" | tr -d ' ')
echo "利用者 ${before} 人 → ${after} 人（会社 $(docker exec "$PG" psql -U postgres -d "$DB" -tAc 'select count(*) from tenants' | tr -d ' ') 社）／ 持ち主のいない認証の行 ${orphan}"
[ "${orphan:-1}" = "0" ] || { echo "持ち主のいない認証の行が残っています（${orphan}）"; exit 1; }
