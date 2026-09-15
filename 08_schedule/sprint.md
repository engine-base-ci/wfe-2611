# Kaname Wave 編成・スプリント計画（v3・2026-09-15・機械生成）

> 05_flow/build_waves.py が生成。信頼源は wave-schedule.json。根拠の決定：D-053.1 D-036.4。開始 2026-09-22・Wave 19・タスク 153・Human 4758.0 h／AI wall-clock 203.7 h（並列 10）

## 原則

- Phase 順序を守る（Foundation → Data → API → UI 共通 → UI 並列 → 結線）。Phase をまたいで並列にしない
- Phase 内は並列上限まで並列（CAP 10）
- Phase 3 の最後（A の最終 Wave）で契約凍結：OpenAPI・TS 型・画面 ↔ API 100%（既に 08_api で凍結済み）
- スキル制作（S）は開発と並行。Wave の締めには含めるが Phase 順序には縛られない
- Wave の締め＝completion_gate.sh STATUS 完了。全 PR の auto-merge は締めではない

## staging

確定：{"shape": "本番と同じ構成をもう 1 組", "database": "Supabase 別プロジェクト（本番と同じ migration を Drizzle で適用・seed はテスト会社）", "api_worker_ingestion": "Railway の別環境（本番と同じ Dockerfile／deploy）", "frontend": "Vercel Preview（環境変数だけ staging 向け）", "secrets": "Infisical の staging 環境（本番と分ける）", "rule": "本番と同じ migration／deploy／プロビジョニングコードで作れること。L1〜L3 はここで流す。本番は L4 のスモークだけ", "owner_task": "T-F-16（外部リソースのコード化）で最初に作る", "decided": "2026-09-15 user 選択（候補：同構成もう 1 組／Supabase Branching／あとで）", "source": ["D-053.1"]}

## 節目

| ID | 名前 | 期限 |
|---|---|---|
| W0 | Foundation（関門・権限・証跡・認証・CI） | 2026-10-02 |
| W1 | データ層と API 契約が動く | 2026-10-16 |
| W2 | 最初の流れ（登録〜はじめの設定）が触れる | 2026-10-30 |
| W3 | 全画面が実データで動く | 2026-11-20 |
| R1 | 段階 1 リリース（結線・流れ・負荷・監査） | 2026-12-11 |

## Wave（Phase × Sprint・二軸）

