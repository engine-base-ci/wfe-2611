# invite-accept テスト仕様（L1・機械生成）

> 05_flow/build_tasks.py がタスクと同時に生成。ID は変えない。途中変更は qa_delta.py で差分。結果列は staging で流した人が書く（再生成しても残る。結果あり 0 行）。

| ID | 画面 | テスト観点 | テスト項目 | 前提条件 | 操作手順 | 期待結果 | 結果 | 備考 | タスク | 実行条件 |
|---|---|---|---|---|---|---|---|---|---|---|
| API-02-001 | invite-accept | API 正常 | GET /api/v1/invitations：取得（invitations）— 招待を受けて参加する | 権限のある会員 | 呼ぶ | 200 と { data: Invitations[], meta?: { cursor,  |  | A03 | T-A-02 | L1 |
| API-02-002 | invite-accept | API 異常 | GET /api/v1/invitations：10/min/ip | — | 条件を作って呼ぶ | 429 RATE_LIMITED。副作用なし |  | UNWANTED: IF 10/min/ip を超えたら、Kaname は 42 | T-A-02 | L1 |
| API-02-003 | invite-accept | API 異常 | GET /api/v1/invitations：外部サービス・モデル・プロセスが失敗した／合図を出さずに終わった | — | 条件を作って呼ぶ | 502 EXTERNAL_FAILED。副作用なし |  | UNWANTED: IF 外部が失敗したか完了信号が無いなら、Kaname は成 | T-A-02 | L1 |
| API-02-004 | invite-accept | 状態 | GET /api/v1/invitations：0 件／大量（1,000）／重複／初回／2 回目 | — | 各状態で呼ぶ | 0 件は空配列、大量はページング、重複は 409、2 回目は冪等 |  |  | T-A-02 | L1 |
| API-02-005 | invite-accept | G-11 外部リソースの実在 | N/A：外部リソースを触らない | migration/IaC 適用後 | 起動時の存在確認を読む | 無ければ起動時に落ちる（黙って 502 にならない） |  | 環境ごと | T-A-02 | L1 |
| API-02-006 | invite-accept | G-12 切り替わりの瞬間 | N/A：状態の切替を持たない | 本番稼働中 | PC を閉じた直後に主アクションを押す | 「AI は止まっています」が出て、押した内容は失われない |  |  | T-A-02 | L1 |
| API-02-007 | invite-accept | G-13 機能の組み合わせ | 実行中 × 切替／中断 × 再開／別ロール同時 の直積のうち該当分 | — | 同時に起こす | 後勝ちでなく、規則どおり（承認は 1 人 1 回・切替は次の実行から） |  | features.json combination_points | T-A-02 | L1 |
| API-02-008 | invite-accept | G-14 口座状態の波及 | 退会・停止・権限変更・パスワード変更の後に、この機能の既存セッション・接続・共有リンクが無効 | ログイン中の別端末と Bridge | 権限を変える | 別端末と Bridge は 0 秒で 401（sessions が revoked） |  |  | T-A-02 | L1 |
| API-02-009 | invite-accept | G-15 信号なし終了 | N/A：外部を呼ばない | 外部を故意に切る | 実行する | 成功扱いにせず、502 と次の一手（人へのハンドオフ） |  |  | T-A-02 | L1 |
| API-02-010 | invite-accept | G-16 有限資源 | 消費する資源：DB 接続（プール経由）・メモリ。1 要求あたり 1 接続以下・上限時は待機列 | 同時 50 要求 | 同時に叩く | ログインが落ちない・接続上限に張り付かない（関門 C2 のプール） |  | L4 で負荷試験 | T-A-02 | L1 |
| SCR-INVITE-ACCEPT-001 | invite-accept | 状態 | 状態「担当者として」がモックどおりに出る（h1・第2ナビ・列の値がダミー固定でない） | その状態を作る | 画面を開く | モック 06_mockup/v1/v1-invite-accept.html の状態 n と一致 |  | G-06・G-07 | T-U-03 | L1 |
| SCR-INVITE-ACCEPT-002 | invite-accept | 状態 | 状態「閲覧のみとして」がモックどおりに出る（h1・第2ナビ・列の値がダミー固定でない） | その状態を作る | 画面を開く | モック 06_mockup/v1/v1-invite-accept.html の状態 r4 と一致 |  | G-06・G-07 | T-U-03 | L1 |
| SCR-INVITE-ACCEPT-003 | invite-accept | 状態 | 状態「取り消し済み」がモックどおりに出る（h1・第2ナビ・列の値がダミー固定でない） | その状態を作る | 画面を開く | モック 06_mockup/v1/v1-invite-accept.html の状態 x と一致 |  | G-06・G-07 | T-U-03 | L1 |
| SCR-INVITE-ACCEPT-004 | invite-accept | 役割 | 役割 R3 で開くと、その役割の中身（data-roles）が出て、他の役割の中身は出ない | R3 でログイン | 画面を開く | 役割ごとの中身（G15） |  |  | T-U-03 | L1 |
| SCR-INVITE-ACCEPT-005 | invite-accept | 役割 | 役割 R4 で開くと、その役割の中身（data-roles）が出て、他の役割の中身は出ない | R4 でログイン | 画面を開く | 役割ごとの中身（G15） |  |  | T-U-03 | L1 |
| SCR-INVITE-ACCEPT-006 | invite-accept | 主アクション | 「参加する」を押すと対応する endpoint が呼ばれ、別 GET で再取得した画面に反映される | 権限のある会員 | 押す | DB と画面が変わる（G-01・G-03） |  | GET /api/invitations | T-U-03 | L1 |
| SCR-INVITE-ACCEPT-007 | invite-accept | 横溢れ | 375・768・1024・1440 で scrollWidth - clientWidth <= 1、1180+ で本文 720 以上 | — | 各幅で開く | 溢れ 0 |  | G-05 | T-U-03 | L1 |
| SCR-INVITE-ACCEPT-008 | invite-accept | 空・止まっている | データ 0 件の状態と AI が止まっている状態が cover 宣言どおりに出る | PS2 / PS4 | 開く | 空状態と止まっている帯 |  | G18 | T-U-03 | L1 |
| SCR-INVITE-ACCEPT-009 | invite-accept | 表記ゆらぎ | 全角／半角：メール・数値・コードを全角で入れる | 入力欄がある状態 | 入力して保存 | 同一として扱われ、サーバー側で正規化されて保存される（クライアント側だけに頼らない） |  | human-grade-qa 第11軸 | T-U-03 | L1 |
| SCR-INVITE-ACCEPT-010 | invite-accept | 表記ゆらぎ | 前後と途中の空白：空白付きで入れる | 入力欄がある状態 | 入力して保存 | 同一として扱われ、サーバー側で正規化されて保存される（クライアント側だけに頼らない） |  | human-grade-qa 第11軸 | T-U-03 | L1 |
| SCR-INVITE-ACCEPT-011 | invite-accept | 表記ゆらぎ | 記号の種別（ハイフン・長音）：‐ ー − を混ぜる | 入力欄がある状態 | 入力して保存 | 同一として扱われ、サーバー側で正規化されて保存される（クライアント側だけに頼らない） |  | human-grade-qa 第11軸 | T-U-03 | L1 |
| SCR-INVITE-ACCEPT-012 | invite-accept | 表記ゆらぎ | Unicode 正規化（NFC/NFD）：macOS の入力（NFD）で入れる | 入力欄がある状態 | 入力して保存 | 同一として扱われ、サーバー側で正規化されて保存される（クライアント側だけに頼らない） |  | human-grade-qa 第11軸 | T-U-03 | L1 |
| SCR-INVITE-ACCEPT-013 | invite-accept | 表記ゆらぎ | 大文字小文字：メールを大文字で入れる | 入力欄がある状態 | 入力して保存 | 同一として扱われ、サーバー側で正規化されて保存される（クライアント側だけに頼らない） |  | human-grade-qa 第11軸 | T-U-03 | L1 |
| SCR-INVITE-ACCEPT-014 | invite-accept | G-11 外部リソースの実在 | N/A：外部リソースを触らない | migration/IaC 適用後 | 起動時の存在確認を読む | 無ければ起動時に落ちる（黙って 502 にならない） |  | 環境ごと | T-U-03 | L1 |
| SCR-INVITE-ACCEPT-015 | invite-accept | G-12 切り替わりの瞬間 | Bridge が切れた直後 0 秒・鮮度窓の内側に操作する | 本番稼働中 | PC を閉じた直後に主アクションを押す | 「AI は止まっています」が出て、押した内容は失われない |  |  | T-U-03 | L1 |
| SCR-INVITE-ACCEPT-016 | invite-accept | G-13 機能の組み合わせ | 実行中 × 切替／中断 × 再開／別ロール同時 の直積のうち該当分 | — | 同時に起こす | 後勝ちでなく、規則どおり（承認は 1 人 1 回・切替は次の実行から） |  | features.json combination_points | T-U-03 | L1 |
| SCR-INVITE-ACCEPT-017 | invite-accept | G-14 口座状態の波及 | 退会・停止・権限変更・パスワード変更の後に、この機能の既存セッション・接続・共有リンクが無効 | ログイン中の別端末と Bridge | 権限を変える | 別端末と Bridge は 0 秒で 401（sessions が revoked） |  |  | T-U-03 | L1 |
| SCR-INVITE-ACCEPT-018 | invite-accept | G-15 信号なし終了 | N/A：外部を呼ばない | 外部を故意に切る | 実行する | 成功扱いにせず、502 と次の一手（人へのハンドオフ） |  |  | T-U-03 | L1 |
| SCR-INVITE-ACCEPT-019 | invite-accept | G-16 有限資源 | 消費する資源：DB 接続（プール経由）・メモリ。1 要求あたり 1 接続以下・上限時は待機列 | 同時 50 要求 | 同時に叩く | ログインが落ちない・接続上限に張り付かない（関門 C2 のプール） |  | L4 で負荷試験 | T-U-03 | L1 |
