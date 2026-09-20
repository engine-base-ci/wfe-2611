# Kaname API 設計書 v1.0（2026-09-20 凍結）

> 信頼源は `08_api/endpoints.json` と `openapi.yaml`（05_flow/build_api.py が機械生成）。

## 1. 設計方針

- REST・独立 API 層（Hono・TypeScript）・契約は OpenAPI 3.0.3・URL 版（/api/v1）。Web・Bridge・将来のアプリが同じ契約を叩く（D-043・D-051）
- 認証はトークンベース。失効は `sessions` 表（退会・停止・権限変更・パスワード変更で即失効）。API 層は冒頭で `SET LOCAL app.tenant_id / app.user_id / app.role`
- 副作用の順序：認可 → ポリシー → 承認 → 副作用 → 記録。書き込み系 endpoint は関門（C1〜C8）を必ず通る
- 運営（ops）は既定で顧客の行を読めない。`support_access_grants` があるときだけ

## 2. エンドポイント一覧

| ID | メソッド | パス | 説明 | 行為 | 画面 | 役割 | 関門 | 4xx |
|---|---|---|---|---|---|---|---|---|
| EP-001 | GET | `/api/v1/action_runs` | 取得（action_runs）— AI社員をテストで動かして結果を見る | A11 | 1 | member |  | 401 403 429 502 |
| EP-002 | GET | `/api/v1/ai_employees` | 取得（ai_employees）— AI社員を増やす・人に託す／AI社員 | A37 A46 A53 A59 A79 | 4 | member |  | 401 403 429 502 |
| EP-003 | PATCH | `/api/v1/ai_employees/:id` | 更新（ai_employees）— AI社員・自分のAIの使えるスキルを | A81 | 1 | member | C2 | 401 403 404 422 429 |
| EP-004 | GET | `/api/v1/approvals` | 取得（approvals）— 自分のAIが差し戻したやりとりを見る | A16 | 1 | member |  | 401 403 429 502 |
| EP-005 | POST | `/api/v1/approvals` | 作成・実行（approvals）— 全操作の証跡を出す | A40 | 1 | member | C2 C4 | 401 403 409 422 429 |
| EP-006 | PATCH | `/api/v1/approvals/:id` | 更新（approvals）— 自分のAIが上げてきたものを承認する／止め | A15 | 1 | member | C1 C2 C6 | 401 403 404 422 429 502 |
| EP-007 | DELETE | `/api/v1/approvals/:id` | 削除（approvals）— やってしまったことを取り消す／運営にサポー | A34 A66 | 1 | member | C1 C2 | 401 403 404 429 502 |
| EP-008 | POST | `/api/v1/attachments` | 作成・実行（attachments）— 既存データ・書類・メールを取り込 | A76 | 1 | member | C2 C3 C4 | 401 403 409 422 429 502 |
| EP-009 | GET | `/api/v1/audit_events` | 取得（audit_events）— 想定外が起きた → 何をしたか追う／ | A33 A38 A73 | 2 | member |  | 401 403 429 |
| EP-010 | POST | `/api/v1/clones` | 作成・実行（clones）— 自分のAIに会社のことを話す（訊かれたこと | A06 | 1 | member | C2 C3 | 401 403 409 422 429 502 |
| EP-011 | GET | `/api/v1/conversations` | 取得（conversations）— 自分のAIに指示する・相談する | A20 | 1 | member |  | 401 403 429 502 |
| EP-012 | POST | `/api/v1/credentials` | 作成・実行（credentials）— ログイン情報を預ける | A10 | 1 | member | C2 C8 | 401 403 409 422 429 |
| EP-013 | GET | `/api/v1/disclosure_versions` | 取得（disclosure_versions）— 開示資料（できる操作・ | A84 | 1 | member | C4 | 401 403 429 |
| EP-014 | PATCH | `/api/v1/disclosure_versions/:id` | 更新（disclosure_versions）— 開示資料の版を出す・D | A86 | 1 | ops | C2 C4 C6 | 401 403 404 422 429 |
| EP-015 | POST | `/api/v1/distributions` | 作成・実行（distributions）— 会社が明示的に公開したものを | A63 | 1 | ops | C2 | 401 403 409 422 429 |
| EP-016 | PATCH | `/api/v1/duties/:id` | 更新（duties）— 担当業務を書き換える | A28 | 1 | member | C2 C3 | 401 403 404 422 429 502 |
| EP-017 | POST | `/api/v1/export_jobs` | 作成・実行（export_jobs）— データを全部持ち出す | A41 | 1 | member | C2 C4 | 401 403 409 422 429 |
| EP-018 | GET | `/api/v1/goal_allocations` | 取得（goal_allocations）— 自分の担当分の進みを見る | A25 | 1 | member |  | 401 403 429 |
| EP-019 | PATCH | `/api/v1/goal_allocations/:id` | 更新（goal_allocations）— 目標の下ろし方を決める・直す | A23 A49 | 2 | member | C2 C3 | 401 403 404 422 429 502 |
| EP-020 | GET | `/api/v1/goals` | 取得（goals）— 目標の進みを見る／目標を無くす・終える ── 紐づ | A22 A52 A54 | 2 | member |  | 401 403 429 502 |
| EP-021 | PATCH | `/api/v1/goals/:id` | 更新（goals）— 目標を改訂する（値・期間・単位）── 紐づくタスク | A29 | 1 | member | C2 C3 | 401 403 404 422 429 502 |
| EP-022 | GET | `/api/v1/hypotheses` | 取得（hypotheses）— ふりかえりを読む | A26 | 1 | member |  | 401 403 429 502 |
| EP-023 | PATCH | `/api/v1/hypotheses/:id` | 更新（hypotheses）— 仮説と施策を採るか決める | A27 | 1 | member | C2 C3 | 401 403 404 422 429 502 |
| EP-024 | GET | `/api/v1/inquiries` | 取得（inquiries）— 運営に問い合わせる（自分のAIがまず答え、 | A67 | 1 | member |  | 401 403 429 |
| EP-025 | PATCH | `/api/v1/inquiries/:id` | 更新（inquiries）— 顧客が詰まったのを、データを見ずに直す／問 | A43 A70 | 1 | ops | C2 C6 | 401 403 404 422 429 |
| EP-026 | GET | `/api/v1/invitations` | 取得（invitations）— 招待を受けて参加する | A03 | 1 | public |  | 429 502 |
| EP-027 | GET | `/api/v1/invoices` | 取得（invoices）— 各社の請求・入金・利用量と上限を見て、未収と | A72 A87 | 1 | ops |  | 401 403 429 |
| EP-028 | GET | `/api/v1/learned_procedures` | 取得（learned_procedures）— AIが止まった／画面が変 | A32 | 1 | member |  | 401 403 429 502 |
| EP-029 | GET | `/api/v1/ledger_definitions` | 取得（ledger_definitions）— 探しているものを見つける | A21 A47 | 2 | member |  | 401 403 429 502 |
| EP-030 | PATCH | `/api/v1/ledger_definitions/:id` | 更新（ledger_definitions）— 止まっている案件を動かす | A24 A44 | 2 | member | C2 C3 | 401 403 404 422 429 502 |
| EP-031 | GET | `/api/v1/ledger_records` | 取得（ledger_records）— 案件・請求の1件を開いて中を見る | A18 | 1 | member |  | 401 403 429 |
| EP-032 | PATCH | `/api/v1/ledger_records/:id` | 更新（ledger_records）— 案件を次の段階へ動かす | A19 | 1 | member | C2 C3 | 401 403 404 422 429 502 |
| EP-033 | POST | `/api/v1/llm_routes` | 作成・実行（llm_routes）— AI の経路（Bridge／自分の | A82 | 1 | member | C2 C3 C8 | 401 403 409 422 429 502 |
| EP-034 | PATCH | `/api/v1/llm_routes/:id` | 更新（llm_routes）— 会社ごとに運営マネージドの経路を許可し、 | A85 | 1 | ops | C2 | 401 403 404 422 429 |
| EP-035 | GET | `/api/v1/members` | 取得（members）— メールを確認して本人だと示す／2段階認証を設定 | A02 A04 A13 A31 | 4 | public | C8 | 429 |
| EP-036 | PATCH | `/api/v1/members/:id` | 更新（members）— 人を招いて見える範囲を決める／メンバー1人の所 | A36 A61 A74 | 3 | member | C2 C6 C8 | 401 403 404 422 429 |
| EP-037 | DELETE | `/api/v1/members/:id` | 削除（members）— 退会する／抜ける人の依存を片づける（タスク・承 | A42 A62 | 2 | member | C2 C6 C8 | 401 403 404 429 |
| EP-038 | POST | `/api/v1/memories` | 作成・実行（memories）— 自分のAIに自分の考え方を教える（育成 | A30 | 1 | member | C2 C3 | 401 403 409 422 429 502 |
| EP-039 | GET | `/api/v1/messages` | 取得（messages）— 今日ひらいて、自分のAIの申し送りを読む | A14 | 1 | member |  | 401 403 429 502 |
| EP-040 | PATCH | `/api/v1/messages/:id` | 更新（messages）— 朝、自分のAIの候補から今日やる分を選んで確 | A55 | 1 | member | C2 C3 | 401 403 404 422 429 502 |
| EP-041 | DELETE | `/api/v1/messages/:id` | 削除（messages）— 夕方、残ったものを 消す／明日へ／引き継いで | A56 | 1 | member | C2 C3 C6 | 401 403 404 429 502 |
| EP-042 | PATCH | `/api/v1/notice_deliveries/:id` | 更新（notice_deliveries）— お知らせと稼働状況を見て、 | A68 | 1 | member | C2 C6 | 401 403 404 422 429 |
| EP-043 | POST | `/api/v1/notices` | 作成・実行（notices）— お知らせと稼働状況を出す（リリース・障害 | A71 | 1 | ops | C2 C6 | 401 403 409 422 429 |
| EP-044 | PATCH | `/api/v1/ops_members/:id` | 更新（ops_members）— 運営の誰が・どの会社に・何をしたかを見 | A65 | 1 | ops | C2 | 401 403 404 422 429 |
| EP-045 | GET | `/api/v1/plans` | 取得（plans）— 各社の様子（プラン・AI社員の体数・稼働・詰まり） | A60 | 1 | ops |  | 401 403 429 |
| EP-046 | DELETE | `/api/v1/plans/:id` | 削除（plans）— 1 社の詳細で、構成・請求と入金・問い合わせ・配布 | A64 | 1 | ops | C2 | 401 403 404 429 |
| EP-047 | PATCH | `/api/v1/policies/:id` | 更新（policies）— AIにやらせる範囲を変える | A35 | 1 | member | C2 | 401 403 404 422 429 |
| EP-048 | PATCH | `/api/v1/push_devices/:id` | 更新（push_devices）— スマホ／PC のアプリを入れて、通知 | A83 | 1 | member | C2 C6 | 401 403 404 422 429 |
| EP-049 | POST | `/api/v1/service_registry` | 作成・実行（service_registry）— 外部サービスの連携と自 | A77 | 1 | member | C1 C2 C8 | 401 403 409 422 429 502 |
| EP-050 | PATCH | `/api/v1/service_registry_versions/:id` | 更新（service_registry_versions）— サービス台 | A78 | 1 | ops | C2 | 401 403 404 422 429 |
| EP-051 | GET | `/api/v1/sessions` | 取得（sessions）— 何ができるアプリかを社内に説明する | A39 | 1 | member |  | 401 403 429 |
| EP-052 | POST | `/api/v1/sessions` | 作成・実行（sessions）— 自分のPCをつなぐ（Bridge）── | A09 | 1 | member | C2 C5 | 401 403 409 422 429 502 |
| EP-053 | POST | `/api/v1/skills` | 作成・実行（skills）— スキルを構築・アップロード・テストして版を | A80 | 1 | ops | C2 C4 C6 | 401 403 409 422 429 |
| EP-054 | POST | `/api/v1/subscriptions` | 作成・実行（subscriptions）— アカウントを作る／支払い方法 | A01 A05 | 2 | member | C2 C7 | 401 403 409 422 429 |
| EP-055 | PATCH | `/api/v1/subscriptions/:id` | 更新（subscriptions）— プラン・利用量・請求書を見て、プラ | A69 | 1 | member | C2 | 401 403 404 422 429 |
| EP-056 | GET | `/api/v1/tasks` | 取得（tasks）— 自分の分が終わったら、同じ層の他の人の仕事を引き継 | A48 A58 | 1 | member |  | 401 403 429 502 |
| EP-057 | POST | `/api/v1/tasks` | 作成・実行（tasks）— タスクを足す（自分にも、人にも、AI社員にも | A50 A57 | 1 | member | C2 C3 C6 | 401 403 409 422 429 502 |
| EP-058 | PATCH | `/api/v1/tasks/:id` | 更新（tasks）— 自分のタスクを片づける／タスクを引き継いでもらう・ | A17 A51 | 1 | member | C2 C6 | 401 403 404 422 429 |
| EP-059 | GET | `/api/v1/tenants` | 取得（tenants）— 自分のAIが作ったたたき台（目標・台帳・AI社 | A07 A08 A12 A45 | 3 | member |  | 401 403 429 502 |
| EP-060 | PATCH | `/api/v1/tenants/:id` | 更新（tenants）— 会社の設定（会社名・請求先・データの所在・タイ | A75 | 1 | member | C2 | 401 403 404 422 429 |

## 3. 画面 ↔ API カバレッジ

- 画面 64 ／ OK 64 ／ 未カバー []
- endpoint の無い行為（v1）[]

## 4. 逆カバレッジ（フィールド → 画面）

- 検査したフィールド 592 ／ 内部専用 138 ／ どの画面にも出ない 0

## 5. 共通仕様

- 正常：`{ data, meta? }`。エラー：`{ error, code, message, details?, retry_after_sec? }`
- 401 未認証／403 権限なし／404 無い（存在を漏らさない）／409 二重／422 入力（表記ゆらぎはサーバーで正規化）／429 レート／502 外部の失敗（信号なし終了を成功にしない）
- ヘッダー：Authorization: Bearer / Content-Type: application/json / X-Request-ID / Idempotency-Key（POST）

## 6. 変更履歴

- v1.0 2026-09-20 凍結（endpoints 60）
