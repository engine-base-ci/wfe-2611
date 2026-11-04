-- 0079 既にある表を契約から使えるようにする（K-11・D-128.93・D-128.112・D-128.119）
--   表の中身は変えない。行の守りは policies/0079_contract_tables.sql：PC の仕事と出来事は本人だけ（同じグループの人にも見せない）。
--   pending_signup とパスキーはログインの部品の側（kaname_auth）に置き、業務の表からは読めない（D-128.119）。
insert into app.schema_migrations (name) values ('0079_contract_tables.sql') on conflict do nothing;
