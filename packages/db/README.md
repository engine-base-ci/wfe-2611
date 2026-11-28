# packages/db — 関門 C2（永続化）

業務ロジックが DB に触る唯一の入口。`createRepository(pool)` → `repository.table("<表>").list / get / create / update / softDelete`。

関門の中で 1 回だけやること：テナント文脈（`withTenant`・SET LOCAL）／RLS の前提保証（policy は `scripts/ci/gen_rls.py` が entities.json から生成）／監査列（created_by・updated_by）／論理削除の強制／識別子の許可リスト（文字列連結なし・G10）／証跡（`app.record_audit`・同じトランザクション）／接続プール（`createPool`：max・connectionTimeout・statement_timeout・G-16／G-15）。

CI：G4 `ci:rls-enabled`／G5 `ci:no-vendor-sql`／G6 `ci:context-set`／G10 `ci:no-sql-concat`／G12 `ci:migration-integration`（まっさらな DB に当てて捨てる）／G17 `ci:choke -- --id C2`／G33 `ci:access-matrix`／G35 `ci:resource-static`。
表を足す：`migrations/NNNN_*.sql` → `src/index.ts` の MIGRATIONS → `gen_rls.py` で `policies/NNNN_*.sql` → `src/repository.ts` の TABLES → `src/seeds.ts` の種（G33 が全場合を流す）。
