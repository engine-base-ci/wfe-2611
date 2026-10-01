# DAG / Wave Plan — Kaname（2026-09-29）

## 物量

| 指標 | 値 |
|---|---|
| 総機能数 | 122（A 16 / B 20 / C 64 / D 18 / E 4） |
| Wave 数 | 14 |
| 並列度上限 | 10 |
| 工数 Human | 4377.5 h（548 日） |
| 工数 AI 並列 | 計算 772.2 h ＋ 人のレビュー 25.0 h → wall-clock 157.8 h（27 日） |
| 孤立コンポーネント | 0 |
| 循環 | 0 |

## Wave 別並列実行プラン

| Wave | Group | 機能数 | 並列 | Human h | AI 計算 h | wall-clock h |
|---|---|---|---|---|---|---|
| 0 | A Foundation | 10 | 10 | 184 | 27.9 | 11.5 |
| 1 | A Foundation | 6 | 6 | 84 | 12.0 | 4.5 |
| 2 | B Backend | 10 | 10 | 1484 | 355.8 | 53.7 |
| 3 | B Backend | 10 | 10 | 1016 | 218.2 | 43.3 |
| 4 | C UI | 10 | 10 | 225.5 | 22.6 | 6.5 |
| 5 | C UI | 10 | 10 | 175.0 | 17.6 | 3.0 |
| 6 | C UI | 10 | 10 | 199.0 | 19.9 | 4.5 |
| 7 | C UI | 10 | 10 | 167.5 | 16.5 | 2.7 |
| 8 | C UI | 10 | 10 | 148.0 | 14.9 | 2.8 |
| 9 | C UI | 10 | 10 | 168.5 | 16.9 | 2.4 |
| 10 | C UI | 4 | 4 | 60.0 | 6.0 | 2.2 |
| 11 | D Integration | 10 | 10 | 198 | 38.2 | 9.5 |
| 12 | D Integration | 8 | 8 | 216 | 21.6 | 5.7 |
| 13 | E Polish | 4 | 4 | 52 | 9.1 | 5.5 |

## 依存 DAG（Group 順）

