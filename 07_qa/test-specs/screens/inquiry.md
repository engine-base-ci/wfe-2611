# inquiry テスト仕様（L1・機械生成）

> 05_flow/build_tasks.py がタスクと同時に生成。ID は変えない。途中変更は qa_delta.py で差分。結果列は staging で流した人が書く（再生成しても残る。結果あり 13 行）。

| ID | 画面 | テスト観点 | テスト項目 | 前提条件 | 操作手順 | 期待結果 | 結果 | 備考 | タスク | 実行条件 |
|---|---|---|---|---|---|---|---|---|---|---|
| SCR-INQUIRY-001 | inquiry | 状態 | 状態「問い合わせ」がモックどおりに出る（h1・第2ナビ・列の値がダミー固定でない） | その状態を作る | 画面を開く | モック 06_mockup/v1/v1-inquiry.html の状態 n と一致 |  | G-06・G-07 | T-U-50 | L1 |
| SCR-INQUIRY-002 | inquiry | 状態 | 状態「1 件のやりとり」がモックどおりに出る（h1・第2ナビ・列の値がダミー固定でない） | その状態を作る | 画面を開く | モック 06_mockup/v1/v1-inquiry.html の状態 t と一致 |  | G-06・G-07 | T-U-50 | L1 |
| SCR-INQUIRY-003 | inquiry | 状態 | 状態「新しく聞く」がモックどおりに出る（h1・第2ナビ・列の値がダミー固定でない） | その状態を作る | 画面を開く | モック 06_mockup/v1/v1-inquiry.html の状態 w と一致 |  | G-06・G-07 | T-U-50 | L1 |
| SCR-INQUIRY-004 | inquiry | 状態 | 状態「空」がモックどおりに出る（h1・第2ナビ・列の値がダミー固定でない） | その状態を作る | 画面を開く | モック 06_mockup/v1/v1-inquiry.html の状態 ge と一致 |  | G-06・G-07 | T-U-50 | L1 |
| SCR-INQUIRY-005 | inquiry | 状態 | 状態「AI が止まっている」がモックどおりに出る（h1・第2ナビ・列の値がダミー固定でない） | その状態を作る | 画面を開く | モック 06_mockup/v1/v1-inquiry.html の状態 gs と一致 |  | G-06・G-07 | T-U-50 | L1 |
| SCR-INQUIRY-006 | inquiry | 役割 | 役割 R1 で開くと、その役割の中身（data-roles）が出て、他の役割の中身は出ない | R1 でログイン | 画面を開く | 役割ごとの中身（G15） |  |  | T-U-50 | L1 |
| SCR-INQUIRY-007 | inquiry | 役割 | 役割 R2 で開くと、その役割の中身（data-roles）が出て、他の役割の中身は出ない | R2 でログイン | 画面を開く | 役割ごとの中身（G15） |  |  | T-U-50 | L1 |
| SCR-INQUIRY-008 | inquiry | 役割 | 役割 R3 で開くと、その役割の中身（data-roles）が出て、他の役割の中身は出ない | R3 でログイン | 画面を開く | 役割ごとの中身（G15） |  |  | T-U-50 | L1 |
| SCR-INQUIRY-009 | inquiry | 役割 | 役割 R4 で開くと、その役割の中身（data-roles）が出て、他の役割の中身は出ない | R4 でログイン | 画面を開く | 役割ごとの中身（G15） |  |  | T-U-50 | L1 |
| SCR-INQUIRY-010 | inquiry | 主アクション | 「問い合わせる」を押すと対応する endpoint が呼ばれ、別 GET で再取得した画面に反映される | 権限のある会員 | 押す | DB と画面が変わる（G-01・G-03） |  | GET /api/inquiries | T-U-50 | L1 |
| SCR-INQUIRY-011 | inquiry | 到達性 | リンク先 account が実在ルートで 200 で開く | — | 押す | /account が開く（G-04） | BLOCKED（自動：行き先の画面 account は T-U-44 で実装（未着手）。href は flow の route と機械照合済み・押すと 404 になるので今は押せない） |  | T-U-50 | L1 |
| SCR-INQUIRY-012 | inquiry | 到達性 | リンク先 account-close が実在ルートで 200 で開く | — | 押す | /account-close が開く（G-04） | BLOCKED（自動：行き先の画面 account-close は T-U-40 で実装（未着手）。href は flow の route と機械照合済み・押すと 404 になるので今は押せない） |  | T-U-50 | L1 |
| SCR-INQUIRY-013 | inquiry | 到達性 | リンク先 ai-activity が実在ルートで 200 で開く | — | 押す | /ai-activity が開く（G-04） | BLOCKED（自動：行き先の画面 ai-activity は T-U-18 で実装（未着手）。href は flow の route と機械照合済み・押すと 404 になるので今は押せない） |  | T-U-50 | L1 |
| SCR-INQUIRY-014 | inquiry | 到達性 | リンク先 ai-staff が実在ルートで 200 で開く | — | 押す | /ai-staff が開く（G-04） | BLOCKED（自動：行き先の画面 ai-staff は T-U-36 で実装（未着手）。href は flow の route と機械照合済み・押すと 404 になるので今は押せない） |  | T-U-50 | L1 |
| SCR-INQUIRY-015 | inquiry | 到達性 | リンク先 approvals が実在ルートで 200 で開く | — | 押す | /approvals が開く（G-04） | BLOCKED（自動：行き先の画面 approvals は T-U-14 で実装（未着手）。href は flow の route と機械照合済み・押すと 404 になるので今は押せない） |  | T-U-50 | L1 |
| SCR-INQUIRY-016 | inquiry | 到達性 | リンク先 audit が実在ルートで 200 で開く | — | 押す | /audit が開く（G-04） | BLOCKED（自動：行き先の画面 audit は T-U-33 で実装（未着手）。href は flow の route と機械照合済み・押すと 404 になるので今は押せない） |  | T-U-50 | L1 |
| SCR-INQUIRY-017 | inquiry | 到達性 | リンク先 automation-repair が実在ルートで 200 で開く | — | 押す | /automation-repair が開く（G-04） | BLOCKED（自動：行き先の画面 automation-repair は T-U-32 で実装（未着手）。href は flow の route と機械照合済み・押すと 404 になるので今は押せない） |  | T-U-50 | L1 |
| SCR-INQUIRY-018 | inquiry | 到達性 | リンク先 billing が実在ルートで 200 で開く | — | 押す | /billing が開く（G-04） | BLOCKED（自動：行き先の画面 billing は T-U-52 で実装（未着手）。href は flow の route と機械照合済み・押すと 404 になるので今は押せない） |  | T-U-50 | L1 |
| SCR-INQUIRY-019 | inquiry | 横溢れ | 375・768・1024・1440 で scrollWidth - clientWidth <= 1、1180+ で本文 720 以上 | — | 各幅で開く | 溢れ 0 |  | G-05 | T-U-50 | L1 |
| SCR-INQUIRY-020 | inquiry | 空・止まっている | データ 0 件の状態と AI が止まっている状態が cover 宣言どおりに出る | PS2 / PS4 | 開く | 空状態と止まっている帯 |  | G18 | T-U-50 | L1 |
| SCR-INQUIRY-021 | inquiry | 表記ゆらぎ | 全角／半角：メール・数値・コードを全角で入れる | 入力欄がある状態 | 入力して保存 | 同一として扱われ、サーバー側で正規化されて保存される（クライアント側だけに頼らない） |  | human-grade-qa 第11軸 | T-U-50 | L1 |
| SCR-INQUIRY-022 | inquiry | 表記ゆらぎ | 前後と途中の空白：空白付きで入れる | 入力欄がある状態 | 入力して保存 | 同一として扱われ、サーバー側で正規化されて保存される（クライアント側だけに頼らない） |  | human-grade-qa 第11軸 | T-U-50 | L1 |
| SCR-INQUIRY-023 | inquiry | 表記ゆらぎ | 記号の種別（ハイフン・長音）：‐ ー − を混ぜる | 入力欄がある状態 | 入力して保存 | 同一として扱われ、サーバー側で正規化されて保存される（クライアント側だけに頼らない） |  | human-grade-qa 第11軸 | T-U-50 | L1 |
| SCR-INQUIRY-024 | inquiry | 表記ゆらぎ | Unicode 正規化（NFC/NFD）：macOS の入力（NFD）で入れる | 入力欄がある状態 | 入力して保存 | 同一として扱われ、サーバー側で正規化されて保存される（クライアント側だけに頼らない） |  | human-grade-qa 第11軸 | T-U-50 | L1 |
| SCR-INQUIRY-025 | inquiry | 表記ゆらぎ | 大文字小文字：メールを大文字で入れる | 入力欄がある状態 | 入力して保存 | 同一として扱われ、サーバー側で正規化されて保存される（クライアント側だけに頼らない） |  | human-grade-qa 第11軸 | T-U-50 | L1 |
| SCR-INQUIRY-026 | inquiry | G-11 外部リソースの実在 | N/A：外部リソースを触らない | migration/IaC 適用後 | 起動時の存在確認を読む | 無ければ起動時に落ちる（黙って 502 にならない） |  | 環境ごと | T-U-50 | L1 |
| SCR-INQUIRY-027 | inquiry | G-12 切り替わりの瞬間 | Bridge が切れた直後 0 秒・鮮度窓の内側に操作する | 本番稼働中 | PC を閉じた直後に主アクションを押す | 「AI は止まっています」が出て、押した内容は失われない |  |  | T-U-50 | L1 |
| SCR-INQUIRY-028 | inquiry | G-13 機能の組み合わせ | 実行中 × 切替／中断 × 再開／別ロール同時 の直積のうち該当分 | — | 同時に起こす | 後勝ちでなく、規則どおり（承認は 1 人 1 回・切替は次の実行から） |  | features.json combination_points | T-U-50 | L1 |
| SCR-INQUIRY-029 | inquiry | G-14 口座状態の波及 | 退会・停止・権限変更・パスワード変更の後に、この機能の既存セッション・接続・共有リンクが無効 | ログイン中の別端末と Bridge | 権限を変える | 別端末と Bridge は 0 秒で 401（sessions が revoked） |  |  | T-U-50 | L1 |
| SCR-INQUIRY-030 | inquiry | G-15 信号なし終了 | N/A：外部を呼ばない | 外部を故意に切る | 実行する | 成功扱いにせず、502 と次の一手（人へのハンドオフ） |  |  | T-U-50 | L1 |
| SCR-INQUIRY-031 | inquiry | G-16 有限資源 | 消費する資源：DB 接続（プール経由）・メモリ。1 要求あたり 1 接続以下・上限時は待機列 | 同時 50 要求 | 同時に叩く | ログインが落ちない・接続上限に張り付かない（関門 C2 のプール） |  | L4 で負荷試験 | T-U-50 | L1 |
| SCR-INQUIRY-032 | inquiry | 操作 | ボタン「高本AI」（状態 共通） | 状態 共通 を作る（全役割） | 押す／入れる（実ブラウザ） | 押すと処理が起き、結果（遷移・DB の変化・表示の変化）が確認できる。押しても何も起きないなら未実装（G-01） |  | op=button:高本AI | T-U-50 | L1 |
| SCR-INQUIRY-033 | inquiry | 操作 | リンク「AI は止まっています」（状態 共通） | 状態 共通 を作る（全役割） | 押す／入れる（実ブラウザ） | /automation-repair が実在ルートで 200 で開く（G-04） | BLOCKED（自動：行き先の画面 automation-repair は T-U-32 で実装（未着手）。href は flow の route と機械照合済み・押すと 404 になるので今は押せない） | op=link:AI は止まっています→automation-repair | T-U-50 | L1 |
| SCR-INQUIRY-034 | inquiry | 操作 | リンク「PC をつなぐと話せます」（状態 共通） | 状態 共通 を作る（全役割） | 押す／入れる（実ブラウザ） | /bridge-setup が実在ルートで 200 で開く（G-04） |  | op=link:PC をつなぐと話せます→bridge-setup | T-U-50 | L1 |
| SCR-INQUIRY-035 | inquiry | 操作 | ボタン「問い合わせる」（状態 共通・空） | 状態 共通 を作る（全役割） | 押す／入れる（実ブラウザ） | 押すと処理が起き、結果（遷移・DB の変化・表示の変化）が確認できる。押しても何も起きないなら未実装（G-01） |  | op=button:問い合わせる | T-U-50 | L1 |
| SCR-INQUIRY-036 | inquiry | 操作 | ボタン「新しく聞く」（状態 問い合わせ・AI が止まっている） | 状態 問い合わせ を作る（全役割） | 押す／入れる（実ブラウザ） | 押すと処理が起き、結果（遷移・DB の変化・表示の変化）が確認できる。押しても何も起きないなら未実装（G-01） |  | op=button:新しく聞く | T-U-50 | L1 |
| SCR-INQUIRY-037 | inquiry | 操作 | リンク「覚え直させる」（状態 1 件のやりとり・新しく聞く） | 状態 1 件のやりとり を作る（全役割） | 押す／入れる（実ブラウザ） | /automation-repair が実在ルートで 200 で開く（G-04） | BLOCKED（自動：行き先の画面 automation-repair は T-U-32 で実装（未着手）。href は flow の route と機械照合済み・押すと 404 になるので今は押せない） | op=link:覚え直させる→automation-repair | T-U-50 | L1 |
| SCR-INQUIRY-038 | inquiry | 操作 | リンク「サポートアクセスを許可する」（状態 1 件のやりとり） | 状態 1 件のやりとり を作る（全役割） | 押す／入れる（実ブラウザ） | /audit が実在ルートで 200 で開く（G-04） | BLOCKED（自動：行き先の画面 audit は T-U-33 で実装（未着手）。href は flow の route と機械照合済み・押すと 404 になるので今は押せない） | op=link:サポートアクセスを許可する→audit | T-U-50 | L1 |
| SCR-INQUIRY-039 | inquiry | 操作 | ボタン「解決した」（状態 1 件のやりとり） | 状態 1 件のやりとり を作る（全役割） | 押す／入れる（実ブラウザ） | 押すと処理が起き、結果（遷移・DB の変化・表示の変化）が確認できる。押しても何も起きないなら未実装（G-01） |  | op=button:解決した | T-U-50 | L1 |
| SCR-INQUIRY-040 | inquiry | 操作 | 選択「種類」（状態 新しく聞く） | 状態 新しく聞く を作る（全役割） | 押す／入れる（実ブラウザ） | 切り替わり、送信に載る |  | op=select:種類 | T-U-50 | L1 |
| SCR-INQUIRY-041 | inquiry | 操作 | 入力欄「内容」（状態 新しく聞く） | 状態 新しく聞く を作る（全役割） | 押す／入れる（実ブラウザ） | 入力が受け付けられ、送信に載って別 GET で読める（G-01・反映） |  | op=textarea:内容 | T-U-50 | L1 |
| SCR-INQUIRY-042 | inquiry | 操作 | ボタン「高本AIに聞く（まず）」（状態 新しく聞く） | 状態 新しく聞く を作る（全役割） | 押す／入れる（実ブラウザ） | 押すと処理が起き、結果（遷移・DB の変化・表示の変化）が確認できる。押しても何も起きないなら未実装（G-01） |  | op=button:高本AIに聞く（まず） | T-U-50 | L1 |
| SCR-INQUIRY-043 | inquiry | 操作 | ボタン「運営に送る」（状態 新しく聞く） | 状態 新しく聞く を作る（全役割） | 押す／入れる（実ブラウザ） | 押すと処理が起き、結果（遷移・DB の変化・表示の変化）が確認できる。押しても何も起きないなら未実装（G-01） |  | op=button:運営に送る | T-U-50 | L1 |
| SCR-INQUIRY-044 | inquiry | 操作 | リンク「止まっているものを直す」（状態 AI が止まっている） | 状態 AI が止まっている を作る（全役割） | 押す／入れる（実ブラウザ） | /automation-repair が実在ルートで 200 で開く（G-04） | BLOCKED（自動：行き先の画面 automation-repair は T-U-32 で実装（未着手）。href は flow の route と機械照合済み・押すと 404 になるので今は押せない） | op=link:止まっているものを直す→automation-repair | T-U-50 | L1 |
| SCR-INQUIRY-045 | inquiry | 発注者確認 | 手順 07_tasks/handoff/T-U-50.md を発注者が実際に触って OK を出す（Rule 12） | staging か ローカル | 手順どおりに触る | 手順の末尾に「OK: 日付 名前」が書かれる。無い間は BLOCKED（発注者の確認待ち） | BLOCKED（発注者の確認待ち：手順 07_tasks/handoff/T-U-50.md を高本さんが触って OK: を書く。ローカル 3123 で触れる・staging は無い） | Rule 12 | T-U-50 | L1 |