| Wave | Sprint | Phase | タスク | 並列 | Human h | AI 計算 h | レビュー h | wall-clock h | 開始 | 終了 | 節目 | L1 行 | L2 の流れ | 回帰 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| W0 | F1 | Foundation | 10 | 10 | 160 | 24.1 | 4.0 | 6.5 | 2026-09-22 | 2026-09-25 | W0 | 80 | — | 0 |
| W1 | F2 | Foundation | 7 | 7 | 88 | 10.5 | 2.0 | 4.5 | 2026-09-24 | 2026-09-29 | W0 | 56 | — | 1 |
| W2 | D1 | Data Layer | 10 | 10 | 484 | 76.8 | 4.0 | 23.5 | 2026-09-24 | 2026-10-20 | W2 | 152 | — | 2 |
| W3 | D2 | Data Layer | 2 | 2 | 62 | 5.1 | 0.0 | 3.3 | 2026-09-29 | 2026-09-29 | W0 | 22 | — | 3 |
| W4 | A1 | API Layer | 10 | 10 | 846 | 211.4 | 10.0 | 39.5 | 2026-10-02 | 2026-10-28 | W2 | 313 | — | 4 |
| W5 | A2 | API Layer | 10 | 10 | 1075 | 241.2 | 8.0 | 39.5 | 2026-10-02 | 2026-11-09 | W3 | 327 | — | 5 |
| W6 | A3 | API Layer | 3 | 3 | 327 | 53.2 | 1.0 | 40.3 | 2026-10-21 | 2026-10-27 | W2 | 68 | — | 6 |
| W7 | U0 | UI Foundation | 6 | 6 | 112 | 11.2 | 0.0 | 3.7 | 2026-10-27 | 2026-10-27 | W2 | 48 | — | 7 |
| W8 | U1 | UI Parallel | 10 | 10 | 156.0 | 15.5 | 0.0 | 2.4 | 2026-10-28 | 2026-11-05 | W3 | 268 | J-01 | 8 |
| W9 | U2 | UI Parallel | 10 | 10 | 225.5 | 22.7 | 0.0 | 4.5 | 2026-10-28 | 2026-11-05 | W3 | 369 | J-02 | 9 |
| W10 | U3 | UI Parallel | 10 | 10 | 185.5 | 18.5 | 0.0 | 2.7 | 2026-10-30 | 2026-11-06 | W3 | 340 | J-03 J-04 | 10 |
| W11 | U4 | UI Parallel | 10 | 10 | 180.5 | 18.0 | 0.0 | 3.0 | 2026-11-02 | 2026-11-09 | W3 | 333 | J-05 J-06 J-08 | 11 |
| W12 | U5 | UI Parallel | 10 | 10 | 153.5 | 15.4 | 0.0 | 2.8 | 2026-11-06 | 2026-11-10 | W3 | 300 | — | 12 |
| W13 | U6 | UI Parallel | 8 | 8 | 99.0 | 10.1 | 0.0 | 2.3 | 2026-11-06 | 2026-11-10 | W3 | 229 | J-07 J-09 | 13 |
| W14 | I1 | Integration & Polish | 10 | 10 | 206 | 35.0 | 4.0 | 9.5 | 2026-11-05 | 2026-11-16 | W3 | 60 | — | 14 |
| W15 | I2 | Integration & Polish | 10 | 10 | 224 | 24.8 | 1.0 | 5.5 | 2026-11-10 | 2026-11-19 | W3 | 35 | — | 15 |
| W16 | I3 | Integration & Polish | 2 | 2 | 20 | 2.0 | 0.0 | 1.7 | 2026-09-24 | 2026-11-18 | W3 | 14 | — | 16 |
| W17 | S1 | スキル制作（運営の資産・開発と並行） | 10 | 10 | 112 | 28.0 | 10.0 | 4.5 | 2026-11-11 | 2026-11-18 | W3 | 69 | — | 17 |
| W18 | S2 | スキル制作（運営の資産・開発と並行） | 5 | 5 | 42 | 10.5 | 5.0 | 4.0 | 2026-11-17 | 2026-11-18 | W3 | 35 | — | 18 |

## 各 Wave の中身

### W0（F1・Foundation）2026-09-22〜2026-09-25

- 目標：Foundation：monorepo と CI（lint, アクセス制御の土台（RLS・app., アクセス制御の土台（RLS・app. …
- タスク：T-F-01 T-F-02 T-F-03 T-F-04 T-F-05 T-F-06 T-F-07 T-F-08 T-F-09 T-F-10
- 担当：takamoto 4, claude-01 2, claude-02 4
- 致命級（人のレビュー）：T-F-02 T-F-03 T-F-05 T-F-06
- L3 の範囲：L1 80 行／L2 —／回帰 —
- 締め：bash scripts/ci/completion_gate.sh --wave W0

### W1（F2・Foundation）2026-09-24〜2026-09-29

- 目標：Foundation：関門 C5 プロセス起動（生 API, 関門 C6 通知送出（生 API の, 関門 C7 決済・課金（生 API  …
- タスク：T-F-11 T-F-12 T-F-13 T-F-14 T-F-15 T-F-16 T-F-17
- 担当：claude-02 2, takamoto 2, claude-01 3
- 致命級（人のレビュー）：T-F-13 T-F-14
- L3 の範囲：L1 56 行／L2 —／回帰 W0
- 締め：bash scripts/ci/completion_gate.sh --wave W1

### W2（D1・Data Layer）2026-09-24〜2026-10-20

- 目標：Data Layer：データ層 1. テナント・組織・メン, データ層 2. 会社モデル ── 目, データ層 3. 会社モデル ── 台 …
- タスク：T-D-01 T-D-02 T-D-03 T-D-04 T-D-05 T-D-06 T-D-07 T-D-08 T-D-09 T-D-10
- 担当：claude-02 4, takamoto 4, claude-01 2
- 致命級（人のレビュー）：T-D-05 T-D-07 T-D-08 T-D-10
- L3 の範囲：L1 152 行／L2 —／回帰 W0 W1
- 締め：bash scripts/ci/completion_gate.sh --wave W2

### W3（D2・Data Layer）2026-09-29〜2026-09-29

