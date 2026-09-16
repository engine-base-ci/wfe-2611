# ops-audit テスト仕様（L1・機械生成）

> 05_flow/build_tasks.py がタスクと同時に生成。ID は変えない。途中変更は qa_delta.py で差分。結果列は staging で流した人が書く（再生成しても残る。結果あり 0 行）。

| ID | 画面 | テスト観点 | テスト項目 | 前提条件 | 操作手順 | 期待結果 | 結果 | 備考 | タスク | 実行条件 |
|---|---|---|---|---|---|---|---|---|---|---|
| API-22-001 | ops-audit | API 正常 | POST /api/v1/distributions：作成・実行（distributions）— 会社が明示的に公開したものを、匿名化 | 権限のある会員 | 呼ぶ | 201 と { data: Distributions, meta?: { cursor,  |  | A63 | T-A-22 | L1 |
| API-22-002 | ops-audit | API 異常 | POST /api/v1/distributions：セッションが無い・失効している（退会・停止・権限変更・パスワード変更で即失効） | — | 条件を作って呼ぶ | 401 UNAUTHENTICATED。副作用なし |  | UNWANTED: IF セッションが無いか失効しているなら、Kaname は  | T-A-22 | L1 |
| API-22-003 | ops-audit | API 異常 | POST /api/v1/distributions：権限（誰に×何に×どの層で×できること）が無い、または運営が許可の無い会社を読もうとした | — | 条件を作って呼ぶ | 403 FORBIDDEN。副作用なし |  | UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用 | T-A-22 | L1 |
| API-22-004 | ops-audit | API 異常 | POST /api/v1/distributions：二重送信・同時編集・既に登録済み（冪等キーで防ぐ） | — | 条件を作って呼ぶ | 409 CONFLICT。副作用なし |  | UNWANTED: IF 同じ冪等キーで二度来たら、Kaname は最初の結果を | T-A-22 | L1 |
| API-22-005 | ops-audit | API 異常 | POST /api/v1/distributions：必須・形式・値域・表記ゆらぎ（全角半角・空白・記号） | — | 条件を作って呼ぶ | 422 VALIDATION_ERROR。副作用なし |  | UNWANTED: IF 入力が受け付けられないなら、Kaname は 422  | T-A-22 | L1 |
| API-22-006 | ops-audit | 状態 | POST /api/v1/distributions：0 件／大量（1,000）／重複／初回／2 回目 | — | 各状態で呼ぶ | 0 件は空配列、大量はページング、重複は 409、2 回目は冪等 |  |  | T-A-22 | L1 |
| API-22-007 | ops-audit | API 正常 | PATCH /api/v1/ops_members/:id：更新（ops_members）— 運営の誰が・どの会社に・何をしたかを見る。運営 | 権限のある会員 | 呼ぶ | 200 と { data: OpsMembers, meta?: { cursor, lim |  | A65 | T-A-22 | L1 |
| API-22-008 | ops-audit | API 異常 | PATCH /api/v1/ops_members/:id：セッションが無い・失効している（退会・停止・権限変更・パスワード変更で即失効） | — | 条件を作って呼ぶ | 401 UNAUTHENTICATED。副作用なし |  | UNWANTED: IF セッションが無いか失効しているなら、Kaname は  | T-A-22 | L1 |
| API-22-009 | ops-audit | API 異常 | PATCH /api/v1/ops_members/:id：権限（誰に×何に×どの層で×できること）が無い、または運営が許可の無い会社を読もうとした | — | 条件を作って呼ぶ | 403 FORBIDDEN。副作用なし |  | UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用 | T-A-22 | L1 |
| API-22-010 | ops-audit | API 異常 | PATCH /api/v1/ops_members/:id：無い・消えた・取り消された（期限切れ・削除済み・他社の行） | — | 条件を作って呼ぶ | 404 NOT_FOUND。副作用なし |  | UNWANTED: IF 対象が無いか他社の行なら、Kaname は 404 を | T-A-22 | L1 |
| API-22-011 | ops-audit | API 異常 | PATCH /api/v1/ops_members/:id：必須・形式・値域・表記ゆらぎ（全角半角・空白・記号） | — | 条件を作って呼ぶ | 422 VALIDATION_ERROR。副作用なし |  | UNWANTED: IF 入力が受け付けられないなら、Kaname は 422  | T-A-22 | L1 |
| API-22-012 | ops-audit | 状態 | PATCH /api/v1/ops_members/:id：0 件／大量（1,000）／重複／初回／2 回目 | — | 各状態で呼ぶ | 0 件は空配列、大量はページング、重複は 409、2 回目は冪等 |  |  | T-A-22 | L1 |
| API-22-013 | ops-audit | API 正常 | DELETE /api/v1/plans/:id：削除（plans）— 1 社の詳細で、構成・請求と入金・問い合わせ・配布したも | 権限のある会員 | 呼ぶ | 200 と { data: Plans, meta?: { cursor, limit, t |  | A64 | T-A-22 | L1 |
| API-22-014 | ops-audit | API 異常 | DELETE /api/v1/plans/:id：セッションが無い・失効している（退会・停止・権限変更・パスワード変更で即失効） | — | 条件を作って呼ぶ | 401 UNAUTHENTICATED。副作用なし |  | UNWANTED: IF セッションが無いか失効しているなら、Kaname は  | T-A-22 | L1 |
| API-22-015 | ops-audit | API 異常 | DELETE /api/v1/plans/:id：権限（誰に×何に×どの層で×できること）が無い、または運営が許可の無い会社を読もうとした | — | 条件を作って呼ぶ | 403 FORBIDDEN。副作用なし |  | UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用 | T-A-22 | L1 |
| API-22-016 | ops-audit | API 異常 | DELETE /api/v1/plans/:id：無い・消えた・取り消された（期限切れ・削除済み・他社の行） | — | 条件を作って呼ぶ | 404 NOT_FOUND。副作用なし |  | UNWANTED: IF 対象が無いか他社の行なら、Kaname は 404 を | T-A-22 | L1 |
| API-22-017 | ops-audit | API 異常 | DELETE /api/v1/plans/:id：60/min/user | — | 条件を作って呼ぶ | 429 RATE_LIMITED。副作用なし |  | UNWANTED: IF 60/min/user を超えたら、Kaname は  | T-A-22 | L1 |
| API-22-018 | ops-audit | 状態 | DELETE /api/v1/plans/:id：0 件／大量（1,000）／重複／初回／2 回目 | — | 各状態で呼ぶ | 0 件は空配列、大量はページング、重複は 409、2 回目は冪等 |  |  | T-A-22 | L1 |
| API-22-019 | ops-audit | G-11 外部リソースの実在 | N/A：外部リソースを触らない | migration/IaC 適用後 | 起動時の存在確認を読む | 無ければ起動時に落ちる（黙って 502 にならない） |  | 環境ごと | T-A-22 | L1 |
| API-22-020 | ops-audit | G-12 切り替わりの瞬間 | N/A：状態の切替を持たない | 本番稼働中 | PC を閉じた直後に主アクションを押す | 「AI は止まっています」が出て、押した内容は失われない |  |  | T-A-22 | L1 |
| API-22-021 | ops-audit | G-13 機能の組み合わせ | 実行中 × 切替／中断 × 再開／別ロール同時 の直積のうち該当分 | — | 同時に起こす | 後勝ちでなく、規則どおり（承認は 1 人 1 回・切替は次の実行から） |  | features.json combination_points | T-A-22 | L1 |
| API-22-022 | ops-audit | G-14 口座状態の波及 | 退会・停止・権限変更・パスワード変更の後に、この機能の既存セッション・接続・共有リンクが無効 | ログイン中の別端末と Bridge | 権限を変える | 別端末と Bridge は 0 秒で 401（sessions が revoked） |  |  | T-A-22 | L1 |
| API-22-023 | ops-audit | G-15 信号なし終了 | N/A：外部を呼ばない | 外部を故意に切る | 実行する | 成功扱いにせず、502 と次の一手（人へのハンドオフ） |  |  | T-A-22 | L1 |
| API-22-024 | ops-audit | G-16 有限資源 | 消費する資源：DB 接続（プール経由）・メモリ。1 要求あたり 1 接続以下・上限時は待機列 | 同時 50 要求 | 同時に叩く | ログインが落ちない・接続上限に張り付かない（関門 C2 のプール） |  | L4 で負荷試験 | T-A-22 | L1 |
| SCR-OPS-AUDIT-001 | ops-audit | 状態 | 状態「運営の証跡」がモックどおりに出る（h1・第2ナビ・列の値がダミー固定でない） | その状態を作る | 画面を開く | モック 06_mockup/v1/v1-ops-audit.html の状態 n と一致 |  | G-06・G-07 | T-U-57 | L1 |
| SCR-OPS-AUDIT-002 | ops-audit | 状態 | 状態「空」がモックどおりに出る（h1・第2ナビ・列の値がダミー固定でない） | その状態を作る | 画面を開く | モック 06_mockup/v1/v1-ops-audit.html の状態 ge と一致 |  | G-06・G-07 | T-U-57 | L1 |
| SCR-OPS-AUDIT-003 | ops-audit | 役割 | 役割 R6 で開くと、その役割の中身（data-roles）が出て、他の役割の中身は出ない | R6 でログイン | 画面を開く | 役割ごとの中身（G15） |  |  | T-U-57 | L1 |
| SCR-OPS-AUDIT-004 | ops-audit | 主アクション | 「書き出す」を押すと対応する endpoint が呼ばれ、別 GET で再取得した画面に反映される | 権限のある会員 | 押す | DB と画面が変わる（G-01・G-03） |  | PATCH /api/ops_members/:id GET /api/audit_events | T-U-57 | L1 |
| SCR-OPS-AUDIT-005 | ops-audit | 到達性 | リンク先 account が実在ルートで 200 で開く | — | 押す | /account が開く（G-04） |  |  | T-U-57 | L1 |
| SCR-OPS-AUDIT-006 | ops-audit | 到達性 | リンク先 account-close が実在ルートで 200 で開く | — | 押す | /account-close が開く（G-04） |  |  | T-U-57 | L1 |
| SCR-OPS-AUDIT-007 | ops-audit | 到達性 | リンク先 ai-activity が実在ルートで 200 で開く | — | 押す | /ai-activity が開く（G-04） |  |  | T-U-57 | L1 |
| SCR-OPS-AUDIT-008 | ops-audit | 到達性 | リンク先 ai-staff が実在ルートで 200 で開く | — | 押す | /ai-staff が開く（G-04） |  |  | T-U-57 | L1 |
| SCR-OPS-AUDIT-009 | ops-audit | 到達性 | リンク先 approvals が実在ルートで 200 で開く | — | 押す | /approvals が開く（G-04） |  |  | T-U-57 | L1 |
| SCR-OPS-AUDIT-010 | ops-audit | 到達性 | リンク先 audit が実在ルートで 200 で開く | — | 押す | /audit が開く（G-04） |  |  | T-U-57 | L1 |
| SCR-OPS-AUDIT-011 | ops-audit | 到達性 | リンク先 automation-repair が実在ルートで 200 で開く | — | 押す | /automation-repair が開く（G-04） |  |  | T-U-57 | L1 |
| SCR-OPS-AUDIT-012 | ops-audit | 到達性 | リンク先 billing が実在ルートで 200 で開く | — | 押す | /billing が開く（G-04） |  |  | T-U-57 | L1 |
| SCR-OPS-AUDIT-013 | ops-audit | 横溢れ | 375・768・1024・1440 で scrollWidth - clientWidth <= 1、1180+ で本文 720 以上 | — | 各幅で開く | 溢れ 0 |  | G-05 | T-U-57 | L1 |
| SCR-OPS-AUDIT-014 | ops-audit | 空・止まっている | データ 0 件の状態と AI が止まっている状態が cover 宣言どおりに出る | PS2 / PS4 | 開く | 空状態と止まっている帯 |  | G18 | T-U-57 | L1 |
| SCR-OPS-AUDIT-015 | ops-audit | 表記ゆらぎ | 全角／半角：メール・数値・コードを全角で入れる | 入力欄がある状態 | 入力して保存 | 同一として扱われ、サーバー側で正規化されて保存される（クライアント側だけに頼らない） |  | human-grade-qa 第11軸 | T-U-57 | L1 |
| SCR-OPS-AUDIT-016 | ops-audit | 表記ゆらぎ | 前後と途中の空白：空白付きで入れる | 入力欄がある状態 | 入力して保存 | 同一として扱われ、サーバー側で正規化されて保存される（クライアント側だけに頼らない） |  | human-grade-qa 第11軸 | T-U-57 | L1 |
| SCR-OPS-AUDIT-017 | ops-audit | 表記ゆらぎ | 記号の種別（ハイフン・長音）：‐ ー − を混ぜる | 入力欄がある状態 | 入力して保存 | 同一として扱われ、サーバー側で正規化されて保存される（クライアント側だけに頼らない） |  | human-grade-qa 第11軸 | T-U-57 | L1 |
| SCR-OPS-AUDIT-018 | ops-audit | 表記ゆらぎ | Unicode 正規化（NFC/NFD）：macOS の入力（NFD）で入れる | 入力欄がある状態 | 入力して保存 | 同一として扱われ、サーバー側で正規化されて保存される（クライアント側だけに頼らない） |  | human-grade-qa 第11軸 | T-U-57 | L1 |
| SCR-OPS-AUDIT-019 | ops-audit | 表記ゆらぎ | 大文字小文字：メールを大文字で入れる | 入力欄がある状態 | 入力して保存 | 同一として扱われ、サーバー側で正規化されて保存される（クライアント側だけに頼らない） |  | human-grade-qa 第11軸 | T-U-57 | L1 |
| SCR-OPS-AUDIT-020 | ops-audit | G-11 外部リソースの実在 | N/A：外部リソースを触らない | migration/IaC 適用後 | 起動時の存在確認を読む | 無ければ起動時に落ちる（黙って 502 にならない） |  | 環境ごと | T-U-57 | L1 |
| SCR-OPS-AUDIT-021 | ops-audit | G-12 切り替わりの瞬間 | Bridge が切れた直後 0 秒・鮮度窓の内側に操作する | 本番稼働中 | PC を閉じた直後に主アクションを押す | 「AI は止まっています」が出て、押した内容は失われない |  |  | T-U-57 | L1 |
| SCR-OPS-AUDIT-022 | ops-audit | G-13 機能の組み合わせ | 実行中 × 切替／中断 × 再開／別ロール同時 の直積のうち該当分 | — | 同時に起こす | 後勝ちでなく、規則どおり（承認は 1 人 1 回・切替は次の実行から） |  | features.json combination_points | T-U-57 | L1 |
| SCR-OPS-AUDIT-023 | ops-audit | G-14 口座状態の波及 | 退会・停止・権限変更・パスワード変更の後に、この機能の既存セッション・接続・共有リンクが無効 | ログイン中の別端末と Bridge | 権限を変える | 別端末と Bridge は 0 秒で 401（sessions が revoked） |  |  | T-U-57 | L1 |
| SCR-OPS-AUDIT-024 | ops-audit | G-15 信号なし終了 | N/A：外部を呼ばない | 外部を故意に切る | 実行する | 成功扱いにせず、502 と次の一手（人へのハンドオフ） |  |  | T-U-57 | L1 |
| SCR-OPS-AUDIT-025 | ops-audit | G-16 有限資源 | 消費する資源：DB 接続（プール経由）・メモリ。1 要求あたり 1 接続以下・上限時は待機列 | 同時 50 要求 | 同時に叩く | ログインが落ちない・接続上限に張り付かない（関門 C2 のプール） |  | L4 で負荷試験 | T-U-57 | L1 |
