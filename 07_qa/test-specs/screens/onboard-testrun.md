# onboard-testrun テスト仕様（L1・機械生成）

> 05_flow/build_tasks.py がタスクと同時に生成。ID は変えない。途中変更は qa_delta.py で差分。結果列は staging で流した人が書く（再生成しても残る。結果あり 0 行）。

| ID | 画面 | テスト観点 | テスト項目 | 前提条件 | 操作手順 | 期待結果 | 結果 | 備考 | タスク | 実行条件 |
|---|---|---|---|---|---|---|---|---|---|---|
| SCR-ONBOARD-TESTRUN-001 | onboard-testrun | 状態 | 状態「動かした」がモックどおりに出る（h1・第2ナビ・列の値がダミー固定でない） | その状態を作る | 画面を開く | モック 06_mockup/v1/v1-onboard-testrun.html の状態 n と一致 |  | G-06・G-07 | T-U-11 | L1 |
| SCR-ONBOARD-TESTRUN-002 | onboard-testrun | 状態 | 状態「最初」がモックどおりに出る（h1・第2ナビ・列の値がダミー固定でない） | その状態を作る | 画面を開く | モック 06_mockup/v1/v1-onboard-testrun.html の状態 0 と一致 |  | G-06・G-07 | T-U-11 | L1 |
| SCR-ONBOARD-TESTRUN-003 | onboard-testrun | 状態 | 状態「止まった」がモックどおりに出る（h1・第2ナビ・列の値がダミー固定でない） | その状態を作る | 画面を開く | モック 06_mockup/v1/v1-onboard-testrun.html の状態 x と一致 |  | G-06・G-07 | T-U-11 | L1 |
| SCR-ONBOARD-TESTRUN-004 | onboard-testrun | 役割 | 役割 R1 で開くと、その役割の中身（data-roles）が出て、他の役割の中身は出ない | R1 でログイン | 画面を開く | 役割ごとの中身（G15） |  |  | T-U-11 | L1 |
| SCR-ONBOARD-TESTRUN-005 | onboard-testrun | 役割 | 役割 R2 で開くと、その役割の中身（data-roles）が出て、他の役割の中身は出ない | R2 でログイン | 画面を開く | 役割ごとの中身（G15） |  |  | T-U-11 | L1 |
| SCR-ONBOARD-TESTRUN-006 | onboard-testrun | 主アクション | 「本番に切り替える」を押すと対応する endpoint が呼ばれ、別 GET で再取得した画面に反映される | 権限のある会員 | 押す | DB と画面が変わる（G-01・G-03） |  | GET /api/action_runs | T-U-11 | L1 |
| SCR-ONBOARD-TESTRUN-007 | onboard-testrun | 到達性 | リンク先 bridge-setup が実在ルートで 200 で開く | — | 押す | /bridge-setup が開く（G-04） |  |  | T-U-11 | L1 |
| SCR-ONBOARD-TESTRUN-008 | onboard-testrun | 到達性 | リンク先 credentials が実在ルートで 200 で開く | — | 押す | /credentials が開く（G-04） |  |  | T-U-11 | L1 |
| SCR-ONBOARD-TESTRUN-009 | onboard-testrun | 到達性 | リンク先 onboard-draft が実在ルートで 200 で開く | — | 押す | /onboard-draft が開く（G-04） |  |  | T-U-11 | L1 |
| SCR-ONBOARD-TESTRUN-010 | onboard-testrun | 到達性 | リンク先 onboard-golive が実在ルートで 200 で開く | — | 押す | /onboard-golive が開く（G-04） | BLOCKED（自動：行き先の画面 onboard-golive は T-U-12 で実装（未着手）。href は flow の route と機械照合済み・押すと 404 になるので今は押せない） |  | T-U-11 | L1 |
| SCR-ONBOARD-TESTRUN-011 | onboard-testrun | 到達性 | リンク先 onboard-interview が実在ルートで 200 で開く | — | 押す | /onboard-interview が開く（G-04） |  |  | T-U-11 | L1 |
| SCR-ONBOARD-TESTRUN-012 | onboard-testrun | 横溢れ | 375・768・1024・1440 で scrollWidth - clientWidth <= 1、1180+ で本文 720 以上 | — | 各幅で開く | 溢れ 0 |  | G-05 | T-U-11 | L1 |
| SCR-ONBOARD-TESTRUN-013 | onboard-testrun | 空・止まっている | データ 0 件の状態と AI が止まっている状態が cover 宣言どおりに出る | PS2 / PS4 | 開く | 空状態と止まっている帯 |  | G18 | T-U-11 | L1 |
| SCR-ONBOARD-TESTRUN-014 | onboard-testrun | 表記ゆらぎ | N/A：この画面に入力欄が無い | — | — | — |  | 理由つき N/A | T-U-11 | L1 |
| SCR-ONBOARD-TESTRUN-015 | onboard-testrun | G-11 外部リソースの実在 | N/A：外部リソースを触らない | migration/IaC 適用後 | 起動時の存在確認を読む | 無ければ起動時に落ちる（黙って 502 にならない） |  | 環境ごと | T-U-11 | L1 |
| SCR-ONBOARD-TESTRUN-016 | onboard-testrun | G-12 切り替わりの瞬間 | Bridge が切れた直後 0 秒・鮮度窓の内側に操作する | 本番稼働中 | PC を閉じた直後に主アクションを押す | 「AI は止まっています」が出て、押した内容は失われない |  |  | T-U-11 | L1 |
| SCR-ONBOARD-TESTRUN-017 | onboard-testrun | G-13 機能の組み合わせ | 実行中 × 切替／中断 × 再開／別ロール同時 の直積のうち該当分 | — | 同時に起こす | 後勝ちでなく、規則どおり（承認は 1 人 1 回・切替は次の実行から） |  | features.json combination_points | T-U-11 | L1 |
| SCR-ONBOARD-TESTRUN-018 | onboard-testrun | G-14 口座状態の波及 | 退会・停止・権限変更・パスワード変更の後に、この機能の既存セッション・接続・共有リンクが無効 | ログイン中の別端末と Bridge | 権限を変える | 別端末と Bridge は 0 秒で 401（sessions が revoked） |  |  | T-U-11 | L1 |
| SCR-ONBOARD-TESTRUN-019 | onboard-testrun | G-15 信号なし終了 | N/A：外部を呼ばない | 外部を故意に切る | 実行する | 成功扱いにせず、502 と次の一手（人へのハンドオフ） |  |  | T-U-11 | L1 |
| SCR-ONBOARD-TESTRUN-020 | onboard-testrun | G-16 有限資源 | 消費する資源：DB 接続（プール経由）・メモリ。1 要求あたり 1 接続以下・上限時は待機列 | 同時 50 要求 | 同時に叩く | ログインが落ちない・接続上限に張り付かない（関門 C2 のプール） |  | L4 で負荷試験 | T-U-11 | L1 |
| SCR-ONBOARD-TESTRUN-021 | onboard-testrun | 操作 | ボタン「本番に切り替える」（状態 共通） | 状態 共通 を作る（全役割） | 押す／入れる（実ブラウザ） | 押すと処理が起き、結果（遷移・DB の変化・表示の変化）が確認できる。押しても何も起きないなら未実装（G-01） |  | op=button:本番に切り替える | T-U-11 | L1 |
| SCR-ONBOARD-TESTRUN-022 | onboard-testrun | 操作 | リンク「1. PCをつなぐ」（状態 動かした・最初・止まった） | 状態 動かした を作る（全役割） | 押す／入れる（実ブラウザ） | /bridge-setup が実在ルートで 200 で開く（G-04） |  | op=link:1. PCをつなぐ→bridge-setup | T-U-11 | L1 |
| SCR-ONBOARD-TESTRUN-023 | onboard-testrun | 操作 | リンク「2. 話す」（状態 動かした・最初・止まった） | 状態 動かした を作る（全役割） | 押す／入れる（実ブラウザ） | /onboard-interview が実在ルートで 200 で開く（G-04） |  | op=link:2. 話す→onboard-interview | T-U-11 | L1 |
| SCR-ONBOARD-TESTRUN-024 | onboard-testrun | 操作 | リンク「3. たたき台」（状態 動かした・最初・止まった） | 状態 動かした を作る（全役割） | 押す／入れる（実ブラウザ） | /onboard-draft が実在ルートで 200 で開く（G-04） |  | op=link:3. たたき台→onboard-draft | T-U-11 | L1 |
| SCR-ONBOARD-TESTRUN-025 | onboard-testrun | 操作 | リンク「4. ログイン情報」（状態 動かした・最初・止まった） | 状態 動かした を作る（全役割） | 押す／入れる（実ブラウザ） | /credentials が実在ルートで 200 で開く（G-04） |  | op=link:4. ログイン情報→credentials | T-U-11 | L1 |
| SCR-ONBOARD-TESTRUN-026 | onboard-testrun | 操作 | リンク「5. テスト」（状態 動かした・最初・止まった） | 状態 動かした を作る（全役割） | 押す／入れる（実ブラウザ） | /onboard-testrun が実在ルートで 200 で開く（G-04） | BLOCKED（自動：行き先の画面 onboard-testrun は T-U-11 で実装（未着手）。href は flow の route と機械照合済み・押すと 404 になるので今は押せない） | op=link:5. テスト→onboard-testrun | T-U-11 | L1 |
| SCR-ONBOARD-TESTRUN-027 | onboard-testrun | 操作 | リンク「6. 本番へ」（状態 動かした・最初・止まった） | 状態 動かした を作る（全役割） | 押す／入れる（実ブラウザ） | /onboard-golive が実在ルートで 200 で開く（G-04） | BLOCKED（自動：行き先の画面 onboard-golive は T-U-12 で実装（未着手）。href は flow の route と機械照合済み・押すと 404 になるので今は押せない） | op=link:6. 本番へ→onboard-golive | T-U-11 | L1 |
| SCR-ONBOARD-TESTRUN-028 | onboard-testrun | 操作 | ボタン「見る」（状態 動かした） | 状態 動かした を作る（全役割） | 押す／入れる（実ブラウザ） | 押すと処理が起き、結果（遷移・DB の変化・表示の変化）が確認できる。押しても何も起きないなら未実装（G-01） |  | op=button:見る | T-U-11 | L1 |
| SCR-ONBOARD-TESTRUN-029 | onboard-testrun | 操作 | リンク「本番に切り替える」（状態 動かした） | 状態 動かした を作る（全役割） | 押す／入れる（実ブラウザ） | /onboard-golive が実在ルートで 200 で開く（G-04） | BLOCKED（自動：行き先の画面 onboard-golive は T-U-12 で実装（未着手）。href は flow の route と機械照合済み・押すと 404 になるので今は押せない） | op=link:本番に切り替える→onboard-golive | T-U-11 | L1 |
| SCR-ONBOARD-TESTRUN-030 | onboard-testrun | 操作 | ボタン「もう少し試す」（状態 動かした） | 状態 動かした を作る（全役割） | 押す／入れる（実ブラウザ） | 押すと処理が起き、結果（遷移・DB の変化・表示の変化）が確認できる。押しても何も起きないなら未実装（G-01） |  | op=button:もう少し試す | T-U-11 | L1 |
| SCR-ONBOARD-TESTRUN-031 | onboard-testrun | 操作 | ボタン「営業社員を動かす」（状態 最初） | 状態 最初 を作る（全役割） | 押す／入れる（実ブラウザ） | 押すと処理が起き、結果（遷移・DB の変化・表示の変化）が確認できる。押しても何も起きないなら未実装（G-01） |  | op=button:営業社員を動かす | T-U-11 | L1 |
| SCR-ONBOARD-TESTRUN-032 | onboard-testrun | 操作 | ボタン「経理社員を動かす」（状態 最初） | 状態 最初 を作る（全役割） | 押す／入れる（実ブラウザ） | 押すと処理が起き、結果（遷移・DB の変化・表示の変化）が確認できる。押しても何も起きないなら未実装（G-01） |  | op=button:経理社員を動かす | T-U-11 | L1 |
| SCR-ONBOARD-TESTRUN-033 | onboard-testrun | 操作 | ボタン「ブラウザで開く」（状態 止まった） | 状態 止まった を作る（全役割） | 押す／入れる（実ブラウザ） | 押すと処理が起き、結果（遷移・DB の変化・表示の変化）が確認できる。押しても何も起きないなら未実装（G-01） |  | op=button:ブラウザで開く | T-U-11 | L1 |
| SCR-ONBOARD-TESTRUN-034 | onboard-testrun | 操作 | ボタン「この仕事はやめる」（状態 止まった） | 状態 止まった を作る（全役割） | 押す／入れる（実ブラウザ） | 押すと処理が起き、結果（遷移・DB の変化・表示の変化）が確認できる。押しても何も起きないなら未実装（G-01） |  | op=button:この仕事はやめる | T-U-11 | L1 |
| SCR-ONBOARD-TESTRUN-035 | onboard-testrun | 発注者確認 | 手順 07_tasks/handoff/T-U-11.md を発注者が実際に触って OK を出す（Rule 12） | staging か ローカル | 手順どおりに触る | 手順の末尾に「OK: 日付 名前」が書かれる。無い間は BLOCKED（発注者の確認待ち） | BLOCKED（発注者の確認待ち：手順 07_tasks/handoff/T-U-11.md を高本さんが触って OK: を書く。ローカル 3123 で触れる・staging は無い） | Rule 12 | T-U-11 | L1 |