- 目標：Data Layer：データ層 13. 取り込み・正規連携, データ層 14. スキル（4 表・m
- タスク：T-D-11 T-D-12
- 担当：claude-02 1, claude-01 1
- 致命級（人のレビュー）：—
- L3 の範囲：L1 22 行／L2 —／回帰 W0 W1 W2
- 締め：bash scripts/ci/completion_gate.sh --wave W3

### W4（A1・API Layer）2026-10-02〜2026-10-28

- 目標：API Layer：API 契約してから、自力で動く状態, API 招かれたので、自分がやること, API 入れなくなったときに、自分で …
- タスク：T-A-01 T-A-02 T-A-03 T-A-04 T-A-05 T-A-06 T-A-07 T-A-08 T-A-09 T-A-10
- 担当：claude-03 3, claude-05 3, claude-04 2, claude-02 1, claude-01 1
- 致命級（人のレビュー）：T-A-01 T-A-02 T-A-03 T-A-04 T-A-05 T-A-06 T-A-07 T-A-08 T-A-09 T-A-10
- L3 の範囲：L1 313 行／L2 —／回帰 W0 W1 W2 W3
- 締め：bash scripts/ci/completion_gate.sh --wave W4

### W5（A2・API Layer）2026-10-02〜2026-11-09

- 目標：API Layer：API なぜ届かなかったかを言葉にし, API 人に任せたい。任せても品質が, API 人に任せたい。任せても品質が …
- タスク：T-A-11 T-A-12 T-A-13 T-A-14 T-A-15 T-A-16 T-A-17 T-A-18 T-A-19 T-A-20
- 担当：claude-04 2, claude-01 2, claude-05 2, claude-03 3, takamoto 1
- 致命級（人のレビュー）：T-A-12 T-A-13 T-A-14 T-A-15 T-A-17 T-A-18 T-A-19 T-A-20
- L3 の範囲：L1 327 行／L2 —／回帰 W0 W1 W2 W3 W4
- 締め：bash scripts/ci/completion_gate.sh --wave W5

### W6（A3・API Layer）2026-10-21〜2026-10-27

- 目標：API Layer：API 運営として、外部サービスの可, API 運営として、公開の申請を審査, API 運営として、各社に配るもの（
- タスク：T-A-21 T-A-22 T-A-23
- 担当：claude-04 1, claude-02 1, claude-05 1
- 致命級（人のレビュー）：T-A-22
- L3 の範囲：L1 68 行／L2 —／回帰 W0 W1 W2 W3 W4 W5
- 締め：bash scripts/ci/completion_gate.sh --wave W6

### W7（U0・UI Foundation）2026-10-27〜2026-10-27

- 目標：UI Foundation：シェル（サイドバー・レール・第2ナビ, 自分のAIのパネルと会話の部品（as, API クライアントと型（OpenA …
- タスク：T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06
- 担当：claude-06 1, claude-07 1, claude-08 2, claude-09 2
- 致命級（人のレビュー）：—
- L3 の範囲：L1 48 行／L2 —／回帰 W0 W1 W2 W3 W4 W5 W6
- 締め：bash scripts/ci/completion_gate.sh --wave W7

### W8（U1・UI Parallel）2026-10-28〜2026-11-05

- 目標：UI Parallel：画面 アカウントを作る（2 状態・R, 画面 メールを確認する（3 状態・R, 画面 招待を受けて参加する（3 状態 …
- タスク：T-U-01 T-U-02 T-U-03 T-U-04 T-U-05 T-U-06 T-U-07 T-U-08 T-U-09 T-U-10
- 担当：claude-06 3, claude-08 3, claude-07 2, claude-09 2
- 致命級（人のレビュー）：—
- L3 の範囲：L1 268 行／L2 J-01／回帰 W0 W1 W2 W3 W4 W5 W6 W7
- 締め：bash scripts/ci/completion_gate.sh --wave W8

### W9（U2・UI Parallel）2026-10-28〜2026-11-05

- 目標：UI Parallel：画面 テストで動かす（3 状態・R1, 画面 本番に切り替える（2 状態・R, 画面 今日（5 状態・R1/R2/R …
- タスク：T-U-11 T-U-12 T-U-13 T-U-14 T-U-15 T-U-16 T-U-17 T-U-18 T-U-19 T-U-20
- 担当：claude-07 3, claude-06 4, claude-09 2, claude-08 1
- 致命級（人のレビュー）：—
- L3 の範囲：L1 369 行／L2 J-02／回帰 W0 W1 W2 W3 W4 W5 W6 W7 W8
- 締め：bash scripts/ci/completion_gate.sh --wave W9

