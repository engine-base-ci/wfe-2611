# Kaname 機能分解（functional-breakdown）v3.1 — 2026-09-29

> 信頼源は 07_functional/*.json（05_flow/build_functional.py が機械生成）。この文書は写し。

## 完了サマリー

| 種別 | 件数 | 根拠（source）| 備考 |
|---|---|---|---|
| エンティティ | 105 | 全件 | ER図 §1〜§14 の表から。table_name・tenant_isolation・access_control_policies |
| 機能 | 28 | 全件 | 用事 20 ＋ 関門 8。api_endpoints（下書き）・ears_ac_seed |
| ロール | 5 | 全件 | 権限の型（誰に×何に×どの層で×できること）を access_predicate_expr で |
| 画面 | 64 | 全件 | flow.json と 1 対 1。states はモックの状態タブ、transitions はモックのリンクから |

## エンティティ

| ID | テーブル | 節 | 分離 | 方針 | 根拠 |
|---|---|---|---|---|---|
| E-001 | `tenants` | 1. テナント・組織・メンバー | account_scoped | 3 | D-076 |
| E-002 | `scopes` | 1. テナント・組織・メンバー | account_scoped | 3 | D-026 |
| E-003 | `member_kinds` | 1. テナント・組織・メンバー | none | 2 | D-010 |
| E-004 | `members` | 1. テナント・組織・メンバー | scope_layered | 3 | D-037 D-110 |
| E-005 | `setup_steps` | 1. テナント・組織・メンバー | none | 2 | D-089 |
| E-006 | `clones` | 1. テナント・組織・メンバー | account_scoped | 4 | D-073 |
| E-007 | `ai_employees` | 1. テナント・組織・メンバー | scope_layered | 4 | D-110 |
| E-008 | `goal_kinds` | 2. 会社モデル ── 目標 | none | 2 | D-010 |
| E-009 | `units` | 2. 会社モデル ── 目標 | scope_layered | 3 | D-110 |
| E-010 | `rollup_kinds` | 2. 会社モデル ── 目標 | none | 2 | D-010 |
| E-011 | `goals` | 2. 会社モデル ── 目標 | scope_layered | 3 | D-032 D-034 D-058 D-110 |
| E-012 | `goal_allocations` | 2. 会社モデル ── 目標 | account_scoped | 3 | D-058 |
| E-013 | `goal_contributions` | 2. 会社モデル ── 目標 | account_scoped | 3 | D-010 |
| E-014 | `goal_versions` | 2. 会社モデル ── 目標 | account_scoped | 3 | D-061 D-108.1 D-110 |
| E-015 | `hypotheses` | 2. 会社モデル ── 目標 | scope_layered | 3 | D-035 |
| E-016 | `measures` | 2. 会社モデル ── 目標 | scope_layered | 3 | D-010 |
| E-017 | `validations` | 2. 会社モデル ── 目標 | account_scoped | 3 | D-010 |
| E-018 | `ledger_definitions` | 3. 会社モデル ── 台帳 | scope_layered | 3 | D-038 D-110 |
| E-019 | `ledger_fields` | 3. 会社モデル ── 台帳 | account_scoped | 3 | D-010 |
| E-020 | `ledger_stages` | 3. 会社モデル ── 台帳 | account_scoped | 3 | D-010 |
| E-021 | `ledger_views` | 3. 会社モデル ── 台帳 | scope_layered | 3 | D-010 |
| E-022 | `ledger_records` | 3. 会社モデル ── 台帳 | scope_layered | 3 | D-010 |
| E-023 | `duties` | 4. 会社モデル ── 担当業務・記憶 | scope_layered | 3 | D-110 |
| E-024 | `duty_versions` | 4. 会社モデル ── 担当業務・記憶 | account_scoped | 3 | D-010 |
| E-025 | `learned_procedures` | 4. 会社モデル ── 担当業務・記憶 | scope_layered | 3 | D-010 |
| E-026 | `procedure_steps` | 4. 会社モデル ── 担当業務・記憶 | account_scoped | 3 | D-010 |
| E-027 | `memory_kinds` | 4. 会社モデル ── 担当業務・記憶 | none | 2 | D-010 |
| E-028 | `memories` | 4. 会社モデル ── 担当業務・記憶 | scope_layered | 4 | D-060 D-098.10 D-105 D-105.5 |
| E-029 | `memory_digests` | 4. 会社モデル ── 担当業務・記憶 | account_scoped | 2 | D-105 D-105.2 D-105.3 D-105.4 |
| E-030 | `memory_proposals` | 4. 会社モデル ── 担当業務・記憶 | scope_layered | 3 | D-105 D-105.6 D-105.9 |
| E-031 | `embedding_models` | 4. 会社モデル ── 担当業務・記憶 | none | 2 | D-098.4 D-098.5 D-099.2 D-099.4 |
| E-032 | `search_embeddings` | 4. 会社モデル ── 担当業務・記憶 | scope_layered | 3 | D-098.3 D-098.4 D-098.6 D-099.2 |
| E-033 | `tasks` | 5. 実行・統制 | scope_layered | 3 | D-068 |
| E-034 | `task_handovers` | 5. 実行・統制 | account_scoped | 3 | D-058 D-061 D-068 |
| E-035 | `daily_plans` | 5. 実行・統制 | account_scoped | 4 | D-068 |
| E-036 | `triggers` | 5. 実行・統制 | scope_layered | 3 | D-010 |
| E-037 | `policies` | 5. 実行・統制 | scope_layered | 3 | D-060 |
| E-038 | `approvals` | 5. 実行・統制 | scope_layered | 4 | D-010 |
| E-039 | `action_runs` | 5. 実行・統制 | scope_layered | 3 | D-062 |
| E-040 | `service_registry` | 5. 実行・統制 | account_scoped | 3 | D-013 D-041 D-107 D-107.1 |
| E-041 | `credential_kinds` | 5. 実行・統制 | none | 2 | D-010 |
| E-042 | `credentials` | 5. 実行・統制 | scope_layered | 4 | D-004 D-017 D-108.3 |
| E-043 | `conversations` | 6. 会話・成果物・証跡 | scope_layered | 4 | D-062.5 D-090.1 D-104 D-104.1 |
| E-044 | `bridge_jobs` | 6. 会話・成果物・証跡 | scope_layered | 4 | D-090 D-090.2 D-090.4 D-090.5 |
| E-045 | `bridge_job_states` | 6. 会話・成果物・証跡 | none | 2 | D-090 D-090.4 D-093.3 |
| E-046 | `bridge_job_events` | 6. 会話・成果物・証跡 | scope_layered | 4 | D-093.2 D-093.3 D-093.4 D-093.7 |
| E-047 | `permission_rules` | 6. 会話・成果物・証跡 | scope_layered | 2 | D-104 D-104.14 D-107.2 |
| E-048 | `agent_usage_snapshots` | 6. 会話・成果物・証跡 | account_scoped | 2 | D-104 D-104.16 |
| E-049 | `messages` | 6. 会話・成果物・証跡 | account_scoped | 3 | D-066 D-104 |
| E-050 | `artifacts` | 6. 会話・成果物・証跡 | scope_layered | 4 | D-104 D-106 |
| E-051 | `artifact_versions` | 6. 会話・成果物・証跡 | scope_layered | 4 | D-106 D-106.3 D-106.4 |
| E-052 | `audit_events` | 6. 会話・成果物・証跡 | account_scoped | 3 | D-107 D-110 |
| E-053 | `session_kinds` | 7. マスタ | none | 2 | D-010 |
| E-054 | `revoke_reasons` | 7. マスタ | none | 2 | D-010 |
| E-055 | `layers` | 9. 層と権限 | account_scoped | 3 | D-073 D-073.4 |
| E-056 | `target_kinds` | 9. 層と権限 | none | 2 | D-073 |
| E-057 | `abilities` | 9. 層と権限 | none | 2 | D-073 |
| E-058 | `permissions` | 9. 層と権限 | account_scoped | 3 | D-073 D-073.1 D-073.3 |
| E-059 | `account_events` | 10. 口座状態の出来事・失効・サポートアクセス | account_scoped | 4 | D-074 D-074.1 D-076 D-076.13 |
| E-060 | `account_event_items` | 10. 口座状態の出来事・失効・サポートアクセス | account_scoped | 3 | D-074 D-076.13 |
| E-061 | `sessions` | 10. 口座状態の出来事・失効・サポートアクセス | account_scoped | 3 | D-074 D-076 D-076.1 D-076.13 |
| E-062 | `support_access_grants` | 10. 口座状態の出来事・失効・サポートアクセス | account_scoped | 3 | D-074 D-074.5 D-076.13 |
| E-063 | `retention_holds` | 10. 口座状態の出来事・失効・サポートアクセス | account_scoped | 3 | D-074 D-074.3 D-076.13 |
| E-064 | `erasure_certificates` | 10. 口座状態の出来事・失効・サポートアクセス | account_scoped | 3 | D-074 D-074.3 D-076.13 |
| E-065 | `distributions` | 11. 運営 | ops_scoped | 1 | D-037 D-063 D-073.7 D-074.4 |
| E-066 | `distribution_versions` | 11. 運営 | none | 2 | D-073.7 D-074.4 D-076.10 D-076.5 |
| E-067 | `tenant_distributions` | 11. 運営 | account_scoped | 3 | D-073.7 D-074.4 D-076.10 D-076.5 |
| E-068 | `service_registry_versions` | 11. 運営 | ops_scoped | 1 | D-073.7 D-074.4 D-076 D-076.10 |
| E-069 | `service_requests` | 11. 運営 | account_scoped | 4 | D-073.7 D-074.4 D-076 D-076.10 |
| E-070 | `review_requests` | 11. 運営 | account_scoped | 4 | D-027 D-073.7 D-074 D-074.4 |
| E-071 | `ops_members` | 11. 運営 | ops_scoped | 1 | D-073 D-073.7 D-074.4 D-076.10 |
| E-072 | `ops_audit_events` | 11. 運営 | ops_scoped | 2 | D-073.7 D-074 D-074.4 D-076.10 |
| E-073 | `security_events` | 11. 運営 | account_scoped | 3 | D-073.7 D-074.4 D-075 D-075.6 |
| E-074 | `inquiries` | 12. 運営と顧客の間で往復するもの・自分で整えるもの | account_scoped | 5 | D-069 D-075 D-075.1 D-076 |
| E-075 | `notices` | 12. 運営と顧客の間で往復するもの・自分で整えるもの | ops_scoped | 1 | D-069 D-075 D-075.2 D-076 |
| E-076 | `notice_deliveries` | 12. 運営と顧客の間で往復するもの・自分で整えるもの | account_scoped | 4 | D-069 D-075 D-076 |
| E-077 | `status_incidents` | 12. 運営と顧客の間で往復するもの・自分で整えるもの | ops_scoped | 1 | D-069 D-075 D-075.2 D-076 |
| E-078 | `bridge_releases` | 12. 運営と顧客の間で往復するもの・自分で整えるもの | ops_scoped | 1 | D-015 D-015.7 D-069 D-075 |
| E-079 | `notification_preferences` | 12. 運営と顧客の間で往復するもの・自分で整えるもの | account_scoped | 4 | D-043 D-069 D-075 D-075.3 |
| E-080 | `notifications` | 12. 運営と顧客の間で往復するもの・自分で整えるもの | account_scoped | 4 | D-043 D-069 D-075 D-076 |
| E-081 | `plans` | 12. 運営と顧客の間で往復するもの・自分で整えるもの | ops_scoped | 1 | D-069 D-075 D-076 D-076.6 |
| E-082 | `plan_versions` | 12. 運営と顧客の間で往復するもの・自分で整えるもの | none | 2 | D-069 D-075 D-076 |
| E-083 | `subscriptions` | 12. 運営と顧客の間で往復するもの・自分で整えるもの | account_scoped | 3 | D-069 D-075 D-075.4 D-076 |
| E-084 | `plan_change_requests` | 12. 運営と顧客の間で往復するもの・自分で整えるもの | account_scoped | 5 | D-069 D-075 D-076 |
| E-085 | `usage_meters` | 12. 運営と顧客の間で往復するもの・自分で整えるもの | account_scoped | 3 | D-069 D-075 D-075.5 D-076 |
| E-086 | `invoices` | 12. 運営と顧客の間で往復するもの・自分で整えるもの | account_scoped | 3 | D-002 D-069 D-075 D-075.4 |
| E-087 | `payments` | 12. 運営と顧客の間で往復するもの・自分で整えるもの | account_scoped | 4 | D-069 D-075 D-076 D-077.1 |
| E-088 | `error_events` | 12. 運営と顧客の間で往復するもの・自分で整えるもの | account_scoped | 4 | D-069 D-069.3 D-069.4 D-075 |
| E-089 | `imports` | 13. 取り込み・正規連携・招待・持ち出し・添付 | scope_layered | 3 | D-025 D-026 D-042 D-076 |
| E-090 | `integrations` | 13. 取り込み・正規連携・招待・持ち出し・添付 | scope_layered | 3 | D-026 D-041 D-042 D-076 |
| E-091 | `invitations` | 13. 取り込み・正規連携・招待・持ち出し・添付 | account_scoped | 3 | D-026 D-037 D-042 D-076.3 |
| E-092 | `pending_signup` | 13. 取り込み・正規連携・招待・持ち出し・添付 | none | 2 | D-026 D-042 D-076.3 D-076.4 |
| E-093 | `export_jobs` | 13. 取り込み・正規連携・招待・持ち出し・添付 | account_scoped | 4 | D-026 D-042 D-076.3 D-076.4 |
| E-094 | `attachments` | 13. 取り込み・正規連携・招待・持ち出し・添付 | scope_layered | 3 | D-026 D-042 D-076.3 D-076.4 |
| E-095 | `skills` | 14. スキル | ops_scoped | 1 | D-078 D-078.1 |
| E-096 | `skill_versions` | 14. スキル | none | 2 | D-078 D-078.2 |
| E-097 | `skill_test_runs` | 14. スキル | ops_scoped | 1 | D-078 |
| E-098 | `skill_attachments` | 14. スキル | account_scoped | 3 | D-078 D-078.3 D-078.4 D-078.7 |
| E-099 | `payment_methods` | 15. 段階 2 で足す表 | account_scoped | 3 | D-082 D-082.1 D-082.2 D-085 |
| E-100 | `billing_events` | 15. 段階 2 で足す表 | account_scoped | 3 | D-082 D-082.3 D-082.4 D-085 |
| E-101 | `llm_routes` | 15. 段階 2 で足す表 | account_scoped | 4 | D-082 D-083 D-083.1 D-083.4 |
| E-102 | `llm_capabilities` | 15. 段階 2 で足す表 | none | 2 | D-004 D-082 D-083 D-083.2 |
| E-103 | `push_devices` | 15. 段階 2 で足す表 | account_scoped | 4 | D-082 D-084 D-084.3 D-085 |
| E-104 | `disclosure_versions` | 15. 段階 2 で足す表 | ops_scoped | 1 | D-082 D-085 D-085.1 D-085.2 |
| E-105 | `subprocessors` | 15. 段階 2 で足す表 | ops_scoped | 1 | D-042 D-082 D-085 D-085.2 |

## 機能

| ID | 機能 | 行為 | 画面 | API 下書き | EARS | 根拠 |
|---|---|---|---|---|---|---|
| F-001 | 契約してから、自力で動く状態まで持っていきたい | 7 | 6 | 7 | 10 | D-001 D-001.5 D-002 |
| F-002 | 招かれたので、自分がやることだけ分かる状態にしたい | 1 | 1 | 1 | 1 | D-026 D-037 D-053.3 |
| F-003 | 入れなくなったときに、自分でパスワードを再設定したい | 1 | 1 | 1 | 1 | D-042 D-053.3 |
| F-004 | 今日なにをすればいいか、迷わず決めたい | 19 | 6 | 19 | 73 | D-002 D-003.1 D-003.9 |
| F-005 | 手でやっている繰り返しを、自分の代わりにやらせたい | 5 | 5 | 5 | 11 | D-003.7 D-004 D-004.1 |
| F-006 | AIが勝手に外に出すのが怖い。押す前に中身を見て決めたい | 11 | 9 | 11 | 36 | D-003.7 D-008.2 D-012 |
| F-007 | 案件・請求・問い合わせが今どうなっているか、1か所で見たい | 7 | 5 | 7 | 9 | D-006.2 D-007 D-010 |
| F-008 | 目標に届くのか、届かないなら何を変えるか知りたい | 9 | 7 | 9 | 23 | D-003 D-003.1 D-003.3 |
| F-009 | なぜ届かなかったかを言葉にして、次の打ち手を決めたい | 3 | 3 | 3 | 4 | D-003.1 D-003.3 D-006 |
| F-010 | 人に任せたい。任せても品質が落ちないようにしたい | 12 | 8 | 12 | 18 | D-003.1 D-004.10 D-008 |
| F-011 | 会社のやり方が、人が辞めても消えないようにしたい | 3 | 3 | 3 | 3 | D-003 D-003.1 D-003.3 |
| F-012 | このツールを入れて安全か、社内（情シス・コンプラ）に説明できるようにしたい | 7 | 6 | 7 | 9 | D-010.7 D-015 D-015.2 |
| F-013 | 自分のAIを、自分の考え方に近づけたい | 9 | 5 | 9 | 46 | D-003.7 D-003.9 D-007 |
| F-014 | 導入した顧客が詰まったとき、データを見ずに直したい | 4 | 3 | 4 | 4 | D-030 D-030.10 D-030.9 |
| F-015 | 困ったら運営に聞きたい。止まっているのが自分のせいか Kaname のせいか知り | 3 | 3 | 3 | 7 | D-002 D-002.2 D-037 |
| F-016 | 運営として、問い合わせに答え、お知らせと稼働状況を出し、各社の請求・入金・利用量 | 7 | 6 | 7 | 12 | D-002 D-002.2 D-042 |
| F-017 | 自分のアカウント・会社の設定・既存データの取り込み・外部サービスの連携を、運営に | 6 | 6 | 6 | 10 | D-006.5 D-013.1 D-014.2 |
| F-018 | 運営として、外部サービスの可否（サービス台帳）とプランの定義と目標スキルを管理し | 3 | 3 | 3 | 4 | D-030.2 D-030.3 D-030.6 |
| F-019 | 運営として、公開の申請を審査し、顧客が許可したときだけ支援で中を見て、退会の消去 | 3 | 3 | 3 | 4 | D-010.7 D-019.3 D-022.6 |
| F-020 | 運営として、各社に配るもの（AI社員・担当業務・ルール・テンプレ）とプランの様子 | 2 | 2 | 2 | 2 | D-026 D-026.2 D-027 |
| F-021 | 関門 C1 ネットワーク | 5 | 5 | 0 | 3 | D-013 D-014 D-040 |
| F-022 | 関門 C2 永続化（書き込み） | 93 | 62 | 0 | 3 | D-010 D-038 D-026 |
| F-023 | 関門 C3 モデル呼び出し | 29 | 22 | 0 | 3 | D-004 D-007 D-047 |
| F-024 | 関門 C4 ファイル / オブジェクト | 8 | 7 | 0 | 3 | D-029 D-025 D-050 |
| F-025 | 関門 C5 プロセス起動 | 6 | 4 | 0 | 3 | D-015 D-044 D-045 |
| F-026 | 関門 C6 通知送出 | 19 | 16 | 0 | 3 | D-012 D-043 D-050 |
| F-027 | 関門 C7 決済・課金 | 2 | 2 | 0 | 3 | D-002 D-004 D-050 |
| F-028 | 関門 C8 秘密の読み出し | 7 | 7 | 0 | 3 | D-017 D-042 D-050 |

## ロール

| ID | ロール | 画面数 | 制約 |
|---|---|---|---|
| R1 | 自分で全部回している人 | 51 | 権限なしで自由 ／ 見える層だけ ／ 権限＝誰に×何に×どの層で×できること |
| R2 | 代表と、その下に数人がいる会社の代表 | 51 | 権限なしで自由 ／ 見える層だけ ／ 権限＝誰に×何に×どの層で×できること |
| R3 | 配られた仕事だけをする人 | 21 | 権限なしで自由 ／ 見える層だけ ／ 権限＝誰に×何に×どの層で×できること |
| R4 | 進捗だけ見る外部の人 | 15 | 共有された範囲を見るだけ（書き込まない） |
| R6 | Kaname 運営（ENGINE BASE 側） | 12 | 運営の権限（support / billing / catalog / admin） ／ 既定で読めない。許可の範囲と期限のときだけ。両側の証跡へ |

## 画面

| ID | 画面 | 行為 | 状態 | 遷移 | 必要 API | エンティティ | 役割 |
|---|---|---|---|---|---|---|---|
| signup | アカウントを作る | A01 | 2 | 1 | 2 | 5 | R1 R2 |
| verify-email | メールを確認する | A02 | 5 | 3 | 4 | 3 | R1 R2 |
| invite-accept | 招待を受けて参加する | A03 | 3 | 0 | 1 | 4 | R3 R4 |
| mfa-setup | 2段階認証を設定する | A04 | 3 | 1 | 2 | 6 | R1 R2 R3 |
| billing-setup | 支払い方法を登録する | A05 | 4 | 0 | 1 | 8 | R1 R2 |
| login | ログインする | A13 | 3 | 3 | 4 | 3 | R1 R2 R3 R4 |
| password-reset | パスワードの再設定 | A31 | 3 | 1 | 2 | 6 | R1 R2 R3 |
| onboard-interview | 自分のAIと話す | A06 | 5 | 5 | 6 | 5 | R1 R2 |
| onboard-draft | たたき台を確かめる | A07 A08 | 3 | 5 | 7 | 14 | R1 R2 |
| bridge-setup | 自分のPCをつなぐ | A09 | 8 | 48 | 49 | 3 | R1 R2 |
| credentials | ログイン情報を預ける | A10 | 5 | 48 | 49 | 5 | R1 R2 |
| onboard-testrun | テストで動かす | A11 | 3 | 5 | 6 | 6 | R1 R2 |
| onboard-golive | 本番に切り替える | A12 | 2 | 6 | 7 | 10 | R1 R2 |
| today | 今日 | A14 A55 A56 A92 | 6 | 45 | 49 | 8 | R1 R2 R3 R4 |
| approvals | 承認待ち | A15 | 4 | 45 | 46 | 6 | R1 R2 R3 |
| clone-thread | 自分のAIとAI社員のやりとり | A16 | 5 | 44 | 45 | 5 | R1 R2 R3 |
| tasks | タスク | A17 A48 A50 A51 A57 A58 | 12 | 45 | 51 | 11 | R1 R2 R3 R4 |
| clone-chat | 自分のAIと話す | A20 A88 A89 A90 A91 A95 | 20 | 45 | 51 | 16 | R1 R2 R3 R4 |
| ai-activity | AI社員の動き | A53 | 4 | 45 | 46 | 12 | R1 R2 R3 |
| search | 探す | A21 | 3 | 47 | 48 | 8 | R1 R2 R3 R4 |
| records | 台帳 | A24 A47 | 6 | 46 | 48 | 4 | R1 R2 R3 R4 |
| record-detail | 台帳の1件 | A18 A19 | 3 | 46 | 48 | 9 | R1 R2 R3 R4 |
| goals | 目標 | A22 A54 | 5 | 45 | 47 | 14 | R1 R2 R3 |
| goal-allocation | 目標の配分 | A23 | 6 | 45 | 46 | 9 | R1 R2 |
| goal-edit | 目標を改訂する | A29 A52 | 2 | 45 | 47 | 8 | R1 R2 |
| my-progress | 自分の目標 | A25 A49 | 3 | 45 | 47 | 8 | R1 R2 R3 R4 |
| review | ふりかえり | A26 | 5 | 45 | 46 | 4 | R1 R2 |
| hypotheses | 仮説と施策 | A27 | 5 | 45 | 46 | 6 | R1 R2 |
| duties | 担当業務 | A28 | 6 | 45 | 46 | 7 | R1 R2 |
| clone-memory | 自分のAIの記憶 | A30 A93 | 5 | 45 | 47 | 4 | R1 R2 R3 R4 |
| ledger-def | 台帳の形 | A44 | 3 | 45 | 46 | 4 | R1 R2 |
| company-model | 会社モデル | A45 | 5 | 45 | 46 | 20 | R1 R2 |
| automation-repair | 覚え直させる | A32 | 3 | 45 | 46 | 5 | R1 R2 |
| audit | 証跡 | A33 A34 A38 A40 A66 | 6 | 45 | 50 | 10 | R1 R2 |
| policies | ルール | A35 | 3 | 45 | 46 | 7 | R1 R2 R3 R4 |
| members | メンバー | A36 | 7 | 46 | 47 | 9 | R1 R2 |
| ai-staff | AI社員 | A37 | 4 | 46 | 47 | 9 | R1 R2 |
| ai-staff-detail | AI社員の1体 | A46 A81 | 5 | 46 | 48 | 16 | R1 R2 |
| security-brief | この製品でできること・できないこと | A39 | 2 | 45 | 46 | 6 | R1 R2 |
| disclosure | 開示資料 | A84 | 4 | 0 | 1 | 5 | R1 R2 |
| export | 持ち出す | A41 | 2 | 45 | 46 | 9 | R1 R2 |
| account-close | 退会する | A42 | 6 | 45 | 46 | 13 | R1 R2 |
| ops-support | 運営の支援 | A43 A70 | 2 | 45 | 47 | 12 | R6 |
| ops-home | 運営：会社の一覧 | A60 | 4 | 45 | 46 | 14 | R6 |
| ops-catalog | 運営：配るもの | A59 A79 | 7 | 45 | 47 | 12 | R6 |
| account | 自分のアカウント | A74 A94 | 2 | 45 | 47 | 8 | R1 R2 R3 R4 |
| company-settings | 会社の設定 | A75 | 2 | 45 | 46 | 14 | R1 R2 |
| llm-routes | AI の経路 | A82 | 4 | 0 | 1 | 3 | R1 R2 |
| app-setup | アプリと通知 | A83 | 3 | 0 | 1 | 5 | R1 R2 R3 R4 |
| import | 取り込み | A76 | 3 | 45 | 46 | 7 | R1 R2 |
| services | 外部サービスの連携 | A77 | 3 | 45 | 46 | 7 | R1 R2 |
| ops-services | 運営：サービス台帳 | A78 | 2 | 45 | 46 | 4 | R6 |
| ops-skills | 運営：スキル | A80 | 4 | 45 | 46 | 15 | R6 |
| inquiry | 問い合わせ | A67 | 5 | 45 | 46 | 7 | R1 R2 R3 R4 |
| notices | お知らせと通知 | A68 | 3 | 45 | 46 | 5 | R1 R2 R3 R4 |
| billing | プランと請求 | A69 | 3 | 45 | 46 | 15 | R1 R2 |
| ops-notices | 運営：お知らせ | A71 | 2 | 45 | 46 | 8 | R6 |
| ops-billing | 運営：請求と入金 | A72 A87 | 2 | 45 | 47 | 16 | R6 |
| ops-llm | 運営：AI の経路と使用量 | A85 | 3 | 0 | 1 | 3 | R6 |
| ops-disclosure | 運営：開示資料 | A86 | 3 | 0 | 1 | 5 | R6 |
| ops-tenant | 運営：会社の 1 社 | A64 | 1 | 45 | 46 | 40 | R6 |
| ops-review | 運営：公開の審査 | A63 | 2 | 45 | 46 | 8 | R6 |
| ops-audit | 運営：運営の証跡 | A65 A73 | 2 | 45 | 47 | 8 | R6 |
| member-detail | メンバーの1人 | A61 A62 | 4 | 45 | 47 | 8 | R1 R2 |

## 引き継ぎ

- api-design：`traceability-matrix.json` の `screen_to_apis`（path_draft は下書き。確定は api-design）
- task-decomposition：`features.json` の `ears_ac_seed`（Tier 2）、`screens.json` の `mock_path` / `h1_text` / `section_h2_texts`（Tier 1）、`entities.json` の `access_control_policies`（access control verifier）
- 未被覆：画面 0 ／ 機能 0
