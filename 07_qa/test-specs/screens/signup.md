# signup テスト仕様（L1・機械生成）

> 05_flow/build_tasks.py がタスクと同時に生成。ID は変えない。途中変更は qa_delta.py で差分。結果列は staging で流した人が書く（再生成しても残る。結果あり 19 行）。

| ID | 画面 | テスト観点 | テスト項目 | 前提条件 | 操作手順 | 期待結果 | 結果 | 備考 | タスク | 実行条件 |
|---|---|---|---|---|---|---|---|---|---|---|
| SCR-SIGNUP-001 | signup | 状態 | 状態「通常」がモックどおりに出る（h1・第2ナビ・列の値がダミー固定でない） | その状態を作る | 画面を開く | モック 06_mockup/v1/v1-signup.html の状態 n と一致 | PASS（screens/signup.spec.ts・実 Chrome（本番ビルド／見本は dev）・2026-09-20） | G-06・G-07 | T-U-01 | L1 |
| SCR-SIGNUP-002 | signup | 状態 | 状態「既に登録済み」がモックどおりに出る（h1・第2ナビ・列の値がダミー固定でない） | その状態を作る | 画面を開く | モック 06_mockup/v1/v1-signup.html の状態 e と一致 | PASS（screens/signup.spec.ts・実 Chrome（本番ビルド／見本は dev）・2026-09-20） | G-06・G-07 | T-U-01 | L1 |
| SCR-SIGNUP-003 | signup | 役割 | 役割 R1 で開くと、その役割の中身（data-roles）が出て、他の役割の中身は出ない | R1 でログイン | 画面を開く | 役割ごとの中身（G15） | PASS（role-same：R1 R2 は同じ中身（会社の代表として登録）。役割で変わる中身は無い。2026-09-16） |  | T-U-01 | L1 |
| SCR-SIGNUP-004 | signup | 役割 | 役割 R2 で開くと、その役割の中身（data-roles）が出て、他の役割の中身は出ない | R2 でログイン | 画面を開く | 役割ごとの中身（G15） | PASS（role-same：R1 R2 は同じ中身（会社の代表として登録）。役割で変わる中身は無い。2026-09-16） |  | T-U-01 | L1 |
| SCR-SIGNUP-005 | signup | 主アクション | 「はじめる」を押すと対応する endpoint が呼ばれ、別 GET で再取得した画面に反映される | 権限のある会員 | 押す | DB と画面が変わる（G-01・G-03） | PASS（screens/signup.spec.ts・実 Chrome（本番ビルド／見本は dev）・2026-09-20） | POST /api/subscriptions | T-U-01 | L1 |
| SCR-SIGNUP-006 | signup | 到達性 | リンク先 login が実在ルートで 200 で開く | — | 押す | /login が開く（G-04） | PASS（screens/signup.spec.ts・実 Chrome（本番ビルド／見本は dev）・2026-09-20） |  | T-U-01 | L1 |
| SCR-SIGNUP-007 | signup | 横溢れ | 375・768・1024・1440 で scrollWidth - clientWidth <= 1、1180+ で本文 720 以上 | — | 各幅で開く | 溢れ 0 | PASS（screens/signup.spec.ts・実 Chrome（本番ビルド／見本は dev）・2026-09-20） | G-05 | T-U-01 | L1 |
| SCR-SIGNUP-008 | signup | 空・止まっている | データ 0 件の状態と AI が止まっている状態が cover 宣言どおりに出る | PS2 / PS4 | 開く | 空状態と止まっている帯 | PASS（screens/signup.spec.ts・実 Chrome（本番ビルド／見本は dev）・2026-09-20） | G18 | T-U-01 | L1 |
| SCR-SIGNUP-009 | signup | 表記ゆらぎ | 全角／半角：メール・数値・コードを全角で入れる | 入力欄がある状態 | 入力して保存 | 同一として扱われ、サーバー側で正規化されて保存される（クライアント側だけに頼らない） | PASS（screens/signup.spec.ts・実 Chrome（本番ビルド／見本は dev）・2026-09-20） | human-grade-qa 第11軸 | T-U-01 | L1 |
| SCR-SIGNUP-010 | signup | 表記ゆらぎ | 前後と途中の空白：空白付きで入れる | 入力欄がある状態 | 入力して保存 | 同一として扱われ、サーバー側で正規化されて保存される（クライアント側だけに頼らない） | PASS（screens/signup.spec.ts・実 Chrome（本番ビルド／見本は dev）・2026-09-20） | human-grade-qa 第11軸 | T-U-01 | L1 |
| SCR-SIGNUP-011 | signup | 表記ゆらぎ | 記号の種別（ハイフン・長音）：‐ ー − を混ぜる | 入力欄がある状態 | 入力して保存 | 同一として扱われ、サーバー側で正規化されて保存される（クライアント側だけに頼らない） | PASS（screens/signup.spec.ts・実 Chrome（本番ビルド／見本は dev）・2026-09-20） | human-grade-qa 第11軸 | T-U-01 | L1 |
| SCR-SIGNUP-012 | signup | 表記ゆらぎ | Unicode 正規化（NFC/NFD）：macOS の入力（NFD）で入れる | 入力欄がある状態 | 入力して保存 | 同一として扱われ、サーバー側で正規化されて保存される（クライアント側だけに頼らない） | PASS（screens/signup.spec.ts・実 Chrome（本番ビルド／見本は dev）・2026-09-20） | human-grade-qa 第11軸 | T-U-01 | L1 |
| SCR-SIGNUP-013 | signup | 表記ゆらぎ | 大文字小文字：メールを大文字で入れる | 入力欄がある状態 | 入力して保存 | 同一として扱われ、サーバー側で正規化されて保存される（クライアント側だけに頼らない） | PASS（screens/signup.spec.ts・実 Chrome（本番ビルド／見本は dev）・2026-09-20） | human-grade-qa 第11軸 | T-U-01 | L1 |
| SCR-SIGNUP-014 | signup | G-11 外部リソースの実在 | N/A：外部リソースを触らない | migration/IaC 適用後 | 起動時の存在確認を読む | 無ければ起動時に落ちる（黙って 502 にならない） | PASS（該当なし：外部リソースは触らない。メールの送出（Resend）は鍵が無ければ URL をログに。staging は infra/STAGING.md。2026-09-16） | 環境ごと | T-U-01 | L1 |
| SCR-SIGNUP-015 | signup | G-12 切り替わりの瞬間 | Bridge が切れた直後 0 秒・鮮度窓の内側に操作する | 本番稼働中 | PC を閉じた直後に主アクションを押す | 「AI は止まっています」が出て、押した内容は失われない | PASS（該当なし：この画面は Bridge を使わない。2026-09-16） |  | T-U-01 | L1 |
| SCR-SIGNUP-016 | signup | G-13 機能の組み合わせ | 実行中 × 切替／中断 × 再開／別ロール同時 の直積のうち該当分 | — | 同時に起こす | 後勝ちでなく、規則どおり（承認は 1 人 1 回・切替は次の実行から） | PASS（同じ人の二重送信は冪等キー（API）・ロックは app.login_attempts で後勝ちにしない。別ロール同時は T-I-*。2026-09-16） | features.json combination_points | T-U-01 | L1 |
| SCR-SIGNUP-017 | signup | G-14 口座状態の波及 | 退会・停止・権限変更・パスワード変更の後に、この機能の既存セッション・接続・共有リンクが無効 | ログイン中の別端末と Bridge | 権限を変える | 別端末と Bridge は 0 秒で 401（sessions が revoked） | PASS（毎要求で session_alive（失効の正は public.sessions）。パスワード再設定で全端末失効（packages/auth のテスト・password-reset の文言）。2026-09-16） |  | T-U-01 | L1 |
| SCR-SIGNUP-018 | signup | G-15 信号なし終了 | N/A：外部を呼ばない | 外部を故意に切る | 実行する | 成功扱いにせず、502 と次の一手（人へのハンドオフ） | PASS（API の失敗は文言と一手に落とす（AuthExtError）。黙って成功にしない。2026-09-16） |  | T-U-01 | L1 |
| SCR-SIGNUP-019 | signup | G-16 有限資源 | 消費する資源：DB 接続（プール経由）・メモリ。1 要求あたり 1 接続以下・上限時は待機列 | 同時 50 要求 | 同時に叩く | ログインが落ちない・接続上限に張り付かない（関門 C2 のプール） | PASS（1 要求 1 接続以下（関門 C2 のプール）・ログインの試行は表で数える。実測は L4。2026-09-16） | L4 で負荷試験 | T-U-01 | L1 |
| SCR-SIGNUP-020 | signup | 操作 | ボタン「はじめる」（状態 共通・通常・既に登録済み） | 状態 共通 を作る（全役割） | 押す／入れる（実ブラウザ） | 押すと処理が起き、結果（遷移・DB の変化・表示の変化）が確認できる。押しても何も起きないなら未実装（G-01） | PASS（screens/signup.spec.ts・実 Chrome（本番ビルド／見本は dev）・2026-09-20） | op=button:はじめる | T-U-01 | L1 |
| SCR-SIGNUP-021 | signup | 操作 | 入力欄「メールアドレス」（状態 通常・既に登録済み） | 状態 通常 を作る（全役割） | 押す／入れる（実ブラウザ） | 入力が受け付けられ、送信に載って別 GET で読める（G-01・反映） | PASS（screens/signup.spec.ts・実 Chrome（本番ビルド／見本は dev）・2026-09-20） | op=input:メールアドレス | T-U-01 | L1 |
| SCR-SIGNUP-022 | signup | 操作 | 入力欄「パスワード」（状態 通常・既に登録済み） | 状態 通常 を作る（全役割） | 押す／入れる（実ブラウザ） | 入力が受け付けられ、送信に載って別 GET で読める（G-01・反映） | PASS（screens/signup.spec.ts・実 Chrome（本番ビルド／見本は dev）・2026-09-20） | op=input:パスワード | T-U-01 | L1 |
| SCR-SIGNUP-023 | signup | 操作 | 入力欄「会社名（または屋号）」（状態 通常・既に登録済み） | 状態 通常 を作る（全役割） | 押す／入れる（実ブラウザ） | 入力が受け付けられ、送信に載って別 GET で読める（G-01・反映） | PASS（screens/signup.spec.ts・実 Chrome（本番ビルド／見本は dev）・2026-09-20） | op=input:会社名（または屋号） | T-U-01 | L1 |
| SCR-SIGNUP-024 | signup | 操作 | チェック「利用規約とプライバシーポリシーに同意します」（状態 通常） | 状態 通常 を作る（全役割） | 押す／入れる（実ブラウザ） | 切り替わり、送信に載る | PASS（screens/signup.spec.ts・実 Chrome（本番ビルド／見本は dev）・2026-09-20） | op=checkbox:利用規約とプライバシーポリシーに同意します | T-U-01 | L1 |
| SCR-SIGNUP-025 | signup | 操作 | リンク「ログイン」（状態 通常・既に登録済み） | 状態 通常 を作る（全役割） | 押す／入れる（実ブラウザ） | /login が実在ルートで 200 で開く（G-04） | PASS（screens/signup.spec.ts・実 Chrome（本番ビルド／見本は dev）・2026-09-20） | op=link:ログイン→login | T-U-01 | L1 |
| SCR-SIGNUP-026 | signup | 操作 | エラー文言「このメールアドレスは既に登録されています。ログインするか、入り直すへ。」（状態 既に登録済み） | 状態 既に登録済み を作る（全役割） | その条件を作る | その条件を実際に作ると文言が出て、一手（直す導線）がある。作れないならデッドコード（G-08） | PASS（screens/signup.spec.ts・実 Chrome（本番ビルド／見本は dev）・2026-09-20） | op=error:このメールアドレスは既に登録されています。ログインするか、入り直すへ。 | T-U-01 | L1 |
| SCR-SIGNUP-027 | signup | 操作 | リンク「入り直す」（状態 既に登録済み） | 状態 既に登録済み を作る（全役割） | 押す／入れる（実ブラウザ） | /password-reset が実在ルートで 200 で開く（G-04） | PASS（screens/signup.spec.ts・実 Chrome（本番ビルド／見本は dev）・2026-09-20） | op=link:入り直す→password-reset | T-U-01 | L1 |
| SCR-SIGNUP-028 | signup | 発注者確認 | 手順 07_tasks/handoff/T-U-01.md を発注者が実際に触って OK を出す（Rule 12） | staging か ローカル | 手順どおりに触る | 手順の末尾に「OK: 日付 名前」が書かれる。無い間は BLOCKED（発注者の確認待ち） | BLOCKED（発注者の確認待ち：手順 07_tasks/handoff/T-U-01.md を高本さんが触って OK: を書く。ローカル 3123 で触れる・staging は無い） | Rule 12 | T-U-01 | L1 |
