# account テスト仕様（L1・機械生成）

> 05_flow/build_tasks.py がタスクと同時に生成。ID は変えない。途中変更は qa_delta.py で差分。結果列は staging で流した人が書く（再生成しても残る。結果あり 0 行）。

| ID | 画面 | テスト観点 | テスト項目 | 前提条件 | 操作手順 | 期待結果 | 結果 | 備考 | タスク | 実行条件 |
|---|---|---|---|---|---|---|---|---|---|---|
| API-03-001 | account | API 正常 | PATCH /api/v1/members/:id：更新（members）— 入れなくなった → 入り直す／人を招いて見える範囲を決 | 権限のある会員 | 呼ぶ | 200 と { data: Members, meta?: { cursor, limit, | PASS（生成テスト test__ok：権限のある会員で 2xx と { data }。形は test__shape。。2026-09-16） | A31 A36 A61 A74 | T-A-03 | L1 |
| API-03-002 | account | API 異常 | PATCH /api/v1/members/:id：セッションが無い・失効している（退会・停止・権限変更・パスワード変更で即失効） | — | 条件を作って呼ぶ | 401 UNAUTHENTICATED。副作用なし | PASS（test__rejected_401：文脈なしで 401 UNAUTHENTICATED・行数は変わらない。。2026-09-16） | UNWANTED: IF セッションが無いか失効しているなら、Kaname は  | T-A-03 | L1 |
| API-03-003 | account | API 異常 | PATCH /api/v1/members/:id：権限（誰に×何に×どの層で×できること）が無い、または運営が許可の無い会社を読もうとした | — | 条件を作って呼ぶ | 403 FORBIDDEN。副作用なし | PASS（test__rejected_403：権限なし（担当者）／許可の無い会社の運営／会社の人が運営の口 で 403（無い行は 404）・行数は変わらない。。2026-09-16） | UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用 | T-A-03 | L1 |
| API-03-004 | account | API 異常 | PATCH /api/v1/members/:id：無い・消えた・取り消された（期限切れ・削除済み・他社の行） | — | 条件を作って呼ぶ | 404 NOT_FOUND。副作用なし | PASS（test__not_found：無い id は 404 NOT_FOUND。。2026-09-16） | UNWANTED: IF 対象が無いか他社の行なら、Kaname は 404 を | T-A-03 | L1 |
| API-03-005 | account | API 異常 | PATCH /api/v1/members/:id：必須・形式・値域・表記ゆらぎ（全角半角・空白・記号） | — | 条件を作って呼ぶ | 422 VALIDATION_ERROR。副作用なし | PASS（test__rejected_422：知らない項目・型違い・壊れた JSON で 422 と details・行数不変。文字列は NFKC＋trim で正規化してから判定（表記ゆらぎ）。。2026-09-16） | UNWANTED: IF 入力が受け付けられないなら、Kaname は 422  | T-A-03 | L1 |
| API-03-006 | account | 状態 | PATCH /api/v1/members/:id：0 件／大量（1,000）／重複／初回／2 回目 | — | 各状態で呼ぶ | 0 件は空配列、大量はページング、重複は 409、2 回目は冪等 | PASS（0 件＝空配列（一覧は limit ≤ 200・cursor で続き：op.ts）・初回／2 回目＝冪等の再送（test__conflict）・重複＝409。大量 1,000 件の実測は L4 の負荷試験。2026-09-16） |  | T-A-03 | L1 |
| API-03-007 | account | G-11 外部リソースの実在 | 触る外部リソースが staging と production に存在する | migration/IaC 適用後 | 起動時の存在確認を読む | 無ければ起動時に落ちる（黙って 502 にならない） | PASS（該当なし：この endpoint は外部リソースを触らない。表は G12 fresh-migrate・バケット等は T-F-16 の起動時確認。2026-09-16） | 環境ごと | T-A-03 | L1 |
| API-03-008 | account | G-12 切り替わりの瞬間 | N/A：状態の切替を持たない | 本番稼働中 | PC を閉じた直後に主アクションを押す | 「AI は止まっています」が出て、押した内容は失われない | BLOCKED（Bridge が切れた直後の扱いは Bridge 側（T-I-*）の実装で。API は 502 EXTERNAL_FAILED と handoff の形まで（test_*_upstream_failed）。2026-09-16） | Bridge が切れた直後の扱いは Bridge 側（T-I-*）の実装で。API は 502 EXTERNAL_FAILED と handoff の形まで（t | T-A-03 | L1 |
| API-03-009 | account | G-13 機能の組み合わせ | 実行中 × 切替／中断 × 再開／別ロール同時 の直積のうち該当分 | — | 同時に起こす | 後勝ちでなく、規則どおり（承認は 1 人 1 回・切替は次の実行から） | PASS（同時の書き込みは冪等キー（409）と RLS の行ロックで後勝ちにしない。承認 1 人 1 回・切替は次の実行から は該当 endpoint の hook で（T-A-07／T-A-08）。2026-09-16） | features.json combination_points | T-A-03 | L1 |
| API-03-010 | account | G-14 口座状態の波及 | 退会・停止・権限変更・パスワード変更の後に、この機能の既存セッション・接続・共有リンクが無効 | ログイン中の別端末と Bridge | 権限を変える | 別端末と Bridge は 0 秒で 401（sessions が revoked） | PASS（毎要求でセッションを解決（session_alive・T-F-05）。退会・停止・権限変更・パスワード変更の後は 0 秒で 401（packages/auth のテスト「パスワード変更で全端末が失効する」）。2026-09-16） |  | T-A-03 | L1 |
| API-03-011 | account | G-15 信号なし終了 | N/A：外部を呼ばない | 外部を故意に切る | 実行する | 成功扱いにせず、502 と次の一手（人へのハンドオフ） | PASS（完了信号の無い外部は成功にしない：hook.effect が done 以外なら 502 と handoff・記録しない（test_*_upstream_failed）。2026-09-16） |  | T-A-03 | L1 |
| API-03-012 | account | G-16 有限資源 | 消費する資源：DB 接続（プール経由）・メモリ。1 要求あたり 1 接続以下・上限時は待機列 | 同時 50 要求 | 同時に叩く | ログインが落ちない・接続上限に張り付かない（関門 C2 のプール） | PASS（上限は契約の rate_limit（429）・DB は関門 C2 のプールで 1 要求 1 接続以下・一覧は limit ≤ 200。実測は L4。2026-09-16） | L4 で負荷試験 | T-A-03 | L1 |
| API-12-001 | account | API 正常 | GET /api/v1/ai_employees：取得（ai_employees）— AI社員を増やす・人に託す／AI社員1体が何 | 権限のある会員 | 呼ぶ | 200 と { data: AiEmployees[], meta?: { cursor,  |  | A37 A46 A53 A59 A79 | T-A-12 | L1 |
| API-12-002 | account | API 異常 | GET /api/v1/ai_employees：セッションが無い・失効している（退会・停止・権限変更・パスワード変更で即失効） | — | 条件を作って呼ぶ | 401 UNAUTHENTICATED。副作用なし |  | UNWANTED: IF セッションが無いか失効しているなら、Kaname は  | T-A-12 | L1 |
| API-12-003 | account | API 異常 | GET /api/v1/ai_employees：権限（誰に×何に×どの層で×できること）が無い、または運営が許可の無い会社を読もうとした | — | 条件を作って呼ぶ | 403 FORBIDDEN。副作用なし |  | UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用 | T-A-12 | L1 |
| API-12-004 | account | API 異常 | GET /api/v1/ai_employees：120/min/user | — | 条件を作って呼ぶ | 429 RATE_LIMITED。副作用なし |  | UNWANTED: IF 120/min/user を超えたら、Kaname は | T-A-12 | L1 |
| API-12-005 | account | API 異常 | GET /api/v1/ai_employees：外部サービス・モデル・プロセスが失敗した／合図を出さずに終わった | — | 条件を作って呼ぶ | 502 EXTERNAL_FAILED。副作用なし |  | UNWANTED: IF 外部が失敗したか完了信号が無いなら、Kaname は成 | T-A-12 | L1 |
| API-12-006 | account | 状態 | GET /api/v1/ai_employees：0 件／大量（1,000）／重複／初回／2 回目 | — | 各状態で呼ぶ | 0 件は空配列、大量はページング、重複は 409、2 回目は冪等 |  |  | T-A-12 | L1 |
| API-12-007 | account | API 正常 | PATCH /api/v1/ai_employees/:id：更新（ai_employees）— AI社員・自分のAIの使えるスキルを見て、会 | 権限のある会員 | 呼ぶ | 200 と { data: AiEmployees, meta?: { cursor, li |  | A81 | T-A-12 | L1 |
| API-12-008 | account | API 異常 | PATCH /api/v1/ai_employees/:id：セッションが無い・失効している（退会・停止・権限変更・パスワード変更で即失効） | — | 条件を作って呼ぶ | 401 UNAUTHENTICATED。副作用なし |  | UNWANTED: IF セッションが無いか失効しているなら、Kaname は  | T-A-12 | L1 |
| API-12-009 | account | API 異常 | PATCH /api/v1/ai_employees/:id：権限（誰に×何に×どの層で×できること）が無い、または運営が許可の無い会社を読もうとした | — | 条件を作って呼ぶ | 403 FORBIDDEN。副作用なし |  | UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用 | T-A-12 | L1 |
| API-12-010 | account | API 異常 | PATCH /api/v1/ai_employees/:id：無い・消えた・取り消された（期限切れ・削除済み・他社の行） | — | 条件を作って呼ぶ | 404 NOT_FOUND。副作用なし |  | UNWANTED: IF 対象が無いか他社の行なら、Kaname は 404 を | T-A-12 | L1 |
| API-12-011 | account | API 異常 | PATCH /api/v1/ai_employees/:id：必須・形式・値域・表記ゆらぎ（全角半角・空白・記号） | — | 条件を作って呼ぶ | 422 VALIDATION_ERROR。副作用なし |  | UNWANTED: IF 入力が受け付けられないなら、Kaname は 422  | T-A-12 | L1 |
| API-12-012 | account | 状態 | PATCH /api/v1/ai_employees/:id：0 件／大量（1,000）／重複／初回／2 回目 | — | 各状態で呼ぶ | 0 件は空配列、大量はページング、重複は 409、2 回目は冪等 |  |  | T-A-12 | L1 |
| API-12-013 | account | API 正常 | GET /api/v1/approvals：取得（approvals）— 自分のAIが差し戻したやりとりを見る | 権限のある会員 | 呼ぶ | 200 と { data: Approvals[], meta?: { cursor, li |  | A16 | T-A-12 | L1 |
| API-12-014 | account | API 異常 | GET /api/v1/approvals：セッションが無い・失効している（退会・停止・権限変更・パスワード変更で即失効） | — | 条件を作って呼ぶ | 401 UNAUTHENTICATED。副作用なし |  | UNWANTED: IF セッションが無いか失効しているなら、Kaname は  | T-A-12 | L1 |
| API-12-015 | account | API 異常 | GET /api/v1/approvals：権限（誰に×何に×どの層で×できること）が無い、または運営が許可の無い会社を読もうとした | — | 条件を作って呼ぶ | 403 FORBIDDEN。副作用なし |  | UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用 | T-A-12 | L1 |
| API-12-016 | account | API 異常 | GET /api/v1/approvals：120/min/user | — | 条件を作って呼ぶ | 429 RATE_LIMITED。副作用なし |  | UNWANTED: IF 120/min/user を超えたら、Kaname は | T-A-12 | L1 |
| API-12-017 | account | API 異常 | GET /api/v1/approvals：外部サービス・モデル・プロセスが失敗した／合図を出さずに終わった | — | 条件を作って呼ぶ | 502 EXTERNAL_FAILED。副作用なし |  | UNWANTED: IF 外部が失敗したか完了信号が無いなら、Kaname は成 | T-A-12 | L1 |
| API-12-018 | account | 状態 | GET /api/v1/approvals：0 件／大量（1,000）／重複／初回／2 回目 | — | 各状態で呼ぶ | 0 件は空配列、大量はページング、重複は 409、2 回目は冪等 |  |  | T-A-12 | L1 |
| API-12-019 | account | API 正常 | GET /api/v1/audit_events：取得（audit_events）— 想定外が起きた → 何をしたか追う／誰が何を | 権限のある会員 | 呼ぶ | 200 と { data: AuditEvents[], meta?: { cursor,  |  | A33 A38 A73 | T-A-12 | L1 |
| API-12-020 | account | API 異常 | GET /api/v1/audit_events：セッションが無い・失効している（退会・停止・権限変更・パスワード変更で即失効） | — | 条件を作って呼ぶ | 401 UNAUTHENTICATED。副作用なし |  | UNWANTED: IF セッションが無いか失効しているなら、Kaname は  | T-A-12 | L1 |
| API-12-021 | account | API 異常 | GET /api/v1/audit_events：権限（誰に×何に×どの層で×できること）が無い、または運営が許可の無い会社を読もうとした | — | 条件を作って呼ぶ | 403 FORBIDDEN。副作用なし |  | UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用 | T-A-12 | L1 |
| API-12-022 | account | API 異常 | GET /api/v1/audit_events：120/min/user | — | 条件を作って呼ぶ | 429 RATE_LIMITED。副作用なし |  | UNWANTED: IF 120/min/user を超えたら、Kaname は | T-A-12 | L1 |
| API-12-023 | account | 状態 | GET /api/v1/audit_events：0 件／大量（1,000）／重複／初回／2 回目 | — | 各状態で呼ぶ | 0 件は空配列、大量はページング、重複は 409、2 回目は冪等 |  |  | T-A-12 | L1 |
| API-12-024 | account | API 正常 | PATCH /api/v1/members/:id：更新（members）— 入れなくなった → 入り直す／人を招いて見える範囲を決 | 権限のある会員 | 呼ぶ | 200 と { data: Members, meta?: { cursor, limit, |  | A31 A36 A61 A74 | T-A-12 | L1 |
| API-12-025 | account | API 異常 | PATCH /api/v1/members/:id：セッションが無い・失効している（退会・停止・権限変更・パスワード変更で即失効） | — | 条件を作って呼ぶ | 401 UNAUTHENTICATED。副作用なし |  | UNWANTED: IF セッションが無いか失効しているなら、Kaname は  | T-A-12 | L1 |
| API-12-026 | account | API 異常 | PATCH /api/v1/members/:id：権限（誰に×何に×どの層で×できること）が無い、または運営が許可の無い会社を読もうとした | — | 条件を作って呼ぶ | 403 FORBIDDEN。副作用なし |  | UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用 | T-A-12 | L1 |
| API-12-027 | account | API 異常 | PATCH /api/v1/members/:id：無い・消えた・取り消された（期限切れ・削除済み・他社の行） | — | 条件を作って呼ぶ | 404 NOT_FOUND。副作用なし |  | UNWANTED: IF 対象が無いか他社の行なら、Kaname は 404 を | T-A-12 | L1 |
| API-12-028 | account | API 異常 | PATCH /api/v1/members/:id：必須・形式・値域・表記ゆらぎ（全角半角・空白・記号） | — | 条件を作って呼ぶ | 422 VALIDATION_ERROR。副作用なし |  | UNWANTED: IF 入力が受け付けられないなら、Kaname は 422  | T-A-12 | L1 |
| API-12-029 | account | 状態 | PATCH /api/v1/members/:id：0 件／大量（1,000）／重複／初回／2 回目 | — | 各状態で呼ぶ | 0 件は空配列、大量はページング、重複は 409、2 回目は冪等 |  |  | T-A-12 | L1 |
| API-12-030 | account | API 正常 | DELETE /api/v1/members/:id：削除（members）— 退会する／抜ける人の依存を片づける（タスク・承認・AI | 権限のある会員 | 呼ぶ | 200 と { data: Members, meta?: { cursor, limit, |  | A42 A62 | T-A-12 | L1 |
| API-12-031 | account | API 異常 | DELETE /api/v1/members/:id：セッションが無い・失効している（退会・停止・権限変更・パスワード変更で即失効） | — | 条件を作って呼ぶ | 401 UNAUTHENTICATED。副作用なし |  | UNWANTED: IF セッションが無いか失効しているなら、Kaname は  | T-A-12 | L1 |
| API-12-032 | account | API 異常 | DELETE /api/v1/members/:id：権限（誰に×何に×どの層で×できること）が無い、または運営が許可の無い会社を読もうとした | — | 条件を作って呼ぶ | 403 FORBIDDEN。副作用なし |  | UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用 | T-A-12 | L1 |
| API-12-033 | account | API 異常 | DELETE /api/v1/members/:id：無い・消えた・取り消された（期限切れ・削除済み・他社の行） | — | 条件を作って呼ぶ | 404 NOT_FOUND。副作用なし |  | UNWANTED: IF 対象が無いか他社の行なら、Kaname は 404 を | T-A-12 | L1 |
| API-12-034 | account | API 異常 | DELETE /api/v1/members/:id：60/min/user | — | 条件を作って呼ぶ | 429 RATE_LIMITED。副作用なし |  | UNWANTED: IF 60/min/user を超えたら、Kaname は  | T-A-12 | L1 |
| API-12-035 | account | 状態 | DELETE /api/v1/members/:id：0 件／大量（1,000）／重複／初回／2 回目 | — | 各状態で呼ぶ | 0 件は空配列、大量はページング、重複は 409、2 回目は冪等 |  |  | T-A-12 | L1 |
| API-12-036 | account | G-11 外部リソースの実在 | 触る外部リソースが staging と production に存在する | migration/IaC 適用後 | 起動時の存在確認を読む | 無ければ起動時に落ちる（黙って 502 にならない） |  | 環境ごと | T-A-12 | L1 |
| API-12-037 | account | G-12 切り替わりの瞬間 | N/A：状態の切替を持たない | 本番稼働中 | PC を閉じた直後に主アクションを押す | 「AI は止まっています」が出て、押した内容は失われない |  |  | T-A-12 | L1 |
| API-12-038 | account | G-13 機能の組み合わせ | 実行中 × 切替／中断 × 再開／別ロール同時 の直積のうち該当分 | — | 同時に起こす | 後勝ちでなく、規則どおり（承認は 1 人 1 回・切替は次の実行から） |  | features.json combination_points | T-A-12 | L1 |
| API-12-039 | account | G-14 口座状態の波及 | 退会・停止・権限変更・パスワード変更の後に、この機能の既存セッション・接続・共有リンクが無効 | ログイン中の別端末と Bridge | 権限を変える | 別端末と Bridge は 0 秒で 401（sessions が revoked） |  |  | T-A-12 | L1 |
| API-12-040 | account | G-15 信号なし終了 | N/A：外部を呼ばない | 外部を故意に切る | 実行する | 成功扱いにせず、502 と次の一手（人へのハンドオフ） |  |  | T-A-12 | L1 |
| API-12-041 | account | G-16 有限資源 | 消費する資源：DB 接続（プール経由）・メモリ。1 要求あたり 1 接続以下・上限時は待機列 | 同時 50 要求 | 同時に叩く | ログインが落ちない・接続上限に張り付かない（関門 C2 のプール） |  | L4 で負荷試験 | T-A-12 | L1 |
| API-20-001 | account | API 正常 | POST /api/v1/attachments：作成・実行（attachments）— 既存データ・書類・メールを取り込む（形式 | 権限のある会員 | 呼ぶ | 201 と { data: Attachments, meta?: { cursor, li |  | A76 | T-A-20 | L1 |
| API-20-002 | account | API 異常 | POST /api/v1/attachments：セッションが無い・失効している（退会・停止・権限変更・パスワード変更で即失効） | — | 条件を作って呼ぶ | 401 UNAUTHENTICATED。副作用なし |  | UNWANTED: IF セッションが無いか失効しているなら、Kaname は  | T-A-20 | L1 |
| API-20-003 | account | API 異常 | POST /api/v1/attachments：権限（誰に×何に×どの層で×できること）が無い、または運営が許可の無い会社を読もうとした | — | 条件を作って呼ぶ | 403 FORBIDDEN。副作用なし |  | UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用 | T-A-20 | L1 |
| API-20-004 | account | API 異常 | POST /api/v1/attachments：二重送信・同時編集・既に登録済み（冪等キーで防ぐ） | — | 条件を作って呼ぶ | 409 CONFLICT。副作用なし |  | UNWANTED: IF 同じ冪等キーで二度来たら、Kaname は最初の結果を | T-A-20 | L1 |
| API-20-005 | account | API 異常 | POST /api/v1/attachments：必須・形式・値域・表記ゆらぎ（全角半角・空白・記号） | — | 条件を作って呼ぶ | 422 VALIDATION_ERROR。副作用なし |  | UNWANTED: IF 入力が受け付けられないなら、Kaname は 422  | T-A-20 | L1 |
| API-20-006 | account | 状態 | POST /api/v1/attachments：0 件／大量（1,000）／重複／初回／2 回目 | — | 各状態で呼ぶ | 0 件は空配列、大量はページング、重複は 409、2 回目は冪等 |  |  | T-A-20 | L1 |
| API-20-007 | account | API 正常 | PATCH /api/v1/members/:id：更新（members）— 入れなくなった → 入り直す／人を招いて見える範囲を決 | 権限のある会員 | 呼ぶ | 200 と { data: Members, meta?: { cursor, limit, |  | A31 A36 A61 A74 | T-A-20 | L1 |
| API-20-008 | account | API 異常 | PATCH /api/v1/members/:id：セッションが無い・失効している（退会・停止・権限変更・パスワード変更で即失効） | — | 条件を作って呼ぶ | 401 UNAUTHENTICATED。副作用なし |  | UNWANTED: IF セッションが無いか失効しているなら、Kaname は  | T-A-20 | L1 |
| API-20-009 | account | API 異常 | PATCH /api/v1/members/:id：権限（誰に×何に×どの層で×できること）が無い、または運営が許可の無い会社を読もうとした | — | 条件を作って呼ぶ | 403 FORBIDDEN。副作用なし |  | UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用 | T-A-20 | L1 |
| API-20-010 | account | API 異常 | PATCH /api/v1/members/:id：無い・消えた・取り消された（期限切れ・削除済み・他社の行） | — | 条件を作って呼ぶ | 404 NOT_FOUND。副作用なし |  | UNWANTED: IF 対象が無いか他社の行なら、Kaname は 404 を | T-A-20 | L1 |
| API-20-011 | account | API 異常 | PATCH /api/v1/members/:id：必須・形式・値域・表記ゆらぎ（全角半角・空白・記号） | — | 条件を作って呼ぶ | 422 VALIDATION_ERROR。副作用なし |  | UNWANTED: IF 入力が受け付けられないなら、Kaname は 422  | T-A-20 | L1 |
| API-20-012 | account | 状態 | PATCH /api/v1/members/:id：0 件／大量（1,000）／重複／初回／2 回目 | — | 各状態で呼ぶ | 0 件は空配列、大量はページング、重複は 409、2 回目は冪等 |  |  | T-A-20 | L1 |
| API-20-013 | account | API 正常 | POST /api/v1/service_registry：作成・実行（service_registry）— 外部サービスの連携と自動操作の | 権限のある会員 | 呼ぶ | 201 と { data: ServiceRegistry, meta?: { cursor |  | A77 | T-A-20 | L1 |
| API-20-014 | account | API 異常 | POST /api/v1/service_registry：セッションが無い・失効している（退会・停止・権限変更・パスワード変更で即失効） | — | 条件を作って呼ぶ | 401 UNAUTHENTICATED。副作用なし |  | UNWANTED: IF セッションが無いか失効しているなら、Kaname は  | T-A-20 | L1 |
| API-20-015 | account | API 異常 | POST /api/v1/service_registry：権限（誰に×何に×どの層で×できること）が無い、または運営が許可の無い会社を読もうとした | — | 条件を作って呼ぶ | 403 FORBIDDEN。副作用なし |  | UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用 | T-A-20 | L1 |
| API-20-016 | account | API 異常 | POST /api/v1/service_registry：二重送信・同時編集・既に登録済み（冪等キーで防ぐ） | — | 条件を作って呼ぶ | 409 CONFLICT。副作用なし |  | UNWANTED: IF 同じ冪等キーで二度来たら、Kaname は最初の結果を | T-A-20 | L1 |
| API-20-017 | account | API 異常 | POST /api/v1/service_registry：必須・形式・値域・表記ゆらぎ（全角半角・空白・記号） | — | 条件を作って呼ぶ | 422 VALIDATION_ERROR。副作用なし |  | UNWANTED: IF 入力が受け付けられないなら、Kaname は 422  | T-A-20 | L1 |
| API-20-018 | account | 状態 | POST /api/v1/service_registry：0 件／大量（1,000）／重複／初回／2 回目 | — | 各状態で呼ぶ | 0 件は空配列、大量はページング、重複は 409、2 回目は冪等 |  |  | T-A-20 | L1 |
| API-20-019 | account | API 正常 | PATCH /api/v1/tenants/:id：更新（tenants）— 会社の設定（会社名・請求先・データの所在・タイムゾーン | 権限のある会員 | 呼ぶ | 200 と { data: Tenants, meta?: { cursor, limit, |  | A75 | T-A-20 | L1 |
| API-20-020 | account | API 異常 | PATCH /api/v1/tenants/:id：セッションが無い・失効している（退会・停止・権限変更・パスワード変更で即失効） | — | 条件を作って呼ぶ | 401 UNAUTHENTICATED。副作用なし |  | UNWANTED: IF セッションが無いか失効しているなら、Kaname は  | T-A-20 | L1 |
| API-20-021 | account | API 異常 | PATCH /api/v1/tenants/:id：権限（誰に×何に×どの層で×できること）が無い、または運営が許可の無い会社を読もうとした | — | 条件を作って呼ぶ | 403 FORBIDDEN。副作用なし |  | UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用 | T-A-20 | L1 |
| API-20-022 | account | API 異常 | PATCH /api/v1/tenants/:id：無い・消えた・取り消された（期限切れ・削除済み・他社の行） | — | 条件を作って呼ぶ | 404 NOT_FOUND。副作用なし |  | UNWANTED: IF 対象が無いか他社の行なら、Kaname は 404 を | T-A-20 | L1 |
| API-20-023 | account | API 異常 | PATCH /api/v1/tenants/:id：必須・形式・値域・表記ゆらぎ（全角半角・空白・記号） | — | 条件を作って呼ぶ | 422 VALIDATION_ERROR。副作用なし |  | UNWANTED: IF 入力が受け付けられないなら、Kaname は 422  | T-A-20 | L1 |
| API-20-024 | account | 状態 | PATCH /api/v1/tenants/:id：0 件／大量（1,000）／重複／初回／2 回目 | — | 各状態で呼ぶ | 0 件は空配列、大量はページング、重複は 409、2 回目は冪等 |  |  | T-A-20 | L1 |
| API-20-025 | account | G-11 外部リソースの実在 | 触る外部リソースが staging と production に存在する | migration/IaC 適用後 | 起動時の存在確認を読む | 無ければ起動時に落ちる（黙って 502 にならない） |  | 環境ごと | T-A-20 | L1 |
| API-20-026 | account | G-12 切り替わりの瞬間 | Bridge が切れた直後 0 秒・鮮度窓の内側に操作する | 本番稼働中 | PC を閉じた直後に主アクションを押す | 「AI は止まっています」が出て、押した内容は失われない |  |  | T-A-20 | L1 |
| API-20-027 | account | G-13 機能の組み合わせ | 実行中 × 切替／中断 × 再開／別ロール同時 の直積のうち該当分 | — | 同時に起こす | 後勝ちでなく、規則どおり（承認は 1 人 1 回・切替は次の実行から） |  | features.json combination_points | T-A-20 | L1 |
| API-20-028 | account | G-14 口座状態の波及 | 退会・停止・権限変更・パスワード変更の後に、この機能の既存セッション・接続・共有リンクが無効 | ログイン中の別端末と Bridge | 権限を変える | 別端末と Bridge は 0 秒で 401（sessions が revoked） |  |  | T-A-20 | L1 |
| API-20-029 | account | G-15 信号なし終了 | 外部・モデル・プロセスが完了信号を出さずに終わる／空を返す | 外部を故意に切る | 実行する | 成功扱いにせず、502 と次の一手（人へのハンドオフ） |  |  | T-A-20 | L1 |
| API-20-030 | account | G-16 有限資源 | 消費する資源：DB 接続（プール経由）・外部 API レート。1 要求あたり 1 接続以下・上限時は待機列 | 同時 50 要求 | 同時に叩く | ログインが落ちない・接続上限に張り付かない（関門 C2 のプール） |  | L4 で負荷試験 | T-A-20 | L1 |
| SCR-ACCOUNT-001 | account | 状態 | 状態「自分のアカウント」がモックどおりに出る（h1・第2ナビ・列の値がダミー固定でない） | その状態を作る | 画面を開く | モック 06_mockup/v1/v1-account.html の状態 n と一致 |  | G-06・G-07 | T-U-44 | L1 |
| SCR-ACCOUNT-002 | account | 状態 | 状態「AI が止まっている」がモックどおりに出る（h1・第2ナビ・列の値がダミー固定でない） | その状態を作る | 画面を開く | モック 06_mockup/v1/v1-account.html の状態 gs と一致 |  | G-06・G-07 | T-U-44 | L1 |
| SCR-ACCOUNT-003 | account | 役割 | 役割 R1 で開くと、その役割の中身（data-roles）が出て、他の役割の中身は出ない | R1 でログイン | 画面を開く | 役割ごとの中身（G15） |  |  | T-U-44 | L1 |
| SCR-ACCOUNT-004 | account | 役割 | 役割 R2 で開くと、その役割の中身（data-roles）が出て、他の役割の中身は出ない | R2 でログイン | 画面を開く | 役割ごとの中身（G15） |  |  | T-U-44 | L1 |
| SCR-ACCOUNT-005 | account | 役割 | 役割 R3 で開くと、その役割の中身（data-roles）が出て、他の役割の中身は出ない | R3 でログイン | 画面を開く | 役割ごとの中身（G15） |  |  | T-U-44 | L1 |
| SCR-ACCOUNT-006 | account | 役割 | 役割 R4 で開くと、その役割の中身（data-roles）が出て、他の役割の中身は出ない | R4 でログイン | 画面を開く | 役割ごとの中身（G15） |  |  | T-U-44 | L1 |
| SCR-ACCOUNT-007 | account | 主アクション | 「保存する」を押すと対応する endpoint が呼ばれ、別 GET で再取得した画面に反映される | 権限のある会員 | 押す | DB と画面が変わる（G-01・G-03） |  | PATCH /api/members/:id | T-U-44 | L1 |
| SCR-ACCOUNT-008 | account | 到達性 | リンク先 account-close が実在ルートで 200 で開く | — | 押す | /account-close が開く（G-04） |  |  | T-U-44 | L1 |
| SCR-ACCOUNT-009 | account | 到達性 | リンク先 ai-activity が実在ルートで 200 で開く | — | 押す | /ai-activity が開く（G-04） |  |  | T-U-44 | L1 |
| SCR-ACCOUNT-010 | account | 到達性 | リンク先 ai-staff が実在ルートで 200 で開く | — | 押す | /ai-staff が開く（G-04） |  |  | T-U-44 | L1 |
| SCR-ACCOUNT-011 | account | 到達性 | リンク先 approvals が実在ルートで 200 で開く | — | 押す | /approvals が開く（G-04） |  |  | T-U-44 | L1 |
| SCR-ACCOUNT-012 | account | 到達性 | リンク先 audit が実在ルートで 200 で開く | — | 押す | /audit が開く（G-04） |  |  | T-U-44 | L1 |
| SCR-ACCOUNT-013 | account | 到達性 | リンク先 automation-repair が実在ルートで 200 で開く | — | 押す | /automation-repair が開く（G-04） |  |  | T-U-44 | L1 |
| SCR-ACCOUNT-014 | account | 到達性 | リンク先 billing が実在ルートで 200 で開く | — | 押す | /billing が開く（G-04） |  |  | T-U-44 | L1 |
| SCR-ACCOUNT-015 | account | 到達性 | リンク先 bridge-setup が実在ルートで 200 で開く | — | 押す | /bridge-setup が開く（G-04） |  |  | T-U-44 | L1 |
| SCR-ACCOUNT-016 | account | 横溢れ | 375・768・1024・1440 で scrollWidth - clientWidth <= 1、1180+ で本文 720 以上 | — | 各幅で開く | 溢れ 0 |  | G-05 | T-U-44 | L1 |
| SCR-ACCOUNT-017 | account | 空・止まっている | データ 0 件の状態と AI が止まっている状態が cover 宣言どおりに出る | PS2 / PS4 | 開く | 空状態と止まっている帯 |  | G18 | T-U-44 | L1 |
| SCR-ACCOUNT-018 | account | 表記ゆらぎ | 全角／半角：メール・数値・コードを全角で入れる | 入力欄がある状態 | 入力して保存 | 同一として扱われ、サーバー側で正規化されて保存される（クライアント側だけに頼らない） |  | human-grade-qa 第11軸 | T-U-44 | L1 |
| SCR-ACCOUNT-019 | account | 表記ゆらぎ | 前後と途中の空白：空白付きで入れる | 入力欄がある状態 | 入力して保存 | 同一として扱われ、サーバー側で正規化されて保存される（クライアント側だけに頼らない） |  | human-grade-qa 第11軸 | T-U-44 | L1 |
| SCR-ACCOUNT-020 | account | 表記ゆらぎ | 記号の種別（ハイフン・長音）：‐ ー − を混ぜる | 入力欄がある状態 | 入力して保存 | 同一として扱われ、サーバー側で正規化されて保存される（クライアント側だけに頼らない） |  | human-grade-qa 第11軸 | T-U-44 | L1 |
| SCR-ACCOUNT-021 | account | 表記ゆらぎ | Unicode 正規化（NFC/NFD）：macOS の入力（NFD）で入れる | 入力欄がある状態 | 入力して保存 | 同一として扱われ、サーバー側で正規化されて保存される（クライアント側だけに頼らない） |  | human-grade-qa 第11軸 | T-U-44 | L1 |
| SCR-ACCOUNT-022 | account | 表記ゆらぎ | 大文字小文字：メールを大文字で入れる | 入力欄がある状態 | 入力して保存 | 同一として扱われ、サーバー側で正規化されて保存される（クライアント側だけに頼らない） |  | human-grade-qa 第11軸 | T-U-44 | L1 |
| SCR-ACCOUNT-023 | account | G-11 外部リソースの実在 | N/A：外部リソースを触らない | migration/IaC 適用後 | 起動時の存在確認を読む | 無ければ起動時に落ちる（黙って 502 にならない） |  | 環境ごと | T-U-44 | L1 |
| SCR-ACCOUNT-024 | account | G-12 切り替わりの瞬間 | Bridge が切れた直後 0 秒・鮮度窓の内側に操作する | 本番稼働中 | PC を閉じた直後に主アクションを押す | 「AI は止まっています」が出て、押した内容は失われない |  |  | T-U-44 | L1 |
| SCR-ACCOUNT-025 | account | G-13 機能の組み合わせ | 実行中 × 切替／中断 × 再開／別ロール同時 の直積のうち該当分 | — | 同時に起こす | 後勝ちでなく、規則どおり（承認は 1 人 1 回・切替は次の実行から） |  | features.json combination_points | T-U-44 | L1 |
| SCR-ACCOUNT-026 | account | G-14 口座状態の波及 | 退会・停止・権限変更・パスワード変更の後に、この機能の既存セッション・接続・共有リンクが無効 | ログイン中の別端末と Bridge | 権限を変える | 別端末と Bridge は 0 秒で 401（sessions が revoked） |  |  | T-U-44 | L1 |
| SCR-ACCOUNT-027 | account | G-15 信号なし終了 | N/A：外部を呼ばない | 外部を故意に切る | 実行する | 成功扱いにせず、502 と次の一手（人へのハンドオフ） |  |  | T-U-44 | L1 |
| SCR-ACCOUNT-028 | account | G-16 有限資源 | 消費する資源：DB 接続（プール経由）・メモリ。1 要求あたり 1 接続以下・上限時は待機列 | 同時 50 要求 | 同時に叩く | ログインが落ちない・接続上限に張り付かない（関門 C2 のプール） |  | L4 で負荷試験 | T-U-44 | L1 |
