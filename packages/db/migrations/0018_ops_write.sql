-- 0018 運営が対応して書く行（D-075・D-077）と運営の資産の再分離（D-076.5・D-078）。policies/0018 は gen_rls が entities.json から生成
alter table service_registry_versions alter column tenant_id set default app.ops_tenant_id();  -- サービス台帳の可否の版は全社に効く運営の資産（D-076.5）
alter table skill_test_runs alter column tenant_id set default app.ops_tenant_id();            -- 運営のテスト実行（D-078.2）
insert into app.schema_migrations (name) values ('0018_ops_write.sql') on conflict do nothing;
