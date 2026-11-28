# DAG / Wave Plan — Kaname（2026-11-10）

## 物量

| 指標 | 値 |
|---|---|
| 総機能数 | 134（A 16 / B 24 / C 73 / D 17 / E 4） |
| Wave 数 | 16 |
| 並列度上限 | 10 |
| 工数 Human | 7048.5 h（882 日） |
| 工数 AI 並列 | 計算 1440.2 h ＋ 人のレビュー 26.0 h → wall-clock 316.6 h（53 日） |
| 孤立コンポーネント | 4 |
| 循環 | 0 |

## Wave 別並列実行プラン

| Wave | Group | 機能数 | 並列 | Human h | AI 計算 h | wall-clock h |
|---|---|---|---|---|---|---|
| 0 | A Foundation | 10 | 10 | 184 | 27.9 | 11.5 |
| 1 | A Foundation | 6 | 6 | 84 | 12.0 | 4.5 |
| 2 | B Backend | 10 | 10 | 3596 | 884.3 | 160.3 |
| 3 | B Backend | 10 | 10 | 1535 | 343.0 | 83.0 |
| 4 | B Backend | 4 | 4 | 236 | 36.4 | 12.5 |
| 5 | C UI | 10 | 10 | 195.0 | 19.4 | 6.7 |
| 6 | C UI | 10 | 10 | 150.0 | 15.3 | 2.8 |
| 7 | C UI | 10 | 10 | 158.0 | 15.7 | 4.1 |
| 8 | C UI | 10 | 10 | 112.0 | 11.1 | 2.3 |
| 9 | C UI | 10 | 10 | 129.5 | 12.7 | 2.4 |
| 10 | C UI | 10 | 10 | 105.5 | 10.1 | 2.2 |
| 11 | C UI | 10 | 10 | 105.0 | 10.3 | 1.8 |
| 12 | C UI | 3 | 3 | 28.5 | 2.7 | 1.4 |
| 13 | D Integration | 10 | 10 | 198 | 38.2 | 9.5 |
| 14 | D Integration | 7 | 7 | 180 | 18.0 | 6.1 |
| 15 | E Polish | 4 | 4 | 52 | 9.1 | 5.5 |

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
- F-V3-B-00 登録してすぐ、自分の仕事に使い始めたい — データ・API・権限 ← F-V3-A-01 F-V3-A-02 F-V3-A-03 F-V3-A-04 F-V3-A-05 F-V3-A-07 …  ⇢ 結線 F-V3-D-E2E-01 F-V3-D-E2E-02
- F-V3-B-0b 招かれたので、自分がやることだけ分かる状態にしたい — データ・API・権限 ← F-V3-A-01 F-V3-A-02 F-V3-A-03 F-V3-A-04 F-V3-A-05 F-V3-A-07 …  ⇢ 結線 F-V3-D-E2E-01
- F-V3-B-0c 入れなくなったときに、自分でパスワードを再設定したい — データ・API・権限 ← F-V3-A-01 F-V3-A-02 F-V3-A-03 F-V3-A-04 F-V3-A-05 F-V3-A-07 …  ⇢ 結線 F-V3-D-E2E-05
- F-V3-B-01 今やるチケットと、その中身（何をすれば終わりか）が分かる状態で動きたい — データ・AP ← F-V3-A-01 F-V3-A-02 F-V3-A-03 F-V3-A-04 F-V3-A-05 F-V3-A-07 …  ⇢ 結線 F-V3-D-01 F-V3-D-E2E-03
- F-V3-B-02 手でやっている繰り返し（応募・見積・請求書・返信・メール）を、自分の AI  — データ ← F-V3-A-01 F-V3-A-02 F-V3-A-03 F-V3-A-04 F-V3-A-05 F-V3-A-07 …  ⇢ 結線 F-V3-D-E2E-02 F-V3-D-E2E-03
- F-V3-B-03 AI が外に出す前に、確認の結果を見て自分で OK を出したい — データ・API・権限 ← F-V3-A-01 F-V3-A-02 F-V3-A-03 F-V3-A-04 F-V3-A-05 F-V3-A-07 …  ⇢ 結線 F-V3-D-01 F-V3-D-07 F-V3-D-E2E-03
- F-V3-B-04 案件・請求・問い合わせが今どうなっているか、1か所で見たい — データ・API・権限 ← F-V3-A-01 F-V3-A-02 F-V3-A-03 F-V3-A-04 F-V3-A-05 F-V3-A-07  ⇢ 結線 F-V3-D-01
- F-V3-B-05 目標に届くのか、届かないなら何を変えるか知りたい — データ・API・権限 ← F-V3-A-01 F-V3-A-02 F-V3-A-03 F-V3-A-04 F-V3-A-05 F-V3-A-07  ⇢ 結線 
- F-V3-B-06 なぜ届かなかったかを言葉にして、次の打ち手を決めたい — データ・API・権限 ← F-V3-A-01 F-V3-A-02 F-V3-A-03 F-V3-A-04 F-V3-A-05 F-V3-A-07  ⇢ 結線 
- F-V3-B-07 人に渡したい／人から受けたい。渡しても中身と結果を追いたい — データ・API・権限 ← F-V3-A-01 F-V3-A-02 F-V3-A-03 F-V3-A-04 F-V3-A-05 F-V3-A-07 …  ⇢ 結線 F-V3-D-01 F-V3-D-05 F-V3-D-06 F-V3-D-E2E-03 F-V3-D-E2E-04 F-V3-D-E2E-05
- F-V3-B-08 会社のやり方（ルール・分類・業務の型・ナレッジ）が、人が替わっても効くように — データ ← F-V3-A-01 F-V3-A-02 F-V3-A-03 F-V3-A-04 F-V3-A-05 F-V3-A-07 …  ⇢ 結線 F-V3-D-E2E-05
- F-V3-B-09 安全に使えることを、社内と取引先に説明したい — データ・API・権限 ← F-V3-A-01 F-V3-A-02 F-V3-A-03 F-V3-A-04 F-V3-A-05 F-V3-A-07 …  ⇢ 結線 F-V3-D-05 F-V3-D-E2E-01 F-V3-D-E2E-02 F-V3-D-E2E-05
- F-V3-B-11 直したことが次から効くようにしたい（自分の AI を自分のやり方に近づける） — データ ← F-V3-A-01 F-V3-A-02 F-V3-A-03 F-V3-A-04 F-V3-A-05 F-V3-A-07 …  ⇢ 結線 F-V3-D-E2E-03 F-V3-D-E2E-05
- F-V3-B-10 導入した顧客が詰まったとき、データを見ずに直したい — データ・API・権限 ← F-V3-A-01 F-V3-A-02 F-V3-A-03 F-V3-A-04 F-V3-A-05 F-V3-A-07  ⇢ 結線 
- F-V3-B-14 困ったら運営に聞きたい。止まっているのが自分のせいか Kaname のせいか — データ ← F-V3-A-01 F-V3-A-02 F-V3-A-03 F-V3-A-04 F-V3-A-05 F-V3-A-07 …  ⇢ 結線 F-V3-D-04 F-V3-D-05 F-V3-D-07 F-V3-D-08 F-V3-D-E2E-07
- F-V3-B-15 各社の様子・問い合わせ・請求と入金・お知らせを 1 か所で回したい — データ・API・ ← F-V3-A-01 F-V3-A-02 F-V3-A-03 F-V3-A-04 F-V3-A-05 F-V3-A-07 …  ⇢ 結線 F-V3-D-04 F-V3-D-07 F-V3-D-08 F-V3-D-E2E-08
- F-V3-B-16 ログイン情報・API キー・決まった値を、自分で安全に整えたい — データ・API・権限 ← F-V3-A-01 F-V3-A-02 F-V3-A-03 F-V3-A-04 F-V3-A-05 F-V3-A-07 …  ⇢ 結線 F-V3-D-E2E-02 F-V3-D-E2E-05
- F-V3-B-17 運営として、外部サービスの可否（サービス台帳）とプランの定義と目標スキルを管 — データ ← F-V3-A-01 F-V3-A-02 F-V3-A-03 F-V3-A-04 F-V3-A-05 F-V3-A-07  ⇢ 結線 F-V3-D-06 F-V3-D-08
- F-V3-B-13 運営として、公開の申請を審査し、顧客が許可したときだけ支援で中を見て、退会の — データ ← F-V3-A-01 F-V3-A-02 F-V3-A-03 F-V3-A-04 F-V3-A-05 F-V3-A-07  ⇢ 結線 
- F-V3-B-12 操作・業務の型・ひな形を作って、版を出して配りたい — データ・API・権限 ← F-V3-A-01 F-V3-A-02 F-V3-A-03 F-V3-A-04 F-V3-A-05 F-V3-A-07 …  ⇢ 結線 F-V3-D-06 F-V3-D-E2E-08
- F-V3-B-18 取引先の依頼を受けて、やり取りと検収まで 1 か所で回したい — データ・API・権限 ← F-V3-A-01 F-V3-A-02 F-V3-A-03 F-V3-A-04 F-V3-A-05 F-V3-A-07 …  ⇢ 結線 F-V3-D-E2E-06
- F-V3-B-19 依頼を出して、進みと成果物を見て、OK を返したい — データ・API・権限 ← F-V3-A-01 F-V3-A-02 F-V3-A-03 F-V3-A-04 F-V3-A-05 F-V3-A-07 …  ⇢ 結線 F-V3-D-E2E-06
- F-V3-B-20 過去に何をなぜ決め、誰が何を見て、どう実行したかを遡りたい — データ・API・権限 ← F-V3-A-01 F-V3-A-02 F-V3-A-03 F-V3-A-04 F-V3-A-05 F-V3-A-07 …  ⇢ 結線 F-V3-D-E2E-03 F-V3-D-E2E-05
- F-V3-B-21 管理しながら仕事をスムーズに進めたい。毎日の作業を効率化し、自分の分身（自分 — データ ← F-V3-A-01 F-V3-A-02 F-V3-A-03 F-V3-A-04 F-V3-A-05 F-V3-A-07 …  ⇢ 結線 F-V3-D-01 F-V3-D-E2E-03
- F-V3-C-signup 画面 アカウントを作る（2 状態・4 役割） ← F-V3-B-00 F-V3-B-09 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-02 F-V3-D-03 F-V3-D-E2E-01 F-V3-D-09
- F-V3-C-verify-email 画面 メールを確認する（5 状態・2 役割） ← F-V3-B-00 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-E2E-01 F-V3-D-09
- F-V3-C-invite-accept 画面 招待を受けて参加する（3 状態・2 役割） ← F-V3-B-0b F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-02 F-V3-D-03 F-V3-D-E2E-01 F-V3-D-09
- F-V3-C-mfa-setup 画面 安全の設定（3 状態・4 役割） ← F-V3-B-09 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-02 F-V3-D-03 F-V3-D-E2E-02 F-V3-D-09
- F-V3-C-billing-setup 画面 支払い方法を登録する（4 状態・2 役割） ← F-V3-B-00 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-09
- F-V3-C-login 画面 ログインする（3 状態・4 役割） ← F-V3-B-01 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-02 F-V3-D-03 F-V3-D-E2E-03 F-V3-D-09
- F-V3-C-password-reset 画面 パスワードの再設定（3 状態・4 役割） ← F-V3-B-0c F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-E2E-05 F-V3-D-09
- F-V3-C-onboard-interview 画面 自分のAIと話す（1 状態・2 役割） ← F-V3-B-11 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-09
- F-V3-C-onboard-draft 画面 たたき台を確かめる（1 状態・2 役割） ← F-V3-B-00 F-V3-B-11 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-09
- F-V3-C-bridge-setup 画面 PC をつなぐ（11 状態・3 役割） ← F-V3-B-02 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-E2E-02 F-V3-D-09
- F-V3-C-credentials 画面 預けたログイン情報（5 状態・3 役割） ← F-V3-B-16 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-E2E-02 F-V3-D-09
- F-V3-C-onboard-testrun 画面 テストで動かす（1 状態・2 役割） ← F-V3-B-03 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-09
- F-V3-C-onboard-golive 画面 本番に切り替える（1 状態・2 役割） ← F-V3-B-02 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-09
- F-V3-C-today 画面 今日（1 状態・4 役割） ← F-V3-B-01 F-V3-B-11 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-01 F-V3-D-02 F-V3-D-03 F-V3-D-07 F-V3-D-09
- F-V3-C-approvals 画面 承認待ち（4 状態・3 役割） ← F-V3-B-03 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-01 F-V3-D-03 F-V3-D-E2E-03 F-V3-D-09
- F-V3-C-clone-thread 画面 自分のAIとAI社員のやりとり（1 状態・3 役割） ← F-V3-B-07 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-01 F-V3-D-03 F-V3-D-09
- F-V3-C-tasks 画面 タスク（1 状態・3 役割） ← F-V3-B-07 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-01 F-V3-D-03 F-V3-D-09
- F-V3-C-clone-chat 画面 分身の部屋：会話と知っていること（21 状態・4 役割） ← F-V3-B-11 F-V3-B-21 F-V3-B-03 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-01 F-V3-D-03 F-V3-D-E2E-03 F-V3-D-09
- F-V3-C-ai-activity 画面 分身の部屋：やったこと（4 状態・3 役割） ← F-V3-B-02 F-V3-B-20 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-01 F-V3-D-03 F-V3-D-06 F-V3-D-E2E-03 F-V3-D-09
- F-V3-C-records 画面 台帳（1 状態・4 役割） ← F-V3-B-04 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-09
- F-V3-C-record-detail 画面 台帳の1件（1 状態・4 役割） ← F-V3-B-04 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-09
- F-V3-C-goals 画面 目標（1 状態・3 役割） ← F-V3-B-05 F-V3-B-06 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-06 F-V3-D-09
- F-V3-C-goal-allocation 画面 目標の配分（1 状態・2 役割） ← F-V3-B-05 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-09
- F-V3-C-goal-edit 画面 目標を改訂する（1 状態・2 役割） ← F-V3-B-05 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-09
- F-V3-C-my-progress 画面 自分の目標（1 状態・4 役割） ← F-V3-B-01 F-V3-B-05 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-09
- F-V3-C-review 画面 ふりかえり（1 状態・2 役割） ← F-V3-B-06 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-09
- F-V3-C-hypotheses 画面 仮説と施策（1 状態・2 役割） ← F-V3-B-06 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-09
- F-V3-C-duties 画面 担当業務（1 状態・2 役割） ← F-V3-B-08 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-09
- F-V3-C-ledger-def 画面 台帳の形（1 状態・2 役割） ← F-V3-B-08 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-09
- F-V3-C-company-model 画面 会社モデル（1 状態・2 役割） ← F-V3-B-08 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-09
- F-V3-C-automation-repair 画面 覚え直させる（1 状態・2 役割） ← F-V3-B-02 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-09
- F-V3-C-audit 画面 記録（6 状態・2 役割） ← F-V3-B-20 F-V3-B-03 F-V3-B-07 F-V3-B-09 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-E2E-05 F-V3-D-09
- F-V3-C-policies 画面 ルール（1 状態・4 役割） ← F-V3-B-03 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-09
- F-V3-C-members 画面 メンバー（7 状態・1 役割） ← F-V3-B-07 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-05 F-V3-D-E2E-05 F-V3-D-09
- F-V3-C-ai-staff 画面 AI社員（1 状態・2 役割） ← F-V3-B-07 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-09
- F-V3-C-ai-staff-detail 画面 AI社員の1体（1 状態・2 役割） ← F-V3-B-07 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-05 F-V3-D-06 F-V3-D-09
- F-V3-C-security-brief 画面 この製品でできること・できないこと（1 状態・2 役割） ← F-V3-B-09 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-09
- F-V3-C-disclosure 画面 開示資料（4 状態・2 役割） ← F-V3-B-09 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-09
- F-V3-C-export 画面 持ち出す（1 状態・2 役割） ← F-V3-B-09 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-09
- F-V3-C-account-close 画面 退会する（1 状態・2 役割） ← F-V3-B-09 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-05 F-V3-D-09
- F-V3-C-ops-support 画面 運営：問い合わせ（2 状態・1 役割） ← F-V3-B-10 F-V3-B-15 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-04 F-V3-D-E2E-08 F-V3-D-09
- F-V3-C-ops-home 画面 運営：ワークスペースの一覧（4 状態・1 役割） ← F-V3-B-15 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-E2E-08 F-V3-D-09
- F-V3-C-ops-catalog 画面 運営：配るもの（1 状態・1 役割） ← F-V3-B-12 F-V3-B-17 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-09
- F-V3-C-account 画面 自分の設定（2 状態・4 役割） ← F-V3-B-01 F-V3-B-16 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-E2E-05 F-V3-D-09
- F-V3-C-company-settings 画面 ワークスペースの設定（2 状態・2 役割） ← F-V3-B-08 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-E2E-05 F-V3-D-09
- F-V3-C-llm-routes 画面 AI の経路（4 状態・2 役割） ← F-V3-B-16 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-09
- F-V3-C-app-setup 画面 アプリと通知（3 状態・4 役割） ← F-V3-B-16 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-09
- F-V3-C-import 画面 取り込み（1 状態・2 役割） ← F-V3-B-16 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-09
- F-V3-C-services 画面 外部サービスの連携（1 状態・2 役割） ← F-V3-B-16 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-09
- F-V3-C-ops-services 画面 運営：サービス台帳（1 状態・1 役割） ← F-V3-B-17 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-09
- F-V3-C-ops-skills 画面 運営：配るもの（4 状態・1 役割） ← F-V3-B-12 F-V3-B-15 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-06 F-V3-D-E2E-08 F-V3-D-09
- F-V3-C-inquiry 画面 問い合わせ（5 状態・3 役割） ← F-V3-B-14 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-04 F-V3-D-E2E-07 F-V3-D-09
- F-V3-C-notices 画面 お知らせ（3 状態・4 役割） ← F-V3-B-14 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-04 F-V3-D-07 F-V3-D-E2E-07 F-V3-D-09
- F-V3-C-billing 画面 請求書（3 状態・2 役割） ← F-V3-B-14 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-05 F-V3-D-08 F-V3-D-E2E-07 F-V3-D-09
- F-V3-C-ops-notices 画面 運営：お知らせ（2 状態・1 役割） ← F-V3-B-15 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-04 F-V3-D-E2E-08 F-V3-D-09
- F-V3-C-ops-billing 画面 運営：請求（2 状態・1 役割） ← F-V3-B-15 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-08 F-V3-D-E2E-08 F-V3-D-09
- F-V3-C-ops-llm 画面 運営：AI の経路と使用量（3 状態・1 役割） ← F-V3-B-15 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-09
- F-V3-C-ops-disclosure 画面 運営：開示資料（3 状態・1 役割） ← F-V3-B-15 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-09
- F-V3-C-ops-tenant 画面 運営：ワークスペースの 1 社（1 状態・1 役割） ← F-V3-B-15 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-04 F-V3-D-08 F-V3-D-E2E-08 F-V3-D-09
- F-V3-C-ops-review 画面 運営：公開の審査（1 状態・1 役割） ← F-V3-B-13 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-09
- F-V3-C-ops-audit 画面 運営：運営の証跡（1 状態・1 役割） ← F-V3-B-13 F-V3-B-15 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-09
- F-V3-C-member-detail 画面 メンバーの 1 人（4 状態・1 役割） ← F-V3-B-07 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-05 F-V3-D-E2E-05 F-V3-D-09
- F-V3-C-tickets 画面 チケット（1 状態・4 役割） ← F-V3-B-00 F-V3-B-01 F-V3-B-11 F-V3-B-18 F-V3-B-02 F-V3-B-20 …  ⇢ 結線 F-V3-D-03 F-V3-D-E2E-02 F-V3-D-E2E-03 F-V3-D-E2E-04 F-V3-D-E2E-06 F-V3-D-09
- F-V3-C-masters 画面 決まり（1 状態・2 役割） ← F-V3-B-08 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-E2E-05 F-V3-D-09
- F-V3-C-layers 画面 グループ（メンバーの中）（1 状態・2 役割） ← F-V3-B-08 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-E2E-05 F-V3-D-09
- F-V3-C-rules 画面 ルール（1 状態・3 役割） ← F-V3-B-11 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-E2E-05 F-V3-D-09
- F-V3-C-work-types 画面 業務の型（1 状態・3 役割） ← F-V3-B-11 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-E2E-05 F-V3-D-09
- F-V3-C-knowledge 画面 ナレッジ（1 状態・3 役割） ← F-V3-B-11 F-V3-B-08 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-E2E-05 F-V3-D-09
- F-V3-C-clients 画面 取引先（1 状態・2 役割） ← F-V3-B-18 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-E2E-06 F-V3-D-09
- F-V3-C-requests 画面 届いた依頼（1 状態・2 役割） ← F-V3-B-18 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-E2E-06 F-V3-D-09
- F-V3-C-ops-team 画面 運営：運営の人（1 状態・1 役割） ← F-V3-B-15 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-E2E-08 F-V3-D-09
- F-V3-C-legal 画面 規約・プライバシーポリシー（1 状態・4 役割） ← F-V3-B-09 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-E2E-01 F-V3-D-09
- F-V3-C-portal 画面 クライアントの場所（1 状態・1 役割） ← F-V3-B-19 F-V3-A-01 F-V3-A-05  ⇢ 結線 F-V3-D-03 F-V3-D-E2E-06 F-V3-D-09
- F-V3-D-01 実行ループの結線（自分のAI → 配る → AI社員 action_runs → 関門  ← F-V3-A-C1 F-V3-A-C2 F-V3-A-C3 F-V3-A-C5 F-V3-B-01 F-V3-B-03 …  ⇢ 結線 
- F-V3-D-02 認証 → 会社 → 権限 → 画面の解禁（login → sessions → SET  ← F-V3-A-02 F-V3-A-04 F-V3-C-login F-V3-C-signup F-V3-C-invite-accept F-V3-C-mfa-setup …  ⇢ 結線 
- F-V3-D-03 画面 → API → DB の通し配線（契約テスト・型生成同期・endpoint 実在性 ← F-V3-A-05 F-V3-C-signup F-V3-C-verify-email F-V3-C-invite-accept F-V3-C-mfa-setup F-V3-C-billing-setup …  ⇢ 結線 
- F-V3-D-04 運営 ↔ 顧客の往復（問い合わせ → 受信箱 → 会社の詳細で返答 → 顧客の問い合わせ ← F-V3-B-14 F-V3-B-15 F-V3-C-inquiry F-V3-C-notices F-V3-C-ops-support F-V3-C-ops-tenant …  ⇢ 結線 
- F-V3-D-05 出来事の依存処理 → 全失効（人が抜ける・退会・休止・権限変更・プラン変更・層を消す・A ← F-V3-A-04 F-V3-A-03 F-V3-B-07 F-V3-B-09 F-V3-B-14 F-V3-C-account-close …  ⇢ 結線 
- F-V3-D-06 スキルの配布 → 装着 → Bridge が読む → どのスキルが働いたかが証跡に出る ← F-V3-B-07 F-V3-B-17 F-V3-B-12 F-V3-C-ops-skills F-V3-C-ai-staff-detail F-V3-C-goals …  ⇢ 結線 
- F-V3-D-07 通知の結線（出来事 → 届け先 → outbox → 配達 → 既読・失敗時の再送） ← F-V3-A-C6 F-V3-B-03 F-V3-B-14 F-V3-B-15 F-V3-C-notices F-V3-C-today  ⇢ 結線 
- F-V3-D-08 課金の結線（プラン → 契約 → 月次の請求書 → 入金の記録 → 未収 → 休止の案内 ← F-V3-B-14 F-V3-B-15 F-V3-B-17 F-V3-C-billing F-V3-C-ops-billing F-V3-C-ops-tenant …  ⇢ 結線 
- F-V3-D-E2E-01 流れ J-01 登録 を最後まで通す（L2） ← F-V3-B-00 F-V3-B-09 F-V3-B-0b F-V3-C-invite-accept F-V3-C-legal F-V3-C-signup …  ⇢ 結線 
- F-V3-D-E2E-02 流れ J-02 はじめにやること を最後まで通す（L2） ← F-V3-B-00 F-V3-B-02 F-V3-B-09 F-V3-B-16 F-V3-C-bridge-setup F-V3-C-credentials …  ⇢ 結線 
- F-V3-D-E2E-03 流れ J-03 チケットを回す を最後まで通す（L2） ← F-V3-B-01 F-V3-B-02 F-V3-B-03 F-V3-B-07 F-V3-B-11 F-V3-B-20 …  ⇢ 結線 
- F-V3-D-E2E-04 流れ J-04 渡す・配る を最後まで通す（L2） ← F-V3-B-07 F-V3-C-tickets  ⇢ 結線 
- F-V3-D-E2E-05 流れ J-05 会社の型 を最後まで通す（L2） ← F-V3-B-07 F-V3-B-08 F-V3-B-09 F-V3-B-0c F-V3-B-11 F-V3-B-16 …  ⇢ 結線 
- F-V3-D-E2E-06 流れ J-06 取引先 を最後まで通す（L2） ← F-V3-B-18 F-V3-B-19 F-V3-C-clients F-V3-C-portal F-V3-C-requests F-V3-C-tickets  ⇢ 結線 
- F-V3-D-E2E-07 流れ J-07 運営とのやり取り を最後まで通す（L2） ← F-V3-B-14 F-V3-C-billing F-V3-C-inquiry F-V3-C-notices  ⇢ 結線 
- F-V3-D-E2E-08 流れ J-08 運営 を最後まで通す（L2） ← F-V3-B-12 F-V3-B-15 F-V3-C-ops-billing F-V3-C-ops-home F-V3-C-ops-notices F-V3-C-ops-skills …  ⇢ 結線 
- F-V3-D-09 drift 検出（モック ↔ 実装：h1・状態・第2ナビ・列の値／仕様 ↔ 実装：sta ← F-V3-A-01 F-V3-A-05 F-V3-C-signup F-V3-C-verify-email F-V3-C-invite-accept F-V3-C-mfa-setup …  ⇢ 結線 
- F-V3-E-01 負荷試験（同時接続・集中時の rps・失敗率・接続プール）と有限資源の枯渇 ← F-V3-D-01 F-V3-D-02 F-V3-D-03  ⇢ 結線 
- F-V3-E-02 セキュリティ監査（RLS を故意に壊す・関門の迂回・運営の越境・資格情報の露出） ← F-V3-A-02 F-V3-A-C8 F-V3-D-02 F-V3-D-05  ⇢ 結線 
- F-V3-E-03 ポータビリティと依存の境界の検査（境界外 import・ベンダー固有 SQL・台帳との整 ← F-V3-A-01  ⇢ 結線 
- F-V3-E-04 文書とリリース準備（できること・できないことの開示・API 仕様の公開・変更履歴） ← F-V3-D-01 F-V3-D-02 F-V3-D-03 F-V3-D-04 F-V3-D-05 F-V3-D-06 …  ⇢ 結線 

