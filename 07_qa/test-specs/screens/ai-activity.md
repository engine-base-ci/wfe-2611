# ai-activity テスト仕様（L1・機械生成）

> 05_flow/build_tasks.py がタスクと同時に生成。ID は変えない。途中変更は qa_delta.py で差分。結果列は staging で流した人が書く（再生成しても残る。結果あり 0 行）。

| ID | 画面 | テスト観点 | テスト項目 | 前提条件 | 操作手順 | 期待結果 | 結果 | 備考 | タスク | 実行条件 |
|---|---|---|---|---|---|---|---|---|---|---|
| API-06-001 | ai-activity | API 正常 | GET /api/v1/ai_employees：取得（ai_employees）— AI社員を増やす・人に託す／AI社員1体が何 | 権限のある会員 | 呼ぶ | 200 と { data: AiEmployees[], meta?: { cursor,  |  | A37 A46 A53 A59 A79 | T-A-06 | L1 |
| API-06-002 | ai-activity | API 異常 | GET /api/v1/ai_employees：セッションが無い・失効している（退会・停止・権限変更・パスワード変更で即失効） | — | 条件を作って呼ぶ | 401 UNAUTHENTICATED。副作用なし |  | UNWANTED: IF セッションが無いか失効しているなら、Kaname は  | T-A-06 | L1 |
| API-06-003 | ai-activity | API 異常 | GET /api/v1/ai_employees：権限（誰に×何に×どの層で×できること）が無い、または運営が許可の無い会社を読もうとした | — | 条件を作って呼ぶ | 403 FORBIDDEN。副作用なし |  | UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用 | T-A-06 | L1 |
| API-06-004 | ai-activity | API 異常 | GET /api/v1/ai_employees：120/min/user | — | 条件を作って呼ぶ | 429 RATE_LIMITED。副作用なし |  | UNWANTED: IF 120/min/user を超えたら、Kaname は | T-A-06 | L1 |
| API-06-005 | ai-activity | API 異常 | GET /api/v1/ai_employees：外部サービス・モデル・プロセスが失敗した／合図を出さずに終わった | — | 条件を作って呼ぶ | 502 EXTERNAL_FAILED。副作用なし |  | UNWANTED: IF 外部が失敗したか完了信号が無いなら、Kaname は成 | T-A-06 | L1 |
| API-06-006 | ai-activity | 状態 | GET /api/v1/ai_employees：0 件／大量（1,000）／重複／初回／2 回目 | — | 各状態で呼ぶ | 0 件は空配列、大量はページング、重複は 409、2 回目は冪等 |  |  | T-A-06 | L1 |
| API-06-007 | ai-activity | API 正常 | POST /api/v1/credentials：作成・実行（credentials）— ログイン情報を預ける | 権限のある会員 | 呼ぶ | 201 と { data: Credentials, meta?: { cursor, li |  | A10 | T-A-06 | L1 |
| API-06-008 | ai-activity | API 異常 | POST /api/v1/credentials：セッションが無い・失効している（退会・停止・権限変更・パスワード変更で即失効） | — | 条件を作って呼ぶ | 401 UNAUTHENTICATED。副作用なし |  | UNWANTED: IF セッションが無いか失効しているなら、Kaname は  | T-A-06 | L1 |
| API-06-009 | ai-activity | API 異常 | POST /api/v1/credentials：権限（誰に×何に×どの層で×できること）が無い、または運営が許可の無い会社を読もうとした | — | 条件を作って呼ぶ | 403 FORBIDDEN。副作用なし |  | UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用 | T-A-06 | L1 |
| API-06-010 | ai-activity | API 異常 | POST /api/v1/credentials：二重送信・同時編集・既に登録済み（冪等キーで防ぐ） | — | 条件を作って呼ぶ | 409 CONFLICT。副作用なし |  | UNWANTED: IF 同じ冪等キーで二度来たら、Kaname は最初の結果を | T-A-06 | L1 |
| API-06-011 | ai-activity | API 異常 | POST /api/v1/credentials：必須・形式・値域・表記ゆらぎ（全角半角・空白・記号） | — | 条件を作って呼ぶ | 422 VALIDATION_ERROR。副作用なし |  | UNWANTED: IF 入力が受け付けられないなら、Kaname は 422  | T-A-06 | L1 |
| API-06-012 | ai-activity | 状態 | POST /api/v1/credentials：0 件／大量（1,000）／重複／初回／2 回目 | — | 各状態で呼ぶ | 0 件は空配列、大量はページング、重複は 409、2 回目は冪等 |  |  | T-A-06 | L1 |
| API-06-013 | ai-activity | API 正常 | GET /api/v1/learned_procedures：取得（learned_procedures）— AIが止まった／画面が変わった  | 権限のある会員 | 呼ぶ | 200 と { data: LearnedProcedures[], meta?: { cu |  | A32 | T-A-06 | L1 |
| API-06-014 | ai-activity | API 異常 | GET /api/v1/learned_procedures：セッションが無い・失効している（退会・停止・権限変更・パスワード変更で即失効） | — | 条件を作って呼ぶ | 401 UNAUTHENTICATED。副作用なし |  | UNWANTED: IF セッションが無いか失効しているなら、Kaname は  | T-A-06 | L1 |
| API-06-015 | ai-activity | API 異常 | GET /api/v1/learned_procedures：権限（誰に×何に×どの層で×できること）が無い、または運営が許可の無い会社を読もうとした | — | 条件を作って呼ぶ | 403 FORBIDDEN。副作用なし |  | UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用 | T-A-06 | L1 |
| API-06-016 | ai-activity | API 異常 | GET /api/v1/learned_procedures：120/min/user | — | 条件を作って呼ぶ | 429 RATE_LIMITED。副作用なし |  | UNWANTED: IF 120/min/user を超えたら、Kaname は | T-A-06 | L1 |
| API-06-017 | ai-activity | API 異常 | GET /api/v1/learned_procedures：外部サービス・モデル・プロセスが失敗した／合図を出さずに終わった | — | 条件を作って呼ぶ | 502 EXTERNAL_FAILED。副作用なし |  | UNWANTED: IF 外部が失敗したか完了信号が無いなら、Kaname は成 | T-A-06 | L1 |
| API-06-018 | ai-activity | 状態 | GET /api/v1/learned_procedures：0 件／大量（1,000）／重複／初回／2 回目 | — | 各状態で呼ぶ | 0 件は空配列、大量はページング、重複は 409、2 回目は冪等 |  |  | T-A-06 | L1 |
| API-06-019 | ai-activity | API 正常 | POST /api/v1/sessions：作成・実行（sessions）— 自分のPCをつなぐ（Bridge）── これが | 権限のある会員 | 呼ぶ | 201 と { data: Sessions, meta?: { cursor, limit |  | A09 | T-A-06 | L1 |
| API-06-020 | ai-activity | API 異常 | POST /api/v1/sessions：セッションが無い・失効している（退会・停止・権限変更・パスワード変更で即失効） | — | 条件を作って呼ぶ | 401 UNAUTHENTICATED。副作用なし |  | UNWANTED: IF セッションが無いか失効しているなら、Kaname は  | T-A-06 | L1 |
| API-06-021 | ai-activity | API 異常 | POST /api/v1/sessions：権限（誰に×何に×どの層で×できること）が無い、または運営が許可の無い会社を読もうとした | — | 条件を作って呼ぶ | 403 FORBIDDEN。副作用なし |  | UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用 | T-A-06 | L1 |
| API-06-022 | ai-activity | API 異常 | POST /api/v1/sessions：二重送信・同時編集・既に登録済み（冪等キーで防ぐ） | — | 条件を作って呼ぶ | 409 CONFLICT。副作用なし |  | UNWANTED: IF 同じ冪等キーで二度来たら、Kaname は最初の結果を | T-A-06 | L1 |
| API-06-023 | ai-activity | API 異常 | POST /api/v1/sessions：必須・形式・値域・表記ゆらぎ（全角半角・空白・記号） | — | 条件を作って呼ぶ | 422 VALIDATION_ERROR。副作用なし |  | UNWANTED: IF 入力が受け付けられないなら、Kaname は 422  | T-A-06 | L1 |
| API-06-024 | ai-activity | 状態 | POST /api/v1/sessions：0 件／大量（1,000）／重複／初回／2 回目 | — | 各状態で呼ぶ | 0 件は空配列、大量はページング、重複は 409、2 回目は冪等 |  |  | T-A-06 | L1 |
| API-06-025 | ai-activity | API 正常 | GET /api/v1/tenants：取得（tenants）— 自分のAIが作ったたたき台（目標・台帳・AI社員）を見 | 権限のある会員 | 呼ぶ | 200 と { data: Tenants[], meta?: { cursor, limi |  | A07 A08 A12 A45 | T-A-06 | L1 |
| API-06-026 | ai-activity | API 異常 | GET /api/v1/tenants：セッションが無い・失効している（退会・停止・権限変更・パスワード変更で即失効） | — | 条件を作って呼ぶ | 401 UNAUTHENTICATED。副作用なし |  | UNWANTED: IF セッションが無いか失効しているなら、Kaname は  | T-A-06 | L1 |
| API-06-027 | ai-activity | API 異常 | GET /api/v1/tenants：権限（誰に×何に×どの層で×できること）が無い、または運営が許可の無い会社を読もうとした | — | 条件を作って呼ぶ | 403 FORBIDDEN。副作用なし |  | UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用 | T-A-06 | L1 |
| API-06-028 | ai-activity | API 異常 | GET /api/v1/tenants：120/min/user | — | 条件を作って呼ぶ | 429 RATE_LIMITED。副作用なし |  | UNWANTED: IF 120/min/user を超えたら、Kaname は | T-A-06 | L1 |
| API-06-029 | ai-activity | API 異常 | GET /api/v1/tenants：外部サービス・モデル・プロセスが失敗した／合図を出さずに終わった | — | 条件を作って呼ぶ | 502 EXTERNAL_FAILED。副作用なし |  | UNWANTED: IF 外部が失敗したか完了信号が無いなら、Kaname は成 | T-A-06 | L1 |
| API-06-030 | ai-activity | 状態 | GET /api/v1/tenants：0 件／大量（1,000）／重複／初回／2 回目 | — | 各状態で呼ぶ | 0 件は空配列、大量はページング、重複は 409、2 回目は冪等 |  |  | T-A-06 | L1 |
| API-06-031 | ai-activity | G-11 外部リソースの実在 | 触る外部リソースが staging と production に存在する | migration/IaC 適用後 | 起動時の存在確認を読む | 無ければ起動時に落ちる（黙って 502 にならない） |  | 環境ごと | T-A-06 | L1 |
| API-06-032 | ai-activity | G-12 切り替わりの瞬間 | Bridge が切れた直後 0 秒・鮮度窓の内側に操作する | 本番稼働中 | PC を閉じた直後に主アクションを押す | 「AI は止まっています」が出て、押した内容は失われない |  |  | T-A-06 | L1 |
| API-06-033 | ai-activity | G-13 機能の組み合わせ | 実行中 × 切替／中断 × 再開／別ロール同時 の直積のうち該当分 | — | 同時に起こす | 後勝ちでなく、規則どおり（承認は 1 人 1 回・切替は次の実行から） |  | features.json combination_points | T-A-06 | L1 |
| API-06-034 | ai-activity | G-14 口座状態の波及 | 退会・停止・権限変更・パスワード変更の後に、この機能の既存セッション・接続・共有リンクが無効 | ログイン中の別端末と Bridge | 権限を変える | 別端末と Bridge は 0 秒で 401（sessions が revoked） |  |  | T-A-06 | L1 |
| API-06-035 | ai-activity | G-15 信号なし終了 | 外部・モデル・プロセスが完了信号を出さずに終わる／空を返す | 外部を故意に切る | 実行する | 成功扱いにせず、502 と次の一手（人へのハンドオフ） |  |  | T-A-06 | L1 |
| API-06-036 | ai-activity | G-16 有限資源 | 消費する資源：DB 接続（プール経由）・メモリ。1 要求あたり 1 接続以下・上限時は待機列 | 同時 50 要求 | 同時に叩く | ログインが落ちない・接続上限に張り付かない（関門 C2 のプール） |  | L4 で負荷試験 | T-A-06 | L1 |
| API-07-001 | ai-activity | API 正常 | GET /api/v1/action_runs：取得（action_runs）— AI社員をテストで動かして結果を見る | 権限のある会員 | 呼ぶ | 200 と { data: ActionRuns[], meta?: { cursor, l |  | A11 | T-A-07 | L1 |
| API-07-002 | ai-activity | API 異常 | GET /api/v1/action_runs：セッションが無い・失効している（退会・停止・権限変更・パスワード変更で即失効） | — | 条件を作って呼ぶ | 401 UNAUTHENTICATED。副作用なし |  | UNWANTED: IF セッションが無いか失効しているなら、Kaname は  | T-A-07 | L1 |
| API-07-003 | ai-activity | API 異常 | GET /api/v1/action_runs：権限（誰に×何に×どの層で×できること）が無い、または運営が許可の無い会社を読もうとした | — | 条件を作って呼ぶ | 403 FORBIDDEN。副作用なし |  | UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用 | T-A-07 | L1 |
| API-07-004 | ai-activity | API 異常 | GET /api/v1/action_runs：120/min/user | — | 条件を作って呼ぶ | 429 RATE_LIMITED。副作用なし |  | UNWANTED: IF 120/min/user を超えたら、Kaname は | T-A-07 | L1 |
| API-07-005 | ai-activity | API 異常 | GET /api/v1/action_runs：外部サービス・モデル・プロセスが失敗した／合図を出さずに終わった | — | 条件を作って呼ぶ | 502 EXTERNAL_FAILED。副作用なし |  | UNWANTED: IF 外部が失敗したか完了信号が無いなら、Kaname は成 | T-A-07 | L1 |
| API-07-006 | ai-activity | 状態 | GET /api/v1/action_runs：0 件／大量（1,000）／重複／初回／2 回目 | — | 各状態で呼ぶ | 0 件は空配列、大量はページング、重複は 409、2 回目は冪等 |  |  | T-A-07 | L1 |
| API-07-007 | ai-activity | API 正常 | GET /api/v1/ai_employees：取得（ai_employees）— AI社員を増やす・人に託す／AI社員1体が何 | 権限のある会員 | 呼ぶ | 200 と { data: AiEmployees[], meta?: { cursor,  |  | A37 A46 A53 A59 A79 | T-A-07 | L1 |
| API-07-008 | ai-activity | API 異常 | GET /api/v1/ai_employees：セッションが無い・失効している（退会・停止・権限変更・パスワード変更で即失効） | — | 条件を作って呼ぶ | 401 UNAUTHENTICATED。副作用なし |  | UNWANTED: IF セッションが無いか失効しているなら、Kaname は  | T-A-07 | L1 |
| API-07-009 | ai-activity | API 異常 | GET /api/v1/ai_employees：権限（誰に×何に×どの層で×できること）が無い、または運営が許可の無い会社を読もうとした | — | 条件を作って呼ぶ | 403 FORBIDDEN。副作用なし |  | UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用 | T-A-07 | L1 |
| API-07-010 | ai-activity | API 異常 | GET /api/v1/ai_employees：120/min/user | — | 条件を作って呼ぶ | 429 RATE_LIMITED。副作用なし |  | UNWANTED: IF 120/min/user を超えたら、Kaname は | T-A-07 | L1 |
| API-07-011 | ai-activity | API 異常 | GET /api/v1/ai_employees：外部サービス・モデル・プロセスが失敗した／合図を出さずに終わった | — | 条件を作って呼ぶ | 502 EXTERNAL_FAILED。副作用なし |  | UNWANTED: IF 外部が失敗したか完了信号が無いなら、Kaname は成 | T-A-07 | L1 |
| API-07-012 | ai-activity | 状態 | GET /api/v1/ai_employees：0 件／大量（1,000）／重複／初回／2 回目 | — | 各状態で呼ぶ | 0 件は空配列、大量はページング、重複は 409、2 回目は冪等 |  |  | T-A-07 | L1 |
| API-07-013 | ai-activity | API 正常 | GET /api/v1/approvals：取得（approvals）— 自分のAIが差し戻したやりとりを見る | 権限のある会員 | 呼ぶ | 200 と { data: Approvals[], meta?: { cursor, li |  | A16 | T-A-07 | L1 |
| API-07-014 | ai-activity | API 異常 | GET /api/v1/approvals：セッションが無い・失効している（退会・停止・権限変更・パスワード変更で即失効） | — | 条件を作って呼ぶ | 401 UNAUTHENTICATED。副作用なし |  | UNWANTED: IF セッションが無いか失効しているなら、Kaname は  | T-A-07 | L1 |
| API-07-015 | ai-activity | API 異常 | GET /api/v1/approvals：権限（誰に×何に×どの層で×できること）が無い、または運営が許可の無い会社を読もうとした | — | 条件を作って呼ぶ | 403 FORBIDDEN。副作用なし |  | UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用 | T-A-07 | L1 |
| API-07-016 | ai-activity | API 異常 | GET /api/v1/approvals：120/min/user | — | 条件を作って呼ぶ | 429 RATE_LIMITED。副作用なし |  | UNWANTED: IF 120/min/user を超えたら、Kaname は | T-A-07 | L1 |
| API-07-017 | ai-activity | API 異常 | GET /api/v1/approvals：外部サービス・モデル・プロセスが失敗した／合図を出さずに終わった | — | 条件を作って呼ぶ | 502 EXTERNAL_FAILED。副作用なし |  | UNWANTED: IF 外部が失敗したか完了信号が無いなら、Kaname は成 | T-A-07 | L1 |
| API-07-018 | ai-activity | 状態 | GET /api/v1/approvals：0 件／大量（1,000）／重複／初回／2 回目 | — | 各状態で呼ぶ | 0 件は空配列、大量はページング、重複は 409、2 回目は冪等 |  |  | T-A-07 | L1 |
| API-07-019 | ai-activity | API 正常 | PATCH /api/v1/approvals/:id：更新（approvals）— 自分のAIが上げてきたものを承認する／止める | 権限のある会員 | 呼ぶ | 200 と { data: Approvals, meta?: { cursor, limi |  | A15 | T-A-07 | L1 |
| API-07-020 | ai-activity | API 異常 | PATCH /api/v1/approvals/:id：セッションが無い・失効している（退会・停止・権限変更・パスワード変更で即失効） | — | 条件を作って呼ぶ | 401 UNAUTHENTICATED。副作用なし |  | UNWANTED: IF セッションが無いか失効しているなら、Kaname は  | T-A-07 | L1 |
| API-07-021 | ai-activity | API 異常 | PATCH /api/v1/approvals/:id：権限（誰に×何に×どの層で×できること）が無い、または運営が許可の無い会社を読もうとした | — | 条件を作って呼ぶ | 403 FORBIDDEN。副作用なし |  | UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用 | T-A-07 | L1 |
| API-07-022 | ai-activity | API 異常 | PATCH /api/v1/approvals/:id：無い・消えた・取り消された（期限切れ・削除済み・他社の行） | — | 条件を作って呼ぶ | 404 NOT_FOUND。副作用なし |  | UNWANTED: IF 対象が無いか他社の行なら、Kaname は 404 を | T-A-07 | L1 |
| API-07-023 | ai-activity | API 異常 | PATCH /api/v1/approvals/:id：必須・形式・値域・表記ゆらぎ（全角半角・空白・記号） | — | 条件を作って呼ぶ | 422 VALIDATION_ERROR。副作用なし |  | UNWANTED: IF 入力が受け付けられないなら、Kaname は 422  | T-A-07 | L1 |
| API-07-024 | ai-activity | 状態 | PATCH /api/v1/approvals/:id：0 件／大量（1,000）／重複／初回／2 回目 | — | 各状態で呼ぶ | 0 件は空配列、大量はページング、重複は 409、2 回目は冪等 |  |  | T-A-07 | L1 |
| API-07-025 | ai-activity | API 正常 | DELETE /api/v1/approvals/:id：削除（approvals）— やってしまったことを取り消す／運営にサポートアクセ | 権限のある会員 | 呼ぶ | 200 と { data: Approvals, meta?: { cursor, limi |  | A34 A66 | T-A-07 | L1 |
| API-07-026 | ai-activity | API 異常 | DELETE /api/v1/approvals/:id：セッションが無い・失効している（退会・停止・権限変更・パスワード変更で即失効） | — | 条件を作って呼ぶ | 401 UNAUTHENTICATED。副作用なし |  | UNWANTED: IF セッションが無いか失効しているなら、Kaname は  | T-A-07 | L1 |
| API-07-027 | ai-activity | API 異常 | DELETE /api/v1/approvals/:id：権限（誰に×何に×どの層で×できること）が無い、または運営が許可の無い会社を読もうとした | — | 条件を作って呼ぶ | 403 FORBIDDEN。副作用なし |  | UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用 | T-A-07 | L1 |
| API-07-028 | ai-activity | API 異常 | DELETE /api/v1/approvals/:id：無い・消えた・取り消された（期限切れ・削除済み・他社の行） | — | 条件を作って呼ぶ | 404 NOT_FOUND。副作用なし |  | UNWANTED: IF 対象が無いか他社の行なら、Kaname は 404 を | T-A-07 | L1 |
| API-07-029 | ai-activity | API 異常 | DELETE /api/v1/approvals/:id：60/min/user | — | 条件を作って呼ぶ | 429 RATE_LIMITED。副作用なし |  | UNWANTED: IF 60/min/user を超えたら、Kaname は  | T-A-07 | L1 |
| API-07-030 | ai-activity | 状態 | DELETE /api/v1/approvals/:id：0 件／大量（1,000）／重複／初回／2 回目 | — | 各状態で呼ぶ | 0 件は空配列、大量はページング、重複は 409、2 回目は冪等 |  |  | T-A-07 | L1 |
| API-07-031 | ai-activity | API 正常 | GET /api/v1/audit_events：取得（audit_events）— 想定外が起きた → 何をしたか追う／誰が何を | 権限のある会員 | 呼ぶ | 200 と { data: AuditEvents[], meta?: { cursor,  |  | A33 A38 A73 | T-A-07 | L1 |
| API-07-032 | ai-activity | API 異常 | GET /api/v1/audit_events：セッションが無い・失効している（退会・停止・権限変更・パスワード変更で即失効） | — | 条件を作って呼ぶ | 401 UNAUTHENTICATED。副作用なし |  | UNWANTED: IF セッションが無いか失効しているなら、Kaname は  | T-A-07 | L1 |
| API-07-033 | ai-activity | API 異常 | GET /api/v1/audit_events：権限（誰に×何に×どの層で×できること）が無い、または運営が許可の無い会社を読もうとした | — | 条件を作って呼ぶ | 403 FORBIDDEN。副作用なし |  | UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用 | T-A-07 | L1 |
| API-07-034 | ai-activity | API 異常 | GET /api/v1/audit_events：120/min/user | — | 条件を作って呼ぶ | 429 RATE_LIMITED。副作用なし |  | UNWANTED: IF 120/min/user を超えたら、Kaname は | T-A-07 | L1 |
| API-07-035 | ai-activity | 状態 | GET /api/v1/audit_events：0 件／大量（1,000）／重複／初回／2 回目 | — | 各状態で呼ぶ | 0 件は空配列、大量はページング、重複は 409、2 回目は冪等 |  |  | T-A-07 | L1 |
| API-07-036 | ai-activity | G-11 外部リソースの実在 | 触る外部リソースが staging と production に存在する | migration/IaC 適用後 | 起動時の存在確認を読む | 無ければ起動時に落ちる（黙って 502 にならない） |  | 環境ごと | T-A-07 | L1 |
| API-07-037 | ai-activity | G-12 切り替わりの瞬間 | Bridge が切れた直後 0 秒・鮮度窓の内側に操作する | 本番稼働中 | PC を閉じた直後に主アクションを押す | 「AI は止まっています」が出て、押した内容は失われない |  |  | T-A-07 | L1 |
| API-07-038 | ai-activity | G-13 機能の組み合わせ | 実行中 × 切替／中断 × 再開／別ロール同時 の直積のうち該当分 | — | 同時に起こす | 後勝ちでなく、規則どおり（承認は 1 人 1 回・切替は次の実行から） |  | features.json combination_points | T-A-07 | L1 |
| API-07-039 | ai-activity | G-14 口座状態の波及 | 退会・停止・権限変更・パスワード変更の後に、この機能の既存セッション・接続・共有リンクが無効 | ログイン中の別端末と Bridge | 権限を変える | 別端末と Bridge は 0 秒で 401（sessions が revoked） |  |  | T-A-07 | L1 |
| API-07-040 | ai-activity | G-15 信号なし終了 | 外部・モデル・プロセスが完了信号を出さずに終わる／空を返す | 外部を故意に切る | 実行する | 成功扱いにせず、502 と次の一手（人へのハンドオフ） |  |  | T-A-07 | L1 |
| API-07-041 | ai-activity | G-16 有限資源 | 消費する資源：DB 接続（プール経由）・外部 API レート。1 要求あたり 1 接続以下・上限時は待機列 | 同時 50 要求 | 同時に叩く | ログインが落ちない・接続上限に張り付かない（関門 C2 のプール） |  | L4 で負荷試験 | T-A-07 | L1 |
| API-21-001 | ai-activity | API 正常 | GET /api/v1/ai_employees：取得（ai_employees）— AI社員を増やす・人に託す／AI社員1体が何 | 権限のある会員 | 呼ぶ | 200 と { data: AiEmployees[], meta?: { cursor,  |  | A37 A46 A53 A59 A79 | T-A-21 | L1 |
| API-21-002 | ai-activity | API 異常 | GET /api/v1/ai_employees：セッションが無い・失効している（退会・停止・権限変更・パスワード変更で即失効） | — | 条件を作って呼ぶ | 401 UNAUTHENTICATED。副作用なし |  | UNWANTED: IF セッションが無いか失効しているなら、Kaname は  | T-A-21 | L1 |
| API-21-003 | ai-activity | API 異常 | GET /api/v1/ai_employees：権限（誰に×何に×どの層で×できること）が無い、または運営が許可の無い会社を読もうとした | — | 条件を作って呼ぶ | 403 FORBIDDEN。副作用なし |  | UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用 | T-A-21 | L1 |
| API-21-004 | ai-activity | API 異常 | GET /api/v1/ai_employees：120/min/user | — | 条件を作って呼ぶ | 429 RATE_LIMITED。副作用なし |  | UNWANTED: IF 120/min/user を超えたら、Kaname は | T-A-21 | L1 |
| API-21-005 | ai-activity | API 異常 | GET /api/v1/ai_employees：外部サービス・モデル・プロセスが失敗した／合図を出さずに終わった | — | 条件を作って呼ぶ | 502 EXTERNAL_FAILED。副作用なし |  | UNWANTED: IF 外部が失敗したか完了信号が無いなら、Kaname は成 | T-A-21 | L1 |
| API-21-006 | ai-activity | 状態 | GET /api/v1/ai_employees：0 件／大量（1,000）／重複／初回／2 回目 | — | 各状態で呼ぶ | 0 件は空配列、大量はページング、重複は 409、2 回目は冪等 |  |  | T-A-21 | L1 |
| API-21-007 | ai-activity | API 正常 | PATCH /api/v1/service_registry_versions/:id：更新（service_registry_versions）— サービス台帳（外部 | 権限のある会員 | 呼ぶ | 200 と { data: ServiceRegistryVersions, meta?:  |  | A78 | T-A-21 | L1 |
| API-21-008 | ai-activity | API 異常 | PATCH /api/v1/service_registry_versions/:id：セッションが無い・失効している（退会・停止・権限変更・パスワード変更で即失効） | — | 条件を作って呼ぶ | 401 UNAUTHENTICATED。副作用なし |  | UNWANTED: IF セッションが無いか失効しているなら、Kaname は  | T-A-21 | L1 |
| API-21-009 | ai-activity | API 異常 | PATCH /api/v1/service_registry_versions/:id：権限（誰に×何に×どの層で×できること）が無い、または運営が許可の無い会社を読もうとした | — | 条件を作って呼ぶ | 403 FORBIDDEN。副作用なし |  | UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用 | T-A-21 | L1 |
| API-21-010 | ai-activity | API 異常 | PATCH /api/v1/service_registry_versions/:id：無い・消えた・取り消された（期限切れ・削除済み・他社の行） | — | 条件を作って呼ぶ | 404 NOT_FOUND。副作用なし |  | UNWANTED: IF 対象が無いか他社の行なら、Kaname は 404 を | T-A-21 | L1 |
| API-21-011 | ai-activity | API 異常 | PATCH /api/v1/service_registry_versions/:id：必須・形式・値域・表記ゆらぎ（全角半角・空白・記号） | — | 条件を作って呼ぶ | 422 VALIDATION_ERROR。副作用なし |  | UNWANTED: IF 入力が受け付けられないなら、Kaname は 422  | T-A-21 | L1 |
| API-21-012 | ai-activity | 状態 | PATCH /api/v1/service_registry_versions/:id：0 件／大量（1,000）／重複／初回／2 回目 | — | 各状態で呼ぶ | 0 件は空配列、大量はページング、重複は 409、2 回目は冪等 |  |  | T-A-21 | L1 |
| API-21-013 | ai-activity | API 正常 | POST /api/v1/skills：作成・実行（skills）— スキルを構築・アップロード・テストして版を出し、プ | 権限のある会員 | 呼ぶ | 201 と { data: Skills, meta?: { cursor, limit,  |  | A80 | T-A-21 | L1 |
| API-21-014 | ai-activity | API 異常 | POST /api/v1/skills：セッションが無い・失効している（退会・停止・権限変更・パスワード変更で即失効） | — | 条件を作って呼ぶ | 401 UNAUTHENTICATED。副作用なし |  | UNWANTED: IF セッションが無いか失効しているなら、Kaname は  | T-A-21 | L1 |
| API-21-015 | ai-activity | API 異常 | POST /api/v1/skills：権限（誰に×何に×どの層で×できること）が無い、または運営が許可の無い会社を読もうとした | — | 条件を作って呼ぶ | 403 FORBIDDEN。副作用なし |  | UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用 | T-A-21 | L1 |
| API-21-016 | ai-activity | API 異常 | POST /api/v1/skills：二重送信・同時編集・既に登録済み（冪等キーで防ぐ） | — | 条件を作って呼ぶ | 409 CONFLICT。副作用なし |  | UNWANTED: IF 同じ冪等キーで二度来たら、Kaname は最初の結果を | T-A-21 | L1 |
| API-21-017 | ai-activity | API 異常 | POST /api/v1/skills：必須・形式・値域・表記ゆらぎ（全角半角・空白・記号） | — | 条件を作って呼ぶ | 422 VALIDATION_ERROR。副作用なし |  | UNWANTED: IF 入力が受け付けられないなら、Kaname は 422  | T-A-21 | L1 |
| API-21-018 | ai-activity | 状態 | POST /api/v1/skills：0 件／大量（1,000）／重複／初回／2 回目 | — | 各状態で呼ぶ | 0 件は空配列、大量はページング、重複は 409、2 回目は冪等 |  |  | T-A-21 | L1 |
| API-21-019 | ai-activity | G-11 外部リソースの実在 | 触る外部リソースが staging と production に存在する | migration/IaC 適用後 | 起動時の存在確認を読む | 無ければ起動時に落ちる（黙って 502 にならない） |  | 環境ごと | T-A-21 | L1 |
| API-21-020 | ai-activity | G-12 切り替わりの瞬間 | N/A：状態の切替を持たない | 本番稼働中 | PC を閉じた直後に主アクションを押す | 「AI は止まっています」が出て、押した内容は失われない |  |  | T-A-21 | L1 |
| API-21-021 | ai-activity | G-13 機能の組み合わせ | 実行中 × 切替／中断 × 再開／別ロール同時 の直積のうち該当分 | — | 同時に起こす | 後勝ちでなく、規則どおり（承認は 1 人 1 回・切替は次の実行から） |  | features.json combination_points | T-A-21 | L1 |
| API-21-022 | ai-activity | G-14 口座状態の波及 | 退会・停止・権限変更・パスワード変更の後に、この機能の既存セッション・接続・共有リンクが無効 | ログイン中の別端末と Bridge | 権限を変える | 別端末と Bridge は 0 秒で 401（sessions が revoked） |  |  | T-A-21 | L1 |
| API-21-023 | ai-activity | G-15 信号なし終了 | N/A：外部を呼ばない | 外部を故意に切る | 実行する | 成功扱いにせず、502 と次の一手（人へのハンドオフ） |  |  | T-A-21 | L1 |
| API-21-024 | ai-activity | G-16 有限資源 | 消費する資源：DB 接続（プール経由）・メモリ。1 要求あたり 1 接続以下・上限時は待機列 | 同時 50 要求 | 同時に叩く | ログインが落ちない・接続上限に張り付かない（関門 C2 のプール） |  | L4 で負荷試験 | T-A-21 | L1 |
| API-23-001 | ai-activity | API 正常 | GET /api/v1/ai_employees：取得（ai_employees）— AI社員を増やす・人に託す／AI社員1体が何 | 権限のある会員 | 呼ぶ | 200 と { data: AiEmployees[], meta?: { cursor,  |  | A37 A46 A53 A59 A79 | T-A-23 | L1 |
| API-23-002 | ai-activity | API 異常 | GET /api/v1/ai_employees：セッションが無い・失効している（退会・停止・権限変更・パスワード変更で即失効） | — | 条件を作って呼ぶ | 401 UNAUTHENTICATED。副作用なし |  | UNWANTED: IF セッションが無いか失効しているなら、Kaname は  | T-A-23 | L1 |
| API-23-003 | ai-activity | API 異常 | GET /api/v1/ai_employees：権限（誰に×何に×どの層で×できること）が無い、または運営が許可の無い会社を読もうとした | — | 条件を作って呼ぶ | 403 FORBIDDEN。副作用なし |  | UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用 | T-A-23 | L1 |
| API-23-004 | ai-activity | API 異常 | GET /api/v1/ai_employees：120/min/user | — | 条件を作って呼ぶ | 429 RATE_LIMITED。副作用なし |  | UNWANTED: IF 120/min/user を超えたら、Kaname は | T-A-23 | L1 |
| API-23-005 | ai-activity | API 異常 | GET /api/v1/ai_employees：外部サービス・モデル・プロセスが失敗した／合図を出さずに終わった | — | 条件を作って呼ぶ | 502 EXTERNAL_FAILED。副作用なし |  | UNWANTED: IF 外部が失敗したか完了信号が無いなら、Kaname は成 | T-A-23 | L1 |
| API-23-006 | ai-activity | 状態 | GET /api/v1/ai_employees：0 件／大量（1,000）／重複／初回／2 回目 | — | 各状態で呼ぶ | 0 件は空配列、大量はページング、重複は 409、2 回目は冪等 |  |  | T-A-23 | L1 |
| API-23-007 | ai-activity | API 正常 | GET /api/v1/plans：取得（plans）— 各社の様子（プラン・AI社員の体数・稼働・詰まり）を見る | 権限のある会員 | 呼ぶ | 200 と { data: Plans[], meta?: { cursor, limit, |  | A60 | T-A-23 | L1 |
| API-23-008 | ai-activity | API 異常 | GET /api/v1/plans：セッションが無い・失効している（退会・停止・権限変更・パスワード変更で即失効） | — | 条件を作って呼ぶ | 401 UNAUTHENTICATED。副作用なし |  | UNWANTED: IF セッションが無いか失効しているなら、Kaname は  | T-A-23 | L1 |
| API-23-009 | ai-activity | API 異常 | GET /api/v1/plans：権限（誰に×何に×どの層で×できること）が無い、または運営が許可の無い会社を読もうとした | — | 条件を作って呼ぶ | 403 FORBIDDEN。副作用なし |  | UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用 | T-A-23 | L1 |
| API-23-010 | ai-activity | API 異常 | GET /api/v1/plans：120/min/user | — | 条件を作って呼ぶ | 429 RATE_LIMITED。副作用なし |  | UNWANTED: IF 120/min/user を超えたら、Kaname は | T-A-23 | L1 |
| API-23-011 | ai-activity | 状態 | GET /api/v1/plans：0 件／大量（1,000）／重複／初回／2 回目 | — | 各状態で呼ぶ | 0 件は空配列、大量はページング、重複は 409、2 回目は冪等 |  |  | T-A-23 | L1 |
| API-23-012 | ai-activity | G-11 外部リソースの実在 | N/A：外部リソースを触らない | migration/IaC 適用後 | 起動時の存在確認を読む | 無ければ起動時に落ちる（黙って 502 にならない） |  | 環境ごと | T-A-23 | L1 |
| API-23-013 | ai-activity | G-12 切り替わりの瞬間 | N/A：状態の切替を持たない | 本番稼働中 | PC を閉じた直後に主アクションを押す | 「AI は止まっています」が出て、押した内容は失われない |  |  | T-A-23 | L1 |
| API-23-014 | ai-activity | G-13 機能の組み合わせ | 実行中 × 切替／中断 × 再開／別ロール同時 の直積のうち該当分 | — | 同時に起こす | 後勝ちでなく、規則どおり（承認は 1 人 1 回・切替は次の実行から） |  | features.json combination_points | T-A-23 | L1 |
| API-23-015 | ai-activity | G-14 口座状態の波及 | 退会・停止・権限変更・パスワード変更の後に、この機能の既存セッション・接続・共有リンクが無効 | ログイン中の別端末と Bridge | 権限を変える | 別端末と Bridge は 0 秒で 401（sessions が revoked） |  |  | T-A-23 | L1 |
| API-23-016 | ai-activity | G-15 信号なし終了 | N/A：外部を呼ばない | 外部を故意に切る | 実行する | 成功扱いにせず、502 と次の一手（人へのハンドオフ） |  |  | T-A-23 | L1 |
| API-23-017 | ai-activity | G-16 有限資源 | 消費する資源：DB 接続（プール経由）・メモリ。1 要求あたり 1 接続以下・上限時は待機列 | 同時 50 要求 | 同時に叩く | ログインが落ちない・接続上限に張り付かない（関門 C2 のプール） |  | L4 で負荷試験 | T-A-23 | L1 |
| SCR-AI-ACTIVITY-001 | ai-activity | 状態 | 状態「今日の動き」がモックどおりに出る（h1・第2ナビ・列の値がダミー固定でない） | その状態を作る | 画面を開く | モック 06_mockup/v1/v1-ai-activity.html の状態 n と一致 |  | G-06・G-07 | T-U-18 | L1 |
| SCR-AI-ACTIVITY-002 | ai-activity | 状態 | 状態「1本の流れ」がモックどおりに出る（h1・第2ナビ・列の値がダミー固定でない） | その状態を作る | 画面を開く | モック 06_mockup/v1/v1-ai-activity.html の状態 one と一致 |  | G-06・G-07 | T-U-18 | L1 |
| SCR-AI-ACTIVITY-003 | ai-activity | 状態 | 状態「空」がモックどおりに出る（h1・第2ナビ・列の値がダミー固定でない） | その状態を作る | 画面を開く | モック 06_mockup/v1/v1-ai-activity.html の状態 ge と一致 |  | G-06・G-07 | T-U-18 | L1 |
| SCR-AI-ACTIVITY-004 | ai-activity | 状態 | 状態「AI が止まっている」がモックどおりに出る（h1・第2ナビ・列の値がダミー固定でない） | その状態を作る | 画面を開く | モック 06_mockup/v1/v1-ai-activity.html の状態 gs と一致 |  | G-06・G-07 | T-U-18 | L1 |
| SCR-AI-ACTIVITY-005 | ai-activity | 役割 | 役割 R1 で開くと、その役割の中身（data-roles）が出て、他の役割の中身は出ない | R1 でログイン | 画面を開く | 役割ごとの中身（G15） |  |  | T-U-18 | L1 |
| SCR-AI-ACTIVITY-006 | ai-activity | 役割 | 役割 R2 で開くと、その役割の中身（data-roles）が出て、他の役割の中身は出ない | R2 でログイン | 画面を開く | 役割ごとの中身（G15） |  |  | T-U-18 | L1 |
| SCR-AI-ACTIVITY-007 | ai-activity | 役割 | 役割 R3 で開くと、その役割の中身（data-roles）が出て、他の役割の中身は出ない | R3 でログイン | 画面を開く | 役割ごとの中身（G15） |  |  | T-U-18 | L1 |
| SCR-AI-ACTIVITY-008 | ai-activity | 主アクション | 「止まっているところへ」を押すと対応する endpoint が呼ばれ、別 GET で再取得した画面に反映される | 権限のある会員 | 押す | DB と画面が変わる（G-01・G-03） |  | GET /api/ai_employees | T-U-18 | L1 |
| SCR-AI-ACTIVITY-009 | ai-activity | 到達性 | リンク先 account が実在ルートで 200 で開く | — | 押す | /account が開く（G-04） |  |  | T-U-18 | L1 |
| SCR-AI-ACTIVITY-010 | ai-activity | 到達性 | リンク先 account-close が実在ルートで 200 で開く | — | 押す | /account-close が開く（G-04） |  |  | T-U-18 | L1 |
| SCR-AI-ACTIVITY-011 | ai-activity | 到達性 | リンク先 ai-staff が実在ルートで 200 で開く | — | 押す | /ai-staff が開く（G-04） |  |  | T-U-18 | L1 |
| SCR-AI-ACTIVITY-012 | ai-activity | 到達性 | リンク先 approvals が実在ルートで 200 で開く | — | 押す | /approvals が開く（G-04） |  |  | T-U-18 | L1 |
| SCR-AI-ACTIVITY-013 | ai-activity | 到達性 | リンク先 audit が実在ルートで 200 で開く | — | 押す | /audit が開く（G-04） |  |  | T-U-18 | L1 |
| SCR-AI-ACTIVITY-014 | ai-activity | 到達性 | リンク先 automation-repair が実在ルートで 200 で開く | — | 押す | /automation-repair が開く（G-04） |  |  | T-U-18 | L1 |
| SCR-AI-ACTIVITY-015 | ai-activity | 到達性 | リンク先 billing が実在ルートで 200 で開く | — | 押す | /billing が開く（G-04） |  |  | T-U-18 | L1 |
| SCR-AI-ACTIVITY-016 | ai-activity | 到達性 | リンク先 bridge-setup が実在ルートで 200 で開く | — | 押す | /bridge-setup が開く（G-04） |  |  | T-U-18 | L1 |
| SCR-AI-ACTIVITY-017 | ai-activity | 横溢れ | 375・768・1024・1440 で scrollWidth - clientWidth <= 1、1180+ で本文 720 以上 | — | 各幅で開く | 溢れ 0 |  | G-05 | T-U-18 | L1 |
| SCR-AI-ACTIVITY-018 | ai-activity | 空・止まっている | データ 0 件の状態と AI が止まっている状態が cover 宣言どおりに出る | PS2 / PS4 | 開く | 空状態と止まっている帯 |  | G18 | T-U-18 | L1 |
| SCR-AI-ACTIVITY-019 | ai-activity | 表記ゆらぎ | 全角／半角：メール・数値・コードを全角で入れる | 入力欄がある状態 | 入力して保存 | 同一として扱われ、サーバー側で正規化されて保存される（クライアント側だけに頼らない） |  | human-grade-qa 第11軸 | T-U-18 | L1 |
| SCR-AI-ACTIVITY-020 | ai-activity | 表記ゆらぎ | 前後と途中の空白：空白付きで入れる | 入力欄がある状態 | 入力して保存 | 同一として扱われ、サーバー側で正規化されて保存される（クライアント側だけに頼らない） |  | human-grade-qa 第11軸 | T-U-18 | L1 |
| SCR-AI-ACTIVITY-021 | ai-activity | 表記ゆらぎ | 記号の種別（ハイフン・長音）：‐ ー − を混ぜる | 入力欄がある状態 | 入力して保存 | 同一として扱われ、サーバー側で正規化されて保存される（クライアント側だけに頼らない） |  | human-grade-qa 第11軸 | T-U-18 | L1 |
| SCR-AI-ACTIVITY-022 | ai-activity | 表記ゆらぎ | Unicode 正規化（NFC/NFD）：macOS の入力（NFD）で入れる | 入力欄がある状態 | 入力して保存 | 同一として扱われ、サーバー側で正規化されて保存される（クライアント側だけに頼らない） |  | human-grade-qa 第11軸 | T-U-18 | L1 |
| SCR-AI-ACTIVITY-023 | ai-activity | 表記ゆらぎ | 大文字小文字：メールを大文字で入れる | 入力欄がある状態 | 入力して保存 | 同一として扱われ、サーバー側で正規化されて保存される（クライアント側だけに頼らない） |  | human-grade-qa 第11軸 | T-U-18 | L1 |
| SCR-AI-ACTIVITY-024 | ai-activity | G-11 外部リソースの実在 | N/A：外部リソースを触らない | migration/IaC 適用後 | 起動時の存在確認を読む | 無ければ起動時に落ちる（黙って 502 にならない） |  | 環境ごと | T-U-18 | L1 |
| SCR-AI-ACTIVITY-025 | ai-activity | G-12 切り替わりの瞬間 | Bridge が切れた直後 0 秒・鮮度窓の内側に操作する | 本番稼働中 | PC を閉じた直後に主アクションを押す | 「AI は止まっています」が出て、押した内容は失われない |  |  | T-U-18 | L1 |
| SCR-AI-ACTIVITY-026 | ai-activity | G-13 機能の組み合わせ | 実行中 × 切替／中断 × 再開／別ロール同時 の直積のうち該当分 | — | 同時に起こす | 後勝ちでなく、規則どおり（承認は 1 人 1 回・切替は次の実行から） |  | features.json combination_points | T-U-18 | L1 |
| SCR-AI-ACTIVITY-027 | ai-activity | G-14 口座状態の波及 | 退会・停止・権限変更・パスワード変更の後に、この機能の既存セッション・接続・共有リンクが無効 | ログイン中の別端末と Bridge | 権限を変える | 別端末と Bridge は 0 秒で 401（sessions が revoked） |  |  | T-U-18 | L1 |
| SCR-AI-ACTIVITY-028 | ai-activity | G-15 信号なし終了 | N/A：外部を呼ばない | 外部を故意に切る | 実行する | 成功扱いにせず、502 と次の一手（人へのハンドオフ） |  |  | T-U-18 | L1 |
| SCR-AI-ACTIVITY-029 | ai-activity | G-16 有限資源 | 消費する資源：DB 接続（プール経由）・メモリ。1 要求あたり 1 接続以下・上限時は待機列 | 同時 50 要求 | 同時に叩く | ログインが落ちない・接続上限に張り付かない（関門 C2 のプール） |  | L4 で負荷試験 | T-U-18 | L1 |