- F-V3-A-01 monorepo と CI（lint・型・カバレッジ 80%・EARS validato ←   ⇢ 結線 F-V3-D-09
- F-V3-A-02 アクセス制御の土台（RLS・app.tenant_id / app.user_id /  ←   ⇢ 結線 F-V3-D-02
- F-V3-A-03 証跡の土台（audit_events / ops_audit_events / secu ←   ⇢ 結線 F-V3-D-05
- F-V3-A-04 認証とセッション（Better Auth・sessions 表・全失効・2 段階認証・端 ←   ⇢ 結線 F-V3-D-02 F-V3-D-05
- F-V3-A-C1 関門 C1 ネットワーク（生 API の直接呼び出し禁止・CI で迂回検出） ←   ⇢ 結線 F-V3-D-01
- F-V3-A-C2 関門 C2 永続化（書き込み）（生 API の直接呼び出し禁止・CI で迂回検出） ←   ⇢ 結線 F-V3-D-01
- F-V3-A-C3 関門 C3 モデル呼び出し（生 API の直接呼び出し禁止・CI で迂回検出） ←   ⇢ 結線 F-V3-D-01 F-V3-D-06
- F-V3-A-C4 関門 C4 ファイル / オブジェクト（生 API の直接呼び出し禁止・CI で迂回検出 ←   ⇢ 結線 F-V3-D-06 F-V3-D-08
- F-V3-A-C5 関門 C5 プロセス起動（生 API の直接呼び出し禁止・CI で迂回検出） ←   ⇢ 結線 F-V3-D-01
- F-V3-A-C6 関門 C6 通知送出（生 API の直接呼び出し禁止・CI で迂回検出） ←   ⇢ 結線 F-V3-D-04 F-V3-D-07
- F-V3-A-C7 関門 C7 決済・課金（生 API の直接呼び出し禁止・CI で迂回検出） ←   ⇢ 結線 F-V3-D-08
- F-V3-A-C8 関門 C8 秘密の読み出し（生 API の直接呼び出し禁止・CI で迂回検出） ←   ⇢ 結線 
- F-V3-A-05 OpenAPI → TS 型生成・契約テスト・endpoint 実在性チェック（API  ←   ⇢ 結線 F-V3-D-03 F-V3-D-09
- F-V3-A-06 外部リソースのコード化（バケット・Resend・Infisical・DNS・stagin ←   ⇢ 結線 
- F-V3-A-07 エラー一覧の実行時（error_events・文言と次の一手を errors.json  ←   ⇢ 結線 
- F-V3-A-08 配置と staging の実体（apps/api の起動口 server.ts・Dock ← F-V3-A-05 F-V3-A-06  ⇢ 結線 
- F-V3-B-00 契約してから、自力で動く状態まで持っていきたい — データ・API・権限 ← F-V3-A-01 F-V3-A-02 F-V3-A-03 F-V3-A-04 F-V3-A-05 F-V3-A-07 …  ⇢ 結線 F-V3-D-E2E-01 F-V3-D-E2E-02
- F-V3-B-0b 招かれたので、自分がやることだけ分かる状態にしたい — データ・API・権限 ← F-V3-A-01 F-V3-A-02 F-V3-A-03 F-V3-A-04 F-V3-A-05 F-V3-A-07  ⇢ 結線 F-V3-D-E2E-01
- F-V3-B-0c 入れなくなったときに、自分でパスワードを再設定したい — データ・API・権限 ← F-V3-A-01 F-V3-A-02 F-V3-A-03 F-V3-A-04 F-V3-A-05 F-V3-A-07 …  ⇢ 結線 F-V3-D-E2E-06
- F-V3-B-01 今日なにをすればいいか、迷わず決めたい — データ・API・権限 ← F-V3-A-01 F-V3-A-02 F-V3-A-03 F-V3-A-04 F-V3-A-05 F-V3-A-07 …  ⇢ 結線 F-V3-D-01 F-V3-D-E2E-03 F-V3-D-E2E-04 F-V3-D-E2E-07
- F-V3-B-02 手でやっている繰り返しを、自分の代わりにやらせたい — データ・API・権限 ← F-V3-A-01 F-V3-A-02 F-V3-A-03 F-V3-A-04 F-V3-A-05 F-V3-A-07 …  ⇢ 結線 F-V3-D-E2E-02 F-V3-D-E2E-06 F-V3-D-E2E-07
- F-V3-B-03 AIが勝手に外に出すのが怖い。押す前に中身を見て決めたい — データ・API・権限 ← F-V3-A-01 F-V3-A-02 F-V3-A-03 F-V3-A-04 F-V3-A-05 F-V3-A-07 …  ⇢ 結線 F-V3-D-01 F-V3-D-07 F-V3-D-E2E-02 F-V3-D-E2E-03 F-V3-D-E2E-06 F-V3-D-E2E-07
- F-V3-B-04 案件・請求・問い合わせが今どうなっているか、1か所で見たい — データ・API・権限 ← F-V3-A-01 F-V3-A-02 F-V3-A-03 F-V3-A-04 F-V3-A-05 F-V3-A-07 …  ⇢ 結線 F-V3-D-01 F-V3-D-E2E-03 F-V3-D-E2E-04 F-V3-D-E2E-05
- F-V3-B-05 目標に届くのか、届かないなら何を変えるか知りたい — データ・API・権限 ← F-V3-A-01 F-V3-A-02 F-V3-A-03 F-V3-A-04 F-V3-A-05 F-V3-A-07 …  ⇢ 結線 F-V3-D-01 F-V3-D-E2E-03 F-V3-D-E2E-04 F-V3-D-E2E-05
- F-V3-B-06 なぜ届かなかったかを言葉にして、次の打ち手を決めたい — データ・API・権限 ← F-V3-A-01 F-V3-A-02 F-V3-A-03 F-V3-A-04 F-V3-A-05 F-V3-A-07 …  ⇢ 結線 F-V3-D-E2E-04 F-V3-D-E2E-05
- F-V3-B-07 人に任せたい。任せても品質が落ちないようにしたい — データ・API・権限 ← F-V3-A-01 F-V3-A-02 F-V3-A-03 F-V3-A-04 F-V3-A-05 F-V3-A-07 …  ⇢ 結線 F-V3-D-01 F-V3-D-05 F-V3-D-06 F-V3-D-E2E-03 F-V3-D-E2E-07 F-V3-D-E2E-09
- F-V3-B-08 会社のやり方が、人が辞めても消えないようにしたい — データ・API・権限 ← F-V3-A-01 F-V3-A-02 F-V3-A-03 F-V3-A-04 F-V3-A-05 F-V3-A-07 …  ⇢ 結線 F-V3-D-E2E-05
- F-V3-B-09 このツールを入れて安全か、社内（情シス・コンプラ）に説明できるようにしたい — データ・ ← F-V3-A-01 F-V3-A-02 F-V3-A-03 F-V3-A-04 F-V3-A-05 F-V3-A-07 …  ⇢ 結線 F-V3-D-05 F-V3-D-E2E-01 F-V3-D-E2E-07 F-V3-D-E2E-08
- F-V3-B-11 自分のAIを、自分の考え方に近づけたい — データ・API・権限 ← F-V3-A-01 F-V3-A-02 F-V3-A-03 F-V3-A-04 F-V3-A-05 F-V3-A-07 …  ⇢ 結線 F-V3-D-01 F-V3-D-E2E-02 F-V3-D-E2E-03 F-V3-D-E2E-05 F-V3-D-E2E-07
- F-V3-B-10 導入した顧客が詰まったとき、データを見ずに直したい — データ・API・権限 ← F-V3-A-01 F-V3-A-02 F-V3-A-03 F-V3-A-04 F-V3-A-05 F-V3-A-07 …  ⇢ 結線 F-V3-D-04 F-V3-D-E2E-09
- F-V3-B-14 困ったら運営に聞きたい。止まっているのが自分のせいか Kaname のせいか — データ ← F-V3-A-01 F-V3-A-02 F-V3-A-03 F-V3-A-04 F-V3-A-05 F-V3-A-07 …  ⇢ 結線 F-V3-D-04 F-V3-D-05 F-V3-D-07 F-V3-D-08 F-V3-D-E2E-07
- F-V3-B-15 運営として、問い合わせに答え、お知らせと稼働状況を出し、各社の請求・入金・利 — データ ← F-V3-A-01 F-V3-A-02 F-V3-A-03 F-V3-A-04 F-V3-A-05 F-V3-A-07 …  ⇢ 結線 F-V3-D-04 F-V3-D-07 F-V3-D-08 F-V3-D-E2E-09
- F-V3-B-16 自分のアカウント・会社の設定・既存データの取り込み・外部サービスの連携を、運 — データ ← F-V3-A-01 F-V3-A-02 F-V3-A-03 F-V3-A-04 F-V3-A-05 F-V3-A-07 …  ⇢ 結線 F-V3-D-E2E-07
- F-V3-B-17 運営として、外部サービスの可否（サービス台帳）とプランの定義と目標スキルを管 — データ ← F-V3-A-01 F-V3-A-02 F-V3-A-03 F-V3-A-04 F-V3-A-05 F-V3-A-07 …  ⇢ 結線 F-V3-D-06 F-V3-D-08 F-V3-D-E2E-09
- F-V3-B-13 運営として、公開の申請を審査し、顧客が許可したときだけ支援で中を見て、退会の — データ ← F-V3-A-01 F-V3-A-02 F-V3-A-03 F-V3-A-04 F-V3-A-05 F-V3-A-07 …  ⇢ 結線 F-V3-D-04 F-V3-D-E2E-09
- F-V3-B-12 運営として、各社に配るもの（AI社員・担当業務・ルール・テンプレ）とプランの — データ ← F-V3-A-01 F-V3-A-02 F-V3-A-03 F-V3-A-04 F-V3-A-05 F-V3-A-07  ⇢ 結線 F-V3-D-06 F-V3-D-E2E-09
- F-V3-C-signup 画面 アカウントを作る（2 状態・2 役割） ← F-V3-B-00 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-02 F-V3-D-03 F-V3-D-E2E-01 F-V3-D-09
- F-V3-C-verify-email 画面 メールを確認する（5 状態・2 役割） ← F-V3-B-00 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-E2E-01 F-V3-D-09
- F-V3-C-invite-accept 画面 招待を受けて参加する（3 状態・2 役割） ← F-V3-B-0b F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-02 F-V3-D-03 F-V3-D-E2E-01 F-V3-D-09
- F-V3-C-mfa-setup 画面 2段階認証を設定する（3 状態・3 役割） ← F-V3-B-09 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-02 F-V3-D-03 F-V3-D-E2E-01 F-V3-D-09
- F-V3-C-billing-setup 画面 支払い方法を登録する（4 状態・2 役割） ← F-V3-B-00 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-09
- F-V3-C-login 画面 ログインする（3 状態・4 役割） ← F-V3-B-01 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-02 F-V3-D-03 F-V3-D-E2E-03 F-V3-D-09
- F-V3-C-password-reset 画面 パスワードの再設定（3 状態・3 役割） ← F-V3-B-0c F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-E2E-06 F-V3-D-09
- F-V3-C-onboard-interview 画面 自分のAIと話す（5 状態・2 役割） ← F-V3-B-11 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-E2E-02 F-V3-D-09
- F-V3-C-onboard-draft 画面 たたき台を確かめる（3 状態・2 役割） ← F-V3-B-00 F-V3-B-11 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-E2E-02 F-V3-D-09
- F-V3-C-bridge-setup 画面 自分のPCをつなぐ（8 状態・2 役割） ← F-V3-B-02 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-E2E-02 F-V3-D-09
- F-V3-C-credentials 画面 ログイン情報を預ける（5 状態・2 役割） ← F-V3-B-02 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-E2E-02 F-V3-D-09
- F-V3-C-onboard-testrun 画面 テストで動かす（3 状態・2 役割） ← F-V3-B-03 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-E2E-02 F-V3-D-09
- F-V3-C-onboard-golive 画面 本番に切り替える（2 状態・2 役割） ← F-V3-B-02 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-E2E-02 F-V3-D-09
- F-V3-C-today 画面 今日（6 状態・4 役割） ← F-V3-B-01 F-V3-B-11 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-01 F-V3-D-02 F-V3-D-03 F-V3-D-07 F-V3-D-E2E-03 F-V3-D-09
- F-V3-C-approvals 画面 承認待ち（4 状態・3 役割） ← F-V3-B-03 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-01 F-V3-D-03 F-V3-D-E2E-03 F-V3-D-09
- F-V3-C-clone-thread 画面 自分のAIとAI社員のやりとり（5 状態・3 役割） ← F-V3-B-07 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-01 F-V3-D-03 F-V3-D-E2E-03 F-V3-D-09
- F-V3-C-tasks 画面 タスク（12 状態・4 役割） ← F-V3-B-01 F-V3-B-03 F-V3-B-05 F-V3-B-07 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-01 F-V3-D-03 F-V3-D-E2E-03 F-V3-D-09
- F-V3-C-clone-chat 画面 自分のAIと話す（20 状態・4 役割） ← F-V3-B-11 F-V3-B-03 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-01 F-V3-D-03 F-V3-D-E2E-03 F-V3-D-E2E-07 F-V3-D-09
- F-V3-C-ai-activity 画面 AI社員の動き（4 状態・3 役割） ← F-V3-B-07 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-01 F-V3-D-03 F-V3-D-06 F-V3-D-E2E-03 F-V3-D-09
- F-V3-C-search 画面 探す（3 状態・4 役割） ← F-V3-B-04 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-E2E-03 F-V3-D-09
- F-V3-C-records 画面 台帳（6 状態・4 役割） ← F-V3-B-04 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-E2E-03 F-V3-D-E2E-04 F-V3-D-09
- F-V3-C-record-detail 画面 台帳の1件（3 状態・4 役割） ← F-V3-B-04 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-E2E-03 F-V3-D-09
- F-V3-C-goals 画面 目標（5 状態・3 役割） ← F-V3-B-05 F-V3-B-06 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-06 F-V3-D-E2E-04 F-V3-D-09
- F-V3-C-goal-allocation 画面 目標の配分（6 状態・2 役割） ← F-V3-B-05 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-E2E-04 F-V3-D-09
- F-V3-C-goal-edit 画面 目標を改訂する（2 状態・2 役割） ← F-V3-B-05 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-E2E-05 F-V3-D-09
- F-V3-C-my-progress 画面 自分の目標（3 状態・4 役割） ← F-V3-B-01 F-V3-B-05 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-E2E-04 F-V3-D-09
- F-V3-C-review 画面 ふりかえり（5 状態・2 役割） ← F-V3-B-06 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-E2E-05 F-V3-D-09
- F-V3-C-hypotheses 画面 仮説と施策（5 状態・2 役割） ← F-V3-B-06 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-E2E-05 F-V3-D-09
- F-V3-C-duties 画面 担当業務（6 状態・2 役割） ← F-V3-B-08 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-E2E-05 F-V3-D-09
- F-V3-C-clone-memory 画面 自分のAIの記憶（5 状態・4 役割） ← F-V3-B-11 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-E2E-05 F-V3-D-09
- F-V3-C-ledger-def 画面 台帳の形（3 状態・2 役割） ← F-V3-B-08 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-E2E-05 F-V3-D-09
- F-V3-C-company-model 画面 会社モデル（5 状態・2 役割） ← F-V3-B-08 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-E2E-05 F-V3-D-09
- F-V3-C-automation-repair 画面 覚え直させる（3 状態・2 役割） ← F-V3-B-02 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-E2E-06 F-V3-D-09
- F-V3-C-audit 画面 証跡（6 状態・2 役割） ← F-V3-B-03 F-V3-B-07 F-V3-B-09 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-E2E-06 F-V3-D-E2E-07 F-V3-D-E2E-08 F-V3-D-09
- F-V3-C-policies 画面 ルール（3 状態・4 役割） ← F-V3-B-03 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-E2E-06 F-V3-D-09
- F-V3-C-members 画面 メンバー（7 状態・2 役割） ← F-V3-B-07 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-05 F-V3-D-E2E-07 F-V3-D-09
- F-V3-C-ai-staff 画面 AI社員（4 状態・2 役割） ← F-V3-B-07 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-E2E-07 F-V3-D-09
- F-V3-C-ai-staff-detail 画面 AI社員の1体（5 状態・2 役割） ← F-V3-B-07 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-05 F-V3-D-06 F-V3-D-E2E-07 F-V3-D-E2E-09 F-V3-D-09
- F-V3-C-security-brief 画面 この製品でできること・できないこと（2 状態・2 役割） ← F-V3-B-09 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-E2E-08 F-V3-D-09
- F-V3-C-disclosure 画面 開示資料（4 状態・2 役割） ← F-V3-B-09 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-09
- F-V3-C-export 画面 持ち出す（2 状態・2 役割） ← F-V3-B-09 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-E2E-08 F-V3-D-09
- F-V3-C-account-close 画面 退会する（6 状態・2 役割） ← F-V3-B-09 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-05 F-V3-D-E2E-08 F-V3-D-09
- F-V3-C-ops-support 画面 運営の支援（2 状態・1 役割） ← F-V3-B-10 F-V3-B-15 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-04 F-V3-D-E2E-09 F-V3-D-09
- F-V3-C-ops-home 画面 運営：会社の一覧（4 状態・1 役割） ← F-V3-B-12 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-E2E-09 F-V3-D-09
- F-V3-C-ops-catalog 画面 運営：配るもの（7 状態・1 役割） ← F-V3-B-12 F-V3-B-17 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-E2E-09 F-V3-D-09
- F-V3-C-account 画面 自分のアカウント（2 状態・4 役割） ← F-V3-B-01 F-V3-B-16 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-E2E-07 F-V3-D-09
- F-V3-C-company-settings 画面 会社の設定（2 状態・2 役割） ← F-V3-B-16 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-E2E-07 F-V3-D-09
- F-V3-C-llm-routes 画面 AI の経路（4 状態・2 役割） ← F-V3-B-16 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-09
- F-V3-C-app-setup 画面 アプリと通知（3 状態・4 役割） ← F-V3-B-16 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-09
- F-V3-C-import 画面 取り込み（3 状態・2 役割） ← F-V3-B-16 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-E2E-07 F-V3-D-09
- F-V3-C-services 画面 外部サービスの連携（3 状態・2 役割） ← F-V3-B-16 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-E2E-07 F-V3-D-09
- F-V3-C-ops-services 画面 運営：サービス台帳（2 状態・1 役割） ← F-V3-B-17 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-E2E-09 F-V3-D-09
- F-V3-C-ops-skills 画面 運営：スキル（4 状態・1 役割） ← F-V3-B-17 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-06 F-V3-D-E2E-09 F-V3-D-09
- F-V3-C-inquiry 画面 問い合わせ（5 状態・4 役割） ← F-V3-B-14 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-04 F-V3-D-E2E-07 F-V3-D-09
- F-V3-C-notices 画面 お知らせと通知（3 状態・4 役割） ← F-V3-B-14 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-04 F-V3-D-07 F-V3-D-E2E-07 F-V3-D-09
- F-V3-C-billing 画面 プランと請求（3 状態・2 役割） ← F-V3-B-14 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-05 F-V3-D-08 F-V3-D-E2E-07 F-V3-D-09
- F-V3-C-ops-notices 画面 運営：お知らせ（2 状態・1 役割） ← F-V3-B-15 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-04 F-V3-D-E2E-09 F-V3-D-09
- F-V3-C-ops-billing 画面 運営：請求と入金（2 状態・1 役割） ← F-V3-B-15 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-08 F-V3-D-E2E-09 F-V3-D-09
- F-V3-C-ops-llm 画面 運営：AI の経路と使用量（3 状態・1 役割） ← F-V3-B-15 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-09
- F-V3-C-ops-disclosure 画面 運営：開示資料（3 状態・1 役割） ← F-V3-B-15 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-09
- F-V3-C-ops-tenant 画面 運営：会社の 1 社（1 状態・1 役割） ← F-V3-B-13 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-04 F-V3-D-08 F-V3-D-E2E-09 F-V3-D-09
- F-V3-C-ops-review 画面 運営：公開の審査（2 状態・1 役割） ← F-V3-B-13 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-E2E-09 F-V3-D-09
- F-V3-C-ops-audit 画面 運営：運営の証跡（2 状態・1 役割） ← F-V3-B-13 F-V3-B-15 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-E2E-09 F-V3-D-09
- F-V3-C-member-detail 画面 メンバーの1人（4 状態・2 役割） ← F-V3-B-07 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-05 F-V3-D-E2E-07 F-V3-D-09
- F-V3-D-01 実行ループの結線（自分のAI → 配る → AI社員 action_runs → 関門  ← F-V3-A-C1 F-V3-A-C2 F-V3-A-C3 F-V3-A-C5 F-V3-B-01 F-V3-B-03 …  ⇢ 結線 
- F-V3-D-02 認証 → 会社 → 権限 → 画面の解禁（login → sessions → SET  ← F-V3-A-02 F-V3-A-04 F-V3-C-login F-V3-C-signup F-V3-C-invite-accept F-V3-C-mfa-setup …  ⇢ 結線 
- F-V3-D-03 画面 → API → DB の通し配線（契約テスト・型生成同期・endpoint 実在性 ← F-V3-A-05 F-V3-C-signup F-V3-C-verify-email F-V3-C-invite-accept F-V3-C-mfa-setup F-V3-C-billing-setup …  ⇢ 結線 
- F-V3-D-04 運営 ↔ 顧客の往復（問い合わせ → 受信箱 → 会社の詳細で返答 → 顧客の問い合わせ ← F-V3-B-10 F-V3-B-14 F-V3-B-15 F-V3-B-13 F-V3-C-inquiry F-V3-C-notices …  ⇢ 結線 
- F-V3-D-05 出来事の依存処理 → 全失効（人が抜ける・退会・休止・権限変更・プラン変更・層を消す・A ← F-V3-A-04 F-V3-A-03 F-V3-B-07 F-V3-B-09 F-V3-B-14 F-V3-C-account-close …  ⇢ 結線 
- F-V3-D-06 スキルの配布 → 装着 → Bridge が読む → どのスキルが働いたかが証跡に出る ← F-V3-B-07 F-V3-B-17 F-V3-B-12 F-V3-C-ops-skills F-V3-C-ai-staff-detail F-V3-C-goals …  ⇢ 結線 
- F-V3-D-07 通知の結線（出来事 → 届け先 → outbox → 配達 → 既読・失敗時の再送） ← F-V3-A-C6 F-V3-B-03 F-V3-B-14 F-V3-B-15 F-V3-C-notices F-V3-C-today  ⇢ 結線 
- F-V3-D-08 課金の結線（プラン → 契約 → 月次の請求書 → 入金の記録 → 未収 → 休止の案内 ← F-V3-B-14 F-V3-B-15 F-V3-B-17 F-V3-C-billing F-V3-C-ops-billing F-V3-C-ops-tenant …  ⇢ 結線 
- F-V3-D-E2E-01 流れ J-01 P0 契約・登録（1回だけ） を最後まで通す（L2） ← F-V3-B-00 F-V3-B-09 F-V3-B-0b F-V3-C-invite-accept F-V3-C-mfa-setup F-V3-C-signup …  ⇢ 結線 
- F-V3-D-E2E-02 流れ J-02 P1 はじめの設定 ── PCをつないで、自分のAIと作る（初日〜3日） ← F-V3-B-00 F-V3-B-02 F-V3-B-03 F-V3-B-11 F-V3-C-bridge-setup F-V3-C-credentials …  ⇢ 結線 
- F-V3-D-E2E-03 流れ J-03 P2 毎日 ── 自分のAIと回す を最後まで通す（L2） ← F-V3-B-01 F-V3-B-03 F-V3-B-04 F-V3-B-05 F-V3-B-07 F-V3-B-11 …  ⇢ 結線 
- F-V3-D-E2E-04 流れ J-04 P3 毎週 を最後まで通す（L2） ← F-V3-B-01 F-V3-B-04 F-V3-B-05 F-V3-B-06 F-V3-C-goal-allocation F-V3-C-goals …  ⇢ 結線 
- F-V3-D-E2E-05 流れ J-05 P4 毎月・四半期 を最後まで通す（L2） ← F-V3-B-04 F-V3-B-05 F-V3-B-06 F-V3-B-08 F-V3-B-11 F-V3-C-clone-memory …  ⇢ 結線 
- F-V3-D-E2E-06 流れ J-06 P5 例外・困ったとき を最後まで通す（L2） ← F-V3-B-02 F-V3-B-03 F-V3-B-0c F-V3-C-audit F-V3-C-automation-repair F-V3-C-password-reset …  ⇢ 結線 
- F-V3-D-E2E-07 流れ J-07 P6 人が増えたら を最後まで通す（L2） ← F-V3-B-01 F-V3-B-02 F-V3-B-03 F-V3-B-07 F-V3-B-09 F-V3-B-11 …  ⇢ 結線 
- F-V3-D-E2E-08 流れ J-08 P7 外に説明する・出る を最後まで通す（L2） ← F-V3-B-09 F-V3-C-account-close F-V3-C-audit F-V3-C-export F-V3-C-security-brief  ⇢ 結線 
- F-V3-D-E2E-09 流れ J-09 P8 運営（段階2） を最後まで通す（L2） ← F-V3-B-07 F-V3-B-10 F-V3-B-12 F-V3-B-13 F-V3-B-15 F-V3-B-17 …  ⇢ 結線 
- F-V3-D-09 drift 検出（モック ↔ 実装：h1・状態・第2ナビ・列の値／仕様 ↔ 実装：sta ← F-V3-A-01 F-V3-A-05 F-V3-C-signup F-V3-C-verify-email F-V3-C-invite-accept F-V3-C-mfa-setup …  ⇢ 結線 
- F-V3-E-01 負荷試験（同時接続・集中時の rps・失敗率・接続プール）と有限資源の枯渇 ← F-V3-D-01 F-V3-D-02 F-V3-D-03  ⇢ 結線 
- F-V3-E-02 セキュリティ監査（RLS を故意に壊す・関門の迂回・運営の越境・資格情報の露出） ← F-V3-A-02 F-V3-A-C8 F-V3-D-02 F-V3-D-05  ⇢ 結線 
- F-V3-E-03 ポータビリティと依存の境界の検査（境界外 import・ベンダー固有 SQL・台帳との整 ← F-V3-A-01  ⇢ 結線 
- F-V3-E-04 文書とリリース準備（できること・できないことの開示・API 仕様の公開・変更履歴） ← F-V3-D-01 F-V3-D-02 F-V3-D-03 F-V3-D-04 F-V3-D-05 F-V3-D-06 …  ⇢ 結線 