### W10（U3・UI Parallel）2026-10-30〜2026-11-06

- 目標：UI Parallel：画面 台帳の1件（3 状態・R1/R, 画面 目標（5 状態・R1/R2/R, 画面 目標の配分（6 状態・R1/R …
- タスク：T-U-21 T-U-22 T-U-23 T-U-24 T-U-25 T-U-26 T-U-27 T-U-28 T-U-29 T-U-30
- 担当：claude-07 3, claude-08 3, claude-09 2, claude-06 2
- 致命級（人のレビュー）：—
- L3 の範囲：L1 340 行／L2 J-03 J-04／回帰 W0 W1 W2 W3 W4 W5 W6 W7 W8 W9
- 締め：bash scripts/ci/completion_gate.sh --wave W10

### W11（U4・UI Parallel）2026-11-02〜2026-11-09

- 目標：UI Parallel：画面 会社モデル（5 状態・R1/R, 画面 覚え直させる（3 状態・R1/, 画面 証跡（6 状態・R1/R2） …
- タスク：T-U-31 T-U-32 T-U-33 T-U-34 T-U-35 T-U-36 T-U-37 T-U-38 T-U-39 T-U-40
- 担当：claude-07 2, claude-06 3, claude-09 3, claude-08 2
- 致命級（人のレビュー）：—
- L3 の範囲：L1 333 行／L2 J-05 J-06 J-08／回帰 W0 W1 W2 W3 W4 W5 W6 W7 W8 W9 W10
- 締め：bash scripts/ci/completion_gate.sh --wave W11

### W12（U5・UI Parallel）2026-11-06〜2026-11-10

- 目標：UI Parallel：画面 運営の支援（2 状態・R6）, 画面 運営：会社の一覧（4 状態・R, 画面 運営：配るもの（7 状態・R6 …
- タスク：T-U-41 T-U-42 T-U-43 T-U-44 T-U-45 T-U-46 T-U-47 T-U-48 T-U-49 T-U-50
- 担当：claude-07 3, claude-08 3, claude-06 2, claude-09 2
- 致命級（人のレビュー）：—
- L3 の範囲：L1 300 行／L2 —／回帰 W0 W1 W2 W3 W4 W5 W6 W7 W8 W9 W10 W11
- 締め：bash scripts/ci/completion_gate.sh --wave W12

### W13（U6・UI Parallel）2026-11-06〜2026-11-10

- 目標：UI Parallel：画面 お知らせと通知（3 状態・R1, 画面 プランと請求（3 状態・R1/, 画面 運営：お知らせ（2 状態・R6 …
- タスク：T-U-51 T-U-52 T-U-53 T-U-54 T-U-55 T-U-56 T-U-57 T-U-58
- 担当：claude-06 2, claude-07 2, claude-08 2, claude-09 2
- 致命級（人のレビュー）：—
- L3 の範囲：L1 229 行／L2 J-07 J-09／回帰 W0 W1 W2 W3 W4 W5 W6 W7 W8 W9 W10 W11 W12
- 締め：bash scripts/ci/completion_gate.sh --wave W13

### W14（I1・Integration & Polish）2026-11-05〜2026-11-16

- 目標：Integration & Polish：実行ループの結線（自分のAI → 配, 認証 → 会社 → 権限 → 画面の, 画面 → API → DB の通し配 …
- タスク：T-I-01 T-I-02 T-I-03 T-I-04 T-I-05 T-I-06 T-I-07 T-I-08 T-I-09 T-I-10
- 担当：claude-10 10
- 致命級（人のレビュー）：T-I-01 T-I-02 T-I-05 T-I-08
- L3 の範囲：L1 60 行／L2 —／回帰 W0 W1 W2 W3 W4 W5 W6 W7 W8 W9 W10 W11 W12 W13
- 締め：bash scripts/ci/completion_gate.sh --wave W14

### W15（I2・Integration & Polish）2026-11-10〜2026-11-19

