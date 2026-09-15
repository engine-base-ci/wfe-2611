# bridge-setup テスト仕様（L1・機械生成）

> 05_flow/build_tasks.py がタスクと同時に生成。ID は変えない。途中変更は qa_delta.py で差分。結果列は staging で流した人が書く（再生成しても残る。結果あり 0 行）。

| ID | 画面 | テスト観点 | テスト項目 | 前提条件 | 操作手順 | 期待結果 | 結果 | 備考 | タスク | 実行条件 |
|---|---|---|---|---|---|---|---|---|---|---|
| API-01-001 | bridge-setup | API 正常 | POST /api/v1/clones：作成・実行（clones）— 自分のAIに会社のことを話す（訊かれたことに答える | 権限のある会員 | 呼ぶ | 201 と { data: Clones, meta?: { cursor, limit,  |  | A06 | T-A-01 | L1 |
| API-01-002 | bridge-setup | API 異常 | POST /api/v1/clones：セッションが無い・失効している（退会・停止・権限変更・パスワード変更で即失効） | — | 条件を作って呼ぶ | 401 UNAUTHENTICATED。副作用なし |  | UNWANTED: IF セッションが無いか失効しているなら、Kaname は  | T-A-01 | L1 |
| API-01-003 | bridge-setup | API 異常 | POST /api/v1/clones：権限（誰に×何に×どの層で×できること）が無い、または運営が許可の無い会社を読もうとした | — | 条件を作って呼ぶ | 403 FORBIDDEN。副作用なし |  | UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用 | T-A-01 | L1 |
| API-01-004 | bridge-setup | API 異常 | POST /api/v1/clones：二重送信・同時編集・既に登録済み（冪等キーで防ぐ） | — | 条件を作って呼ぶ | 409 CONFLICT。副作用なし |  | UNWANTED: IF 同じ冪等キーで二度来たら、Kaname は最初の結果を | T-A-01 | L1 |
| API-01-005 | bridge-setup | API 異常 | POST /api/v1/clones：必須・形式・値域・表記ゆらぎ（全角半角・空白・記号） | — | 条件を作って呼ぶ | 422 VALIDATION_ERROR。副作用なし |  | UNWANTED: IF 入力が受け付けられないなら、Kaname は 422  | T-A-01 | L1 |
| API-01-006 | bridge-setup | 状態 | POST /api/v1/clones：0 件／大量（1,000）／重複／初回／2 回目 | — | 各状態で呼ぶ | 0 件は空配列、大量はページング、重複は 409、2 回目は冪等 |  |  | T-A-01 | L1 |
| API-01-007 | bridge-setup | API 正常 | GET /api/v1/members：取得（members）— メールを確認して本人だと示す／2段階認証を設定する | 権限のある会員 | 呼ぶ | 200 と { data: Members[], meta?: { cursor, limi |  | A02 A04 A13 | T-A-01 | L1 |
| API-01-008 | bridge-setup | API 異常 | GET /api/v1/members：10/min/ip | — | 条件を作って呼ぶ | 429 RATE_LIMITED。副作用なし |  | UNWANTED: IF 10/min/ip を超えたら、Kaname は 42 | T-A-01 | L1 |
| API-01-009 | bridge-setup | 状態 | GET /api/v1/members：0 件／大量（1,000）／重複／初回／2 回目 | — | 各状態で呼ぶ | 0 件は空配列、大量はページング、重複は 409、2 回目は冪等 |  |  | T-A-01 | L1 |
| API-01-010 | bridge-setup | API 正常 | POST /api/v1/plans：作成・実行（plans）— アカウントを作る／支払い方法を登録する | 権限のある会員 | 呼ぶ | 201 と { data: Plans, meta?: { cursor, limit, t |  | A01 A05 | T-A-01 | L1 |
| API-01-011 | bridge-setup | API 異常 | POST /api/v1/plans：セッションが無い・失効している（退会・停止・権限変更・パスワード変更で即失効） | — | 条件を作って呼ぶ | 401 UNAUTHENTICATED。副作用なし |  | UNWANTED: IF セッションが無いか失効しているなら、Kaname は  | T-A-01 | L1 |
| API-01-012 | bridge-setup | API 異常 | POST /api/v1/plans：権限（誰に×何に×どの層で×できること）が無い、または運営が許可の無い会社を読もうとした | — | 条件を作って呼ぶ | 403 FORBIDDEN。副作用なし |  | UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用 | T-A-01 | L1 |
| API-01-013 | bridge-setup | API 異常 | POST /api/v1/plans：二重送信・同時編集・既に登録済み（冪等キーで防ぐ） | — | 条件を作って呼ぶ | 409 CONFLICT。副作用なし |  | UNWANTED: IF 同じ冪等キーで二度来たら、Kaname は最初の結果を | T-A-01 | L1 |
| API-01-014 | bridge-setup | API 異常 | POST /api/v1/plans：必須・形式・値域・表記ゆらぎ（全角半角・空白・記号） | — | 条件を作って呼ぶ | 422 VALIDATION_ERROR。副作用なし |  | UNWANTED: IF 入力が受け付けられないなら、Kaname は 422  | T-A-01 | L1 |
| API-01-015 | bridge-setup | 状態 | POST /api/v1/plans：0 件／大量（1,000）／重複／初回／2 回目 | — | 各状態で呼ぶ | 0 件は空配列、大量はページング、重複は 409、2 回目は冪等 |  |  | T-A-01 | L1 |
| API-01-016 | bridge-setup | API 正常 | POST /api/v1/sessions：作成・実行（sessions）— 自分のPCをつなぐ（Bridge）── これが | 権限のある会員 | 呼ぶ | 201 と { data: Sessions, meta?: { cursor, limit |  | A09 | T-A-01 | L1 |
| API-01-017 | bridge-setup | API 異常 | POST /api/v1/sessions：セッションが無い・失効している（退会・停止・権限変更・パスワード変更で即失効） | — | 条件を作って呼ぶ | 401 UNAUTHENTICATED。副作用なし |  | UNWANTED: IF セッションが無いか失効しているなら、Kaname は  | T-A-01 | L1 |
| API-01-018 | bridge-setup | API 異常 | POST /api/v1/sessions：権限（誰に×何に×どの層で×できること）が無い、または運営が許可の無い会社を読もうとした | — | 条件を作って呼ぶ | 403 FORBIDDEN。副作用なし |  | UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用 | T-A-01 | L1 |
| API-01-019 | bridge-setup | API 異常 | POST /api/v1/sessions：二重送信・同時編集・既に登録済み（冪等キーで防ぐ） | — | 条件を作って呼ぶ | 409 CONFLICT。副作用なし |  | UNWANTED: IF 同じ冪等キーで二度来たら、Kaname は最初の結果を | T-A-01 | L1 |
| API-01-020 | bridge-setup | API 異常 | POST /api/v1/sessions：必須・形式・値域・表記ゆらぎ（全角半角・空白・記号） | — | 条件を作って呼ぶ | 422 VALIDATION_ERROR。副作用なし |  | UNWANTED: IF 入力が受け付けられないなら、Kaname は 422  | T-A-01 | L1 |
| API-01-021 | bridge-setup | 状態 | POST /api/v1/sessions：0 件／大量（1,000）／重複／初回／2 回目 | — | 各状態で呼ぶ | 0 件は空配列、大量はページング、重複は 409、2 回目は冪等 |  |  | T-A-01 | L1 |
| API-01-022 | bridge-setup | API 正常 | GET /api/v1/tenants：取得（tenants）— 自分のAIが作ったたたき台（目標・台帳・AI社員）を見 | 権限のある会員 | 呼ぶ | 200 と { data: Tenants[], meta?: { cursor, limi |  | A07 A08 A12 A45 | T-A-01 | L1 |
| API-01-023 | bridge-setup | API 異常 | GET /api/v1/tenants：セッションが無い・失効している（退会・停止・権限変更・パスワード変更で即失効） | — | 条件を作って呼ぶ | 401 UNAUTHENTICATED。副作用なし |  | UNWANTED: IF セッションが無いか失効しているなら、Kaname は  | T-A-01 | L1 |
| API-01-024 | bridge-setup | API 異常 | GET /api/v1/tenants：権限（誰に×何に×どの層で×できること）が無い、または運営が許可の無い会社を読もうとした | — | 条件を作って呼ぶ | 403 FORBIDDEN。副作用なし |  | UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用 | T-A-01 | L1 |
| API-01-025 | bridge-setup | API 異常 | GET /api/v1/tenants：120/min/user | — | 条件を作って呼ぶ | 429 RATE_LIMITED。副作用なし |  | UNWANTED: IF 120/min/user を超えたら、Kaname は | T-A-01 | L1 |
| API-01-026 | bridge-setup | API 異常 | GET /api/v1/tenants：外部サービス・モデル・プロセスが失敗した／合図を出さずに終わった | — | 条件を作って呼ぶ | 502 EXTERNAL_FAILED。副作用なし |  | UNWANTED: IF 外部が失敗したか完了信号が無いなら、Kaname は成 | T-A-01 | L1 |
| API-01-027 | bridge-setup | 状態 | GET /api/v1/tenants：0 件／大量（1,000）／重複／初回／2 回目 | — | 各状態で呼ぶ | 0 件は空配列、大量はページング、重複は 409、2 回目は冪等 |  |  | T-A-01 | L1 |
| API-01-028 | bridge-setup | G-11 外部リソースの実在 | 触る外部リソースが staging と production に存在する | migration/IaC 適用後 | 起動時の存在確認を読む | 無ければ起動時に落ちる（黙って 502 にならない） |  | 環境ごと | T-A-01 | L1 |
| API-01-029 | bridge-setup | G-12 切り替わりの瞬間 | Bridge が切れた直後 0 秒・鮮度窓の内側に操作する | 本番稼働中 | PC を閉じた直後に主アクションを押す | 「AI は止まっています」が出て、押した内容は失われない |  |  | T-A-01 | L1 |
| API-01-030 | bridge-setup | G-13 機能の組み合わせ | 実行中 × 切替／中断 × 再開／別ロール同時 の直積のうち該当分 | — | 同時に起こす | 後勝ちでなく、規則どおり（承認は 1 人 1 回・切替は次の実行から） |  | features.json combination_points | T-A-01 | L1 |
| API-01-031 | bridge-setup | G-14 口座状態の波及 | 退会・停止・権限変更・パスワード変更の後に、この機能の既存セッション・接続・共有リンクが無効 | ログイン中の別端末と Bridge | 権限を変える | 別端末と Bridge は 0 秒で 401（sessions が revoked） |  |  | T-A-01 | L1 |
| API-01-032 | bridge-setup | G-15 信号なし終了 | 外部・モデル・プロセスが完了信号を出さずに終わる／空を返す | 外部を故意に切る | 実行する | 成功扱いにせず、502 と次の一手（人へのハンドオフ） |  |  | T-A-01 | L1 |
| API-01-033 | bridge-setup | G-16 有限資源 | 消費する資源：DB 接続（プール経由）・メモリ。1 要求あたり 1 接続以下・上限時は待機列 | 同時 50 要求 | 同時に叩く | ログインが落ちない・接続上限に張り付かない（関門 C2 のプール） |  | L4 で負荷試験 | T-A-01 | L1 |
| SCR-BRIDGE-SETUP-001 | bridge-setup | 状態 | 状態「接続中」がモックどおりに出る（h1・第2ナビ・列の値がダミー固定でない） | その状態を作る | 画面を開く | モック 06_mockup/v1/v1-bridge-setup.html の状態 n と一致 |  | G-06・G-07 | T-U-09 | L1 |
| SCR-BRIDGE-SETUP-002 | bridge-setup | 状態 | 状態「つながった」がモックどおりに出る（h1・第2ナビ・列の値がダミー固定でない） | その状態を作る | 画面を開く | モック 06_mockup/v1/v1-bridge-setup.html の状態 ok と一致 |  | G-06・G-07 | T-U-09 | L1 |
| SCR-BRIDGE-SETUP-003 | bridge-setup | 状態 | 状態「つながらない」がモックどおりに出る（h1・第2ナビ・列の値がダミー固定でない） | その状態を作る | 画面を開く | モック 06_mockup/v1/v1-bridge-setup.html の状態 ng と一致 |  | G-06・G-07 | T-U-09 | L1 |
| SCR-BRIDGE-SETUP-004 | bridge-setup | 状態 | 状態「運用中（設定として）」がモックどおりに出る（h1・第2ナビ・列の値がダミー固定でない） | その状態を作る | 画面を開く | モック 06_mockup/v1/v1-bridge-setup.html の状態 s と一致 |  | G-06・G-07 | T-U-09 | L1 |
| SCR-BRIDGE-SETUP-005 | bridge-setup | 役割 | 役割 R1 で開くと、その役割の中身（data-roles）が出て、他の役割の中身は出ない | R1 でログイン | 画面を開く | 役割ごとの中身（G15） |  |  | T-U-09 | L1 |
| SCR-BRIDGE-SETUP-006 | bridge-setup | 役割 | 役割 R2 で開くと、その役割の中身（data-roles）が出て、他の役割の中身は出ない | R2 でログイン | 画面を開く | 役割ごとの中身（G15） |  |  | T-U-09 | L1 |
| SCR-BRIDGE-SETUP-007 | bridge-setup | 主アクション | 「接続を確かめる」を押すと対応する endpoint が呼ばれ、別 GET で再取得した画面に反映される | 権限のある会員 | 押す | DB と画面が変わる（G-01・G-03） |  | POST /api/sessions | T-U-09 | L1 |
| SCR-BRIDGE-SETUP-008 | bridge-setup | 到達性 | リンク先 account が実在ルートで 200 で開く | — | 押す | /account が開く（G-04） |  |  | T-U-09 | L1 |
| SCR-BRIDGE-SETUP-009 | bridge-setup | 到達性 | リンク先 account-close が実在ルートで 200 で開く | — | 押す | /account-close が開く（G-04） |  |  | T-U-09 | L1 |
| SCR-BRIDGE-SETUP-010 | bridge-setup | 到達性 | リンク先 ai-activity が実在ルートで 200 で開く | — | 押す | /ai-activity が開く（G-04） |  |  | T-U-09 | L1 |
| SCR-BRIDGE-SETUP-011 | bridge-setup | 到達性 | リンク先 ai-staff が実在ルートで 200 で開く | — | 押す | /ai-staff が開く（G-04） |  |  | T-U-09 | L1 |
| SCR-BRIDGE-SETUP-012 | bridge-setup | 到達性 | リンク先 approvals が実在ルートで 200 で開く | — | 押す | /approvals が開く（G-04） |  |  | T-U-09 | L1 |
| SCR-BRIDGE-SETUP-013 | bridge-setup | 到達性 | リンク先 audit が実在ルートで 200 で開く | — | 押す | /audit が開く（G-04） |  |  | T-U-09 | L1 |
| SCR-BRIDGE-SETUP-014 | bridge-setup | 到達性 | リンク先 automation-repair が実在ルートで 200 で開く | — | 押す | /automation-repair が開く（G-04） |  |  | T-U-09 | L1 |
| SCR-BRIDGE-SETUP-015 | bridge-setup | 到達性 | リンク先 billing が実在ルートで 200 で開く | — | 押す | /billing が開く（G-04） |  |  | T-U-09 | L1 |
| SCR-BRIDGE-SETUP-016 | bridge-setup | 横溢れ | 375・768・1024・1440 で scrollWidth - clientWidth <= 1、1180+ で本文 720 以上 | — | 各幅で開く | 溢れ 0 |  | G-05 | T-U-09 | L1 |
| SCR-BRIDGE-SETUP-017 | bridge-setup | 空・止まっている | データ 0 件の状態と AI が止まっている状態が cover 宣言どおりに出る | PS2 / PS4 | 開く | 空状態と止まっている帯 |  | G18 | T-U-09 | L1 |
| SCR-BRIDGE-SETUP-018 | bridge-setup | 表記ゆらぎ | 全角／半角：メール・数値・コードを全角で入れる | 入力欄がある状態 | 入力して保存 | 同一として扱われ、サーバー側で正規化されて保存される（クライアント側だけに頼らない） |  | human-grade-qa 第11軸 | T-U-09 | L1 |
| SCR-BRIDGE-SETUP-019 | bridge-setup | 表記ゆらぎ | 前後と途中の空白：空白付きで入れる | 入力欄がある状態 | 入力して保存 | 同一として扱われ、サーバー側で正規化されて保存される（クライアント側だけに頼らない） |  | human-grade-qa 第11軸 | T-U-09 | L1 |
| SCR-BRIDGE-SETUP-020 | bridge-setup | 表記ゆらぎ | 記号の種別（ハイフン・長音）：‐ ー − を混ぜる | 入力欄がある状態 | 入力して保存 | 同一として扱われ、サーバー側で正規化されて保存される（クライアント側だけに頼らない） |  | human-grade-qa 第11軸 | T-U-09 | L1 |
| SCR-BRIDGE-SETUP-021 | bridge-setup | 表記ゆらぎ | Unicode 正規化（NFC/NFD）：macOS の入力（NFD）で入れる | 入力欄がある状態 | 入力して保存 | 同一として扱われ、サーバー側で正規化されて保存される（クライアント側だけに頼らない） |  | human-grade-qa 第11軸 | T-U-09 | L1 |
| SCR-BRIDGE-SETUP-022 | bridge-setup | 表記ゆらぎ | 大文字小文字：メールを大文字で入れる | 入力欄がある状態 | 入力して保存 | 同一として扱われ、サーバー側で正規化されて保存される（クライアント側だけに頼らない） |  | human-grade-qa 第11軸 | T-U-09 | L1 |
| SCR-BRIDGE-SETUP-023 | bridge-setup | G-11 外部リソースの実在 | N/A：外部リソースを触らない | migration/IaC 適用後 | 起動時の存在確認を読む | 無ければ起動時に落ちる（黙って 502 にならない） |  | 環境ごと | T-U-09 | L1 |
| SCR-BRIDGE-SETUP-024 | bridge-setup | G-12 切り替わりの瞬間 | Bridge が切れた直後 0 秒・鮮度窓の内側に操作する | 本番稼働中 | PC を閉じた直後に主アクションを押す | 「AI は止まっています」が出て、押した内容は失われない |  |  | T-U-09 | L1 |
| SCR-BRIDGE-SETUP-025 | bridge-setup | G-13 機能の組み合わせ | 実行中 × 切替／中断 × 再開／別ロール同時 の直積のうち該当分 | — | 同時に起こす | 後勝ちでなく、規則どおり（承認は 1 人 1 回・切替は次の実行から） |  | features.json combination_points | T-U-09 | L1 |
| SCR-BRIDGE-SETUP-026 | bridge-setup | G-14 口座状態の波及 | 退会・停止・権限変更・パスワード変更の後に、この機能の既存セッション・接続・共有リンクが無効 | ログイン中の別端末と Bridge | 権限を変える | 別端末と Bridge は 0 秒で 401（sessions が revoked） |  |  | T-U-09 | L1 |
| SCR-BRIDGE-SETUP-027 | bridge-setup | G-15 信号なし終了 | N/A：外部を呼ばない | 外部を故意に切る | 実行する | 成功扱いにせず、502 と次の一手（人へのハンドオフ） |  |  | T-U-09 | L1 |
| SCR-BRIDGE-SETUP-028 | bridge-setup | G-16 有限資源 | 消費する資源：DB 接続（プール経由）・メモリ。1 要求あたり 1 接続以下・上限時は待機列 | 同時 50 要求 | 同時に叩く | ログインが落ちない・接続上限に張り付かない（関門 C2 のプール） |  | L4 で負荷試験 | T-U-09 | L1 |
