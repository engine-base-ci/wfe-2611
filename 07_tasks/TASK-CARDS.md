# Kaname v3 タスク分解結果（api_first・2026-10-01）

## サマリー

- 総タスク数：214（A 28 / B 40 / D 14 / F 18 / I 22 / S 15 / U-screen 64 / U-shared 8 / V2 5）
- 画面の被覆：64/64
- L1 テスト行：5128（正本 07_qa/test-specs）／ 流れ（L2）：9
- 工数：Human 6284.5 h（786 日）／ AI 計算 1138.3 h ＋ 人のレビュー 88.0 h → wall-clock 334.8 h（56 日・並列 10）
- Wave 数：34

## Group 別タスク一覧

### Group F

| ID | タイトル | category | layer | Human h | AI h | wall-clock | wave | depends_on | L1 行 |
|---|---|---|---|---|---|---|---|---|---|
| T-F-01 | monorepo と CI（lint・型・カバレッジ 80%・EARS validator・laye | infra | foundation | 24 | 1.6 | 1.6 | 0 | 0 | 8 |
| T-F-02 | アクセス制御の土台（RLS・app.tenant_id / app.user_id / app.ro | db | foundation | 20 | 5.0 | 6.0 | 0 | 0 | 8 |
| T-F-03 | アクセス制御の土台（RLS・app.tenant_id / app.user_id / app.ro | db | foundation | 20 | 5.0 | 6.0 | 0 | 0 | 8 |
| T-F-04 | 証跡の土台（audit_events / ops_audit_events / security_e | db | foundation | 16 | 1.3 | 1.3 | 0 | 0 | 8 |
| T-F-05 | 認証とセッション（Better Auth・sessions 表・全失効・2 段階認証・端末）（1/2 | db | foundation | 16 | 4.0 | 5.0 | 0 | 0 | 8 |
| T-F-06 | 認証とセッション（Better Auth・sessions 表・全失効・2 段階認証・端末）（2/2 | db | foundation | 16 | 4.0 | 5.0 | 0 | 0 | 8 |
| T-F-07 | 関門 C1 ネットワーク（生 API の直接呼び出し禁止・CI で迂回検出） | infra | foundation | 12 | 0.8 | 0.8 | 0 | 0 | 8 |
| T-F-08 | 関門 C2 永続化（書き込み）（生 API の直接呼び出し禁止・CI で迂回検出） | infra | foundation | 12 | 0.8 | 0.8 | 0 | 0 | 8 |
| T-F-09 | 関門 C3 モデル呼び出し（生 API の直接呼び出し禁止・CI で迂回検出） | infra | foundation | 12 | 0.8 | 0.8 | 0 | 0 | 8 |
| T-F-10 | 関門 C4 ファイル / オブジェクト（生 API の直接呼び出し禁止・CI で迂回検出） | infra | foundation | 12 | 0.8 | 0.8 | 0 | 0 | 8 |
| T-F-11 | 関門 C5 プロセス起動（生 API の直接呼び出し禁止・CI で迂回検出） | infra | foundation | 12 | 0.8 | 0.8 | 1 | 0 | 8 |
| T-F-12 | 関門 C6 通知送出（生 API の直接呼び出し禁止・CI で迂回検出） | infra | foundation | 12 | 0.8 | 0.8 | 1 | 0 | 8 |
| T-F-13 | 関門 C7 決済・課金（生 API の直接呼び出し禁止・CI で迂回検出） | infra | foundation | 12 | 3.0 | 4.0 | 1 | 0 | 8 |
| T-F-14 | 関門 C8 秘密の読み出し（生 API の直接呼び出し禁止・CI で迂回検出） | infra | foundation | 12 | 3.0 | 4.0 | 1 | 0 | 8 |
| T-F-15 | OpenAPI → TS 型生成・契約テスト・endpoint 実在性チェック（API ↦ UI の | infra | foundation | 12 | 0.8 | 0.8 | 1 | 0 | 8 |
| T-F-16 | 外部リソースのコード化（バケット・Resend・Infisical・DNS・staging）と起動時 | infra | foundation | 16 | 1.1 | 1.1 | 1 | 0 | 8 |
| T-F-17 | エラー一覧の実行時（error_events・文言と次の一手を errors.json から引く・出 | db | foundation | 12 | 1.0 | 1.0 | 1 | 0 | 8 |
| T-F-18 | 配置と staging の実体（apps/api の起動口 server.ts・Dockerfile | infra | foundation | 20 | 1.3 | 1.3 | 2 | 2 | 8 |

### Group D

| ID | タイトル | category | layer | Human h | AI h | wall-clock | wave | depends_on | L1 行 |
|---|---|---|---|---|---|---|---|---|---|
| T-D-01 | データ層 1. テナント・組織・メンバー（7 表・migration・RLS・索引・seed） | db | foundation | 46 | 3.8 | 3.8 | 3 | 3 | 15 |
| T-D-02 | データ層 2. 会社モデル ── 目標（10 表・migration・RLS・索引・seed） | db | foundation | 64 | 5.3 | 5.3 | 3 | 3 | 16 |
| T-D-03 | データ層 3. 会社モデル ── 台帳（5 表・migration・RLS・索引・seed） | db | foundation | 34 | 2.8 | 2.8 | 3 | 3 | 11 |
| T-D-04 | データ層 4. 会社モデル ── 担当業務・記憶（10 表・migration・RLS・索引・see | db | foundation | 64 | 5.3 | 5.3 | 3 | 3 | 18 |
| T-D-05 | データ層 5. 実行・統制（10 表・migration・RLS・索引・seed） | db | foundation | 64 | 16.0 | 17.0 | 3 | 3 | 19 |
| T-D-06 | データ層 6. 会話・成果物・証跡（10 表・migration・RLS・索引・seed） | db | foundation | 64 | 5.3 | 5.3 | 3 | 3 | 23 |
| T-D-07 | データ層 7. マスタ（2 表・migration・RLS・索引・seed） | db | foundation | 16 | 1.3 | 1.3 | 3 | 3 | 8 |
| T-D-08 | データ層 9. 層と権限（4 表・migration・RLS・索引・seed） | db | foundation | 28 | 7.0 | 8.0 | 3 | 3 | 10 |
| T-D-09 | データ層 10. 口座状態の出来事・失効・サポートアクセス（6 表・migration・RLS・索引 | db | foundation | 40 | 10.0 | 11.0 | 3 | 3 | 13 |
| T-D-10 | データ層 11. 運営（9 表・migration・RLS・索引・seed） | db | foundation | 58 | 4.8 | 4.8 | 3 | 3 | 16 |
| T-D-11 | データ層 12. 運営と顧客の間で往復するもの・自分で整えるもの（14 表・migration・RL | db | foundation | 88 | 22.0 | 23.0 | 4 | 3 | 26 |
| T-D-12 | データ層 13. 取り込み・正規連携・招待・持ち出し・添付（6 表・migration・RLS・索引 | db | foundation | 40 | 3.3 | 3.3 | 4 | 3 | 13 |
| T-D-13 | データ層 14. スキル（4 表・migration・RLS・索引・seed） | db | foundation | 28 | 2.3 | 2.3 | 4 | 3 | 10 |
| T-D-14 | データ層 15. 段階 2 で足す表（7 表・migration・RLS・索引・seed） | db | foundation | 46 | 3.8 | 3.8 | 4 | 3 | 14 |

### Group V2

| ID | タイトル | category | layer | Human h | AI h | wall-clock | wave | depends_on | L1 行 |
|---|---|---|---|---|---|---|---|---|---|
| T-V2-01 | 段階 2 の仕様づくり：payment（課金）の E-PAY-*。C7 は N/A（理由つき） | spec | spec | 16 | 2.7 | 2.7 | 5 | 1 | 5 |
| T-V2-02 | 段階 2 の仕様づくり：Stripe 課金 | spec | spec | 16 | 2.7 | 2.7 | 5 | 1 | 5 |
| T-V2-03 | 段階 2 の仕様づくり：LLM の経路の追加 | spec | spec | 16 | 2.7 | 2.7 | 5 | 1 | 5 |
| T-V2-04 | 段階 2 の仕様づくり：アプリ（PC・スマホ） | spec | spec | 16 | 2.7 | 2.7 | 5 | 1 | 5 |
| T-V2-05 | 段階 2 の仕様づくり：情シス向けの開示資料 | spec | spec | 16 | 2.7 | 2.7 | 5 | 1 | 5 |

### Group A

| ID | タイトル | category | layer | Human h | AI h | wall-clock | wave | depends_on | L1 行 |
|---|---|---|---|---|---|---|---|---|---|
| T-A-01 | API 契約してから、自力で動く状態まで持っていきたい — データ・API・（5 endpoint） | backend | backend | 125 | 31.2 | 32.2 | 6 | 22 | 38 |
| T-A-02 | API 招かれたので、自分がやることだけ分かる状態にしたい — データ・AP（1 endpoint） | backend | backend | 26 | 6.5 | 7.5 | 6 | 8 | 10 |
| T-A-03 | API 入れなくなったときに、自分でパスワードを再設定したい — データ・A（1 endpoint） | backend | backend | 32 | 8.0 | 9.0 | 6 | 9 | 11 |
| T-A-04 | API 今日なにをすればいいか、迷わず決めたい — データ・API・権限（1/3）（6 endpoi | backend | backend | 59 | 14.8 | 15.8 | 6 | 16 | 41 |
| T-A-05 | API 今日なにをすればいいか、迷わず決めたい — データ・API・権限（2/3）（6 endpoi | backend | backend | 59 | 14.8 | 15.8 | 6 | 17 | 41 |
| T-A-06 | API 今日なにをすればいいか、迷わず決めたい — データ・API・権限（3/3）（1 endpoi | backend | backend | 59 | 14.8 | 15.8 | 6 | 12 | 12 |
| T-A-07 | API 手でやっている繰り返しを、自分の代わりにやらせたい — データ・AP（5 endpoint） | backend | backend | 113 | 28.2 | 29.2 | 6 | 18 | 39 |
| T-A-08 | API AIが勝手に外に出すのが怖い。押す前に中身を見て決めたい — データ（1/2）（6 endp | backend | backend | 104 | 26.0 | 27.0 | 6 | 17 | 47 |
| T-A-09 | API AIが勝手に外に出すのが怖い。押す前に中身を見て決めたい — データ（2/2）（4 endp | backend | backend | 104 | 26.0 | 27.0 | 6 | 17 | 30 |
| T-A-10 | API 案件・請求・問い合わせが今どうなっているか、1か所で見たい — デー（5 endpoint） | backend | backend | 107 | 26.8 | 27.8 | 6 | 15 | 35 |
| T-A-11 | API 目標に届くのか、届かないなら何を変えるか知りたい — データ・API（6 endpoint） | backend | backend | 173 | 43.2 | 44.2 | 7 | 17 | 45 |
| T-A-12 | API なぜ届かなかったかを言葉にして、次の打ち手を決めたい — データ・A（3 endpoint） | backend | backend | 86 | 7.2 | 7.2 | 7 | 12 | 24 |
| T-A-13 | API 人に任せたい。任せても品質が落ちないようにしたい — データ・API（1/2）（6 endp | backend | backend | 90 | 22.5 | 23.5 | 7 | 18 | 50 |
| T-A-14 | API 人に任せたい。任せても品質が落ちないようにしたい — データ・API（2/2）（3 endp | backend | backend | 90 | 22.5 | 23.5 | 7 | 13 | 24 |
| T-A-15 | API 会社のやり方が、人が辞めても消えないようにしたい — データ・API（3 endpoint） | backend | backend | 104 | 26.0 | 27.0 | 7 | 14 | 27 |
| T-A-16 | API このツールを入れて安全か、社内（情シス・コンプラ）に説明できるように（6 endpoint） | backend | backend | 131 | 32.8 | 33.8 | 7 | 22 | 46 |
| T-A-17 | API 自分のAIを、自分の考え方に近づけたい — データ・API・権限（1/2）（6 endpoi | backend | backend | 73 | 6.1 | 6.1 | 7 | 16 | 42 |
| T-A-18 | API 自分のAIを、自分の考え方に近づけたい — データ・API・権限（2/2）（2 endpoi | backend | backend | 73 | 6.1 | 6.1 | 7 | 11 | 21 |
| T-A-19 | API 導入した顧客が詰まったとき、データを見ずに直したい — データ・AP（3 endpoint） | backend | backend | 146 | 36.5 | 37.5 | 7 | 14 | 23 |
| T-A-20 | API 困ったら運営に聞きたい。止まっているのが自分のせいか Kaname （3 endpoint） | backend | backend | 104 | 26.0 | 27.0 | 7 | 13 | 29 |
| T-A-21 | API 運営として、問い合わせに答え、お知らせと稼働状況を出し、各社の請求・（4 endpoint） | backend | backend | 143 | 35.8 | 36.8 | 8 | 16 | 34 |
| T-A-22 | API 自分のアカウント・会社の設定・既存データの取り込み・外部サービスの連（4 endpoint） | backend | backend | 167 | 41.8 | 42.8 | 8 | 23 | 33 |
| T-A-23 | API 運営として、外部サービスの可否（サービス台帳）とプランの定義と目標ス（3 endpoint） | backend | backend | 98 | 8.2 | 8.2 | 8 | 16 | 27 |
| T-A-24 | API 運営として、公開の申請を審査し、顧客が許可したときだけ支援で中を見て（3 endpoint） | backend | backend | 155 | 38.8 | 39.8 | 8 | 13 | 24 |
| T-A-25 | API 運営として、各社に配るもの（AI社員・担当業務・ルール・テンプレ）と（2 endpoint） | backend | backend | 74 | 6.2 | 6.2 | 8 | 8 | 17 |
| T-A-26 | API このツールを入れて安全か、社内（情シス・コンプラ）に説明できるように（1 endpoint・ | backend | backend | 131 | 32.8 | 33.8 | 32 | 9 | 11 |
| T-A-27 | API 運営として、問い合わせに答え、お知らせと稼働状況を出し、各社の請求・（2 endpoint・ | backend | backend | 143 | 35.8 | 36.8 | 32 | 13 | 18 |
| T-A-28 | API 自分のアカウント・会社の設定・既存データの取り込み・外部サービスの連（2 endpoint・ | backend | backend | 167 | 41.8 | 42.8 | 32 | 16 | 18 |

### Group B

| ID | タイトル | category | layer | Human h | AI h | wall-clock | wave | depends_on | L1 行 |
|---|---|---|---|---|---|---|---|---|---|
| T-B-01 | Bridge の骨組み（Electron・窓・設定の置き場・つなぎ先） | backend | backend | 10 | 2.5 | 3.5 | 9 | 0 | 3 |
| T-B-02 | つなぐ（接続コードを引き取って端末として登録・自己診断） | backend | backend | 8 | 2.0 | 3.0 | 10 | 1 | 3 |
| T-B-03 | 受け取って返す（指示 → 本人の Claude Code → 結果と証跡をサーバーへ） | backend | backend | 24 | 6.0 | 7.0 | 11 | 1 | 9 |
| T-B-04 | 見張る（bridge-guard：作業フォルダの外・銀行・CAPTCHA・規約で禁じるサービスを拒む | backend | backend | 16 | 4.0 | 5.0 | 12 | 1 | 3 |
| T-B-05 | 鍵を受け取る（Bridge は Infisical に入らない。Kaname の関門 C8 が解いた | backend | backend | 12 | 3.0 | 4.0 | 13 | 1 | 3 |
| T-B-08 | 道具どまりの文 39 件を棚卸しする（製品にも出すか、理由つきで外すかを 1 文ずつ決める） | backend | backend | 10 | 2.5 | 3.5 | 9 | 0 | 3 |
| T-B-07 | 関門の迂回 55 件を片付けて、関門の検査を CI に並べる（画面の fetch を C1 の対象外 | backend | backend | 12 | 3.0 | 4.0 | 9 | 0 | 3 |
| T-B-06 | 配布（インストーラ・macOS の公証・Windows の署名・自動更新：署名までは指紋を確かめて自 | backend | backend | 20 | 5.0 | 6.0 | 11 | 1 | 15 |
| T-B-09 | 検索の土台（台帳・記憶・証跡の本文に PGroonga の索引・手元と CI の像に PGroong | backend | backend | 8 | 2.0 | 3.0 | 9 | 0 | 4 |
| T-B-10 | ベクトルを入れる（境を越えたら）：Bridge がモデルを自分で取り・確かめ・直す（Bridge と | backend | backend | 24 | 2.0 | 2.0 | 12 | 2 | 6 |
| T-B-11 | 探す（自分のAI が PGroonga で言い換えを広げて探し、読んで選ぶ・人は言葉の一致で探す・探 | backend | backend | 14 | 3.5 | 4.5 | 10 | 1 | 6 |
| T-B-13 | 自分のAI の仕事の記録（使った量と道具の呼び出しを残す・中身の全文は集めない） | backend | backend | 6 | 1.5 | 2.5 | 12 | 1 | 4 |
| T-B-12 | 段階 1 の置き場を立てる（Vercel の画面と API の 2 プロジェクト・Supabase  | backend | backend | 8 | 2.0 | 3.0 | 9 | 0 | 5 |
| T-B-14 | 資格情報の置き場を Infisical に（会社ごとの置き場・暗号文だけ・Machine Ident | backend | backend | 6 | 1.5 | 2.5 | 9 | 0 | 8 |
| T-B-15 | 会話を分ける（新しく話す＝新しいセッション・一覧・探す（名前も中身も）・名前は自動で付き直せる・星・ | backend | backend | 10 | 2.5 | 3.5 | 13 | 1 | 6 |
| T-B-16 | 書きながら出る返事と作業の見せ方（Bridge が途中の文・今していること・手順を送る。画面は吹き出 | backend | backend | 12 | 3.0 | 4.0 | 13 | 1 | 5 |
| T-B-17 | 止める・止めずに直す・順番待ち（Bridge が動いている Claude Code を止める／次の区 | backend | backend | 10 | 2.5 | 3.5 | 14 | 1 | 6 |
| T-B-18 | 資料と画像を付ける（＋・ドラッグ・貼り付け・長い文は自動で添付・送る前に外せる。置き場に置き、Bri | backend | backend | 12 | 3.0 | 4.0 | 14 | 1 | 6 |
| T-B-19 | 許可のモードと「いつも許可」・問い合わせの答え（毎回聞く／編集は自動／自動で判断／計画だけ／全部許可 | backend | backend | 12 | 3.0 | 4.0 | 14 | 1 | 6 |
| T-B-20 | 自分のAIの使用量（Bridge が Claude Code から 5 時間の枠・週の枠といつ戻るか | backend | backend | 6 | 1.5 | 2.5 | 14 | 1 | 4 |
| T-B-21 | 記憶の毎朝のまとめ（「今日」の一番上のボタン → 溜まった会話と承認・差し戻しを自分のAI が読む  | backend | backend | 14 | 3.5 | 4.5 | 14 | 2 | 6 |
| T-B-22 | 上の層へ上げる候補と食い違い（上げ先は AI が選び本人が送る・OK までは個人で効く・確認者がいな | backend | backend | 10 | 2.5 | 3.5 | 16 | 1 | 6 |
| T-B-23 | 成果物を会話の横で開いて直し、版を残して戻す（返事から書き出す・文書と表はその場で直すと新しい版・版 | backend | backend | 14 | 3.5 | 4.5 | 16 | 1 | 8 |
| T-B-24 | 規約で自動操作が禁止のサービスと銀行を、全部許可でも本人の PC の上で止める（仕事ごとに使わない道 | backend | backend | 12 | 3.0 | 4.0 | 16 | 1 | 7 |
| T-B-25 | 自分のAI が Kaname の道具（MCP）で聞き取ったことをたたき台に置く（目標・台帳・担当業務 | backend | backend | 12 | 3.0 | 4.0 | 12 | 1 | 7 |
| T-B-26 | 自分のAI の仕事の並びを画面が正しく見せる（開き直すと動いている・答えを待っている会話が出る・別の | backend | backend | 4 | 1.0 | 2.0 | 14 | 1 | 2 |
| T-B-27 | 作業中の行が本当のいまを出す（考えている・問い合わせを書いている・返事を書き始めたの切り替わりと最後 | backend | backend | 6 | 1.5 | 2.5 | 14 | 1 | 4 |
| T-B-29 | 答えた問い合わせを届かないまま捨てない（Bridge が受け取ったら印を付け、受け取らないまま止まっ | backend | backend | 3 | 0.8 | 1.8 | 14 | 1 | 2 |
| T-B-31 | 自分のAI の会話は本人の PC の Claude Code の記録が正本（文を記録と同じ id で | backend | backend | 8 | 2.0 | 3.0 | 14 | 1 | 6 |
| T-B-30 | 作業中は 1 行が切り替わる・内部の名前を出さない・絵文字を出さない・選んでもらう質問は問い合わせで | backend | backend | 4 | 1.0 | 2.0 | 14 | 1 | 4 |
| T-B-28 | この PC の Bridge が別のアカウントでつながっているときは黙って切り替えない（理由を出し、 | backend | backend | 3 | 0.8 | 1.8 | 11 | 1 | 2 |
| T-B-32 | 会話が変わったらサーバーから画面に知らせる（DB が member id だけを知らせる・API 1 | backend | backend | 6 | 1.5 | 2.5 | 15 | 1 | 7 |
| T-B-33 | 会話の固定枠（1024 以上で会話の箱だけを画面の残りの高さにし、吹き出しだけがスクロールする。段の | backend | backend | 3 | 0.2 | 0.2 | 15 | 1 | 3 |
| T-B-34 | はじめの設定の「分かったこと」は自分のAI が覚えた事実を「項目：内容」で出す（聞き取りの間だけは分 | backend | backend | 2 | 0.2 | 0.2 | 15 | 1 | 5 |
| T-B-35 | 吹き出しは AI の返答ごとに 1 つ（分かれるのは道具を使って結果を受け取った所だけ。1 回の返答 | backend | backend | 2 | 0.2 | 0.2 | 16 | 1 | 2 |
| T-B-36 | はじめの設定の進み方（次へ進むボタンは画面の下の帯に 1 つ・進めないときは理由・押せない段は何をす | backend | backend | 3 | 0.2 | 0.2 | 15 | 1 | 4 |
| T-B-37 | AI がブラウザを動かす土台（本人の Chrome＝Claude in Chrome が既定・Bri | backend | backend | 16 | 4.0 | 5.0 | 11 | 1 | 10 |
| T-B-38 | ログイン情報を預けたらその場で 1 回ログインだけ試す（入れたらそのまま出る・ほかの操作はしない・結 | backend | backend | 6 | 1.5 | 2.5 | 15 | 2 | 3 |
| T-B-39 | 2 段階認証（種類を選ぶ・認証アプリは鍵で自動・SMS／メール／スマホ承認はその場で本人に頼む・コー | backend | backend | 8 | 2.0 | 3.0 | 15 | 2 | 4 |
| T-B-40 | 会話の画面を詰める・広げる（見出しと説明を 1 行に・入力欄を低く・「会話を広げる」で会話だけ・Es | backend | backend | 3 | 0.2 | 0.2 | 15 | 1 | 2 |

### Group U-shared

| ID | タイトル | category | layer | Human h | AI h | wall-clock | wave | depends_on | L1 行 |
|---|---|---|---|---|---|---|---|---|---|
| T-US-00 | apps/web の土台（Next.js 15 App Router の雛形・Playwright  | frontend | ui | 16 | 1.6 | 1.6 | 17 | 2 | 30 |
| T-US-01 | シェル（サイドバー・レール・第2ナビ・三画面・下タブ・枠の導出 data-frame・役割の出し分け | frontend | ui | 24 | 2.4 | 2.4 | 18 | 4 | 57 |
| T-US-02 | 自分のAIのパネルと会話の部品（会話は AgentChat 1 つ・右パネルは共通の枠が必ず出す・選 | frontend | ui | 32 | 3.2 | 3.2 | 18 | 4 | 30 |
| T-US-03 | API クライアントと型（OpenAPI → types.ts・TanStack Query・別 G | frontend | ui | 12 | 1.2 | 1.2 | 18 | 4 | 8 |
| T-US-04 | 認証の配管（ログイン・2 段階認証・招待・入り直し・端末の失効表示） | frontend | ui | 12 | 1.2 | 1.2 | 18 | 4 | 8 |
| T-US-05 | デザイントークンと部品（Tailwind @theme・shadcn/ui Base UI・Luci | frontend | ui | 16 | 1.6 | 1.6 | 18 | 4 | 8 |
| T-US-06 | タイムライン（svar-gantt・棒を押すと詳細・1023 以下は切替）と見え方の切替（リスト／カ | frontend | ui | 16 | 1.6 | 1.6 | 18 | 4 | 8 |
| T-US-08 | 会話の部品の作り込み（D-104：吹き出し・書式と図とカードと資料の描画・作業の行・問い合わせ・許可 | frontend | ui | 40 | 10.0 | 11.0 | 19 | 2 | 17 |

### Group U-screen

| ID | タイトル | category | layer | Human h | AI h | wall-clock | wave | depends_on | L1 行 |
|---|---|---|---|---|---|---|---|---|---|
| T-U-01 | 画面 アカウントを作る（2 状態・R1/R2） | frontend | ui | 12.0 | 1.2 | 1.2 | 20 | 8 | 35 |
| T-U-02 | 画面 メールを確認する（5 状態・R1/R2） | frontend | ui | 19.5 | 1.9 | 1.9 | 20 | 11 | 47 |
| T-U-03 | 画面 招待を受けて参加する（3 状態・R3/R4） | frontend | ui | 14.5 | 1.4 | 1.4 | 20 | 8 | 28 |
| T-U-04 | 画面 2段階認証を設定する（3 状態・R1/R2/R3） | frontend | ui | 16.0 | 1.6 | 1.6 | 20 | 11 | 34 |
| T-U-05 | 画面 ログインする（3 状態・R1/R2/R3/R4） | frontend | ui | 17.5 | 1.8 | 1.8 | 20 | 11 | 48 |
| T-U-06 | 画面 パスワードの再設定（3 状態・R1/R2/R3） | frontend | ui | 16.0 | 1.6 | 1.6 | 20 | 11 | 37 |
| T-U-07 | 画面 自分のAIと話す（5 状態・R1/R2） | frontend | ui | 19.5 | 1.9 | 1.9 | 20 | 9 | 58 |
| T-U-08 | 画面 たたき台を確かめる（3 状態・R1/R2） | frontend | ui | 14.5 | 1.4 | 1.4 | 20 | 12 | 52 |
| T-U-09 | 画面 自分のPCをつなぐ（11 状態・R1/R2） | frontend | ui | 34.5 | 3.5 | 3.5 | 20 | 9 | 85 |
| T-U-10 | 画面 ログイン情報を預ける（5 状態・R1/R2） | frontend | ui | 19.5 | 1.9 | 1.9 | 20 | 8 | 64 |
| T-U-11 | 画面 テストで動かす（3 状態・R1/R2） | frontend | ui | 14.5 | 1.4 | 1.4 | 21 | 8 | 41 |
| T-U-12 | 画面 本番に切り替える（2 状態・R1/R2） | frontend | ui | 12.0 | 1.2 | 1.2 | 21 | 12 | 34 |
| T-U-13 | 画面 今日（6 状態・R1/R2/R3/R4） | frontend | ui | 25.0 | 2.5 | 2.5 | 21 | 9 | 114 |
| T-U-14 | 画面 承認待ち（4 状態・R1/R2/R3） | frontend | ui | 18.5 | 1.9 | 1.9 | 21 | 8 | 62 |
| T-U-15 | 画面 自分のAIとAI社員のやりとり（5 状態・R1/R2/R3） | frontend | ui | 21.0 | 2.1 | 2.1 | 21 | 9 | 57 |
| T-U-16 | 画面 タスク（12 状態・R1/R2/R3/R4） | frontend | ui | 40.0 | 4.0 | 4.0 | 21 | 13 | 134 |
| T-U-17 | 画面 自分のAIと話す（21 状態・R1/R2/R3/R4） | frontend | ui | 62.5 | 6.2 | 6.2 | 21 | 11 | 219 |
| T-U-18 | 画面 AI社員の動き（4 状態・R1/R2/R3） | frontend | ui | 18.5 | 1.9 | 1.9 | 21 | 12 | 48 |
| T-U-19 | 画面 探す（3 状態・R1/R2/R3/R4） | frontend | ui | 17.5 | 1.8 | 1.8 | 21 | 8 | 41 |
| T-U-20 | 画面 台帳（6 状態・R1/R2/R3/R4） | frontend | ui | 25.0 | 2.5 | 2.5 | 21 | 9 | 57 |
| T-U-21 | 画面 台帳の1件（3 状態・R1/R2/R3/R4） | frontend | ui | 17.5 | 1.8 | 1.8 | 22 | 8 | 56 |
| T-U-22 | 画面 目標（5 状態・R1/R2/R3） | frontend | ui | 21.0 | 2.1 | 2.1 | 22 | 9 | 76 |
| T-U-23 | 画面 目標の配分（6 状態・R1/R2） | frontend | ui | 22.0 | 2.2 | 2.2 | 22 | 9 | 53 |
| T-U-24 | 画面 目標を改訂する（2 状態・R1/R2） | frontend | ui | 12.0 | 1.2 | 1.2 | 22 | 9 | 55 |
| T-U-25 | 画面 自分の目標（3 状態・R1/R2/R3/R4） | frontend | ui | 17.5 | 1.8 | 1.8 | 22 | 9 | 41 |
| T-U-26 | 画面 ふりかえり（5 状態・R1/R2） | frontend | ui | 19.5 | 1.9 | 1.9 | 22 | 8 | 38 |
| T-U-27 | 画面 仮説と施策（5 状態・R1/R2） | frontend | ui | 19.5 | 1.9 | 1.9 | 22 | 8 | 50 |
| T-U-28 | 画面 担当業務（6 状態・R1/R2） | frontend | ui | 22.0 | 2.2 | 2.2 | 22 | 8 | 61 |
| T-U-29 | 画面 自分のAIの記憶（5 状態・R1/R2/R3/R4） | frontend | ui | 22.5 | 2.2 | 2.2 | 22 | 8 | 106 |
| T-U-30 | 画面 台帳の形（3 状態・R1/R2） | frontend | ui | 14.5 | 1.4 | 1.4 | 22 | 9 | 35 |
| T-U-31 | 画面 会社モデル（5 状態・R1/R2） | frontend | ui | 19.5 | 1.9 | 1.9 | 23 | 12 | 45 |
| T-U-32 | 画面 覚え直させる（3 状態・R1/R2） | frontend | ui | 14.5 | 1.4 | 1.4 | 23 | 8 | 36 |
| T-U-33 | 画面 証跡（6 状態・R1/R2） | frontend | ui | 22.0 | 2.2 | 2.2 | 23 | 11 | 59 |
| T-U-34 | 画面 ルール（3 状態・R1/R2/R3/R4） | frontend | ui | 17.5 | 1.8 | 1.8 | 23 | 8 | 43 |
| T-U-35 | 画面 メンバー（7 状態・R1/R2） | frontend | ui | 24.5 | 2.5 | 2.5 | 23 | 9 | 88 |
| T-U-36 | 画面 AI社員（4 状態・R1/R2） | frontend | ui | 17.0 | 1.7 | 1.7 | 23 | 12 | 48 |
| T-U-37 | 画面 AI社員の1体（5 状態・R1/R2） | frontend | ui | 19.5 | 1.9 | 1.9 | 23 | 12 | 50 |
| T-U-38 | 画面 この製品でできること・できないこと（2 状態・R1/R2） | frontend | ui | 12.0 | 1.2 | 1.2 | 23 | 8 | 33 |
| T-U-39 | 画面 持ち出す（2 状態・R1/R2） | frontend | ui | 12.0 | 1.2 | 1.2 | 23 | 8 | 41 |
| T-U-40 | 画面 退会する（6 状態・R1/R2） | frontend | ui | 22.0 | 2.2 | 2.2 | 23 | 9 | 50 |
| T-U-41 | 画面 運営の支援（2 状態・R6） | frontend | ui | 10.5 | 1.1 | 1.1 | 24 | 9 | 39 |
| T-U-42 | 画面 運営：会社の一覧（4 状態・R6） | frontend | ui | 15.5 | 1.6 | 1.6 | 24 | 9 | 36 |
| T-U-43 | 画面 運営：配るもの（7 状態・R6） | frontend | ui | 23.0 | 2.3 | 2.3 | 24 | 12 | 38 |
| T-U-44 | 画面 自分のアカウント（2 状態・R1/R2/R3/R4） | frontend | ui | 15.0 | 1.5 | 1.5 | 24 | 13 | 53 |
| T-U-45 | 画面 会社の設定（2 状態・R1/R2） | frontend | ui | 12.0 | 1.2 | 1.2 | 24 | 8 | 38 |
| T-U-46 | 画面 取り込み（3 状態・R1/R2） | frontend | ui | 14.5 | 1.4 | 1.4 | 24 | 8 | 38 |
| T-U-47 | 画面 外部サービスの連携（3 状態・R1/R2） | frontend | ui | 14.5 | 1.4 | 1.4 | 24 | 8 | 34 |
| T-U-48 | 画面 運営：サービス台帳（2 状態・R6） | frontend | ui | 10.5 | 1.1 | 1.1 | 24 | 8 | 30 |
| T-U-49 | 画面 運営：スキル（4 状態・R6） | frontend | ui | 15.5 | 1.6 | 1.6 | 24 | 8 | 47 |
| T-U-50 | 画面 問い合わせ（5 状態・R1/R2/R3/R4） | frontend | ui | 22.5 | 2.2 | 2.2 | 24 | 8 | 53 |
| T-U-51 | 画面 お知らせと通知（3 状態・R1/R2/R3/R4） | frontend | ui | 17.5 | 1.8 | 1.8 | 25 | 8 | 45 |
| T-U-52 | 画面 プランと請求（3 状態・R1/R2） | frontend | ui | 14.5 | 1.4 | 1.4 | 25 | 8 | 50 |
| T-U-53 | 画面 運営：お知らせ（2 状態・R6） | frontend | ui | 10.5 | 1.1 | 1.1 | 25 | 8 | 44 |
| T-U-54 | 画面 運営：請求と入金（2 状態・R6） | frontend | ui | 10.5 | 1.1 | 1.1 | 25 | 8 | 35 |
| T-U-55 | 画面 運営：会社の 1 社（1 状態・R6） | frontend | ui | 8.0 | 0.8 | 0.8 | 25 | 9 | 46 |
| T-U-56 | 画面 運営：公開の審査（2 状態・R6） | frontend | ui | 10.5 | 1.1 | 1.1 | 25 | 8 | 36 |
| T-U-57 | 画面 運営：運営の証跡（2 状態・R6） | frontend | ui | 10.5 | 1.1 | 1.1 | 25 | 11 | 33 |
| T-U-58 | 画面 メンバーの1人（4 状態・R1/R2） | frontend | ui | 17.0 | 1.7 | 1.7 | 25 | 10 | 71 |
| T-U-59 | 画面 支払い方法を登録する（4 状態・R1/R2・段階 2） | frontend | ui | 17.0 | 1.7 | 1.7 | 33 | 8 | 37 |
| T-U-60 | 画面 開示資料（4 状態・R1/R2・段階 2） | frontend | ui | 17.0 | 1.7 | 1.7 | 33 | 8 | 37 |
| T-U-61 | 画面 AI の経路（4 状態・R1/R2・段階 2） | frontend | ui | 17.0 | 1.7 | 1.7 | 33 | 8 | 54 |
| T-U-62 | 画面 アプリと通知（3 状態・R1/R2/R3/R4・段階 2） | frontend | ui | 17.5 | 1.8 | 1.8 | 33 | 8 | 41 |
| T-U-63 | 画面 運営：AI の経路と使用量（3 状態・R6・段階 2） | frontend | ui | 13.0 | 1.3 | 1.3 | 33 | 8 | 22 |
| T-U-64 | 画面 運営：開示資料（3 状態・R6・段階 2） | frontend | ui | 13.0 | 1.3 | 1.3 | 33 | 8 | 33 |

### Group I

| ID | タイトル | category | layer | Human h | AI h | wall-clock | wave | depends_on | L1 行 |
|---|---|---|---|---|---|---|---|---|---|
| T-I-01 | 実行ループの結線（自分のAI → 配る → AI社員 action_runs → 関門 → 一次確認 | test | integration | 32 | 8.0 | 9.0 | 26 | 21 | 7 |
| T-I-02 | 認証 → 会社 → 権限 → 画面の解禁（login → sessions → SET LOCAL  | test | integration | 20 | 5.0 | 6.0 | 26 | 9 | 7 |
| T-I-03 | 画面 → API → DB の通し配線（契約テスト・型生成同期・endpoint 実在性・別 GET | test | integration | 24 | 2.4 | 2.4 | 26 | 24 | 7 |
| T-I-04 | 運営 ↔ 顧客の往復（問い合わせ → 受信箱 → 会社の詳細で返答 → 顧客の問い合わせに届く／お知 | test | integration | 20 | 2.0 | 2.0 | 26 | 11 | 7 |
| T-I-05 | 出来事の依存処理 → 全失効（人が抜ける・退会・休止・権限変更・プラン変更・層を消す・AI社員を消す | test | integration | 28 | 7.0 | 8.0 | 26 | 13 | 7 |
| T-I-06 | スキルの配布 → 装着 → Bridge が読む → どのスキルが働いたかが証跡に出る | test | integration | 20 | 2.0 | 2.0 | 26 | 10 | 7 |
| T-I-07 | 通知の結線（出来事 → 届け先 → outbox → 配達 → 既読・失敗時の再送） | test | integration | 12 | 1.2 | 1.2 | 26 | 8 | 7 |
| T-I-08 | 課金の結線（プラン → 契約 → 月次の請求書 → 入金の記録 → 未収 → 休止の案内） | test | integration | 16 | 4.0 | 5.0 | 26 | 9 | 7 |
| T-I-09 | 流れ J-01 P0 契約・登録（1回だけ） を最後まで通す（L2） | test | integration | 14 | 1.4 | 1.4 | 26 | 8 | 2 |
| T-I-10 | 流れ J-02 P1 はじめの設定 ── PCをつないで、自分のAIと作る（初日〜3日） を最後まで | test | integration | 20 | 2.0 | 2.0 | 26 | 12 | 2 |
| T-I-11 | 流れ J-03 P2 毎日 ── 自分のAIと回す を最後まで通す（L2） | test | integration | 52 | 5.2 | 5.2 | 27 | 21 | 2 |
| T-I-12 | 流れ J-04 P3 毎週 を最後まで通す（L2） | test | integration | 18 | 1.8 | 1.8 | 27 | 10 | 2 |
| T-I-13 | 流れ J-05 P4 毎月・四半期 を最後まで通す（L2） | test | integration | 24 | 2.4 | 2.4 | 27 | 13 | 2 |
| T-I-14 | 流れ J-06 P5 例外・困ったとき を最後まで通す（L2） | test | integration | 16 | 1.6 | 1.6 | 27 | 8 | 2 |
| T-I-15 | 流れ J-07 P6 人が増えたら を最後まで通す（L2） | test | integration | 38 | 3.8 | 3.8 | 27 | 24 | 2 |
| T-I-16 | 流れ J-08 P7 外に説明する・出る を最後まで通す（L2） | test | integration | 14 | 1.4 | 1.4 | 27 | 6 | 2 |
| T-I-17 | 流れ J-09 P8 運営（段階2） を最後まで通す（L2） | test | integration | 34 | 3.4 | 3.4 | 27 | 19 | 2 |
| T-I-18 | drift 検出（モック ↔ 実装：h1・状態・第2ナビ・列の値／仕様 ↔ 実装：states・tr | test | integration | 12 | 1.2 | 1.2 | 27 | 24 | 7 |
| T-I-19 | 負荷試験（同時接続・集中時の rps・失敗率・接続プール）と有限資源の枯渇 | test | polish | 16 | 1.6 | 1.6 | 28 | 3 | 7 |
| T-I-20 | セキュリティ監査（RLS を故意に壊す・関門の迂回・運営の越境・資格情報の露出） | test | polish | 16 | 4.0 | 5.0 | 28 | 5 | 7 |
| T-I-21 | ポータビリティと依存の境界の検査（境界外 import・ベンダー固有 SQL・台帳との整合） | test | polish | 8 | 0.8 | 0.8 | 27 | 1 | 7 |
| T-I-22 | 文書とリリース準備（できること・できないことの開示・API 仕様の公開・変更履歴） | test | polish | 12 | 1.2 | 1.2 | 28 | 18 | 7 |

### Group S

| ID | タイトル | category | layer | Human h | AI h | wall-clock | wave | depends_on | L1 行 |
|---|---|---|---|---|---|---|---|---|---|
| T-S-01 | スキル一式の形式・雛形・検査（skill_pkg_gate を運営のアップロードに結線） | spec | content | 8 | 2.0 | 3.0 | 29 | 2 | 6 |
| T-S-02 | スキル制作 構築メタ「会社モデル構築」（元ネタ hearing・business-plan） | spec | content | 12 | 3.0 | 4.0 | 30 | 1 | 7 |
| T-S-03 | スキル制作 構築メタ「担当業務の定義（OJT の進め方）」（元ネタ sop-create・outso | spec | content | 12 | 3.0 | 4.0 | 30 | 1 | 7 |
| T-S-04 | スキル制作 構築メタ「台帳の設計（段階・項目・判断基準）」（元ネタ pipeline-managem | spec | content | 12 | 3.0 | 4.0 | 30 | 1 | 7 |
| T-S-05 | スキル制作 構築メタ「目標の分解（年→四半期→月→週）」（元ネタ strategic-goal-sy | spec | content | 12 | 3.0 | 4.0 | 30 | 1 | 7 |
| T-S-06 | スキル制作 構築メタ「改善提案の作り方（未達の原因と再計画）」（元ネタ strategic-goal | spec | content | 12 | 3.0 | 4.0 | 30 | 1 | 7 |
| T-S-07 | スキル制作 構築メタ「自分のAIの育成（好みの引き出し方・記憶への落とし方）」（元ネタ hearin | spec | content | 12 | 3.0 | 4.0 | 30 | 1 | 7 |
| T-S-08 | スキル制作 構築メタ「トラブル対応（覚えた操作が壊れた・承認が滞留）」（元ネタ support-re | spec | content | 12 | 3.0 | 4.0 | 30 | 1 | 7 |
| T-S-09 | スキル制作 目標スキル「営業目標（受託開発）」（元ネタ strategic-goal-system・ | spec | content | 10 | 2.5 | 3.5 | 30 | 1 | 7 |
| T-S-10 | スキル制作 目標スキル「営業目標（飲食）」（元ネタ strategic-goal-system） | spec | content | 10 | 2.5 | 3.5 | 30 | 1 | 7 |
| T-S-11 | スキル制作 目標スキル「納期遵守（制作）」（元ネタ strategic-goal-system・so | spec | content | 10 | 2.5 | 3.5 | 30 | 1 | 7 |
| T-S-12 | スキル制作 業務スキル「発注ナビの新着を台帳に入れる」（元ネタ hatchunavi-apply） | spec | content | 8 | 2.0 | 3.0 | 31 | 1 | 7 |
| T-S-13 | スキル制作 業務スキル「請求書の作成（税込・内訳）」（元ネタ invoice-create） | spec | content | 8 | 2.0 | 3.0 | 31 | 1 | 7 |
| T-S-14 | スキル制作 業務スキル「入金の照合（正規連携）」（元ネタ payment-management・ai | spec | content | 8 | 2.0 | 3.0 | 31 | 1 | 7 |
| T-S-15 | スキル制作 業務スキル「問い合わせの一次返信」（元ネタ support-response・custo | spec | content | 8 | 2.0 | 3.0 | 31 | 1 | 7 |

## タスクカード（1 枚ずつ）

### T-F-01 monorepo と CI（lint・型・カバレッジ 80%・EARS validator・layer_audit）

- group F / layer foundation / phase 1_foundation / wave 0 / Human 24 h・AI 1.6 h・wall-clock 1.6 h
- 行為 — / 画面 — / 表 — / 関門 —（全 PR の merge gate。以後の全 Group の前提）
- 依存 —
- 根拠（逐語）：D-046「段階1〜3はSupabase。段階4でエンタープライズ向けの別経路」 ／ D-050「ポータビリティは3つの仕組みで担保。境界ディレクトリ＋CI検査＋台帳。追跡しなければ『後で移行できる』は必ず嘘になる」
- 触るファイル：.github/workflows/ci.yml (new)、packages/db/migrations/0001_foundation.sql (new)、packages/gateways/README.md (new)、package.json (modify)
- AC（Tier 1）：
- AC（Tier 2）：UBIQUITOUS: 全 PR の merge gate。以後の全 Group の前提 ／ UNWANTED: IF 基盤の検査が無い状態で後段の PR が来たら merge しない
- L1 行 8（['FND-01-001', 'FND-01-002', 'FND-01-003'] …）／ L2 —
- audit: 07_tasks/audit/T-F-01.md

### T-F-02 アクセス制御の土台（RLS・app.tenant_id / app.user_id / app.role・has_per（1/2）

- group F / layer foundation / phase 1_foundation / wave 0 / Human 20 h・AI 5.0 h・wall-clock 6.0 h
- 行為 — / 画面 — / 表 tenants scopes members layers target_kinds abilities / 関門 C2
- 依存 —
- 根拠（逐語）：D-026「スコープ4層(運営/会社/部署/個人)を担当業務・ルール・テンプレ・覚えた操作・記憶すべてに同じ形で使う」 ／ D-073「自分のもの（個人の範囲・自主目標・自分のAIの記憶・自分が作ったAI社員）は権限なしで作る・直す・消す。それ以外は権限の」
- 触るファイル：packages/db/migrations/002_02.sql (new)、packages/db/policies/02.sql (new)、package.json (modify)
- AC（Tier 1）：
- AC（Tier 2）：UBIQUITOUS: 権限＝誰に×何に×どの層で×できること を DB 層で 1 回だけ実装 ／ UNWANTED: IF 基盤の検査が無い状態で後段の PR が来たら merge しない
- L1 行 8（['FND-02-001', 'FND-02-002', 'FND-02-003'] …）／ L2 —
- audit: 07_tasks/audit/T-F-02.md

### T-F-03 アクセス制御の土台（RLS・app.tenant_id / app.user_id / app.role・has_per（2/2）

- group F / layer foundation / phase 1_foundation / wave 0 / Human 20 h・AI 5.0 h・wall-clock 6.0 h
- 行為 — / 画面 — / 表 tenants scopes members layers target_kinds abilities / 関門 C2
- 依存 —
- 根拠（逐語）：D-026「スコープ4層(運営/会社/部署/個人)を担当業務・ルール・テンプレ・覚えた操作・記憶すべてに同じ形で使う」 ／ D-073「自分のもの（個人の範囲・自主目標・自分のAIの記憶・自分が作ったAI社員）は権限なしで作る・直す・消す。それ以外は権限の」
- 触るファイル：packages/db/migrations/003_02.sql (new)、packages/db/policies/02.sql (new)、package.json (modify)
- AC（Tier 1）：
- AC（Tier 2）：UBIQUITOUS: 権限＝誰に×何に×どの層で×できること を DB 層で 1 回だけ実装 ／ UNWANTED: IF 基盤の検査が無い状態で後段の PR が来たら merge しない
- L1 行 8（['FND-02-009', 'FND-02-010', 'FND-02-011'] …）／ L2 —
- audit: 07_tasks/audit/T-F-03.md

### T-F-04 証跡の土台（audit_events / ops_audit_events / security_events 追記専用

- group F / layer foundation / phase 1_foundation / wave 0 / Human 16 h・AI 1.3 h・wall-clock 1.3 h
- 行為 — / 画面 — / 表 audit_events ops_audit_events security_events export_jobs / 関門 C2
- 依存 —
- 根拠（逐語）：D-042「情シス・コンプラが必ず聞くこと。Bridgeで何ができるか完全列挙・送るもの/送らないもの・全操作の証跡を管理者が閲覧エ」 ／ D-074「人が抜ける（無効化・退会）と会社が退会するときに、flow.json の全オブジェクトで何が起きるかを 1 つの表で決め」
- 触るファイル：packages/db/migrations/002_03.sql (new)、packages/db/policies/03.sql (new)、package.json (modify)
- AC（Tier 1）：
- AC（Tier 2）：UBIQUITOUS: 全操作の記録を 1 か所に ／ UNWANTED: IF 基盤の検査が無い状態で後段の PR が来たら merge しない
- L1 行 8（['FND-03-001', 'FND-03-002', 'FND-03-003'] …）／ L2 —
- audit: 07_tasks/audit/T-F-04.md

### T-F-05 認証とセッション（Better Auth・sessions 表・全失効・2 段階認証・端末）（1/2）

- group F / layer foundation / phase 1_foundation / wave 0 / Human 16 h・AI 4.0 h・wall-clock 5.0 h
- 行為 — / 画面 — / 表 members sessions invitations / 関門 —（ログイン → sessions → SET LOCAL → RLS。退会・停止・権限変更・パスワード変更で全行 revoked）
- 依存 —
- 根拠（逐語）：D-042「情シス・コンプラが必ず聞くこと。Bridgeで何ができるか完全列挙・送るもの/送らないもの・全操作の証跡を管理者が閲覧エ」 ／ D-051「ネイティブアプリは今4つだけ決める(認証をトークンベースに等)。後からアプリを足すのが画面を作るだけになる」
- 触るファイル：packages/db/migrations/002_04.sql (new)、packages/db/policies/04.sql (new)、package.json (modify)
- AC（Tier 1）：
- AC（Tier 2）：UBIQUITOUS: ログイン → sessions → SET LOCAL → RLS。退会・停止・権限変更・パスワード変更で全行 revoked ／ UNWANTED: IF 基盤の検査が無い状態で後段の PR が来たら merge しない
- L1 行 8（['FND-04-001', 'FND-04-002', 'FND-04-003'] …）／ L2 —
- audit: 07_tasks/audit/T-F-05.md

### T-F-06 認証とセッション（Better Auth・sessions 表・全失効・2 段階認証・端末）（2/2）

- group F / layer foundation / phase 1_foundation / wave 0 / Human 16 h・AI 4.0 h・wall-clock 5.0 h
- 行為 — / 画面 — / 表 members sessions invitations / 関門 —（ログイン → sessions → SET LOCAL → RLS。退会・停止・権限変更・パスワード変更で全行 revoked）
- 依存 —
- 根拠（逐語）：D-042「情シス・コンプラが必ず聞くこと。Bridgeで何ができるか完全列挙・送るもの/送らないもの・全操作の証跡を管理者が閲覧エ」 ／ D-051「ネイティブアプリは今4つだけ決める(認証をトークンベースに等)。後からアプリを足すのが画面を作るだけになる」
- 触るファイル：packages/db/migrations/003_04.sql (new)、packages/db/policies/04.sql (new)、package.json (modify)
- AC（Tier 1）：
- AC（Tier 2）：UBIQUITOUS: ログイン → sessions → SET LOCAL → RLS。退会・停止・権限変更・パスワード変更で全行 revoked ／ UNWANTED: IF 基盤の検査が無い状態で後段の PR が来たら merge しない
- L1 行 8（['FND-04-009', 'FND-04-010', 'FND-04-011'] …）／ L2 —
- audit: 07_tasks/audit/T-F-06.md

### T-F-07 関門 C1 ネットワーク（生 API の直接呼び出し禁止・CI で迂回検出）

- group F / layer foundation / phase 1_foundation / wave 0 / Human 12 h・AI 0.8 h・wall-clock 0.8 h
- 行為 — / 画面 — / 表 — / 関門 C1
- 依存 —
- 根拠（逐語）：D-013「実行層は接続の器を1回作れば設定で増える形にする。連携を1本ずつ書かない」 ／ D-014「ブラウザ操作が標準の万能手段。API/MCPは後からの最適化。API主・ブラウザは逃げ道という順序付けは誤りとして撤回」
- 触るファイル：packages/gateways/c1/index.ts (new)、scripts/ci/choke_c1.py (new)、package.json (modify)
- AC（Tier 1）：UBIQUITOUS: 関門 C1 は 03_architecture/choke-points.json の gateway_path と forbidden
- AC（Tier 2）：UBIQUITOUS: 外界に出る唯一の道。横断的関心事をここで 1 回だけ ／ UNWANTED: IF 基盤の検査が無い状態で後段の PR が来たら merge しない
- L1 行 8（['FND-C1-001', 'FND-C1-002', 'FND-C1-003'] …）／ L2 —
- audit: 07_tasks/audit/T-F-07.md

### T-F-08 関門 C2 永続化（書き込み）（生 API の直接呼び出し禁止・CI で迂回検出）

- group F / layer foundation / phase 1_foundation / wave 0 / Human 12 h・AI 0.8 h・wall-clock 0.8 h
- 行為 — / 画面 — / 表 — / 関門 C2
- 依存 —
- 根拠（逐語）：D-010「製品の背骨。会社モデル(目標・台帳定義・担当業務・組織・ポリシー・記憶)を1つの定義に。画面もAI社員も自動実行もこの定」 ／ D-038「台帳は『計算しないが、結果は持つ』。CRM/会計の計算は担わないが結果は台帳に持つ」
- 触るファイル：packages/gateways/c2/index.ts (new)、scripts/ci/choke_c2.py (new)、package.json (modify)
- AC（Tier 1）：UBIQUITOUS: 関門 C2 は 03_architecture/choke-points.json の gateway_path と forbidden
- AC（Tier 2）：UBIQUITOUS: 外界に出る唯一の道。横断的関心事をここで 1 回だけ ／ UNWANTED: IF 基盤の検査が無い状態で後段の PR が来たら merge しない
- L1 行 8（['FND-C2-001', 'FND-C2-002', 'FND-C2-003'] …）／ L2 —
- audit: 07_tasks/audit/T-F-08.md

### T-F-09 関門 C3 モデル呼び出し（生 API の直接呼び出し禁止・CI で迂回検出）

- group F / layer foundation / phase 1_foundation / wave 0 / Human 12 h・AI 0.8 h・wall-clock 0.8 h
- 行為 — / 画面 — / 表 — / 関門 C3
- 依存 —
- 根拠（逐語）：D-004「LLMは顧客のサブスク内(Bridge)が既定。APIは顧客負担。運営マネージドは既定OFFの管理者トグル」 ／ D-007「数値はAI社員が会話で出す。分析系の固定画面(ランキング・チャネル別・期間比較)を一切作らない」
- 触るファイル：packages/gateways/c3/index.ts (new)、scripts/ci/choke_c3.py (new)、package.json (modify)
- AC（Tier 1）：UBIQUITOUS: 関門 C3 は 03_architecture/choke-points.json の gateway_path と forbidden
- AC（Tier 2）：UBIQUITOUS: 外界に出る唯一の道。横断的関心事をここで 1 回だけ ／ UNWANTED: IF 基盤の検査が無い状態で後段の PR が来たら merge しない
- L1 行 8（['FND-C3-001', 'FND-C3-002', 'FND-C3-003'] …）／ L2 —
- audit: 07_tasks/audit/T-F-09.md

### T-F-10 関門 C4 ファイル / オブジェクト（生 API の直接呼び出し禁止・CI で迂回検出）

- group F / layer foundation / phase 1_foundation / wave 0 / Human 12 h・AI 0.8 h・wall-clock 0.8 h
- 行為 — / 画面 — / 表 — / 関門 C4
- 依存 —
- 根拠（逐語）：D-029「アップロードは形式を指定しない。何でも受け取ってAIが読む」 ／ D-025「編集の3経路。(1)画面で直接編集=人が変える時は即反映(承認を挟まない) (2)AIに頼む(会話)=AIが変える時だけ」
- 触るファイル：packages/gateways/c4/index.ts (new)、scripts/ci/choke_c4.py (new)、package.json (modify)
- AC（Tier 1）：UBIQUITOUS: 関門 C4 は 03_architecture/choke-points.json の gateway_path と forbidden
- AC（Tier 2）：UBIQUITOUS: 外界に出る唯一の道。横断的関心事をここで 1 回だけ ／ UNWANTED: IF 基盤の検査が無い状態で後段の PR が来たら merge しない
- L1 行 8（['FND-C4-001', 'FND-C4-002', 'FND-C4-003'] …）／ L2 —
- audit: 07_tasks/audit/T-F-10.md

### T-F-11 関門 C5 プロセス起動（生 API の直接呼び出し禁止・CI で迂回検出）

- group F / layer foundation / phase 1_foundation / wave 1 / Human 12 h・AI 0.8 h・wall-clock 0.8 h
- 行為 — / 画面 — / 表 — / 関門 C5
- 依存 —
- 根拠（逐語）：D-015「Bridgeは顧客PCで動く万能実行器。本人のIP・本人のログイン済みセッションで動くのでCAPTCHA/bot検知に到」 ／ D-044「アクションは5方式。コード実行を追加。Kanameを作る手段としてのノーコードは使わない」
- 触るファイル：packages/gateways/c5/index.ts (new)、scripts/ci/choke_c5.py (new)、package.json (modify)
- AC（Tier 1）：UBIQUITOUS: 関門 C5 は 03_architecture/choke-points.json の gateway_path と forbidden
- AC（Tier 2）：UBIQUITOUS: 外界に出る唯一の道。横断的関心事をここで 1 回だけ ／ UNWANTED: IF 基盤の検査が無い状態で後段の PR が来たら merge しない
- L1 行 8（['FND-C5-001', 'FND-C5-002', 'FND-C5-003'] …）／ L2 —
- audit: 07_tasks/audit/T-F-11.md

### T-F-12 関門 C6 通知送出（生 API の直接呼び出し禁止・CI で迂回検出）

- group F / layer foundation / phase 1_foundation / wave 1 / Human 12 h・AI 0.8 h・wall-clock 0.8 h
- 行為 — / 画面 — / 表 — / 関門 C6
- 依存 —
- 根拠（逐語）：D-012「AIは直接変えない。必ず提案として出し人が承認して反映。ただし動線が増えすぎるUX低下は避ける。プルリクエスト的な形は採」 ／ D-043「ネイティブアプリはレスポンシブとは別物。プッシュ通知が本質(承認待ちの通知)。段階2でPWA」
- 触るファイル：packages/gateways/c6/index.ts (new)、scripts/ci/choke_c6.py (new)、package.json (modify)
- AC（Tier 1）：UBIQUITOUS: 関門 C6 は 03_architecture/choke-points.json の gateway_path と forbidden
- AC（Tier 2）：UBIQUITOUS: 外界に出る唯一の道。横断的関心事をここで 1 回だけ ／ UNWANTED: IF 基盤の検査が無い状態で後段の PR が来たら merge しない
- L1 行 8（['FND-C6-001', 'FND-C6-002', 'FND-C6-003'] …）／ L2 —
- audit: 07_tasks/audit/T-F-12.md

### T-F-13 関門 C7 決済・課金（生 API の直接呼び出し禁止・CI で迂回検出）

- group F / layer foundation / phase 1_foundation / wave 1 / Human 12 h・AI 3.0 h・wall-clock 4.0 h
- 行為 — / 画面 — / 表 — / 関門 C7
- 依存 —
- 根拠（逐語）：D-002「65社・月630万。エントリー(個人/一人社長3万)・スタンダード(中小8万)・プロ(中堅15万)の3層。エントリーが集」 ／ D-004「LLMは顧客のサブスク内(Bridge)が既定。APIは顧客負担。運営マネージドは既定OFFの管理者トグル」
- 触るファイル：packages/gateways/c7/index.ts (new)、scripts/ci/choke_c7.py (new)、package.json (modify)
- AC（Tier 1）：UBIQUITOUS: 関門 C7 は 03_architecture/choke-points.json の gateway_path と forbidden
- AC（Tier 2）：UBIQUITOUS: 外界に出る唯一の道。横断的関心事をここで 1 回だけ ／ UNWANTED: IF 基盤の検査が無い状態で後段の PR が来たら merge しない
- L1 行 8（['FND-C7-001', 'FND-C7-002', 'FND-C7-003'] …）／ L2 —
- audit: 07_tasks/audit/T-F-13.md

### T-F-14 関門 C8 秘密の読み出し（生 API の直接呼び出し禁止・CI で迂回検出）

- group F / layer foundation / phase 1_foundation / wave 1 / Human 12 h・AI 3.0 h・wall-clock 4.0 h
- 行為 — / 画面 — / 表 — / 関門 C8
- 依存 —
- 根拠（逐語）：D-017「vaultにID/PW＋TOTPシークレットを暗号化保管し実行器が直接入力。AIには一切渡さない(参照IDのみ)」 ／ D-042「情シス・コンプラが必ず聞くこと。Bridgeで何ができるか完全列挙・送るもの/送らないもの・全操作の証跡を管理者が閲覧エ」
- 触るファイル：packages/gateways/c8/index.ts (new)、scripts/ci/choke_c8.py (new)、package.json (modify)
- AC（Tier 1）：UBIQUITOUS: 関門 C8 は 03_architecture/choke-points.json の gateway_path と forbidden
- AC（Tier 2）：UBIQUITOUS: 外界に出る唯一の道。横断的関心事をここで 1 回だけ ／ UNWANTED: IF 基盤の検査が無い状態で後段の PR が来たら merge しない
- L1 行 8（['FND-C8-001', 'FND-C8-002', 'FND-C8-003'] …）／ L2 —
- audit: 07_tasks/audit/T-F-14.md

### T-F-15 OpenAPI → TS 型生成・契約テスト・endpoint 実在性チェック（API ↦ UI の依存方向を固定）

- group F / layer foundation / phase 1_foundation / wave 1 / Human 12 h・AI 0.8 h・wall-clock 0.8 h
- 行為 — / 画面 — / 表 — / 関門 —（API 契約を信頼源にし frontend/backend が離れないようにする）
- 依存 —
- 根拠（逐語）：D-043「ネイティブアプリはレスポンシブとは別物。プッシュ通知が本質(承認待ちの通知)。段階2でPWA」 ／ D-051「ネイティブアプリは今4つだけ決める(認証をトークンベースに等)。後からアプリを足すのが画面を作るだけになる」
- 触るファイル：.github/workflows/ci.yml (new)、packages/db/migrations/0001_foundation.sql (new)、packages/gateways/README.md (new)、apps/api/package.json (new)
- AC（Tier 1）：
- AC（Tier 2）：UBIQUITOUS: API 契約を信頼源にし frontend/backend が離れないようにする ／ UNWANTED: IF 基盤の検査が無い状態で後段の PR が来たら merge しない
- L1 行 8（['FND-05-001', 'FND-05-002', 'FND-05-003'] …）／ L2 —
- audit: 07_tasks/audit/T-F-15.md

### T-F-16 外部リソースのコード化（バケット・Resend・Infisical・DNS・staging）と起動時の存在確認

- group F / layer foundation / phase 1_foundation / wave 1 / Human 16 h・AI 1.1 h・wall-clock 1.1 h
- 行為 — / 画面 — / 表 — / 関門 —（G-11。ダッシュボードで作る前提を無くす）
- 依存 —
- 根拠（逐語）：D-046「段階1〜3はSupabase。段階4でエンタープライズ向けの別経路」 ／ D-049「移行は簡単ではない。何が動いて何が動かないかを正直に記録」
- 触るファイル：.github/workflows/ci.yml (new)、packages/db/migrations/0001_foundation.sql (new)、packages/gateways/README.md (new)、package.json (modify)
- AC（Tier 1）：
- AC（Tier 2）：UBIQUITOUS: G-11。ダッシュボードで作る前提を無くす ／ UNWANTED: IF 基盤の検査が無い状態で後段の PR が来たら merge しない
- L1 行 8（['FND-06-001', 'FND-06-002', 'FND-06-003'] …）／ L2 —
- audit: 07_tasks/audit/T-F-16.md

### T-F-17 エラー一覧の実行時（error_events・文言と次の一手を errors.json から引く・出せないエラーの検出）

- group F / layer foundation / phase 1_foundation / wave 1 / Human 12 h・AI 1.0 h・wall-clock 1.0 h
- 行為 — / 画面 — / 表 error_events / 関門 —（エラーは正本から。出せないエラーはデッドコード）
- 依存 —
- 根拠（逐語）：D-069「エラーの正本は 07_qa/test-specs/errors.json（第13軸）。モックの異常状態・関門・行為の裏側」
- 触るファイル：packages/db/migrations/002_07.sql (new)、packages/db/policies/07.sql (new)、package.json (modify)
- AC（Tier 1）：
- AC（Tier 2）：UBIQUITOUS: エラーは正本から。出せないエラーはデッドコード ／ UNWANTED: IF 基盤の検査が無い状態で後段の PR が来たら merge しない
- L1 行 8（['FND-07-001', 'FND-07-002', 'FND-07-003'] …）／ L2 —
- audit: 07_tasks/audit/T-F-17.md

### T-F-18 配置と staging の実体（apps/api の起動口 server.ts・Dockerfile・Railway／V

- group F / layer foundation / phase 1_foundation / wave 2 / Human 20 h・AI 1.3 h・wall-clock 1.3 h
- 行為 — / 画面 — / 表 — / 関門 —（画面のタスクがブラウザで L1 を流す staging を、本番と同じ migration／deploy で作れる状態にする（G-11）。2026-09-16 user「staging を作る。作り方を出して」で、API の起動口と Dockerfile が無い・Better Auth の schema auth が Supabase と衝突する・役割のパスワードが migration に直書き、が見つかった）
- 依存 T-F-15 T-F-16
- 根拠（逐語）：D-053「画面は行為から導出する。画面から始めると『この画面で何をしたいか分からない』が必ず起きる。役割×用事→行為の背骨→オブジ」 ／ D-046「段階1〜3はSupabase。段階4でエンタープライズ向けの別経路」
- 触るファイル：.github/workflows/ci.yml (new)、packages/db/migrations/0001_foundation.sql (new)、packages/gateways/README.md (new)、package.json (modify)
- AC（Tier 1）：
- AC（Tier 2）：UBIQUITOUS: 画面のタスクがブラウザで L1 を流す staging を、本番と同じ migration／deploy で作れる状態にする（G-11） ／ UNWANTED: IF 基盤の検査が無い状態で後段の PR が来たら merge しない
- L1 行 8（['FND-08-001', 'FND-08-002', 'FND-08-003'] …）／ L2 —
- audit: 07_tasks/audit/T-F-18.md

### T-D-01 データ層 1. テナント・組織・メンバー（7 表・migration・RLS・索引・seed）

- group D / layer foundation / phase 2_data / wave 3 / Human 46 h・AI 3.8 h・wall-clock 3.8 h
- 行為 — / 画面 — / 表 tenants scopes member_kinds members setup_steps clones / 関門 C2
- 依存 T-F-01 T-F-02 T-F-03
- 根拠（逐語）：D-010「製品の背骨。会社モデル(目標・台帳定義・担当業務・組織・ポリシー・記憶)を1つの定義に。画面もAI社員も自動実行もこの定」 ／ D-026「スコープ4層(運営/会社/部署/個人)を担当業務・ルール・テンプレ・覚えた操作・記憶すべてに同じ形で使う」
- 触るファイル：packages/db/migrations/0101_1..sql (new)、packages/db/policies/tenants.sql (new)、packages/db/schema.ts (modify)
- AC（Tier 1）：UBIQUITOUS: 表 tenants, scopes, member_kinds, members, setup_steps, clones … が ER
- AC（Tier 2）：UNWANTED: IF 他テナントの行を SELECT/UPDATE しようとしたら 0 行／403 で副作用が起きない（tenants_tenant_rea ／ UBIQUITOUS: tenants_tenant_read ／ UBIQUITOUS: tenants_permission_write
- L1 行 15（['RLS-D01-001', 'RLS-D01-002', 'RLS-D01-003'] …）／ L2 —
- audit: 07_tasks/audit/T-D-01.md

### T-D-02 データ層 2. 会社モデル ── 目標（10 表・migration・RLS・索引・seed）

- group D / layer foundation / phase 2_data / wave 3 / Human 64 h・AI 5.3 h・wall-clock 5.3 h
- 行為 — / 画面 — / 表 goal_kinds units rollup_kinds goals goal_allocations goal_contributions / 関門 C2
- 依存 T-F-01 T-F-02 T-F-03
- 根拠（逐語）：D-010「製品の背骨。会社モデル(目標・台帳定義・担当業務・組織・ポリシー・記憶)を1つの定義に。画面もAI社員も自動実行もこの定」 ／ D-032「目標の階層と配分。スコープ層と目標階層は別概念。未配分の可視化。配る権限。合意/指示の2通り。AI社員にも配れる。未達は」
- 触るファイル：packages/db/migrations/0102_2..sql (new)、packages/db/policies/goal_kinds.sql (new)、packages/db/schema.ts (modify)
- AC（Tier 1）：UBIQUITOUS: 表 goal_kinds, units, rollup_kinds, goals, goal_allocations, goal_con
- AC（Tier 2）：UNWANTED: IF 他テナントの行を SELECT/UPDATE しようとしたら 0 行／403 で副作用が起きない（goal_kinds_tenant_ ／ UBIQUITOUS: goal_kinds_all_read ／ UBIQUITOUS: goal_kinds_ops_write
- L1 行 16（['RLS-D02-001', 'RLS-D02-002', 'RLS-D02-003'] …）／ L2 —
- audit: 07_tasks/audit/T-D-02.md

### T-D-03 データ層 3. 会社モデル ── 台帳（5 表・migration・RLS・索引・seed）

- group D / layer foundation / phase 2_data / wave 3 / Human 34 h・AI 2.8 h・wall-clock 2.8 h
- 行為 — / 画面 — / 表 ledger_definitions ledger_fields ledger_stages ledger_views ledger_records / 関門 C2
- 依存 T-F-01 T-F-02 T-F-03
- 根拠（逐語）：D-010「製品の背骨。会社モデル(目標・台帳定義・担当業務・組織・ポリシー・記憶)を1つの定義に。画面もAI社員も自動実行もこの定」 ／ D-038「台帳は『計算しないが、結果は持つ』。CRM/会計の計算は担わないが結果は台帳に持つ」
- 触るファイル：packages/db/migrations/0103_3..sql (new)、packages/db/policies/ledger_definitions.sql (new)、packages/db/schema.ts (modify)
- AC（Tier 1）：UBIQUITOUS: 表 ledger_definitions, ledger_fields, ledger_stages, ledger_views, le
- AC（Tier 2）：UNWANTED: IF 他テナントの行を SELECT/UPDATE しようとしたら 0 行／403 で副作用が起きない（ledger_definitions ／ UBIQUITOUS: ledger_definitions_tenant_read ／ UBIQUITOUS: ledger_definitions_permission_write
- L1 行 11（['RLS-D03-001', 'RLS-D03-002', 'RLS-D03-003'] …）／ L2 —
- audit: 07_tasks/audit/T-D-03.md

### T-D-04 データ層 4. 会社モデル ── 担当業務・記憶（10 表・migration・RLS・索引・seed）

- group D / layer foundation / phase 2_data / wave 3 / Human 64 h・AI 5.3 h・wall-clock 5.3 h
- 行為 — / 画面 — / 表 duties duty_versions learned_procedures procedure_steps memory_kinds memories / 関門 C2
- 依存 T-F-01 T-F-02 T-F-03
- 根拠（逐語）：D-010「製品の背骨。会社モデル(目標・台帳定義・担当業務・組織・ポリシー・記憶)を1つの定義に。画面もAI社員も自動実行もこの定」 ／ D-060「旧称 COO → クローン → 自分のAI。文書上の用語は「自分のAI」。画面では本人の名前＋AI（高本AI／佐藤AI）」
- 触るファイル：packages/db/migrations/0104_4..sql (new)、packages/db/policies/duties.sql (new)、packages/db/schema.ts (modify)
- AC（Tier 1）：UBIQUITOUS: 表 duties, duty_versions, learned_procedures, procedure_steps, memory
- AC（Tier 2）：UNWANTED: IF 他テナントの行を SELECT/UPDATE しようとしたら 0 行／403 で副作用が起きない（duties_tenant_read ／ UBIQUITOUS: duties_tenant_read ／ UBIQUITOUS: duties_permission_write
- L1 行 18（['RLS-D04-001', 'RLS-D04-002', 'RLS-D04-003'] …）／ L2 —
- audit: 07_tasks/audit/T-D-04.md

### T-D-05 データ層 5. 実行・統制（10 表・migration・RLS・索引・seed）

- group D / layer foundation / phase 2_data / wave 3 / Human 64 h・AI 16.0 h・wall-clock 17.0 h
- 行為 — / 画面 — / 表 tasks task_handovers daily_plans triggers policies approvals / 関門 C2
- 依存 T-F-01 T-F-02 T-F-03
- 根拠（逐語）：D-004「LLMは顧客のサブスク内(Bridge)が既定。APIは顧客負担。運営マネージドは既定OFFの管理者トグル」 ／ D-010「製品の背骨。会社モデル(目標・台帳定義・担当業務・組織・ポリシー・記憶)を1つの定義に。画面もAI社員も自動実行もこの定」
- 触るファイル：packages/db/migrations/0105_5..sql (new)、packages/db/policies/tasks.sql (new)、packages/db/schema.ts (modify)
- AC（Tier 1）：UBIQUITOUS: 表 tasks, task_handovers, daily_plans, triggers, policies, approvals 
- AC（Tier 2）：UNWANTED: IF 他テナントの行を SELECT/UPDATE しようとしたら 0 行／403 で副作用が起きない（tasks_tenant_read） ／ UBIQUITOUS: tasks_tenant_read ／ UBIQUITOUS: tasks_permission_write
- L1 行 19（['RLS-D05-001', 'RLS-D05-002', 'RLS-D05-003'] …）／ L2 —
- audit: 07_tasks/audit/T-D-05.md

### T-D-06 データ層 6. 会話・成果物・証跡（10 表・migration・RLS・索引・seed）

- group D / layer foundation / phase 2_data / wave 3 / Human 64 h・AI 5.3 h・wall-clock 5.3 h
- 行為 — / 画面 — / 表 conversations bridge_jobs bridge_job_states bridge_job_events permission_rules agent_usage_snapshots / 関門 C2
- 依存 T-F-01 T-F-02 T-F-03
- 根拠（逐語）：D-062「会話は1本で見え方が2つ。A 会話モード（Claude/LINE 型の専用画面）と B 作業モード（中央＝反映先の画面、」 ／ D-066「会話の部品は1組で、会話モード・右パネル・はじめの設定の会話が同じものを使う。①質問には選択肢チップ＋必ず「その他（自由」
- 触るファイル：packages/db/migrations/0106_6..sql (new)、packages/db/policies/conversations.sql (new)、packages/db/schema.ts (modify)
- AC（Tier 1）：UBIQUITOUS: 表 conversations, bridge_jobs, bridge_job_states, bridge_job_events, 
- AC（Tier 2）：UNWANTED: IF 他テナントの行を SELECT/UPDATE しようとしたら 0 行／403 で副作用が起きない（conversations_tena ／ UBIQUITOUS: conversations_tenant_read ／ UBIQUITOUS: conversations_self_only_write
- L1 行 23（['RLS-D06-001', 'RLS-D06-011', 'RLS-D06-012'] …）／ L2 —
- audit: 07_tasks/audit/T-D-06.md

### T-D-07 データ層 7. マスタ（2 表・migration・RLS・索引・seed）

- group D / layer foundation / phase 2_data / wave 3 / Human 16 h・AI 1.3 h・wall-clock 1.3 h
- 行為 — / 画面 — / 表 session_kinds revoke_reasons / 関門 C2
- 依存 T-F-01 T-F-02 T-F-03
- 根拠（逐語）：D-010「製品の背骨。会社モデル(目標・台帳定義・担当業務・組織・ポリシー・記憶)を1つの定義に。画面もAI社員も自動実行もこの定」
- 触るファイル：packages/db/migrations/0107_7..sql (new)、packages/db/policies/session_kinds.sql (new)、packages/db/schema.ts (modify)
- AC（Tier 1）：UBIQUITOUS: 表 session_kinds, revoke_reasons が ER 図 §7. マスタ の列・型・関係どおりに存在し、全表に RL
- AC（Tier 2）：UNWANTED: IF 他テナントの行を SELECT/UPDATE しようとしたら 0 行／403 で副作用が起きない（session_kinds_tena ／ UBIQUITOUS: session_kinds_all_read ／ UBIQUITOUS: session_kinds_ops_write
- L1 行 8（['RLS-D07-001', 'RLS-D07-002', 'RLS-D07-003'] …）／ L2 —
- audit: 07_tasks/audit/T-D-07.md

### T-D-08 データ層 9. 層と権限（4 表・migration・RLS・索引・seed）

- group D / layer foundation / phase 2_data / wave 3 / Human 28 h・AI 7.0 h・wall-clock 8.0 h
- 行為 — / 画面 — / 表 layers target_kinds abilities permissions / 関門 C2
- 依存 T-F-01 T-F-02 T-F-03
- 根拠（逐語）：D-073「自分のもの（個人の範囲・自主目標・自分のAIの記憶・自分が作ったAI社員）は権限なしで作る・直す・消す。それ以外は権限の」
- 触るファイル：packages/db/migrations/0108_9..sql (new)、packages/db/policies/layers.sql (new)、packages/db/schema.ts (modify)
- AC（Tier 1）：UBIQUITOUS: 表 layers, target_kinds, abilities, permissions が ER 図 §9. 層と権限 の列・型・
- AC（Tier 2）：UNWANTED: IF 他テナントの行を SELECT/UPDATE しようとしたら 0 行／403 で副作用が起きない（layers_tenant_read ／ UBIQUITOUS: layers_tenant_read ／ UBIQUITOUS: layers_permission_write
- L1 行 10（['RLS-D08-001', 'RLS-D08-002', 'RLS-D08-003'] …）／ L2 —
- audit: 07_tasks/audit/T-D-08.md

### T-D-09 データ層 10. 口座状態の出来事・失効・サポートアクセス（6 表・migration・RLS・索引・seed）

- group D / layer foundation / phase 2_data / wave 3 / Human 40 h・AI 10.0 h・wall-clock 11.0 h
- 行為 — / 画面 — / 表 account_events account_event_items sessions support_access_grants retention_holds erasure_certificates / 関門 C2
- 依存 T-F-01 T-F-02 T-F-03
- 根拠（逐語）：D-074「人が抜ける（無効化・退会）と会社が退会するときに、flow.json の全オブジェクトで何が起きるかを 1 つの表で決め」 ／ D-076「全体見直し（01_hearing/全体見直し_20260915.md）の §2・§3・§6 を決定にする。顧客側に 自分」
- 触るファイル：packages/db/migrations/0109_10.sql (new)、packages/db/policies/account_events.sql (new)、packages/db/schema.ts (modify)
- AC（Tier 1）：UBIQUITOUS: 表 account_events, account_event_items, sessions, support_access_gran
- AC（Tier 2）：UNWANTED: IF 他テナントの行を SELECT/UPDATE しようとしたら 0 行／403 で副作用が起きない（account_events_ten ／ UBIQUITOUS: account_events_tenant_read ／ UBIQUITOUS: account_events_self_only_write
- L1 行 13（['RLS-D09-001', 'RLS-D09-002', 'RLS-D09-003'] …）／ L2 —
- audit: 07_tasks/audit/T-D-09.md

### T-D-10 データ層 11. 運営（9 表・migration・RLS・索引・seed）

- group D / layer foundation / phase 2_data / wave 3 / Human 58 h・AI 4.8 h・wall-clock 4.8 h
- 行為 — / 画面 — / 表 distributions distribution_versions tenant_distributions service_registry_versions service_requests review_requests / 関門 C2
- 依存 T-F-01 T-F-02 T-F-03
- 根拠（逐語）：D-027「テンプレは自動共有しない。運営配布＋各社作成＋明示的な公開のみ。最初の1社のものが自動でテンプレになるという記述は破棄」 ／ D-037「AI社員の出どころは運営配布/会社作成/個人作成の3経路。託されたAI社員は使えるが定義は編集できない。個人ルールだけは」
- 触るファイル：packages/db/migrations/0110_11.sql (new)、packages/db/policies/distributions.sql (new)、packages/db/schema.ts (modify)
- AC（Tier 1）：UBIQUITOUS: 表 distributions, distribution_versions, tenant_distributions, servic
- AC（Tier 2）：UNWANTED: IF 他テナントの行を SELECT/UPDATE しようとしたら 0 行／403 で副作用が起きない（distributions_tena ／ UBIQUITOUS: distributions_ops_all ／ UBIQUITOUS: distribution_versions_all_read
- L1 行 16（['RLS-D10-001', 'RLS-D10-002', 'RLS-D10-003'] …）／ L2 —
- audit: 07_tasks/audit/T-D-10.md

### T-D-11 データ層 12. 運営と顧客の間で往復するもの・自分で整えるもの（14 表・migration・RLS・索引・seed）

- group D / layer foundation / phase 2_data / wave 4 / Human 88 h・AI 22.0 h・wall-clock 23.0 h
- 行為 — / 画面 — / 表 inquiries notices notice_deliveries status_incidents notification_preferences notifications / 関門 C2
- 依存 T-F-01 T-F-02 T-F-03
- 根拠（逐語）：D-002「65社・月630万。エントリー(個人/一人社長3万)・スタンダード(中小8万)・プロ(中堅15万)の3層。エントリーが集」 ／ D-043「ネイティブアプリはレスポンシブとは別物。プッシュ通知が本質(承認待ちの通知)。段階2でPWA」
- 触るファイル：packages/db/migrations/0111_12.sql (new)、packages/db/policies/inquiries.sql (new)、packages/db/schema.ts (modify)
- AC（Tier 1）：UBIQUITOUS: 表 inquiries, notices, notice_deliveries, status_incidents, notificat
- AC（Tier 2）：UNWANTED: IF 他テナントの行を SELECT/UPDATE しようとしたら 0 行／403 で副作用が起きない（inquiries_tenant_r ／ UBIQUITOUS: inquiries_tenant_read ／ UBIQUITOUS: inquiries_self_only_write
- L1 行 26（['RLS-D11-001', 'RLS-D11-002', 'RLS-D11-003'] …）／ L2 —
- audit: 07_tasks/audit/T-D-11.md

### T-D-12 データ層 13. 取り込み・正規連携・招待・持ち出し・添付（6 表・migration・RLS・索引・seed）

- group D / layer foundation / phase 2_data / wave 4 / Human 40 h・AI 3.3 h・wall-clock 3.3 h
- 行為 — / 画面 — / 表 imports integrations invitations pending_signup export_jobs attachments / 関門 C2
- 依存 T-F-01 T-F-02 T-F-03
- 根拠（逐語）：D-025「編集の3経路。(1)画面で直接編集=人が変える時は即反映(承認を挟まない) (2)AIに頼む(会話)=AIが変える時だけ」 ／ D-026「スコープ4層(運営/会社/部署/個人)を担当業務・ルール・テンプレ・覚えた操作・記憶すべてに同じ形で使う」
- 触るファイル：packages/db/migrations/0112_13.sql (new)、packages/db/policies/imports.sql (new)、packages/db/schema.ts (modify)
- AC（Tier 1）：UBIQUITOUS: 表 imports, integrations, invitations, pending_signup, export_jobs, a
- AC（Tier 2）：UNWANTED: IF 他テナントの行を SELECT/UPDATE しようとしたら 0 行／403 で副作用が起きない（imports_tenant_rea ／ UBIQUITOUS: imports_tenant_read ／ UBIQUITOUS: imports_permission_write
- L1 行 13（['RLS-D12-001', 'RLS-D12-002', 'RLS-D12-003'] …）／ L2 —
- audit: 07_tasks/audit/T-D-12.md

### T-D-13 データ層 14. スキル（4 表・migration・RLS・索引・seed）

- group D / layer foundation / phase 2_data / wave 4 / Human 28 h・AI 2.3 h・wall-clock 2.3 h
- 行為 — / 画面 — / 表 skills skill_versions skill_test_runs skill_attachments / 関門 C2
- 依存 T-F-01 T-F-02 T-F-03
- 根拠（逐語）：D-078「§30（構築メタスキル群）と §63（目標スキル）は決めたのに、運営がスキルを構築・アップロード・テスト・版管理・配布し」 ／ D-080「D-078 は器（保存・版・装着）。ここで中身を決める。スキルは SKILL.md ＋ references ＋ eva」
- 触るファイル：packages/db/migrations/0113_14.sql (new)、packages/db/policies/skills.sql (new)、packages/db/schema.ts (modify)
- AC（Tier 1）：UBIQUITOUS: 表 skills, skill_versions, skill_test_runs, skill_attachments が ER 図 
- AC（Tier 2）：UNWANTED: IF 他テナントの行を SELECT/UPDATE しようとしたら 0 行／403 で副作用が起きない（skills_tenant_read ／ UBIQUITOUS: skills_ops_all ／ UBIQUITOUS: skill_versions_all_read
- L1 行 10（['RLS-D13-001', 'RLS-D13-002', 'RLS-D13-003'] …）／ L2 —
- audit: 07_tasks/audit/T-D-13.md

### T-D-14 データ層 15. 段階 2 で足す表（7 表・migration・RLS・索引・seed）

- group D / layer foundation / phase 2_data / wave 4 / Human 46 h・AI 3.8 h・wall-clock 3.8 h
- 行為 — / 画面 — / 表 payment_methods billing_events llm_routes llm_capabilities push_devices disclosure_versions / 関門 C2
- 依存 T-F-01 T-F-02 T-F-03
- 根拠（逐語）：D-004「LLMは顧客のサブスク内(Bridge)が既定。APIは顧客負担。運営マネージドは既定OFFの管理者トグル」 ／ D-042「情シス・コンプラが必ず聞くこと。Bridgeで何ができるか完全列挙・送るもの/送らないもの・全操作の証跡を管理者が閲覧エ」
- 触るファイル：packages/db/migrations/0114_15.sql (new)、packages/db/policies/payment_methods.sql (new)、packages/db/schema.ts (modify)
- AC（Tier 1）：UBIQUITOUS: 表 payment_methods, billing_events, llm_routes, llm_capabilities, pus
- AC（Tier 2）：UNWANTED: IF 他テナントの行を SELECT/UPDATE しようとしたら 0 行／403 で副作用が起きない（payment_methods_te ／ UBIQUITOUS: payment_methods_tenant_read ／ UBIQUITOUS: payment_methods_permission_write
- L1 行 14（['RLS-D14-001', 'RLS-D14-002', 'RLS-D14-003'] …）／ L2 —
- audit: 07_tasks/audit/T-D-14.md

### T-A-01 API 契約してから、自力で動く状態まで持っていきたい — データ・API・（5 endpoint）

- group A / layer backend / phase 3_api / wave 6 / Human 125 h・AI 31.2 h・wall-clock 32.2 h
- 行為 A01 A02 A04 A05 A06 A07 A08 A09 A12 A13 A31 A45 A94 / 画面 account bridge-setup company-model login mfa-setup onboard-draft onboard-golive onboard-interview password-reset signup verify-email / 表 tenants members clones goals ledger_definitions duties / 関門 C2 C3 C5 C7 C8
- 依存 T-F-01 T-F-02 T-F-03 T-F-04 T-F-05 T-D-01 T-D-02 T-D-03 T-D-04 T-D-05
- 根拠（逐語）：D-001「2028-09までに200社→65社に修正。自社SaaS外販。初期顧客が自力で回せることが前提」 ／ D-002「65社・月630万。エントリー(個人/一人社長3万)・スタンダード(中小8万)・プロ(中堅15万)の3層。エントリーが集」
- 触るファイル：apps/api/src/routes/clones.ts (new)、apps/api/src/routes/members.ts (new)、apps/api/src/routes/sessions.ts (new)、apps/api/src/routes/subscriptions.ts (new)
- AC（Tier 1）：UBIQUITOUS: POST /api/v1/clones は 08_api/openapi.yaml の operation postClones どおり ／ UBIQUITOUS: GET /api/v1/members は 08_api/openapi.yaml の operation getMembers どおり
- AC（Tier 2）：EVENT-DRIVEN: WHEN POST /api/v1/clones が「自分のAIの質問に答える」として呼ばれたとき THEN Kaname は「会話 ／ UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない） ／ UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
- L1 行 38（['API-01-034', 'API-01-035', 'API-01-036'] …）／ L2 ['J-01', 'J-02']
- audit: 07_tasks/audit/T-A-01.md

### T-A-02 API 招かれたので、自分がやることだけ分かる状態にしたい — データ・AP（1 endpoint）

- group A / layer backend / phase 3_api / wave 6 / Human 26 h・AI 6.5 h・wall-clock 7.5 h
- 行為 A03 / 画面 invite-accept / 表 members layers permissions invitations / 関門 —（モデル呼び出し）
- 依存 T-F-01 T-F-02 T-F-03 T-F-04 T-F-05 T-D-01 T-D-08 T-D-12
- 根拠（逐語）：D-026「スコープ4層(運営/会社/部署/個人)を担当業務・ルール・テンプレ・覚えた操作・記憶すべてに同じ形で使う」 ／ D-037「AI社員の出どころは運営配布/会社作成/個人作成の3経路。託されたAI社員は使えるが定義は編集できない。個人ルールだけは」
- 触るファイル：apps/api/src/routes/invitations.ts (new)、apps/api/src/app.ts (modify)
- AC（Tier 1）：UBIQUITOUS: GET /api/v1/invitations は 08_api/openapi.yaml の operation getInvitat
- AC（Tier 2）：EVENT-DRIVEN: WHEN GET /api/v1/invitations が「招待リンクを押して名前を入れる」として呼ばれたとき THEN Kana ／ UNWANTED: IF 10/min/ip を超えたら、Kaname は 429 と retry_after_sec を返す ／ UNWANTED: IF 外部が失敗したか完了信号が無いなら、Kaname は成功扱いにせず 502 と次の一手（人へのハンドオフ）を返す
- L1 行 10（['API-02-001', 'API-02-002', 'API-02-003'] …）／ L2 ['J-01']
- audit: 07_tasks/audit/T-A-02.md

### T-A-03 API 入れなくなったときに、自分でパスワードを再設定したい — データ・A（1 endpoint）

- group A / layer backend / phase 3_api / wave 6 / Human 32 h・AI 8.0 h・wall-clock 9.0 h
- 行為 A02 A04 A13 A31 A94 / 画面 account login mfa-setup password-reset verify-email / 表 members audit_events layers permissions / 関門 C8
- 依存 T-F-01 T-F-02 T-F-03 T-F-04 T-F-05 T-D-01 T-D-06 T-D-08 T-F-14
- 根拠（逐語）：D-042「情シス・コンプラが必ず聞くこと。Bridgeで何ができるか完全列挙・送るもの/送らないもの・全操作の証跡を管理者が閲覧エ」 ／ D-053「画面は行為から導出する。画面から始めると『この画面で何をしたいか分からない』が必ず起きる。役割×用事→行為の背骨→オブジ」
- 触るファイル：apps/api/src/routes/members.ts (new)、apps/api/src/app.ts (modify)
- AC（Tier 1）：UBIQUITOUS: GET /api/v1/members は 08_api/openapi.yaml の operation getMembers どおり
- AC（Tier 2）：EVENT-DRIVEN: WHEN GET /api/v1/members が「届いたリンクを押す」として呼ばれたとき THEN Kaname は「本人確認を ／ EVENT-DRIVEN: WHEN GET /api/v1/members が「認証アプリを登録する」として呼ばれたとき THEN Kaname は「TOTP ／ EVENT-DRIVEN: WHEN GET /api/v1/members が「メールとパスワードと6桁を入れる」として呼ばれたとき THEN Kaname 
- L1 行 11（['API-03-010', 'API-03-011', 'API-03-012'] …）／ L2 ['J-06']
- audit: 07_tasks/audit/T-A-03.md

### T-A-04 API 今日なにをすればいいか、迷わず決めたい — データ・API・権限（1/3）（6 endpoint）

- group A / layer backend / phase 3_api / wave 6 / Human 59 h・AI 14.8 h・wall-clock 15.8 h
- 行為 A20 A23 A25 A49 A88 A89 A90 A91 A95 / 画面 clone-chat goal-allocation my-progress / 表 members clones goals goal_allocations goal_contributions goal_versions / 関門 C2 C3 C4 C5
- 依存 T-F-01 T-F-02 T-F-03 T-F-04 T-F-05 T-D-01 T-D-02 T-D-05 T-D-06 T-F-02
- 根拠（逐語）：D-002「65社・月630万。エントリー(個人/一人社長3万)・スタンダード(中小8万)・プロ(中堅15万)の3層。エントリーが集」 ／ D-003「スキルは堀ではない。堀は『閉じたループ』(目標→逆算→配布→実行→測定→再計画)と会社モデル」
- 触るファイル：apps/api/src/routes/conversations.ts (new)、apps/api/src/routes/goal_allocations.ts (new)、apps/api/src/app.ts (modify)
- AC（Tier 1）：UBIQUITOUS: GET /api/v1/conversations は 08_api/openapi.yaml の operation getConve ／ UBIQUITOUS: POST /api/v1/conversations は 08_api/openapi.yaml の operation postCon
- AC（Tier 2）：EVENT-DRIVEN: WHEN GET /api/v1/conversations が「聞く・頼む」として呼ばれたとき THEN Kaname は「会話を ／ EVENT-DRIVEN: WHEN GET /api/v1/conversations が「資料や画像を付けて渡す」として呼ばれたとき THEN Kaname ／ UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
- L1 行 41（['API-04-079', 'API-04-002', 'API-04-003'] …）／ L2 ['J-03', 'J-04', 'J-07']
- audit: 07_tasks/audit/T-A-04.md

### T-A-05 API 今日なにをすればいいか、迷わず決めたい — データ・API・権限（2/3）（6 endpoint）

- group A / layer backend / phase 3_api / wave 6 / Human 59 h・AI 14.8 h・wall-clock 15.8 h
- 行為 A02 A04 A13 A14 A31 A48 A50 A55 A56 A57 A58 A92 A94 / 画面 account login mfa-setup password-reset tasks today verify-email / 表 members goals goal_versions tasks task_handovers daily_plans / 関門 C2 C3 C6 C8
- 依存 T-F-01 T-F-02 T-F-03 T-F-04 T-F-05 T-D-01 T-D-02 T-D-05 T-D-06 T-D-08
- 根拠（逐語）：D-002「65社・月630万。エントリー(個人/一人社長3万)・スタンダード(中小8万)・プロ(中堅15万)の3層。エントリーが集」 ／ D-003「スキルは堀ではない。堀は『閉じたループ』(目標→逆算→配布→実行→測定→再計画)と会社モデル」
- 触るファイル：apps/api/src/routes/members.ts (new)、apps/api/src/routes/messages.ts (new)、apps/api/src/routes/tasks.ts (new)、apps/api/src/app.ts (modify)
- AC（Tier 1）：UBIQUITOUS: GET /api/v1/members は 08_api/openapi.yaml の operation getMembers どおり ／ UBIQUITOUS: GET /api/v1/messages は 08_api/openapi.yaml の operation getMessages ど
- AC（Tier 2）：EVENT-DRIVEN: WHEN GET /api/v1/members が「届いたリンクを押す」として呼ばれたとき THEN Kaname は「本人確認を ／ EVENT-DRIVEN: WHEN GET /api/v1/members が「認証アプリを登録する」として呼ばれたとき THEN Kaname は「TOTP ／ EVENT-DRIVEN: WHEN GET /api/v1/members が「メールとパスワードと6桁を入れる」として呼ばれたとき THEN Kaname 
- L1 行 41（['API-05-043', 'API-05-044', 'API-05-045'] …）／ L2 ['J-03', 'J-04', 'J-07']
- audit: 07_tasks/audit/T-A-05.md

### T-A-06 API 今日なにをすればいいか、迷わず決めたい — データ・API・権限（3/3）（1 endpoint）

- group A / layer backend / phase 3_api / wave 6 / Human 59 h・AI 14.8 h・wall-clock 15.8 h
- 行為 A17 A51 / 画面 tasks / 表 goals goal_versions tasks task_handovers / 関門 C2 C6
- 依存 T-F-01 T-F-02 T-F-03 T-F-04 T-F-05 T-D-02 T-D-05 T-F-02 T-F-03 T-F-04
- 根拠（逐語）：D-002「65社・月630万。エントリー(個人/一人社長3万)・スタンダード(中小8万)・プロ(中堅15万)の3層。エントリーが集」 ／ D-003「スキルは堀ではない。堀は『閉じたループ』(目標→逆算→配布→実行→測定→再計画)と会社モデル」
- 触るファイル：apps/api/src/routes/tasks.ts (new)、apps/api/src/app.ts (modify)
- AC（Tier 1）：UBIQUITOUS: PATCH /api/v1/tasks/:id は 08_api/openapi.yaml の operation patchTasks
- AC（Tier 2）：EVENT-DRIVEN: WHEN PATCH /api/v1/tasks/:id が「自分のタスクを終える」として呼ばれたとき THEN Kaname は「 ／ EVENT-DRIVEN: WHEN PATCH /api/v1/tasks/:id が「誰に引き継いでもらうか選ぶ（負荷を見て）」として呼ばれたとき THEN ／ UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
- L1 行 12（['API-06-037', 'API-06-038', 'API-06-039'] …）／ L2 ['J-03', 'J-04', 'J-07']
- audit: 07_tasks/audit/T-A-06.md

### T-A-07 API 手でやっている繰り返しを、自分の代わりにやらせたい — データ・AP（5 endpoint）

- group A / layer backend / phase 3_api / wave 6 / Human 113 h・AI 28.2 h・wall-clock 29.2 h
- 行為 A07 A08 A09 A10 A12 A32 A37 A45 A46 A53 A59 A79 / 画面 ai-activity ai-staff ai-staff-detail automation-repair bridge-setup company-model credentials onboard-draft onboard-golive ops-catalog / 表 tenants members clones ai_employees goals ledger_definitions / 関門 C2 C5 C8
- 依存 T-F-01 T-F-02 T-F-03 T-F-04 T-F-05 T-D-01 T-D-02 T-D-03 T-D-04 T-D-05
- 根拠（逐語）：D-003「スキルは堀ではない。堀は『閉じたループ』(目標→逆算→配布→実行→測定→再計画)と会社モデル」 ／ D-004「LLMは顧客のサブスク内(Bridge)が既定。APIは顧客負担。運営マネージドは既定OFFの管理者トグル」
- 触るファイル：apps/api/src/routes/ai_employees.ts (new)、apps/api/src/routes/credentials.ts (new)、apps/api/src/routes/learned_procedures.ts (new)、apps/api/src/routes/sessions.ts (new)
- AC（Tier 1）：UBIQUITOUS: GET /api/v1/ai_employees は 08_api/openapi.yaml の operation getAiEmpl ／ UBIQUITOUS: POST /api/v1/credentials は 08_api/openapi.yaml の operation postCrede
- AC（Tier 2）：EVENT-DRIVEN: WHEN GET /api/v1/ai_employees が「AI社員を増やす・人に託す」として呼ばれたとき THEN Kanam ／ EVENT-DRIVEN: WHEN GET /api/v1/ai_employees が「このAI社員の中身を見る」として呼ばれたとき THEN Kaname ／ EVENT-DRIVEN: WHEN GET /api/v1/ai_employees が「木を開いて、止まっているところを見る」として呼ばれたとき THEN 
- L1 行 39（['API-07-007', 'API-07-008', 'API-07-009'] …）／ L2 ['J-02', 'J-06', 'J-07']
- audit: 07_tasks/audit/T-A-07.md

### T-A-08 API AIが勝手に外に出すのが怖い。押す前に中身を見て決めたい — データ（1/2）（6 endpoint）

- group A / layer backend / phase 3_api / wave 6 / Human 104 h・AI 26.0 h・wall-clock 27.0 h
- 行為 A11 A15 A16 A33 A34 A37 A38 A46 A53 A59 A66 A73 A79 / 画面 ai-activity ai-staff ai-staff-detail approvals audit clone-thread onboard-testrun ops-audit ops-catalog / 表 members clones ai_employees duties duty_versions approvals / 関門 C1 C2 C6
- 依存 T-F-01 T-F-02 T-F-03 T-F-04 T-F-05 T-D-01 T-D-04 T-D-05 T-D-06 T-D-10
- 根拠（逐語）：D-003「スキルは堀ではない。堀は『閉じたループ』(目標→逆算→配布→実行→測定→再計画)と会社モデル」 ／ D-008「ペルソナ1=高本本人。一人で受託・キャパ限界・人に任せたい・目標は決めているだけで実行が回らない」
- 触るファイル：apps/api/src/routes/action_runs.ts (new)、apps/api/src/routes/ai_employees.ts (new)、apps/api/src/routes/approvals.ts (new)、apps/api/src/routes/audit_events.ts (new)
- AC（Tier 1）：UBIQUITOUS: GET /api/v1/action_runs は 08_api/openapi.yaml の operation getActionR ／ UBIQUITOUS: GET /api/v1/ai_employees は 08_api/openapi.yaml の operation getAiEmpl
- AC（Tier 2）：EVENT-DRIVEN: WHEN GET /api/v1/action_runs が「試しに動かして結果を見る」として呼ばれたとき THEN Kaname  ／ UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない） ／ UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
- L1 行 47（['API-08-049', 'API-08-050', 'API-08-051'] …）／ L2 ['J-02', 'J-03', 'J-06', 'J-07']
- audit: 07_tasks/audit/T-A-08.md

### T-A-09 API AIが勝手に外に出すのが怖い。押す前に中身を見て決めたい — データ（2/2）（4 endpoint）

- group A / layer backend / phase 3_api / wave 6 / Human 104 h・AI 26.0 h・wall-clock 27.0 h
- 行為 A35 A50 A57 A88 A89 A91 / 画面 clone-chat policies tasks / 表 members clones goals goal_versions tasks task_handovers / 関門 C2 C3 C5 C6
- 依存 T-F-01 T-F-02 T-F-03 T-F-04 T-F-05 T-D-01 T-D-02 T-D-05 T-D-06 T-D-10
- 根拠（逐語）：D-003「スキルは堀ではない。堀は『閉じたループ』(目標→逆算→配布→実行→測定→再計画)と会社モデル」 ／ D-008「ペルソナ1=高本本人。一人で受託・キャパ限界・人に任せたい・目標は決めているだけで実行が回らない」
- 触るファイル：apps/api/src/routes/conversations.ts (new)、apps/api/src/routes/policies.ts (new)、apps/api/src/routes/tasks.ts (new)、apps/api/src/app.ts (modify)
- AC（Tier 1）：UBIQUITOUS: POST /api/v1/conversations は 08_api/openapi.yaml の operation postCon ／ UBIQUITOUS: DELETE /api/v1/conversations/:id は 08_api/openapi.yaml の operation d
- AC（Tier 2）：EVENT-DRIVEN: WHEN POST /api/v1/conversations が「会話を分けて始める・一覧から戻る」として呼ばれたとき THEN  ／ EVENT-DRIVEN: WHEN POST /api/v1/conversations が「許可に答える・許可のモードを選ぶ」として呼ばれたとき THEN  ／ UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
- L1 行 30（['API-09-036', 'API-09-037', 'API-09-038'] …）／ L2 ['J-02', 'J-03', 'J-06', 'J-07']
- audit: 07_tasks/audit/T-A-09.md

### T-A-10 API 案件・請求・問い合わせが今どうなっているか、1か所で見たい — デー（5 endpoint）

- group A / layer backend / phase 3_api / wave 6 / Human 107 h・AI 26.8 h・wall-clock 27.8 h
- 行為 A18 A19 A21 A24 A44 A47 A48 A58 / 画面 ledger-def record-detail records search tasks / 表 goals goal_versions ledger_definitions ledger_fields ledger_stages ledger_views / 関門 C2 C3
- 依存 T-F-01 T-F-02 T-F-03 T-F-04 T-F-05 T-D-02 T-D-03 T-D-04 T-D-05 T-D-06
- 根拠（逐語）：D-006「スコープの採否は『抜いてもループが閉じるか』。CRM・請求・経理を切ると目標の数値が出せなくなるので切らない」 ／ D-007「数値はAI社員が会話で出す。分析系の固定画面(ランキング・チャネル別・期間比較)を一切作らない」
- 触るファイル：apps/api/src/routes/ledger_definitions.ts (new)、apps/api/src/routes/ledger_records.ts (new)、apps/api/src/routes/tasks.ts (new)、apps/api/src/app.ts (modify)
- AC（Tier 1）：UBIQUITOUS: GET /api/v1/ledger_definitions は 08_api/openapi.yaml の operation get ／ UBIQUITOUS: PATCH /api/v1/ledger_definitions/:id は 08_api/openapi.yaml の operati
- AC（Tier 2）：EVENT-DRIVEN: WHEN GET /api/v1/ledger_definitions が「言葉で探す」として呼ばれたとき THEN Kaname  ／ EVENT-DRIVEN: WHEN GET /api/v1/ledger_definitions が「一覧を見る」として呼ばれたとき THEN Kaname  ／ UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
- L1 行 35（['API-10-045', 'API-10-046', 'API-10-047'] …）／ L2 ['J-03', 'J-04', 'J-05']
- audit: 07_tasks/audit/T-A-10.md

### T-A-11 API 目標に届くのか、届かないなら何を変えるか知りたい — データ・API（6 endpoint）

- group A / layer backend / phase 3_api / wave 7 / Human 173 h・AI 43.2 h・wall-clock 44.2 h
- 行為 A07 A08 A12 A20 A22 A23 A29 A45 A48 A49 A52 A54 A58 A90 / 画面 clone-chat company-model goal-allocation goal-edit goals my-progress onboard-draft onboard-golive tasks / 表 tenants members clones units goals goal_allocations / 関門 C2 C3 C4
- 依存 T-F-01 T-F-02 T-F-03 T-F-04 T-F-05 T-D-01 T-D-02 T-D-03 T-D-04 T-D-05
- 根拠（逐語）：D-003「スキルは堀ではない。堀は『閉じたループ』(目標→逆算→配布→実行→測定→再計画)と会社モデル」 ／ D-007「数値はAI社員が会話で出す。分析系の固定画面(ランキング・チャネル別・期間比較)を一切作らない」
- 触るファイル：apps/api/src/routes/conversations.ts (new)、apps/api/src/routes/goal_allocations.ts (new)、apps/api/src/routes/goals.ts (new)、apps/api/src/routes/tasks.ts (new)
- AC（Tier 1）：UBIQUITOUS: GET /api/v1/conversations は 08_api/openapi.yaml の operation getConve ／ UBIQUITOUS: PATCH /api/v1/goal_allocations/:id は 08_api/openapi.yaml の operation
- AC（Tier 2）：EVENT-DRIVEN: WHEN GET /api/v1/conversations が「聞く・頼む」として呼ばれたとき THEN Kaname は「会話を ／ EVENT-DRIVEN: WHEN GET /api/v1/conversations が「資料や画像を付けて渡す」として呼ばれたとき THEN Kaname ／ UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
- L1 行 45（['API-11-025', 'API-11-026', 'API-11-027'] …）／ L2 ['J-03', 'J-04', 'J-05']
- audit: 07_tasks/audit/T-A-11.md

### T-A-12 API なぜ届かなかったかを言葉にして、次の打ち手を決めたい — データ・A（3 endpoint）

- group A / layer backend / phase 3_api / wave 7 / Human 86 h・AI 7.2 h・wall-clock 7.2 h
- 行為 A22 A26 A27 A52 A54 / 画面 goal-edit goals hypotheses review / 表 units goals goal_allocations goal_contributions goal_versions hypotheses / 関門 C2 C3
- 依存 T-F-01 T-F-02 T-F-03 T-F-04 T-F-05 T-D-02 T-D-05 T-F-02 T-F-03 T-F-04
- 根拠（逐語）：D-003「スキルは堀ではない。堀は『閉じたループ』(目標→逆算→配布→実行→測定→再計画)と会社モデル」 ／ D-006「スコープの採否は『抜いてもループが閉じるか』。CRM・請求・経理を切ると目標の数値が出せなくなるので切らない」
- 触るファイル：apps/api/src/routes/goals.ts (new)、apps/api/src/routes/hypotheses.ts (new)、apps/api/src/app.ts (modify)
- AC（Tier 1）：UBIQUITOUS: GET /api/v1/goals は 08_api/openapi.yaml の operation getGoals どおりの入出力 ／ UBIQUITOUS: GET /api/v1/hypotheses は 08_api/openapi.yaml の operation getHypothes
- AC（Tier 2）：EVENT-DRIVEN: WHEN GET /api/v1/goals が「届くか見る」として呼ばれたとき THEN Kaname は「目標と実績を突き合わせ ／ EVENT-DRIVEN: WHEN GET /api/v1/goals が「無くす目標を選び、紐づくものの行き先を決める」として呼ばれたとき THEN Kan ／ EVENT-DRIVEN: WHEN GET /api/v1/goals が「かけたものと出たものを並べて見る」として呼ばれたとき THEN Kaname は「
- L1 行 24（['API-12-042', 'API-12-043', 'API-12-044'] …）／ L2 ['J-04', 'J-05']
- audit: 07_tasks/audit/T-A-12.md

### T-A-13 API 人に任せたい。任せても品質が落ちないようにしたい — データ・API（1/2）（6 endpoint）

- group A / layer backend / phase 3_api / wave 7 / Human 90 h・AI 22.5 h・wall-clock 23.5 h
- 行為 A16 A33 A36 A37 A38 A42 A46 A53 A59 A61 A62 A73 A74 A79 A81 / 画面 account account-close ai-activity ai-staff ai-staff-detail audit clone-thread member-detail members ops-audit ops-catalog / 表 members clones ai_employees duties duty_versions approvals / 関門 C2 C6 C8
- 依存 T-F-01 T-F-02 T-F-03 T-F-04 T-F-05 T-D-01 T-D-04 T-D-05 T-D-06 T-D-08
- 根拠（逐語）：D-003「スキルは堀ではない。堀は『閉じたループ』(目標→逆算→配布→実行→測定→再計画)と会社モデル」 ／ D-004「LLMは顧客のサブスク内(Bridge)が既定。APIは顧客負担。運営マネージドは既定OFFの管理者トグル」
- 触るファイル：apps/api/src/routes/ai_employees.ts (new)、apps/api/src/routes/approvals.ts (new)、apps/api/src/routes/audit_events.ts (new)、apps/api/src/routes/members.ts (new)
- AC（Tier 1）：UBIQUITOUS: GET /api/v1/ai_employees は 08_api/openapi.yaml の operation getAiEmpl ／ UBIQUITOUS: PATCH /api/v1/ai_employees/:id は 08_api/openapi.yaml の operation pat
- AC（Tier 2）：EVENT-DRIVEN: WHEN GET /api/v1/ai_employees が「AI社員を増やす・人に託す」として呼ばれたとき THEN Kanam ／ EVENT-DRIVEN: WHEN GET /api/v1/ai_employees が「このAI社員の中身を見る」として呼ばれたとき THEN Kaname ／ EVENT-DRIVEN: WHEN GET /api/v1/ai_employees が「木を開いて、止まっているところを見る」として呼ばれたとき THEN 
- L1 行 50（['API-13-025', 'API-13-026', 'API-13-027'] …）／ L2 ['J-03', 'J-07', 'J-09']
- audit: 07_tasks/audit/T-A-13.md

### T-A-14 API 人に任せたい。任せても品質が落ちないようにしたい — データ・API（2/2）（3 endpoint）

- group A / layer backend / phase 3_api / wave 7 / Human 90 h・AI 22.5 h・wall-clock 23.5 h
- 行為 A17 A48 A50 A51 A57 A58 / 画面 tasks / 表 goals goal_versions tasks task_handovers / 関門 C2 C3 C6
- 依存 T-F-01 T-F-02 T-F-03 T-F-04 T-F-05 T-D-02 T-D-05 T-F-02 T-F-03 T-F-04
- 根拠（逐語）：D-003「スキルは堀ではない。堀は『閉じたループ』(目標→逆算→配布→実行→測定→再計画)と会社モデル」 ／ D-004「LLMは顧客のサブスク内(Bridge)が既定。APIは顧客負担。運営マネージドは既定OFFの管理者トグル」
- 触るファイル：apps/api/src/routes/tasks.ts (new)、apps/api/src/app.ts (modify)
- AC（Tier 1）：UBIQUITOUS: GET /api/v1/tasks は 08_api/openapi.yaml の operation getTasks どおりの入出力 ／ UBIQUITOUS: POST /api/v1/tasks は 08_api/openapi.yaml の operation postTasks どおりの入
- AC（Tier 2）：EVENT-DRIVEN: WHEN GET /api/v1/tasks が「残っている仕事から引き継ぐ」として呼ばれたとき THEN Kaname は「タスク ／ EVENT-DRIVEN: WHEN GET /api/v1/tasks が「見え方を切り替える（URL に残る）」として呼ばれたとき THEN Kaname  ／ UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
- L1 行 24（['API-14-025', 'API-14-026', 'API-14-027'] …）／ L2 ['J-03', 'J-07', 'J-09']
- audit: 07_tasks/audit/T-A-14.md

### T-A-15 API 会社のやり方が、人が辞めても消えないようにしたい — データ・API（3 endpoint）

- group A / layer backend / phase 3_api / wave 7 / Human 104 h・AI 26.0 h・wall-clock 27.0 h
- 行為 A07 A08 A12 A24 A28 A44 A45 / 画面 company-model duties ledger-def onboard-draft onboard-golive records / 表 tenants goals ledger_definitions ledger_fields ledger_stages ledger_views / 関門 C2 C3
- 依存 T-F-01 T-F-02 T-F-03 T-F-04 T-F-05 T-D-01 T-D-02 T-D-03 T-D-04 T-F-02
- 根拠（逐語）：D-003「スキルは堀ではない。堀は『閉じたループ』(目標→逆算→配布→実行→測定→再計画)と会社モデル」 ／ D-010「製品の背骨。会社モデル(目標・台帳定義・担当業務・組織・ポリシー・記憶)を1つの定義に。画面もAI社員も自動実行もこの定」
- 触るファイル：apps/api/src/routes/duties.ts (new)、apps/api/src/routes/ledger_definitions.ts (new)、apps/api/src/routes/tenants.ts (new)、apps/api/src/app.ts (modify)
- AC（Tier 1）：UBIQUITOUS: PATCH /api/v1/duties/:id は 08_api/openapi.yaml の operation patchDuti ／ UBIQUITOUS: PATCH /api/v1/ledger_definitions/:id は 08_api/openapi.yaml の operati
- AC（Tier 2）：EVENT-DRIVEN: WHEN PATCH /api/v1/duties/:id が「担当業務を書き換える」として呼ばれたとき THEN Kaname は ／ UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない） ／ UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
- L1 行 27（['API-15-079', 'API-15-080', 'API-15-081'] …）／ L2 ['J-05']
- audit: 07_tasks/audit/T-A-15.md

### T-A-16 API このツールを入れて安全か、社内（情シス・コンプラ）に説明できるように（6 endpoint）

- group A / layer backend / phase 3_api / wave 7 / Human 131 h・AI 32.8 h・wall-clock 33.8 h
- 行為 A02 A04 A13 A31 A34 A39 A40 A41 A42 A62 A66 A94 / 画面 account account-close audit export login member-detail mfa-setup password-reset security-brief verify-email / 表 tenants members ai_employees goals ledger_definitions approvals / 関門 C1 C2 C4 C6 C8
- 依存 T-F-01 T-F-02 T-F-03 T-F-04 T-F-05 T-D-01 T-D-02 T-D-03 T-D-05 T-D-06
- 根拠（逐語）：D-010「製品の背骨。会社モデル(目標・台帳定義・担当業務・組織・ポリシー・記憶)を1つの定義に。画面もAI社員も自動実行もこの定」 ／ D-015「Bridgeは顧客PCで動く万能実行器。本人のIP・本人のログイン済みセッションで動くのでCAPTCHA/bot検知に到」
- 触るファイル：apps/api/src/routes/approvals.ts (new)、apps/api/src/routes/export_jobs.ts (new)、apps/api/src/routes/members.ts (new)、apps/api/src/routes/sessions.ts (new)
- AC（Tier 1）：UBIQUITOUS: POST /api/v1/approvals は 08_api/openapi.yaml の operation postApprova ／ UBIQUITOUS: DELETE /api/v1/approvals/:id は 08_api/openapi.yaml の operation delet
- AC（Tier 2）：EVENT-DRIVEN: WHEN POST /api/v1/approvals が「全操作の証跡を出す」として呼ばれたとき THEN Kaname は「証跡 ／ UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない） ／ UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
- L1 行 46（['API-16-051', 'API-16-052', 'API-16-053'] …）／ L2 ['J-01', 'J-07', 'J-08']
- audit: 07_tasks/audit/T-A-16.md

### T-A-17 API 自分のAIを、自分の考え方に近づけたい — データ・API・権限（1/2）（6 endpoint）

- group A / layer backend / phase 3_api / wave 7 / Human 73 h・AI 6.1 h・wall-clock 6.1 h
- 行為 A06 A20 A30 A88 A90 A91 A93 A95 / 画面 clone-chat clone-memory onboard-interview / 表 members clones memories memory_proposals conversations messages / 関門 C2 C3 C4 C5 C6
- 依存 T-F-01 T-F-02 T-F-03 T-F-04 T-F-05 T-D-01 T-D-04 T-D-06 T-F-02 T-F-03
- 根拠（逐語）：D-003「スキルは堀ではない。堀は『閉じたループ』(目標→逆算→配布→実行→測定→再計画)と会社モデル」 ／ D-007「数値はAI社員が会話で出す。分析系の固定画面(ランキング・チャネル別・期間比較)を一切作らない」
- 触るファイル：apps/api/src/routes/clones.ts (new)、apps/api/src/routes/conversations.ts (new)、apps/api/src/routes/memories.ts (new)、apps/api/src/app.ts (modify)
- AC（Tier 1）：UBIQUITOUS: POST /api/v1/clones は 08_api/openapi.yaml の operation postClones どおり ／ UBIQUITOUS: GET /api/v1/conversations は 08_api/openapi.yaml の operation getConve
- AC（Tier 2）：EVENT-DRIVEN: WHEN POST /api/v1/clones が「自分のAIの質問に答える」として呼ばれたとき THEN Kaname は「会話 ／ UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない） ／ UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
- L1 行 42（['API-17-036', 'API-17-037', 'API-17-038'] …）／ L2 ['J-02', 'J-03', 'J-05', 'J-07']
- audit: 07_tasks/audit/T-A-17.md

### T-A-18 API 自分のAIを、自分の考え方に近づけたい — データ・API・権限（2/2）（2 endpoint）

- group A / layer backend / phase 3_api / wave 7 / Human 73 h・AI 6.1 h・wall-clock 6.1 h
- 行為 A07 A08 A12 A14 A45 A92 / 画面 company-model onboard-draft onboard-golive today / 表 tenants goals ledger_definitions duties tasks daily_plans / 関門 —（モデル呼び出し）
- 依存 T-F-01 T-F-02 T-F-03 T-F-04 T-F-05 T-D-01 T-D-02 T-D-03 T-D-04 T-D-05
- 根拠（逐語）：D-003「スキルは堀ではない。堀は『閉じたループ』(目標→逆算→配布→実行→測定→再計画)と会社モデル」 ／ D-007「数値はAI社員が会話で出す。分析系の固定画面(ランキング・チャネル別・期間比較)を一切作らない」
- 触るファイル：apps/api/src/routes/messages.ts (new)、apps/api/src/routes/tenants.ts (new)、apps/api/src/app.ts (modify)
- AC（Tier 1）：UBIQUITOUS: GET /api/v1/messages は 08_api/openapi.yaml の operation getMessages ど ／ UBIQUITOUS: GET /api/v1/tenants は 08_api/openapi.yaml の operation getTenants どおり
- AC（Tier 2）：EVENT-DRIVEN: WHEN GET /api/v1/messages が「申し送りを読む」として呼ばれたとき THEN Kaname は「タスクと承認 ／ EVENT-DRIVEN: WHEN GET /api/v1/messages が「昨日の会話をまとめる」として呼ばれたとき THEN Kaname は「mem ／ UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
- L1 行 21（['API-18-047', 'API-18-048', 'API-18-049'] …）／ L2 ['J-02', 'J-03', 'J-05', 'J-07']
- audit: 07_tasks/audit/T-A-18.md

### T-A-19 API 導入した顧客が詰まったとき、データを見ずに直したい — データ・AP（3 endpoint）

- group A / layer backend / phase 3_api / wave 7 / Human 146 h・AI 36.5 h・wall-clock 37.5 h
- 行為 A43 A60 A64 A70 / 画面 ops-home ops-support ops-tenant / 表 tenants goals conversations inquiries plans plan_versions / 関門 C2 C6
- 依存 T-F-01 T-F-02 T-F-03 T-F-04 T-F-05 T-D-01 T-D-02 T-D-06 T-D-11 T-F-02
- 根拠（逐語）：D-030「構築メタスキル群は運営の資産で顧客に見えない。会社モデル構築・担当業務の定義・台帳の設計・目標の分解・改善提案・自分のA」 ／ D-037「AI社員の出どころは運営配布/会社作成/個人作成の3経路。託されたAI社員は使えるが定義は編集できない。個人ルールだけは」
- 触るファイル：apps/api/src/routes/inquiries.ts (new)、apps/api/src/routes/plans.ts (new)、apps/api/src/app.ts (modify)
- AC（Tier 1）：UBIQUITOUS: PATCH /api/v1/inquiries/:id は 08_api/openapi.yaml の operation patchI ／ UBIQUITOUS: GET /api/v1/plans は 08_api/openapi.yaml の operation getPlans どおりの入出力
- AC（Tier 2）：EVENT-DRIVEN: WHEN PATCH /api/v1/inquiries/:id が「顧客のデータを見ずに直す」として呼ばれたとき THEN Kan ／ EVENT-DRIVEN: WHEN PATCH /api/v1/inquiries/:id が「問い合わせに答える」として呼ばれたとき THEN Kaname ／ UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
- L1 行 23（['API-19-052', 'API-19-053', 'API-19-054'] …）／ L2 ['J-09']
- audit: 07_tasks/audit/T-A-19.md

### T-A-20 API 困ったら運営に聞きたい。止まっているのが自分のせいか Kaname （3 endpoint）

- group A / layer backend / phase 3_api / wave 7 / Human 104 h・AI 26.0 h・wall-clock 27.0 h
- 行為 A67 A68 A69 / 画面 billing inquiry notices / 表 conversations audit_events ops_audit_events inquiries notices notice_deliveries / 関門 C2 C6
- 依存 T-F-01 T-F-02 T-F-03 T-F-04 T-F-05 T-D-06 T-D-10 T-D-11 T-F-02 T-F-03
- 根拠（逐語）：D-002「65社・月630万。エントリー(個人/一人社長3万)・スタンダード(中小8万)・プロ(中堅15万)の3層。エントリーが集」 ／ D-037「AI社員の出どころは運営配布/会社作成/個人作成の3経路。託されたAI社員は使えるが定義は編集できない。個人ルールだけは」
- 触るファイル：apps/api/src/routes/inquiries.ts (new)、apps/api/src/routes/notice_deliveries.ts (new)、apps/api/src/routes/subscriptions.ts (new)、apps/api/src/app.ts (modify)
- AC（Tier 1）：UBIQUITOUS: GET /api/v1/inquiries は 08_api/openapi.yaml の operation getInquiries ／ UBIQUITOUS: PATCH /api/v1/notice_deliveries/:id は 08_api/openapi.yaml の operatio
- AC（Tier 2）：EVENT-DRIVEN: WHEN GET /api/v1/inquiries が「問い合わせを書く」として呼ばれたとき THEN Kaname は「問い合わ ／ UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない） ／ UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
- L1 行 29（['API-20-059', 'API-20-060', 'API-20-061'] …）／ L2 ['J-07']
- audit: 07_tasks/audit/T-A-20.md

### T-A-21 API 運営として、問い合わせに答え、お知らせと稼働状況を出し、各社の請求・（4 endpoint）

- group A / layer backend / phase 3_api / wave 8 / Human 143 h・AI 35.8 h・wall-clock 36.8 h
- 行為 A33 A38 A43 A70 A71 A72 A73 A87 / 画面 audit ops-audit ops-billing ops-notices ops-support / 表 tenants members goals approvals conversations audit_events / 関門 C2 C6
- 依存 T-F-01 T-F-02 T-F-03 T-F-04 T-F-05 T-D-01 T-D-02 T-D-05 T-D-06 T-D-10
- 根拠（逐語）：D-002「65社・月630万。エントリー(個人/一人社長3万)・スタンダード(中小8万)・プロ(中堅15万)の3層。エントリーが集」 ／ D-042「情シス・コンプラが必ず聞くこと。Bridgeで何ができるか完全列挙・送るもの/送らないもの・全操作の証跡を管理者が閲覧エ」
- 触るファイル：apps/api/src/routes/audit_events.ts (new)、apps/api/src/routes/inquiries.ts (new)、apps/api/src/routes/invoices.ts (new)、apps/api/src/routes/notices.ts (new)
- AC（Tier 1）：UBIQUITOUS: GET /api/v1/audit_events は 08_api/openapi.yaml の operation getAuditE ／ UBIQUITOUS: PATCH /api/v1/inquiries/:id は 08_api/openapi.yaml の operation patchI
- AC（Tier 2）：EVENT-DRIVEN: WHEN GET /api/v1/audit_events が「いつ何をしたかを追う」として呼ばれたとき THEN Kaname は ／ EVENT-DRIVEN: WHEN GET /api/v1/audit_events が「誰が何をしたかを確認する」として呼ばれたとき THEN Kaname ／ EVENT-DRIVEN: WHEN GET /api/v1/audit_events が「セキュリティの出来事を見る」として呼ばれたとき THEN Kanam
- L1 行 34（['API-21-055', 'API-21-056', 'API-21-057'] …）／ L2 ['J-09']
- audit: 07_tasks/audit/T-A-21.md

### T-A-22 API 自分のアカウント・会社の設定・既存データの取り込み・外部サービスの連（4 endpoint）

- group A / layer backend / phase 3_api / wave 8 / Human 167 h・AI 41.8 h・wall-clock 42.8 h
- 行為 A36 A61 A74 A75 A76 A77 / 画面 account company-settings import member-detail members services / 表 tenants members ai_employees goals ledger_definitions ledger_views / 関門 C1 C2 C3 C4 C6 C8
- 依存 T-F-01 T-F-02 T-F-03 T-F-04 T-F-05 T-D-01 T-D-02 T-D-03 T-D-04 T-D-05
- 根拠（逐語）：D-006「スコープの採否は『抜いてもループが閉じるか』。CRM・請求・経理を切ると目標の数値が出せなくなるので切らない」 ／ D-013「実行層は接続の器を1回作れば設定で増える形にする。連携を1本ずつ書かない」
- 触るファイル：apps/api/src/routes/attachments.ts (new)、apps/api/src/routes/members.ts (new)、apps/api/src/routes/service_registry.ts (new)、apps/api/src/routes/tenants.ts (new)
- AC（Tier 1）：UBIQUITOUS: POST /api/v1/attachments は 08_api/openapi.yaml の operation postAttac ／ UBIQUITOUS: PATCH /api/v1/members/:id は 08_api/openapi.yaml の operation patchMem
- AC（Tier 2）：EVENT-DRIVEN: WHEN POST /api/v1/attachments が「取り込む」として呼ばれたとき THEN Kaname は「添付を保存 ／ UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない） ／ UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
- L1 行 33（['API-22-049', 'API-22-050', 'API-22-051'] …）／ L2 ['J-07']
- audit: 07_tasks/audit/T-A-22.md

### T-A-23 API 運営として、外部サービスの可否（サービス台帳）とプランの定義と目標ス（3 endpoint）

- group A / layer backend / phase 3_api / wave 8 / Human 98 h・AI 8.2 h・wall-clock 8.2 h
- 行為 A37 A46 A53 A59 A78 A79 A80 / 画面 ai-activity ai-staff ai-staff-detail ops-catalog ops-services ops-skills / 表 members clones ai_employees duties duty_versions policies / 関門 C2 C4 C6
- 依存 T-F-01 T-F-02 T-F-03 T-F-04 T-F-05 T-D-01 T-D-04 T-D-05 T-D-10 T-D-13
- 根拠（逐語）：D-030「構築メタスキル群は運営の資産で顧客に見えない。会社モデル構築・担当業務の定義・台帳の設計・目標の分解・改善提案・自分のA」 ／ D-037「AI社員の出どころは運営配布/会社作成/個人作成の3経路。託されたAI社員は使えるが定義は編集できない。個人ルールだけは」
- 触るファイル：apps/api/src/routes/ai_employees.ts (new)、apps/api/src/routes/service_registry_versions.ts (new)、apps/api/src/routes/skills.ts (new)、apps/api/src/app.ts (modify)
- AC（Tier 1）：UBIQUITOUS: GET /api/v1/ai_employees は 08_api/openapi.yaml の operation getAiEmpl ／ UBIQUITOUS: PATCH /api/v1/service_registry_versions/:id は 08_api/openapi.yaml の 
- AC（Tier 2）：EVENT-DRIVEN: WHEN GET /api/v1/ai_employees が「AI社員を増やす・人に託す」として呼ばれたとき THEN Kanam ／ EVENT-DRIVEN: WHEN GET /api/v1/ai_employees が「このAI社員の中身を見る」として呼ばれたとき THEN Kaname ／ EVENT-DRIVEN: WHEN GET /api/v1/ai_employees が「木を開いて、止まっているところを見る」として呼ばれたとき THEN 
- L1 行 27（['API-23-001', 'API-23-002', 'API-23-003'] …）／ L2 ['J-09']
- audit: 07_tasks/audit/T-A-23.md

### T-A-24 API 運営として、公開の申請を審査し、顧客が許可したときだけ支援で中を見て（3 endpoint）

- group A / layer backend / phase 3_api / wave 8 / Human 155 h・AI 38.8 h・wall-clock 39.8 h
- 行為 A63 A64 A65 / 画面 ops-audit ops-review ops-tenant / 表 duties duty_versions artifacts audit_events distributions ops_members / 関門 C2
- 依存 T-F-01 T-F-02 T-F-03 T-F-04 T-F-05 T-D-04 T-D-06 T-D-10 T-D-11 T-F-02
- 根拠（逐語）：D-010「製品の背骨。会社モデル(目標・台帳定義・担当業務・組織・ポリシー・記憶)を1つの定義に。画面もAI社員も自動実行もこの定」 ／ D-019「実装順序。Bridge(万能実行器)を最初に作る」
- 触るファイル：apps/api/src/routes/distributions.ts (new)、apps/api/src/routes/ops_members.ts (new)、apps/api/src/routes/plans.ts (new)、apps/api/src/app.ts (modify)
- AC（Tier 1）：UBIQUITOUS: POST /api/v1/distributions は 08_api/openapi.yaml の operation postDis ／ UBIQUITOUS: PATCH /api/v1/ops_members/:id は 08_api/openapi.yaml の operation patc
- AC（Tier 2）：EVENT-DRIVEN: WHEN POST /api/v1/distributions が「公開の申請を審査する」として呼ばれたとき THEN Kaname ／ UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない） ／ UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
- L1 行 24（['API-24-029', 'API-24-030', 'API-24-031'] …）／ L2 ['J-09']
- audit: 07_tasks/audit/T-A-24.md

### T-A-25 API 運営として、各社に配るもの（AI社員・担当業務・ルール・テンプレ）と（2 endpoint）

- group A / layer backend / phase 3_api / wave 8 / Human 74 h・AI 6.2 h・wall-clock 6.2 h
- 行為 A37 A46 A53 A59 A60 A79 / 画面 ai-activity ai-staff ai-staff-detail ops-catalog ops-home / 表 members clones ai_employees duties duty_versions plans / 関門 —（モデル呼び出し）
- 依存 T-F-01 T-F-02 T-F-03 T-F-04 T-F-05 T-D-01 T-D-04 T-D-11
- 根拠（逐語）：D-026「スコープ4層(運営/会社/部署/個人)を担当業務・ルール・テンプレ・覚えた操作・記憶すべてに同じ形で使う」 ／ D-027「テンプレは自動共有しない。運営配布＋各社作成＋明示的な公開のみ。最初の1社のものが自動でテンプレになるという記述は破棄」
- 触るファイル：apps/api/src/routes/ai_employees.ts (new)、apps/api/src/routes/plans.ts (new)、apps/api/src/app.ts (modify)
- AC（Tier 1）：UBIQUITOUS: GET /api/v1/ai_employees は 08_api/openapi.yaml の operation getAiEmpl ／ UBIQUITOUS: GET /api/v1/plans は 08_api/openapi.yaml の operation getPlans どおりの入出力
- AC（Tier 2）：EVENT-DRIVEN: WHEN GET /api/v1/ai_employees が「AI社員を増やす・人に託す」として呼ばれたとき THEN Kanam ／ EVENT-DRIVEN: WHEN GET /api/v1/ai_employees が「このAI社員の中身を見る」として呼ばれたとき THEN Kaname ／ EVENT-DRIVEN: WHEN GET /api/v1/ai_employees が「木を開いて、止まっているところを見る」として呼ばれたとき THEN 
- L1 行 17（['API-25-030', 'API-25-031', 'API-25-032'] …）／ L2 ['J-09']
- audit: 07_tasks/audit/T-A-25.md

### T-A-26 API このツールを入れて安全か、社内（情シス・コンプラ）に説明できるように（1 endpoint・段階 2）

- group A / layer backend / phase 9_v2_api / wave 32 / Human 131 h・AI 32.8 h・wall-clock 33.8 h
- 行為 A84 / 画面 disclosure / 表 audit_events ops_audit_events disclosure_versions subprocessors / 関門 C4
- 依存 T-F-01 T-F-02 T-F-03 T-F-04 T-F-05 T-D-06 T-D-10 T-D-14 T-F-10
- 根拠（逐語）：D-010「製品の背骨。会社モデル(目標・台帳定義・担当業務・組織・ポリシー・記憶)を1つの定義に。画面もAI社員も自動実行もこの定」 ／ D-015「Bridgeは顧客PCで動く万能実行器。本人のIP・本人のログイン済みセッションで動くのでCAPTCHA/bot検知に到」
- 触るファイル：apps/api/src/routes/disclosure_versions.ts (new)、apps/api/src/app.ts (modify)
- AC（Tier 1）：UBIQUITOUS: GET /api/v1/disclosure_versions は 08_api/openapi.yaml の operation ge
- AC（Tier 2）：EVENT-DRIVEN: WHEN GET /api/v1/disclosure_versions が「開示資料を開いて PDF をもらう」として呼ばれたとき ／ UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない） ／ UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
- L1 行 11（['API-26-037', 'API-26-038', 'API-26-039'] …）／ L2 ['J-01', 'J-07', 'J-08']
- audit: 07_tasks/audit/T-A-26.md

### T-A-27 API 運営として、問い合わせに答え、お知らせと稼働状況を出し、各社の請求・（2 endpoint・段階 2）

- group A / layer backend / phase 9_v2_api / wave 32 / Human 143 h・AI 35.8 h・wall-clock 36.8 h
- 行為 A85 A86 / 画面 ops-disclosure ops-llm / 表 notices notice_deliveries invoices payments llm_routes disclosure_versions / 関門 C2 C4 C6
- 依存 T-F-01 T-F-02 T-F-03 T-F-04 T-F-05 T-D-11 T-D-14 T-F-02 T-F-03 T-F-04
- 根拠（逐語）：D-002「65社・月630万。エントリー(個人/一人社長3万)・スタンダード(中小8万)・プロ(中堅15万)の3層。エントリーが集」 ／ D-042「情シス・コンプラが必ず聞くこと。Bridgeで何ができるか完全列挙・送るもの/送らないもの・全操作の証跡を管理者が閲覧エ」
- 触るファイル：apps/api/src/routes/disclosure_versions.ts (new)、apps/api/src/routes/llm_routes.ts (new)、apps/api/src/app.ts (modify)
- AC（Tier 1）：UBIQUITOUS: PATCH /api/v1/disclosure_versions/:id は 08_api/openapi.yaml の operat ／ UBIQUITOUS: PATCH /api/v1/llm_routes/:id は 08_api/openapi.yaml の operation patch
- AC（Tier 2）：EVENT-DRIVEN: WHEN PATCH /api/v1/disclosure_versions/:id が「版を出す・DPA の雛形とサブプロセッサを ／ UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない） ／ UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
- L1 行 18（['API-27-019', 'API-27-020', 'API-27-021'] …）／ L2 ['J-09']
- audit: 07_tasks/audit/T-A-27.md

### T-A-28 API 自分のアカウント・会社の設定・既存データの取り込み・外部サービスの連（2 endpoint・段階 2）

- group A / layer backend / phase 9_v2_api / wave 32 / Human 167 h・AI 41.8 h・wall-clock 42.8 h
- 行為 A82 A83 / 画面 app-setup llm-routes / 表 credentials sessions notification_preferences notifications llm_routes llm_capabilities / 関門 C2 C3 C6 C8
- 依存 T-F-01 T-F-02 T-F-03 T-F-04 T-F-05 T-D-05 T-D-09 T-D-11 T-D-14 T-F-02
- 根拠（逐語）：D-006「スコープの採否は『抜いてもループが閉じるか』。CRM・請求・経理を切ると目標の数値が出せなくなるので切らない」 ／ D-013「実行層は接続の器を1回作れば設定で増える形にする。連携を1本ずつ書かない」
- 触るファイル：apps/api/src/routes/llm_routes.ts (new)、apps/api/src/routes/push_devices.ts (new)、apps/api/src/app.ts (modify)
- AC（Tier 1）：UBIQUITOUS: POST /api/v1/llm_routes は 08_api/openapi.yaml の operation postLlmRou ／ UBIQUITOUS: PATCH /api/v1/push_devices/:id は 08_api/openapi.yaml の operation pat
- AC（Tier 2）：EVENT-DRIVEN: WHEN POST /api/v1/llm_routes が「会社の設定で AI の経路を選び、必要ならキーを入れる」として呼ばれた ／ UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない） ／ UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
- L1 行 18（['API-28-001', 'API-28-002', 'API-28-003'] …）／ L2 ['J-07']
- audit: 07_tasks/audit/T-A-28.md

### T-US-00 apps/web の土台（Next.js 15 App Router の雛形・Playwright と実ブラウザの検査・ナビ href ⇔ 実在ルートの照合・CI のブラウザ job・ローカル起動）

- group U-shared / layer ui / phase 4_ui_foundation / wave 17 / Human 16 h・AI 1.6 h・wall-clock 1.6 h
- 行為 — / 画面 — / 表 — / 関門 —（画面の土台。外界に出ない（API は関門の先））
- 依存 T-F-01 T-F-15
- 根拠（逐語）：D-043「ネイティブアプリはレスポンシブとは別物。プッシュ通知が本質(承認待ちの通知)。段階2でPWA」 ／ D-067「部品の土台は shadcn/ui（Base UI 版）。フォームは React Hook Form＋Zod（rjsf は」
- 触るファイル：apps/web/package.json (new)、apps/web/app/layout.tsx (new)、apps/web/playwright.config.ts (new)、apps/web/tests/reachability.spec.ts (new)
- AC（Tier 1）：UBIQUITOUS: apps/web は 02_tech_stack/selected-stack.json の frontend（Next.js 15 A ／ UBIQUITOUS: Playwright の設定と CI のブラウザ job（03_architecture/foundation_gates.json #
- AC（Tier 2）：EVENT-DRIVEN: WHEN pnpm exec playwright test を流したら THEN 実ブラウザ（Chromium）で 到達性（ナビ・ ／ UNWANTED: IF 実在しないルートを指す href があれば 到達性の検査が赤になり merge できない ／ UNWANTED: IF staging が無いなら、画面の L1 行はローカルの実ブラウザで流し、staging の行は BLOCKED（理由つき）として残す
- L1 行 30（['USH-00-001', 'USH-00-002', 'USH-00-003'] …）／ L2 —
- audit: 07_tasks/audit/T-US-00.md

### T-US-01 シェル（サイドバー・レール・第2ナビ・三画面・下タブ・枠の導出 data-frame・役割の出し分け data-roles）

- group U-shared / layer ui / phase 4_ui_foundation / wave 18 / Human 24 h・AI 2.4 h・wall-clock 2.4 h
- 行為 — / 画面 — / 表 — / 関門 —（画面の部品。外界に出ない（API は関門の先））
- 依存 T-US-00 T-F-01 T-F-05 T-A-01
- 根拠（逐語）：D-065「枠は3種。外（ログイン前）＝枠なし／はじめの設定（ログイン後・運用前 PS0〜PS2）＝手順バーだけの枠／アプリ（運用中」 ／ D-070「①本文（.main）は幅 1180 以上で 720px を下回らない。自分のAIのパネルを開いて下回るなら第2ナビを上の」
- 触るファイル：apps/web/components/shell/*.tsx (new)
- AC（Tier 1）：STATE-DRIVEN: WHILE アプリの枠で描画中 THEN シェル（サイドバー・レール・第2ナビ・三画面・下タブ・枠の導出 data-fra が DE
- AC（Tier 2）：UBIQUITOUS: 共通シェルを含む全画面で横溢れ 0・本文 720 以上（1180+） ／ UNWANTED: IF セッションが 401 なら入り直しに落ち、入力途中の内容は失わない
- L1 行 57（['USH-01-001', 'USH-01-002', 'USH-01-003'] …）／ L2 —
- audit: 07_tasks/audit/T-US-01.md

### T-US-02 自分のAIのパネルと会話の部品（会話は AgentChat 1 つ・右パネルは共通の枠が必ず出す・選択肢・承認カード・受領・引用・取り消し・別の作りは chat_one で赤）

- group U-shared / layer ui / phase 4_ui_foundation / wave 18 / Human 32 h・AI 3.2 h・wall-clock 3.2 h
- 行為 — / 画面 — / 表 — / 関門 —（画面の部品。外界に出ない（API は関門の先））
- 依存 T-US-00 T-F-01 T-F-05 T-A-01
- 根拠（逐語）：D-062「会話は1本で見え方が2つ。A 会話モード（Claude/LINE 型の専用画面）と B 作業モード（中央＝反映先の画面、」 ／ D-066「会話の部品は1組で、会話モード・右パネル・はじめの設定の会話が同じものを使う。①質問には選択肢チップ＋必ず「その他（自由」
- 触るファイル：apps/web/components/ai/*.tsx (new)、apps/web/components/shell/app-shell.tsx (new)、scripts/ci/chat_one.mjs (new)
- AC（Tier 1）：STATE-DRIVEN: WHILE アプリの枠で描画中 THEN 自分のAIのパネルと会話の部品（会話は AgentChat 1 つ・右パネルは共 が DE
- AC（Tier 2）：UBIQUITOUS: 共通シェルを含む全画面で横溢れ 0・本文 720 以上（1180+） ／ UNWANTED: IF セッションが 401 なら入り直しに落ち、入力途中の内容は失わない
- L1 行 30（['USH-02-020', 'USH-02-002', 'USH-02-003'] …）／ L2 —
- audit: 07_tasks/audit/T-US-02.md

### T-US-03 API クライアントと型（OpenAPI → types.ts・TanStack Query・別 GET 再取得・401 で入り直し）

- group U-shared / layer ui / phase 4_ui_foundation / wave 18 / Human 12 h・AI 1.2 h・wall-clock 1.2 h
- 行為 — / 画面 — / 表 — / 関門 —（画面の部品。外界に出ない（API は関門の先））
- 依存 T-US-00 T-F-01 T-F-05 T-A-01
- 根拠（逐語）：D-043「ネイティブアプリはレスポンシブとは別物。プッシュ通知が本質(承認待ちの通知)。段階2でPWA」 ／ D-051「ネイティブアプリは今4つだけ決める(認証をトークンベースに等)。後からアプリを足すのが画面を作るだけになる」
- 触るファイル：apps/web/lib/api/*.ts (new)
- AC（Tier 1）：STATE-DRIVEN: WHILE アプリの枠で描画中 THEN API クライアントと型（OpenAPI → types.ts・TanStack が DE
- AC（Tier 2）：UBIQUITOUS: 共通シェルを含む全画面で横溢れ 0・本文 720 以上（1180+） ／ UNWANTED: IF セッションが 401 なら入り直しに落ち、入力途中の内容は失わない
- L1 行 8（['USH-03-001', 'USH-03-002', 'USH-03-003'] …）／ L2 —
- audit: 07_tasks/audit/T-US-03.md

### T-US-04 認証の配管（ログイン・2 段階認証・招待・入り直し・端末の失効表示）

- group U-shared / layer ui / phase 4_ui_foundation / wave 18 / Human 12 h・AI 1.2 h・wall-clock 1.2 h
- 行為 — / 画面 — / 表 — / 関門 —（画面の部品。外界に出ない（API は関門の先））
- 依存 T-US-00 T-F-01 T-F-05 T-A-01
- 根拠（逐語）：D-042「情シス・コンプラが必ず聞くこと。Bridgeで何ができるか完全列挙・送るもの/送らないもの・全操作の証跡を管理者が閲覧エ」 ／ D-051「ネイティブアプリは今4つだけ決める(認証をトークンベースに等)。後からアプリを足すのが画面を作るだけになる」
- 触るファイル：apps/web/app/(auth)/** (new)
- AC（Tier 1）：STATE-DRIVEN: WHILE アプリの枠で描画中 THEN 認証の配管（ログイン・2 段階認証・招待・入り直し・端末の失効表示） が DESIGN-k
- AC（Tier 2）：UBIQUITOUS: 共通シェルを含む全画面で横溢れ 0・本文 720 以上（1180+） ／ UNWANTED: IF セッションが 401 なら入り直しに落ち、入力途中の内容は失わない
- L1 行 8（['USH-04-001', 'USH-04-002', 'USH-04-003'] …）／ L2 —
- audit: 07_tasks/audit/T-US-04.md

### T-US-05 デザイントークンと部品（Tailwind @theme・shadcn/ui Base UI・Lucide・表・カード・札・空状態・止まっている帯）

- group U-shared / layer ui / phase 4_ui_foundation / wave 18 / Human 16 h・AI 1.6 h・wall-clock 1.6 h
- 行為 — / 画面 — / 表 — / 関門 —（画面の部品。外界に出ない（API は関門の先））
- 依存 T-US-00 T-F-01 T-F-05 T-A-01
- 根拠（逐語）：D-052「デザインシステム確定。Primary#22345C・M PLUS 2単一書体・色の二層分離(状態色は面/データ色は点と線」 ／ D-067「部品の土台は shadcn/ui（Base UI 版）。フォームは React Hook Form＋Zod（rjsf は」
- 触るファイル：apps/web/styles/tokens.css (new)、apps/web/components/ui/*.tsx (new)
- AC（Tier 1）：STATE-DRIVEN: WHILE アプリの枠で描画中 THEN デザイントークンと部品（Tailwind @theme・shadcn/ui Ba が DE
- AC（Tier 2）：UBIQUITOUS: 共通シェルを含む全画面で横溢れ 0・本文 720 以上（1180+） ／ UNWANTED: IF セッションが 401 なら入り直しに落ち、入力途中の内容は失わない
- L1 行 8（['USH-05-001', 'USH-05-002', 'USH-05-003'] …）／ L2 —
- audit: 07_tasks/audit/T-US-05.md

### T-US-06 タイムライン（svar-gantt・棒を押すと詳細・1023 以下は切替）と見え方の切替（リスト／カンバン／カレンダー）

- group U-shared / layer ui / phase 4_ui_foundation / wave 18 / Human 16 h・AI 1.6 h・wall-clock 1.6 h
- 行為 — / 画面 — / 表 — / 関門 —（画面の部品。外界に出ない（API は関門の先））
- 依存 T-US-00 T-F-01 T-F-05 T-A-01
- 根拠（逐語）：D-079「タイムライン（期間と前後関係）の部品は svar-gantt（MIT）。目標・施策・検証の 3 段、棒＝期間、線＝前後関」 ／ D-068「画面の言葉は「渡す→引き継いでもらう」「引き取る→引き継ぐ」。今日は朝の確定（自分のAIの候補＋見込み時間の合計 vs 」
- 触るファイル：apps/web/components/views/*.tsx (new)
- AC（Tier 1）：STATE-DRIVEN: WHILE アプリの枠で描画中 THEN タイムライン（svar-gantt・棒を押すと詳細・1023 以下は切替）と見え が DE
- AC（Tier 2）：UBIQUITOUS: 共通シェルを含む全画面で横溢れ 0・本文 720 以上（1180+） ／ UNWANTED: IF セッションが 401 なら入り直しに落ち、入力途中の内容は失わない
- L1 行 8（['USH-06-001', 'USH-06-002', 'USH-06-003'] …）／ L2 —
- audit: 07_tasks/audit/T-US-06.md

### T-U-01 画面 アカウントを作る（2 状態・R1/R2）

- group U-screen / layer ui / phase 5_ui_parallel / wave 20 / Human 12.0 h・AI 1.2 h・wall-clock 1.2 h
- 行為 A01 / 画面 signup / 表 plans plan_versions subscriptions usage_meters plan_change_requests / 関門 —（画面。外界に出ない（API は関門の先））
- 依存 T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-01
- 根拠（逐語）：D-001「2028-09までに200社→65社に修正。自社SaaS外販。初期顧客が自力で回せることが前提」 ／ D-011「製品名は Kaname。旧製品から改名。表記は半角の Kaname だけ（漢字のかなめは使わない）」
- 触るファイル：apps/web/app/(public)/signup/page.tsx (new)、apps/web/tests/screens/signup.spec.ts (new)
- AC（Tier 1）：UBIQUITOUS: 画面 signup は URL /signup で開く（apps/web/app/(public)/signup/page.tsx。遷移 ／ STATE-DRIVEN: WHILE 画面 signup が描画中 THEN h1「アカウントを作る」・第2ナビ ・状態 2（通常、既に登録済み）がモック 0
- AC（Tier 2）：EVENT-DRIVEN: WHEN POST /api/v1/subscriptions が「会社名とメールを入れる」として呼ばれたとき THEN Kanam ／ EVENT-DRIVEN: WHEN POST /api/v1/subscriptions が「プランを選んで Stripe の登録画面へ進む」として呼ばれたと ／ EVENT-DRIVEN: WHEN 「はじめる」を押したとき THEN 対応する endpoint が呼ばれ、別 GET で再取得して画面に反映する
- L1 行 35（['SCR-SIGNUP-001', 'SCR-SIGNUP-002', 'SCR-SIGNUP-003'] …）／ L2 ['J-01']
- audit: 07_tasks/audit/T-U-01.md

### T-U-02 画面 メールを確認する（5 状態・R1/R2）

- group U-screen / layer ui / phase 5_ui_parallel / wave 20 / Human 19.5 h・AI 1.9 h・wall-clock 1.9 h
- 行為 A02 / 画面 verify-email / 表 members permissions layers / 関門 —（画面。外界に出ない（API は関門の先））
- 依存 T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-01 T-A-03 T-A-05
- 根拠（逐語）：D-042「情シス・コンプラが必ず聞くこと。Bridgeで何ができるか完全列挙・送るもの/送らないもの・全操作の証跡を管理者が閲覧エ」 ／ D-053「画面は行為から導出する。画面から始めると『この画面で何をしたいか分からない』が必ず起きる。役割×用事→行為の背骨→オブジ」
- 触るファイル：apps/web/app/(public)/verify-email/page.tsx (new)、apps/web/tests/screens/verify-email.spec.ts (new)
- AC（Tier 1）：UBIQUITOUS: 画面 verify-email は URL /verify-email で開く（apps/web/app/(public)/verify ／ STATE-DRIVEN: WHILE 画面 verify-email が描画中 THEN h1「メールを確認する」・第2ナビ ・状態 5（送信済み、申し込みが
- AC（Tier 2）：EVENT-DRIVEN: WHEN GET /api/v1/members が「届いたリンクを押す」として呼ばれたとき THEN Kaname は「本人確認を ／ EVENT-DRIVEN: WHEN GET /api/v1/members が「認証アプリを登録する」として呼ばれたとき THEN Kaname は「TOTP ／ EVENT-DRIVEN: WHEN 「はじめの設定をはじめる」を押したとき THEN 対応する endpoint が呼ばれ、別 GET で再取得して画面に反映
- L1 行 47（['SCR-VERIFY-EMAIL-001', 'SCR-VERIFY-EMAIL-035', 'SCR-VERIFY-EMAIL-029'] …）／ L2 ['J-01']
- audit: 07_tasks/audit/T-U-02.md

### T-U-03 画面 招待を受けて参加する（3 状態・R3/R4）

- group U-screen / layer ui / phase 5_ui_parallel / wave 20 / Human 14.5 h・AI 1.4 h・wall-clock 1.4 h
- 行為 A03 / 画面 invite-accept / 表 invitations members permissions layers / 関門 —（画面。外界に出ない（API は関門の先））
- 依存 T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-02
- 根拠（逐語）：D-026「スコープ4層(運営/会社/部署/個人)を担当業務・ルール・テンプレ・覚えた操作・記憶すべてに同じ形で使う」 ／ D-037「AI社員の出どころは運営配布/会社作成/個人作成の3経路。託されたAI社員は使えるが定義は編集できない。個人ルールだけは」
- 触るファイル：apps/web/app/(public)/invite/[token]/page.tsx (new)、apps/web/tests/screens/invite-accept.spec.ts (new)
- AC（Tier 1）：UBIQUITOUS: 画面 invite-accept は URL /invite/:token で開く（apps/web/app/(public)/invi ／ STATE-DRIVEN: WHILE 画面 invite-accept が描画中 THEN h1「招待を受けて参加する」・第2ナビ ・状態 3（担当者として、
- AC（Tier 2）：EVENT-DRIVEN: WHEN GET /api/v1/invitations が「招待リンクを押して名前を入れる」として呼ばれたとき THEN Kana ／ UNWANTED: IF 10/min/ip を超えたら、Kaname は 429 と retry_after_sec を返す ／ EVENT-DRIVEN: WHEN 「参加する」を押したとき THEN 対応する endpoint が呼ばれ、別 GET で再取得して画面に反映する
- L1 行 28（['SCR-INVITE-ACCEPT-001', 'SCR-INVITE-ACCEPT-002', 'SCR-INVITE-ACCEPT-003'] …）／ L2 ['J-01']
- audit: 07_tasks/audit/T-U-03.md

### T-U-04 画面 2段階認証を設定する（3 状態・R1/R2/R3）

- group U-screen / layer ui / phase 5_ui_parallel / wave 20 / Human 16.0 h・AI 1.6 h・wall-clock 1.6 h
- 行為 A04 / 画面 mfa-setup / 表 members permissions layers audit_events ops_audit_events security_events / 関門 —（画面。外界に出ない（API は関門の先））
- 依存 T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-01 T-A-03 T-A-05
- 根拠（逐語）：D-042「情シス・コンプラが必ず聞くこと。Bridgeで何ができるか完全列挙・送るもの/送らないもの・全操作の証跡を管理者が閲覧エ」 ／ D-051「ネイティブアプリは今4つだけ決める(認証をトークンベースに等)。後からアプリを足すのが画面を作るだけになる」
- 触るファイル：apps/web/app/(public)/mfa-setup/page.tsx (new)、apps/web/tests/screens/mfa-setup.spec.ts (new)
- AC（Tier 1）：UBIQUITOUS: 画面 mfa-setup は URL /mfa-setup で開く（apps/web/app/(public)/mfa-setup/pa ／ STATE-DRIVEN: WHILE 画面 mfa-setup が描画中 THEN h1「2段階認証を設定する」・第2ナビ ・状態 3（パスワードの確認、登録
- AC（Tier 2）：EVENT-DRIVEN: WHEN GET /api/v1/members が「届いたリンクを押す」として呼ばれたとき THEN Kaname は「本人確認を ／ EVENT-DRIVEN: WHEN GET /api/v1/members が「認証アプリを登録する」として呼ばれたとき THEN Kaname は「TOTP ／ EVENT-DRIVEN: WHEN 「登録する」を押したとき THEN 対応する endpoint が呼ばれ、別 GET で再取得して画面に反映する
- L1 行 34（['SCR-MFA-SETUP-028', 'SCR-MFA-SETUP-001', 'SCR-MFA-SETUP-002'] …）／ L2 ['J-01']
- audit: 07_tasks/audit/T-U-04.md

### T-U-05 画面 ログインする（3 状態・R1/R2/R3/R4）

- group U-screen / layer ui / phase 5_ui_parallel / wave 20 / Human 17.5 h・AI 1.8 h・wall-clock 1.8 h
- 行為 A13 / 画面 login / 表 members permissions layers / 関門 —（画面。外界に出ない（API は関門の先））
- 依存 T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-01 T-A-03 T-A-05
- 根拠（逐語）：D-042「情シス・コンプラが必ず聞くこと。Bridgeで何ができるか完全列挙・送るもの/送らないもの・全操作の証跡を管理者が閲覧エ」 ／ D-051「ネイティブアプリは今4つだけ決める(認証をトークンベースに等)。後からアプリを足すのが画面を作るだけになる」
- 触るファイル：apps/web/app/(public)/login/page.tsx (new)、apps/web/tests/screens/login.spec.ts (new)
- AC（Tier 1）：UBIQUITOUS: 画面 login は URL /login で開く（apps/web/app/(public)/login/page.tsx。遷移の h ／ STATE-DRIVEN: WHILE 画面 login が描画中 THEN h1「ログインする」・第2ナビ ・状態 3（通常、6桁の入力、失敗）がモック 06
- AC（Tier 2）：EVENT-DRIVEN: WHEN GET /api/v1/members が「届いたリンクを押す」として呼ばれたとき THEN Kaname は「本人確認を ／ EVENT-DRIVEN: WHEN GET /api/v1/members が「認証アプリを登録する」として呼ばれたとき THEN Kaname は「TOTP ／ EVENT-DRIVEN: WHEN 「ログイン」を押したとき THEN 対応する endpoint が呼ばれ、別 GET で再取得して画面に反映する
- L1 行 48（['SCR-LOGIN-001', 'SCR-LOGIN-002', 'SCR-LOGIN-003'] …）／ L2 ['J-03']
- audit: 07_tasks/audit/T-U-05.md

### T-U-06 画面 パスワードの再設定（3 状態・R1/R2/R3）

- group U-screen / layer ui / phase 5_ui_parallel / wave 20 / Human 16.0 h・AI 1.6 h・wall-clock 1.6 h
- 行為 A31 / 画面 password-reset / 表 members permissions layers audit_events ops_audit_events security_events / 関門 —（画面。外界に出ない（API は関門の先））
- 依存 T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-01 T-A-03 T-A-05
- 根拠（逐語）：D-042「情シス・コンプラが必ず聞くこと。Bridgeで何ができるか完全列挙・送るもの/送らないもの・全操作の証跡を管理者が閲覧エ」 ／ D-053「画面は行為から導出する。画面から始めると『この画面で何をしたいか分からない』が必ず起きる。役割×用事→行為の背骨→オブジ」
- 触るファイル：apps/web/app/(public)/password-reset/page.tsx (new)、apps/web/tests/screens/password-reset.spec.ts (new)
- AC（Tier 1）：UBIQUITOUS: 画面 password-reset は URL /password-reset で開く（apps/web/app/(public)/pa ／ STATE-DRIVEN: WHILE 画面 password-reset が描画中 THEN h1「パスワードの再設定」・第2ナビ ・状態 3（再設定を送る、
- AC（Tier 2）：EVENT-DRIVEN: WHEN GET /api/v1/members が「届いたリンクを押す」として呼ばれたとき THEN Kaname は「本人確認を ／ EVENT-DRIVEN: WHEN GET /api/v1/members が「認証アプリを登録する」として呼ばれたとき THEN Kaname は「TOTP ／ EVENT-DRIVEN: WHEN 「再設定メールを送る」を押したとき THEN 対応する endpoint が呼ばれ、別 GET で再取得して画面に反映する
- L1 行 37（['SCR-PASSWORD-RESET-001', 'SCR-PASSWORD-RESET-002', 'SCR-PASSWORD-RESET-003'] …）／ L2 ['J-06']
- audit: 07_tasks/audit/T-U-06.md

### T-U-07 画面 自分のAIと話す（5 状態・R1/R2）

- group U-screen / layer ui / phase 5_ui_parallel / wave 20 / Human 19.5 h・AI 1.9 h・wall-clock 1.9 h
- 行為 A06 / 画面 onboard-interview / 表 clones members conversations messages memories / 関門 —（画面。外界に出ない（API は関門の先））
- 依存 T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-01 T-A-17
- 根拠（逐語）：D-003「スキルは堀ではない。堀は『閉じたループ』(目標→逆算→配布→実行→測定→再計画)と会社モデル」 ／ D-010「製品の背骨。会社モデル(目標・台帳定義・担当業務・組織・ポリシー・記憶)を1つの定義に。画面もAI社員も自動実行もこの定」
- 触るファイル：apps/web/app/(public)/onboard/interview/page.tsx (new)、apps/web/tests/screens/onboard-interview.spec.ts (new)
- AC（Tier 1）：UBIQUITOUS: 画面 onboard-interview は URL /onboard/interview で開く（apps/web/app/(publ ／ STATE-DRIVEN: WHILE 画面 onboard-interview が描画中 THEN h1「高本AIと話す」・第2ナビ ・状態 5（Bridge
- AC（Tier 2）：EVENT-DRIVEN: WHEN POST /api/v1/clones が「自分のAIの質問に答える」として呼ばれたとき THEN Kaname は「会話 ／ UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない） ／ EVENT-DRIVEN: WHEN 「次の質問へ」を押したとき THEN 対応する endpoint が呼ばれ、別 GET で再取得して画面に反映する
- L1 行 58（['SCR-ONBOARD-INTERVIEW-001', 'SCR-ONBOARD-INTERVIEW-002', 'SCR-ONBOARD-INTERVIEW-003'] …）／ L2 ['J-02']
- audit: 07_tasks/audit/T-U-07.md

### T-U-08 画面 たたき台を確かめる（3 状態・R1/R2）

- group U-screen / layer ui / phase 5_ui_parallel / wave 20 / Human 14.5 h・AI 1.4 h・wall-clock 1.4 h
- 行為 A07 A08 / 画面 onboard-draft / 表 tenants goals ledger_definitions duties scopes policies / 関門 —（画面。外界に出ない（API は関門の先））
- 依存 T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-01 T-A-07 T-A-11
- 根拠（逐語）：D-003「スキルは堀ではない。堀は『閉じたループ』(目標→逆算→配布→実行→測定→再計画)と会社モデル」 ／ D-010「製品の背骨。会社モデル(目標・台帳定義・担当業務・組織・ポリシー・記憶)を1つの定義に。画面もAI社員も自動実行もこの定」
- 触るファイル：apps/web/app/(public)/onboard/draft/page.tsx (new)、apps/web/tests/screens/onboard-draft.spec.ts (new)
- AC（Tier 1）：UBIQUITOUS: 画面 onboard-draft は URL /onboard/draft で開く（apps/web/app/(public)/onbo ／ STATE-DRIVEN: WHILE 画面 onboard-draft が描画中 THEN h1「たたき台を確かめる」・第2ナビ ・状態 3（たたき台、会話で
- AC（Tier 2）：EVENT-DRIVEN: WHEN GET /api/v1/tenants が「出てきたたたき台を見る」として呼ばれたとき THEN Kaname は「会社モ ／ EVENT-DRIVEN: WHEN GET /api/v1/tenants が「違うところを言う」として呼ばれたとき THEN Kaname は「会社モデルの ／ EVENT-DRIVEN: WHEN 「これでいく」を押したとき THEN 対応する endpoint が呼ばれ、別 GET で再取得して画面に反映する
- L1 行 52（['SCR-ONBOARD-DRAFT-001', 'SCR-ONBOARD-DRAFT-002', 'SCR-ONBOARD-DRAFT-003'] …）／ L2 ['J-02']
- audit: 07_tasks/audit/T-U-08.md

### T-U-09 画面 自分のPCをつなぐ（11 状態・R1/R2）

- group U-screen / layer ui / phase 5_ui_parallel / wave 20 / Human 34.5 h・AI 3.5 h・wall-clock 3.5 h
- 行為 A09 / 画面 bridge-setup / 表 sessions action_runs / 関門 —（画面。外界に出ない（API は関門の先））
- 依存 T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-01 T-A-07
- 根拠（逐語）：D-055「段階1で AI が動く経路は Bridge（顧客PCで本人のサブスクの公式CLI）だけ。BYOK・運営マネージドは段階2」 ／ D-015「Bridgeは顧客PCで動く万能実行器。本人のIP・本人のログイン済みセッションで動くのでCAPTCHA/bot検知に到」
- 触るファイル：apps/web/app/(app)/setup/bridge/page.tsx (new)、apps/web/tests/screens/bridge-setup.spec.ts (new)
- AC（Tier 1）：UBIQUITOUS: 画面 bridge-setup は URL /setup/bridge で開く（apps/web/app/(app)/setup/bri ／ STATE-DRIVEN: WHILE 画面 bridge-setup が描画中 THEN h1「自分のPCをつなぐ」・第2ナビ 接続 / この端末 / 動く条
- AC（Tier 2）：EVENT-DRIVEN: WHEN POST /api/v1/sessions が「Bridge を入れて開き、「Claude Code を入れる」を押し、ロ ／ UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない） ／ EVENT-DRIVEN: WHEN 「接続を確かめる」を押したとき THEN 対応する endpoint が呼ばれ、別 GET で再取得して画面に反映する
- L1 行 85（['SCR-BRIDGE-SETUP-059', 'SCR-BRIDGE-SETUP-060', 'SCR-BRIDGE-SETUP-061'] …）／ L2 ['J-02']
- audit: 07_tasks/audit/T-U-09.md

### T-U-10 画面 ログイン情報を預ける（5 状態・R1/R2）

- group U-screen / layer ui / phase 5_ui_parallel / wave 20 / Human 19.5 h・AI 1.9 h・wall-clock 1.9 h
- 行為 A10 / 画面 credentials / 表 credentials service_registry service_registry_versions service_requests policies / 関門 —（画面。外界に出ない（API は関門の先））
- 依存 T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-07
- 根拠（逐語）：D-017「vaultにID/PW＋TOTPシークレットを暗号化保管し実行器が直接入力。AIには一切渡さない(参照IDのみ)」 ／ D-041「サービス台帳で外部サービスごとの自動操作可否を持つ(api/allowed/unspecified/forbidden/」
- 触るファイル：apps/web/app/(app)/settings/credentials/page.tsx (new)、apps/web/tests/screens/credentials.spec.ts (new)
- AC（Tier 1）：UBIQUITOUS: 画面 credentials は URL /settings/credentials で開く（apps/web/app/(app)/se ／ STATE-DRIVEN: WHILE 画面 credentials が描画中 THEN h1「ログイン情報を預ける」・第2ナビ 預けたもの / 自動操作の可否
- AC（Tier 2）：EVENT-DRIVEN: WHEN POST /api/v1/credentials が「使うサービスを選びログイン情報を入れる」として呼ばれたとき THEN ／ UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない） ／ EVENT-DRIVEN: WHEN 「保存する」を押したとき THEN 対応する endpoint が呼ばれ、別 GET で再取得して画面に反映する
- L1 行 64（['SCR-CREDENTIALS-001', 'SCR-CREDENTIALS-002', 'SCR-CREDENTIALS-003'] …）／ L2 ['J-02']
- audit: 07_tasks/audit/T-U-10.md

### T-U-11 画面 テストで動かす（3 状態・R1/R2）

- group U-screen / layer ui / phase 5_ui_parallel / wave 21 / Human 14.5 h・AI 1.4 h・wall-clock 1.4 h
- 行為 A11 / 画面 onboard-testrun / 表 action_runs ai_employees members audit_events ops_audit_events security_events / 関門 —（画面。外界に出ない（API は関門の先））
- 依存 T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-08
- 根拠（逐語）：D-028「テストモード。OJTの入口を『見せてください』から『まず作ってみます』に変える。外に一切出さず実データは読む。納得したら」 ／ D-040「CAPTCHAは突破しない。本人環境・本人資格情報・本人のペースで動くので到達しない。突破は運営の安全ルールで禁止」
- 触るファイル：apps/web/app/(public)/onboard/testrun/page.tsx (new)、apps/web/tests/screens/onboard-testrun.spec.ts (new)
- AC（Tier 1）：UBIQUITOUS: 画面 onboard-testrun は URL /onboard/testrun で開く（apps/web/app/(public)/ ／ STATE-DRIVEN: WHILE 画面 onboard-testrun が描画中 THEN h1「テストで動かす」・第2ナビ ・状態 3（動かした、最初、
- AC（Tier 2）：EVENT-DRIVEN: WHEN GET /api/v1/action_runs が「試しに動かして結果を見る」として呼ばれたとき THEN Kaname  ／ UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない） ／ EVENT-DRIVEN: WHEN 「本番に切り替える」を押したとき THEN 対応する endpoint が呼ばれ、別 GET で再取得して画面に反映する
- L1 行 41（['SCR-ONBOARD-TESTRUN-001', 'SCR-ONBOARD-TESTRUN-002', 'SCR-ONBOARD-TESTRUN-003'] …）／ L2 ['J-02']
- audit: 07_tasks/audit/T-U-11.md

### T-U-12 画面 本番に切り替える（2 状態・R1/R2）

- group U-screen / layer ui / phase 5_ui_parallel / wave 21 / Human 12.0 h・AI 1.2 h・wall-clock 1.2 h
- 行為 A12 / 画面 onboard-golive / 表 tenants goals ledger_definitions duties scopes policies / 関門 —（画面。外界に出ない（API は関門の先））
- 依存 T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-01 T-A-07 T-A-11
- 根拠（逐語）：D-028「テストモード。OJTの入口を『見せてください』から『まず作ってみます』に変える。外に一切出さず実データは読む。納得したら」 ／ D-019「実装順序。Bridge(万能実行器)を最初に作る」
- 触るファイル：apps/web/app/(public)/onboard/golive/page.tsx (new)、apps/web/tests/screens/onboard-golive.spec.ts (new)
- AC（Tier 1）：UBIQUITOUS: 画面 onboard-golive は URL /onboard/golive で開く（apps/web/app/(public)/on ／ STATE-DRIVEN: WHILE 画面 onboard-golive が描画中 THEN h1「本番に切り替える」・第2ナビ ・状態 2（確認、切り替えた
- AC（Tier 2）：EVENT-DRIVEN: WHEN GET /api/v1/tenants が「出てきたたたき台を見る」として呼ばれたとき THEN Kaname は「会社モ ／ EVENT-DRIVEN: WHEN GET /api/v1/tenants が「違うところを言う」として呼ばれたとき THEN Kaname は「会社モデルの ／ EVENT-DRIVEN: WHEN 「切り替える」を押したとき THEN 対応する endpoint が呼ばれ、別 GET で再取得して画面に反映する
- L1 行 34（['SCR-ONBOARD-GOLIVE-001', 'SCR-ONBOARD-GOLIVE-002', 'SCR-ONBOARD-GOLIVE-003'] …）／ L2 ['J-02']
- audit: 07_tasks/audit/T-U-12.md

### T-U-13 画面 今日（6 状態・R1/R2/R3/R4）

- group U-screen / layer ui / phase 5_ui_parallel / wave 21 / Human 25.0 h・AI 2.5 h・wall-clock 2.5 h
- 行為 A14 A55 A56 A92 / 画面 today / 表 messages daily_plans tasks task_handovers approvals clones / 関門 —（画面。外界に出ない（API は関門の先））
- 依存 T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-05 T-A-18
- 根拠（逐語）：D-008「ペルソナ1=高本本人。一人で受託・キャパ限界・人に任せたい・目標は決めているだけで実行が回らない」 ／ D-024「主役は会社モデル(Hub)＋ループ。用語と部品の正確な定義。自分のAI（旧称自分のAI／COO）は1人1体」
- 触るファイル：apps/web/app/(app)/today/page.tsx (new)、apps/web/tests/screens/today.spec.ts (new)
- AC（Tier 1）：UBIQUITOUS: 画面 today は URL /today で開く（apps/web/app/(app)/today/page.tsx。遷移の href ／ STATE-DRIVEN: WHILE 画面 today が描画中 THEN h1「今日」・第2ナビ 昨日の会話をまとめる / 申し送り / 朝の計画 / 承認
- AC（Tier 2）：EVENT-DRIVEN: WHEN GET /api/v1/messages が「申し送りを読む」として呼ばれたとき THEN Kaname は「タスクと承認 ／ EVENT-DRIVEN: WHEN GET /api/v1/messages が「昨日の会話をまとめる」として呼ばれたとき THEN Kaname は「mem ／ EVENT-DRIVEN: WHEN PATCH /api/v1/messages/:id が「候補にチェックを入れて「今日を確定」を押す」として呼ばれたとき 
- L1 行 114（['SCR-TODAY-001', 'SCR-TODAY-002', 'SCR-TODAY-003'] …）／ L2 ['J-03']
- audit: 07_tasks/audit/T-U-13.md

### T-U-14 画面 承認待ち（4 状態・R1/R2/R3）

- group U-screen / layer ui / phase 5_ui_parallel / wave 21 / Human 18.5 h・AI 1.9 h・wall-clock 1.9 h
- 行為 A15 / 画面 approvals / 表 approvals clones members notifications notification_preferences notice_deliveries / 関門 —（画面。外界に出ない（API は関門の先））
- 依存 T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-08
- 根拠（逐語）：D-012「AIは直接変えない。必ず提案として出し人が承認して反映。ただし動線が増えすぎるUX低下は避ける。プルリクエスト的な形は採」 ／ D-037「AI社員の出どころは運営配布/会社作成/個人作成の3経路。託されたAI社員は使えるが定義は編集できない。個人ルールだけは」
- 触るファイル：apps/web/app/(app)/approvals/page.tsx (new)、apps/web/tests/screens/approvals.spec.ts (new)
- AC（Tier 1）：UBIQUITOUS: 画面 approvals は URL /approvals で開く（apps/web/app/(app)/approvals/page. ／ STATE-DRIVEN: WHILE 画面 approvals が描画中 THEN h1「承認待ち」・第2ナビ 未処理 / 止めたもの / 履歴・状態 4（通
- AC（Tier 2）：EVENT-DRIVEN: WHEN PATCH /api/v1/approvals/:id が「中身を見て押す／止める」として呼ばれたとき THEN Kana ／ UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない） ／ EVENT-DRIVEN: WHEN 「承認する」を押したとき THEN 対応する endpoint が呼ばれ、別 GET で再取得して画面に反映する
- L1 行 62（['SCR-APPROVALS-001', 'SCR-APPROVALS-002', 'SCR-APPROVALS-003'] …）／ L2 ['J-03']
- audit: 07_tasks/audit/T-U-14.md

### T-U-15 画面 自分のAIとAI社員のやりとり（5 状態・R1/R2/R3）

- group U-screen / layer ui / phase 5_ui_parallel / wave 21 / Human 21.0 h・AI 2.1 h・wall-clock 2.1 h
- 行為 A16 / 画面 clone-thread / 表 approvals messages clones members ai_employees / 関門 —（画面。外界に出ない（API は関門の先））
- 依存 T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-08 T-A-13
- 根拠（逐語）：D-012「AIは直接変えない。必ず提案として出し人が承認して反映。ただし動線が増えすぎるUX低下は避ける。プルリクエスト的な形は採」 ／ D-037「AI社員の出どころは運営配布/会社作成/個人作成の3経路。託されたAI社員は使えるが定義は編集できない。個人ルールだけは」
- 触るファイル：apps/web/app/(app)/ai/thread/page.tsx (new)、apps/web/tests/screens/clone-thread.spec.ts (new)
- AC（Tier 1）：UBIQUITOUS: 画面 clone-thread は URL /ai/thread で開く（apps/web/app/(app)/ai/thread/pa ／ STATE-DRIVEN: WHILE 画面 clone-thread が描画中 THEN h1「高本AIとAI社員のやりとり」・第2ナビ 差し戻し中 / やり
- AC（Tier 2）：EVENT-DRIVEN: WHEN GET /api/v1/approvals が「自分のAIとAI社員のやりとりを見る」として呼ばれたとき THEN Kan ／ UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない） ／ EVENT-DRIVEN: WHEN 「AI社員に伝える」を押したとき THEN 対応する endpoint が呼ばれ、別 GET で再取得して画面に反映する
- L1 行 57（['SCR-CLONE-THREAD-001', 'SCR-CLONE-THREAD-002', 'SCR-CLONE-THREAD-003'] …）／ L2 ['J-03']
- audit: 07_tasks/audit/T-U-15.md

### T-U-16 画面 タスク（12 状態・R1/R2/R3/R4）

- group U-screen / layer ui / phase 5_ui_parallel / wave 21 / Human 40.0 h・AI 4.0 h・wall-clock 4.0 h
- 行為 A17 A48 A50 A51 A57 A58 / 画面 tasks / 表 tasks task_handovers goals goal_versions measures members / 関門 —（画面。外界に出ない（API は関門の先））
- 依存 T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-05 T-A-06 T-A-09
- 根拠（逐語）：D-008「ペルソナ1=高本本人。一人で受託・キャパ限界・人に任せたい・目標は決めているだけで実行が回らない」 ／ D-034「目標は双方向。降ろす(逆算)と積み上げる(実績)が同じ画面に出る」
- 触るファイル：apps/web/app/(app)/tasks/page.tsx (new)、apps/web/tests/screens/tasks.spec.ts (new)
- AC（Tier 1）：UBIQUITOUS: 画面 tasks は URL /tasks で開く（apps/web/app/(app)/tasks/page.tsx。遷移の href ／ STATE-DRIVEN: WHILE 画面 tasks が描画中 THEN h1「タスク」・第2ナビ 今日 / 今週 / 詰まっている / 期限切れ / 引き
- AC（Tier 2）：EVENT-DRIVEN: WHEN GET /api/v1/tasks が「残っている仕事から引き継ぐ」として呼ばれたとき THEN Kaname は「タスク ／ EVENT-DRIVEN: WHEN GET /api/v1/tasks が「見え方を切り替える（URL に残る）」として呼ばれたとき THEN Kaname  ／ EVENT-DRIVEN: WHEN POST /api/v1/tasks が「やることを書いて、どの目標かを選ぶ」として呼ばれたとき THEN Kaname 
- L1 行 134（['SCR-TASKS-001', 'SCR-TASKS-002', 'SCR-TASKS-003'] …）／ L2 ['J-03']
- audit: 07_tasks/audit/T-U-16.md

### T-U-17 画面 自分のAIと話す（21 状態・R1/R2/R3/R4）

- group U-screen / layer ui / phase 5_ui_parallel / wave 21 / Human 62.5 h・AI 6.2 h・wall-clock 6.2 h
- 行為 A20 A88 A89 A90 A91 A95 / 画面 clone-chat / 表 conversations messages clones members memories goals / 関門 —（画面。外界に出ない（API は関門の先））
- 依存 T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-04 T-A-09 T-A-11
- 根拠（逐語）：D-106「返事の「書き出す」で成果物ができ、会話の横で開く。文書（md）と表（csv）はその場で直して保存すると新しい版になり、版」 ／ D-107「サービス台帳で禁止（forbidden）と銀行（bank）のドメインは、自分のAI に仕事を渡すたびに Bridge が」
- 触るファイル：apps/web/app/(app)/ai/chat/page.tsx (new)、apps/web/tests/screens/clone-chat.spec.ts (new)
- AC（Tier 1）：UBIQUITOUS: 画面 clone-chat は URL /ai/chat で開く（apps/web/app/(app)/ai/chat/page.tsx ／ STATE-DRIVEN: WHILE 画面 clone-chat が描画中 THEN h1「高本AIと話す」・第2ナビ 新しく話す / 会話 / 星 / 記憶
- AC（Tier 2）：EVENT-DRIVEN: WHEN GET /api/v1/conversations が「聞く・頼む」として呼ばれたとき THEN Kaname は「会話を ／ EVENT-DRIVEN: WHEN GET /api/v1/conversations が「資料や画像を付けて渡す」として呼ばれたとき THEN Kaname ／ EVENT-DRIVEN: WHEN POST /api/v1/conversations が「会話を分けて始める・一覧から戻る」として呼ばれたとき THEN 
- L1 行 219（['SCR-CLONE-CHAT-122', 'SCR-CLONE-CHAT-123', 'SCR-CLONE-CHAT-124'] …）／ L2 ['J-03', 'J-07']
- audit: 07_tasks/audit/T-U-17.md

### T-U-18 画面 AI社員の動き（4 状態・R1/R2/R3）

- group U-screen / layer ui / phase 5_ui_parallel / wave 21 / Human 18.5 h・AI 1.9 h・wall-clock 1.9 h
- 行為 A53 / 画面 ai-activity / 表 ai_employees members clones audit_events ops_audit_events security_events / 関門 —（画面。外界に出ない（API は関門の先））
- 依存 T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-07 T-A-08 T-A-13
- 根拠（逐語）：D-062「会話は1本で見え方が2つ。A 会話モード（Claude/LINE 型の専用画面）と B 作業モード（中央＝反映先の画面、」 ／ D-037「AI社員の出どころは運営配布/会社作成/個人作成の3経路。託されたAI社員は使えるが定義は編集できない。個人ルールだけは」
- 触るファイル：apps/web/app/(app)/ai-staff/activity/page.tsx (new)、apps/web/tests/screens/ai-activity.spec.ts (new)
- AC（Tier 1）：UBIQUITOUS: 画面 ai-activity は URL /ai-staff/activity で開く（apps/web/app/(app)/ai-st ／ STATE-DRIVEN: WHILE 画面 ai-activity が描画中 THEN h1「AI社員の動き」・第2ナビ 今日の動き / 止まっている / A
- AC（Tier 2）：EVENT-DRIVEN: WHEN GET /api/v1/ai_employees が「AI社員を増やす・人に託す」として呼ばれたとき THEN Kanam ／ EVENT-DRIVEN: WHEN GET /api/v1/ai_employees が「このAI社員の中身を見る」として呼ばれたとき THEN Kaname ／ EVENT-DRIVEN: WHEN 「止まっているところへ」を押したとき THEN 対応する endpoint が呼ばれ、別 GET で再取得して画面に反映す
- L1 行 48（['SCR-AI-ACTIVITY-001', 'SCR-AI-ACTIVITY-002', 'SCR-AI-ACTIVITY-003'] …）／ L2 ['J-03']
- audit: 07_tasks/audit/T-U-18.md

### T-U-19 画面 探す（3 状態・R1/R2/R3/R4）

- group U-screen / layer ui / phase 5_ui_parallel / wave 21 / Human 17.5 h・AI 1.8 h・wall-clock 1.8 h
- 行為 A21 / 画面 search / 表 ledger_definitions ledger_views memories audit_events ops_audit_events security_events / 関門 —（画面。外界に出ない（API は関門の先））
- 依存 T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-10
- 根拠（逐語）：D-007「数値はAI社員が会話で出す。分析系の固定画面(ランキング・チャネル別・期間比較)を一切作らない」 ／ D-029「アップロードは形式を指定しない。何でも受け取ってAIが読む」
- 触るファイル：apps/web/app/(app)/search/page.tsx (new)、apps/web/tests/screens/search.spec.ts (new)
- AC（Tier 1）：UBIQUITOUS: 画面 search は URL /search で開く（apps/web/app/(app)/search/page.tsx。遷移の h ／ STATE-DRIVEN: WHILE 画面 search が描画中 THEN h1「探す」・第2ナビ 台帳 / 記憶 / 証跡・状態 3（結果、最初、AI が
- AC（Tier 2）：EVENT-DRIVEN: WHEN GET /api/v1/ledger_definitions が「言葉で探す」として呼ばれたとき THEN Kaname  ／ EVENT-DRIVEN: WHEN GET /api/v1/ledger_definitions が「一覧を見る」として呼ばれたとき THEN Kaname  ／ EVENT-DRIVEN: WHEN 「探す」を押したとき THEN 対応する endpoint が呼ばれ、別 GET で再取得して画面に反映する
- L1 行 41（['SCR-SEARCH-001', 'SCR-SEARCH-002', 'SCR-SEARCH-003'] …）／ L2 ['J-03']
- audit: 07_tasks/audit/T-U-19.md

### T-U-20 画面 台帳（6 状態・R1/R2/R3/R4）

- group U-screen / layer ui / phase 5_ui_parallel / wave 21 / Human 25.0 h・AI 2.5 h・wall-clock 2.5 h
- 行為 A24 A47 / 画面 records / 表 ledger_definitions ledger_views ledger_records ledger_stages / 関門 —（画面。外界に出ない（API は関門の先））
- 依存 T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-10 T-A-15
- 根拠（逐語）：D-038「台帳は『計算しないが、結果は持つ』。CRM/会計の計算は担わないが結果は台帳に持つ」 ／ D-039「業界別パッケージ(別製品)は作らない。業界別テンプレ(定義のスナップショット)は作る。各企業ごとに専用の会社モデルができ」
- 触るファイル：apps/web/app/(app)/records/page.tsx (new)、apps/web/tests/screens/records.spec.ts (new)
- AC（Tier 1）：UBIQUITOUS: 画面 records は URL /records で開く（apps/web/app/(app)/records/page.tsx。遷移 ／ STATE-DRIVEN: WHILE 画面 records が描画中 THEN h1「台帳」・第2ナビ すべて / 止まっている / 自分の担当・状態 6（カ
- AC（Tier 2）：EVENT-DRIVEN: WHEN GET /api/v1/ledger_definitions が「言葉で探す」として呼ばれたとき THEN Kaname  ／ EVENT-DRIVEN: WHEN GET /api/v1/ledger_definitions が「一覧を見る」として呼ばれたとき THEN Kaname  ／ EVENT-DRIVEN: WHEN PATCH /api/v1/ledger_definitions/:id が「止まっている案件を動かす」として呼ばれたとき
- L1 行 57（['SCR-RECORDS-001', 'SCR-RECORDS-002', 'SCR-RECORDS-003'] …）／ L2 ['J-03', 'J-04']
- audit: 07_tasks/audit/T-U-20.md

### T-U-21 画面 台帳の1件（3 状態・R1/R2/R3/R4）

- group U-screen / layer ui / phase 5_ui_parallel / wave 22 / Human 17.5 h・AI 1.8 h・wall-clock 1.8 h
- 行為 A18 A19 / 画面 record-detail / 表 ledger_records ledger_stages tasks task_handovers attachments audit_events / 関門 —（画面。外界に出ない（API は関門の先））
- 依存 T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-10
- 根拠（逐語）：D-038「台帳は『計算しないが、結果は持つ』。CRM/会計の計算は担わないが結果は台帳に持つ」 ／ D-039「業界別パッケージ(別製品)は作らない。業界別テンプレ(定義のスナップショット)は作る。各企業ごとに専用の会社モデルができ」
- 触るファイル：apps/web/app/(app)/records/[id]/page.tsx (new)、apps/web/tests/screens/record-detail.spec.ts (new)
- AC（Tier 1）：UBIQUITOUS: 画面 record-detail は URL /records/:id で開く（apps/web/app/(app)/records/[ ／ STATE-DRIVEN: WHILE 画面 record-detail が描画中 THEN h1「台帳の1件」・第2ナビ 中身 / タスク / 添付 / 証跡
- AC（Tier 2）：EVENT-DRIVEN: WHEN GET /api/v1/ledger_records が「1件を開いて中を見る」として呼ばれたとき THEN Kaname ／ UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない） ／ EVENT-DRIVEN: WHEN PATCH /api/v1/ledger_records/:id が「段階を次へ動かす」として呼ばれたとき THEN Ka
- L1 行 56（['SCR-RECORD-DETAIL-001', 'SCR-RECORD-DETAIL-002', 'SCR-RECORD-DETAIL-003'] …）／ L2 ['J-03']
- audit: 07_tasks/audit/T-U-21.md

### T-U-22 画面 目標（5 状態・R1/R2/R3）

- group U-screen / layer ui / phase 5_ui_parallel / wave 22 / Human 21.0 h・AI 2.1 h・wall-clock 2.1 h
- 行為 A22 A54 / 画面 goals / 表 goals goal_versions goal_allocations goal_contributions units skills / 関門 —（画面。外界に出ない（API は関門の先））
- 依存 T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-11 T-A-12
- 根拠（逐語）：D-058「目標の層は可変（会社＞事業＞部署＞…＞個人＞AI社員）で、必ずログイン中の個人まで落とす。個人の層は本人が画面で管理する」 ／ D-032「目標の階層と配分。スコープ層と目標階層は別概念。未配分の可視化。配る権限。合意/指示の2通り。AI社員にも配れる。未達は」
- 触るファイル：apps/web/app/(app)/goals/page.tsx (new)、apps/web/tests/screens/goals.spec.ts (new)
- AC（Tier 1）：UBIQUITOUS: 画面 goals は URL /goals で開く（apps/web/app/(app)/goals/page.tsx。遷移の href ／ STATE-DRIVEN: WHILE 画面 goals が描画中 THEN h1「目標」・第2ナビ 階層で見る / 降ろした数 / 積み上がった数 / 未配分
- AC（Tier 2）：EVENT-DRIVEN: WHEN GET /api/v1/goals が「届くか見る」として呼ばれたとき THEN Kaname は「目標と実績を突き合わせ ／ EVENT-DRIVEN: WHEN GET /api/v1/goals が「無くす目標を選び、紐づくものの行き先を決める」として呼ばれたとき THEN Kan ／ EVENT-DRIVEN: WHEN 「配分を見直す」を押したとき THEN 対応する endpoint が呼ばれ、別 GET で再取得して画面に反映する
- L1 行 76（['SCR-GOALS-001', 'SCR-GOALS-002', 'SCR-GOALS-003'] …）／ L2 ['J-04']
- audit: 07_tasks/audit/T-U-22.md

### T-U-23 画面 目標の配分（6 状態・R1/R2）

- group U-screen / layer ui / phase 5_ui_parallel / wave 22 / Human 22.0 h・AI 2.2 h・wall-clock 2.2 h
- 行為 A23 / 画面 goal-allocation / 表 goal_allocations goal_contributions goals goal_versions units members / 関門 —（画面。外界に出ない（API は関門の先））
- 依存 T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-04 T-A-11
- 根拠（逐語）：D-058「目標の層は可変（会社＞事業＞部署＞…＞個人＞AI社員）で、必ずログイン中の個人まで落とす。個人の層は本人が画面で管理する」 ／ D-032「目標の階層と配分。スコープ層と目標階層は別概念。未配分の可視化。配る権限。合意/指示の2通り。AI社員にも配れる。未達は」
- 触るファイル：apps/web/app/(app)/goals/[id]/allocation/page.tsx (new)、apps/web/tests/screens/goal-allocation.spec.ts (new)
- AC（Tier 1）：UBIQUITOUS: 画面 goal-allocation は URL /goals/:id/allocation で開く（apps/web/app/(app ／ STATE-DRIVEN: WHILE 画面 goal-allocation が描画中 THEN h1「目標の配分」・第2ナビ 階層 / 未配分 / 見せる範囲
- AC（Tier 2）：EVENT-DRIVEN: WHEN PATCH /api/v1/goal_allocations/:id が「誰に・どれだけ降ろすか決める」として呼ばれたとき ／ EVENT-DRIVEN: WHEN PATCH /api/v1/goal_allocations/:id が「自分の目標を直す・自主目標を足す」として呼ばれた ／ EVENT-DRIVEN: WHEN 「配る」を押したとき THEN 対応する endpoint が呼ばれ、別 GET で再取得して画面に反映する
- L1 行 53（['SCR-GOAL-ALLOCATION-001', 'SCR-GOAL-ALLOCATION-002', 'SCR-GOAL-ALLOCATION-003'] …）／ L2 ['J-04']
- audit: 07_tasks/audit/T-U-23.md

### T-U-24 画面 目標を改訂する（2 状態・R1/R2）

- group U-screen / layer ui / phase 5_ui_parallel / wave 22 / Human 12.0 h・AI 1.2 h・wall-clock 1.2 h
- 行為 A29 A52 / 画面 goal-edit / 表 goals goal_versions units goal_allocations goal_contributions tasks / 関門 —（画面。外界に出ない（API は関門の先））
- 依存 T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-11 T-A-12
- 根拠（逐語）：D-032「目標の階層と配分。スコープ層と目標階層は別概念。未配分の可視化。配る権限。合意/指示の2通り。AI社員にも配れる。未達は」 ／ D-034「目標は双方向。降ろす(逆算)と積み上げる(実績)が同じ画面に出る」
- 触るファイル：apps/web/app/(app)/goals/[id]/edit/page.tsx (new)、apps/web/tests/screens/goal-edit.spec.ts (new)
- AC（Tier 1）：UBIQUITOUS: 画面 goal-edit は URL /goals/:id/edit で開く（apps/web/app/(app)/goals/[id] ／ STATE-DRIVEN: WHILE 画面 goal-edit が描画中 THEN h1「目標を改訂する」・第2ナビ 改訂 / 無くす / 下への影響 / 版
- AC（Tier 2）：EVENT-DRIVEN: WHEN GET /api/v1/goals が「届くか見る」として呼ばれたとき THEN Kaname は「目標と実績を突き合わせ ／ EVENT-DRIVEN: WHEN GET /api/v1/goals が「無くす目標を選び、紐づくものの行き先を決める」として呼ばれたとき THEN Kan ／ EVENT-DRIVEN: WHEN PATCH /api/v1/goals/:id が「目標を改訂する」として呼ばれたとき THEN Kaname は「目標を
- L1 行 55（['SCR-GOAL-EDIT-001', 'SCR-GOAL-EDIT-002', 'SCR-GOAL-EDIT-003'] …）／ L2 ['J-05']
- audit: 07_tasks/audit/T-U-24.md

### T-U-25 画面 自分の目標（3 状態・R1/R2/R3/R4）

- group U-screen / layer ui / phase 5_ui_parallel / wave 22 / Human 17.5 h・AI 1.8 h・wall-clock 1.8 h
- 行為 A25 A49 / 画面 my-progress / 表 goal_allocations goal_contributions tasks task_handovers goals goal_versions / 関門 —（画面。外界に出ない（API は関門の先））
- 依存 T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-04 T-A-11
- 根拠（逐語）：D-058「目標の層は可変（会社＞事業＞部署＞…＞個人＞AI社員）で、必ずログイン中の個人まで落とす。個人の層は本人が画面で管理する」 ／ D-026「スコープ4層(運営/会社/部署/個人)を担当業務・ルール・テンプレ・覚えた操作・記憶すべてに同じ形で使う」
- 触るファイル：apps/web/app/(app)/my-progress/page.tsx (new)、apps/web/tests/screens/my-progress.spec.ts (new)
- AC（Tier 1）：UBIQUITOUS: 画面 my-progress は URL /my-progress で開く（apps/web/app/(app)/my-progress ／ STATE-DRIVEN: WHILE 画面 my-progress が描画中 THEN h1「自分の目標」・第2ナビ 配られた分 / 自主目標 / 自分のAI
- AC（Tier 2）：EVENT-DRIVEN: WHEN GET /api/v1/goal_allocations が「自分の担当分の進みを見る」として呼ばれたとき THEN Ka ／ UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない） ／ EVENT-DRIVEN: WHEN PATCH /api/v1/goal_allocations/:id が「誰に・どれだけ降ろすか決める」として呼ばれたとき
- L1 行 41（['SCR-MY-PROGRESS-001', 'SCR-MY-PROGRESS-002', 'SCR-MY-PROGRESS-003'] …）／ L2 ['J-04']
- audit: 07_tasks/audit/T-U-25.md

### T-U-26 画面 ふりかえり（5 状態・R1/R2）

- group U-screen / layer ui / phase 5_ui_parallel / wave 22 / Human 19.5 h・AI 1.9 h・wall-clock 1.9 h
- 行為 A26 / 画面 review / 表 hypotheses goals goal_versions validations / 関門 —（画面。外界に出ない（API は関門の先））
- 依存 T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-12
- 根拠（逐語）：D-035「目標とタスクの間に仮説と施策を置く。目標→現状分析→仮説→施策→タスク→検証→次の仮説。効かなかった仮説も残す」 ／ D-006「スコープの採否は『抜いてもループが閉じるか』。CRM・請求・経理を切ると目標の数値が出せなくなるので切らない」
- 触るファイル：apps/web/app/(app)/review/page.tsx (new)、apps/web/tests/screens/review.spec.ts (new)
- AC（Tier 1）：UBIQUITOUS: 画面 review は URL /review で開く（apps/web/app/(app)/review/page.tsx。遷移の h ／ STATE-DRIVEN: WHILE 画面 review が描画中 THEN h1「ふりかえり」・第2ナビ 差分 / 要因の候補 / 前期との比較・状態 5（
- AC（Tier 2）：EVENT-DRIVEN: WHEN GET /api/v1/hypotheses が「ふりかえりを読む」として呼ばれたとき THEN Kaname は「期間の ／ UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない） ／ EVENT-DRIVEN: WHEN 「仮説を見る」を押したとき THEN 対応する endpoint が呼ばれ、別 GET で再取得して画面に反映する
- L1 行 38（['SCR-REVIEW-001', 'SCR-REVIEW-002', 'SCR-REVIEW-003'] …）／ L2 ['J-05']
- audit: 07_tasks/audit/T-U-26.md

### T-U-27 画面 仮説と施策（5 状態・R1/R2）

- group U-screen / layer ui / phase 5_ui_parallel / wave 22 / Human 19.5 h・AI 1.9 h・wall-clock 1.9 h
- 行為 A27 / 画面 hypotheses / 表 hypotheses measures validations tasks task_handovers ledger_records / 関門 —（画面。外界に出ない（API は関門の先））
- 依存 T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-12
- 根拠（逐語）：D-035「目標とタスクの間に仮説と施策を置く。目標→現状分析→仮説→施策→タスク→検証→次の仮説。効かなかった仮説も残す」 ／ D-063「営業目標の件数・工程・数値・FB・目的を決めるのは運営が作る目標スキル（§30）で、実装ではなくアップロード物。Kana」
- 触るファイル：apps/web/app/(app)/hypotheses/page.tsx (new)、apps/web/tests/screens/hypotheses.spec.ts (new)
- AC（Tier 1）：UBIQUITOUS: 画面 hypotheses は URL /hypotheses で開く（apps/web/app/(app)/hypotheses/pa ／ STATE-DRIVEN: WHILE 画面 hypotheses が描画中 THEN h1「仮説と施策」・第2ナビ 採る候補 / 動いている施策 / タイムラ
- AC（Tier 2）：EVENT-DRIVEN: WHEN PATCH /api/v1/hypotheses/:id が「採る仮説と施策を決める」として呼ばれたとき THEN Kan ／ UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない） ／ EVENT-DRIVEN: WHEN 「採る」を押したとき THEN 対応する endpoint が呼ばれ、別 GET で再取得して画面に反映する
- L1 行 50（['SCR-HYPOTHESES-001', 'SCR-HYPOTHESES-002', 'SCR-HYPOTHESES-003'] …）／ L2 ['J-05']
- audit: 07_tasks/audit/T-U-27.md

### T-U-28 画面 担当業務（6 状態・R1/R2）

- group U-screen / layer ui / phase 5_ui_parallel / wave 22 / Human 22.0 h・AI 2.2 h・wall-clock 2.2 h
- 行為 A28 / 画面 duties / 表 duties duty_versions learned_procedures procedure_steps ai_employees members / 関門 —（画面。外界に出ない（API は関門の先））
- 依存 T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-15
- 根拠（逐語）：D-030「構築メタスキル群は運営の資産で顧客に見えない。会社モデル構築・担当業務の定義・台帳の設計・目標の分解・改善提案・自分のA」 ／ D-022「覚えた操作は担当業務の下に畳む。ユーザーが普段見るのは担当業務まで。飽和させない」
- 触るファイル：apps/web/app/(app)/duties/page.tsx (new)、apps/web/tests/screens/duties.spec.ts (new)
- AC（Tier 1）：UBIQUITOUS: 画面 duties は URL /duties で開く（apps/web/app/(app)/duties/page.tsx。遷移の h ／ STATE-DRIVEN: WHILE 画面 duties が描画中 THEN h1「担当業務」・第2ナビ 担当業務 / 覚えた操作 / 効く範囲 / テストで
- AC（Tier 2）：EVENT-DRIVEN: WHEN PATCH /api/v1/duties/:id が「担当業務を書き換える」として呼ばれたとき THEN Kaname は ／ UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない） ／ EVENT-DRIVEN: WHEN 「保存する」を押したとき THEN 対応する endpoint が呼ばれ、別 GET で再取得して画面に反映する
- L1 行 61（['SCR-DUTIES-001', 'SCR-DUTIES-002', 'SCR-DUTIES-003'] …）／ L2 ['J-05']
- audit: 07_tasks/audit/T-U-28.md

### T-U-29 画面 自分のAIの記憶（5 状態・R1/R2/R3/R4）

- group U-screen / layer ui / phase 5_ui_parallel / wave 22 / Human 22.5 h・AI 2.2 h・wall-clock 2.2 h
- 行為 A30 A93 / 画面 clone-memory / 表 memories clones members memory_proposals / 関門 —（画面。外界に出ない（API は関門の先））
- 依存 T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-17
- 根拠（逐語）：D-060「旧称 COO → クローン → 自分のAI。文書上の用語は「自分のAI」。画面では本人の名前＋AI（高本AI／佐藤AI）」 ／ D-024「主役は会社モデル(Hub)＋ループ。用語と部品の正確な定義。自分のAI（旧称自分のAI／COO）は1人1体」
- 触るファイル：apps/web/app/(app)/ai/memory/page.tsx (new)、apps/web/tests/screens/clone-memory.spec.ts (new)
- AC（Tier 1）：UBIQUITOUS: 画面 clone-memory は URL /ai/memory で開く（apps/web/app/(app)/ai/memory/pa ／ STATE-DRIVEN: WHILE 画面 clone-memory が描画中 THEN h1「高本AIの記憶」・第2ナビ 運営 / 会社 / 層ごと / 個
- AC（Tier 2）：EVENT-DRIVEN: WHEN POST /api/v1/memories が「自分の考え方を教える」として呼ばれたとき THEN Kaname は「記憶 ／ UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない） ／ EVENT-DRIVEN: WHEN PATCH /api/v1/memories/:id が「上がってきた記憶と食い違いを確かめる」として呼ばれたとき THE
- L1 行 106（['SCR-CLONE-MEMORY-001', 'SCR-CLONE-MEMORY-096', 'SCR-CLONE-MEMORY-002'] …）／ L2 ['J-05']
- audit: 07_tasks/audit/T-U-29.md

### T-U-30 画面 台帳の形（3 状態・R1/R2）

- group U-screen / layer ui / phase 5_ui_parallel / wave 22 / Human 14.5 h・AI 1.4 h・wall-clock 1.4 h
- 行為 A44 / 画面 ledger-def / 表 ledger_definitions ledger_fields ledger_stages ledger_views / 関門 —（画面。外界に出ない（API は関門の先））
- 依存 T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-10 T-A-15
- 根拠（逐語）：D-038「台帳は『計算しないが、結果は持つ』。CRM/会計の計算は担わないが結果は台帳に持つ」 ／ D-039「業界別パッケージ(別製品)は作らない。業界別テンプレ(定義のスナップショット)は作る。各企業ごとに専用の会社モデルができ」
- 触るファイル：apps/web/app/(app)/settings/ledgers/page.tsx (new)、apps/web/tests/screens/ledger-def.spec.ts (new)
- AC（Tier 1）：UBIQUITOUS: 画面 ledger-def は URL /settings/ledgers で開く（apps/web/app/(app)/setting ／ STATE-DRIVEN: WHILE 画面 ledger-def が描画中 THEN h1「台帳の形」・第2ナビ 項目 / 段階 / 既存への影響・状態 3（
- AC（Tier 2）：EVENT-DRIVEN: WHEN PATCH /api/v1/ledger_definitions/:id が「止まっている案件を動かす」として呼ばれたとき ／ EVENT-DRIVEN: WHEN PATCH /api/v1/ledger_definitions/:id が「台帳の項目・段階を変える」として呼ばれたとき ／ EVENT-DRIVEN: WHEN 「保存する」を押したとき THEN 対応する endpoint が呼ばれ、別 GET で再取得して画面に反映する
- L1 行 35（['SCR-LEDGER-DEF-001', 'SCR-LEDGER-DEF-002', 'SCR-LEDGER-DEF-003'] …）／ L2 ['J-05']
- audit: 07_tasks/audit/T-U-30.md

### T-U-31 画面 会社モデル（5 状態・R1/R2）

- group U-screen / layer ui / phase 5_ui_parallel / wave 23 / Human 19.5 h・AI 1.9 h・wall-clock 1.9 h
- 行為 A45 / 画面 company-model / 表 tenants goals ledger_definitions duties scopes policies / 関門 —（画面。外界に出ない（API は関門の先））
- 依存 T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-01 T-A-07 T-A-11
- 根拠（逐語）：D-010「製品の背骨。会社モデル(目標・台帳定義・担当業務・組織・ポリシー・記憶)を1つの定義に。画面もAI社員も自動実行もこの定」 ／ D-024「主役は会社モデル(Hub)＋ループ。用語と部品の正確な定義。自分のAI（旧称自分のAI／COO）は1人1体」
- 触るファイル：apps/web/app/(app)/company-model/page.tsx (new)、apps/web/tests/screens/company-model.spec.ts (new)
- AC（Tier 1）：UBIQUITOUS: 画面 company-model は URL /company-model で開く（apps/web/app/(app)/company ／ STATE-DRIVEN: WHILE 画面 company-model が描画中 THEN h1「会社モデル」・第2ナビ 全体 / 版の履歴 / テンプレ・状
- AC（Tier 2）：EVENT-DRIVEN: WHEN GET /api/v1/tenants が「出てきたたたき台を見る」として呼ばれたとき THEN Kaname は「会社モ ／ EVENT-DRIVEN: WHEN GET /api/v1/tenants が「違うところを言う」として呼ばれたとき THEN Kaname は「会社モデルの ／ EVENT-DRIVEN: WHEN 「中身を見る」を押したとき THEN 対応する endpoint が呼ばれ、別 GET で再取得して画面に反映する
- L1 行 45（['SCR-COMPANY-MODEL-001', 'SCR-COMPANY-MODEL-002', 'SCR-COMPANY-MODEL-003'] …）／ L2 ['J-05']
- audit: 07_tasks/audit/T-U-31.md

### T-U-32 画面 覚え直させる（3 状態・R1/R2）

- group U-screen / layer ui / phase 5_ui_parallel / wave 23 / Human 14.5 h・AI 1.4 h・wall-clock 1.4 h
- 行為 A32 / 画面 automation-repair / 表 learned_procedures procedure_steps action_runs sessions error_events / 関門 —（画面。外界に出ない（API は関門の先））
- 依存 T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-07
- 根拠（逐語）：D-018「画面が変わる/毎回要望が違うへの対応は3層。座標でなく意味で記録し、壊れたらAIが覚え直す」 ／ D-014「ブラウザ操作が標準の万能手段。API/MCPは後からの最適化。API主・ブラウザは逃げ道という順序付けは誤りとして撤回」
- 触るファイル：apps/web/app/(app)/automations/[id]/repair/page.tsx (new)、apps/web/tests/screens/automation-repair.spec.ts (new)
- AC（Tier 1）：UBIQUITOUS: 画面 automation-repair は URL /automations/:id/repair で開く（apps/web/app/ ／ STATE-DRIVEN: WHILE 画面 automation-repair が描画中 THEN h1「覚え直させる」・第2ナビ 止まっているもの / 覚え
- AC（Tier 2）：EVENT-DRIVEN: WHEN GET /api/v1/learned_procedures が「何が変わったかを見せて覚え直させる」として呼ばれたとき  ／ UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない） ／ EVENT-DRIVEN: WHEN 「覚え直させる」を押したとき THEN 対応する endpoint が呼ばれ、別 GET で再取得して画面に反映する
- L1 行 36（['SCR-AUTOMATION-REPAIR-001', 'SCR-AUTOMATION-REPAIR-002', 'SCR-AUTOMATION-REPAIR-003'] …）／ L2 ['J-06']
- audit: 07_tasks/audit/T-U-32.md

### T-U-33 画面 証跡（6 状態・R1/R2）

- group U-screen / layer ui / phase 5_ui_parallel / wave 23 / Human 22.0 h・AI 2.2 h・wall-clock 2.2 h
- 行為 A33 A34 A38 A40 A66 / 画面 audit / 表 audit_events ops_audit_events security_events approvals members permissions / 関門 —（画面。外界に出ない（API は関門の先））
- 依存 T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-08 T-A-13 T-A-16
- 根拠（逐語）：D-042「情シス・コンプラが必ず聞くこと。Bridgeで何ができるか完全列挙・送るもの/送らないもの・全操作の証跡を管理者が閲覧エ」 ／ D-012「AIは直接変えない。必ず提案として出し人が承認して反映。ただし動線が増えすぎるUX低下は避ける。プルリクエスト的な形は採」
- 触るファイル：apps/web/app/(app)/audit/page.tsx (new)、apps/web/tests/screens/audit.spec.ts (new)
- AC（Tier 1）：UBIQUITOUS: 画面 audit は URL /audit で開く（apps/web/app/(app)/audit/page.tsx。遷移の href ／ STATE-DRIVEN: WHILE 画面 audit が描画中 THEN h1「証跡」・第2ナビ すべて / 承認 / AIの実行 / 取り消し / 運営の
- AC（Tier 2）：EVENT-DRIVEN: WHEN POST /api/v1/approvals が「全操作の証跡を出す」として呼ばれたとき THEN Kaname は「証跡 ／ UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない） ／ EVENT-DRIVEN: WHEN DELETE /api/v1/approvals/:id が「やってしまったことを取り消す」として呼ばれたとき THEN 
- L1 行 59（['SCR-AUDIT-001', 'SCR-AUDIT-002', 'SCR-AUDIT-003'] …）／ L2 ['J-06', 'J-07', 'J-08']
- audit: 07_tasks/audit/T-U-33.md

### T-U-34 画面 ルール（3 状態・R1/R2/R3/R4）

- group U-screen / layer ui / phase 5_ui_parallel / wave 23 / Human 17.5 h・AI 1.8 h・wall-clock 1.8 h
- 行為 A35 / 画面 policies / 表 policies service_registry service_registry_versions service_requests ai_employees members / 関門 —（画面。外界に出ない（API は関門の先））
- 依存 T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-09
- 根拠（逐語）：D-040「CAPTCHAは突破しない。本人環境・本人資格情報・本人のペースで動くので到達しない。突破は運営の安全ルールで禁止」 ／ D-041「サービス台帳で外部サービスごとの自動操作可否を持つ(api/allowed/unspecified/forbidden/」
- 触るファイル：apps/web/app/(app)/policies/page.tsx (new)、apps/web/tests/screens/policies.spec.ts (new)
- AC（Tier 1）：UBIQUITOUS: 画面 policies は URL /policies で開く（apps/web/app/(app)/policies/page.tsx ／ STATE-DRIVEN: WHILE 画面 policies が描画中 THEN h1「ルール」・第2ナビ 運営 / 会社 / 部署 / 個人・状態 3（ルー
- AC（Tier 2）：EVENT-DRIVEN: WHEN PATCH /api/v1/policies/:id が「やらせる範囲を変える」として呼ばれたとき THEN Kaname ／ UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない） ／ EVENT-DRIVEN: WHEN 「保存する」を押したとき THEN 対応する endpoint が呼ばれ、別 GET で再取得して画面に反映する
- L1 行 43（['SCR-POLICIES-001', 'SCR-POLICIES-002', 'SCR-POLICIES-003'] …）／ L2 ['J-06']
- audit: 07_tasks/audit/T-U-34.md

### T-U-35 画面 メンバー（7 状態・R1/R2）

- group U-screen / layer ui / phase 5_ui_parallel / wave 23 / Human 24.5 h・AI 2.5 h・wall-clock 2.5 h
- 行為 A36 / 画面 members / 表 members permissions layers invitations account_events account_event_items / 関門 —（画面。外界に出ない（API は関門の先））
- 依存 T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-13 T-A-22
- 根拠（逐語）：D-026「スコープ4層(運営/会社/部署/個人)を担当業務・ルール・テンプレ・覚えた操作・記憶すべてに同じ形で使う」 ／ D-002「65社・月630万。エントリー(個人/一人社長3万)・スタンダード(中小8万)・プロ(中堅15万)の3層。エントリーが集」
- 触るファイル：apps/web/app/(app)/members/page.tsx (new)、apps/web/tests/screens/members.spec.ts (new)
- AC（Tier 1）：UBIQUITOUS: 画面 members は URL /members で開く（apps/web/app/(app)/members/page.tsx。遷移 ／ STATE-DRIVEN: WHILE 画面 members が描画中 THEN h1「メンバー」・第2ナビ 組織図 / 一覧と招待 / 層と権限・状態 7（組
- AC（Tier 2）：EVENT-DRIVEN: WHEN PATCH /api/v1/members/:id が「人を招いて見える範囲を決める」として呼ばれたとき THEN Kan ／ EVENT-DRIVEN: WHEN PATCH /api/v1/members/:id が「1人の権限を決める」として呼ばれたとき THEN Kaname は ／ EVENT-DRIVEN: WHEN 「招待する」を押したとき THEN 対応する endpoint が呼ばれ、別 GET で再取得して画面に反映する
- L1 行 88（['SCR-MEMBERS-001', 'SCR-MEMBERS-002', 'SCR-MEMBERS-003'] …）／ L2 ['J-07']
- audit: 07_tasks/audit/T-U-35.md

### T-U-36 画面 AI社員（4 状態・R1/R2）

- group U-screen / layer ui / phase 5_ui_parallel / wave 23 / Human 17.0 h・AI 1.7 h・wall-clock 1.7 h
- 行為 A37 / 画面 ai-staff / 表 ai_employees members duties duty_versions plans plan_versions / 関門 —（画面。外界に出ない（API は関門の先））
- 依存 T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-07 T-A-08 T-A-13
- 根拠（逐語）：D-037「AI社員の出どころは運営配布/会社作成/個人作成の3経路。託されたAI社員は使えるが定義は編集できない。個人ルールだけは」 ／ D-027「テンプレは自動共有しない。運営配布＋各社作成＋明示的な公開のみ。最初の1社のものが自動でテンプレになるという記述は破棄」
- 触るファイル：apps/web/app/(app)/ai-staff/page.tsx (new)、apps/web/tests/screens/ai-staff.spec.ts (new)
- AC（Tier 1）：UBIQUITOUS: 画面 ai-staff は URL /ai-staff で開く（apps/web/app/(app)/ai-staff/page.tsx ／ STATE-DRIVEN: WHILE 画面 ai-staff が描画中 THEN h1「AI社員」・第2ナビ 会社のAI社員 / 託されたAI社員 / 作る・
- AC（Tier 2）：EVENT-DRIVEN: WHEN GET /api/v1/ai_employees が「AI社員を増やす・人に託す」として呼ばれたとき THEN Kanam ／ EVENT-DRIVEN: WHEN GET /api/v1/ai_employees が「このAI社員の中身を見る」として呼ばれたとき THEN Kaname ／ EVENT-DRIVEN: WHEN 「AI社員を作る」を押したとき THEN 対応する endpoint が呼ばれ、別 GET で再取得して画面に反映する
- L1 行 48（['SCR-AI-STAFF-001', 'SCR-AI-STAFF-002', 'SCR-AI-STAFF-003'] …）／ L2 ['J-07']
- audit: 07_tasks/audit/T-U-36.md

### T-U-37 画面 AI社員の1体（5 状態・R1/R2）

- group U-screen / layer ui / phase 5_ui_parallel / wave 23 / Human 19.5 h・AI 1.9 h・wall-clock 1.9 h
- 行為 A46 A81 / 画面 ai-staff-detail / 表 ai_employees members duties duty_versions policies audit_events / 関門 —（画面。外界に出ない（API は関門の先））
- 依存 T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-07 T-A-08 T-A-13
- 根拠（逐語）：D-037「AI社員の出どころは運営配布/会社作成/個人作成の3経路。託されたAI社員は使えるが定義は編集できない。個人ルールだけは」 ／ D-026「スコープ4層(運営/会社/部署/個人)を担当業務・ルール・テンプレ・覚えた操作・記憶すべてに同じ形で使う」
- 触るファイル：apps/web/app/(app)/ai-staff/[id]/page.tsx (new)、apps/web/tests/screens/ai-staff-detail.spec.ts (new)
- AC（Tier 1）：UBIQUITOUS: 画面 ai-staff-detail は URL /ai-staff/:id で開く（apps/web/app/(app)/ai-sta ／ STATE-DRIVEN: WHILE 画面 ai-staff-detail が描画中 THEN h1「AI社員の1体」・第2ナビ やること / 託し先 / 守
- AC（Tier 2）：EVENT-DRIVEN: WHEN GET /api/v1/ai_employees が「AI社員を増やす・人に託す」として呼ばれたとき THEN Kanam ／ EVENT-DRIVEN: WHEN GET /api/v1/ai_employees が「このAI社員の中身を見る」として呼ばれたとき THEN Kaname ／ EVENT-DRIVEN: WHEN PATCH /api/v1/ai_employees/:id が「使えるスキルを見て絞る」として呼ばれたとき THEN K
- L1 行 50（['SCR-AI-STAFF-DETAIL-001', 'SCR-AI-STAFF-DETAIL-002', 'SCR-AI-STAFF-DETAIL-003'] …）／ L2 ['J-07', 'J-09']
- audit: 07_tasks/audit/T-U-37.md

### T-U-38 画面 この製品でできること・できないこと（2 状態・R1/R2）

- group U-screen / layer ui / phase 5_ui_parallel / wave 23 / Human 12.0 h・AI 1.2 h・wall-clock 1.2 h
- 行為 A39 / 画面 security-brief / 表 sessions audit_events ops_audit_events security_events credentials policies / 関門 —（画面。外界に出ない（API は関門の先））
- 依存 T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-16
- 根拠（逐語）：D-042「情シス・コンプラが必ず聞くこと。Bridgeで何ができるか完全列挙・送るもの/送らないもの・全操作の証跡を管理者が閲覧エ」 ／ D-015「Bridgeは顧客PCで動く万能実行器。本人のIP・本人のログイン済みセッションで動くのでCAPTCHA/bot検知に到」
- 触るファイル：apps/web/app/(app)/security/page.tsx (new)、apps/web/tests/screens/security-brief.spec.ts (new)
- AC（Tier 1）：UBIQUITOUS: 画面 security-brief は URL /security で開く（apps/web/app/(app)/security/pa ／ STATE-DRIVEN: WHILE 画面 security-brief が描画中 THEN h1「この製品でできること・できないこと」・第2ナビ できること
- AC（Tier 2）：EVENT-DRIVEN: WHEN GET /api/v1/sessions が「何ができるアプリかを見せる」として呼ばれたとき THEN Kaname は「 ／ UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない） ／ EVENT-DRIVEN: WHEN 「PDFで出す」を押したとき THEN 対応する endpoint が呼ばれ、別 GET で再取得して画面に反映する
- L1 行 33（['SCR-SECURITY-BRIEF-001', 'SCR-SECURITY-BRIEF-002', 'SCR-SECURITY-BRIEF-003'] …）／ L2 ['J-08']
- audit: 07_tasks/audit/T-U-38.md

### T-U-39 画面 持ち出す（2 状態・R1/R2）

- group U-screen / layer ui / phase 5_ui_parallel / wave 23 / Human 12.0 h・AI 1.2 h・wall-clock 1.2 h
- 行為 A41 / 画面 export / 表 export_jobs tenants goals ledger_definitions duties scopes / 関門 —（画面。外界に出ない（API は関門の先））
- 依存 T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-16
- 根拠（逐語）：D-025「編集の3経路。(1)画面で直接編集=人が変える時は即反映(承認を挟まない) (2)AIに頼む(会話)=AIが変える時だけ」 ／ D-050「ポータビリティは3つの仕組みで担保。境界ディレクトリ＋CI検査＋台帳。追跡しなければ『後で移行できる』は必ず嘘になる」
- 触るファイル：apps/web/app/(app)/export/page.tsx (new)、apps/web/tests/screens/export.spec.ts (new)
- AC（Tier 1）：UBIQUITOUS: 画面 export は URL /export で開く（apps/web/app/(app)/export/page.tsx。遷移の h ／ STATE-DRIVEN: WHILE 画面 export が描画中 THEN h1「持ち出す」・第2ナビ 会社モデル / 台帳 / まとめて・状態 2（持ち出
- AC（Tier 2）：EVENT-DRIVEN: WHEN POST /api/v1/export_jobs が「データを全部持ち出す」として呼ばれたとき THEN Kaname は ／ UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない） ／ EVENT-DRIVEN: WHEN 「書き出す」を押したとき THEN 対応する endpoint が呼ばれ、別 GET で再取得して画面に反映する
- L1 行 41（['SCR-EXPORT-001', 'SCR-EXPORT-002', 'SCR-EXPORT-003'] …）／ L2 ['J-08']
- audit: 07_tasks/audit/T-U-39.md

### T-U-40 画面 退会する（6 状態・R1/R2）

- group U-screen / layer ui / phase 5_ui_parallel / wave 23 / Human 22.0 h・AI 2.2 h・wall-clock 2.2 h
- 行為 A42 / 画面 account-close / 表 members permissions layers export_jobs audit_events ops_audit_events / 関門 —（画面。外界に出ない（API は関門の先））
- 依存 T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-13 T-A-16
- 根拠（逐語）：D-042「情シス・コンプラが必ず聞くこと。Bridgeで何ができるか完全列挙・送るもの/送らないもの・全操作の証跡を管理者が閲覧エ」 ／ D-074「人が抜ける（無効化・退会）と会社が退会するときに、flow.json の全オブジェクトで何が起きるかを 1 つの表で決め」
- 触るファイル：apps/web/app/(app)/settings/close/page.tsx (new)、apps/web/tests/screens/account-close.spec.ts (new)
- AC（Tier 1）：UBIQUITOUS: 画面 account-close は URL /settings/close で開く（apps/web/app/(app)/settin ／ STATE-DRIVEN: WHILE 画面 account-close が描画中 THEN h1「退会する」・第2ナビ 依存の確認 / 持ち出す / 退会・状
- AC（Tier 2）：EVENT-DRIVEN: WHEN DELETE /api/v1/members/:id が「退会する」として呼ばれたとき THEN Kaname は「トーク ／ EVENT-DRIVEN: WHEN DELETE /api/v1/members/:id が「抜ける人の依存を片づける」として呼ばれたとき THEN Kana ／ EVENT-DRIVEN: WHEN 「退会する」を押したとき THEN 対応する endpoint が呼ばれ、別 GET で再取得して画面に反映する
- L1 行 50（['SCR-ACCOUNT-CLOSE-001', 'SCR-ACCOUNT-CLOSE-002', 'SCR-ACCOUNT-CLOSE-003'] …）／ L2 ['J-08']
- audit: 07_tasks/audit/T-U-40.md

### T-U-41 画面 運営の支援（2 状態・R6）

- group U-screen / layer ui / phase 5_ui_parallel / wave 24 / Human 10.5 h・AI 1.1 h・wall-clock 1.1 h
- 行為 A43 A70 / 画面 ops-support / 表 inquiries conversations tenants goals ledger_definitions duties / 関門 —（画面。外界に出ない（API は関門の先））
- 依存 T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-19 T-A-21
- 根拠（逐語）：D-030「構築メタスキル群は運営の資産で顧客に見えない。会社モデル構築・担当業務の定義・台帳の設計・目標の分解・改善提案・自分のA」 ／ D-042「情シス・コンプラが必ず聞くこと。Bridgeで何ができるか完全列挙・送るもの/送らないもの・全操作の証跡を管理者が閲覧エ」
- 触るファイル：apps/web/app/(app)/ops/support/page.tsx (new)、apps/web/tests/screens/ops-support.spec.ts (new)
- AC（Tier 1）：UBIQUITOUS: 画面 ops-support は URL /ops/support で開く（apps/web/app/(app)/ops/support ／ STATE-DRIVEN: WHILE 画面 ops-support が描画中 THEN h1「運営の支援」・第2ナビ 受信箱 / 失敗の型 / 返答と対処・状
- AC（Tier 2）：EVENT-DRIVEN: WHEN PATCH /api/v1/inquiries/:id が「顧客のデータを見ずに直す」として呼ばれたとき THEN Kan ／ EVENT-DRIVEN: WHEN PATCH /api/v1/inquiries/:id が「問い合わせに答える」として呼ばれたとき THEN Kaname ／ EVENT-DRIVEN: WHEN 「返答する」を押したとき THEN 対応する endpoint が呼ばれ、別 GET で再取得して画面に反映する
- L1 行 39（['SCR-OPS-SUPPORT-001', 'SCR-OPS-SUPPORT-002', 'SCR-OPS-SUPPORT-003'] …）／ L2 ['J-09']
- audit: 07_tasks/audit/T-U-41.md

### T-U-42 画面 運営：会社の一覧（4 状態・R6）

- group U-screen / layer ui / phase 5_ui_parallel / wave 24 / Human 15.5 h・AI 1.6 h・wall-clock 1.6 h
- 行為 A60 / 画面 ops-home / 表 plans plan_versions subscriptions usage_meters plan_change_requests ai_employees / 関門 —（画面。外界に出ない（API は関門の先））
- 依存 T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-19 T-A-25
- 根拠（逐語）：D-037「AI社員の出どころは運営配布/会社作成/個人作成の3経路。託されたAI社員は使えるが定義は編集できない。個人ルールだけは」 ／ D-030「構築メタスキル群は運営の資産で顧客に見えない。会社モデル構築・担当業務の定義・台帳の設計・目標の分解・改善提案・自分のA」
- 触るファイル：apps/web/app/(app)/ops/page.tsx (new)、apps/web/tests/screens/ops-home.spec.ts (new)
- AC（Tier 1）：UBIQUITOUS: 画面 ops-home は URL /ops で開く（apps/web/app/(app)/ops/page.tsx。遷移の href  ／ STATE-DRIVEN: WHILE 画面 ops-home が描画中 THEN h1「運営：会社の一覧」・第2ナビ 会社の一覧 / 詰まっている / プラン
- AC（Tier 2）：EVENT-DRIVEN: WHEN GET /api/v1/plans が「会社の一覧を見る」として呼ばれたとき THEN Kaname は「各社のプラン・体 ／ UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない） ／ EVENT-DRIVEN: WHEN 「詰まりを開く」を押したとき THEN 対応する endpoint が呼ばれ、別 GET で再取得して画面に反映する
- L1 行 36（['SCR-OPS-HOME-001', 'SCR-OPS-HOME-002', 'SCR-OPS-HOME-003'] …）／ L2 ['J-09']
- audit: 07_tasks/audit/T-U-42.md

### T-U-43 画面 運営：配るもの（7 状態・R6）

- group U-screen / layer ui / phase 5_ui_parallel / wave 24 / Human 23.0 h・AI 2.3 h・wall-clock 2.3 h
- 行為 A59 A79 / 画面 ops-catalog / 表 ai_employees members duties duty_versions policies distributions / 関門 —（画面。外界に出ない（API は関門の先））
- 依存 T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-07 T-A-08 T-A-13
- 根拠（逐語）：D-027「テンプレは自動共有しない。運営配布＋各社作成＋明示的な公開のみ。最初の1社のものが自動でテンプレになるという記述は破棄」 ／ D-037「AI社員の出どころは運営配布/会社作成/個人作成の3経路。託されたAI社員は使えるが定義は編集できない。個人ルールだけは」
- 触るファイル：apps/web/app/(app)/ops/catalog/page.tsx (new)、apps/web/tests/screens/ops-catalog.spec.ts (new)
- AC（Tier 1）：UBIQUITOUS: 画面 ops-catalog は URL /ops/catalog で開く（apps/web/app/(app)/ops/catalog ／ STATE-DRIVEN: WHILE 画面 ops-catalog が描画中 THEN h1「運営：配るもの」・第2ナビ AI社員 / 担当業務 / ルール 
- AC（Tier 2）：EVENT-DRIVEN: WHEN GET /api/v1/ai_employees が「AI社員を増やす・人に託す」として呼ばれたとき THEN Kanam ／ EVENT-DRIVEN: WHEN GET /api/v1/ai_employees が「このAI社員の中身を見る」として呼ばれたとき THEN Kaname ／ EVENT-DRIVEN: WHEN 「版を出す」を押したとき THEN 対応する endpoint が呼ばれ、別 GET で再取得して画面に反映する
- L1 行 38（['SCR-OPS-CATALOG-001', 'SCR-OPS-CATALOG-002', 'SCR-OPS-CATALOG-003'] …）／ L2 ['J-09']
- audit: 07_tasks/audit/T-U-43.md

### T-U-44 画面 自分のアカウント（2 状態・R1/R2/R3/R4）

- group U-screen / layer ui / phase 5_ui_parallel / wave 24 / Human 15.0 h・AI 1.5 h・wall-clock 1.5 h
- 行為 A74 A94 / 画面 account / 表 members permissions layers audit_events ops_audit_events security_events / 関門 —（画面。外界に出ない（API は関門の先））
- 依存 T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-01 T-A-03 T-A-05
- 根拠（逐語）：D-076「全体見直し（01_hearing/全体見直し_20260915.md）の §2・§3・§6 を決定にする。顧客側に 自分」 ／ D-042「情シス・コンプラが必ず聞くこと。Bridgeで何ができるか完全列挙・送るもの/送らないもの・全操作の証跡を管理者が閲覧エ」
- 触るファイル：apps/web/app/(app)/account/page.tsx (new)、apps/web/tests/screens/account.spec.ts (new)
- AC（Tier 1）：UBIQUITOUS: 画面 account は URL /account で開く（apps/web/app/(app)/account/page.tsx。遷移 ／ STATE-DRIVEN: WHILE 画面 account が描画中 THEN h1「自分のアカウント」・第2ナビ 基本 / パスワードと 2 段階認証 / 
- AC（Tier 2）：EVENT-DRIVEN: WHEN GET /api/v1/members が「届いたリンクを押す」として呼ばれたとき THEN Kaname は「本人確認を ／ EVENT-DRIVEN: WHEN GET /api/v1/members が「認証アプリを登録する」として呼ばれたとき THEN Kaname は「TOTP ／ EVENT-DRIVEN: WHEN PATCH /api/v1/members/:id が「人を招いて見える範囲を決める」として呼ばれたとき THEN Kan
- L1 行 53（['SCR-ACCOUNT-001', 'SCR-ACCOUNT-002', 'SCR-ACCOUNT-003'] …）／ L2 ['J-07']
- audit: 07_tasks/audit/T-U-44.md

### T-U-45 画面 会社の設定（2 状態・R1/R2）

- group U-screen / layer ui / phase 5_ui_parallel / wave 24 / Human 12.0 h・AI 1.2 h・wall-clock 1.2 h
- 行為 A75 / 画面 company-settings / 表 tenants goals ledger_definitions duties scopes policies / 関門 —（画面。外界に出ない（API は関門の先））
- 依存 T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-22
- 根拠（逐語）：D-076「全体見直し（01_hearing/全体見直し_20260915.md）の §2・§3・§6 を決定にする。顧客側に 自分」 ／ D-042「情シス・コンプラが必ず聞くこと。Bridgeで何ができるか完全列挙・送るもの/送らないもの・全操作の証跡を管理者が閲覧エ」
- 触るファイル：apps/web/app/(app)/settings/company/page.tsx (new)、apps/web/tests/screens/company-settings.spec.ts (new)
- AC（Tier 1）：UBIQUITOUS: 画面 company-settings は URL /settings/company で開く（apps/web/app/(app)/s ／ STATE-DRIVEN: WHILE 画面 company-settings が描画中 THEN h1「会社の設定」・第2ナビ 会社 / データの所在 / A
- AC（Tier 2）：EVENT-DRIVEN: WHEN PATCH /api/v1/tenants/:id が「会社の設定を決める」として呼ばれたとき THEN Kaname は ／ UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない） ／ EVENT-DRIVEN: WHEN 「保存する」を押したとき THEN 対応する endpoint が呼ばれ、別 GET で再取得して画面に反映する
- L1 行 38（['SCR-COMPANY-SETTINGS-001', 'SCR-COMPANY-SETTINGS-002', 'SCR-COMPANY-SETTINGS-003'] …）／ L2 ['J-07']
- audit: 07_tasks/audit/T-U-45.md

### T-U-46 画面 取り込み（3 状態・R1/R2）

- group U-screen / layer ui / phase 5_ui_parallel / wave 24 / Human 14.5 h・AI 1.4 h・wall-clock 1.4 h
- 行為 A76 / 画面 import / 表 attachments ledger_definitions ledger_views ledger_records clones members / 関門 —（画面。外界に出ない（API は関門の先））
- 依存 T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-22
- 根拠（逐語）：D-076「全体見直し（01_hearing/全体見直し_20260915.md）の §2・§3・§6 を決定にする。顧客側に 自分」 ／ D-029「アップロードは形式を指定しない。何でも受け取ってAIが読む」
- 触るファイル：apps/web/app/(app)/import/page.tsx (new)、apps/web/tests/screens/import.spec.ts (new)
- AC（Tier 1）：UBIQUITOUS: 画面 import は URL /import で開く（apps/web/app/(app)/import/page.tsx。遷移の h ／ STATE-DRIVEN: WHILE 画面 import が描画中 THEN h1「取り込み」・第2ナビ 入れる / 読んだ結果 / 取り込み済み・状態 3（
- AC（Tier 2）：EVENT-DRIVEN: WHEN POST /api/v1/attachments が「取り込む」として呼ばれたとき THEN Kaname は「添付を保存 ／ UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない） ／ EVENT-DRIVEN: WHEN 「取り込む」を押したとき THEN 対応する endpoint が呼ばれ、別 GET で再取得して画面に反映する
- L1 行 38（['SCR-IMPORT-001', 'SCR-IMPORT-002', 'SCR-IMPORT-003'] …）／ L2 ['J-07']
- audit: 07_tasks/audit/T-U-46.md

### T-U-47 画面 外部サービスの連携（3 状態・R1/R2）

- group U-screen / layer ui / phase 5_ui_parallel / wave 24 / Human 14.5 h・AI 1.4 h・wall-clock 1.4 h
- 行為 A77 / 画面 services / 表 service_registry service_registry_versions service_requests credentials sessions action_runs / 関門 —（画面。外界に出ない（API は関門の先））
- 依存 T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-22
- 根拠（逐語）：D-076「全体見直し（01_hearing/全体見直し_20260915.md）の §2・§3・§6 を決定にする。顧客側に 自分」 ／ D-041「サービス台帳で外部サービスごとの自動操作可否を持つ(api/allowed/unspecified/forbidden/」
- 触るファイル：apps/web/app/(app)/services/page.tsx (new)、apps/web/tests/screens/services.spec.ts (new)
- AC（Tier 1）：UBIQUITOUS: 画面 services は URL /services で開く（apps/web/app/(app)/services/page.tsx ／ STATE-DRIVEN: WHILE 画面 services が描画中 THEN h1「外部サービスの連携」・第2ナビ 使っているサービス / 正規連携 / 
- AC（Tier 2）：EVENT-DRIVEN: WHEN POST /api/v1/service_registry が「外部サービスの連携と可否を見る」として呼ばれたとき THE ／ UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない） ／ EVENT-DRIVEN: WHEN 「つなぐ」を押したとき THEN 対応する endpoint が呼ばれ、別 GET で再取得して画面に反映する
- L1 行 34（['SCR-SERVICES-001', 'SCR-SERVICES-002', 'SCR-SERVICES-003'] …）／ L2 ['J-07']
- audit: 07_tasks/audit/T-U-47.md

### T-U-48 画面 運営：サービス台帳（2 状態・R6）

- group U-screen / layer ui / phase 5_ui_parallel / wave 24 / Human 10.5 h・AI 1.1 h・wall-clock 1.1 h
- 行為 A78 / 画面 ops-services / 表 service_registry service_registry_versions service_requests policies / 関門 —（画面。外界に出ない（API は関門の先））
- 依存 T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-23
- 根拠（逐語）：D-076「全体見直し（01_hearing/全体見直し_20260915.md）の §2・§3・§6 を決定にする。顧客側に 自分」 ／ D-041「サービス台帳で外部サービスごとの自動操作可否を持つ(api/allowed/unspecified/forbidden/」
- 触るファイル：apps/web/app/(app)/ops/services/page.tsx (new)、apps/web/tests/screens/ops-services.spec.ts (new)
- AC（Tier 1）：UBIQUITOUS: 画面 ops-services は URL /ops/services で開く（apps/web/app/(app)/ops/servi ／ STATE-DRIVEN: WHILE 画面 ops-services が描画中 THEN h1「運営：サービス台帳」・第2ナビ サービス台帳 / 版の履歴 /
- AC（Tier 2）：EVENT-DRIVEN: WHEN PATCH /api/v1/service_registry_versions/:id が「サービス台帳を更新する」として ／ UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない） ／ EVENT-DRIVEN: WHEN 「版を出す」を押したとき THEN 対応する endpoint が呼ばれ、別 GET で再取得して画面に反映する
- L1 行 30（['SCR-OPS-SERVICES-001', 'SCR-OPS-SERVICES-002', 'SCR-OPS-SERVICES-003'] …）／ L2 ['J-09']
- audit: 07_tasks/audit/T-U-48.md

### T-U-49 画面 運営：スキル（4 状態・R6）

- group U-screen / layer ui / phase 5_ui_parallel / wave 24 / Human 15.5 h・AI 1.6 h・wall-clock 1.6 h
- 行為 A80 / 画面 ops-skills / 表 skills skill_versions skill_test_runs skill_attachments distributions distribution_versions / 関門 —（画面。外界に出ない（API は関門の先））
- 依存 T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-23
- 根拠（逐語）：D-030「構築メタスキル群は運営の資産で顧客に見えない。会社モデル構築・担当業務の定義・台帳の設計・目標の分解・改善提案・自分のA」 ／ D-063「営業目標の件数・工程・数値・FB・目的を決めるのは運営が作る目標スキル（§30）で、実装ではなくアップロード物。Kana」
- 触るファイル：apps/web/app/(app)/ops/skills/page.tsx (new)、apps/web/tests/screens/ops-skills.spec.ts (new)
- AC（Tier 1）：UBIQUITOUS: 画面 ops-skills は URL /ops/skills で開く（apps/web/app/(app)/ops/skills/pa ／ STATE-DRIVEN: WHILE 画面 ops-skills が描画中 THEN h1「運営：スキル」・第2ナビ スキル / 1 つの中身 / アップロー
- AC（Tier 2）：EVENT-DRIVEN: WHEN POST /api/v1/skills が「スキルを構築・アップロード・テストして配る」として呼ばれたとき THEN Ka ／ UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない） ／ EVENT-DRIVEN: WHEN 「版を出す」を押したとき THEN 対応する endpoint が呼ばれ、別 GET で再取得して画面に反映する
- L1 行 47（['SCR-OPS-SKILLS-001', 'SCR-OPS-SKILLS-002', 'SCR-OPS-SKILLS-003'] …）／ L2 ['J-09']
- audit: 07_tasks/audit/T-U-49.md

### T-U-50 画面 問い合わせ（5 状態・R1/R2/R3/R4）

- group U-screen / layer ui / phase 5_ui_parallel / wave 24 / Human 22.5 h・AI 2.2 h・wall-clock 2.2 h
- 行為 A67 / 画面 inquiry / 表 inquiries conversations audit_events ops_audit_events security_events clones / 関門 —（画面。外界に出ない（API は関門の先））
- 依存 T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-20
- 根拠（逐語）：D-075「運営と顧客の間で往復するものは 6 つ（問い合わせ／お知らせと稼働状況／通知の届け先／プランと利用量／請求と入金／セキュ」 ／ D-042「情シス・コンプラが必ず聞くこと。Bridgeで何ができるか完全列挙・送るもの/送らないもの・全操作の証跡を管理者が閲覧エ」
- 触るファイル：apps/web/app/(app)/inquiry/page.tsx (new)、apps/web/tests/screens/inquiry.spec.ts (new)
- AC（Tier 1）：UBIQUITOUS: 画面 inquiry は URL /inquiry で開く（apps/web/app/(app)/inquiry/page.tsx。遷移 ／ STATE-DRIVEN: WHILE 画面 inquiry が描画中 THEN h1「問い合わせ」・第2ナビ 問い合わせる / 返答待ち / 返答あり / 解
- AC（Tier 2）：EVENT-DRIVEN: WHEN GET /api/v1/inquiries が「問い合わせを書く」として呼ばれたとき THEN Kaname は「問い合わ ／ UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない） ／ EVENT-DRIVEN: WHEN 「問い合わせる」を押したとき THEN 対応する endpoint が呼ばれ、別 GET で再取得して画面に反映する
- L1 行 53（['SCR-INQUIRY-001', 'SCR-INQUIRY-002', 'SCR-INQUIRY-003'] …）／ L2 ['J-07']
- audit: 07_tasks/audit/T-U-50.md

### T-U-51 画面 お知らせと通知（3 状態・R1/R2/R3/R4）

- group U-screen / layer ui / phase 5_ui_parallel / wave 25 / Human 17.5 h・AI 1.8 h・wall-clock 1.8 h
- 行為 A68 / 画面 notices / 表 notices notice_deliveries status_incidents notifications notification_preferences / 関門 —（画面。外界に出ない（API は関門の先））
- 依存 T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-20
- 根拠（逐語）：D-075「運営と顧客の間で往復するものは 6 つ（問い合わせ／お知らせと稼働状況／通知の届け先／プランと利用量／請求と入金／セキュ」 ／ D-043「ネイティブアプリはレスポンシブとは別物。プッシュ通知が本質(承認待ちの通知)。段階2でPWA」
- 触るファイル：apps/web/app/(app)/notices/page.tsx (new)、apps/web/tests/screens/notices.spec.ts (new)
- AC（Tier 1）：UBIQUITOUS: 画面 notices は URL /notices で開く（apps/web/app/(app)/notices/page.tsx。遷移 ／ STATE-DRIVEN: WHILE 画面 notices が描画中 THEN h1「お知らせと通知」・第2ナビ お知らせ / 稼働状況 / 通知の届け先・状
- AC（Tier 2）：EVENT-DRIVEN: WHEN PATCH /api/v1/notice_deliveries/:id が「お知らせを読む・通知の届け先を選ぶ」として呼ば ／ UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない） ／ EVENT-DRIVEN: WHEN 「通知の届け先を保存する」を押したとき THEN 対応する endpoint が呼ばれ、別 GET で再取得して画面に反映
- L1 行 45（['SCR-NOTICES-001', 'SCR-NOTICES-002', 'SCR-NOTICES-003'] …）／ L2 ['J-07']
- audit: 07_tasks/audit/T-U-51.md

### T-U-52 画面 プランと請求（3 状態・R1/R2）

- group U-screen / layer ui / phase 5_ui_parallel / wave 25 / Human 14.5 h・AI 1.4 h・wall-clock 1.4 h
- 行為 A69 / 画面 billing / 表 plans plan_versions subscriptions usage_meters plan_change_requests invoices / 関門 —（画面。外界に出ない（API は関門の先））
- 依存 T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-20
- 根拠（逐語）：D-075「運営と顧客の間で往復するものは 6 つ（問い合わせ／お知らせと稼働状況／通知の届け先／プランと利用量／請求と入金／セキュ」 ／ D-002「65社・月630万。エントリー(個人/一人社長3万)・スタンダード(中小8万)・プロ(中堅15万)の3層。エントリーが集」
- 触るファイル：apps/web/app/(app)/billing/page.tsx (new)、apps/web/tests/screens/billing.spec.ts (new)
- AC（Tier 1）：UBIQUITOUS: 画面 billing は URL /billing で開く（apps/web/app/(app)/billing/page.tsx。遷移 ／ STATE-DRIVEN: WHILE 画面 billing が描画中 THEN h1「プランと請求」・第2ナビ プラン / 使った量 / 請求書 / 支払い方
- AC（Tier 2）：EVENT-DRIVEN: WHEN PATCH /api/v1/subscriptions/:id が「プランと請求書を見る」として呼ばれたとき THEN K ／ UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない） ／ EVENT-DRIVEN: WHEN 「プランを変える」を押したとき THEN 対応する endpoint が呼ばれ、別 GET で再取得して画面に反映する
- L1 行 50（['SCR-BILLING-001', 'SCR-BILLING-002', 'SCR-BILLING-003'] …）／ L2 ['J-07']
- audit: 07_tasks/audit/T-U-52.md

### T-U-53 画面 運営：お知らせ（2 状態・R6）

- group U-screen / layer ui / phase 5_ui_parallel / wave 25 / Human 10.5 h・AI 1.1 h・wall-clock 1.1 h
- 行為 A71 / 画面 ops-notices / 表 notices notice_deliveries status_incidents plans plan_versions subscriptions / 関門 —（画面。外界に出ない（API は関門の先））
- 依存 T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-21
- 根拠（逐語）：D-075「運営と顧客の間で往復するものは 6 つ（問い合わせ／お知らせと稼働状況／通知の届け先／プランと利用量／請求と入金／セキュ」 ／ D-077「請求・問い合わせ・配布したもの・証跡・公開審査・お知らせは会社ごとに違う。運営の対応は 会社の 1 社（詳細）の 8 面」
- 触るファイル：apps/web/app/(app)/ops/notices/page.tsx (new)、apps/web/tests/screens/ops-notices.spec.ts (new)
- AC（Tier 1）：UBIQUITOUS: 画面 ops-notices は URL /ops/notices で開く（apps/web/app/(app)/ops/notices ／ STATE-DRIVEN: WHILE 画面 ops-notices が描画中 THEN h1「運営：お知らせ」・第2ナビ 出す / 出したもの / 稼働状況・
- AC（Tier 2）：EVENT-DRIVEN: WHEN POST /api/v1/notices が「お知らせを出す」として呼ばれたとき THEN Kaname は「お知らせ・稼 ／ UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない） ／ EVENT-DRIVEN: WHEN 「出す」を押したとき THEN 対応する endpoint が呼ばれ、別 GET で再取得して画面に反映する
- L1 行 44（['SCR-OPS-NOTICES-001', 'SCR-OPS-NOTICES-002', 'SCR-OPS-NOTICES-003'] …）／ L2 ['J-09']
- audit: 07_tasks/audit/T-U-53.md

### T-U-54 画面 運営：請求と入金（2 状態・R6）

- group U-screen / layer ui / phase 5_ui_parallel / wave 25 / Human 10.5 h・AI 1.1 h・wall-clock 1.1 h
- 行為 A72 A87 / 画面 ops-billing / 表 invoices payments plans plan_versions subscriptions usage_meters / 関門 —（画面。外界に出ない（API は関門の先））
- 依存 T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-21
- 根拠（逐語）：D-075「運営と顧客の間で往復するものは 6 つ（問い合わせ／お知らせと稼働状況／通知の届け先／プランと利用量／請求と入金／セキュ」 ／ D-002「65社・月630万。エントリー(個人/一人社長3万)・スタンダード(中小8万)・プロ(中堅15万)の3層。エントリーが集」
- 触るファイル：apps/web/app/(app)/ops/billing/page.tsx (new)、apps/web/tests/screens/ops-billing.spec.ts (new)
- AC（Tier 1）：UBIQUITOUS: 画面 ops-billing は URL /ops/billing で開く（apps/web/app/(app)/ops/billing ／ STATE-DRIVEN: WHILE 画面 ops-billing が描画中 THEN h1「運営：請求と入金」・第2ナビ 請求と入金 / 未収 / 利用量と
- AC（Tier 2）：EVENT-DRIVEN: WHEN GET /api/v1/invoices が「請求・入金・利用量を見る」として呼ばれたとき THEN Kaname は「各 ／ EVENT-DRIVEN: WHEN GET /api/v1/invoices が「カードの会社の写しを見る」として呼ばれたとき THEN Kaname は「S ／ EVENT-DRIVEN: WHEN 「未収に連絡する」を押したとき THEN 対応する endpoint が呼ばれ、別 GET で再取得して画面に反映する
- L1 行 35（['SCR-OPS-BILLING-001', 'SCR-OPS-BILLING-002', 'SCR-OPS-BILLING-003'] …）／ L2 ['J-09']
- audit: 07_tasks/audit/T-U-54.md

### T-U-55 画面 運営：会社の 1 社（1 状態・R6）

- group U-screen / layer ui / phase 5_ui_parallel / wave 25 / Human 8.0 h・AI 0.8 h・wall-clock 0.8 h
- 行為 A64 / 画面 ops-tenant / 表 plans plan_versions subscriptions usage_meters plan_change_requests ai_employees / 関門 —（画面。外界に出ない（API は関門の先））
- 依存 T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-19 T-A-24
- 根拠（逐語）：D-042「情シス・コンプラが必ず聞くこと。Bridgeで何ができるか完全列挙・送るもの/送らないもの・全操作の証跡を管理者が閲覧エ」 ／ D-037「AI社員の出どころは運営配布/会社作成/個人作成の3経路。託されたAI社員は使えるが定義は編集できない。個人ルールだけは」
- 触るファイル：apps/web/app/(app)/ops/tenants/[id]/page.tsx (new)、apps/web/tests/screens/ops-tenant.spec.ts (new)
- AC（Tier 1）：UBIQUITOUS: 画面 ops-tenant は URL /ops/tenants/:id で開く（apps/web/app/(app)/ops/tena ／ STATE-DRIVEN: WHILE 画面 ops-tenant が描画中 THEN h1「運営：会社の 1 社」・第2ナビ 構成と状態 / 請求と入金 / 
- AC（Tier 2）：EVENT-DRIVEN: WHEN DELETE /api/v1/plans/:id が「会社の 1 社を扱う」として呼ばれたとき THEN Kaname は ／ UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない） ／ EVENT-DRIVEN: WHEN 「対処を送る」を押したとき THEN 対応する endpoint が呼ばれ、別 GET で再取得して画面に反映する
- L1 行 46（['SCR-OPS-TENANT-001', 'SCR-OPS-TENANT-002', 'SCR-OPS-TENANT-003'] …）／ L2 ['J-09']
- audit: 07_tasks/audit/T-U-55.md

### T-U-56 画面 運営：公開の審査（2 状態・R6）

- group U-screen / layer ui / phase 5_ui_parallel / wave 25 / Human 10.5 h・AI 1.1 h・wall-clock 1.1 h
- 行為 A63 / 画面 ops-review / 表 distributions artifacts duties duty_versions audit_events ops_audit_events / 関門 —（画面。外界に出ない（API は関門の先））
- 依存 T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-24
- 根拠（逐語）：D-027「テンプレは自動共有しない。運営配布＋各社作成＋明示的な公開のみ。最初の1社のものが自動でテンプレになるという記述は破棄」 ／ D-073「自分のもの（個人の範囲・自主目標・自分のAIの記憶・自分が作ったAI社員）は権限なしで作る・直す・消す。それ以外は権限の」
- 触るファイル：apps/web/app/(app)/ops/review/page.tsx (new)、apps/web/tests/screens/ops-review.spec.ts (new)
- AC（Tier 1）：UBIQUITOUS: 画面 ops-review は URL /ops/review で開く（apps/web/app/(app)/ops/review/pa ／ STATE-DRIVEN: WHILE 画面 ops-review が描画中 THEN h1「運営：公開の審査」・第2ナビ 審査待ち / 匿名化の確認 / 承認
- AC（Tier 2）：EVENT-DRIVEN: WHEN POST /api/v1/distributions が「公開の申請を審査する」として呼ばれたとき THEN Kaname ／ UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない） ／ EVENT-DRIVEN: WHEN 「承認する」を押したとき THEN 対応する endpoint が呼ばれ、別 GET で再取得して画面に反映する
- L1 行 36（['SCR-OPS-REVIEW-001', 'SCR-OPS-REVIEW-002', 'SCR-OPS-REVIEW-003'] …）／ L2 ['J-09']
- audit: 07_tasks/audit/T-U-56.md

### T-U-57 画面 運営：運営の証跡（2 状態・R6）

- group U-screen / layer ui / phase 5_ui_parallel / wave 25 / Human 10.5 h・AI 1.1 h・wall-clock 1.1 h
- 行為 A65 A73 / 画面 ops-audit / 表 audit_events ops_audit_events security_events members permissions layers / 関門 —（画面。外界に出ない（API は関門の先））
- 依存 T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-08 T-A-13 T-A-21
- 根拠（逐語）：D-042「情シス・コンプラが必ず聞くこと。Bridgeで何ができるか完全列挙・送るもの/送らないもの・全操作の証跡を管理者が閲覧エ」 ／ D-073「自分のもの（個人の範囲・自主目標・自分のAIの記憶・自分が作ったAI社員）は権限なしで作る・直す・消す。それ以外は権限の」
- 触るファイル：apps/web/app/(app)/ops/audit/page.tsx (new)、apps/web/tests/screens/ops-audit.spec.ts (new)
- AC（Tier 1）：UBIQUITOUS: 画面 ops-audit は URL /ops/audit で開く（apps/web/app/(app)/ops/audit/page. ／ STATE-DRIVEN: WHILE 画面 ops-audit が描画中 THEN h1「運営：運営の証跡」・第2ナビ 運営の証跡 / セキュリティの出来事 
- AC（Tier 2）：EVENT-DRIVEN: WHEN GET /api/v1/audit_events が「いつ何をしたかを追う」として呼ばれたとき THEN Kaname は ／ EVENT-DRIVEN: WHEN GET /api/v1/audit_events が「誰が何をしたかを確認する」として呼ばれたとき THEN Kaname ／ EVENT-DRIVEN: WHEN PATCH /api/v1/ops_members/:id が「運営の証跡を見る」として呼ばれたとき THEN Kanam
- L1 行 33（['SCR-OPS-AUDIT-001', 'SCR-OPS-AUDIT-002', 'SCR-OPS-AUDIT-003'] …）／ L2 ['J-09']
- audit: 07_tasks/audit/T-U-57.md

### T-U-58 画面 メンバーの1人（4 状態・R1/R2）

- group U-screen / layer ui / phase 5_ui_parallel / wave 25 / Human 17.0 h・AI 1.7 h・wall-clock 1.7 h
- 行為 A61 A62 / 画面 member-detail / 表 members permissions layers ai_employees account_events account_event_items / 関門 —（画面。外界に出ない（API は関門の先））
- 依存 T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-13 T-A-16 T-A-22
- 根拠（逐語）：D-026「スコープ4層(運営/会社/部署/個人)を担当業務・ルール・テンプレ・覚えた操作・記憶すべてに同じ形で使う」 ／ D-037「AI社員の出どころは運営配布/会社作成/個人作成の3経路。託されたAI社員は使えるが定義は編集できない。個人ルールだけは」
- 触るファイル：apps/web/app/(app)/members/[id]/page.tsx (new)、apps/web/tests/screens/member-detail.spec.ts (new)
- AC（Tier 1）：UBIQUITOUS: 画面 member-detail は URL /members/:id で開く（apps/web/app/(app)/members/[ ／ STATE-DRIVEN: WHILE 画面 member-detail が描画中 THEN h1「メンバーの1人」・第2ナビ 基本 / 権限 / 託されたAI
- AC（Tier 2）：EVENT-DRIVEN: WHEN PATCH /api/v1/members/:id が「人を招いて見える範囲を決める」として呼ばれたとき THEN Kan ／ EVENT-DRIVEN: WHEN PATCH /api/v1/members/:id が「1人の権限を決める」として呼ばれたとき THEN Kaname は ／ EVENT-DRIVEN: WHEN DELETE /api/v1/members/:id が「退会する」として呼ばれたとき THEN Kaname は「トーク
- L1 行 71（['SCR-MEMBER-DETAIL-001', 'SCR-MEMBER-DETAIL-002', 'SCR-MEMBER-DETAIL-003'] …）／ L2 ['J-07']
- audit: 07_tasks/audit/T-U-58.md

### T-U-59 画面 支払い方法を登録する（4 状態・R1/R2・段階 2）

- group U-screen / layer ui / phase 9_v2_ui / wave 33 / Human 17.0 h・AI 1.7 h・wall-clock 1.7 h
- 行為 A05 / 画面 billing-setup / 表 plans plan_versions subscriptions usage_meters plan_change_requests payment_methods / 関門 —（画面。外界に出ない（API は関門の先））
- 依存 T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-01
- 根拠（逐語）：D-002「65社・月630万。エントリー(個人/一人社長3万)・スタンダード(中小8万)・プロ(中堅15万)の3層。エントリーが集」 ／ D-081「サマリーの段階表（段階 2＝課金・オンボーディング・構築メタスキル・運営コンソール）は D-073〜D-080 で v1」
- 触るファイル：apps/web/app/(public)/billing-setup/page.tsx (new)、apps/web/tests/screens/billing-setup.spec.ts (new)
- AC（Tier 1）：UBIQUITOUS: 画面 billing-setup は URL /billing-setup で開く（apps/web/app/(public)/bill ／ STATE-DRIVEN: WHILE 画面 billing-setup が描画中 THEN h1「支払い方法を登録する」・第2ナビ ・状態 4（登録、登録でき
- AC（Tier 2）：EVENT-DRIVEN: WHEN POST /api/v1/subscriptions が「会社名とメールを入れる」として呼ばれたとき THEN Kanam ／ EVENT-DRIVEN: WHEN POST /api/v1/subscriptions が「プランを選んで Stripe の登録画面へ進む」として呼ばれたと ／ EVENT-DRIVEN: WHEN 「登録する」を押したとき THEN 対応する endpoint が呼ばれ、別 GET で再取得して画面に反映する
- L1 行 37（['SCR-BILLING-SETUP-001', 'SCR-BILLING-SETUP-002', 'SCR-BILLING-SETUP-003'] …）／ L2 —
- audit: 07_tasks/audit/T-U-59.md

### T-U-60 画面 開示資料（4 状態・R1/R2・段階 2）

- group U-screen / layer ui / phase 9_v2_ui / wave 33 / Human 17.0 h・AI 1.7 h・wall-clock 1.7 h
- 行為 A84 / 画面 disclosure / 表 disclosure_versions subprocessors audit_events ops_audit_events security_events / 関門 —（画面。外界に出ない（API は関門の先））
- 依存 T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-26
- 根拠（逐語）：D-081「サマリーの段階表（段階 2＝課金・オンボーディング・構築メタスキル・運営コンソール）は D-073〜D-080 で v1」 ／ D-085「できる操作の完全な列挙・送るもの／送らないもの・サブプロセッサ一覧・アンインストールの検証結果 は成果物（行為×関門・依」
- 触るファイル：apps/web/app/(app)/security/disclosure/page.tsx (new)、apps/web/tests/screens/disclosure.spec.ts (new)
- AC（Tier 1）：UBIQUITOUS: 画面 disclosure は URL /security/disclosure で開く（apps/web/app/(app)/secu ／ STATE-DRIVEN: WHILE 画面 disclosure が描画中 THEN h1「開示資料」・第2ナビ できる操作 / 送るもの／送らないもの / 
- AC（Tier 2）：EVENT-DRIVEN: WHEN GET /api/v1/disclosure_versions が「開示資料を開いて PDF をもらう」として呼ばれたとき ／ UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない） ／ EVENT-DRIVEN: WHEN 「PDF で出す」を押したとき THEN 対応する endpoint が呼ばれ、別 GET で再取得して画面に反映する
- L1 行 37（['SCR-DISCLOSURE-001', 'SCR-DISCLOSURE-002', 'SCR-DISCLOSURE-003'] …）／ L2 —
- audit: 07_tasks/audit/T-U-60.md

### T-U-61 画面 AI の経路（4 状態・R1/R2・段階 2）

- group U-screen / layer ui / phase 9_v2_ui / wave 33 / Human 17.0 h・AI 1.7 h・wall-clock 1.7 h
- 行為 A82 / 画面 llm-routes / 表 llm_routes credentials llm_capabilities / 関門 —（画面。外界に出ない（API は関門の先））
- 依存 T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-28
- 根拠（逐語）：D-081「サマリーの段階表（段階 2＝課金・オンボーディング・構築メタスキル・運営コンソール）は D-073〜D-080 で v1」 ／ D-083「段階 2 で足す経路は BYOK（顧客の API キー）と運営マネージド（運営のキー・既定 OFF）。提供者は Anth」
- 触るファイル：apps/web/app/(app)/settings/llm/page.tsx (new)、apps/web/tests/screens/llm-routes.spec.ts (new)
- AC（Tier 1）：UBIQUITOUS: 画面 llm-routes は URL /settings/llm で開く（apps/web/app/(app)/settings/ll ／ STATE-DRIVEN: WHILE 画面 llm-routes が描画中 THEN h1「AI の経路」・第2ナビ 既定の経路 / PC が閉じているとき 
- AC（Tier 2）：EVENT-DRIVEN: WHEN POST /api/v1/llm_routes が「会社の設定で AI の経路を選び、必要ならキーを入れる」として呼ばれた ／ UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない） ／ EVENT-DRIVEN: WHEN 「保存する」を押したとき THEN 対応する endpoint が呼ばれ、別 GET で再取得して画面に反映する
- L1 行 54（['SCR-LLM-ROUTES-001', 'SCR-LLM-ROUTES-002', 'SCR-LLM-ROUTES-003'] …）／ L2 —
- audit: 07_tasks/audit/T-U-61.md

### T-U-62 画面 アプリと通知（3 状態・R1/R2/R3/R4・段階 2）

- group U-screen / layer ui / phase 9_v2_ui / wave 33 / Human 17.5 h・AI 1.8 h・wall-clock 1.8 h
- 行為 A83 / 画面 app-setup / 表 push_devices sessions notifications notification_preferences notice_deliveries / 関門 —（画面。外界に出ない（API は関門の先））
- 依存 T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-28
- 根拠（逐語）：D-081「サマリーの段階表（段階 2＝課金・オンボーディング・構築メタスキル・運営コンソール）は D-073〜D-080 で v1」 ／ D-084「PC は Bridge（Electron）の窓に Kaname の画面を出す。スマホは同じ Web を Capacito」
- 触るファイル：apps/web/app/(app)/settings/app/page.tsx (new)、apps/web/tests/screens/app-setup.spec.ts (new)
- AC（Tier 1）：UBIQUITOUS: 画面 app-setup は URL /settings/app で開く（apps/web/app/(app)/settings/app ／ STATE-DRIVEN: WHILE 画面 app-setup が描画中 THEN h1「アプリと通知」・第2ナビ PC / スマホ / 通知・状態 3（アプ
- AC（Tier 2）：EVENT-DRIVEN: WHEN PATCH /api/v1/push_devices/:id が「アプリを入れて通知を許可する」として呼ばれたとき THE ／ UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない） ／ EVENT-DRIVEN: WHEN 「通知を許可する」を押したとき THEN 対応する endpoint が呼ばれ、別 GET で再取得して画面に反映する
- L1 行 41（['SCR-APP-SETUP-001', 'SCR-APP-SETUP-002', 'SCR-APP-SETUP-003'] …）／ L2 —
- audit: 07_tasks/audit/T-U-62.md

### T-U-63 画面 運営：AI の経路と使用量（3 状態・R6・段階 2）

- group U-screen / layer ui / phase 9_v2_ui / wave 33 / Human 13.0 h・AI 1.3 h・wall-clock 1.3 h
- 行為 A85 / 画面 ops-llm / 表 llm_routes invoices payments / 関門 —（画面。外界に出ない（API は関門の先））
- 依存 T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-27
- 根拠（逐語）：D-083「段階 2 で足す経路は BYOK（顧客の API キー）と運営マネージド（運営のキー・既定 OFF）。提供者は Anth」
- 触るファイル：apps/web/app/(app)/ops/llm/page.tsx (new)、apps/web/tests/screens/ops-llm.spec.ts (new)
- AC（Tier 1）：UBIQUITOUS: 画面 ops-llm は URL /ops/llm で開く（apps/web/app/(app)/ops/llm/page.tsx。遷移 ／ STATE-DRIVEN: WHILE 画面 ops-llm が描画中 THEN h1「運営：AI の経路と使用量」・第2ナビ 許可 / 使用量 / 費用・状態
- AC（Tier 2）：EVENT-DRIVEN: WHEN PATCH /api/v1/llm_routes/:id が「会社の詳細で運営マネージドを許可する」として呼ばれたとき T ／ UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない） ／ EVENT-DRIVEN: WHEN 「許可する」を押したとき THEN 対応する endpoint が呼ばれ、別 GET で再取得して画面に反映する
- L1 行 22（['SCR-OPS-LLM-001', 'SCR-OPS-LLM-002', 'SCR-OPS-LLM-003'] …）／ L2 —
- audit: 07_tasks/audit/T-U-63.md

### T-U-64 画面 運営：開示資料（3 状態・R6・段階 2）

- group U-screen / layer ui / phase 9_v2_ui / wave 33 / Human 13.0 h・AI 1.3 h・wall-clock 1.3 h
- 行為 A86 / 画面 ops-disclosure / 表 disclosure_versions subprocessors notices notice_deliveries status_incidents / 関門 —（画面。外界に出ない（API は関門の先））
- 依存 T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-27
- 根拠（逐語）：D-085「できる操作の完全な列挙・送るもの／送らないもの・サブプロセッサ一覧・アンインストールの検証結果 は成果物（行為×関門・依」
- 触るファイル：apps/web/app/(app)/ops/disclosure/page.tsx (new)、apps/web/tests/screens/ops-disclosure.spec.ts (new)
- AC（Tier 1）：UBIQUITOUS: 画面 ops-disclosure は URL /ops/disclosure で開く（apps/web/app/(app)/ops/d ／ STATE-DRIVEN: WHILE 画面 ops-disclosure が描画中 THEN h1「運営：開示資料」・第2ナビ 版 / DPA の雛形 / サ
- AC（Tier 2）：EVENT-DRIVEN: WHEN PATCH /api/v1/disclosure_versions/:id が「版を出す・DPA の雛形とサブプロセッサを ／ UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない） ／ EVENT-DRIVEN: WHEN 「版を出す」を押したとき THEN 対応する endpoint が呼ばれ、別 GET で再取得して画面に反映する
- L1 行 33（['SCR-OPS-DISCLOSURE-001', 'SCR-OPS-DISCLOSURE-002', 'SCR-OPS-DISCLOSURE-003'] …）／ L2 —
- audit: 07_tasks/audit/T-U-64.md

### T-I-01 実行ループの結線（自分のAI → 配る → AI社員 action_runs → 関門 → 一次確認 → 承認待ち → 画面）

- group I / layer integration / phase 6_integration / wave 26 / Human 32 h・AI 8.0 h・wall-clock 9.0 h
- 行為 — / 画面 — / 表 — / 関門 —（結線・横断試験（部品の関門をそのまま使う））
- 依存 T-A-04 T-A-05 T-A-06 T-A-08 T-A-09 T-A-10 T-A-11 T-A-13 T-A-14 T-A-17
- 根拠（逐語）：D-010「製品の背骨。会社モデル(目標・台帳定義・担当業務・組織・ポリシー・記憶)を1つの定義に。画面もAI社員も自動実行もこの定」 ／ D-012「AIは直接変えない。必ず提案として出し人が承認して反映。ただし動線が増えすぎるUX低下は避ける。プルリクエスト的な形は採」
- 触るファイル：apps/e2e/f-v3-d-01.spec.ts (new)
- AC（Tier 1）：
- AC（Tier 2）：EVENT-DRIVEN: WHEN 自分のAIに「請求書を作って」と言ったとき THEN AI社員が動き、一次確認を経て承認待ちに実データで並び、承認すると外 ／ UNWANTED: IF Bridge が切れているなら、実行は止まり「AI は止まっています」が出て、承認待ちは失われない
- L1 行 7（['INT-01-001', 'INT-01-002', 'INT-01-003'] …）／ L2 —
- audit: 07_tasks/audit/T-I-01.md

### T-I-02 認証 → 会社 → 権限 → 画面の解禁（login → sessions → SET LOCAL → RLS → 役割ごとの画

- group I / layer integration / phase 6_integration / wave 26 / Human 20 h・AI 5.0 h・wall-clock 6.0 h
- 行為 — / 画面 — / 表 — / 関門 —（結線・横断試験（部品の関門をそのまま使う））
- 依存 T-F-02 T-F-03 T-F-05 T-F-06 T-U-01 T-U-03 T-U-04 T-U-05 T-U-13
- 根拠（逐語）：D-073「自分のもの（個人の範囲・自主目標・自分のAIの記憶・自分が作ったAI社員）は権限なしで作る・直す・消す。それ以外は権限の」 ／ D-058「目標の層は可変（会社＞事業＞部署＞…＞個人＞AI社員）で、必ずログイン中の個人まで落とす。個人の層は本人が画面で管理する」
- 触るファイル：apps/e2e/f-v3-d-02.spec.ts (new)
- AC（Tier 1）：
- AC（Tier 2）：EVENT-DRIVEN: WHEN 担当者でログインしたとき THEN 会社の数字が出ず、配られた分と本人のものだけが出る ／ UNWANTED: IF 退会・停止・権限変更・パスワード変更の直後なら、既存のセッションと Bridge は 0 秒で 401 になる
- L1 行 7（['INT-02-001', 'INT-02-002', 'INT-02-003'] …）／ L2 —
- audit: 07_tasks/audit/T-I-02.md

### T-I-03 画面 → API → DB の通し配線（契約テスト・型生成同期・endpoint 実在性・別 GET で再取得）

- group I / layer integration / phase 6_integration / wave 26 / Human 24 h・AI 2.4 h・wall-clock 2.4 h
- 行為 — / 画面 — / 表 — / 関門 —（結線・横断試験（部品の関門をそのまま使う））
- 依存 T-F-15 T-U-01 T-U-02 T-U-03 T-U-04 T-U-05 T-U-06 T-U-07 T-U-08 T-U-09
- 根拠（逐語）：D-043「ネイティブアプリはレスポンシブとは別物。プッシュ通知が本質(承認待ちの通知)。段階2でPWA」 ／ D-053「画面は行為から導出する。画面から始めると『この画面で何をしたいか分からない』が必ず起きる。役割×用事→行為の背骨→オブジ」
- 触るファイル：apps/e2e/f-v3-d-03.spec.ts (new)
- AC（Tier 1）：
- AC（Tier 2）：UBIQUITOUS: 全画面の required_apis は実在の endpoint を呼び、書き込みは別 GET で再取得して反映する（G-03・G-06 ／ UNWANTED: IF モックの値（—・ダミー）が実データでも固定なら、その列は未実装として落とす（G-07）
- L1 行 7（['INT-03-001', 'INT-03-002', 'INT-03-003'] …）／ L2 —
- audit: 07_tasks/audit/T-I-03.md

### T-I-04 運営 ↔ 顧客の往復（問い合わせ → 受信箱 → 会社の詳細で返答 → 顧客の問い合わせに届く／お知らせ → 配達 → 既読）

- group I / layer integration / phase 6_integration / wave 26 / Human 20 h・AI 2.0 h・wall-clock 2.0 h
- 行為 — / 画面 — / 表 — / 関門 —（結線・横断試験（部品の関門をそのまま使う））
- 依存 T-A-19 T-A-20 T-A-21 T-A-24 T-A-27 T-F-12 T-U-41 T-U-50 T-U-51 T-U-53
- 根拠（逐語）：D-075「運営と顧客の間で往復するものは 6 つ（問い合わせ／お知らせと稼働状況／通知の届け先／プランと利用量／請求と入金／セキュ」 ／ D-077「請求・問い合わせ・配布したもの・証跡・公開審査・お知らせは会社ごとに違う。運営の対応は 会社の 1 社（詳細）の 8 面」
- 触るファイル：apps/e2e/f-v3-d-04.spec.ts (new)
- AC（Tier 1）：
- AC（Tier 2）：EVENT-DRIVEN: WHEN 運営が会社の詳細で返答したとき THEN 顧客の問い合わせに届き、両方の証跡に残り、通知の届け先に従って知らせる ／ UNWANTED: IF 運営が許可の無い会社の台帳を読もうとしたら 403 で、その試みが運営の証跡に残る
- L1 行 7（['INT-04-001', 'INT-04-002', 'INT-04-003'] …）／ L2 —
- audit: 07_tasks/audit/T-I-04.md

### T-I-05 出来事の依存処理 → 全失効（人が抜ける・退会・休止・権限変更・プラン変更・層を消す・AI社員を消す）

- group I / layer integration / phase 6_integration / wave 26 / Human 28 h・AI 7.0 h・wall-clock 8.0 h
- 行為 — / 画面 — / 表 — / 関門 —（結線・横断試験（部品の関門をそのまま使う））
- 依存 T-A-13 T-A-14 T-A-16 T-A-20 T-A-26 T-F-04 T-F-05 T-F-06 T-U-35 T-U-37
- 根拠（逐語）：D-074「人が抜ける（無効化・退会）と会社が退会するときに、flow.json の全オブジェクトで何が起きるかを 1 つの表で決め」 ／ D-076「全体見直し（01_hearing/全体見直し_20260915.md）の §2・§3・§6 を決定にする。顧客側に 自分」
- 触るファイル：apps/e2e/f-v3-d-05.spec.ts (new)
- AC（Tier 1）：
- AC（Tier 2）：EVENT-DRIVEN: WHEN 担当者を無効にしたとき THEN 引き継ぎ先が未決なら止まり、決めたら タスク・承認・AI社員・長 が表どおりに動き、本人 ／ UNWANTED: IF 退会の猶予中に自動実行の要求が来たら、外には出ず止まる
- L1 行 7（['INT-05-001', 'INT-05-002', 'INT-05-003'] …）／ L2 —
- audit: 07_tasks/audit/T-I-05.md

### T-I-06 スキルの配布 → 装着 → Bridge が読む → どのスキルが働いたかが証跡に出る

- group I / layer integration / phase 6_integration / wave 26 / Human 20 h・AI 2.0 h・wall-clock 2.0 h
- 行為 — / 画面 — / 表 — / 関門 —（結線・横断試験（部品の関門をそのまま使う））
- 依存 T-A-13 T-A-14 T-A-23 T-A-25 T-F-09 T-F-10 T-U-18 T-U-22 T-U-37 T-U-49
- 根拠（逐語）：D-078「§30（構築メタスキル群）と §63（目標スキル）は決めたのに、運営がスキルを構築・アップロード・テスト・版管理・配布し」
- 触るファイル：apps/e2e/f-v3-d-06.spec.ts (new)
- AC（Tier 1）：
- AC（Tier 2）：EVENT-DRIVEN: WHEN 運営がテスト通過の版を出したとき THEN 配布先の会社の AI社員は次の実行からその版で動き、動きと証跡に版が出る ／ UNWANTED: IF 会社の権限者が外したスキルなら、その AI社員では働かない
- L1 行 7（['INT-06-001', 'INT-06-002', 'INT-06-003'] …）／ L2 —
- audit: 07_tasks/audit/T-I-06.md

### T-I-07 通知の結線（出来事 → 届け先 → outbox → 配達 → 既読・失敗時の再送）

- group I / layer integration / phase 6_integration / wave 26 / Human 12 h・AI 1.2 h・wall-clock 1.2 h
- 行為 — / 画面 — / 表 — / 関門 —（結線・横断試験（部品の関門をそのまま使う））
- 依存 T-A-08 T-A-09 T-A-20 T-A-21 T-A-27 T-F-12 T-U-13 T-U-51
- 根拠（逐語）：D-043「ネイティブアプリはレスポンシブとは別物。プッシュ通知が本質(承認待ちの通知)。段階2でPWA」 ／ D-075「運営と顧客の間で往復するものは 6 つ（問い合わせ／お知らせと稼働状況／通知の届け先／プランと利用量／請求と入金／セキュ」
- 触るファイル：apps/e2e/f-v3-d-07.spec.ts (new)
- AC（Tier 1）：
- AC（Tier 2）：EVENT-DRIVEN: WHEN 承認待ちが来たとき THEN 届け先に従ってアプリ内とメールに 1 回だけ届く（dedupe_key） ／ UNWANTED: IF 送出に失敗したら再送し、証跡に残す。二重には送らない
- L1 行 7（['INT-07-001', 'INT-07-002', 'INT-07-003'] …）／ L2 —
- audit: 07_tasks/audit/T-I-07.md

### T-I-08 課金の結線（プラン → 契約 → 月次の請求書 → 入金の記録 → 未収 → 休止の案内）

- group I / layer integration / phase 6_integration / wave 26 / Human 16 h・AI 4.0 h・wall-clock 5.0 h
- 行為 — / 画面 — / 表 — / 関門 —（結線・横断試験（部品の関門をそのまま使う））
- 依存 T-A-20 T-A-21 T-A-23 T-A-27 T-F-10 T-F-13 T-U-52 T-U-54 T-U-55
- 根拠（逐語）：D-075「運営と顧客の間で往復するものは 6 つ（問い合わせ／お知らせと稼働状況／通知の届け先／プランと利用量／請求と入金／セキュ」 ／ D-077「請求・問い合わせ・配布したもの・証跡・公開審査・お知らせは会社ごとに違う。運営の対応は 会社の 1 社（詳細）の 8 面」
- 触るファイル：apps/e2e/f-v3-d-08.spec.ts (new)
- AC（Tier 1）：
- AC（Tier 2）：EVENT-DRIVEN: WHEN 月初になったとき THEN 全社の請求書が発行され PDF が出て、会社側の請求書に並ぶ ／ UNWANTED: IF 未収が 30 日を超えたら休止の案内が出て、休止中は AI社員と自動実行だけ止まりデータは残る
- L1 行 7（['INT-08-001', 'INT-08-002', 'INT-08-003'] …）／ L2 —
- audit: 07_tasks/audit/T-I-08.md

### T-I-09 流れ J-01 P0 契約・登録（1回だけ） を最後まで通す（L2）

- group I / layer integration / phase 6_integration / wave 26 / Human 14 h・AI 1.4 h・wall-clock 1.4 h
- 行為 — / 画面 — / 表 — / 関門 —（結線・横断試験（部品の関門をそのまま使う））
- 依存 T-A-01 T-A-02 T-A-16 T-A-26 T-U-01 T-U-02 T-U-03 T-U-04
- 根拠（逐語）：D-001「2028-09までに200社→65社に修正。自社SaaS外販。初期顧客が自力で回せることが前提」 ／ D-002「65社・月630万。エントリー(個人/一人社長3万)・スタンダード(中小8万)・プロ(中堅15万)の3層。エントリーが集」
- 触るファイル：apps/e2e/f-v3-d-e2e-01.spec.ts (new)
- AC（Tier 1）：
- AC（Tier 2）：EVENT-DRIVEN: WHEN R1／R2／R3／R4 が A01 から A04 まで順に操作したとき THEN A04: TOTPシークレットを暗号化保 ／ UNWANTED: IF 途中の行為で止まったら、次の行為に進めず、止まった理由が画面と証跡に出る
- L1 行 2（['INT-09-001', 'INT-09-002'] …）／ L2 ['J-01']
- audit: 07_tasks/audit/T-I-09.md

### T-I-10 流れ J-02 P1 はじめの設定 ── PCをつないで、自分のAIと作る（初日〜3日） を最後まで通す（L2）

- group I / layer integration / phase 6_integration / wave 26 / Human 20 h・AI 2.0 h・wall-clock 2.0 h
- 行為 — / 画面 — / 表 — / 関門 —（結線・横断試験（部品の関門をそのまま使う））
- 依存 T-A-01 T-A-07 T-A-08 T-A-09 T-A-17 T-A-18 T-U-07 T-U-08 T-U-09 T-U-10
- 根拠（逐語）：D-003「スキルは堀ではない。堀は『閉じたループ』(目標→逆算→配布→実行→測定→再計画)と会社モデル」 ／ D-004「LLMは顧客のサブスク内(Bridge)が既定。APIは顧客負担。運営マネージドは既定OFFの管理者トグル」
- 触るファイル：apps/e2e/f-v3-d-e2e-02.spec.ts (new)
- AC（Tier 1）：
- AC（Tier 2）：EVENT-DRIVEN: WHEN R1／R2 が A09 から A12 まで順に操作したとき THEN A12: 会社モデルを確定、自動実行を有効化 ／ UNWANTED: IF 途中の行為で止まったら、次の行為に進めず、止まった理由が画面と証跡に出る
- L1 行 2（['INT-10-001', 'INT-10-002'] …）／ L2 ['J-02']
- audit: 07_tasks/audit/T-I-10.md

### T-I-11 流れ J-03 P2 毎日 ── 自分のAIと回す を最後まで通す（L2）

- group I / layer integration / phase 6_integration / wave 27 / Human 52 h・AI 5.2 h・wall-clock 5.2 h
- 行為 — / 画面 — / 表 — / 関門 —（結線・横断試験（部品の関門をそのまま使う））
- 依存 T-A-04 T-A-05 T-A-06 T-A-08 T-A-09 T-A-10 T-A-11 T-A-13 T-A-14 T-A-17
- 根拠（逐語）：D-003「スキルは堀ではない。堀は『閉じたループ』(目標→逆算→配布→実行→測定→再計画)と会社モデル」 ／ D-007「数値はAI社員が会話で出す。分析系の固定画面(ランキング・チャネル別・期間比較)を一切作らない」
- 触るファイル：apps/e2e/f-v3-d-e2e-03.spec.ts (new)
- AC（Tier 1）：
- AC（Tier 2）：EVENT-DRIVEN: WHEN R1／R2／R3／R4 が A13 から A21 まで順に操作したとき THEN A17: タスクの状態を更新し、目標の実 ／ UNWANTED: IF 途中の行為で止まったら、次の行為に進めず、止まった理由が画面と証跡に出る
- L1 行 2（['INT-11-001', 'INT-11-002'] …）／ L2 ['J-03']
- audit: 07_tasks/audit/T-I-11.md

### T-I-12 流れ J-04 P3 毎週 を最後まで通す（L2）

- group I / layer integration / phase 6_integration / wave 27 / Human 18 h・AI 1.8 h・wall-clock 1.8 h
- 行為 — / 画面 — / 表 — / 関門 —（結線・横断試験（部品の関門をそのまま使う））
- 依存 T-A-04 T-A-05 T-A-06 T-A-10 T-A-11 T-A-12 T-U-20 T-U-22 T-U-23 T-U-25
- 根拠（逐語）：D-002「65社・月630万。エントリー(個人/一人社長3万)・スタンダード(中小8万)・プロ(中堅15万)の3層。エントリーが集」 ／ D-003「スキルは堀ではない。堀は『閉じたループ』(目標→逆算→配布→実行→測定→再計画)と会社モデル」
- 触るファイル：apps/e2e/f-v3-d-e2e-04.spec.ts (new)
- AC（Tier 1）：
- AC（Tier 2）：EVENT-DRIVEN: WHEN R1／R2／R3／R4 が A22 から A49 まで順に操作したとき THEN A49: 個人層の目標を保存（本人は即反 ／ UNWANTED: IF 途中の行為で止まったら、次の行為に進めず、止まった理由が画面と証跡に出る
- L1 行 2（['INT-12-001', 'INT-12-002'] …）／ L2 ['J-04']
- audit: 07_tasks/audit/T-I-12.md

### T-I-13 流れ J-05 P4 毎月・四半期 を最後まで通す（L2）

- group I / layer integration / phase 6_integration / wave 27 / Human 24 h・AI 2.4 h・wall-clock 2.4 h
- 行為 — / 画面 — / 表 — / 関門 —（結線・横断試験（部品の関門をそのまま使う））
- 依存 T-A-10 T-A-11 T-A-12 T-A-15 T-A-17 T-A-18 T-U-24 T-U-26 T-U-27 T-U-28
- 根拠（逐語）：D-003「スキルは堀ではない。堀は『閉じたループ』(目標→逆算→配布→実行→測定→再計画)と会社モデル」 ／ D-006「スコープの採否は『抜いてもループが閉じるか』。CRM・請求・経理を切ると目標の数値が出せなくなるので切らない」
- 触るファイル：apps/e2e/f-v3-d-e2e-05.spec.ts (new)
- AC（Tier 1）：
- AC（Tier 2）：EVENT-DRIVEN: WHEN R1／R2／R3／R4 が A26 から A45 まで順に操作したとき THEN A44: 台帳の定義を版で更新 ／ UNWANTED: IF 途中の行為で止まったら、次の行為に進めず、止まった理由が画面と証跡に出る
- L1 行 2（['INT-13-001', 'INT-13-002'] …）／ L2 ['J-05']
- audit: 07_tasks/audit/T-I-13.md

### T-I-14 流れ J-06 P5 例外・困ったとき を最後まで通す（L2）

- group I / layer integration / phase 6_integration / wave 27 / Human 16 h・AI 1.6 h・wall-clock 1.6 h
- 行為 — / 画面 — / 表 — / 関門 —（結線・横断試験（部品の関門をそのまま使う））
- 依存 T-A-03 T-A-07 T-A-08 T-A-09 T-U-06 T-U-32 T-U-33 T-U-34
- 根拠（逐語）：D-003「スキルは堀ではない。堀は『閉じたループ』(目標→逆算→配布→実行→測定→再計画)と会社モデル」 ／ D-012「AIは直接変えない。必ず提案として出し人が承認して反映。ただし動線が増えすぎるUX低下は避ける。プルリクエスト的な形は採」
- 触るファイル：apps/e2e/f-v3-d-e2e-06.spec.ts (new)
- AC（Tier 1）：
- AC（Tier 2）：EVENT-DRIVEN: WHEN R1／R2／R3／R4 が A31 から A35 まで順に操作したとき THEN A35: ルールを更新 ／ UNWANTED: IF 途中の行為で止まったら、次の行為に進めず、止まった理由が画面と証跡に出る
- L1 行 2（['INT-14-001', 'INT-14-002'] …）／ L2 ['J-06']
- audit: 07_tasks/audit/T-I-14.md

### T-I-15 流れ J-07 P6 人が増えたら を最後まで通す（L2）

- group I / layer integration / phase 6_integration / wave 27 / Human 38 h・AI 3.8 h・wall-clock 3.8 h
- 行為 — / 画面 — / 表 — / 関門 —（結線・横断試験（部品の関門をそのまま使う））
- 依存 T-A-04 T-A-05 T-A-06 T-A-07 T-A-08 T-A-09 T-A-13 T-A-14 T-A-16 T-A-17
- 根拠（逐語）：D-002「65社・月630万。エントリー(個人/一人社長3万)・スタンダード(中小8万)・プロ(中堅15万)の3層。エントリーが集」 ／ D-004「LLMは顧客のサブスク内(Bridge)が既定。APIは顧客負担。運営マネージドは既定OFFの管理者トグル」
- 触るファイル：apps/e2e/f-v3-d-e2e-07.spec.ts (new)
- AC（Tier 1）：
- AC（Tier 2）：EVENT-DRIVEN: WHEN R1／R2／R3／R4 が A36 から A46 まで順に操作したとき THEN A95: artifacts に 1 行 ／ UNWANTED: IF 途中の行為で止まったら、次の行為に進めず、止まった理由が画面と証跡に出る
- L1 行 2（['INT-15-001', 'INT-15-002'] …）／ L2 ['J-07']
- audit: 07_tasks/audit/T-I-15.md

### T-I-16 流れ J-08 P7 外に説明する・出る を最後まで通す（L2）

- group I / layer integration / phase 6_integration / wave 27 / Human 14 h・AI 1.4 h・wall-clock 1.4 h
- 行為 — / 画面 — / 表 — / 関門 —（結線・横断試験（部品の関門をそのまま使う））
- 依存 T-A-16 T-A-26 T-U-33 T-U-38 T-U-39 T-U-40
- 根拠（逐語）：D-010「製品の背骨。会社モデル(目標・台帳定義・担当業務・組織・ポリシー・記憶)を1つの定義に。画面もAI社員も自動実行もこの定」 ／ D-015「Bridgeは顧客PCで動く万能実行器。本人のIP・本人のログイン済みセッションで動くのでCAPTCHA/bot検知に到」
- 触るファイル：apps/e2e/f-v3-d-e2e-08.spec.ts (new)
- AC（Tier 1）：
- AC（Tier 2）：EVENT-DRIVEN: WHEN R1／R2 が A39 から A42 まで順に操作したとき THEN A42: トークン・Bridge接続・共有を全部無効 ／ UNWANTED: IF 途中の行為で止まったら、次の行為に進めず、止まった理由が画面と証跡に出る
- L1 行 2（['INT-16-001', 'INT-16-002'] …）／ L2 ['J-08']
- audit: 07_tasks/audit/T-I-16.md

### T-I-17 流れ J-09 P8 運営（段階2） を最後まで通す（L2）

- group I / layer integration / phase 6_integration / wave 27 / Human 34 h・AI 3.4 h・wall-clock 3.4 h
- 行為 — / 画面 — / 表 — / 関門 —（結線・横断試験（部品の関門をそのまま使う））
- 依存 T-A-13 T-A-14 T-A-19 T-A-21 T-A-23 T-A-24 T-A-25 T-A-27 T-U-37 T-U-41
- 根拠（逐語）：D-002「65社・月630万。エントリー(個人/一人社長3万)・スタンダード(中小8万)・プロ(中堅15万)の3層。エントリーが集」 ／ D-010「製品の背骨。会社モデル(目標・台帳定義・担当業務・組織・ポリシー・記憶)を1つの定義に。画面もAI社員も自動実行もこの定」
- 触るファイル：apps/e2e/f-v3-d-e2e-09.spec.ts (new)
- AC（Tier 1）：
- AC（Tier 2）：EVENT-DRIVEN: WHEN R1／R2／R6 が A43 から A65 まで順に操作したとき THEN A78: 可否と理由を版で更新。全社に効く ／ UNWANTED: IF 途中の行為で止まったら、次の行為に進めず、止まった理由が画面と証跡に出る
- L1 行 2（['INT-17-001', 'INT-17-002'] …）／ L2 ['J-09']
- audit: 07_tasks/audit/T-I-17.md

### T-I-18 drift 検出（モック ↔ 実装：h1・状態・第2ナビ・列の値／仕様 ↔ 実装：states・transitions・rela

- group I / layer integration / phase 6_integration / wave 27 / Human 12 h・AI 1.2 h・wall-clock 1.2 h
- 行為 — / 画面 — / 表 — / 関門 —（結線・横断試験（部品の関門をそのまま使う））
- 依存 T-F-01 T-F-15 T-U-01 T-U-02 T-U-03 T-U-04 T-U-05 T-U-06 T-U-07 T-U-08
- 根拠（逐語）：D-053「画面は行為から導出する。画面から始めると『この画面で何をしたいか分からない』が必ず起きる。役割×用事→行為の背骨→オブジ」 ／ D-059「行為ID・役割ID・決定IDは設計者の道具であって顧客に見せるものではない。モックの画面上から消し、HTMLコメントにだ」
- 触るファイル：apps/e2e/f-v3-d-09.spec.ts (new)
- AC（Tier 1）：
- AC（Tier 2）：UBIQUITOUS: 全画面の h1・状態・第2ナビ・列の値がモックと一致し、states / transitions / related_apis が実装に ／ UNWANTED: IF この検査が赤のままなら、リリース判定を通さない（緑を貼るまで完了と言わない）
- L1 行 7（['INT-18-001', 'INT-18-002', 'INT-18-003'] …）／ L2 —
- audit: 07_tasks/audit/T-I-18.md

### T-I-19 負荷試験（同時接続・集中時の rps・失敗率・接続プール）と有限資源の枯渇

- group I / layer polish / phase 6_integration / wave 28 / Human 16 h・AI 1.6 h・wall-clock 1.6 h
- 行為 — / 画面 — / 表 — / 関門 —（結線・横断試験（部品の関門をそのまま使う））
- 依存 T-I-01 T-I-02 T-I-03
- 根拠（逐語）：D-004「LLMは顧客のサブスク内(Bridge)が既定。APIは顧客負担。運営マネージドは既定OFFの管理者トグル」
- 触るファイル：apps/e2e/f-v3-e-01.spec.ts (new)
- AC（Tier 1）：
- AC（Tier 2）：UBIQUITOUS: 1 人で動く ≠ N 人で動く（G-16） ／ UNWANTED: IF この検査が赤のままなら、リリース判定を通さない（緑を貼るまで完了と言わない）
- L1 行 7（['INT-19-001', 'INT-19-002', 'INT-19-003'] …）／ L2 —
- audit: 07_tasks/audit/T-I-19.md

### T-I-20 セキュリティ監査（RLS を故意に壊す・関門の迂回・運営の越境・資格情報の露出）

- group I / layer polish / phase 6_integration / wave 28 / Human 16 h・AI 4.0 h・wall-clock 5.0 h
- 行為 — / 画面 — / 表 — / 関門 —（結線・横断試験（部品の関門をそのまま使う））
- 依存 T-F-02 T-F-03 T-F-14 T-I-02 T-I-05
- 根拠（逐語）：D-042「情シス・コンプラが必ず聞くこと。Bridgeで何ができるか完全列挙・送るもの/送らないもの・全操作の証跡を管理者が閲覧エ」 ／ D-074「人が抜ける（無効化・退会）と会社が退会するときに、flow.json の全オブジェクトで何が起きるかを 1 つの表で決め」
- 触るファイル：apps/e2e/f-v3-e-02.spec.ts (new)
- AC（Tier 1）：
- AC（Tier 2）：UBIQUITOUS: 起きてはいけないことを層ごとに数える（G-02） ／ UNWANTED: IF この検査が赤のままなら、リリース判定を通さない（緑を貼るまで完了と言わない）
- L1 行 7（['INT-20-001', 'INT-20-002', 'INT-20-003'] …）／ L2 —
- audit: 07_tasks/audit/T-I-20.md

### T-I-21 ポータビリティと依存の境界の検査（境界外 import・ベンダー固有 SQL・台帳との整合）

- group I / layer polish / phase 6_integration / wave 27 / Human 8 h・AI 0.8 h・wall-clock 0.8 h
- 行為 — / 画面 — / 表 — / 関門 —（結線・横断試験（部品の関門をそのまま使う））
- 依存 T-F-01
- 根拠（逐語）：D-049「移行は簡単ではない。何が動いて何が動かないかを正直に記録」 ／ D-050「ポータビリティは3つの仕組みで担保。境界ディレクトリ＋CI検査＋台帳。追跡しなければ『後で移行できる』は必ず嘘になる」
- 触るファイル：apps/e2e/f-v3-e-03.spec.ts (new)
- AC（Tier 1）：
- AC（Tier 2）：UBIQUITOUS: 基盤を替えるときの依存箇所を物理的に閉じ込める ／ UNWANTED: IF この検査が赤のままなら、リリース判定を通さない（緑を貼るまで完了と言わない）
- L1 行 7（['INT-21-001', 'INT-21-002', 'INT-21-003'] …）／ L2 —
- audit: 07_tasks/audit/T-I-21.md

### T-I-22 文書とリリース準備（できること・できないことの開示・API 仕様の公開・変更履歴）

- group I / layer polish / phase 6_integration / wave 28 / Human 12 h・AI 1.2 h・wall-clock 1.2 h
- 行為 — / 画面 — / 表 — / 関門 —（結線・横断試験（部品の関門をそのまま使う））
- 依存 T-I-01 T-I-02 T-I-03 T-I-04 T-I-05 T-I-06 T-I-07 T-I-08 T-I-09 T-I-10
- 根拠（逐語）：D-042「情シス・コンプラが必ず聞くこと。Bridgeで何ができるか完全列挙・送るもの/送らないもの・全操作の証跡を管理者が閲覧エ」
- 触るファイル：apps/e2e/f-v3-e-04.spec.ts (new)
- AC（Tier 1）：
- AC（Tier 2）：UBIQUITOUS: 顧客と情シスに出す文書を成果物から機械生成 ／ UNWANTED: IF この検査が赤のままなら、リリース判定を通さない（緑を貼るまで完了と言わない）
- L1 行 7（['INT-22-001', 'INT-22-002', 'INT-22-003'] …）／ L2 —
- audit: 07_tasks/audit/T-I-22.md

### T-S-01 スキル一式の形式・雛形・検査（skill_pkg_gate を運営のアップロードに結線）

- group S / layer content / phase 7_content / wave 29 / Human 8 h・AI 2.0 h・wall-clock 3.0 h
- 行為 A80 / 画面 ops-skills / 表 — / 関門 C4
- 依存 T-U-49 T-A-23
- 根拠（逐語）：D-080「D-078 は器（保存・版・装着）。ここで中身を決める。スキルは SKILL.md ＋ references ＋ eva」 ／ D-078「§30（構築メタスキル群）と §63（目標スキル）は決めたのに、運営がスキルを構築・アップロード・テスト・版管理・配布し」
- 触るファイル：10_skills/README.md (new)、10_skills/_template/SKILL.md (new)、scripts/ci/skill_pkg_gate.py (new)、apps/api/skills/validate.ts (new)
- AC（Tier 1）：UBIQUITOUS: 10_skills/_template の一式（SKILL.md＋references＋evals/scenarios.json）が D
- AC（Tier 2）：EVENT-DRIVEN: WHEN 運営がスキルの一式を上げたら、システムは skill_pkg_gate と同じ検査（必須の節・禁止の中身・場面 5・版）を ／ UNWANTED: IF 一式に資格情報・会社名・個人名が含まれていたら、版を作らず、どの節で落ちたかを返す（中身は証跡に残さない） ／ UBIQUITOUS: 会社側の画面には名前・目的・版だけが見え、一式の中身は見えない（D-078）
- L1 行 6（['SKL-00-001', 'SKL-00-002', 'SKL-00-003'] …）／ L2 —
- audit: 07_tasks/audit/T-S-01.md

### T-S-02 スキル制作 構築メタ「会社モデル構築」（元ネタ hearing・business-plan）

- group S / layer content / phase 7_content / wave 30 / Human 12 h・AI 3.0 h・wall-clock 4.0 h
- 行為 A80 A81 / 画面 ops-skills / 表 — / 関門 —（中身の制作。外界には触れない（テストはテスト会社の中））
- 依存 T-S-01
- 根拠（逐語）：D-030「構築メタスキル群は運営の資産で顧客に見えない。会社モデル構築・担当業務の定義・台帳の設計・目標の分解・改善提案・自分のA」 ／ D-080「D-078 は器（保存・版・装着）。ここで中身を決める。スキルは SKILL.md ＋ references ＋ eva」
- 触るファイル：10_skills/meta-company-model/SKILL.md (new)、10_skills/meta-company-model/evals/scenarios.json (new)、10_skills/catalog.json (modify)
- AC（Tier 1）：UBIQUITOUS: 10_skills/meta-company-model が雛形の節を全部持ち、skill_pkg_gate.py が PASS（cat
- AC（Tier 2）：EVENT-DRIVEN: WHEN 自分のAIが「会社モデル構築」の発動条件に当たったら、システムはこのスキルを読み、出す出力のオブジェクトを変える（案として ／ UNWANTED: IF テスト会社の 5 場面のうち 1 つでも期待と違ったら、版は出せない（配布先に届かない） ／ UNWANTED: IF スキルが外に出る操作や資格情報の参照を含んでいたら、検査で落ちる
- L1 行 7（['SKL-02-001', 'SKL-02-002', 'SKL-02-003'] …）／ L2 —
- audit: 07_tasks/audit/T-S-02.md

### T-S-03 スキル制作 構築メタ「担当業務の定義（OJT の進め方）」（元ネタ sop-create・outsource-brief）

- group S / layer content / phase 7_content / wave 30 / Human 12 h・AI 3.0 h・wall-clock 4.0 h
- 行為 A80 A81 / 画面 ops-skills / 表 — / 関門 —（中身の制作。外界には触れない（テストはテスト会社の中））
- 依存 T-S-01
- 根拠（逐語）：D-030「構築メタスキル群は運営の資産で顧客に見えない。会社モデル構築・担当業務の定義・台帳の設計・目標の分解・改善提案・自分のA」 ／ D-080「D-078 は器（保存・版・装着）。ここで中身を決める。スキルは SKILL.md ＋ references ＋ eva」
- 触るファイル：10_skills/meta-duty-definition/SKILL.md (new)、10_skills/meta-duty-definition/evals/scenarios.json (new)、10_skills/catalog.json (modify)
- AC（Tier 1）：UBIQUITOUS: 10_skills/meta-duty-definition が雛形の節を全部持ち、skill_pkg_gate.py が PASS（c
- AC（Tier 2）：EVENT-DRIVEN: WHEN 自分のAIが「担当業務の定義（OJT の進め方）」の発動条件に当たったら、システムはこのスキルを読み、出す出力のオブジェク ／ UNWANTED: IF テスト会社の 5 場面のうち 1 つでも期待と違ったら、版は出せない（配布先に届かない） ／ UNWANTED: IF スキルが外に出る操作や資格情報の参照を含んでいたら、検査で落ちる
- L1 行 7（['SKL-03-001', 'SKL-03-002', 'SKL-03-003'] …）／ L2 —
- audit: 07_tasks/audit/T-S-03.md

### T-S-04 スキル制作 構築メタ「台帳の設計（段階・項目・判断基準）」（元ネタ pipeline-management・payment-management）

- group S / layer content / phase 7_content / wave 30 / Human 12 h・AI 3.0 h・wall-clock 4.0 h
- 行為 A80 A81 / 画面 ops-skills / 表 — / 関門 —（中身の制作。外界には触れない（テストはテスト会社の中））
- 依存 T-S-01
- 根拠（逐語）：D-030「構築メタスキル群は運営の資産で顧客に見えない。会社モデル構築・担当業務の定義・台帳の設計・目標の分解・改善提案・自分のA」 ／ D-080「D-078 は器（保存・版・装着）。ここで中身を決める。スキルは SKILL.md ＋ references ＋ eva」
- 触るファイル：10_skills/meta-ledger-design/SKILL.md (new)、10_skills/meta-ledger-design/evals/scenarios.json (new)、10_skills/catalog.json (modify)
- AC（Tier 1）：UBIQUITOUS: 10_skills/meta-ledger-design が雛形の節を全部持ち、skill_pkg_gate.py が PASS（cat
- AC（Tier 2）：EVENT-DRIVEN: WHEN 自分のAIが「台帳の設計（段階・項目・判断基準）」の発動条件に当たったら、システムはこのスキルを読み、出す出力のオブジェク ／ UNWANTED: IF テスト会社の 5 場面のうち 1 つでも期待と違ったら、版は出せない（配布先に届かない） ／ UNWANTED: IF スキルが外に出る操作や資格情報の参照を含んでいたら、検査で落ちる
- L1 行 7（['SKL-04-001', 'SKL-04-002', 'SKL-04-003'] …）／ L2 —
- audit: 07_tasks/audit/T-S-04.md

### T-S-05 スキル制作 構築メタ「目標の分解（年→四半期→月→週）」（元ネタ strategic-goal-system・annual-okr）

- group S / layer content / phase 7_content / wave 30 / Human 12 h・AI 3.0 h・wall-clock 4.0 h
- 行為 A80 A81 / 画面 ops-skills / 表 — / 関門 —（中身の制作。外界には触れない（テストはテスト会社の中））
- 依存 T-S-01
- 根拠（逐語）：D-030「構築メタスキル群は運営の資産で顧客に見えない。会社モデル構築・担当業務の定義・台帳の設計・目標の分解・改善提案・自分のA」 ／ D-032「目標の階層と配分。スコープ層と目標階層は別概念。未配分の可視化。配る権限。合意/指示の2通り。AI社員にも配れる。未達は」
- 触るファイル：10_skills/meta-goal-breakdown/SKILL.md (new)、10_skills/meta-goal-breakdown/evals/scenarios.json (new)、10_skills/catalog.json (modify)
- AC（Tier 1）：UBIQUITOUS: 10_skills/meta-goal-breakdown が雛形の節を全部持ち、skill_pkg_gate.py が PASS（ca
- AC（Tier 2）：EVENT-DRIVEN: WHEN 自分のAIが「目標の分解（年→四半期→月→週）」の発動条件に当たったら、システムはこのスキルを読み、出す出力のオブジェクト ／ UNWANTED: IF テスト会社の 5 場面のうち 1 つでも期待と違ったら、版は出せない（配布先に届かない） ／ UNWANTED: IF スキルが外に出る操作や資格情報の参照を含んでいたら、検査で落ちる
- L1 行 7（['SKL-05-001', 'SKL-05-002', 'SKL-05-003'] …）／ L2 —
- audit: 07_tasks/audit/T-S-05.md

### T-S-06 スキル制作 構築メタ「改善提案の作り方（未達の原因と再計画）」（元ネタ strategic-goal-system・analytics）

- group S / layer content / phase 7_content / wave 30 / Human 12 h・AI 3.0 h・wall-clock 4.0 h
- 行為 A80 A81 / 画面 ops-skills / 表 — / 関門 —（中身の制作。外界には触れない（テストはテスト会社の中））
- 依存 T-S-01
- 根拠（逐語）：D-030「構築メタスキル群は運営の資産で顧客に見えない。会社モデル構築・担当業務の定義・台帳の設計・目標の分解・改善提案・自分のA」 ／ D-035「目標とタスクの間に仮説と施策を置く。目標→現状分析→仮説→施策→タスク→検証→次の仮説。効かなかった仮説も残す」
- 触るファイル：10_skills/meta-improvement/SKILL.md (new)、10_skills/meta-improvement/evals/scenarios.json (new)、10_skills/catalog.json (modify)
- AC（Tier 1）：UBIQUITOUS: 10_skills/meta-improvement が雛形の節を全部持ち、skill_pkg_gate.py が PASS（catal
- AC（Tier 2）：EVENT-DRIVEN: WHEN 自分のAIが「改善提案の作り方（未達の原因と再計画）」の発動条件に当たったら、システムはこのスキルを読み、出す出力のオブジ ／ UNWANTED: IF テスト会社の 5 場面のうち 1 つでも期待と違ったら、版は出せない（配布先に届かない） ／ UNWANTED: IF スキルが外に出る操作や資格情報の参照を含んでいたら、検査で落ちる
- L1 行 7（['SKL-06-001', 'SKL-06-002', 'SKL-06-003'] …）／ L2 —
- audit: 07_tasks/audit/T-S-06.md

### T-S-07 スキル制作 構築メタ「自分のAIの育成（好みの引き出し方・記憶への落とし方）」（元ネタ hearing）

- group S / layer content / phase 7_content / wave 30 / Human 12 h・AI 3.0 h・wall-clock 4.0 h
- 行為 A80 A81 / 画面 ops-skills / 表 — / 関門 —（中身の制作。外界には触れない（テストはテスト会社の中））
- 依存 T-S-01
- 根拠（逐語）：D-030「構築メタスキル群は運営の資産で顧客に見えない。会社モデル構築・担当業務の定義・台帳の設計・目標の分解・改善提案・自分のA」 ／ D-080「D-078 は器（保存・版・装着）。ここで中身を決める。スキルは SKILL.md ＋ references ＋ eva」
- 触るファイル：10_skills/meta-clone-growth/SKILL.md (new)、10_skills/meta-clone-growth/evals/scenarios.json (new)、10_skills/catalog.json (modify)
- AC（Tier 1）：UBIQUITOUS: 10_skills/meta-clone-growth が雛形の節を全部持ち、skill_pkg_gate.py が PASS（cata
- AC（Tier 2）：EVENT-DRIVEN: WHEN 自分のAIが「自分のAIの育成（好みの引き出し方・記憶への落とし方）」の発動条件に当たったら、システムはこのスキルを読み、 ／ UNWANTED: IF テスト会社の 5 場面のうち 1 つでも期待と違ったら、版は出せない（配布先に届かない） ／ UNWANTED: IF スキルが外に出る操作や資格情報の参照を含んでいたら、検査で落ちる
- L1 行 7（['SKL-07-001', 'SKL-07-002', 'SKL-07-003'] …）／ L2 —
- audit: 07_tasks/audit/T-S-07.md

### T-S-08 スキル制作 構築メタ「トラブル対応（覚えた操作が壊れた・承認が滞留）」（元ネタ support-response・dependency-risk）

- group S / layer content / phase 7_content / wave 30 / Human 12 h・AI 3.0 h・wall-clock 4.0 h
- 行為 A80 A81 / 画面 ops-skills / 表 — / 関門 —（中身の制作。外界には触れない（テストはテスト会社の中））
- 依存 T-S-01
- 根拠（逐語）：D-030「構築メタスキル群は運営の資産で顧客に見えない。会社モデル構築・担当業務の定義・台帳の設計・目標の分解・改善提案・自分のA」 ／ D-040「CAPTCHAは突破しない。本人環境・本人資格情報・本人のペースで動くので到達しない。突破は運営の安全ルールで禁止」
- 触るファイル：10_skills/meta-trouble/SKILL.md (new)、10_skills/meta-trouble/evals/scenarios.json (new)、10_skills/catalog.json (modify)
- AC（Tier 1）：UBIQUITOUS: 10_skills/meta-trouble が雛形の節を全部持ち、skill_pkg_gate.py が PASS（catalog の
- AC（Tier 2）：EVENT-DRIVEN: WHEN 自分のAIが「トラブル対応（覚えた操作が壊れた・承認が滞留）」の発動条件に当たったら、システムはこのスキルを読み、出す出力 ／ UNWANTED: IF テスト会社の 5 場面のうち 1 つでも期待と違ったら、版は出せない（配布先に届かない） ／ UNWANTED: IF スキルが外に出る操作や資格情報の参照を含んでいたら、検査で落ちる
- L1 行 7（['SKL-08-001', 'SKL-08-002', 'SKL-08-003'] …）／ L2 —
- audit: 07_tasks/audit/T-S-08.md

### T-S-09 スキル制作 目標スキル「営業目標（受託開発）」（元ネタ strategic-goal-system・pipeline-management）

- group S / layer content / phase 7_content / wave 30 / Human 10 h・AI 2.5 h・wall-clock 3.5 h
- 行為 A80 A81 / 画面 ops-skills / 表 — / 関門 —（中身の制作。外界には触れない（テストはテスト会社の中））
- 依存 T-S-01
- 根拠（逐語）：D-063「営業目標の件数・工程・数値・FB・目的を決めるのは運営が作る目標スキル（§30）で、実装ではなくアップロード物。Kana」 ／ D-080「D-078 は器（保存・版・装着）。ここで中身を決める。スキルは SKILL.md ＋ references ＋ eva」
- 触るファイル：10_skills/goal-sales-contract-dev/SKILL.md (new)、10_skills/goal-sales-contract-dev/evals/scenarios.json (new)、10_skills/catalog.json (modify)
- AC（Tier 1）：UBIQUITOUS: 10_skills/goal-sales-contract-dev が雛形の節を全部持ち、skill_pkg_gate.py が PAS
- AC（Tier 2）：EVENT-DRIVEN: WHEN 自分のAIが「営業目標（受託開発）」の発動条件に当たったら、システムはこのスキルを読み、出す出力のオブジェクトを変える（案 ／ UNWANTED: IF テスト会社の 5 場面のうち 1 つでも期待と違ったら、版は出せない（配布先に届かない） ／ UNWANTED: IF スキルが外に出る操作や資格情報の参照を含んでいたら、検査で落ちる
- L1 行 7（['SKL-09-001', 'SKL-09-002', 'SKL-09-003'] …）／ L2 —
- audit: 07_tasks/audit/T-S-09.md

### T-S-10 スキル制作 目標スキル「営業目標（飲食）」（元ネタ strategic-goal-system）

- group S / layer content / phase 7_content / wave 30 / Human 10 h・AI 2.5 h・wall-clock 3.5 h
- 行為 A80 A81 / 画面 ops-skills / 表 — / 関門 —（中身の制作。外界には触れない（テストはテスト会社の中））
- 依存 T-S-01
- 根拠（逐語）：D-063「営業目標の件数・工程・数値・FB・目的を決めるのは運営が作る目標スキル（§30）で、実装ではなくアップロード物。Kana」 ／ D-080「D-078 は器（保存・版・装着）。ここで中身を決める。スキルは SKILL.md ＋ references ＋ eva」
- 触るファイル：10_skills/goal-sales-restaurant/SKILL.md (new)、10_skills/goal-sales-restaurant/evals/scenarios.json (new)、10_skills/catalog.json (modify)
- AC（Tier 1）：UBIQUITOUS: 10_skills/goal-sales-restaurant が雛形の節を全部持ち、skill_pkg_gate.py が PASS（
- AC（Tier 2）：EVENT-DRIVEN: WHEN 自分のAIが「営業目標（飲食）」の発動条件に当たったら、システムはこのスキルを読み、出す出力のオブジェクトを変える（案とし ／ UNWANTED: IF テスト会社の 5 場面のうち 1 つでも期待と違ったら、版は出せない（配布先に届かない） ／ UNWANTED: IF スキルが外に出る操作や資格情報の参照を含んでいたら、検査で落ちる
- L1 行 7（['SKL-10-001', 'SKL-10-002', 'SKL-10-003'] …）／ L2 —
- audit: 07_tasks/audit/T-S-10.md

### T-S-11 スキル制作 目標スキル「納期遵守（制作）」（元ネタ strategic-goal-system・sop-create）

- group S / layer content / phase 7_content / wave 30 / Human 10 h・AI 2.5 h・wall-clock 3.5 h
- 行為 A80 A81 / 画面 ops-skills / 表 — / 関門 —（中身の制作。外界には触れない（テストはテスト会社の中））
- 依存 T-S-01
- 根拠（逐語）：D-063「営業目標の件数・工程・数値・FB・目的を決めるのは運営が作る目標スキル（§30）で、実装ではなくアップロード物。Kana」 ／ D-080「D-078 は器（保存・版・装着）。ここで中身を決める。スキルは SKILL.md ＋ references ＋ eva」
- 触るファイル：10_skills/goal-delivery-production/SKILL.md (new)、10_skills/goal-delivery-production/evals/scenarios.json (new)、10_skills/catalog.json (modify)
- AC（Tier 1）：UBIQUITOUS: 10_skills/goal-delivery-production が雛形の節を全部持ち、skill_pkg_gate.py が PA
- AC（Tier 2）：EVENT-DRIVEN: WHEN 自分のAIが「納期遵守（制作）」の発動条件に当たったら、システムはこのスキルを読み、出す出力のオブジェクトを変える（案とし ／ UNWANTED: IF テスト会社の 5 場面のうち 1 つでも期待と違ったら、版は出せない（配布先に届かない） ／ UNWANTED: IF スキルが外に出る操作や資格情報の参照を含んでいたら、検査で落ちる
- L1 行 7（['SKL-11-001', 'SKL-11-002', 'SKL-11-003'] …）／ L2 —
- audit: 07_tasks/audit/T-S-11.md

### T-S-12 スキル制作 業務スキル「発注ナビの新着を台帳に入れる」（元ネタ hatchunavi-apply）

- group S / layer content / phase 7_content / wave 31 / Human 8 h・AI 2.0 h・wall-clock 3.0 h
- 行為 A80 A81 / 画面 ops-skills / 表 — / 関門 —（中身の制作。外界には触れない（テストはテスト会社の中））
- 依存 T-S-01
- 根拠（逐語）：D-022「覚えた操作は担当業務の下に畳む。ユーザーが普段見るのは担当業務まで。飽和させない」 ／ D-080「D-078 は器（保存・版・装着）。ここで中身を決める。スキルは SKILL.md ＋ references ＋ eva」
- 触るファイル：10_skills/duty-hatchunavi-intake/SKILL.md (new)、10_skills/duty-hatchunavi-intake/evals/scenarios.json (new)、10_skills/catalog.json (modify)
- AC（Tier 1）：UBIQUITOUS: 10_skills/duty-hatchunavi-intake が雛形の節を全部持ち、skill_pkg_gate.py が PASS
- AC（Tier 2）：EVENT-DRIVEN: WHEN 自分のAIが「発注ナビの新着を台帳に入れる」の発動条件に当たったら、システムはこのスキルを読み、出す出力のオブジェクトを変 ／ UNWANTED: IF テスト会社の 5 場面のうち 1 つでも期待と違ったら、版は出せない（配布先に届かない） ／ UNWANTED: IF スキルが外に出る操作や資格情報の参照を含んでいたら、検査で落ちる
- L1 行 7（['SKL-12-001', 'SKL-12-002', 'SKL-12-003'] …）／ L2 —
- audit: 07_tasks/audit/T-S-12.md

### T-S-13 スキル制作 業務スキル「請求書の作成（税込・内訳）」（元ネタ invoice-create）

- group S / layer content / phase 7_content / wave 31 / Human 8 h・AI 2.0 h・wall-clock 3.0 h
- 行為 A80 A81 / 画面 ops-skills / 表 — / 関門 —（中身の制作。外界には触れない（テストはテスト会社の中））
- 依存 T-S-01
- 根拠（逐語）：D-038「台帳は『計算しないが、結果は持つ』。CRM/会計の計算は担わないが結果は台帳に持つ」 ／ D-080「D-078 は器（保存・版・装着）。ここで中身を決める。スキルは SKILL.md ＋ references ＋ eva」
- 触るファイル：10_skills/duty-invoice-create/SKILL.md (new)、10_skills/duty-invoice-create/evals/scenarios.json (new)、10_skills/catalog.json (modify)
- AC（Tier 1）：UBIQUITOUS: 10_skills/duty-invoice-create が雛形の節を全部持ち、skill_pkg_gate.py が PASS（ca
- AC（Tier 2）：EVENT-DRIVEN: WHEN 自分のAIが「請求書の作成（税込・内訳）」の発動条件に当たったら、システムはこのスキルを読み、出す出力のオブジェクトを変え ／ UNWANTED: IF テスト会社の 5 場面のうち 1 つでも期待と違ったら、版は出せない（配布先に届かない） ／ UNWANTED: IF スキルが外に出る操作や資格情報の参照を含んでいたら、検査で落ちる
- L1 行 7（['SKL-13-001', 'SKL-13-002', 'SKL-13-003'] …）／ L2 —
- audit: 07_tasks/audit/T-S-13.md

### T-S-14 スキル制作 業務スキル「入金の照合（正規連携）」（元ネタ payment-management・ai-tax-accountant）

- group S / layer content / phase 7_content / wave 31 / Human 8 h・AI 2.0 h・wall-clock 3.0 h
- 行為 A80 A81 / 画面 ops-skills / 表 — / 関門 —（中身の制作。外界には触れない（テストはテスト会社の中））
- 依存 T-S-01
- 根拠（逐語）：D-041「サービス台帳で外部サービスごとの自動操作可否を持つ(api/allowed/unspecified/forbidden/」 ／ D-080「D-078 は器（保存・版・装着）。ここで中身を決める。スキルは SKILL.md ＋ references ＋ eva」
- 触るファイル：10_skills/duty-payment-match/SKILL.md (new)、10_skills/duty-payment-match/evals/scenarios.json (new)、10_skills/catalog.json (modify)
- AC（Tier 1）：UBIQUITOUS: 10_skills/duty-payment-match が雛形の節を全部持ち、skill_pkg_gate.py が PASS（cat
- AC（Tier 2）：EVENT-DRIVEN: WHEN 自分のAIが「入金の照合（正規連携）」の発動条件に当たったら、システムはこのスキルを読み、出す出力のオブジェクトを変える（ ／ UNWANTED: IF テスト会社の 5 場面のうち 1 つでも期待と違ったら、版は出せない（配布先に届かない） ／ UNWANTED: IF スキルが外に出る操作や資格情報の参照を含んでいたら、検査で落ちる
- L1 行 7（['SKL-14-001', 'SKL-14-002', 'SKL-14-003'] …）／ L2 —
- audit: 07_tasks/audit/T-S-14.md

### T-S-15 スキル制作 業務スキル「問い合わせの一次返信」（元ネタ support-response・customer-followup）

- group S / layer content / phase 7_content / wave 31 / Human 8 h・AI 2.0 h・wall-clock 3.0 h
- 行為 A80 A81 / 画面 ops-skills / 表 — / 関門 —（中身の制作。外界には触れない（テストはテスト会社の中））
- 依存 T-S-01
- 根拠（逐語）：D-075「運営と顧客の間で往復するものは 6 つ（問い合わせ／お知らせと稼働状況／通知の届け先／プランと利用量／請求と入金／セキュ」 ／ D-080「D-078 は器（保存・版・装着）。ここで中身を決める。スキルは SKILL.md ＋ references ＋ eva」
- 触るファイル：10_skills/duty-inquiry-first-reply/SKILL.md (new)、10_skills/duty-inquiry-first-reply/evals/scenarios.json (new)、10_skills/catalog.json (modify)
- AC（Tier 1）：UBIQUITOUS: 10_skills/duty-inquiry-first-reply が雛形の節を全部持ち、skill_pkg_gate.py が PA
- AC（Tier 2）：EVENT-DRIVEN: WHEN 自分のAIが「問い合わせの一次返信」の発動条件に当たったら、システムはこのスキルを読み、出す出力のオブジェクトを変える（案 ／ UNWANTED: IF テスト会社の 5 場面のうち 1 つでも期待と違ったら、版は出せない（配布先に届かない） ／ UNWANTED: IF スキルが外に出る操作や資格情報の参照を含んでいたら、検査で落ちる
- L1 行 7（['SKL-15-001', 'SKL-15-002', 'SKL-15-003'] …）／ L2 —
- audit: 07_tasks/audit/T-S-15.md

### T-B-01 Bridge の骨組み（Electron・窓・設定の置き場・つなぎ先）

- group B / layer backend / phase 3_backend / wave 9 / Human 10 h・AI 2.5 h・wall-clock 3.5 h
- 行為 A09 / 画面 bridge-setup / 表 — / 関門 C1 C5
- 依存 —
- 根拠（逐語）：D-015「Bridgeは顧客PCで動く万能実行器。本人のIP・本人のログイン済みセッションで動くのでCAPTCHA/bot検知に到」 ／ D-047「Bridge経路ではClaudeの全機能がそのまま使える。コード実行のサンドボックスを作るとしたのは過剰だった」
- 触るファイル：apps/bridge/package.json (new)、apps/bridge/tsconfig.json (new)、apps/bridge/src/main.ts (new)、apps/bridge/src/preload.ts (new)
- AC（Tier 1）：UBIQUITOUS: Bridge の骨組み（Electron・窓・設定の置き場・つなぎ先） の成果物が apps/bridge に存在し、type-chec
- AC（Tier 2）：EVENT-DRIVEN: WHEN 手順どおり操作したら、システムは 窓が開き、つなぎ先（KANAME_API_BASE）と端末名が出る ／ UNWANTED: IF つなぎ先に届かなければ、黙って失敗せず理由を画面に出す
- L1 行 3（['BRG-01-001', 'BRG-01-002', 'BRG-01-003'] …）／ L2 —
- audit: 07_tasks/audit/T-B-01.md

### T-B-02 つなぐ（接続コードを引き取って端末として登録・自己診断）

- group B / layer backend / phase 3_backend / wave 10 / Human 8 h・AI 2.0 h・wall-clock 3.0 h
- 行為 A09 / 画面 bridge-setup / 表 — / 関門 C1 C5
- 依存 T-B-01
- 根拠（逐語）：D-015「Bridgeは顧客PCで動く万能実行器。本人のIP・本人のログイン済みセッションで動くのでCAPTCHA/bot検知に到」 ／ D-047「Bridge経路ではClaudeの全機能がそのまま使える。コード実行のサンドボックスを作るとしたのは過剰だった」
- 触るファイル：apps/bridge/src/main.ts (new)、apps/api/src/auth/ext.ts (new)、packages/db/migrations/0026_bridge_claim.sql (new)
- AC（Tier 1）：UBIQUITOUS: つなぐ（接続コードを引き取って端末として登録・自己診断） の成果物が apps/bridge に存在し、type-check と bui
- AC（Tier 2）：EVENT-DRIVEN: WHEN 手順どおり操作したら、システムは 画面の接続コードを入れると sessions に bridge の行がつき、はじめの設定 ／ UNWANTED: IF つなぎ先に届かなければ、黙って失敗せず理由を画面に出す
- L1 行 3（['BRG-02-001', 'BRG-02-002', 'BRG-02-003'] …）／ L2 —
- audit: 07_tasks/audit/T-B-02.md

### T-B-03 受け取って返す（指示 → 本人の Claude Code → 結果と証跡をサーバーへ）

- group B / layer backend / phase 3_backend / wave 11 / Human 24 h・AI 6.0 h・wall-clock 7.0 h
- 行為 A09 / 画面 bridge-setup / 表 — / 関門 C1 C5
- 依存 T-B-02
- 根拠（逐語）：D-015「Bridgeは顧客PCで動く万能実行器。本人のIP・本人のログイン済みセッションで動くのでCAPTCHA/bot検知に到」 ／ D-047「Bridge経路ではClaudeの全機能がそのまま使える。コード実行のサンドボックスを作るとしたのは過剰だった」
- 触るファイル：apps/bridge/src/runner.ts (new)、apps/bridge/src/queue.ts (new)
- AC（Tier 1）：UBIQUITOUS: 受け取って返す（指示 → 本人の Claude Code → 結果と証跡をサーバーへ） の成果物が apps/bridge に存在し、t
- AC（Tier 2）：EVENT-DRIVEN: WHEN 手順どおり操作したら、システムは サーバーが積んだ 1 件を Bridge が取り、Claude Code を起動し、結果 ／ UNWANTED: IF つなぎ先に届かなければ、黙って失敗せず理由を画面に出す
- L1 行 9（['BRG-03-001', 'BRG-03-002', 'BRG-03-003'] …）／ L2 —
- audit: 07_tasks/audit/T-B-03.md

### T-B-04 見張る（bridge-guard：作業フォルダの外・銀行・CAPTCHA・規約で禁じるサービスを拒む）

- group B / layer backend / phase 3_backend / wave 12 / Human 16 h・AI 4.0 h・wall-clock 5.0 h
- 行為 A09 / 画面 bridge-setup / 表 — / 関門 C1 C5
- 依存 T-B-03
- 根拠（逐語）：D-015「Bridgeは顧客PCで動く万能実行器。本人のIP・本人のログイン済みセッションで動くのでCAPTCHA/bot検知に到」 ／ D-047「Bridge経路ではClaudeの全機能がそのまま使える。コード実行のサンドボックスを作るとしたのは過剰だった」
- 触るファイル：packages/bridge-guard/src/index.ts (new)、apps/bridge/src/runner.ts (new)
- AC（Tier 1）：UBIQUITOUS: 見張る（bridge-guard：作業フォルダの外・銀行・CAPTCHA・規約で禁じるサービスを拒む） の成果物が apps/bridg
- AC（Tier 2）：EVENT-DRIVEN: WHEN 手順どおり操作したら、システムは 範囲外の操作が Bridge の中で拒まれ、拒んだ事実が証跡に出る（関門の外に生の fs ／ UNWANTED: IF つなぎ先に届かなければ、黙って失敗せず理由を画面に出す
- L1 行 3（['BRG-04-001', 'BRG-04-002', 'BRG-04-003'] …）／ L2 —
- audit: 07_tasks/audit/T-B-04.md

### T-B-05 鍵を受け取る（Bridge は Infisical に入らない。Kaname の関門 C8 が解いた値を実行の間だけ受け取り、入力したら捨てる。ディスクに書かない）

- group B / layer backend / phase 3_backend / wave 13 / Human 12 h・AI 3.0 h・wall-clock 4.0 h
- 行為 A09 / 画面 bridge-setup / 表 — / 関門 C1 C5
- 依存 T-B-04
- 根拠（逐語）：D-015「Bridgeは顧客PCで動く万能実行器。本人のIP・本人のログイン済みセッションで動くのでCAPTCHA/bot検知に到」 ／ D-047「Bridge経路ではClaudeの全機能がそのまま使える。コード実行のサンドボックスを作るとしたのは過剰だった」
- 触るファイル：apps/bridge/src/vault.ts (new)
- AC（Tier 1）：UBIQUITOUS: 鍵を受け取る（Bridge は Infisical に入らない。Kaname の関門 C8 が解いた値を実行の間だけ受け取り、入力したら
- AC（Tier 2）：EVENT-DRIVEN: WHEN 手順どおり操作したら、システムは AI には参照 ID しか渡らず、Bridge は実行の間だけ値を持ち、終わったら捨てる ／ UNWANTED: IF つなぎ先に届かなければ、黙って失敗せず理由を画面に出す
- L1 行 3（['BRG-05-004', 'BRG-05-005', 'BRG-05-006'] …）／ L2 —
- audit: 07_tasks/audit/T-B-05.md

### T-B-08 道具どまりの文 39 件を棚卸しする（製品にも出すか、理由つきで外すかを 1 文ずつ決める）

- group B / layer backend / phase 3_backend / wave 9 / Human 10 h・AI 2.5 h・wall-clock 3.5 h
- 行為 A09 / 画面 bridge-setup / 表 — / 関門 C1 C5
- 依存 —
- 根拠（逐語）：D-095「関門の検査は実装済みなのに CI から呼ばれておらず、回すと迂回 55 件で赤。検査は作った時点で CI に並べる。決定」 ／ D-047「Bridge経路ではClaudeの全機能がそのまま使える。コード実行のサンドボックスを作るとしたのは過剰だった」
- 触るファイル：product-reach-exempt.json (new)、05_flow/flow.json (new)、07_qa/test-specs/errors.json (new)
- AC（Tier 1）：UBIQUITOUS: 道具どまりの文 39 件を棚卸しする（製品にも出すか、理由つきで外すかを 1 文ずつ決める） の成果物が apps/bridge に存在
- AC（Tier 2）：EVENT-DRIVEN: WHEN 手順どおり操作したら、システムは python3 scripts/ci/product_reach.py が緑（製品の層に ／ UNWANTED: IF つなぎ先に届かなければ、黙って失敗せず理由を画面に出す
- L1 行 3（['BRG-08-001', 'BRG-08-002', 'BRG-08-003'] …）／ L2 —
- audit: 07_tasks/audit/T-B-08.md

### T-B-07 関門の迂回 55 件を片付けて、関門の検査を CI に並べる（画面の fetch を C1 の対象外にするか例外台帳に載せるかを 1 件ずつ決める）

- group B / layer backend / phase 3_backend / wave 9 / Human 12 h・AI 3.0 h・wall-clock 4.0 h
- 行為 A09 / 画面 bridge-setup / 表 — / 関門 C1 C5
- 依存 —
- 根拠（逐語）：D-095「関門の検査は実装済みなのに CI から呼ばれておらず、回すと迂回 55 件で赤。検査は作った時点で CI に並べる。決定」 ／ D-047「Bridge経路ではClaudeの全機能がそのまま使える。コード実行のサンドボックスを作るとしたのは過剰だった」
- 触るファイル：.github/workflows/v3-gate.yml (new)、03_architecture/choke-points.json (new)、03_architecture/choke-point-exceptions.md (new)
- AC（Tier 1）：UBIQUITOUS: 関門の迂回 55 件を片付けて、関門の検査を CI に並べる（画面の fetch を C1 の対象外にするか例外台帳に載せるかを 1 件
- AC（Tier 2）：EVENT-DRIVEN: WHEN 手順どおり操作したら、システムは node scripts/ci/choke.mjs --all が緑になり、CI から呼 ／ UNWANTED: IF つなぎ先に届かなければ、黙って失敗せず理由を画面に出す
- L1 行 3（['BRG-07-001', 'BRG-07-002', 'BRG-07-003'] …）／ L2 —
- audit: 07_tasks/audit/T-B-07.md

### T-B-06 配布（インストーラ・macOS の公証・Windows の署名・自動更新：署名までは指紋を確かめて自分で入れ替え、署名後は electron-updater）

- group B / layer backend / phase 3_backend / wave 11 / Human 20 h・AI 5.0 h・wall-clock 6.0 h
- 行為 A09 / 画面 bridge-setup / 表 — / 関門 C1 C5
- 依存 T-B-02
- 根拠（逐語）：D-015「Bridgeは顧客PCで動く万能実行器。本人のIP・本人のログイン済みセッションで動くのでCAPTCHA/bot検知に到」 ／ D-047「Bridge経路ではClaudeの全機能がそのまま使える。コード実行のサンドボックスを作るとしたのは過剰だった」
- 触るファイル：apps/bridge/electron-builder.yml (new)、apps/bridge/scripts/release.mjs (new)、apps/bridge/src/update.ts (new)、apps/api/src/auth/bridge-release.ts (new)
- AC（Tier 1）：UBIQUITOUS: 配布（インストーラ・macOS の公証・Windows の署名・自動更新：署名までは指紋を確かめて自分で入れ替え、署名後は electr
- AC（Tier 2）：EVENT-DRIVEN: WHEN 手順どおり操作したら、システムは macOS / Windows のインストーラが出て、入れた人に自動で新しい版が届く（指 ／ UNWANTED: IF つなぎ先に届かなければ、黙って失敗せず理由を画面に出す
- L1 行 15（['BRG-06-012', 'BRG-06-013', 'BRG-06-014'] …）／ L2 —
- audit: 07_tasks/audit/T-B-06.md

### T-B-09 検索の土台（台帳・記憶・証跡の本文に PGroonga の索引・手元と CI の像に PGroonga と pgvector・memories.embedding の仮置きをやめる）

- group B / layer backend / phase 3_backend / wave 9 / Human 8 h・AI 2.0 h・wall-clock 3.0 h
- 行為 A21 / 画面 search / 表 — / 関門 C2
- 依存 —
- 根拠（逐語）：D-099「段階1の探すは自分のAIが全文検索を繰り返して読んで選ぶ。ベクトルは件数と探す時間が境を超えてから入れ、作るのは本人のP」 ／ D-098「意味の近さはRuri v3をBridgeのPCで動かしてベクトルにし、言葉の一致はPGroongaで拾い、最後に自分のA」
- 触るファイル：packages/db/migrations/0039_search.sql (new)、infra/docker-compose.dev.yml (new)、infra/pg/Dockerfile (new)
- AC（Tier 1）：UBIQUITOUS: 検索の土台（台帳・記憶・証跡の本文に PGroonga の索引・手元と CI の の成果物があり、type-check と build 
- AC（Tier 2）：EVENT-DRIVEN: WHEN 「請求」で全文検索する、システムは その記憶が出る ／ UNWANTED: IF migration 済み、システムは embedding 列が無い
- L1 行 4（['BRG-09-006', 'BRG-09-007', 'BRG-09-008'] …）／ L2 —
- audit: 07_tasks/audit/T-B-09.md

### T-B-10 ベクトルを入れる（境を越えたら）：Bridge がモデルを自分で取り・確かめ・直す（Bridge と同じ扱い）・本人の PC で作る・直された行と新しいモデルは裏で作り直す

- group B / layer backend / phase 3_backend / wave 12 / Human 24 h・AI 2.0 h・wall-clock 2.0 h
- 行為 A21 A30 / 画面 search bridge-setup / 表 — / 関門 C1 C2 C5
- 依存 T-B-11 T-B-03
- 根拠（逐語）：D-099「段階1の探すは自分のAIが全文検索を繰り返して読んで選ぶ。ベクトルは件数と探す時間が境を超えてから入れ、作るのは本人のP」 ／ D-098「意味の近さはRuri v3をBridgeのPCで動かしてベクトルにし、言葉の一致はPGroongaで拾い、最後に自分のA」
- 触るファイル：packages/db/migrations/0040_search_embeddings.sql (new)、apps/bridge/src/embed.ts (new)、apps/bridge/src/embed.test.ts (new)、apps/bridge/src/renderer/index.html (new)
- AC（Tier 1）：UBIQUITOUS: ベクトルを入れる（境を越えたら）：Bridge がモデルを自分で取り・確かめ・直 の成果物があり、type-check と build 
- AC（Tier 2）：EVENT-DRIVEN: WHEN 何もしない（Bridge が始める）、システムは 進み具合が出て、終わると自己診断の「検索のモデル」が OK になる ／ UNWANTED: IF 推論を途中で殺す、システムは ベクトルは入らず、次に Bridge が動いたときに作り直す
- L1 行 6（['BRG-10-006', 'BRG-10-007', 'BRG-10-008'] …）／ L2 —
- audit: 07_tasks/audit/T-B-10.md

### T-B-11 探す（自分のAI が PGroonga で言い換えを広げて探し、読んで選ぶ・人は言葉の一致で探す・探した件数と時間を記録して境を越えたら運営に知らせる）

- group B / layer backend / phase 3_backend / wave 10 / Human 14 h・AI 3.5 h・wall-clock 4.5 h
- 行為 A21 / 画面 search / 表 — / 関門 C2 C3
- 依存 T-B-09
- 根拠（逐語）：D-099「段階1の探すは自分のAIが全文検索を繰り返して読んで選ぶ。ベクトルは件数と探す時間が境を超えてから入れ、作るのは本人のP」 ／ D-098「意味の近さはRuri v3をBridgeのPCで動かしてベクトルにし、言葉の一致はPGroongaで拾い、最後に自分のA」
- 触るファイル：apps/api/src/routes/search.ts (new)、apps/web/app/(app)/search/page.tsx (new)、apps/web/tests/screens/search.spec.ts (new)
- AC（Tier 1）：UBIQUITOUS: 探す（自分のAI が PGroonga で言い換えを広げて探し、読んで選ぶ・人は の成果物があり、type-check と build 
- AC（Tier 2）：EVENT-DRIVEN: WHEN 自分のAI に「請求の件どこ？」と聞く（実ブラウザ）、システムは 言葉が一致しない「インボイスの送付」も出て、どう探したか ／ UNWANTED: IF 高本さんの実データ・質問 20 個と正解、システムは 当たった数と外れた質問が 07_qa/test-specs/search-eva
- L1 行 6（['BRG-11-005', 'BRG-11-006', 'BRG-11-007'] …）／ L2 —
- audit: 07_tasks/audit/T-B-11.md

### T-B-13 自分のAI の仕事の記録（使った量と道具の呼び出しを残す・中身の全文は集めない）

- group B / layer backend / phase 3_backend / wave 12 / Human 6 h・AI 1.5 h・wall-clock 2.5 h
- 行為 A20 A69 / 画面 clone-chat / 表 — / 関門 C2 C5
- 依存 T-B-03
- 根拠（逐語）：D-100「仕事ごとに使った量（往復数・時間・入力と出力の量・費用の見込み）を残し、上限の知らせに使う。道具の呼び出しは名前・対象・」
- 触るファイル：packages/db/migrations/0038_bridge_work_record.sql (new)、apps/bridge/src/stream.ts (new)、apps/bridge/src/runner.ts (new)、apps/bridge/src/loop.ts (new)
- AC（Tier 1）：UBIQUITOUS: 自分のAI の仕事の記録（使った量と道具の呼び出しを残す・中身の全文は集めない） の成果物があり、type-check と build 
- AC（Tier 2）：EVENT-DRIVEN: WHEN 自分のAI にファイルを読ませる、システムは bridge_job_events に kind=tool の行（name・ ／ UNWANTED: IF 記録がある仕事、システムは 会話には「…を使っています」の 1 行だけが出る
- L1 行 4（['BRG-13-001', 'BRG-13-002', 'BRG-13-003'] …）／ L2 —
- audit: 07_tasks/audit/T-B-13.md

### T-B-12 段階 1 の置き場を立てる（Vercel の画面と API の 2 プロジェクト・Supabase 東京・鍵は Vercel の環境変数・Build で migration）

- group B / layer backend / phase 3_backend / wave 9 / Human 8 h・AI 2.0 h・wall-clock 3.0 h
- 行為 A09 / 画面 bridge-setup / 表 — / 関門 C1 C2
- 依存 —
- 根拠（逐語）：D-097「段階1は画面もAPIもVercel（別プロジェクト・APIは独立のまま）＋Supabase東京。Railway・Hatc」 ／ D-101「顧客の資格情報は段階1からInfisicalのクラウド無料枠に置く。Kanameが会社ごとの鍵で暗号化した中身だけを会社」
- 触るファイル：infra/STAGING.md (new)、apps/api/vercel.json (new)、apps/api/build-vercel.mjs (new)、apps/api/src/vercel.ts (new)
- AC（Tier 1）：UBIQUITOUS: 段階 1 の置き場を立てる（Vercel の画面と API の 2 プロジェクト の成果物があり、type-check と build 
- AC（Tier 2）：EVENT-DRIVEN: WHEN curl で /health、システムは 200。落ちていれば 503 と理由（黙って 502 にしない） ／ UNWANTED: IF S0〜S4 を済ませた、システムは 全部通る（L2）
- L1 行 5（['BRG-12-001', 'BRG-12-002', 'BRG-12-003'] …）／ L2 —
- audit: 07_tasks/audit/T-B-12.md

### T-B-14 資格情報の置き場を Infisical に（会社ごとの置き場・暗号文だけ・Machine Identity で入る・起動時に確かめる）

- group B / layer backend / phase 3_backend / wave 9 / Human 6 h・AI 1.5 h・wall-clock 2.5 h
- 行為 A10 / 画面 credentials / 表 — / 関門 C8 C1
- 依存 —
- 根拠（逐語）：D-101「顧客の資格情報は段階1からInfisicalのクラウド無料枠に置く。Kanameが会社ごとの鍵で暗号化した中身だけを会社」 ／ D-102「Infisicalの費用はidentityの数で決まるので、入るのはKanameのサーバーと運営の人だけ（3つ）。Bri」
- 触るファイル：packages/secrets/src/infisical.ts (new)、packages/secrets/test/infisical.test.ts (new)、packages/config/src/index.ts (new)、apps/api/src/server.ts (new)
- AC（Tier 1）：UBIQUITOUS: 資格情報の置き場を Infisical に（会社ごとの置き場・暗号文だけ・Mac の成果物があり、type-check と build 
- AC（Tier 2）：EVENT-DRIVEN: WHEN 資格情報を保存する（実ブラウザ）、システムは Infisical の画面で見ても中身は暗号文。表（credentials） ／ UNWANTED: IF 置き場が 429 を返す、システムは E-SEC-003 の文言と待つ秒数が出て、表に行ができない
- L1 行 8（['BRG-14-001', 'BRG-14-002', 'BRG-14-003'] …）／ L2 —
- audit: 07_tasks/audit/T-B-14.md

### T-B-15 会話を分ける（新しく話す＝新しいセッション・一覧・探す（名前も中身も）・名前は自動で付き直せる・星・消す・記憶に残さない会話）

- group B / layer backend / phase 3_backend / wave 13 / Human 10 h・AI 2.5 h・wall-clock 3.5 h
- 行為 A88 / 画面 clone-chat / 表 — / 関門 C2
- 依存 T-B-13
- 根拠（逐語）：D-104「会話は人が「新しく話す」で分け、一覧（探す・星・消す・記憶に残さない）から戻って続ける（1会話＝PCのClaudeの1セ」 ／ D-062「会話は1本で見え方が2つ。A 会話モード（Claude/LINE 型の専用画面）と B 作業モード（中央＝反映先の画面、」
- 触るファイル：packages/db/migrations/0040_chat_sessions.sql (new)、apps/api/src/auth/ext.ts (new)、apps/api/test/chat_sessions.test.ts (new)、apps/web/lib/agent.ts (new)
- AC（Tier 1）：UBIQUITOUS: 会話を分ける（新しく話す＝新しいセッション・一覧・探す（名前も中身も）・名前は自 の成果物があり、type-check と build 
- AC（Tier 2）：EVENT-DRIVEN: WHEN 前の会話を選んで言う（実ブラウザ）、システムは 前の会話の吹き出しの下に続きが出て、agent_session_id が前 ／ UNWANTED: IF 会話を消した、システムは 文言と一覧への導線が出る（素の 404 にしない）
- L1 行 6（['CHT-15-001', 'CHT-15-002', 'CHT-15-003'] …）／ L2 —
- audit: 07_tasks/audit/T-B-15.md

### T-B-16 書きながら出る返事と作業の見せ方（Bridge が途中の文・今していること・手順を送る。画面は吹き出しの外に 1 行・手順・経過時間・道具の行）

- group B / layer backend / phase 3_backend / wave 13 / Human 12 h・AI 3.0 h・wall-clock 4.0 h
- 行為 A20 / 画面 clone-chat / 表 — / 関門 C5 C2
- 依存 T-B-13
- 根拠（逐語）：D-104「会話は人が「新しく話す」で分け、一覧（探す・星・消す・記憶に残さない）から戻って続ける（1会話＝PCのClaudeの1セ」 ／ D-093「端末(tty)は要らずパイプで足りる。stream-json で完了イベントを受けるので「終了コード0=成功」にしない。」
- 触るファイル：apps/bridge/src/stream.ts (new)、apps/bridge/src/runner.ts (new)、apps/bridge/src/stream.test.ts (new)、packages/db/migrations/0041_agent_partial.sql (new)
- AC（Tier 1）：UBIQUITOUS: 書きながら出る返事と作業の見せ方（Bridge が途中の文・今していること・手順 の成果物があり、type-check と build 
- AC（Tier 2）：EVENT-DRIVEN: WHEN 長めの返事を頼む（実ブラウザ）、システムは 吹き出しの文が伸びていき、終わると result と同じになる ／ UNWANTED: IF 途中で CLI を殺す、システムは 「止まりました」と理由。途中の文は答えとして確定しない
- L1 行 5（['CHT-16-001', 'CHT-16-002', 'CHT-16-003'] …）／ L2 —
- audit: 07_tasks/audit/T-B-16.md

### T-B-17 止める・止めずに直す・順番待ち（Bridge が動いている Claude Code を止める／次の区切りで文を渡す。動いている間に送った文は順番待ち、取り消せる）

- group B / layer backend / phase 3_backend / wave 14 / Human 10 h・AI 2.5 h・wall-clock 3.5 h
- 行為 A89 / 画面 clone-chat / 表 — / 関門 C5 C2
- 依存 T-B-16
- 根拠（逐語）：D-104「会話は人が「新しく話す」で分け、一覧（探す・星・消す・記憶に残さない）から戻って続ける（1会話＝PCのClaudeの1セ」 ／ D-090「Bridge が仕事を受け取り、本人の Claude Code を --resume で呼んで返す。文脈は Claude」
- 触るファイル：apps/bridge/src/runner.ts (new)、apps/bridge/src/loop.ts (new)、apps/api/src/auth/ext.ts (new)、packages/db/migrations/0042_agent_steer.sql (new)
- AC（Tier 1）：UBIQUITOUS: 止める・止めずに直す・順番待ち（Bridge が動いている Claude Cod の成果物があり、type-check と build 
- AC（Tier 2）：EVENT-DRIVEN: WHEN 「宛先は鈴木さんで」と送る（実ブラウザ）、システムは 作業が止まらず、次の区切り以降の動きに反映される（steer の出来 ／ UNWANTED: IF Bridge を落とす、システムは E-CHAT-003 の文言
- L1 行 6（['CHT-17-001', 'CHT-17-002', 'CHT-17-003'] …）／ L2 —
- audit: 07_tasks/audit/T-B-17.md

### T-B-18 資料と画像を付ける（＋・ドラッグ・貼り付け・長い文は自動で添付・送る前に外せる。置き場に置き、Bridge が期限つきの署名 URL で受け取って自分のAI に渡す）

- group B / layer backend / phase 3_backend / wave 14 / Human 12 h・AI 3.0 h・wall-clock 4.0 h
- 行為 A90 / 画面 clone-chat / 表 — / 関門 C4 C2 C5
- 依存 T-B-15
- 根拠（逐語）：D-104「会話は人が「新しく話す」で分け、一覧（探す・星・消す・記憶に残さない）から戻って続ける（1会話＝PCのClaudeの1セ」 ／ D-066「会話の部品は1組で、会話モード・右パネル・はじめの設定の会話が同じものを使う。①質問には選択肢チップ＋必ず「その他（自由」
- 触るファイル：apps/api/src/auth/ext.ts (new)、packages/gateways/src/storage.ts (new)、apps/bridge/src/attachments.ts (new)、apps/bridge/src/attachments.test.ts (new)
- AC（Tier 1）：UBIQUITOUS: 資料と画像を付ける（＋・ドラッグ・貼り付け・長い文は自動で添付・送る前に外せる。 の成果物があり、type-check と build 
- AC（Tier 2）：EVENT-DRIVEN: WHEN PDF を付けて「要点を」と頼む（実ブラウザ）、システムは 自分のAI が中身を読んで答える。保存先の鍵は AI への指示 ／ UNWANTED: IF 60MB のファイル、システムは E-LIM-002 の文言
- L1 行 6（['CHT-18-001', 'CHT-18-002', 'CHT-18-003'] …）／ L2 —
- audit: 07_tasks/audit/T-B-18.md

### T-B-19 許可のモードと「いつも許可」・問い合わせの答え（毎回聞く／編集は自動／自動で判断／計画だけ／全部許可。3 択＋一言。AskUserQuestion の答えを返す）

- group B / layer backend / phase 3_backend / wave 14 / Human 12 h・AI 3.0 h・wall-clock 4.0 h
- 行為 A91 A35 / 画面 clone-chat policies / 表 — / 関門 C5 C2
- 依存 T-B-16
- 根拠（逐語）：D-104「会話は人が「新しく話す」で分け、一覧（探す・星・消す・記憶に残さない）から戻って続ける（1会話＝PCのClaudeの1セ」 ／ D-107「サービス台帳で禁止（forbidden）と銀行（bank）のドメインは、自分のAI に仕事を渡すたびに Bridge が」
- 触るファイル：apps/bridge/src/runner.ts (new)、apps/bridge/src/permission.ts (new)、apps/api/src/auth/ext.ts (new)、packages/db/migrations/0043_permission_rules.sql (new)
- AC（Tier 1）：UBIQUITOUS: 許可のモードと「いつも許可」・問い合わせの答え（毎回聞く／編集は自動／自動で判断 の成果物があり、type-check と build 
- AC（Tier 2）：EVENT-DRIVEN: WHEN 取り消す → 同じ頼み、システムは また聞かれる ／ UNWANTED: IF 全部許可の会話、システムは 関門が止め、人へのハンドオフになる
- L1 行 6（['CHT-19-001', 'CHT-19-002', 'CHT-19-003'] …）／ L2 —
- audit: 07_tasks/audit/T-B-19.md

### T-B-20 自分のAIの使用量（Bridge が Claude Code から 5 時間の枠・週の枠といつ戻るかを受け、アカウントに出す。近い・達したら会話に案内）

- group B / layer backend / phase 3_backend / wave 14 / Human 6 h・AI 1.5 h・wall-clock 2.5 h
- 行為 A94 / 画面 account clone-chat / 表 — / 関門 C5 C2
- 依存 T-B-16
- 根拠（逐語）：D-104「会話は人が「新しく話す」で分け、一覧（探す・星・消す・記憶に残さない）から戻って続ける（1会話＝PCのClaudeの1セ」 ／ D-100「仕事ごとに使った量（往復数・時間・入力と出力の量・費用の見込み）を残し、上限の知らせに使う。道具の呼び出しは名前・対象・」
- 触るファイル：apps/bridge/src/stream.ts (new)、apps/api/src/auth/ext.ts (new)、packages/db/migrations/0044_agent_usage.sql (new)
- AC（Tier 1）：UBIQUITOUS: 自分のAIの使用量（Bridge が Claude Code から 5 時間の枠 の成果物があり、type-check と build 
- AC（Tier 2）：EVENT-DRIVEN: WHEN 開く（実ブラウザ）、システムは 2 つの枠と戻る時刻 ／ UNWANTED: IF 上限に当たる、システムは E-LIM-010 の文言
- L1 行 4（['CHT-20-001', 'CHT-20-002', 'CHT-20-003'] …）／ L2 —
- audit: 07_tasks/audit/T-B-20.md

### T-B-21 記憶の毎朝のまとめ（「今日」の一番上のボタン → 溜まった会話と承認・差し戻しを自分のAI が読む → 覚えた／まとめた／上げる候補／捨てた。個人は自動で入れ、整理は前後を残す）

- group B / layer backend / phase 3_backend / wave 14 / Human 14 h・AI 3.5 h・wall-clock 4.5 h
- 行為 A92 A30 / 画面 today clone-memory / 表 — / 関門 C3 C2
- 依存 T-B-16 T-B-15
- 根拠（逐語）：D-105「「覚えて」はその場で入れる。それ以外は毎朝「今日」の一番上の「昨日の会話をまとめる」を人が押して始め、会話と承認・差し戻」
- 触るファイル：packages/db/migrations/0045_memory_digest.sql (new)、apps/api/src/auth/ext.ts (new)、apps/bridge/src/runner.ts (new)、apps/web/app/(app)/today/page.tsx (new)
- AC（Tier 1）：UBIQUITOUS: 記憶の毎朝のまとめ（「今日」の一番上のボタン → 溜まった会話と承認・差し戻しを の成果物があり、type-check と build 
- AC（Tier 2）：EVENT-DRIVEN: WHEN 今日 を開く → 押す、システムは 「2 日分・会話 7」→ from_on〜to_on が 2 日分 ／ UNWANTED: IF Bridge を止める、システムは E-MEM-001 の文言。溜まった量が変わらない
- L1 行 6（['CHT-21-001', 'CHT-21-002', 'CHT-21-003'] …）／ L2 —
- audit: 07_tasks/audit/T-B-21.md

### T-B-22 上の層へ上げる候補と食い違い（上げ先は AI が選び本人が送る・OK までは個人で効く・確認者がいない層は 1 つ上へ・決まりは上ほど強い・食い違いは並べて確認者が決める）

- group B / layer backend / phase 3_backend / wave 16 / Human 10 h・AI 2.5 h・wall-clock 3.5 h
- 行為 A93 / 画面 clone-memory today / 表 — / 関門 C2 C6
- 依存 T-B-21
- 根拠（逐語）：D-105「「覚えて」はその場で入れる。それ以外は毎朝「今日」の一番上の「昨日の会話をまとめる」を人が押して始め、会話と承認・差し戻」 ／ D-073「自分のもの（個人の範囲・自主目標・自分のAIの記憶・自分が作ったAI社員）は権限なしで作る・直す・消す。それ以外は権限の」
- 触るファイル：packages/db/migrations/0045_memory_digest.sql (new)、apps/api/src/auth/ext.ts (new)、apps/web/app/(app)/ai/memory/page.tsx (new)
- AC（Tier 1）：UBIQUITOUS: 上の層へ上げる候補と食い違い（上げ先は AI が選び本人が送る・OK までは個人 の成果物があり、type-check と build 
- AC（Tier 2）：EVENT-DRIVEN: WHEN OK の前後で送った人と別の人の自分のAI に聞く、システムは OK 前は送った人だけに効き、OK 後は層の全員に効く ／ UNWANTED: IF 一人社長の会社、システムは 上げる候補の群が出ない
- L1 行 6（['CHT-22-001', 'CHT-22-002', 'CHT-22-003'] …）／ L2 —
- audit: 07_tasks/audit/T-B-22.md

### T-B-23 成果物を会話の横で開いて直し、版を残して戻す（返事から書き出す・文書と表はその場で直すと新しい版・版の一覧から戻す・画像や PDF は見るだけ・置き場は関門 C4）

- group B / layer backend / phase 3_backend / wave 16 / Human 14 h・AI 3.5 h・wall-clock 4.5 h
- 行為 A95 / 画面 clone-chat / 表 — / 関門 C4 C2
- 依存 T-B-18
- 根拠（逐語）：D-106「返事の「書き出す」で成果物ができ、会話の横で開く。文書（md）と表（csv）はその場で直して保存すると新しい版になり、版」 ／ D-104「会話は人が「新しく話す」で分け、一覧（探す・星・消す・記憶に残さない）から戻って続ける（1会話＝PCのClaudeの1セ」
- 触るファイル：packages/db/migrations/0045_artifacts.sql (new)、apps/api/src/auth/artifacts.ts (new)、apps/api/test/agent_artifacts.test.ts (new)、apps/web/components/ai/artifact.tsx (new)
- AC（Tier 1）：UBIQUITOUS: 成果物を会話の横で開いて直し、版を残して戻す（返事から書き出す・文書と表はその場 の成果物があり、type-check と build 
- AC（Tier 2）：EVENT-DRIVEN: WHEN 閉じる → カードから開く（実ブラウザ・375 と 1440）、システムは 同じ成果物が開く。375 で横にはみ出さない ／ UNWANTED: IF 別の人・別の会社、システムは 直せない（0 行）・他の会社の一覧に出ない
- L1 行 8（['CHT-23-001', 'CHT-23-002', 'CHT-23-003'] …）／ L2 —
- audit: 07_tasks/audit/T-B-23.md

### T-B-24 規約で自動操作が禁止のサービスと銀行を、全部許可でも本人の PC の上で止める（仕事ごとに使わない道具として渡す・道具を使う直前のフックでコマンドと宛先を調べる・止めたら理由と人への案内・証跡）

- group B / layer backend / phase 3_backend / wave 16 / Human 12 h・AI 3.0 h・wall-clock 4.0 h
- 行為 A20 / 画面 clone-chat / 表 — / 関門 C1 C5 C2
- 依存 T-B-19
- 根拠（逐語）：D-107「サービス台帳で禁止（forbidden）と銀行（bank）のドメインは、自分のAI に仕事を渡すたびに Bridge が」 ／ D-041「サービス台帳で外部サービスごとの自動操作可否を持つ(api/allowed/unspecified/forbidden/」
- 触るファイル：packages/db/migrations/0046_bridge_blocked.sql (new)、apps/bridge/src/guard.ts (new)、apps/bridge/src/guard-hook.mjs (new)、apps/bridge/test/guard.test.ts (new)
- AC（Tier 1）：UBIQUITOUS: 規約で自動操作が禁止のサービスと銀行を、全部許可でも本人の PC の上で止める（ の成果物があり、type-check と build 
- AC（Tier 2）：EVENT-DRIVEN: WHEN 仕事を流す、システムは CLI の引数に --disallowedTools の WebFetch(domain:…) が ／ UNWANTED: IF Bridge が受け取る仕事、システムは ドメインの一覧だけ。資格情報・鍵が無い
- L1 行 7（['CHT-24-001', 'CHT-24-002', 'CHT-24-003'] …）／ L2 —
- audit: 07_tasks/audit/T-B-24.md

### T-B-25 自分のAI が Kaname の道具（MCP）で聞き取ったことをたたき台に置く（目標・台帳・担当業務とAI社員を置く・直す・外す・覚える・読む。鍵はその仕事の間だけ・聞かずに使える・証跡。Bridge は答えを待つ間を上限に数えない）

- group B / layer backend / phase 3_backend / wave 12 / Human 12 h・AI 3.0 h・wall-clock 4.0 h
- 行為 A06 A07 / 画面 onboard-interview onboard-draft / 表 — / 関門 C5 C2
- 依存 T-B-03
- 根拠（逐語）：D-110「自分のAI（本人の Claude Code）に Kaname の道具（MCP：目標・台帳・担当業務とAI社員を置く／直す」 ／ D-028「テストモード。OJTの入口を『見せてください』から『まず作ってみます』に変える。外に一切出さず実データは読む。納得したら」
- 触るファイル：packages/db/migrations/0049_agent_tools.sql (new)、apps/api/src/auth/agent-tools.ts (new)、apps/api/test/agent_tools.test.ts (new)、apps/bridge/src/kaname-tools.ts (new)
- AC（Tier 1）：UBIQUITOUS: 自分のAI が Kaname の道具（MCP）で聞き取ったことをたたき台に置く（ の成果物があり、type-check と build 
- AC（Tier 2）：EVENT-DRIVEN: WHEN 「たたき台を置いて」と話す → たたき台を開く（実ブラウザ）、システムは 目標・台帳・担当業務とAI社員のカードに置いたも ／ UNWANTED: IF 問い合わせに 10 分以上答えない、システムは 止まらずに続きが動く。何も出ないまま上限を過ぎたときだけ止まる
- L1 行 7（['CHT-25-001', 'CHT-25-002', 'CHT-25-003'] …）／ L2 —
- audit: 07_tasks/audit/T-B-25.md

### T-B-26 自分のAI の仕事の並びを画面が正しく見せる（開き直すと動いている・答えを待っている会話が出る・別の会話の仕事の後ろで待っている文は、どこを待っているかとそこへの道を出す）

- group B / layer backend / phase 3_backend / wave 14 / Human 4 h・AI 1.0 h・wall-clock 2.0 h
- 行為 A20 / 画面 clone-chat onboard-interview / 表 — / 関門 C2
- 依存 T-B-16
- 根拠（逐語）：D-104「会話は人が「新しく話す」で分け、一覧（探す・星・消す・記憶に残さない）から戻って続ける（1会話＝PCのClaudeの1セ」 ／ D-090「Bridge が仕事を受け取り、本人の Claude Code を --resume で呼んで返す。文脈は Claude」
- 触るファイル：packages/db/migrations/0050_agent_lane.sql (new)、apps/web/components/ai/work.tsx (new)、apps/web/tests/screens/clone-lane.spec.ts (new)
- AC（Tier 1）：UBIQUITOUS: 自分のAI の仕事の並びを画面が正しく見せる（開き直すと動いている・答えを待って の成果物があり、type-check と build 
- AC（Tier 2）：EVENT-DRIVEN: WHEN 前の会話で送る（実ブラウザ）、システムは 「別の会話で、自分のAI があなたの答えを待っています」と順番待ちに文が出て、そ ／ UNWANTED: IF 別の会話が答えを待っている、システムは 「別の会話で、自分のAI があなたの答えを待っています」と順番待ちに文が出て、その会話を開ける
- L1 行 2（['CHT-26-001', 'CHT-26-002'] …）／ L2 —
- audit: 07_tasks/audit/T-B-26.md

### T-B-27 作業中の行が本当のいまを出す（考えている・問い合わせを書いている・返事を書き始めたの切り替わりと最後の動き・PC が応答しなくなったらそう言う・途中で止まった Bridge の仕事は戻ってきたときに理由つきで止める）

- group B / layer backend / phase 3_backend / wave 14 / Human 6 h・AI 1.5 h・wall-clock 2.5 h
- 行為 A20 / 画面 clone-chat onboard-interview / 表 — / 関門 C5 C2
- 依存 T-B-16
- 根拠（逐語）：D-104「会話は人が「新しく話す」で分け、一覧（探す・星・消す・記憶に残さない）から戻って続ける（1会話＝PCのClaudeの1セ」 ／ D-090「Bridge が仕事を受け取り、本人の Claude Code を --resume で呼んで返す。文脈は Claude」
- 触るファイル：packages/db/migrations/0051_bridge_orphans.sql (new)、apps/bridge/src/stream.ts (new)、apps/web/components/ai/work.tsx (new)、apps/web/tests/screens/clone-progress.spec.ts (new)
- AC（Tier 1）：UBIQUITOUS: 作業中の行が本当のいまを出す（考えている・問い合わせを書いている・返事を書き始め の成果物があり、type-check と build 
- AC（Tier 2）：EVENT-DRIVEN: WHEN 会話を見る（実ブラウザ）、システムは 作業の行が「考えています…」で、最後の動きの秒数は出ない ／ UNWANTED: IF 作業中に Bridge が止まった、システムは 作業の行に 応答がありません と最後の知らせの時刻
- L1 行 4（['CHT-27-001', 'CHT-27-005', 'CHT-27-003'] …）／ L2 —
- audit: 07_tasks/audit/T-B-27.md

### T-B-29 答えた問い合わせを届かないまま捨てない（Bridge が受け取ったら印を付け、受け取らないまま止まった答えは、同じ会話で次に言ったときに自分のAI へ添えて渡す・二度は渡さない）

- group B / layer backend / phase 3_backend / wave 14 / Human 3 h・AI 0.8 h・wall-clock 1.8 h
- 行為 A20 A06 / 画面 clone-chat onboard-interview / 表 — / 関門 C2
- 依存 T-B-16
- 根拠（逐語）：D-104「会話は人が「新しく話す」で分け、一覧（探す・星・消す・記憶に残さない）から戻って続ける（1会話＝PCのClaudeの1セ」 ／ D-093「端末(tty)は要らずパイプで足りる。stream-json で完了イベントを受けるので「終了コード0=成功」にしない。」
- 触るファイル：packages/db/migrations/0052_answer_carry.sql (new)、apps/api/src/auth/ext.ts (new)、apps/api/test/bridge_orphans.test.ts (new)
- AC（Tier 1）：UBIQUITOUS: 答えた問い合わせを届かないまま捨てない（Bridge が受け取ったら印を付け、受 の成果物があり、type-check と build 
- AC（Tier 2）：EVENT-DRIVEN: WHEN もう一度言う、システムは 指示に答えが重ねて入らない ／ UNWANTED: IF 答えを渡した後、システムは 指示に答えが重ねて入らない
- L1 行 2（['CHT-29-001', 'CHT-29-002'] …）／ L2 —
- audit: 07_tasks/audit/T-B-29.md

### T-B-31 自分のAI の会話は本人の PC の Claude Code の記録が正本（文を記録と同じ id で写す・つながったとき／仕事の後に記録から写し漏れを取り戻す・同じ文を二度入れない・結末で答えを重ねない）

- group B / layer backend / phase 3_backend / wave 14 / Human 8 h・AI 2.0 h・wall-clock 3.0 h
- 行為 A20 A06 / 画面 clone-chat onboard-interview / 表 — / 関門 C5 C4 C2
- 依存 T-B-16
- 根拠（逐語）：D-112「自分のAI の会話の正本は、本人の PC の Claude Code の会話記録（~/.claude/projects 」 ／ D-100「仕事ごとに使った量（往復数・時間・入力と出力の量・費用の見込み）を残し、上限の知らせに使う。道具の呼び出しは名前・対象・」
- 触るファイル：packages/db/migrations/0053_transcript_mirror.sql (new)、apps/bridge/src/transcript.ts (new)、apps/api/test/transcript_mirror.test.ts (new)、apps/bridge/test/transcript.test.ts (new)
- AC（Tier 1）：UBIQUITOUS: 自分のAI の会話は本人の PC の Claude Code の記録が正本（文を の成果物があり、type-check と build 
- AC（Tier 2）：EVENT-DRIVEN: WHEN 読む、システムは 自分のAI の文だけが、記録の id と時刻のまま取り出せる ／ UNWANTED: IF 返事が出て仕事が閉じる直前、システムは 次の仕事として並び、送ったときのモードで動く
- L1 行 6（['CHT-31-001', 'CHT-31-002', 'CHT-31-003'] …）／ L2 —
- audit: 07_tasks/audit/T-B-31.md

### T-B-30 作業中は 1 行が切り替わる・内部の名前を出さない・絵文字を出さない・選んでもらう質問は問い合わせで（会話の決まりは Kaname が仕事ごとに渡す）

- group B / layer backend / phase 3_backend / wave 14 / Human 4 h・AI 1.0 h・wall-clock 2.0 h
- 行為 A20 / 画面 clone-chat onboard-interview / 表 — / 関門 C5
- 依存 T-B-16
- 根拠（逐語）：D-111「作業中は道具の行を並べず、いまの動きを「〇〇しています…」の 1 行で切り替えて出す（D-104.8 を改める）。道具の」 ／ D-104「会話は人が「新しく話す」で分け、一覧（探す・星・消す・記憶に残さない）から戻って続ける（1会話＝PCのClaudeの1セ」
- 触るファイル：apps/api/src/auth/conventions.ts (new)、apps/web/components/ai/work.tsx (new)、apps/web/components/ai/markdown.tsx (new)、apps/bridge/src/stream.ts (new)
- AC（Tier 1）：UBIQUITOUS: 作業中は 1 行が切り替わる・内部の名前を出さない・絵文字を出さない・選んでもら の成果物があり、type-check と build 
- AC（Tier 2）：EVENT-DRIVEN: WHEN 会話を見る（実ブラウザ）、システムは 「たたき台に目標を置いています：〇〇」と出て、画面のどこにも mcp__ が無い ／ UNWANTED: IF 会話の仕事、システムは 決まりに「AskUserQuestion の問い合わせで出す」「絵文字は使わない」が入って渡る
- L1 行 4（['CHT-30-001', 'CHT-30-002', 'CHT-30-003'] …）／ L2 —
- audit: 07_tasks/audit/T-B-30.md

### T-B-28 この PC の Bridge が別のアカウントでつながっているときは黙って切り替えない（理由を出し、本人が「このアカウントに切り替える」を押したときだけつなぐ）

- group B / layer backend / phase 3_backend / wave 11 / Human 3 h・AI 0.8 h・wall-clock 1.8 h
- 行為 A09 / 画面 bridge-setup / 表 — / 関門 C1 C2
- 依存 T-B-02
- 根拠（逐語）：D-089「はじめの設定の進み具合を人ごとに記録する（0〜6）。ログインや入口はその段へ戻す。飛ばす出口（あとでやる）は出さない。P」 ／ D-090「Bridge が仕事を受け取り、本人の Claude Code を --resume で呼んで返す。文脈は Claude」
- 触るファイル：apps/bridge/src/main.ts (new)、apps/bridge/src/local.ts (new)、apps/web/lib/bridge-presence.ts (new)、apps/web/tests/screens/setup-gate.spec.ts (new)
- AC（Tier 1）：UBIQUITOUS: この PC の Bridge が別のアカウントでつながっているときは黙って切り替 の成果物があり、type-check と build 
- AC（Tier 2）：EVENT-DRIVEN: WHEN 「このアカウントに切り替える」を押す（実ブラウザ）、システムは このアカウントでつながり、仕事を渡せる ／ UNWANTED: IF 理由が出ている、システムは このアカウントでつながり、仕事を渡せる
- L1 行 2（['CHT-28-001', 'CHT-28-002'] …）／ L2 —
- audit: 07_tasks/audit/T-B-28.md

### T-B-32 会話が変わったらサーバーから画面に知らせる（DB が member id だけを知らせる・API 1 台 1 本の専用接続で受ける・画面は知らせで読み直す・使えない間は見に行く形に戻る）

- group B / layer backend / phase 3_backend / wave 15 / Human 6 h・AI 1.5 h・wall-clock 2.5 h
- 行為 A20 / 画面 clone-chat onboard-interview / 表 — / 関門 C2
- 依存 T-B-16
- 根拠（逐語）：D-113「自分のAI の会話が変わったら（仕事・途中経過・会話・言ったこと の書き込み）、DB がその人の member id だ」
- 触るファイル：packages/db/migrations/0054_agent_notify.sql (new)、packages/db/src/listen.ts (new)、apps/api/src/auth/agent-stream.ts (new)、apps/web/lib/agent-stream.ts (new)
- AC（Tier 1）：UBIQUITOUS: 会話が変わったらサーバーから画面に知らせる（DB が member id だけを の成果物があり、type-check と build 
- AC（Tier 2）：EVENT-DRIVEN: WHEN 言って返事を待つ（実ブラウザ）、システムは 「考えています…」が出て、返事が出る ／ UNWANTED: IF 知らせの接続の通信が詰まる、システムは 受けている全員に down が伝わる
- L1 行 7（['CHT-32-001', 'CHT-32-002', 'CHT-32-003'] …）／ L2 —
- audit: 07_tasks/audit/T-B-32.md

### T-B-33 会話の固定枠（1024 以上で会話の箱だけを画面の残りの高さにし、吹き出しだけがスクロールする。段の帯・見出し・右の欄・入力欄は動かない。会話を本文に出す画面は全部 1 つの部品で）

- group B / layer backend / phase 3_backend / wave 15 / Human 3 h・AI 0.2 h・wall-clock 0.2 h
- 行為 A20 A06 / 画面 clone-chat onboard-interview onboard-draft / 表 — / 関門 —（画面の部品。外界に出ない）
- 依存 T-B-16
- 根拠（逐語）：D-072「手本は Linear / Notion。今日・承認待ち・タスクは三画面＝左に一覧（380px・1 行 48px・罫線・親」 ／ D-104「会話は人が「新しく話す」で分け、一覧（探す・星・消す・記憶に残さない）から戻って続ける（1会話＝PCのClaudeの1セ」
- 触るファイル：apps/web/components/ai/frame.tsx (new)、06_mockup/_chat.py (new)、apps/web/components/ai/chat.css (new)、apps/web/tests/screens/chat-frame.spec.ts (new)
- AC（Tier 1）：UBIQUITOUS: 会話の固定枠（1024 以上で会話の箱だけを画面の残りの高さにし、吹き出しだけが の成果物があり、type-check と build 
- AC（Tier 2）：EVENT-DRIVEN: WHEN 会話を上へ戻す（実ブラウザ）、システムは 会話の名前の位置は変わらず、入力欄は画面の中 ／ UNWANTED: IF 長い会話（375）、システムは 会話の中は溢れず、ページごと流れ、横に溢れない
- L1 行 3（['CHT-33-001', 'CHT-33-002', 'CHT-33-003'] …）／ L2 —
- audit: 07_tasks/audit/T-B-33.md

### T-B-34 はじめの設定の「分かったこと」は自分のAI が覚えた事実を「項目：内容」で出す（聞き取りの間だけは分かった事実をその場で覚える・送った文は並べない）

- group B / layer backend / phase 3_backend / wave 15 / Human 2 h・AI 0.2 h・wall-clock 0.2 h
- 行為 A06 / 画面 onboard-interview / 表 — / 関門 C5
- 依存 T-B-16
- 根拠（逐語）：D-114「はじめの設定の「話す」の右の欄「分かったこと」は、自分のAI が聞き取って記憶に落とした事実を「項目：内容」で出す（本人」
- 触るファイル：apps/web/app/(wizard)/onboard/interview/page.tsx (new)、apps/api/src/auth/conventions.ts (new)、apps/bridge/src/conventions.ts (new)、apps/api/test/conventions.test.ts (new)
- AC（Tier 1）：UBIQUITOUS: はじめの設定の「分かったこと」は自分のAI が覚えた事実を「項目：内容」で出す（ の成果物があり、type-check と build 
- AC（Tier 2）：EVENT-DRIVEN: WHEN 話す画面を開く（実ブラウザ）、システムは 「まだ何もありません」が出て、送った文は並ばない ／ UNWANTED: IF Kaname の道具、システムは 「項目：内容」があり、「1 件 1 文」が無い
- L1 行 5（['CHT-34-001', 'CHT-34-002', 'CHT-34-003'] …）／ L2 —
- audit: 07_tasks/audit/T-B-34.md

### T-B-35 吹き出しは AI の返答ごとに 1 つ（分かれるのは道具を使って結果を受け取った所だけ。1 回の返答の中で文が分かれても 1 つにつなぐ）

- group B / layer backend / phase 3_backend / wave 16 / Human 2 h・AI 0.2 h・wall-clock 0.2 h
- 行為 A20 A06 / 画面 clone-chat onboard-interview / 表 — / 関門 C5 C4 C2
- 依存 T-B-31
- 根拠（逐語）：D-115「自分のAI の吹き出しは、Claude の返答（返答の id）ごとに 1 つ。道具を使ってその結果を受け取ると次の返答に」
- 触るファイル：apps/bridge/src/transcript.ts (new)、apps/bridge/src/stream.ts (new)、apps/bridge/src/loop.ts (new)、packages/db/migrations/0055_entry_join.sql (new)
- AC（Tier 1）：UBIQUITOUS: 吹き出しは AI の返答ごとに 1 つ（分かれるのは道具を使って結果を受け取った の成果物があり、type-check と build 
- AC（Tier 2）：EVENT-DRIVEN: WHEN 続き／短い文／別の文を送る、システムは 続きだけで書き換わり、新しい吹き出しは足されない ／ UNWANTED: IF 同じ id の吹き出しがある、システムは 続きだけで書き換わり、新しい吹き出しは足されない
- L1 行 2（['CHT-35-001', 'CHT-35-002'] …）／ L2 —
- audit: 07_tasks/audit/T-B-35.md

### T-B-36 はじめの設定の進み方（次へ進むボタンは画面の下の帯に 1 つ・進めないときは理由・押せない段は何をすれば開くかを出す・次の段がまだ無いときは行き止まりにしない）

- group B / layer backend / phase 3_backend / wave 15 / Human 3 h・AI 0.2 h・wall-clock 0.2 h
- 行為 A07 A08 / 画面 onboard-draft onboard-interview bridge-setup credentials / 表 — / 関門 —（画面の部品。外界に出ない）
- 依存 T-B-16
- 根拠（逐語）：D-116「はじめの設定の次の段へ進む主ボタンは、画面の下に常に見える帯に 1 つ。進めないときは何をすれば進めるかを帯に書く。押せ」
- 触るファイル：apps/web/components/wizard/wizard-layout.tsx (new)、apps/web/lib/onboarding.ts (new)、06_mockup/_wiz.py (new)、apps/web/tests/screens/wizard-next.spec.ts (new)
- AC（Tier 1）：UBIQUITOUS: はじめの設定の進み方（次へ進むボタンは画面の下の帯に 1 つ・進めないときは理由 の成果物があり、type-check と build 
- AC（Tier 2）：EVENT-DRIVEN: WHEN 4 と 5 を押す（実ブラウザ）、システムは 「いまの段『3. たたき台』で…と開きます」「まだ作っていません」が出る ／ UNWANTED: IF 段 4 まで通した、システムは 「まだ使えません」が出て、押すといま使える画面へ移る（5・6 には行かない）
- L1 行 4（['CHT-36-001', 'CHT-36-002', 'CHT-36-003'] …）／ L2 —
- audit: 07_tasks/audit/T-B-36.md

### T-B-37 AI がブラウザを動かす土台（本人の Chrome＝Claude in Chrome が既定・Bridge 専用のブラウザ＝Playwright MCP・Bridge の窓で選ぶ・つながらないときは会話と自己診断に理由を出す・禁止の宛先は開く前と開いた後の両方で止める・Stagehand はやめる）

- group B / layer backend / phase 3_backend / wave 11 / Human 16 h・AI 4.0 h・wall-clock 5.0 h
- 行為 A09 A10 / 画面 bridge-setup clone-chat / 表 — / 関門 C1 C4 C5
- 依存 T-B-02
- 根拠（逐語）：D-119「AI（自分のAI・AI社員）がブラウザを動かすのは、本人のサブスクの Claude Code に渡す 2 つの道具だけ。」 ／ D-019「実装順序。Bridge(万能実行器)を最初に作る」
- 触るファイル：apps/bridge/src/browser.ts (new)、apps/bridge/src/guard.ts (new)、apps/bridge/src/runner.ts (new)、apps/bridge/src/loop.ts (new)
- AC（Tier 1）：UBIQUITOUS: AI がブラウザを動かす土台（本人の Chrome＝Claude in Chro の成果物があり、type-check と build 
- AC（Tier 2）：EVENT-DRIVEN: WHEN 同じ頼みごとをする（本物の Claude Code）、システムは 開いて読み、リンクの先の URL を答える。ログインの状 ／ UNWANTED: IF Chrome とつながっていない、システムは PC の画面の選択が専用のブラウザになり、次の仕事から使う
- L1 行 10（['CHT-37-003', 'CHT-37-004', 'CHT-37-005'] …）／ L2 —
- audit: 07_tasks/audit/T-B-37.md

### T-B-38 ログイン情報を預けたらその場で 1 回ログインだけ試す（入れたらそのまま出る・ほかの操作はしない・結果を預けたものの行に出す）

- group B / layer backend / phase 3_backend / wave 15 / Human 6 h・AI 1.5 h・wall-clock 2.5 h
- 行為 A10 / 画面 credentials / 表 — / 関門 C1 C8
- 依存 T-B-37 T-B-05
- 根拠（逐語）：D-117「ログイン情報を預けたら、Bridge がそのサービスに 1 回だけログインして、入れたらそのまま出る（ほかの操作はしない」 ／ D-017「vaultにID/PW＋TOTPシークレットを暗号化保管し実行器が直接入力。AIには一切渡さない(参照IDのみ)」
- 触るファイル：apps/bridge/src/login-check.ts (new)、apps/web/app/(app)/settings/credentials/page.tsx (new)、apps/web/tests/screens/credentials.spec.ts (new)
- AC（Tier 1）：UBIQUITOUS: ログイン情報を預けたらその場で 1 回ログインだけ試す（入れたらそのまま出る・ほ の成果物があり、type-check と build 
- AC（Tier 2）：EVENT-DRIVEN: WHEN 保存する（実ブラウザ）、システムは 理由と次の一手が出る。何度も試さない ／ UNWANTED: IF 預けたログイン情報、システムは 入力された後、鍵がメモリにもファイルにも残っていない
- L1 行 3（['CHT-38-001', 'CHT-38-002', 'CHT-38-003'] …）／ L2 —
- audit: 07_tasks/audit/T-B-38.md

### T-B-39 2 段階認証（種類を選ぶ・認証アプリは鍵で自動・SMS／メール／スマホ承認はその場で本人に頼む・コードは Bridge だけに・ログインを覚えておく・10 分返事が無ければ止めて本人がいる時間に回す）

- group B / layer backend / phase 3_backend / wave 15 / Human 8 h・AI 2.0 h・wall-clock 3.0 h
- 行為 A10 A11 / 画面 credentials approvals / 表 — / 関門 C1 C6 C8
- 依存 T-B-37 T-B-05
- 根拠（逐語）：D-117「ログイン情報を預けたら、Bridge がそのサービスに 1 回だけログインして、入れたらそのまま出る（ほかの操作はしない」 ／ D-017「vaultにID/PW＋TOTPシークレットを暗号化保管し実行器が直接入力。AIには一切渡さない(参照IDのみ)」
- 触るファイル：apps/bridge/src/two-factor.ts (new)、apps/web/app/(app)/settings/credentials/page.tsx (new)、apps/web/tests/screens/credentials.spec.ts (new)
- AC（Tier 1）：UBIQUITOUS: 2 段階認証（種類を選ぶ・認証アプリは鍵で自動・SMS／メール／スマホ承認はその の成果物があり、type-check と build 
- AC（Tier 2）：EVENT-DRIVEN: WHEN 承認待ちでコードを入れる（実ブラウザ）、システムは ログインが通り、コードは AI の会話にも記録にも出ない ／ UNWANTED: IF コードを頼んだまま 10 分、システムは 仕事が理由つきで止まり、何度も試さない
- L1 行 4（['CHT-39-001', 'CHT-39-002', 'CHT-39-003'] …）／ L2 —
- audit: 07_tasks/audit/T-B-39.md

### T-B-40 会話の画面を詰める・広げる（見出しと説明を 1 行に・入力欄を低く・「会話を広げる」で会話だけ・Esc で戻る・測り直しても読んでいる位置を動かさない）

- group B / layer backend / phase 3_backend / wave 15 / Human 3 h・AI 0.2 h・wall-clock 0.2 h
- 行為 A06 A07 / 画面 onboard-interview onboard-draft / 表 — / 関門 —（画面の部品。外界に出ない）
- 依存 T-B-16
- 根拠（逐語）：D-118「会話が本文の画面（はじめの設定の話す・たたき台を会話で直す）は、見出しと説明を 1 行に詰め、押せない段の案内は出たとき」 ／ D-072「手本は Linear / Notion。今日・承認待ち・タスクは三画面＝左に一覧（380px・1 行 48px・罫線・親」
- 触るファイル：apps/web/components/wizard/wizard-layout.tsx (new)、apps/web/components/ai/frame.tsx (new)、06_mockup/_chat.py (new)、apps/web/tests/screens/chat-frame.spec.ts (new)
- AC（Tier 1）：UBIQUITOUS: 会話の画面を詰める・広げる（見出しと説明を 1 行に・入力欄を低く・「会話を広げ の成果物があり、type-check と build 
- AC（Tier 2）：EVENT-DRIVEN: WHEN 広げる → Esc → 広げる → 元に戻す（実ブラウザ）、システムは 縦にも横にも広がり、いちばん下のまま。ページは動か ／ UNWANTED: IF 長い会話、システムは 縦にも横にも広がり、いちばん下のまま。ページは動かない。戻すと元の形
- L1 行 2（['CHT-40-001', 'CHT-40-002'] …）／ L2 —
- audit: 07_tasks/audit/T-B-40.md

### T-US-08 会話の部品の作り込み（D-104：吹き出し・書式と図とカードと資料の描画・作業の行・問い合わせ・許可の 3 択・入力欄の箱・声・@・文脈・返事への操作・画面の動き・知らせ・読み上げ）

- group U-shared / layer ui / phase 4_ui_foundation / wave 19 / Human 40 h・AI 10.0 h・wall-clock 11.0 h
- 行為 A20 A88 A89 A90 A91 / 画面 clone-chat onboard-interview onboard-draft clone-thread / 表 — / 関門 —（画面の部品。外界に出ない（API は関門の先））
- 依存 T-US-02 T-B-16
- 根拠（逐語）：D-104「会話は人が「新しく話す」で分け、一覧（探す・星・消す・記憶に残さない）から戻って続ける（1会話＝PCのClaudeの1セ」
- 触るファイル：apps/web/components/ai/markdown.tsx (new)、apps/web/components/ai/work.tsx (new)、apps/web/components/ai/question.tsx (new)、apps/web/components/ai/composer.tsx (new)
- AC（Tier 1）：STATE-DRIVEN: WHILE 会話を描画中 THEN 部品は AgentChat 1 つ（chat_one）で、色・文字・角丸は DESIGN-kan
- AC（Tier 2）：EVENT-DRIVEN: WHEN 日本語を変換して Enter THEN 送らない（Safari も） ／ UNWANTED: IF 上を読んでいる間に返事が来たら THEN 下へ飛ばず「いちばん下へ」を出す
- L1 行 17（['USH-08-001', 'USH-08-002', 'USH-08-003'] …）／ L2 —
- audit: 07_tasks/audit/T-US-08.md

### T-V2-01 段階 2 の仕様づくり：payment（課金）の E-PAY-*。C7 は N/A（理由つき）

- group V2 / layer spec / phase 8_spec_v2 / wave 5 / Human 16 h・AI 2.7 h・wall-clock 2.7 h
- 行為 — / 画面 — / 表 — / 関門 —（仕様の作業。外界には触れない）
- 依存 T-F-18
- 根拠（逐語）：D-069「エラーの正本は 07_qa/test-specs/errors.json（第13軸）。モックの異常状態・関門・行為の裏側」
- 触るファイル：01_hearing/決定ログ_進行中.md (modify)、05_flow/data.py (modify)、06_mockup/s_p11.py (new)、03_architecture/ER図.md (modify)
- AC（Tier 1）：UBIQUITOUS: payment（課金）の E-PAY-*。C7 は N/A（理由つき） の画面・行為が flow.json の release に入り、
- AC（Tier 2）：EVENT-DRIVEN: WHEN 決定ログに payment（課金）の E-PAY-*。C7 は N/A（理由つき） の節を足したら、システム（ゲート）は  ／ UNWANTED: IF 決定の無い後回しや、オブジェクトの無い『作る・配る・版』の文が残ったら、G17／T10 が赤のまま実装タスクを生成しない
- L1 行 5（['SPC-01-001', 'SPC-01-002', 'SPC-01-003'] …）／ L2 —
- audit: 07_tasks/audit/T-V2-01.md

### T-V2-02 段階 2 の仕様づくり：Stripe 課金

- group V2 / layer spec / phase 8_spec_v2 / wave 5 / Human 16 h・AI 2.7 h・wall-clock 2.7 h
- 行為 A05 / 画面 — / 表 — / 関門 —（仕様の作業。外界には触れない）
- 依存 T-F-18
- 根拠（逐語）：D-081「サマリーの段階表（段階 2＝課金・オンボーディング・構築メタスキル・運営コンソール）は D-073〜D-080 で v1」 ／ D-002「65社・月630万。エントリー(個人/一人社長3万)・スタンダード(中小8万)・プロ(中堅15万)の3層。エントリーが集」
- 触るファイル：01_hearing/決定ログ_進行中.md (modify)、05_flow/data.py (modify)、06_mockup/s_p11.py (new)、03_architecture/ER図.md (modify)
- AC（Tier 1）：UBIQUITOUS: Stripe 課金 の画面・行為が flow.json の release に入り、G17 の deferred から D-081.2 
- AC（Tier 2）：EVENT-DRIVEN: WHEN 決定ログに Stripe 課金 の節を足したら、システム（ゲート）は trace_gate T1〜T10・flow_gat ／ UNWANTED: IF 決定の無い後回しや、オブジェクトの無い『作る・配る・版』の文が残ったら、G17／T10 が赤のまま実装タスクを生成しない
- L1 行 5（['SPC-02-001', 'SPC-02-002', 'SPC-02-003'] …）／ L2 —
- audit: 07_tasks/audit/T-V2-02.md

### T-V2-03 段階 2 の仕様づくり：LLM の経路の追加

- group V2 / layer spec / phase 8_spec_v2 / wave 5 / Human 16 h・AI 2.7 h・wall-clock 2.7 h
- 行為 — / 画面 — / 表 — / 関門 —（仕様の作業。外界には触れない）
- 依存 T-F-18
- 根拠（逐語）：D-081「サマリーの段階表（段階 2＝課金・オンボーディング・構築メタスキル・運営コンソール）は D-073〜D-080 で v1」 ／ D-043「ネイティブアプリはレスポンシブとは別物。プッシュ通知が本質(承認待ちの通知)。段階2でPWA」
- 触るファイル：01_hearing/決定ログ_進行中.md (modify)、05_flow/data.py (modify)、06_mockup/s_p11.py (new)、03_architecture/ER図.md (modify)
- AC（Tier 1）：UBIQUITOUS: LLM の経路の追加 の画面・行為が flow.json の release に入り、G17 の deferred から D-081.3
- AC（Tier 2）：EVENT-DRIVEN: WHEN 決定ログに LLM の経路の追加 の節を足したら、システム（ゲート）は trace_gate T1〜T10・flow_ga ／ UNWANTED: IF 決定の無い後回しや、オブジェクトの無い『作る・配る・版』の文が残ったら、G17／T10 が赤のまま実装タスクを生成しない
- L1 行 5（['SPC-03-001', 'SPC-03-002', 'SPC-03-003'] …）／ L2 —
- audit: 07_tasks/audit/T-V2-03.md

### T-V2-04 段階 2 の仕様づくり：アプリ（PC・スマホ）

- group V2 / layer spec / phase 8_spec_v2 / wave 5 / Human 16 h・AI 2.7 h・wall-clock 2.7 h
- 行為 — / 画面 — / 表 — / 関門 —（仕様の作業。外界には触れない）
- 依存 T-F-18
- 根拠（逐語）：D-081「サマリーの段階表（段階 2＝課金・オンボーディング・構築メタスキル・運営コンソール）は D-073〜D-080 で v1」 ／ D-084「PC は Bridge（Electron）の窓に Kaname の画面を出す。スマホは同じ Web を Capacito」
- 触るファイル：01_hearing/決定ログ_進行中.md (modify)、05_flow/data.py (modify)、06_mockup/s_p11.py (new)、03_architecture/ER図.md (modify)
- AC（Tier 1）：UBIQUITOUS: アプリ（PC・スマホ） の画面・行為が flow.json の release に入り、G17 の deferred から D-081.
- AC（Tier 2）：EVENT-DRIVEN: WHEN 決定ログに アプリ（PC・スマホ） の節を足したら、システム（ゲート）は trace_gate T1〜T10・flow_g ／ UNWANTED: IF 決定の無い後回しや、オブジェクトの無い『作る・配る・版』の文が残ったら、G17／T10 が赤のまま実装タスクを生成しない
- L1 行 5（['SPC-04-001', 'SPC-04-002', 'SPC-04-003'] …）／ L2 —
- audit: 07_tasks/audit/T-V2-04.md

### T-V2-05 段階 2 の仕様づくり：情シス向けの開示資料

- group V2 / layer spec / phase 8_spec_v2 / wave 5 / Human 16 h・AI 2.7 h・wall-clock 2.7 h
- 行為 — / 画面 — / 表 — / 関門 —（仕様の作業。外界には触れない）
- 依存 T-F-18
- 根拠（逐語）：D-081「サマリーの段階表（段階 2＝課金・オンボーディング・構築メタスキル・運営コンソール）は D-073〜D-080 で v1」 ／ D-085「できる操作の完全な列挙・送るもの／送らないもの・サブプロセッサ一覧・アンインストールの検証結果 は成果物（行為×関門・依」
- 触るファイル：01_hearing/決定ログ_進行中.md (modify)、05_flow/data.py (modify)、06_mockup/s_p11.py (new)、03_architecture/ER図.md (modify)
- AC（Tier 1）：UBIQUITOUS: 情シス向けの開示資料 の画面・行為が flow.json の release に入り、G17 の deferred から D-081.5
- AC（Tier 2）：EVENT-DRIVEN: WHEN 決定ログに 情シス向けの開示資料 の節を足したら、システム（ゲート）は trace_gate T1〜T10・flow_ga ／ UNWANTED: IF 決定の無い後回しや、オブジェクトの無い『作る・配る・版』の文が残ったら、G17／T10 が赤のまま実装タスクを生成しない
- L1 行 5（['SPC-05-001', 'SPC-05-002', 'SPC-05-003'] …）／ L2 —
- audit: 07_tasks/audit/T-V2-05.md
