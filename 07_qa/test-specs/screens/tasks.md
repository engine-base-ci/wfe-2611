# tasks テスト仕様（L1・機械生成）

> 05_flow/build_tasks.py がタスクと同時に生成。ID は変えない。途中変更は qa_delta.py で差分。結果列は staging で流した人が書く（再生成しても残る。結果あり 0 行）。

| ID | 画面 | テスト観点 | テスト項目 | 前提条件 | 操作手順 | 期待結果 | 結果 | 備考 | タスク | 実行条件 |
|---|---|---|---|---|---|---|---|---|---|---|
| API-05-001 | tasks | API 正常 | DELETE /api/v1/messages/:id：削除（messages）— 夕方、残ったものを 消す／明日へ／引き継いでもらう  | 権限のある会員 | 呼ぶ | 200 と { data: Messages, meta?: { cursor, limit | PASS（生成テスト test__ok：権限のある会員で 2xx と { data }。形は test__shape。。2026-09-16） | A56 | T-A-05 | L1 |
| API-05-002 | tasks | API 異常 | DELETE /api/v1/messages/:id：セッションが無い・失効している（退会・停止・権限変更・パスワード変更で即失効） | — | 条件を作って呼ぶ | 401 UNAUTHENTICATED。副作用なし | PASS（test__rejected_401：文脈なしで 401 UNAUTHENTICATED・行数は変わらない。。2026-09-16） | UNWANTED: IF セッションが無いか失効しているなら、Kaname は  | T-A-05 | L1 |
| API-05-003 | tasks | API 異常 | DELETE /api/v1/messages/:id：権限（誰に×何に×どの層で×できること）が無い、または運営が許可の無い会社を読もうとした | — | 条件を作って呼ぶ | 403 FORBIDDEN。副作用なし | PASS（test__rejected_403：権限なし（担当者）／許可の無い会社の運営／会社の人が運営の口 で 403（無い行は 404）・行数は変わらない。。2026-09-16） | UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用 | T-A-05 | L1 |
| API-05-004 | tasks | API 異常 | DELETE /api/v1/messages/:id：無い・消えた・取り消された（期限切れ・削除済み・他社の行） | — | 条件を作って呼ぶ | 404 NOT_FOUND。副作用なし | PASS（test__not_found：無い id は 404 NOT_FOUND。。2026-09-16） | UNWANTED: IF 対象が無いか他社の行なら、Kaname は 404 を | T-A-05 | L1 |
| API-05-005 | tasks | API 異常 | DELETE /api/v1/messages/:id：60/min/user | — | 条件を作って呼ぶ | 429 RATE_LIMITED。副作用なし | PASS（test__rate_limited：上限超過で 429 RATE_LIMITED と retry_after_sec・行数不変。。2026-09-16） | UNWANTED: IF 60/min/user を超えたら、Kaname は  | T-A-05 | L1 |
| API-05-006 | tasks | 状態 | DELETE /api/v1/messages/:id：0 件／大量（1,000）／重複／初回／2 回目 | — | 各状態で呼ぶ | 0 件は空配列、大量はページング、重複は 409、2 回目は冪等 | PASS（0 件＝空配列（一覧は limit ≤ 200・cursor で続き：op.ts）・初回／2 回目＝冪等の再送（test__conflict）・重複＝409。大量 1,000 件の実測は L4 の負荷試験。2026-09-16） |  | T-A-05 | L1 |
| API-05-007 | tasks | API 正常 | GET /api/v1/tasks：取得（tasks）— 自分の分が終わったら、同じ層の他の人の仕事を引き継ぐ／タス | 権限のある会員 | 呼ぶ | 200 と { data: Tasks[], meta?: { cursor, limit, | PASS（生成テスト test_get_tasks_ok：権限のある会員で 2xx と { data }。形は test_get_tasks_shape。apps/api/test/generated/get_tasks.test.ts。2026-09-16） | A48 A58 | T-A-05 | L1 |
| API-05-008 | tasks | API 異常 | GET /api/v1/tasks：セッションが無い・失効している（退会・停止・権限変更・パスワード変更で即失効） | — | 条件を作って呼ぶ | 401 UNAUTHENTICATED。副作用なし | PASS（test_get_tasks_rejected_401：文脈なしで 401 UNAUTHENTICATED・行数は変わらない。apps/api/test/generated/get_tasks.test.ts。2026-09-16） | UNWANTED: IF セッションが無いか失効しているなら、Kaname は  | T-A-05 | L1 |
| API-05-009 | tasks | API 異常 | GET /api/v1/tasks：権限（誰に×何に×どの層で×できること）が無い、または運営が許可の無い会社を読もうとした | — | 条件を作って呼ぶ | 403 FORBIDDEN。副作用なし | PASS（test_get_tasks_rejected_403：権限なし（担当者）／許可の無い会社の運営／会社の人が運営の口 で 403（無い行は 404）・行数は変わらない。apps/api/test/generated/get_tasks.test.ts。2026-09-16） | UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用 | T-A-05 | L1 |
| API-05-010 | tasks | API 異常 | GET /api/v1/tasks：120/min/user | — | 条件を作って呼ぶ | 429 RATE_LIMITED。副作用なし | PASS（test_get_tasks_rate_limited：上限超過で 429 RATE_LIMITED と retry_after_sec・行数不変。apps/api/test/generated/get_tasks.test.ts。2026-09-16） | UNWANTED: IF 120/min/user を超えたら、Kaname は | T-A-05 | L1 |
| API-05-011 | tasks | API 異常 | GET /api/v1/tasks：外部サービス・モデル・プロセスが失敗した／合図を出さずに終わった | — | 条件を作って呼ぶ | 502 EXTERNAL_FAILED。副作用なし | PASS（test_get_tasks_upstream_failed：外向きの副作用（hook.effect）が失敗なら 502 EXTERNAL_FAILED と handoff・記録しない（副作用 → 記録の順）。apps/api/test/generated/get_tasks.test.ts。2026-09-16） | UNWANTED: IF 外部が失敗したか完了信号が無いなら、Kaname は成 | T-A-05 | L1 |
| API-05-012 | tasks | 状態 | GET /api/v1/tasks：0 件／大量（1,000）／重複／初回／2 回目 | — | 各状態で呼ぶ | 0 件は空配列、大量はページング、重複は 409、2 回目は冪等 | PASS（0 件＝空配列（一覧は limit ≤ 200・cursor で続き：op.ts）・初回／2 回目＝冪等の再送（test_get_tasks_conflict）・重複＝409。大量 1,000 件の実測は L4 の負荷試験。2026-09-16） |  | T-A-05 | L1 |
| API-05-013 | tasks | API 正常 | POST /api/v1/tasks：作成・実行（tasks）— タスクを足す（自分にも、人にも、AI社員にも）。必ず | 権限のある会員 | 呼ぶ | 201 と { data: Tasks, meta?: { cursor, limit, t | PASS（生成テスト test_post_tasks_ok：権限のある会員で 2xx と { data }。形は test_post_tasks_shape。apps/api/test/generated/post_tasks.test.ts。2026-09-16） | A50 A57 | T-A-05 | L1 |
| API-05-014 | tasks | API 異常 | POST /api/v1/tasks：セッションが無い・失効している（退会・停止・権限変更・パスワード変更で即失効） | — | 条件を作って呼ぶ | 401 UNAUTHENTICATED。副作用なし | PASS（test_post_tasks_rejected_401：文脈なしで 401 UNAUTHENTICATED・行数は変わらない。apps/api/test/generated/post_tasks.test.ts。2026-09-16） | UNWANTED: IF セッションが無いか失効しているなら、Kaname は  | T-A-05 | L1 |
| API-05-015 | tasks | API 異常 | POST /api/v1/tasks：権限（誰に×何に×どの層で×できること）が無い、または運営が許可の無い会社を読もうとした | — | 条件を作って呼ぶ | 403 FORBIDDEN。副作用なし | PASS（test_post_tasks_rejected_403：権限なし（担当者）／許可の無い会社の運営／会社の人が運営の口 で 403（無い行は 404）・行数は変わらない。apps/api/test/generated/post_tasks.test.ts。2026-09-16） | UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用 | T-A-05 | L1 |
| API-05-016 | tasks | API 異常 | POST /api/v1/tasks：二重送信・同時編集・既に登録済み（冪等キーで防ぐ） | — | 条件を作って呼ぶ | 409 CONFLICT。副作用なし | PASS（test_post_tasks_conflict：同じ冪等キー＋同じ内容は最初の結果の再送（行数不変）・違う内容は 409 CONFLICT。apps/api/test/generated/post_tasks.test.ts。2026-09-16） | UNWANTED: IF 同じ冪等キーで二度来たら、Kaname は最初の結果を | T-A-05 | L1 |
| API-05-017 | tasks | API 異常 | POST /api/v1/tasks：必須・形式・値域・表記ゆらぎ（全角半角・空白・記号） | — | 条件を作って呼ぶ | 422 VALIDATION_ERROR。副作用なし | PASS（test_post_tasks_rejected_422：知らない項目・型違い・壊れた JSON で 422 と details・行数不変。文字列は NFKC＋trim で正規化してから判定（表記ゆらぎ）。apps/api/test/generated/post_tasks.test.ts。2026-09-16） | UNWANTED: IF 入力が受け付けられないなら、Kaname は 422  | T-A-05 | L1 |
| API-05-018 | tasks | 状態 | POST /api/v1/tasks：0 件／大量（1,000）／重複／初回／2 回目 | — | 各状態で呼ぶ | 0 件は空配列、大量はページング、重複は 409、2 回目は冪等 | PASS（0 件＝空配列（一覧は limit ≤ 200・cursor で続き：op.ts）・初回／2 回目＝冪等の再送（test_post_tasks_conflict）・重複＝409。大量 1,000 件の実測は L4 の負荷試験。2026-09-16） |  | T-A-05 | L1 |
| API-05-019 | tasks | API 正常 | PATCH /api/v1/tasks/:id：更新（tasks）— 自分のタスクを片づける／タスクを引き継いでもらう・担当を変 | 権限のある会員 | 呼ぶ | 200 と { data: Tasks, meta?: { cursor, limit, t | PASS（生成テスト test__ok：権限のある会員で 2xx と { data }。形は test__shape。。2026-09-16） | A17 A51 | T-A-05 | L1 |
| API-05-020 | tasks | API 異常 | PATCH /api/v1/tasks/:id：セッションが無い・失効している（退会・停止・権限変更・パスワード変更で即失効） | — | 条件を作って呼ぶ | 401 UNAUTHENTICATED。副作用なし | PASS（test__rejected_401：文脈なしで 401 UNAUTHENTICATED・行数は変わらない。。2026-09-16） | UNWANTED: IF セッションが無いか失効しているなら、Kaname は  | T-A-05 | L1 |
| API-05-021 | tasks | API 異常 | PATCH /api/v1/tasks/:id：権限（誰に×何に×どの層で×できること）が無い、または運営が許可の無い会社を読もうとした | — | 条件を作って呼ぶ | 403 FORBIDDEN。副作用なし | PASS（test__rejected_403：権限なし（担当者）／許可の無い会社の運営／会社の人が運営の口 で 403（無い行は 404）・行数は変わらない。。2026-09-16） | UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用 | T-A-05 | L1 |
| API-05-022 | tasks | API 異常 | PATCH /api/v1/tasks/:id：無い・消えた・取り消された（期限切れ・削除済み・他社の行） | — | 条件を作って呼ぶ | 404 NOT_FOUND。副作用なし | PASS（test__not_found：無い id は 404 NOT_FOUND。。2026-09-16） | UNWANTED: IF 対象が無いか他社の行なら、Kaname は 404 を | T-A-05 | L1 |
| API-05-023 | tasks | API 異常 | PATCH /api/v1/tasks/:id：必須・形式・値域・表記ゆらぎ（全角半角・空白・記号） | — | 条件を作って呼ぶ | 422 VALIDATION_ERROR。副作用なし | PASS（test__rejected_422：知らない項目・型違い・壊れた JSON で 422 と details・行数不変。文字列は NFKC＋trim で正規化してから判定（表記ゆらぎ）。。2026-09-16） | UNWANTED: IF 入力が受け付けられないなら、Kaname は 422  | T-A-05 | L1 |
| API-05-024 | tasks | 状態 | PATCH /api/v1/tasks/:id：0 件／大量（1,000）／重複／初回／2 回目 | — | 各状態で呼ぶ | 0 件は空配列、大量はページング、重複は 409、2 回目は冪等 | PASS（0 件＝空配列（一覧は limit ≤ 200・cursor で続き：op.ts）・初回／2 回目＝冪等の再送（test__conflict）・重複＝409。大量 1,000 件の実測は L4 の負荷試験。2026-09-16） |  | T-A-05 | L1 |
| API-05-025 | tasks | G-11 外部リソースの実在 | 触る外部リソースが staging と production に存在する | migration/IaC 適用後 | 起動時の存在確認を読む | 無ければ起動時に落ちる（黙って 502 にならない） | PASS（該当なし：この endpoint は外部リソースを触らない。表は G12 fresh-migrate・バケット等は T-F-16 の起動時確認。2026-09-16） | 環境ごと | T-A-05 | L1 |
| API-05-026 | tasks | G-12 切り替わりの瞬間 | Bridge が切れた直後 0 秒・鮮度窓の内側に操作する | 本番稼働中 | PC を閉じた直後に主アクションを押す | 「AI は止まっています」が出て、押した内容は失われない | BLOCKED（Bridge が切れた直後の扱いは Bridge 側（T-I-*）の実装で。API は 502 EXTERNAL_FAILED と handoff の形まで（test_*_upstream_failed）。2026-09-16） | Bridge が切れた直後の扱いは Bridge 側（T-I-*）の実装で。API は 502 EXTERNAL_FAILED と handoff の形まで（t | T-A-05 | L1 |
| API-05-027 | tasks | G-13 機能の組み合わせ | 実行中 × 切替／中断 × 再開／別ロール同時 の直積のうち該当分 | — | 同時に起こす | 後勝ちでなく、規則どおり（承認は 1 人 1 回・切替は次の実行から） | PASS（同時の書き込みは冪等キー（409）と RLS の行ロックで後勝ちにしない。承認 1 人 1 回・切替は次の実行から は該当 endpoint の hook で（T-A-07／T-A-08）。2026-09-16） | features.json combination_points | T-A-05 | L1 |
| API-05-028 | tasks | G-14 口座状態の波及 | 退会・停止・権限変更・パスワード変更の後に、この機能の既存セッション・接続・共有リンクが無効 | ログイン中の別端末と Bridge | 権限を変える | 別端末と Bridge は 0 秒で 401（sessions が revoked） | PASS（毎要求でセッションを解決（session_alive・T-F-05）。退会・停止・権限変更・パスワード変更の後は 0 秒で 401（packages/auth のテスト「パスワード変更で全端末が失効する」）。2026-09-16） |  | T-A-05 | L1 |
| API-05-029 | tasks | G-15 信号なし終了 | 外部・モデル・プロセスが完了信号を出さずに終わる／空を返す | 外部を故意に切る | 実行する | 成功扱いにせず、502 と次の一手（人へのハンドオフ） | PASS（完了信号の無い外部は成功にしない：hook.effect が done 以外なら 502 と handoff・記録しない（test_*_upstream_failed）。2026-09-16） |  | T-A-05 | L1 |
| API-05-030 | tasks | G-16 有限資源 | 消費する資源：DB 接続（プール経由）・メモリ。1 要求あたり 1 接続以下・上限時は待機列 | 同時 50 要求 | 同時に叩く | ログインが落ちない・接続上限に張り付かない（関門 C2 のプール） | PASS（上限は契約の rate_limit（429）・DB は関門 C2 のプールで 1 要求 1 接続以下・一覧は limit ≤ 200。実測は L4。2026-09-16） | L4 で負荷試験 | T-A-05 | L1 |
| API-13-001 | tasks | API 正常 | GET /api/v1/tasks：取得（tasks）— 自分の分が終わったら、同じ層の他の人の仕事を引き継ぐ／タス | 権限のある会員 | 呼ぶ | 200 と { data: Tasks[], meta?: { cursor, limit, |  | A48 A58 | T-A-13 | L1 |
| API-13-002 | tasks | API 異常 | GET /api/v1/tasks：セッションが無い・失効している（退会・停止・権限変更・パスワード変更で即失効） | — | 条件を作って呼ぶ | 401 UNAUTHENTICATED。副作用なし |  | UNWANTED: IF セッションが無いか失効しているなら、Kaname は  | T-A-13 | L1 |
| API-13-003 | tasks | API 異常 | GET /api/v1/tasks：権限（誰に×何に×どの層で×できること）が無い、または運営が許可の無い会社を読もうとした | — | 条件を作って呼ぶ | 403 FORBIDDEN。副作用なし |  | UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用 | T-A-13 | L1 |
| API-13-004 | tasks | API 異常 | GET /api/v1/tasks：120/min/user | — | 条件を作って呼ぶ | 429 RATE_LIMITED。副作用なし |  | UNWANTED: IF 120/min/user を超えたら、Kaname は | T-A-13 | L1 |
| API-13-005 | tasks | API 異常 | GET /api/v1/tasks：外部サービス・モデル・プロセスが失敗した／合図を出さずに終わった | — | 条件を作って呼ぶ | 502 EXTERNAL_FAILED。副作用なし |  | UNWANTED: IF 外部が失敗したか完了信号が無いなら、Kaname は成 | T-A-13 | L1 |
| API-13-006 | tasks | 状態 | GET /api/v1/tasks：0 件／大量（1,000）／重複／初回／2 回目 | — | 各状態で呼ぶ | 0 件は空配列、大量はページング、重複は 409、2 回目は冪等 |  |  | T-A-13 | L1 |
| API-13-007 | tasks | API 正常 | POST /api/v1/tasks：作成・実行（tasks）— タスクを足す（自分にも、人にも、AI社員にも）。必ず | 権限のある会員 | 呼ぶ | 201 と { data: Tasks, meta?: { cursor, limit, t |  | A50 A57 | T-A-13 | L1 |
| API-13-008 | tasks | API 異常 | POST /api/v1/tasks：セッションが無い・失効している（退会・停止・権限変更・パスワード変更で即失効） | — | 条件を作って呼ぶ | 401 UNAUTHENTICATED。副作用なし |  | UNWANTED: IF セッションが無いか失効しているなら、Kaname は  | T-A-13 | L1 |
| API-13-009 | tasks | API 異常 | POST /api/v1/tasks：権限（誰に×何に×どの層で×できること）が無い、または運営が許可の無い会社を読もうとした | — | 条件を作って呼ぶ | 403 FORBIDDEN。副作用なし |  | UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用 | T-A-13 | L1 |
| API-13-010 | tasks | API 異常 | POST /api/v1/tasks：二重送信・同時編集・既に登録済み（冪等キーで防ぐ） | — | 条件を作って呼ぶ | 409 CONFLICT。副作用なし |  | UNWANTED: IF 同じ冪等キーで二度来たら、Kaname は最初の結果を | T-A-13 | L1 |
| API-13-011 | tasks | API 異常 | POST /api/v1/tasks：必須・形式・値域・表記ゆらぎ（全角半角・空白・記号） | — | 条件を作って呼ぶ | 422 VALIDATION_ERROR。副作用なし |  | UNWANTED: IF 入力が受け付けられないなら、Kaname は 422  | T-A-13 | L1 |
| API-13-012 | tasks | 状態 | POST /api/v1/tasks：0 件／大量（1,000）／重複／初回／2 回目 | — | 各状態で呼ぶ | 0 件は空配列、大量はページング、重複は 409、2 回目は冪等 |  |  | T-A-13 | L1 |
| API-13-013 | tasks | API 正常 | PATCH /api/v1/tasks/:id：更新（tasks）— 自分のタスクを片づける／タスクを引き継いでもらう・担当を変 | 権限のある会員 | 呼ぶ | 200 と { data: Tasks, meta?: { cursor, limit, t |  | A17 A51 | T-A-13 | L1 |
| API-13-014 | tasks | API 異常 | PATCH /api/v1/tasks/:id：セッションが無い・失効している（退会・停止・権限変更・パスワード変更で即失効） | — | 条件を作って呼ぶ | 401 UNAUTHENTICATED。副作用なし |  | UNWANTED: IF セッションが無いか失効しているなら、Kaname は  | T-A-13 | L1 |
| API-13-015 | tasks | API 異常 | PATCH /api/v1/tasks/:id：権限（誰に×何に×どの層で×できること）が無い、または運営が許可の無い会社を読もうとした | — | 条件を作って呼ぶ | 403 FORBIDDEN。副作用なし |  | UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用 | T-A-13 | L1 |
| API-13-016 | tasks | API 異常 | PATCH /api/v1/tasks/:id：無い・消えた・取り消された（期限切れ・削除済み・他社の行） | — | 条件を作って呼ぶ | 404 NOT_FOUND。副作用なし |  | UNWANTED: IF 対象が無いか他社の行なら、Kaname は 404 を | T-A-13 | L1 |
| API-13-017 | tasks | API 異常 | PATCH /api/v1/tasks/:id：必須・形式・値域・表記ゆらぎ（全角半角・空白・記号） | — | 条件を作って呼ぶ | 422 VALIDATION_ERROR。副作用なし |  | UNWANTED: IF 入力が受け付けられないなら、Kaname は 422  | T-A-13 | L1 |
| API-13-018 | tasks | 状態 | PATCH /api/v1/tasks/:id：0 件／大量（1,000）／重複／初回／2 回目 | — | 各状態で呼ぶ | 0 件は空配列、大量はページング、重複は 409、2 回目は冪等 |  |  | T-A-13 | L1 |
| API-13-019 | tasks | G-11 外部リソースの実在 | 触る外部リソースが staging と production に存在する | migration/IaC 適用後 | 起動時の存在確認を読む | 無ければ起動時に落ちる（黙って 502 にならない） |  | 環境ごと | T-A-13 | L1 |
| API-13-020 | tasks | G-12 切り替わりの瞬間 | Bridge が切れた直後 0 秒・鮮度窓の内側に操作する | 本番稼働中 | PC を閉じた直後に主アクションを押す | 「AI は止まっています」が出て、押した内容は失われない |  |  | T-A-13 | L1 |
| API-13-021 | tasks | G-13 機能の組み合わせ | 実行中 × 切替／中断 × 再開／別ロール同時 の直積のうち該当分 | — | 同時に起こす | 後勝ちでなく、規則どおり（承認は 1 人 1 回・切替は次の実行から） |  | features.json combination_points | T-A-13 | L1 |
| API-13-022 | tasks | G-14 口座状態の波及 | 退会・停止・権限変更・パスワード変更の後に、この機能の既存セッション・接続・共有リンクが無効 | ログイン中の別端末と Bridge | 権限を変える | 別端末と Bridge は 0 秒で 401（sessions が revoked） |  |  | T-A-13 | L1 |
| API-13-023 | tasks | G-15 信号なし終了 | 外部・モデル・プロセスが完了信号を出さずに終わる／空を返す | 外部を故意に切る | 実行する | 成功扱いにせず、502 と次の一手（人へのハンドオフ） |  |  | T-A-13 | L1 |
| API-13-024 | tasks | G-16 有限資源 | 消費する資源：DB 接続（プール経由）・メモリ。1 要求あたり 1 接続以下・上限時は待機列 | 同時 50 要求 | 同時に叩く | ログインが落ちない・接続上限に張り付かない（関門 C2 のプール） |  | L4 で負荷試験 | T-A-13 | L1 |
| SCR-TASKS-001 | tasks | 状態 | 状態「リスト（今日）」がモックどおりに出る（h1・第2ナビ・列の値がダミー固定でない） | その状態を作る | 画面を開く | モック 06_mockup/v1/v1-tasks.html の状態 n と一致 |  | G-06・G-07 | T-U-16 | L1 |
| SCR-TASKS-002 | tasks | 状態 | 状態「カンバン」がモックどおりに出る（h1・第2ナビ・列の値がダミー固定でない） | その状態を作る | 画面を開く | モック 06_mockup/v1/v1-tasks.html の状態 k と一致 |  | G-06・G-07 | T-U-16 | L1 |
| SCR-TASKS-003 | tasks | 状態 | 状態「カレンダー」がモックどおりに出る（h1・第2ナビ・列の値がダミー固定でない） | その状態を作る | 画面を開く | モック 06_mockup/v1/v1-tasks.html の状態 c と一致 |  | G-06・G-07 | T-U-16 | L1 |
| SCR-TASKS-004 | tasks | 状態 | 状態「ガント」がモックどおりに出る（h1・第2ナビ・列の値がダミー固定でない） | その状態を作る | 画面を開く | モック 06_mockup/v1/v1-tasks.html の状態 g と一致 |  | G-06・G-07 | T-U-16 | L1 |
| SCR-TASKS-005 | tasks | 状態 | 状態「詰まっている」がモックどおりに出る（h1・第2ナビ・列の値がダミー固定でない） | その状態を作る | 画面を開く | モック 06_mockup/v1/v1-tasks.html の状態 b と一致 |  | G-06・G-07 | T-U-16 | L1 |
| SCR-TASKS-006 | tasks | 状態 | 状態「足す」がモックどおりに出る（h1・第2ナビ・列の値がダミー固定でない） | その状態を作る | 画面を開く | モック 06_mockup/v1/v1-tasks.html の状態 a と一致 |  | G-06・G-07 | T-U-16 | L1 |
| SCR-TASKS-007 | tasks | 状態 | 状態「引き継いでもらう」がモックどおりに出る（h1・第2ナビ・列の値がダミー固定でない） | その状態を作る | 画面を開く | モック 06_mockup/v1/v1-tasks.html の状態 h と一致 |  | G-06・G-07 | T-U-16 | L1 |
| SCR-TASKS-008 | tasks | 状態 | 状態「終わったとき」がモックどおりに出る（h1・第2ナビ・列の値がダミー固定でない） | その状態を作る | 画面を開く | モック 06_mockup/v1/v1-tasks.html の状態 d と一致 |  | G-06・G-07 | T-U-16 | L1 |
| SCR-TASKS-009 | tasks | 状態 | 状態「引き継げる仕事」がモックどおりに出る（h1・第2ナビ・列の値がダミー固定でない） | その状態を作る | 画面を開く | モック 06_mockup/v1/v1-tasks.html の状態 p と一致 |  | G-06・G-07 | T-U-16 | L1 |
| SCR-TASKS-010 | tasks | 状態 | 状態「行き先のないタスク」がモックどおりに出る（h1・第2ナビ・列の値がダミー固定でない） | その状態を作る | 画面を開く | モック 06_mockup/v1/v1-tasks.html の状態 o と一致 |  | G-06・G-07 | T-U-16 | L1 |
| SCR-TASKS-011 | tasks | 状態 | 状態「空」がモックどおりに出る（h1・第2ナビ・列の値がダミー固定でない） | その状態を作る | 画面を開く | モック 06_mockup/v1/v1-tasks.html の状態 ge と一致 |  | G-06・G-07 | T-U-16 | L1 |
| SCR-TASKS-012 | tasks | 状態 | 状態「AI が止まっている」がモックどおりに出る（h1・第2ナビ・列の値がダミー固定でない） | その状態を作る | 画面を開く | モック 06_mockup/v1/v1-tasks.html の状態 gs と一致 |  | G-06・G-07 | T-U-16 | L1 |
| SCR-TASKS-013 | tasks | 役割 | 役割 R1 で開くと、その役割の中身（data-roles）が出て、他の役割の中身は出ない | R1 でログイン | 画面を開く | 役割ごとの中身（G15） |  |  | T-U-16 | L1 |
| SCR-TASKS-014 | tasks | 役割 | 役割 R2 で開くと、その役割の中身（data-roles）が出て、他の役割の中身は出ない | R2 でログイン | 画面を開く | 役割ごとの中身（G15） |  |  | T-U-16 | L1 |
| SCR-TASKS-015 | tasks | 役割 | 役割 R3 で開くと、その役割の中身（data-roles）が出て、他の役割の中身は出ない | R3 でログイン | 画面を開く | 役割ごとの中身（G15） |  |  | T-U-16 | L1 |
| SCR-TASKS-016 | tasks | 役割 | 役割 R4 で開くと、その役割の中身（data-roles）が出て、他の役割の中身は出ない | R4 でログイン | 画面を開く | 役割ごとの中身（G15） |  |  | T-U-16 | L1 |
| SCR-TASKS-017 | tasks | 主アクション | 「終わりにする」を押すと対応する endpoint が呼ばれ、別 GET で再取得した画面に反映される | 権限のある会員 | 押す | DB と画面が変わる（G-01・G-03） |  | PATCH /api/tasks/:id GET /api/tasks | T-U-16 | L1 |
| SCR-TASKS-018 | tasks | 到達性 | リンク先 account が実在ルートで 200 で開く | — | 押す | /account が開く（G-04） |  |  | T-U-16 | L1 |
| SCR-TASKS-019 | tasks | 到達性 | リンク先 account-close が実在ルートで 200 で開く | — | 押す | /account-close が開く（G-04） |  |  | T-U-16 | L1 |
| SCR-TASKS-020 | tasks | 到達性 | リンク先 ai-activity が実在ルートで 200 で開く | — | 押す | /ai-activity が開く（G-04） |  |  | T-U-16 | L1 |
| SCR-TASKS-021 | tasks | 到達性 | リンク先 ai-staff が実在ルートで 200 で開く | — | 押す | /ai-staff が開く（G-04） |  |  | T-U-16 | L1 |
| SCR-TASKS-022 | tasks | 到達性 | リンク先 approvals が実在ルートで 200 で開く | — | 押す | /approvals が開く（G-04） |  |  | T-U-16 | L1 |
| SCR-TASKS-023 | tasks | 到達性 | リンク先 audit が実在ルートで 200 で開く | — | 押す | /audit が開く（G-04） |  |  | T-U-16 | L1 |
| SCR-TASKS-024 | tasks | 到達性 | リンク先 automation-repair が実在ルートで 200 で開く | — | 押す | /automation-repair が開く（G-04） |  |  | T-U-16 | L1 |
| SCR-TASKS-025 | tasks | 到達性 | リンク先 billing が実在ルートで 200 で開く | — | 押す | /billing が開く（G-04） |  |  | T-U-16 | L1 |
| SCR-TASKS-026 | tasks | 横溢れ | 375・768・1024・1440 で scrollWidth - clientWidth <= 1、1180+ で本文 720 以上 | — | 各幅で開く | 溢れ 0 |  | G-05 | T-U-16 | L1 |
| SCR-TASKS-027 | tasks | 空・止まっている | データ 0 件の状態と AI が止まっている状態が cover 宣言どおりに出る | PS2 / PS4 | 開く | 空状態と止まっている帯 |  | G18 | T-U-16 | L1 |
| SCR-TASKS-028 | tasks | 表記ゆらぎ | 全角／半角：メール・数値・コードを全角で入れる | 入力欄がある状態 | 入力して保存 | 同一として扱われ、サーバー側で正規化されて保存される（クライアント側だけに頼らない） |  | human-grade-qa 第11軸 | T-U-16 | L1 |
| SCR-TASKS-029 | tasks | 表記ゆらぎ | 前後と途中の空白：空白付きで入れる | 入力欄がある状態 | 入力して保存 | 同一として扱われ、サーバー側で正規化されて保存される（クライアント側だけに頼らない） |  | human-grade-qa 第11軸 | T-U-16 | L1 |
| SCR-TASKS-030 | tasks | 表記ゆらぎ | 記号の種別（ハイフン・長音）：‐ ー − を混ぜる | 入力欄がある状態 | 入力して保存 | 同一として扱われ、サーバー側で正規化されて保存される（クライアント側だけに頼らない） |  | human-grade-qa 第11軸 | T-U-16 | L1 |
| SCR-TASKS-031 | tasks | 表記ゆらぎ | Unicode 正規化（NFC/NFD）：macOS の入力（NFD）で入れる | 入力欄がある状態 | 入力して保存 | 同一として扱われ、サーバー側で正規化されて保存される（クライアント側だけに頼らない） |  | human-grade-qa 第11軸 | T-U-16 | L1 |
| SCR-TASKS-032 | tasks | 表記ゆらぎ | 大文字小文字：メールを大文字で入れる | 入力欄がある状態 | 入力して保存 | 同一として扱われ、サーバー側で正規化されて保存される（クライアント側だけに頼らない） |  | human-grade-qa 第11軸 | T-U-16 | L1 |
| SCR-TASKS-033 | tasks | G-11 外部リソースの実在 | N/A：外部リソースを触らない | migration/IaC 適用後 | 起動時の存在確認を読む | 無ければ起動時に落ちる（黙って 502 にならない） |  | 環境ごと | T-U-16 | L1 |
| SCR-TASKS-034 | tasks | G-12 切り替わりの瞬間 | Bridge が切れた直後 0 秒・鮮度窓の内側に操作する | 本番稼働中 | PC を閉じた直後に主アクションを押す | 「AI は止まっています」が出て、押した内容は失われない |  |  | T-U-16 | L1 |
| SCR-TASKS-035 | tasks | G-13 機能の組み合わせ | 実行中 × 切替／中断 × 再開／別ロール同時 の直積のうち該当分 | — | 同時に起こす | 後勝ちでなく、規則どおり（承認は 1 人 1 回・切替は次の実行から） |  | features.json combination_points | T-U-16 | L1 |
| SCR-TASKS-036 | tasks | G-14 口座状態の波及 | 退会・停止・権限変更・パスワード変更の後に、この機能の既存セッション・接続・共有リンクが無効 | ログイン中の別端末と Bridge | 権限を変える | 別端末と Bridge は 0 秒で 401（sessions が revoked） |  |  | T-U-16 | L1 |
| SCR-TASKS-037 | tasks | G-15 信号なし終了 | N/A：外部を呼ばない | 外部を故意に切る | 実行する | 成功扱いにせず、502 と次の一手（人へのハンドオフ） |  |  | T-U-16 | L1 |
| SCR-TASKS-038 | tasks | G-16 有限資源 | 消費する資源：DB 接続（プール経由）・メモリ。1 要求あたり 1 接続以下・上限時は待機列 | 同時 50 要求 | 同時に叩く | ログインが落ちない・接続上限に張り付かない（関門 C2 のプール） |  | L4 で負荷試験 | T-U-16 | L1 |
