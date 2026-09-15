# Kaname 機能分解（functional-breakdown）v3.1 — 2026-09-15

> 信頼源は 07_functional/*.json（05_flow/build_functional.py が機械生成）。この文書は写し。

## 完了サマリー

| 種別 | 件数 | 根拠（source）| 備考 |
|---|---|---|---|
| エンティティ | 83 | 全件 | ER図 §1〜§14 の表から。table_name・tenant_isolation・access_control_policies |
| 機能 | 28 | 全件 | 用事 20 ＋ 関門 8。api_endpoints（下書き）・ears_ac_seed |
| ロール | 5 | 全件 | 権限の型（誰に×何に×どの層で×できること）を access_predicate_expr で |
| 画面 | 59 | 全件 | flow.json と 1 対 1。states はモックの状態タブ、transitions はモックのリンクから |

## エンティティ

| ID | テーブル | 節 | 分離 | 方針 | 根拠 |
|---|---|---|---|---|---|
| E-001 | `tenants` | 1. テナント・組織・メンバー | account_scoped | 3 | D-076 |
| E-002 | `scopes` | 1. テナント・組織・メンバー | account_scoped | 3 | D-026 |
| E-003 | `member_kinds` | 1. テナント・組織・メンバー | none | 2 | D-010 |
| E-004 | `members` | 1. テナント・組織・メンバー | scope_layered | 3 | D-037 |
| E-005 | `clones` | 1. テナント・組織・メンバー | account_scoped | 4 | D-073 |
| E-006 | `ai_employees` | 1. テナント・組織・メンバー | scope_layered | 4 | D-010 |
| E-007 | `goal_kinds` | 2. 会社モデル ── 目標 | none | 2 | D-010 |
| E-008 | `units` | 2. 会社モデル ── 目標 | scope_layered | 3 | D-010 |
| E-009 | `rollup_kinds` | 2. 会社モデル ── 目標 | none | 2 | D-010 |
| E-010 | `goals` | 2. 会社モデル ── 目標 | scope_layered | 3 | D-032 D-034 D-058 |
| E-011 | `goal_allocations` | 2. 会社モデル ── 目標 | account_scoped | 3 | D-058 |
| E-012 | `goal_contributions` | 2. 会社モデル ── 目標 | account_scoped | 3 | D-010 |
| E-013 | `goal_versions` | 2. 会社モデル ── 目標 | none | 2 | D-061 |
| E-014 | `hypotheses` | 2. 会社モデル ── 目標 | scope_layered | 3 | D-035 |
| E-015 | `measures` | 2. 会社モデル ── 目標 | scope_layered | 3 | D-010 |
| E-016 | `validations` | 2. 会社モデル ── 目標 | account_scoped | 3 | D-010 |
| E-017 | `ledger_definitions` | 3. 会社モデル ── 台帳 | scope_layered | 3 | D-038 |
| E-018 | `ledger_fields` | 3. 会社モデル ── 台帳 | account_scoped | 3 | D-010 |
| E-019 | `ledger_stages` | 3. 会社モデル ── 台帳 | account_scoped | 3 | D-010 |
| E-020 | `ledger_views` | 3. 会社モデル ── 台帳 | scope_layered | 3 | D-010 |
| E-021 | `ledger_records` | 3. 会社モデル ── 台帳 | scope_layered | 3 | D-010 |
| E-022 | `duties` | 4. 会社モデル ── 担当業務・記憶 | scope_layered | 3 | D-010 |
| E-023 | `duty_versions` | 4. 会社モデル ── 担当業務・記憶 | none | 2 | D-010 |
| E-024 | `learned_procedures` | 4. 会社モデル ── 担当業務・記憶 | scope_layered | 3 | D-010 |
| E-025 | `procedure_steps` | 4. 会社モデル ── 担当業務・記憶 | account_scoped | 3 | D-010 |
| E-026 | `memory_kinds` | 4. 会社モデル ── 担当業務・記憶 | none | 2 | D-010 |
| E-027 | `memories` | 4. 会社モデル ── 担当業務・記憶 | scope_layered | 4 | D-060 |
| E-028 | `tasks` | 5. 実行・統制 | scope_layered | 3 | D-068 |
| E-029 | `task_handovers` | 5. 実行・統制 | account_scoped | 3 | D-058 D-061 D-068 |
| E-030 | `daily_plans` | 5. 実行・統制 | account_scoped | 4 | D-068 |
| E-031 | `triggers` | 5. 実行・統制 | scope_layered | 3 | D-010 |
| E-032 | `policies` | 5. 実行・統制 | scope_layered | 3 | D-060 |
| E-033 | `approvals` | 5. 実行・統制 | scope_layered | 4 | D-010 |
| E-034 | `action_runs` | 5. 実行・統制 | scope_layered | 3 | D-062 |
| E-035 | `service_registry` | 5. 実行・統制 | account_scoped | 3 | D-013 D-041 |
| E-036 | `credential_kinds` | 5. 実行・統制 | none | 2 | D-010 |
| E-037 | `credentials` | 5. 実行・統制 | scope_layered | 4 | D-004 D-017 |
| E-038 | `conversations` | 6. 会話・成果物・証跡 | scope_layered | 3 | D-062 |
| E-039 | `messages` | 6. 会話・成果物・証跡 | account_scoped | 3 | D-066 |
| E-040 | `artifacts` | 6. 会話・成果物・証跡 | scope_layered | 3 | D-010 |
| E-041 | `audit_events` | 6. 会話・成果物・証跡 | account_scoped | 3 | D-010 |
| E-042 | `layers` | 9. 層と権限 | account_scoped | 3 | D-073 D-073.4 |
| E-043 | `target_kinds` | 9. 層と権限 | none | 2 | D-073 |
| E-044 | `abilities` | 9. 層と権限 | none | 2 | D-073 |
| E-045 | `permissions` | 9. 層と権限 | account_scoped | 3 | D-073 D-073.1 D-073.3 |
| E-046 | `account_events` | 10. 口座状態の出来事・失効・サポートアクセス | account_scoped | 4 | D-074 D-074.1 D-076 D-076.13 |
| E-047 | `account_event_items` | 10. 口座状態の出来事・失効・サポートアクセス | account_scoped | 3 | D-074 D-076.13 |
| E-048 | `sessions` | 10. 口座状態の出来事・失効・サポートアクセス | account_scoped | 3 | D-074 D-076 D-076.1 D-076.13 |
| E-049 | `support_access_grants` | 10. 口座状態の出来事・失効・サポートアクセス | account_scoped | 3 | D-074 D-074.5 D-076.13 |
| E-050 | `retention_holds` | 10. 口座状態の出来事・失効・サポートアクセス | account_scoped | 3 | D-074 D-074.3 D-076.13 |
| E-051 | `erasure_certificates` | 10. 口座状態の出来事・失効・サポートアクセス | account_scoped | 3 | D-074 D-074.3 D-076.13 |
| E-052 | `distributions` | 11. 運営 | account_scoped | 3 | D-037 D-063 D-073.7 D-074.4 |
| E-053 | `distribution_versions` | 11. 運営 | none | 2 | D-073.7 D-074.4 D-076.10 D-076.5 |
| E-054 | `tenant_distributions` | 11. 運営 | account_scoped | 3 | D-073.7 D-074.4 D-076.10 D-076.5 |
| E-055 | `service_registry_versions` | 11. 運営 | none | 2 | D-073.7 D-074.4 D-076 D-076.10 |
| E-056 | `service_requests` | 11. 運営 | account_scoped | 4 | D-073.7 D-074.4 D-076 D-076.10 |
| E-057 | `review_requests` | 11. 運営 | account_scoped | 3 | D-027 D-073.7 D-074 D-074.4 |
| E-058 | `ops_members` | 11. 運営 | account_scoped | 3 | D-073 D-073.7 D-074.4 D-076.10 |
| E-059 | `ops_audit_events` | 11. 運営 | account_scoped | 3 | D-073.7 D-074 D-074.4 D-076.10 |
| E-060 | `security_events` | 11. 運営 | account_scoped | 4 | D-073.7 D-074.4 D-075 D-075.6 |
| E-061 | `inquiries` | 12. 運営と顧客の間で往復するもの・自分で整えるもの | account_scoped | 4 | D-069 D-075 D-075.1 D-076 |
| E-062 | `notices` | 12. 運営と顧客の間で往復するもの・自分で整えるもの | account_scoped | 3 | D-069 D-075 D-075.2 D-076 |
| E-063 | `notice_deliveries` | 12. 運営と顧客の間で往復するもの・自分で整えるもの | account_scoped | 4 | D-069 D-075 D-076 |
| E-064 | `status_incidents` | 12. 運営と顧客の間で往復するもの・自分で整えるもの | account_scoped | 3 | D-069 D-075 D-075.2 D-076 |
| E-065 | `notification_preferences` | 12. 運営と顧客の間で往復するもの・自分で整えるもの | account_scoped | 4 | D-043 D-069 D-075 D-075.3 |
| E-066 | `notifications` | 12. 運営と顧客の間で往復するもの・自分で整えるもの | account_scoped | 4 | D-043 D-069 D-075 D-076 |
| E-067 | `plans` | 12. 運営と顧客の間で往復するもの・自分で整えるもの | account_scoped | 3 | D-069 D-075 D-076 D-076.6 |
| E-068 | `plan_versions` | 12. 運営と顧客の間で往復するもの・自分で整えるもの | none | 2 | D-069 D-075 D-076 |
| E-069 | `subscriptions` | 12. 運営と顧客の間で往復するもの・自分で整えるもの | account_scoped | 3 | D-069 D-075 D-075.4 D-076 |
| E-070 | `plan_change_requests` | 12. 運営と顧客の間で往復するもの・自分で整えるもの | account_scoped | 4 | D-069 D-075 D-076 |
| E-071 | `usage_meters` | 12. 運営と顧客の間で往復するもの・自分で整えるもの | account_scoped | 3 | D-069 D-075 D-075.5 D-076 |
| E-072 | `invoices` | 12. 運営と顧客の間で往復するもの・自分で整えるもの | account_scoped | 3 | D-002 D-069 D-075 D-075.4 |
| E-073 | `payments` | 12. 運営と顧客の間で往復するもの・自分で整えるもの | account_scoped | 3 | D-069 D-075 D-076 D-077.1 |
| E-074 | `error_events` | 12. 運営と顧客の間で往復するもの・自分で整えるもの | account_scoped | 4 | D-069 D-069.3 D-069.4 D-075 |
| E-075 | `imports` | 13. 取り込み・正規連携・招待・持ち出し・添付 | scope_layered | 3 | D-025 D-026 D-042 D-076 |
| E-076 | `integrations` | 13. 取り込み・正規連携・招待・持ち出し・添付 | scope_layered | 3 | D-026 D-041 D-042 D-076 |
| E-077 | `invitations` | 13. 取り込み・正規連携・招待・持ち出し・添付 | account_scoped | 3 | D-026 D-037 D-042 D-076.3 |
| E-078 | `export_jobs` | 13. 取り込み・正規連携・招待・持ち出し・添付 | account_scoped | 4 | D-026 D-042 D-076.3 D-076.4 |
| E-079 | `attachments` | 13. 取り込み・正規連携・招待・持ち出し・添付 | scope_layered | 3 | D-026 D-042 D-076.3 D-076.4 |
| E-080 | `skills` | 14. スキル | account_scoped | 3 | D-078 D-078.1 |
| E-081 | `skill_versions` | 14. スキル | none | 2 | D-078 D-078.2 |
| E-082 | `skill_test_runs` | 14. スキル | account_scoped | 3 | D-078 |
| E-083 | `skill_attachments` | 14. スキル | account_scoped | 3 | D-078 D-078.3 D-078.4 D-078.7 |

## 機能

| ID | 機能 | 行為 | 画面 | API 下書き | EARS | 根拠 |
|---|---|---|---|---|---|---|
| F-001 | 契約してから、自力で動く状態まで持っていきたい | 7 | 6 | 7 | 10 | D-001 D-001.5 D-002 |
| F-002 | 招かれたので、自分がやることだけ分かる状態にしたい | 1 | 1 | 1 | 1 | D-026 D-037 D-053.3 |
| F-003 | 入れなくなったときに、自分で入り直したい | 1 | 1 | 1 | 1 | D-042 D-053.3 |
| F-004 | 今日なにをすればいいか、迷わず決めたい | 13 | 5 | 13 | 17 | D-002 D-003.1 D-003.9 |
| F-005 | 手でやっている繰り返しを、自分の代わりにやらせたい | 5 | 5 | 5 | 11 | D-003.7 D-004 D-004.1 |
| F-006 | AIが勝手に外に出すのが怖い。押す前に中身を見て決めたい | 9 | 8 | 9 | 16 | D-003.7 D-008.2 D-012 |
| F-007 | 案件・請求・問い合わせが今どうなっているか、1か所で見たい | 7 | 5 | 7 | 9 | D-006.2 D-007 D-010 |
| F-008 | 目標に届くのか、届かないなら何を変えるか知りたい | 9 | 7 | 9 | 15 | D-003 D-003.1 D-003.3 |
| F-009 | なぜ届かなかったかを言葉にして、次の打ち手を決めたい | 3 | 3 | 3 | 4 | D-003.1 D-003.3 D-006 |
| F-010 | 人に任せたい。任せても品質が落ちないようにしたい | 12 | 8 | 12 | 18 | D-003.1 D-004.10 D-008 |
| F-011 | 会社のやり方が、人が辞めても消えないようにしたい | 3 | 3 | 3 | 3 | D-003 D-003.1 D-003.3 |
| F-012 | このツールを入れて安全か、社内（情シス・コンプラ）に説明できるようにしたい | 6 | 5 | 6 | 8 | D-010.7 D-015 D-015.2 |
| F-013 | 自分のAIを、自分の考え方に近づけたい | 4 | 4 | 4 | 5 | D-003.7 D-003.9 D-007 |
| F-014 | 導入した顧客が詰まったとき、データを見ずに直したい | 4 | 3 | 4 | 4 | D-030 D-030.10 D-030.9 |
| F-015 | 困ったら運営に聞きたい。止まっているのが自分のせいか Kaname のせいか知り | 3 | 3 | 3 | 5 | D-002 D-002.2 D-037 |
| F-016 | 運営として、問い合わせに答え、お知らせと稼働状況を出し、各社の請求・入金・利用量 | 4 | 4 | 4 | 6 | D-002 D-002.2 D-042 |
| F-017 | 自分のアカウント・会社の設定・既存データの取り込み・外部サービスの連携を、運営に | 4 | 4 | 4 | 5 | D-006.5 D-013.1 D-014.2 |
| F-018 | 運営として、外部サービスの可否（サービス台帳）とプランの定義と目標スキルを管理し | 3 | 3 | 3 | 4 | D-030.2 D-030.3 D-030.6 |
| F-019 | 運営として、公開の申請を審査し、顧客が許可したときだけ支援で中を見て、退会の消去 | 3 | 3 | 3 | 4 | D-010.7 D-019.3 D-022.6 |
| F-020 | 運営として、各社に配るもの（AI社員・担当業務・ルール・テンプレ）とプランの様子 | 2 | 2 | 2 | 2 | D-026 D-026.2 D-027 |
| F-021 | 関門 C1 ネットワーク | 4 | 4 | 0 | 3 | D-014 D-013 D-040 |
| F-022 | 関門 C2 永続化（書き込み） | 78 | 56 | 0 | 3 | D-010 D-038 D-026 |
| F-023 | 関門 C3 モデル呼び出し | 27 | 21 | 0 | 3 | D-004 D-007 D-047 |
| F-024 | 関門 C4 ファイル / オブジェクト | 4 | 4 | 0 | 3 | D-029 D-025 D-050 |
| F-025 | 関門 C5 プロセス起動 | 3 | 3 | 0 | 3 | D-015 D-044 D-045 |
| F-026 | 関門 C6 通知送出 | 16 | 13 | 0 | 3 | D-043 D-012 D-050 |
| F-027 | 関門 C7 決済・課金 | 1 | 1 | 0 | 3 | D-002 D-004 D-050 |
| F-028 | 関門 C8 秘密の読み出し | 6 | 6 | 0 | 3 | D-017 D-042 D-050 |

## ロール

| ID | ロール | 画面数 | 制約 |
|---|---|---|---|
| R1 | 自分で全部回している人 | 48 | 権限なしで自由 ／ 見える層だけ ／ 権限＝誰に×何に×どの層で×できること |
| R2 | 代表と、その下に数人がいる会社の代表 | 48 | 権限なしで自由 ／ 見える層だけ ／ 権限＝誰に×何に×どの層で×できること |
| R3 | 配られた仕事だけをする人 | 20 | 権限なしで自由 ／ 見える層だけ ／ 権限＝誰に×何に×どの層で×できること |
| R4 | 進捗だけ見る外部の人 | 13 | 共有された範囲を見るだけ（書き込まない） |
| R6 | Kaname 運営（ENGINE BASE 側） | 10 | 運営の権限（support / billing / catalog / admin） ／ 既定で読めない。許可の範囲と期限のときだけ。両側の証跡へ |

## 画面

| ID | 画面 | 行為 | 状態 | 遷移 | 必要 API | エンティティ | 役割 |
|---|---|---|---|---|---|---|---|
| signup | アカウントを作る | A01 | 2 | 1 | 2 | 5 | R1 R2 |
| verify-email | メールを確認する | A02 | 3 | 2 | 3 | 3 | R1 R2 |
| invite-accept | 招待を受けて参加する | A03 | 3 | 0 | 1 | 4 | R3 R4 |
| mfa-setup | 2段階認証を設定する | A04 | 2 | 1 | 2 | 6 | R1 R2 R3 |
| billing-setup | 支払い方法を登録する | A05 | 1 | 0 | 1 | 5 | R1 R2 |
| login | ログインする | A13 | 3 | 3 | 4 | 3 | R1 R2 R3 R4 |
| password-reset | 入り直す | A31 | 3 | 1 | 2 | 6 | R1 R2 R3 |
| onboard-interview | 自分のAIと話す | A06 | 4 | 5 | 6 | 5 | R1 R2 |
| onboard-draft | たたき台を確かめる | A07 A08 | 3 | 5 | 7 | 14 | R1 R2 |
| bridge-setup | 自分のPCをつなぐ | A09 | 4 | 48 | 49 | 2 | R1 R2 |
| credentials | ログイン情報を預ける | A10 | 5 | 48 | 49 | 5 | R1 R2 |
| onboard-testrun | テストで動かす | A11 | 3 | 5 | 6 | 6 | R1 R2 |
| onboard-golive | 本番に切り替える | A12 | 2 | 6 | 7 | 10 | R1 R2 |
| today | 今日 | A14 A55 A56 | 5 | 45 | 48 | 7 | R1 R2 R3 |
| approvals | 承認待ち | A15 | 4 | 45 | 46 | 6 | R1 R2 R3 |
| clone-thread | 自分のAIとAI社員のやりとり | A16 | 5 | 44 | 45 | 5 | R1 R2 R3 |
| tasks | タスク | A17 A48 A50 A51 A57 A58 | 12 | 45 | 51 | 11 | R1 R2 R3 R4 |
| clone-chat | 自分のAIと話す | A20 | 11 | 44 | 45 | 8 | R1 R2 R3 R4 |
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
| clone-memory | 自分のAIの記憶 | A30 | 4 | 45 | 46 | 3 | R1 R2 R3 R4 |
| ledger-def | 台帳の形 | A44 | 3 | 45 | 46 | 4 | R1 R2 |
| company-model | 会社モデル | A45 | 5 | 45 | 46 | 20 | R1 R2 |
| automation-repair | 覚え直させる | A32 | 3 | 45 | 46 | 5 | R1 R2 |
| audit | 証跡 | A33 A34 A38 A40 A66 | 6 | 45 | 50 | 10 | R1 R2 |
| policies | ルール | A35 | 3 | 45 | 46 | 6 | R1 R2 R3 R4 |
| members | メンバー | A36 | 7 | 46 | 47 | 9 | R1 R2 |
| ai-staff | AI社員 | A37 | 4 | 46 | 47 | 9 | R1 R2 |
| ai-staff-detail | AI社員の1体 | A46 A81 | 5 | 46 | 48 | 16 | R1 R2 |
| security-brief | この製品でできること・できないこと | A39 | 2 | 45 | 46 | 6 | R1 R2 |
| export | 持ち出す | A41 | 2 | 45 | 46 | 9 | R1 R2 |
| account-close | 退会する | A42 | 6 | 45 | 46 | 13 | R1 R2 |
| ops-support | 運営の支援 | A43 A70 | 2 | 45 | 47 | 12 | R6 |
| ops-home | 運営：会社の一覧 | A60 | 4 | 45 | 46 | 14 | R6 |
| ops-catalog | 運営：配るもの | A59 A79 | 7 | 45 | 47 | 12 | R6 |
| account | 自分のアカウント | A74 | 2 | 45 | 46 | 7 | R1 R2 R3 R4 |
| company-settings | 会社の設定 | A75 | 2 | 45 | 46 | 14 | R1 R2 |
| import | 取り込み | A76 | 3 | 45 | 46 | 7 | R1 R2 |
| services | 外部サービスの連携 | A77 | 3 | 45 | 46 | 7 | R1 R2 |
| ops-services | 運営：サービス台帳 | A78 | 2 | 45 | 46 | 4 | R6 |
| ops-skills | 運営：スキル | A80 | 4 | 45 | 46 | 15 | R6 |
| inquiry | 問い合わせ | A67 | 5 | 45 | 46 | 7 | R1 R2 R3 R4 |
| notices | お知らせと通知 | A68 | 3 | 45 | 46 | 5 | R1 R2 R3 R4 |
| billing | プランと請求 | A69 | 3 | 45 | 46 | 15 | R1 R2 |
| ops-notices | 運営：お知らせ | A71 | 2 | 45 | 46 | 8 | R6 |
| ops-billing | 運営：請求と入金 | A72 | 2 | 45 | 46 | 14 | R6 |
| ops-tenant | 運営：会社の 1 社 | A64 | 1 | 45 | 46 | 40 | R6 |
| ops-review | 運営：公開の審査 | A63 | 2 | 45 | 46 | 8 | R6 |
| ops-audit | 運営：運営の証跡 | A65 A73 | 2 | 45 | 47 | 8 | R6 |
| member-detail | メンバーの1人 | A61 A62 | 4 | 45 | 47 | 8 | R1 R2 |

## 引き継ぎ

- api-design：`traceability-matrix.json` の `screen_to_apis`（path_draft は下書き。確定は api-design）
- task-decomposition：`features.json` の `ears_ac_seed`（Tier 2）、`screens.json` の `mock_path` / `h1_text` / `section_h2_texts`（Tier 1）、`entities.json` の `access_control_policies`（access control verifier）
- 未被覆：画面 0 ／ 機能 0