## 流れ候補（L2・背骨から）

- J-01 登録：A01 → A02 → A96 → A03（R1/R2/R3/R4）
- J-02 はじめにやること：A97 → A09 → A10 → A98（R1/R2/R3/R4）
- J-03 チケットを回す：A13 → A99 → A100 → A129 → A101 → A102 → A130 → A103 → A104 → A105 → A15 → A53 → A106 → A17 → A107 → A108 → A109 → A21 → A58 → A20 → A113 → A57 → A89 → A115 → A116（R1/R2/R3/R4）
- J-04 渡す・配る：A51 → A110 → A48 → A111 → A112（R2/R3）
- J-05 会社の型：A117 → A118 → A131 → A119 → A120 → A114 → A30 → A93 → A36 → A61 → A62 → A74 → A75 → A33 → A40 → A31（R1/R2/R3/R4）
- J-06 取引先：A121 → A122 → A123 → A124 → A125 → A126（R1/R2/R4）
- J-07 運営とのやり取り：A67 → A68 → A69（R1/R2/R3/R4）
- J-08 運営：A60 → A64 → A127 → A70 → A71 → A72 → A80 → A133 → A134 → A128（R6）

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
| F-V3-B-05 | 関門を通らない直接呼び出し・RLS 拒否に頼った副作用 | 人のレビュー 1.0 h |
| F-V3-B-07 | 関門を通らない直接呼び出し・RLS 拒否に頼った副作用 | 人のレビュー 1.0 h |
| F-V3-B-08 | 関門を通らない直接呼び出し・RLS 拒否に頼った副作用 | 人のレビュー 1.0 h |
| F-V3-B-09 | 関門を通らない直接呼び出し・RLS 拒否に頼った副作用 | 人のレビュー 1.0 h |
| F-V3-B-11 | 関門を通らない直接呼び出し・RLS 拒否に頼った副作用 | 人のレビュー 1.0 h |
| F-V3-B-15 | 関門を通らない直接呼び出し・RLS 拒否に頼った副作用 | 人のレビュー 1.0 h |
| F-V3-B-16 | 関門を通らない直接呼び出し・RLS 拒否に頼った副作用 | 人のレビュー 1.0 h |
| F-V3-B-13 | 関門を通らない直接呼び出し・RLS 拒否に頼った副作用 | 人のレビュー 1.0 h |
| F-V3-B-18 | 関門を通らない直接呼び出し・RLS 拒否に頼った副作用 | 人のレビュー 1.0 h |
| F-V3-B-20 | 関門を通らない直接呼び出し・RLS 拒否に頼った副作用 | 人のレビュー 1.0 h |
| F-V3-B-21 | 関門を通らない直接呼び出し・RLS 拒否に頼った副作用 | 人のレビュー 1.0 h |
| F-V3-D-01 | stub・echo・境界で throw のまま「完了」に見える | 人のレビュー 1.0 h |
| F-V3-D-02 | stub・echo・境界で throw のまま「完了」に見える | 人のレビュー 1.0 h |
| F-V3-D-05 | stub・echo・境界で throw のまま「完了」に見える | 人のレビュー 1.0 h |
| F-V3-D-08 | stub・echo・境界で throw のまま「完了」に見える | 人のレビュー 1.0 h |
| F-V3-E-02 |  | 人のレビュー 1.0 h |

## 失敗 retry プロトコル

1. CI が PR に失敗を貼る 2. 同じ機能の retry を別ブランチで起動 3. 3 回連続失敗で人にエスカレーション
