# onboard-golive テスト仕様（L1・機械生成）

> 05_flow/build_tasks.py がタスクと同時に生成。ID は変えない。途中変更は qa_delta.py で差分。結果列は staging で流した人が書く。

| ID | 画面 | テスト観点 | テスト項目 | 前提条件 | 操作手順 | 期待結果 | 結果 | 備考 | タスク | 実行条件 |
|---|---|---|---|---|---|---|---|---|---|---|
| SCR-ONBOARD-GOLIVE-001 | onboard-golive | 状態 | 状態「確認」がモックどおりに出る（h1・第2ナビ・列の値がダミー固定でない） | その状態を作る | 画面を開く | モック 06_mockup/v1/v1-onboard-golive.html の状態 n と一致 |  | G-06・G-07 | T-U-12 | L1 |
| SCR-ONBOARD-GOLIVE-002 | onboard-golive | 状態 | 状態「切り替えた」がモックどおりに出る（h1・第2ナビ・列の値がダミー固定でない） | その状態を作る | 画面を開く | モック 06_mockup/v1/v1-onboard-golive.html の状態 ok と一致 |  | G-06・G-07 | T-U-12 | L1 |
| SCR-ONBOARD-GOLIVE-003 | onboard-golive | 役割 | 役割 R1 で開くと、その役割の中身（data-roles）が出て、他の役割の中身は出ない | R1 でログイン | 画面を開く | 役割ごとの中身（G15） |  |  | T-U-12 | L1 |
| SCR-ONBOARD-GOLIVE-004 | onboard-golive | 役割 | 役割 R2 で開くと、その役割の中身（data-roles）が出て、他の役割の中身は出ない | R2 でログイン | 画面を開く | 役割ごとの中身（G15） |  |  | T-U-12 | L1 |
| SCR-ONBOARD-GOLIVE-005 | onboard-golive | 主アクション | 「切り替える」を押すと対応する endpoint が呼ばれ、別 GET で再取得した画面に反映される | 権限のある会員 | 押す | DB と画面が変わる（G-01・G-03） |  | GET /api/tenants | T-U-12 | L1 |
| SCR-ONBOARD-GOLIVE-006 | onboard-golive | 到達性 | リンク先 bridge-setup が実在ルートで 200 で開く | — | 押す | /bridge-setup が開く（G-04） |  |  | T-U-12 | L1 |
| SCR-ONBOARD-GOLIVE-007 | onboard-golive | 到達性 | リンク先 credentials が実在ルートで 200 で開く | — | 押す | /credentials が開く（G-04） |  |  | T-U-12 | L1 |
| SCR-ONBOARD-GOLIVE-008 | onboard-golive | 到達性 | リンク先 onboard-draft が実在ルートで 200 で開く | — | 押す | /onboard-draft が開く（G-04） |  |  | T-U-12 | L1 |
| SCR-ONBOARD-GOLIVE-009 | onboard-golive | 到達性 | リンク先 onboard-interview が実在ルートで 200 で開く | — | 押す | /onboard-interview が開く（G-04） |  |  | T-U-12 | L1 |
| SCR-ONBOARD-GOLIVE-010 | onboard-golive | 到達性 | リンク先 onboard-testrun が実在ルートで 200 で開く | — | 押す | /onboard-testrun が開く（G-04） |  |  | T-U-12 | L1 |
| SCR-ONBOARD-GOLIVE-011 | onboard-golive | 到達性 | リンク先 today が実在ルートで 200 で開く | — | 押す | /today が開く（G-04） |  |  | T-U-12 | L1 |
| SCR-ONBOARD-GOLIVE-012 | onboard-golive | 横溢れ | 375・768・1024・1440 で scrollWidth - clientWidth <= 1、1180+ で本文 720 以上 | — | 各幅で開く | 溢れ 0 |  | G-05 | T-U-12 | L1 |
| SCR-ONBOARD-GOLIVE-013 | onboard-golive | 空・止まっている | データ 0 件の状態と AI が止まっている状態が cover 宣言どおりに出る | PS2 / PS4 | 開く | 空状態と止まっている帯 |  | G18 | T-U-12 | L1 |
| SCR-ONBOARD-GOLIVE-014 | onboard-golive | 表記ゆらぎ | N/A：この画面に入力欄が無い | — | — | — |  | 理由つき N/A | T-U-12 | L1 |
| SCR-ONBOARD-GOLIVE-015 | onboard-golive | G-11 外部リソースの実在 | N/A：外部リソースを触らない | migration/IaC 適用後 | 起動時の存在確認を読む | 無ければ起動時に落ちる（黙って 502 にならない） |  | 環境ごと | T-U-12 | L1 |
| SCR-ONBOARD-GOLIVE-016 | onboard-golive | G-12 切り替わりの瞬間 | Bridge が切れた直後 0 秒・鮮度窓の内側に操作する | 本番稼働中 | PC を閉じた直後に主アクションを押す | 「AI は止まっています」が出て、押した内容は失われない |  |  | T-U-12 | L1 |
| SCR-ONBOARD-GOLIVE-017 | onboard-golive | G-13 機能の組み合わせ | 実行中 × 切替／中断 × 再開／別ロール同時 の直積のうち該当分 | — | 同時に起こす | 後勝ちでなく、規則どおり（承認は 1 人 1 回・切替は次の実行から） |  | features.json combination_points | T-U-12 | L1 |
| SCR-ONBOARD-GOLIVE-018 | onboard-golive | G-14 口座状態の波及 | 退会・停止・権限変更・パスワード変更の後に、この機能の既存セッション・接続・共有リンクが無効 | ログイン中の別端末と Bridge | 権限を変える | 別端末と Bridge は 0 秒で 401（sessions が revoked） |  |  | T-U-12 | L1 |
| SCR-ONBOARD-GOLIVE-019 | onboard-golive | G-15 信号なし終了 | N/A：外部を呼ばない | 外部を故意に切る | 実行する | 成功扱いにせず、502 と次の一手（人へのハンドオフ） |  |  | T-U-12 | L1 |
| SCR-ONBOARD-GOLIVE-020 | onboard-golive | G-16 有限資源 | 消費する資源：DB 接続（プール経由）・メモリ。1 要求あたり 1 接続以下・上限時は待機列 | 同時 50 要求 | 同時に叩く | ログインが落ちない・接続上限に張り付かない（関門 C2 のプール） |  | L4 で負荷試験 | T-U-12 | L1 |