## 流れ候補（L2・背骨から）

- J-01 P0 契約・登録（1回だけ）：A01 → A02 → A03 → A04（R1/R2/R3/R4）
- J-02 P1 はじめの設定 ── PCをつないで、自分のAIと作る（初日〜3日）：A09 → A06 → A07 → A08 → A10 → A11 → A12（R1/R2）
- J-03 P2 毎日 ── 自分のAIと回す：A13 → A14 → A92 → A55 → A15 → A53 → A16 → A17 → A57 → A56 → A50 → A51 → A48 → A18 → A19 → A20 → A88 → A89 → A90 → A91 → A47 → A58 → A21（R1/R2/R3/R4）
- J-04 P3 毎週：A22 → A54 → A23 → A24 → A25 → A49（R1/R2/R3/R4）
- J-05 P4 毎月・四半期：A26 → A27 → A28 → A29 → A52 → A30 → A93 → A44 → A45（R1/R2/R3/R4）
- J-06 P5 例外・困ったとき：A31 → A32 → A33 → A34 → A35（R1/R2/R3/R4）
- J-07 P6 人が増えたら：A36 → A62 → A67 → A68 → A69 → A74 → A94 → A95 → A75 → A76 → A77 → A66 → A61 → A37 → A38 → A46（R1/R2/R3/R4）
- J-08 P7 外に説明する・出る：A39 → A40 → A41 → A42（R1/R2）
- J-09 P8 運営（段階2）：A43 → A59 → A60 → A70 → A71 → A72 → A73 → A78 → A79 → A80 → A81 → A63 → A64 → A65（R1/R2/R6）

