# app-setup テスト仕様（L1・機械生成）

> 05_flow/build_tasks.py がタスクと同時に生成。ID は変えない。途中変更は qa_delta.py で差分。結果列は staging で流した人が書く（再生成しても残る。結果あり 2 行）。

| ID | 画面 | テスト観点 | テスト項目 | 前提条件 | 操作手順 | 期待結果 | 結果 | 備考 | タスク | 実行条件 |
|---|---|---|---|---|---|---|---|---|---|---|
| API-26-001 | app-setup | API 正常 | POST /api/v1/llm_routes：作成・実行（llm_routes）— AI の経路（Bridge／自分の API | 権限のある会員 | 呼ぶ | 201 と { data: LlmRoutes, meta?: { cursor, limi |  | A82 | T-A-26 | L1 |
| API-26-002 | app-setup | API 異常 | POST /api/v1/llm_routes：セッションが無い・失効している（退会・停止・権限変更・パスワード変更で即失効） | — | 条件を作って呼ぶ | 401 UNAUTHENTICATED。副作用なし |  | UNWANTED: IF セッションが無いか失効しているなら、Kaname は  | T-A-26 | L1 |
| API-26-003 | app-setup | API 異常 | POST /api/v1/llm_routes：権限（誰に×何に×どの層で×できること）が無い、または運営が許可の無い会社を読もうとした | — | 条件を作って呼ぶ | 403 FORBIDDEN。副作用なし |  | UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用 | T-A-26 | L1 |
| API-26-004 | app-setup | API 異常 | POST /api/v1/llm_routes：二重送信・同時編集・既に登録済み（冪等キーで防ぐ） | — | 条件を作って呼ぶ | 409 CONFLICT。副作用なし |  | UNWANTED: IF 同じ冪等キーで二度来たら、Kaname は最初の結果を | T-A-26 | L1 |
| API-26-005 | app-setup | API 異常 | POST /api/v1/llm_routes：必須・形式・値域・表記ゆらぎ（全角半角・空白・記号） | — | 条件を作って呼ぶ | 422 VALIDATION_ERROR。副作用なし |  | UNWANTED: IF 入力が受け付けられないなら、Kaname は 422  | T-A-26 | L1 |
| API-26-006 | app-setup | 状態 | POST /api/v1/llm_routes：0 件／大量（1,000）／重複／初回／2 回目 | — | 各状態で呼ぶ | 0 件は空配列、大量はページング、重複は 409、2 回目は冪等 |  |  | T-A-26 | L1 |
| API-26-007 | app-setup | API 正常 | PATCH /api/v1/push_devices/:id：更新（push_devices）— スマホ／PC のアプリを入れて、通知を受け取 | 権限のある会員 | 呼ぶ | 200 と { data: PushDevices, meta?: { cursor, li |  | A83 | T-A-26 | L1 |
| API-26-008 | app-setup | API 異常 | PATCH /api/v1/push_devices/:id：セッションが無い・失効している（退会・停止・権限変更・パスワード変更で即失効） | — | 条件を作って呼ぶ | 401 UNAUTHENTICATED。副作用なし |  | UNWANTED: IF セッションが無いか失効しているなら、Kaname は  | T-A-26 | L1 |
| API-26-009 | app-setup | API 異常 | PATCH /api/v1/push_devices/:id：権限（誰に×何に×どの層で×できること）が無い、または運営が許可の無い会社を読もうとした | — | 条件を作って呼ぶ | 403 FORBIDDEN。副作用なし |  | UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用 | T-A-26 | L1 |
| API-26-010 | app-setup | API 異常 | PATCH /api/v1/push_devices/:id：無い・消えた・取り消された（期限切れ・削除済み・他社の行） | — | 条件を作って呼ぶ | 404 NOT_FOUND。副作用なし |  | UNWANTED: IF 対象が無いか他社の行なら、Kaname は 404 を | T-A-26 | L1 |
| API-26-011 | app-setup | API 異常 | PATCH /api/v1/push_devices/:id：必須・形式・値域・表記ゆらぎ（全角半角・空白・記号） | — | 条件を作って呼ぶ | 422 VALIDATION_ERROR。副作用なし |  | UNWANTED: IF 入力が受け付けられないなら、Kaname は 422  | T-A-26 | L1 |
| API-26-012 | app-setup | 状態 | PATCH /api/v1/push_devices/:id：0 件／大量（1,000）／重複／初回／2 回目 | — | 各状態で呼ぶ | 0 件は空配列、大量はページング、重複は 409、2 回目は冪等 |  |  | T-A-26 | L1 |
| API-26-013 | app-setup | G-11 外部リソースの実在 | 触る外部リソースが staging と production に存在する | migration/IaC 適用後 | 起動時の存在確認を読む | 無ければ起動時に落ちる（黙って 502 にならない） |  | 環境ごと | T-A-26 | L1 |
| API-26-014 | app-setup | G-12 切り替わりの瞬間 | Bridge が切れた直後 0 秒・鮮度窓の内側に操作する | 本番稼働中 | PC を閉じた直後に主アクションを押す | 「AI は止まっています」が出て、押した内容は失われない |  |  | T-A-26 | L1 |
| API-26-015 | app-setup | G-13 機能の組み合わせ | 実行中 × 切替／中断 × 再開／別ロール同時 の直積のうち該当分 | — | 同時に起こす | 後勝ちでなく、規則どおり（承認は 1 人 1 回・切替は次の実行から） |  | features.json combination_points | T-A-26 | L1 |
| API-26-016 | app-setup | G-14 口座状態の波及 | 退会・停止・権限変更・パスワード変更の後に、この機能の既存セッション・接続・共有リンクが無効 | ログイン中の別端末と Bridge | 権限を変える | 別端末と Bridge は 0 秒で 401（sessions が revoked） |  |  | T-A-26 | L1 |
| API-26-017 | app-setup | G-15 信号なし終了 | 外部・モデル・プロセスが完了信号を出さずに終わる／空を返す | 外部を故意に切る | 実行する | 成功扱いにせず、502 と次の一手（人へのハンドオフ） |  |  | T-A-26 | L1 |
| API-26-018 | app-setup | G-16 有限資源 | 消費する資源：DB 接続（プール経由）・メモリ。1 要求あたり 1 接続以下・上限時は待機列 | 同時 50 要求 | 同時に叩く | ログインが落ちない・接続上限に張り付かない（関門 C2 のプール） |  | L4 で負荷試験 | T-A-26 | L1 |
| SCR-APP-SETUP-001 | app-setup | 状態 | 状態「アプリと通知」がモックどおりに出る（h1・第2ナビ・列の値がダミー固定でない） | その状態を作る | 画面を開く | モック 06_mockup/v2/v2-app-setup.html の状態 n と一致 |  | G-06・G-07 | T-U-62 | L1 |
| SCR-APP-SETUP-002 | app-setup | 状態 | 状態「許可待ち」がモックどおりに出る（h1・第2ナビ・列の値がダミー固定でない） | その状態を作る | 画面を開く | モック 06_mockup/v2/v2-app-setup.html の状態 p と一致 |  | G-06・G-07 | T-U-62 | L1 |
| SCR-APP-SETUP-003 | app-setup | 状態 | 状態「許可が無い・つながっていない」がモックどおりに出る（h1・第2ナビ・列の値がダミー固定でない） | その状態を作る | 画面を開く | モック 06_mockup/v2/v2-app-setup.html の状態 x と一致 |  | G-06・G-07 | T-U-62 | L1 |
| SCR-APP-SETUP-004 | app-setup | 役割 | 役割 R1 で開くと、その役割の中身（data-roles）が出て、他の役割の中身は出ない | R1 でログイン | 画面を開く | 役割ごとの中身（G15） |  |  | T-U-62 | L1 |
| SCR-APP-SETUP-005 | app-setup | 役割 | 役割 R2 で開くと、その役割の中身（data-roles）が出て、他の役割の中身は出ない | R2 でログイン | 画面を開く | 役割ごとの中身（G15） |  |  | T-U-62 | L1 |
| SCR-APP-SETUP-006 | app-setup | 役割 | 役割 R3 で開くと、その役割の中身（data-roles）が出て、他の役割の中身は出ない | R3 でログイン | 画面を開く | 役割ごとの中身（G15） |  |  | T-U-62 | L1 |
| SCR-APP-SETUP-007 | app-setup | 役割 | 役割 R4 で開くと、その役割の中身（data-roles）が出て、他の役割の中身は出ない | R4 でログイン | 画面を開く | 役割ごとの中身（G15） |  |  | T-U-62 | L1 |
| SCR-APP-SETUP-008 | app-setup | 主アクション | 「通知を許可する」を押すと対応する endpoint が呼ばれ、別 GET で再取得した画面に反映される | 権限のある会員 | 押す | DB と画面が変わる（G-01・G-03） |  | PATCH /api/push_devices/:id | T-U-62 | L1 |
| SCR-APP-SETUP-009 | app-setup | 横溢れ | 375・768・1024・1440 で scrollWidth - clientWidth <= 1、1180+ で本文 720 以上 | — | 各幅で開く | 溢れ 0 |  | G-05 | T-U-62 | L1 |
| SCR-APP-SETUP-010 | app-setup | 空・止まっている | データ 0 件の状態と AI が止まっている状態が cover 宣言どおりに出る | PS2 / PS4 | 開く | 空状態と止まっている帯 |  | G18 | T-U-62 | L1 |
| SCR-APP-SETUP-011 | app-setup | 表記ゆらぎ | 全角／半角：メール・数値・コードを全角で入れる | 入力欄がある状態 | 入力して保存 | 同一として扱われ、サーバー側で正規化されて保存される（クライアント側だけに頼らない） |  | human-grade-qa 第11軸 | T-U-62 | L1 |
| SCR-APP-SETUP-012 | app-setup | 表記ゆらぎ | 前後と途中の空白：空白付きで入れる | 入力欄がある状態 | 入力して保存 | 同一として扱われ、サーバー側で正規化されて保存される（クライアント側だけに頼らない） |  | human-grade-qa 第11軸 | T-U-62 | L1 |
| SCR-APP-SETUP-013 | app-setup | 表記ゆらぎ | 記号の種別（ハイフン・長音）：‐ ー − を混ぜる | 入力欄がある状態 | 入力して保存 | 同一として扱われ、サーバー側で正規化されて保存される（クライアント側だけに頼らない） |  | human-grade-qa 第11軸 | T-U-62 | L1 |
| SCR-APP-SETUP-014 | app-setup | 表記ゆらぎ | Unicode 正規化（NFC/NFD）：macOS の入力（NFD）で入れる | 入力欄がある状態 | 入力して保存 | 同一として扱われ、サーバー側で正規化されて保存される（クライアント側だけに頼らない） |  | human-grade-qa 第11軸 | T-U-62 | L1 |
| SCR-APP-SETUP-015 | app-setup | 表記ゆらぎ | 大文字小文字：メールを大文字で入れる | 入力欄がある状態 | 入力して保存 | 同一として扱われ、サーバー側で正規化されて保存される（クライアント側だけに頼らない） |  | human-grade-qa 第11軸 | T-U-62 | L1 |
| SCR-APP-SETUP-016 | app-setup | G-11 外部リソースの実在 | N/A：外部リソースを触らない | migration/IaC 適用後 | 起動時の存在確認を読む | 無ければ起動時に落ちる（黙って 502 にならない） |  | 環境ごと | T-U-62 | L1 |
| SCR-APP-SETUP-017 | app-setup | G-12 切り替わりの瞬間 | Bridge が切れた直後 0 秒・鮮度窓の内側に操作する | 本番稼働中 | PC を閉じた直後に主アクションを押す | 「AI は止まっています」が出て、押した内容は失われない |  |  | T-U-62 | L1 |
| SCR-APP-SETUP-018 | app-setup | G-13 機能の組み合わせ | 実行中 × 切替／中断 × 再開／別ロール同時 の直積のうち該当分 | — | 同時に起こす | 後勝ちでなく、規則どおり（承認は 1 人 1 回・切替は次の実行から） |  | features.json combination_points | T-U-62 | L1 |
| SCR-APP-SETUP-019 | app-setup | G-14 口座状態の波及 | 退会・停止・権限変更・パスワード変更の後に、この機能の既存セッション・接続・共有リンクが無効 | ログイン中の別端末と Bridge | 権限を変える | 別端末と Bridge は 0 秒で 401（sessions が revoked） |  |  | T-U-62 | L1 |
| SCR-APP-SETUP-020 | app-setup | G-15 信号なし終了 | N/A：外部を呼ばない | 外部を故意に切る | 実行する | 成功扱いにせず、502 と次の一手（人へのハンドオフ） |  |  | T-U-62 | L1 |
| SCR-APP-SETUP-021 | app-setup | G-16 有限資源 | 消費する資源：DB 接続（プール経由）・メモリ。1 要求あたり 1 接続以下・上限時は待機列 | 同時 50 要求 | 同時に叩く | ログインが落ちない・接続上限に張り付かない（関門 C2 のプール） |  | L4 で負荷試験 | T-U-62 | L1 |
| SCR-APP-SETUP-022 | app-setup | 操作 | ボタン「高本AI」（状態 共通） | 状態 共通 を作る（全役割） | 押す／入れる（実ブラウザ） | 押すと処理が起き、結果（遷移・DB の変化・表示の変化）が確認できる。押しても何も起きないなら未実装（G-01） |  | op=button:高本AI | T-U-62 | L1 |
| SCR-APP-SETUP-023 | app-setup | 操作 | リンク「AI は止まっています」（状態 共通） | 状態 共通 を作る（全役割） | 押す／入れる（実ブラウザ） | /automation-repair が実在ルートで 200 で開く（G-04） | BLOCKED（自動：行き先の画面 automation-repair は T-U-32 で実装（未着手）。href は flow の route と機械照合済み・押すと 404 になるので今は押せない） | op=link:AI は止まっています→automation-repair | T-U-62 | L1 |
| SCR-APP-SETUP-024 | app-setup | 操作 | リンク「PC をつなぐと話せます」（状態 共通） | 状態 共通 を作る（全役割） | 押す／入れる（実ブラウザ） | /bridge-setup が実在ルートで 200 で開く（G-04） |  | op=link:PC をつなぐと話せます→bridge-setup | T-U-62 | L1 |
| SCR-APP-SETUP-025 | app-setup | 操作 | ボタン「通知を許可する」（状態 共通） | 状態 共通 を作る（全役割） | 押す／入れる（実ブラウザ） | 押すと処理が起き、結果（遷移・DB の変化・表示の変化）が確認できる。押しても何も起きないなら未実装（G-01） |  | op=button:通知を許可する | T-U-62 | L1 |
| SCR-APP-SETUP-026 | app-setup | 操作 | ボタン「Bridge の窓で開く」（状態 アプリと通知） | 状態 アプリと通知 を作る（全役割） | 押す／入れる（実ブラウザ） | 押すと処理が起き、結果（遷移・DB の変化・表示の変化）が確認できる。押しても何も起きないなら未実装（G-01） |  | op=button:Bridge の窓で開く | T-U-62 | L1 |
| SCR-APP-SETUP-027 | app-setup | 操作 | ボタン「App Store」（状態 アプリと通知） | 状態 アプリと通知 を作る（全役割） | 押す／入れる（実ブラウザ） | 押すと処理が起き、結果（遷移・DB の変化・表示の変化）が確認できる。押しても何も起きないなら未実装（G-01） |  | op=button:App Store | T-U-62 | L1 |
| SCR-APP-SETUP-028 | app-setup | 操作 | ボタン「Google Play」（状態 アプリと通知） | 状態 アプリと通知 を作る（全役割） | 押す／入れる（実ブラウザ） | 押すと処理が起き、結果（遷移・DB の変化・表示の変化）が確認できる。押しても何も起きないなら未実装（G-01） |  | op=button:Google Play | T-U-62 | L1 |
| SCR-APP-SETUP-029 | app-setup | 操作 | チェック「checkbox」（状態 アプリと通知） | 状態 アプリと通知 を作る（全役割） | 押す／入れる（実ブラウザ） | 切り替わり、送信に載る |  | op=checkbox:checkbox | T-U-62 | L1 |
| SCR-APP-SETUP-030 | app-setup | 操作 | ボタン「保存する」（状態 アプリと通知） | 状態 アプリと通知 を作る（全役割） | 押す／入れる（実ブラウザ） | 押すと処理が起き、結果（遷移・DB の変化・表示の変化）が確認できる。押しても何も起きないなら未実装（G-01） |  | op=button:保存する | T-U-62 | L1 |
| SCR-APP-SETUP-031 | app-setup | 操作 | ボタン「もう一度たずねる」（状態 許可待ち） | 状態 許可待ち を作る（全役割） | 押す／入れる（実ブラウザ） | 押すと処理が起き、結果（遷移・DB の変化・表示の変化）が確認できる。押しても何も起きないなら未実装（G-01） |  | op=button:もう一度たずねる | T-U-62 | L1 |
| SCR-APP-SETUP-032 | app-setup | 操作 | ボタン「設定の開き方を見る」（状態 許可が無い・つながっていない） | 状態 許可が無い・つながっていない を作る（全役割） | 押す／入れる（実ブラウザ） | 押すと処理が起き、結果（遷移・DB の変化・表示の変化）が確認できる。押しても何も起きないなら未実装（G-01） |  | op=button:設定の開き方を見る | T-U-62 | L1 |
| SCR-APP-SETUP-033 | app-setup | 発注者確認 | 手順 07_tasks/handoff/T-U-62.md を発注者が実際に触って OK を出す（Rule 12） | staging か ローカル | 手順どおりに触る | 手順の末尾に「OK: 日付 名前」が書かれる。無い間は BLOCKED（発注者の確認待ち） | BLOCKED（発注者の確認待ち：手順 07_tasks/handoff/T-U-62.md を高本さんが触って OK: を書く。ローカル 3123 で触れる・staging は無い） | Rule 12 | T-U-62 | L1 |
