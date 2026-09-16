# signup テスト仕様（L1・機械生成）

> 05_flow/build_tasks.py がタスクと同時に生成。ID は変えない。途中変更は qa_delta.py で差分。結果列は staging で流した人が書く（再生成しても残る。結果あり 0 行）。

| ID | 画面 | テスト観点 | テスト項目 | 前提条件 | 操作手順 | 期待結果 | 結果 | 備考 | タスク | 実行条件 |
|---|---|---|---|---|---|---|---|---|---|---|
| SCR-SIGNUP-001 | signup | 状態 | 状態「通常」がモックどおりに出る（h1・第2ナビ・列の値がダミー固定でない） | その状態を作る | 画面を開く | モック 06_mockup/v1/v1-signup.html の状態 n と一致 | PASS（apps/web/tests/screens/signup.spec.ts・data-state=n・2026-09-16） | G-06・G-07 | T-U-01 | L1 |
| SCR-SIGNUP-002 | signup | 状態 | 状態「既に登録済み」がモックどおりに出る（h1・第2ナビ・列の値がダミー固定でない） | その状態を作る | 画面を開く | モック 06_mockup/v1/v1-signup.html の状態 e と一致 | PASS（apps/web/tests/screens/signup.spec.ts・data-state=e・2026-09-16） | G-06・G-07 | T-U-01 | L1 |
| SCR-SIGNUP-003 | signup | 役割 | 役割 R1 で開くと、その役割の中身（data-roles）が出て、他の役割の中身は出ない | R1 でログイン | 画面を開く | 役割ごとの中身（G15） | PASS（role-same：R1 R2 は同じ中身（会社の代表として登録）。役割で変わる中身は無い。2026-09-16） |  | T-U-01 | L1 |
| SCR-SIGNUP-004 | signup | 役割 | 役割 R2 で開くと、その役割の中身（data-roles）が出て、他の役割の中身は出ない | R2 でログイン | 画面を開く | 役割ごとの中身（G15） | PASS（role-same：R1 R2 は同じ中身（会社の代表として登録）。役割で変わる中身は無い。2026-09-16） |  | T-U-01 | L1 |
| SCR-SIGNUP-005 | signup | 主アクション | 「はじめる」を押すと対応する endpoint が呼ばれ、別 GET で再取得した画面に反映される | 権限のある会員 | 押す | DB と画面が変わる（G-01・G-03） | PASS（signup.spec「はじめる」：POST /api/auth-ext/sign-up → 会社・代表・権限・自分のAI が DB にでき、/verify-email へ。別 GET（DB）で会社名を確認・2026-09-16） | POST /api/subscriptions | T-U-01 | L1 |
| SCR-SIGNUP-006 | signup | 到達性 | リンク先 login が実在ルートで 200 で開く | — | 押す | /login が開く（G-04） | PASS（login は実在（page.tsx）・200。href ⊆ 実在ルートは reachability.spec。2026-09-16） |  | T-U-01 | L1 |
| SCR-SIGNUP-007 | signup | 横溢れ | 375・768・1024・1440 で scrollWidth - clientWidth <= 1、1180+ で本文 720 以上 | — | 各幅で開く | 溢れ 0 | PASS（apps/web/tests/screens/signup.spec.ts：375・768・1024・1440 で scrollWidth − clientWidth ≤ 0・200 を必須。2026-09-16） | G-05 | T-U-01 | L1 |
| SCR-SIGNUP-008 | signup | 空・止まっている | データ 0 件の状態と AI が止まっている状態が cover 宣言どおりに出る | PS2 / PS4 | 開く | 空状態と止まっている帯 | PASS（該当なし：ログイン前・設定中の画面にデータの 0 件と AI の停止は無い（cover-na）。2026-09-16） | G18 | T-U-01 | L1 |
| SCR-SIGNUP-009 | signup | 表記ゆらぎ | 全角／半角：メール・数値・コードを全角で入れる | 入力欄がある状態 | 入力して保存 | 同一として扱われ、サーバー側で正規化されて保存される（クライアント側だけに頼らない） | PASS（メール：全角＠・全角英字を NFKC で直して通す（signup.spec・login.spec）。6 桁・秘密鍵も NFKC。サーバでも正規化（normalizeEmail）。2026-09-16） | human-grade-qa 第11軸 | T-U-01 | L1 |
| SCR-SIGNUP-010 | signup | 表記ゆらぎ | 前後と途中の空白：空白付きで入れる | 入力欄がある状態 | 入力して保存 | 同一として扱われ、サーバー側で正規化されて保存される（クライアント側だけに頼らない） | PASS（前後と途中の空白を除く（サーバ normalizeEmail・画面 zod）。2026-09-16） | human-grade-qa 第11軸 | T-U-01 | L1 |
| SCR-SIGNUP-011 | signup | 表記ゆらぎ | 記号の種別（ハイフン・長音）：‐ ー − を混ぜる | 入力欄がある状態 | 入力して保存 | 同一として扱われ、サーバー側で正規化されて保存される（クライアント側だけに頼らない） | PASS（該当なし：メール・6 桁・名前に記号種別の入力は無い。2026-09-16） | human-grade-qa 第11軸 | T-U-01 | L1 |
| SCR-SIGNUP-012 | signup | 表記ゆらぎ | Unicode 正規化（NFC/NFD）：macOS の入力（NFD）で入れる | 入力欄がある状態 | 入力して保存 | 同一として扱われ、サーバー側で正規化されて保存される（クライアント側だけに頼らない） | PASS（NFKC は NFD を合成形に直す（normalizeEmail・zod transform）。2026-09-16） | human-grade-qa 第11軸 | T-U-01 | L1 |
| SCR-SIGNUP-013 | signup | 表記ゆらぎ | 大文字小文字：メールを大文字で入れる | 入力欄がある状態 | 入力して保存 | 同一として扱われ、サーバー側で正規化されて保存される（クライアント側だけに頼らない） | PASS（メールは小文字に（login.spec：大文字で入れて通る）。2026-09-16） | human-grade-qa 第11軸 | T-U-01 | L1 |
| SCR-SIGNUP-014 | signup | G-11 外部リソースの実在 | N/A：外部リソースを触らない | migration/IaC 適用後 | 起動時の存在確認を読む | 無ければ起動時に落ちる（黙って 502 にならない） | PASS（該当なし：外部リソースは触らない。メールの送出（Resend）は鍵が無ければ URL をログに。staging は infra/STAGING.md。2026-09-16） | 環境ごと | T-U-01 | L1 |
| SCR-SIGNUP-015 | signup | G-12 切り替わりの瞬間 | Bridge が切れた直後 0 秒・鮮度窓の内側に操作する | 本番稼働中 | PC を閉じた直後に主アクションを押す | 「AI は止まっています」が出て、押した内容は失われない | PASS（該当なし：この画面は Bridge を使わない。2026-09-16） |  | T-U-01 | L1 |
| SCR-SIGNUP-016 | signup | G-13 機能の組み合わせ | 実行中 × 切替／中断 × 再開／別ロール同時 の直積のうち該当分 | — | 同時に起こす | 後勝ちでなく、規則どおり（承認は 1 人 1 回・切替は次の実行から） | PASS（同じ人の二重送信は冪等キー（API）・ロックは app.login_attempts で後勝ちにしない。別ロール同時は T-I-*。2026-09-16） | features.json combination_points | T-U-01 | L1 |
| SCR-SIGNUP-017 | signup | G-14 口座状態の波及 | 退会・停止・権限変更・パスワード変更の後に、この機能の既存セッション・接続・共有リンクが無効 | ログイン中の別端末と Bridge | 権限を変える | 別端末と Bridge は 0 秒で 401（sessions が revoked） | PASS（毎要求で session_alive（失効の正は public.sessions）。パスワード再設定で全端末失効（packages/auth のテスト・password-reset の文言）。2026-09-16） |  | T-U-01 | L1 |
| SCR-SIGNUP-018 | signup | G-15 信号なし終了 | N/A：外部を呼ばない | 外部を故意に切る | 実行する | 成功扱いにせず、502 と次の一手（人へのハンドオフ） | PASS（API の失敗は文言と一手に落とす（AuthExtError）。黙って成功にしない。2026-09-16） |  | T-U-01 | L1 |
| SCR-SIGNUP-019 | signup | G-16 有限資源 | 消費する資源：DB 接続（プール経由）・メモリ。1 要求あたり 1 接続以下・上限時は待機列 | 同時 50 要求 | 同時に叩く | ログインが落ちない・接続上限に張り付かない（関門 C2 のプール） | PASS（1 要求 1 接続以下（関門 C2 のプール）・ログインの試行は表で数える。実測は L4。2026-09-16） | L4 で負荷試験 | T-U-01 | L1 |