## Risk flags

| 機能 | risk | mitigation |
|---|---|---|
| F-V3-A-02 | 上流を故意に壊す検証（SET を飛ばす）が無いと正常系で判別できない | 人のレビュー 1.0 h |
| F-V3-A-04 | 失効がトークン期限に頼る実装になると G-14 が破れる | 人のレビュー 1.0 h |
| F-V3-A-C7 |  | 人のレビュー 1.0 h |
| F-V3-A-C8 |  | 人のレビュー 1.0 h |
| F-V3-B-00 | 関門を通らない直接呼び出し・RLS 拒否に頼った副作用 | 人のレビュー 1.0 h |
| F-V3-B-0b | 関門を通らない直接呼び出し・RLS 拒否に頼った副作用 | 人のレビュー 1.0 h |
| F-V3-B-0c | 関門を通らない直接呼び出し・RLS 拒否に頼った副作用 | 人のレビュー 1.0 h |
| F-V3-B-01 | 関門を通らない直接呼び出し・RLS 拒否に頼った副作用 | 人のレビュー 1.0 h |
| F-V3-B-02 | 関門を通らない直接呼び出し・RLS 拒否に頼った副作用 | 人のレビュー 1.0 h |
| F-V3-B-03 | 関門を通らない直接呼び出し・RLS 拒否に頼った副作用 | 人のレビュー 1.0 h |
| F-V3-B-04 | 関門を通らない直接呼び出し・RLS 拒否に頼った副作用 | 人のレビュー 1.0 h |
| F-V3-B-05 | 関門を通らない直接呼び出し・RLS 拒否に頼った副作用 | 人のレビュー 1.0 h |
| F-V3-B-07 | 関門を通らない直接呼び出し・RLS 拒否に頼った副作用 | 人のレビュー 1.0 h |
| F-V3-B-08 | 関門を通らない直接呼び出し・RLS 拒否に頼った副作用 | 人のレビュー 1.0 h |
| F-V3-B-09 | 関門を通らない直接呼び出し・RLS 拒否に頼った副作用 | 人のレビュー 1.0 h |
| F-V3-B-10 | 関門を通らない直接呼び出し・RLS 拒否に頼った副作用 | 人のレビュー 1.0 h |
| F-V3-B-14 | 関門を通らない直接呼び出し・RLS 拒否に頼った副作用 | 人のレビュー 1.0 h |
| F-V3-B-15 | 関門を通らない直接呼び出し・RLS 拒否に頼った副作用 | 人のレビュー 1.0 h |
| F-V3-B-16 | 関門を通らない直接呼び出し・RLS 拒否に頼った副作用 | 人のレビュー 1.0 h |
| F-V3-B-13 | 関門を通らない直接呼び出し・RLS 拒否に頼った副作用 | 人のレビュー 1.0 h |
| F-V3-D-01 | stub・echo・境界で throw のまま「完了」に見える | 人のレビュー 1.0 h |
| F-V3-D-02 | stub・echo・境界で throw のまま「完了」に見える | 人のレビュー 1.0 h |
| F-V3-D-05 | stub・echo・境界で throw のまま「完了」に見える | 人のレビュー 1.0 h |
| F-V3-D-08 | stub・echo・境界で throw のまま「完了」に見える | 人のレビュー 1.0 h |
| F-V3-E-02 |  | 人のレビュー 1.0 h |

## 失敗 retry プロトコル

1. CI が PR に失敗を貼る 2. 同じ機能の retry を別ブランチで起動 3. 3 回連続失敗で人にエスカレーション
