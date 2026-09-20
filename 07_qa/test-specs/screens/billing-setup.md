# billing-setup テスト仕様（L1・機械生成）

> 05_flow/build_tasks.py がタスクと同時に生成。ID は変えない。途中変更は qa_delta.py で差分。結果列は staging で流した人が書く（再生成しても残る。結果あり 1 行）。

| ID | 画面 | テスト観点 | テスト項目 | 前提条件 | 操作手順 | 期待結果 | 結果 | 備考 | タスク | 実行条件 |
|---|---|---|---|---|---|---|---|---|---|---|
| SCR-BILLING-SETUP-001 | billing-setup | 状態 | 状態「登録」がモックどおりに出る（h1・第2ナビ・列の値がダミー固定でない） | その状態を作る | 画面を開く | モック 06_mockup/v2/v2-billing-setup.html の状態 n と一致 |  | G-06・G-07 | T-U-59 | L1 |
| SCR-BILLING-SETUP-002 | billing-setup | 状態 | 状態「登録できた」がモックどおりに出る（h1・第2ナビ・列の値がダミー固定でない） | その状態を作る | 画面を開く | モック 06_mockup/v2/v2-billing-setup.html の状態 ok と一致 |  | G-06・G-07 | T-U-59 | L1 |
| SCR-BILLING-SETUP-003 | billing-setup | 状態 | 状態「カードが拒否された」がモックどおりに出る（h1・第2ナビ・列の値がダミー固定でない） | その状態を作る | 画面を開く | モック 06_mockup/v2/v2-billing-setup.html の状態 x と一致 |  | G-06・G-07 | T-U-59 | L1 |
| SCR-BILLING-SETUP-004 | billing-setup | 状態 | 状態「請求書払い」がモックどおりに出る（h1・第2ナビ・列の値がダミー固定でない） | その状態を作る | 画面を開く | モック 06_mockup/v2/v2-billing-setup.html の状態 i と一致 |  | G-06・G-07 | T-U-59 | L1 |
| SCR-BILLING-SETUP-005 | billing-setup | 役割 | 役割 R1 で開くと、その役割の中身（data-roles）が出て、他の役割の中身は出ない | R1 でログイン | 画面を開く | 役割ごとの中身（G15） |  |  | T-U-59 | L1 |
| SCR-BILLING-SETUP-006 | billing-setup | 役割 | 役割 R2 で開くと、その役割の中身（data-roles）が出て、他の役割の中身は出ない | R2 でログイン | 画面を開く | 役割ごとの中身（G15） |  |  | T-U-59 | L1 |
| SCR-BILLING-SETUP-007 | billing-setup | 主アクション | 「登録する」を押すと対応する endpoint が呼ばれ、別 GET で再取得した画面に反映される | 権限のある会員 | 押す | DB と画面が変わる（G-01・G-03） |  | POST /api/subscriptions | T-U-59 | L1 |
| SCR-BILLING-SETUP-008 | billing-setup | 横溢れ | 375・768・1024・1440 で scrollWidth - clientWidth <= 1、1180+ で本文 720 以上 | — | 各幅で開く | 溢れ 0 |  | G-05 | T-U-59 | L1 |
| SCR-BILLING-SETUP-009 | billing-setup | 空・止まっている | データ 0 件の状態と AI が止まっている状態が cover 宣言どおりに出る | PS2 / PS4 | 開く | 空状態と止まっている帯 |  | G18 | T-U-59 | L1 |
| SCR-BILLING-SETUP-010 | billing-setup | 表記ゆらぎ | 全角／半角：メール・数値・コードを全角で入れる | 入力欄がある状態 | 入力して保存 | 同一として扱われ、サーバー側で正規化されて保存される（クライアント側だけに頼らない） |  | human-grade-qa 第11軸 | T-U-59 | L1 |
| SCR-BILLING-SETUP-011 | billing-setup | 表記ゆらぎ | 前後と途中の空白：空白付きで入れる | 入力欄がある状態 | 入力して保存 | 同一として扱われ、サーバー側で正規化されて保存される（クライアント側だけに頼らない） |  | human-grade-qa 第11軸 | T-U-59 | L1 |
| SCR-BILLING-SETUP-012 | billing-setup | 表記ゆらぎ | 記号の種別（ハイフン・長音）：‐ ー − を混ぜる | 入力欄がある状態 | 入力して保存 | 同一として扱われ、サーバー側で正規化されて保存される（クライアント側だけに頼らない） |  | human-grade-qa 第11軸 | T-U-59 | L1 |
| SCR-BILLING-SETUP-013 | billing-setup | 表記ゆらぎ | Unicode 正規化（NFC/NFD）：macOS の入力（NFD）で入れる | 入力欄がある状態 | 入力して保存 | 同一として扱われ、サーバー側で正規化されて保存される（クライアント側だけに頼らない） |  | human-grade-qa 第11軸 | T-U-59 | L1 |
| SCR-BILLING-SETUP-014 | billing-setup | 表記ゆらぎ | 大文字小文字：メールを大文字で入れる | 入力欄がある状態 | 入力して保存 | 同一として扱われ、サーバー側で正規化されて保存される（クライアント側だけに頼らない） |  | human-grade-qa 第11軸 | T-U-59 | L1 |
| SCR-BILLING-SETUP-015 | billing-setup | G-11 外部リソースの実在 | N/A：外部リソースを触らない | migration/IaC 適用後 | 起動時の存在確認を読む | 無ければ起動時に落ちる（黙って 502 にならない） |  | 環境ごと | T-U-59 | L1 |
| SCR-BILLING-SETUP-016 | billing-setup | G-12 切り替わりの瞬間 | Bridge が切れた直後 0 秒・鮮度窓の内側に操作する | 本番稼働中 | PC を閉じた直後に主アクションを押す | 「AI は止まっています」が出て、押した内容は失われない |  |  | T-U-59 | L1 |
| SCR-BILLING-SETUP-017 | billing-setup | G-13 機能の組み合わせ | 実行中 × 切替／中断 × 再開／別ロール同時 の直積のうち該当分 | — | 同時に起こす | 後勝ちでなく、規則どおり（承認は 1 人 1 回・切替は次の実行から） |  | features.json combination_points | T-U-59 | L1 |
| SCR-BILLING-SETUP-018 | billing-setup | G-14 口座状態の波及 | 退会・停止・権限変更・パスワード変更の後に、この機能の既存セッション・接続・共有リンクが無効 | ログイン中の別端末と Bridge | 権限を変える | 別端末と Bridge は 0 秒で 401（sessions が revoked） |  |  | T-U-59 | L1 |
| SCR-BILLING-SETUP-019 | billing-setup | G-15 信号なし終了 | N/A：外部を呼ばない | 外部を故意に切る | 実行する | 成功扱いにせず、502 と次の一手（人へのハンドオフ） |  |  | T-U-59 | L1 |
| SCR-BILLING-SETUP-020 | billing-setup | G-16 有限資源 | 消費する資源：DB 接続（プール経由）・メモリ。1 要求あたり 1 接続以下・上限時は待機列 | 同時 50 要求 | 同時に叩く | ログインが落ちない・接続上限に張り付かない（関門 C2 のプール） |  | L4 で負荷試験 | T-U-59 | L1 |
| SCR-BILLING-SETUP-021 | billing-setup | 操作 | ボタン「登録する」（状態 共通） | 状態 共通 を作る（全役割） | 押す／入れる（実ブラウザ） | 押すと処理が起き、結果（遷移・DB の変化・表示の変化）が確認できる。押しても何も起きないなら未実装（G-01） |  | op=button:登録する | T-U-59 | L1 |
| SCR-BILLING-SETUP-022 | billing-setup | 操作 | 選択肢「エントリー · 30,000 円／月一人社長・個人事業。税込。上限は「プランと請求」で見られます」（状態 登録） | 状態 登録 を作る（全役割） | 押す／入れる（実ブラウザ） | 切り替わり、送信に載る |  | op=radio:エントリー · 30,000 円／月一人社長・個人事業。税込。上限は「プランと請求」で見られます | T-U-59 | L1 |
| SCR-BILLING-SETUP-023 | billing-setup | 操作 | 選択肢「スタンダード · 80,000 円／月中小・ベンチャー。税込。上限は「プランと請求」で見られます」（状態 登録） | 状態 登録 を作る（全役割） | 押す／入れる（実ブラウザ） | 切り替わり、送信に載る |  | op=radio:スタンダード · 80,000 円／月中小・ベンチャー。税込。上限は「プランと請求」で見られます | T-U-59 | L1 |
| SCR-BILLING-SETUP-024 | billing-setup | 操作 | 選択肢「プロ · 150,000 円／月中堅。税込。上限は「プランと請求」で見られます」（状態 登録） | 状態 登録 を作る（全役割） | 押す／入れる（実ブラウザ） | 切り替わり、送信に載る |  | op=radio:プロ · 150,000 円／月中堅。税込。上限は「プランと請求」で見られます | T-U-59 | L1 |
| SCR-BILLING-SETUP-025 | billing-setup | 操作 | 選択肢「カード（Stripe）Stripe の画面で登録。番号は Kaname を通らない」（状態 登録） | 状態 登録 を作る（全役割） | 押す／入れる（実ブラウザ） | 切り替わり、送信に載る |  | op=radio:カード（Stripe）Stripe の画面で登録。番号は Kaname を通らない | T-U-59 | L1 |
| SCR-BILLING-SETUP-026 | billing-setup | 操作 | 選択肢「請求書払い毎月の請求書を受け取り、振込で払う。運営が入金を記録」（状態 登録） | 状態 登録 を作る（全役割） | 押す／入れる（実ブラウザ） | 切り替わり、送信に載る |  | op=radio:請求書払い毎月の請求書を受け取り、振込で払う。運営が入金を記録 | T-U-59 | L1 |
| SCR-BILLING-SETUP-027 | billing-setup | 操作 | ボタン「Stripe で登録する」（状態 登録） | 状態 登録 を作る（全役割） | 押す／入れる（実ブラウザ） | 押すと処理が起き、結果（遷移・DB の変化・表示の変化）が確認できる。押しても何も起きないなら未実装（G-01） |  | op=button:Stripe で登録する | T-U-59 | L1 |
| SCR-BILLING-SETUP-028 | billing-setup | 操作 | リンク「PC をつなぐへ進む」（状態 登録できた・請求書払い） | 状態 登録できた を作る（全役割） | 押す／入れる（実ブラウザ） | /bridge-setup が実在ルートで 200 で開く（G-04） |  | op=link:PC をつなぐへ進む→bridge-setup | T-U-59 | L1 |
| SCR-BILLING-SETUP-029 | billing-setup | 操作 | ボタン「別のカードで登録する」（状態 カードが拒否された） | 状態 カードが拒否された を作る（全役割） | 押す／入れる（実ブラウザ） | 押すと処理が起き、結果（遷移・DB の変化・表示の変化）が確認できる。押しても何も起きないなら未実装（G-01） |  | op=button:別のカードで登録する | T-U-59 | L1 |
| SCR-BILLING-SETUP-030 | billing-setup | 操作 | ボタン「請求書払いにする」（状態 カードが拒否された） | 状態 カードが拒否された を作る（全役割） | 押す／入れる（実ブラウザ） | 押すと処理が起き、結果（遷移・DB の変化・表示の変化）が確認できる。押しても何も起きないなら未実装（G-01） |  | op=button:請求書払いにする | T-U-59 | L1 |
| SCR-BILLING-SETUP-031 | billing-setup | 発注者確認 | 手順 07_tasks/handoff/T-U-59.md を発注者が実際に触って OK を出す（Rule 12） | staging か ローカル | 手順どおりに触る | 手順の末尾に「OK: 日付 名前」が書かれる。無い間は BLOCKED（発注者の確認待ち） | BLOCKED（発注者の確認待ち：手順 07_tasks/handoff/T-U-59.md を高本さんが触って OK: を書く。ローカル 3123 で触れる・staging は無い） | Rule 12 | T-U-59 | L1 |
