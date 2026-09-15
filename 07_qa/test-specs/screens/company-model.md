# company-model テスト仕様（L1・機械生成）

> 05_flow/build_tasks.py がタスクと同時に生成。ID は変えない。途中変更は qa_delta.py で差分。結果列は staging で流した人が書く。

| ID | 画面 | テスト観点 | テスト項目 | 前提条件 | 操作手順 | 期待結果 | 結果 | 備考 | タスク | 実行条件 |
|---|---|---|---|---|---|---|---|---|---|---|
| API-14-001 | company-model | API 正常 | PATCH /api/v1/duties/:id：更新（duties）— 担当業務を書き換える | 権限のある会員 | 呼ぶ | 200 と { data: Duties, meta?: { cursor, limit,  |  | A28 | T-A-14 | L1 |
| API-14-002 | company-model | API 異常 | PATCH /api/v1/duties/:id：セッションが無い・失効している（退会・停止・権限変更・パスワード変更で即失効） | — | 条件を作って呼ぶ | 401 UNAUTHENTICATED。副作用なし |  | UNWANTED: IF セッションが無いか失効しているなら、Kaname は  | T-A-14 | L1 |
| API-14-003 | company-model | API 異常 | PATCH /api/v1/duties/:id：権限（誰に×何に×どの層で×できること）が無い、または運営が許可の無い会社を読もうとした | — | 条件を作って呼ぶ | 403 FORBIDDEN。副作用なし |  | UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用 | T-A-14 | L1 |
| API-14-004 | company-model | API 異常 | PATCH /api/v1/duties/:id：無い・消えた・取り消された（期限切れ・削除済み・他社の行） | — | 条件を作って呼ぶ | 404 NOT_FOUND。副作用なし |  | UNWANTED: IF 対象が無いか他社の行なら、Kaname は 404 を | T-A-14 | L1 |
| API-14-005 | company-model | API 異常 | PATCH /api/v1/duties/:id：必須・形式・値域・表記ゆらぎ（全角半角・空白・記号） | — | 条件を作って呼ぶ | 422 VALIDATION_ERROR。副作用なし |  | UNWANTED: IF 入力が受け付けられないなら、Kaname は 422  | T-A-14 | L1 |
| API-14-006 | company-model | 状態 | PATCH /api/v1/duties/:id：0 件／大量（1,000）／重複／初回／2 回目 | — | 各状態で呼ぶ | 0 件は空配列、大量はページング、重複は 409、2 回目は冪等 |  |  | T-A-14 | L1 |
| API-14-007 | company-model | API 正常 | PATCH /api/v1/ledger_definitions/:id：更新（ledger_definitions）— 止まっている案件を動かす／台帳の | 権限のある会員 | 呼ぶ | 200 と { data: LedgerDefinitions, meta?: { curs |  | A24 A44 | T-A-14 | L1 |
| API-14-008 | company-model | API 異常 | PATCH /api/v1/ledger_definitions/:id：セッションが無い・失効している（退会・停止・権限変更・パスワード変更で即失効） | — | 条件を作って呼ぶ | 401 UNAUTHENTICATED。副作用なし |  | UNWANTED: IF セッションが無いか失効しているなら、Kaname は  | T-A-14 | L1 |
| API-14-009 | company-model | API 異常 | PATCH /api/v1/ledger_definitions/:id：権限（誰に×何に×どの層で×できること）が無い、または運営が許可の無い会社を読もうとした | — | 条件を作って呼ぶ | 403 FORBIDDEN。副作用なし |  | UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用 | T-A-14 | L1 |
| API-14-010 | company-model | API 異常 | PATCH /api/v1/ledger_definitions/:id：無い・消えた・取り消された（期限切れ・削除済み・他社の行） | — | 条件を作って呼ぶ | 404 NOT_FOUND。副作用なし |  | UNWANTED: IF 対象が無いか他社の行なら、Kaname は 404 を | T-A-14 | L1 |
| API-14-011 | company-model | API 異常 | PATCH /api/v1/ledger_definitions/:id：必須・形式・値域・表記ゆらぎ（全角半角・空白・記号） | — | 条件を作って呼ぶ | 422 VALIDATION_ERROR。副作用なし |  | UNWANTED: IF 入力が受け付けられないなら、Kaname は 422  | T-A-14 | L1 |
| API-14-012 | company-model | 状態 | PATCH /api/v1/ledger_definitions/:id：0 件／大量（1,000）／重複／初回／2 回目 | — | 各状態で呼ぶ | 0 件は空配列、大量はページング、重複は 409、2 回目は冪等 |  |  | T-A-14 | L1 |
| API-14-013 | company-model | API 正常 | GET /api/v1/tenants：取得（tenants）— 自分のAIが作ったたたき台（目標・台帳・AI社員）を見 | 権限のある会員 | 呼ぶ | 200 と { data: Tenants[], meta?: { cursor, limi |  | A07 A08 A12 A45 | T-A-14 | L1 |
| API-14-014 | company-model | API 異常 | GET /api/v1/tenants：セッションが無い・失効している（退会・停止・権限変更・パスワード変更で即失効） | — | 条件を作って呼ぶ | 401 UNAUTHENTICATED。副作用なし |  | UNWANTED: IF セッションが無いか失効しているなら、Kaname は  | T-A-14 | L1 |
| API-14-015 | company-model | API 異常 | GET /api/v1/tenants：権限（誰に×何に×どの層で×できること）が無い、または運営が許可の無い会社を読もうとした | — | 条件を作って呼ぶ | 403 FORBIDDEN。副作用なし |  | UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用 | T-A-14 | L1 |
| API-14-016 | company-model | API 異常 | GET /api/v1/tenants：120/min/user | — | 条件を作って呼ぶ | 429 RATE_LIMITED。副作用なし |  | UNWANTED: IF 120/min/user を超えたら、Kaname は | T-A-14 | L1 |
| API-14-017 | company-model | API 異常 | GET /api/v1/tenants：外部サービス・モデル・プロセスが失敗した／合図を出さずに終わった | — | 条件を作って呼ぶ | 502 EXTERNAL_FAILED。副作用なし |  | UNWANTED: IF 外部が失敗したか完了信号が無いなら、Kaname は成 | T-A-14 | L1 |
| API-14-018 | company-model | 状態 | GET /api/v1/tenants：0 件／大量（1,000）／重複／初回／2 回目 | — | 各状態で呼ぶ | 0 件は空配列、大量はページング、重複は 409、2 回目は冪等 |  |  | T-A-14 | L1 |
| API-14-019 | company-model | G-11 外部リソースの実在 | N/A：外部リソースを触らない | migration/IaC 適用後 | 起動時の存在確認を読む | 無ければ起動時に落ちる（黙って 502 にならない） |  | 環境ごと | T-A-14 | L1 |
| API-14-020 | company-model | G-12 切り替わりの瞬間 | Bridge が切れた直後 0 秒・鮮度窓の内側に操作する | 本番稼働中 | PC を閉じた直後に主アクションを押す | 「AI は止まっています」が出て、押した内容は失われない |  |  | T-A-14 | L1 |
| API-14-021 | company-model | G-13 機能の組み合わせ | 実行中 × 切替／中断 × 再開／別ロール同時 の直積のうち該当分 | — | 同時に起こす | 後勝ちでなく、規則どおり（承認は 1 人 1 回・切替は次の実行から） |  | features.json combination_points | T-A-14 | L1 |
| API-14-022 | company-model | G-14 口座状態の波及 | 退会・停止・権限変更・パスワード変更の後に、この機能の既存セッション・接続・共有リンクが無効 | ログイン中の別端末と Bridge | 権限を変える | 別端末と Bridge は 0 秒で 401（sessions が revoked） |  |  | T-A-14 | L1 |
| API-14-023 | company-model | G-15 信号なし終了 | 外部・モデル・プロセスが完了信号を出さずに終わる／空を返す | 外部を故意に切る | 実行する | 成功扱いにせず、502 と次の一手（人へのハンドオフ） |  |  | T-A-14 | L1 |
| API-14-024 | company-model | G-16 有限資源 | 消費する資源：DB 接続（プール経由）・メモリ。1 要求あたり 1 接続以下・上限時は待機列 | 同時 50 要求 | 同時に叩く | ログインが落ちない・接続上限に張り付かない（関門 C2 のプール） |  | L4 で負荷試験 | T-A-14 | L1 |
| SCR-COMPANY-MODEL-001 | company-model | 状態 | 状態「全体」がモックどおりに出る（h1・第2ナビ・列の値がダミー固定でない） | その状態を作る | 画面を開く | モック 06_mockup/v1/v1-company-model.html の状態 n と一致 |  | G-06・G-07 | T-U-31 | L1 |
| SCR-COMPANY-MODEL-002 | company-model | 状態 | 状態「版の履歴」がモックどおりに出る（h1・第2ナビ・列の値がダミー固定でない） | その状態を作る | 画面を開く | モック 06_mockup/v1/v1-company-model.html の状態 v と一致 |  | G-06・G-07 | T-U-31 | L1 |
| SCR-COMPANY-MODEL-003 | company-model | 状態 | 状態「テンプレ」がモックどおりに出る（h1・第2ナビ・列の値がダミー固定でない） | その状態を作る | 画面を開く | モック 06_mockup/v1/v1-company-model.html の状態 t と一致 |  | G-06・G-07 | T-U-31 | L1 |
| SCR-COMPANY-MODEL-004 | company-model | 状態 | 状態「空」がモックどおりに出る（h1・第2ナビ・列の値がダミー固定でない） | その状態を作る | 画面を開く | モック 06_mockup/v1/v1-company-model.html の状態 ge と一致 |  | G-06・G-07 | T-U-31 | L1 |
| SCR-COMPANY-MODEL-005 | company-model | 状態 | 状態「AI が止まっている」がモックどおりに出る（h1・第2ナビ・列の値がダミー固定でない） | その状態を作る | 画面を開く | モック 06_mockup/v1/v1-company-model.html の状態 gs と一致 |  | G-06・G-07 | T-U-31 | L1 |
| SCR-COMPANY-MODEL-006 | company-model | 役割 | 役割 R1 で開くと、その役割の中身（data-roles）が出て、他の役割の中身は出ない | R1 でログイン | 画面を開く | 役割ごとの中身（G15） |  |  | T-U-31 | L1 |
| SCR-COMPANY-MODEL-007 | company-model | 役割 | 役割 R2 で開くと、その役割の中身（data-roles）が出て、他の役割の中身は出ない | R2 でログイン | 画面を開く | 役割ごとの中身（G15） |  |  | T-U-31 | L1 |
| SCR-COMPANY-MODEL-008 | company-model | 主アクション | 「中身を見る」を押すと対応する endpoint が呼ばれ、別 GET で再取得した画面に反映される | 権限のある会員 | 押す | DB と画面が変わる（G-01・G-03） |  | GET /api/tenants | T-U-31 | L1 |
| SCR-COMPANY-MODEL-009 | company-model | 到達性 | リンク先 account が実在ルートで 200 で開く | — | 押す | /account が開く（G-04） |  |  | T-U-31 | L1 |
| SCR-COMPANY-MODEL-010 | company-model | 到達性 | リンク先 account-close が実在ルートで 200 で開く | — | 押す | /account-close が開く（G-04） |  |  | T-U-31 | L1 |
| SCR-COMPANY-MODEL-011 | company-model | 到達性 | リンク先 ai-activity が実在ルートで 200 で開く | — | 押す | /ai-activity が開く（G-04） |  |  | T-U-31 | L1 |
| SCR-COMPANY-MODEL-012 | company-model | 到達性 | リンク先 ai-staff が実在ルートで 200 で開く | — | 押す | /ai-staff が開く（G-04） |  |  | T-U-31 | L1 |
| SCR-COMPANY-MODEL-013 | company-model | 到達性 | リンク先 approvals が実在ルートで 200 で開く | — | 押す | /approvals が開く（G-04） |  |  | T-U-31 | L1 |
| SCR-COMPANY-MODEL-014 | company-model | 到達性 | リンク先 audit が実在ルートで 200 で開く | — | 押す | /audit が開く（G-04） |  |  | T-U-31 | L1 |
| SCR-COMPANY-MODEL-015 | company-model | 到達性 | リンク先 automation-repair が実在ルートで 200 で開く | — | 押す | /automation-repair が開く（G-04） |  |  | T-U-31 | L1 |
| SCR-COMPANY-MODEL-016 | company-model | 到達性 | リンク先 billing が実在ルートで 200 で開く | — | 押す | /billing が開く（G-04） |  |  | T-U-31 | L1 |
| SCR-COMPANY-MODEL-017 | company-model | 横溢れ | 375・768・1024・1440 で scrollWidth - clientWidth <= 1、1180+ で本文 720 以上 | — | 各幅で開く | 溢れ 0 |  | G-05 | T-U-31 | L1 |
| SCR-COMPANY-MODEL-018 | company-model | 空・止まっている | データ 0 件の状態と AI が止まっている状態が cover 宣言どおりに出る | PS2 / PS4 | 開く | 空状態と止まっている帯 |  | G18 | T-U-31 | L1 |
| SCR-COMPANY-MODEL-019 | company-model | 表記ゆらぎ | 全角／半角：メール・数値・コードを全角で入れる | 入力欄がある状態 | 入力して保存 | 同一として扱われ、サーバー側で正規化されて保存される（クライアント側だけに頼らない） |  | human-grade-qa 第11軸 | T-U-31 | L1 |
| SCR-COMPANY-MODEL-020 | company-model | 表記ゆらぎ | 前後と途中の空白：空白付きで入れる | 入力欄がある状態 | 入力して保存 | 同一として扱われ、サーバー側で正規化されて保存される（クライアント側だけに頼らない） |  | human-grade-qa 第11軸 | T-U-31 | L1 |
| SCR-COMPANY-MODEL-021 | company-model | 表記ゆらぎ | 記号の種別（ハイフン・長音）：‐ ー − を混ぜる | 入力欄がある状態 | 入力して保存 | 同一として扱われ、サーバー側で正規化されて保存される（クライアント側だけに頼らない） |  | human-grade-qa 第11軸 | T-U-31 | L1 |
| SCR-COMPANY-MODEL-022 | company-model | 表記ゆらぎ | Unicode 正規化（NFC/NFD）：macOS の入力（NFD）で入れる | 入力欄がある状態 | 入力して保存 | 同一として扱われ、サーバー側で正規化されて保存される（クライアント側だけに頼らない） |  | human-grade-qa 第11軸 | T-U-31 | L1 |
| SCR-COMPANY-MODEL-023 | company-model | 表記ゆらぎ | 大文字小文字：メールを大文字で入れる | 入力欄がある状態 | 入力して保存 | 同一として扱われ、サーバー側で正規化されて保存される（クライアント側だけに頼らない） |  | human-grade-qa 第11軸 | T-U-31 | L1 |
| SCR-COMPANY-MODEL-024 | company-model | G-11 外部リソースの実在 | N/A：外部リソースを触らない | migration/IaC 適用後 | 起動時の存在確認を読む | 無ければ起動時に落ちる（黙って 502 にならない） |  | 環境ごと | T-U-31 | L1 |
| SCR-COMPANY-MODEL-025 | company-model | G-12 切り替わりの瞬間 | Bridge が切れた直後 0 秒・鮮度窓の内側に操作する | 本番稼働中 | PC を閉じた直後に主アクションを押す | 「AI は止まっています」が出て、押した内容は失われない |  |  | T-U-31 | L1 |
| SCR-COMPANY-MODEL-026 | company-model | G-13 機能の組み合わせ | 実行中 × 切替／中断 × 再開／別ロール同時 の直積のうち該当分 | — | 同時に起こす | 後勝ちでなく、規則どおり（承認は 1 人 1 回・切替は次の実行から） |  | features.json combination_points | T-U-31 | L1 |
| SCR-COMPANY-MODEL-027 | company-model | G-14 口座状態の波及 | 退会・停止・権限変更・パスワード変更の後に、この機能の既存セッション・接続・共有リンクが無効 | ログイン中の別端末と Bridge | 権限を変える | 別端末と Bridge は 0 秒で 401（sessions が revoked） |  |  | T-U-31 | L1 |
| SCR-COMPANY-MODEL-028 | company-model | G-15 信号なし終了 | N/A：外部を呼ばない | 外部を故意に切る | 実行する | 成功扱いにせず、502 と次の一手（人へのハンドオフ） |  |  | T-U-31 | L1 |
| SCR-COMPANY-MODEL-029 | company-model | G-16 有限資源 | 消費する資源：DB 接続（プール経由）・メモリ。1 要求あたり 1 接続以下・上限時は待機列 | 同時 50 要求 | 同時に叩く | ログインが落ちない・接続上限に張り付かない（関門 C2 のプール） |  | L4 で負荷試験 | T-U-31 | L1 |