- 目標：Integration & Polish：流れ J-03 P2 毎日 ── 自, 流れ J-04 P3 毎週 を最後ま, 流れ J-05 P4 毎月・四半期  …
- タスク：T-I-11 T-I-12 T-I-13 T-I-14 T-I-15 T-I-16 T-I-17 T-I-18 T-I-19 T-I-20
- 担当：claude-10 8, claude-09 2
- 致命級（人のレビュー）：T-I-20
- L3 の範囲：L1 35 行／L2 —／回帰 W0 W1 W2 W3 W4 W5 W6 W7 W8 W9 W10 W11 W12 W13 W14
- 締め：bash scripts/ci/completion_gate.sh --wave W15

### W16（I3・Integration & Polish）2026-09-24〜2026-11-18

- 目標：Integration & Polish：ポータビリティと依存の境界の検査（境, 文書とリリース準備（できること・でき
- タスク：T-I-21 T-I-22
- 担当：claude-09 1, claude-10 1
- 致命級（人のレビュー）：—
- L3 の範囲：L1 14 行／L2 —／回帰 W0 W1 W2 W3 W4 W5 W6 W7 W8 W9 W10 W11 W12 W13 W14 W15
- 締め：bash scripts/ci/completion_gate.sh --wave W16

### W17（S1・スキル制作（運営の資産・開発と並行））2026-11-11〜2026-11-18

- 目標：スキル制作（運営の資産・開発と並行）：スキル一式の形式・雛形・検査（ski, スキル制作 構築メタ「会社モデル構築, スキル制作 構築メタ「担当業務の定義 …
- タスク：T-S-01 T-S-02 T-S-03 T-S-04 T-S-05 T-S-06 T-S-07 T-S-08 T-S-09 T-S-10
- 担当：claude-09 9, claude-10 1
- 致命級（人のレビュー）：T-S-01 T-S-02 T-S-03 T-S-04 T-S-05 T-S-06 T-S-07 T-S-08 T-S-09 T-S-10
- L3 の範囲：L1 69 行／L2 —／回帰 W0 W1 W2 W3 W4 W5 W6 W7 W8 W9 W10 W11 W12 W13 W14 W15 W16
- 締め：bash scripts/ci/completion_gate.sh --wave W17

### W18（S2・スキル制作（運営の資産・開発と並行））2026-11-17〜2026-11-18

- 目標：スキル制作（運営の資産・開発と並行）：スキル制作 目標スキル「納期遵守（制, スキル制作 業務スキル「発注ナビの新, スキル制作 業務スキル「請求書の作成 …
- タスク：T-S-11 T-S-12 T-S-13 T-S-14 T-S-15
- 担当：claude-10 3, claude-09 2
- 致命級（人のレビュー）：T-S-11 T-S-12 T-S-13 T-S-14 T-S-15
- L3 の範囲：L1 35 行／L2 —／回帰 W0 W1 W2 W3 W4 W5 W6 W7 W8 W9 W10 W11 W12 W13 W14 W15 W16 W17
- 締め：bash scripts/ci/completion_gate.sh --wave W18

## 完了の定義

- 3-tier AC 全 pass（tickets acceptance_criteria_inline）
- v3-gate.yml 36 本緑（e2e は has-ui）
- qa-ladder gate --task PASS（L1 全行 PASS か理由つき BLOCKED）
- 揃った流れ（L2）PASS
- audit MD に impl line

## リスク

| リスク | 手当て |
|---|---|
| staging 未確定のまま W0 に入る | W0 の最初の日に確定。無いと L1 は実走できない（BLOCKED を fake green にしない） |
| 致命級（人のレビュー）が 49 タスクで高本さんに集中 | レビューは Wave 内で並列に流し、blocking の順に見る（tickets_plan critical_path） |
| UI 並列（U-screen 58）で API 契約がずれる | 契約凍結済み・G11 openapi-diff・型生成 T-F-15 |
| 名簿・節目が仮置き | PM 確定後に build_tickets --prev と本スクリプトを再実行 |

## 進め方（人と AI）

| 場面 | やり方 |
|---|---|
| planning | 各 Wave の開始日に dispatch.sh で並列起動（人は blocking の解除と致命級のレビュー） |
| daily | AI の動きは PR と qa-ladder の結果で見る（デイリー会議はしない） |
| review | Wave の締め（finish）に completion_gate と高本レビュー |
| retro | Wave 締めで qa_delta と layer_audit の warn を棚卸し |

## 流れ（L2）の割り当て

流れ 9 のうち Wave に付いた 9。未割り当て：なし
