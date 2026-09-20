# member-detail テスト仕様（L1・機械生成）

> 05_flow/build_tasks.py がタスクと同時に生成。ID は変えない。途中変更は qa_delta.py で差分。結果列は staging で流した人が書く（再生成しても残る。結果あり 13 行）。

| ID | 画面 | テスト観点 | テスト項目 | 前提条件 | 操作手順 | 期待結果 | 結果 | 備考 | タスク | 実行条件 |
|---|---|---|---|---|---|---|---|---|---|---|
| SCR-MEMBER-DETAIL-001 | member-detail | 状態 | 状態「佐藤 健」がモックどおりに出る（h1・第2ナビ・列の値がダミー固定でない） | その状態を作る | 画面を開く | モック 06_mockup/v1/v1-member-detail.html の状態 n と一致 |  | G-06・G-07 | T-U-58 | L1 |
| SCR-MEMBER-DETAIL-002 | member-detail | 状態 | 状態「権限を変えるとき」がモックどおりに出る（h1・第2ナビ・列の値がダミー固定でない） | その状態を作る | 画面を開く | モック 06_mockup/v1/v1-member-detail.html の状態 c と一致 |  | G-06・G-07 | T-U-58 | L1 |
| SCR-MEMBER-DETAIL-003 | member-detail | 状態 | 状態「抜ける」がモックどおりに出る（h1・第2ナビ・列の値がダミー固定でない） | その状態を作る | 画面を開く | モック 06_mockup/v1/v1-member-detail.html の状態 o と一致 |  | G-06・G-07 | T-U-58 | L1 |
| SCR-MEMBER-DETAIL-004 | member-detail | 状態 | 状態「AI が止まっている」がモックどおりに出る（h1・第2ナビ・列の値がダミー固定でない） | その状態を作る | 画面を開く | モック 06_mockup/v1/v1-member-detail.html の状態 gs と一致 |  | G-06・G-07 | T-U-58 | L1 |
| SCR-MEMBER-DETAIL-005 | member-detail | 役割 | 役割 R1 で開くと、その役割の中身（data-roles）が出て、他の役割の中身は出ない | R1 でログイン | 画面を開く | 役割ごとの中身（G15） |  |  | T-U-58 | L1 |
| SCR-MEMBER-DETAIL-006 | member-detail | 役割 | 役割 R2 で開くと、その役割の中身（data-roles）が出て、他の役割の中身は出ない | R2 でログイン | 画面を開く | 役割ごとの中身（G15） |  |  | T-U-58 | L1 |
| SCR-MEMBER-DETAIL-007 | member-detail | 主アクション | 「保存する」を押すと対応する endpoint が呼ばれ、別 GET で再取得した画面に反映される | 権限のある会員 | 押す | DB と画面が変わる（G-01・G-03） |  | PATCH /api/members/:id DELETE /api/members/:id | T-U-58 | L1 |
| SCR-MEMBER-DETAIL-008 | member-detail | 到達性 | リンク先 account が実在ルートで 200 で開く | — | 押す | /account が開く（G-04） | BLOCKED（自動：行き先の画面 account は T-U-44 で実装（未着手）。href は flow の route と機械照合済み・押すと 404 になるので今は押せない） |  | T-U-58 | L1 |
| SCR-MEMBER-DETAIL-009 | member-detail | 到達性 | リンク先 account-close が実在ルートで 200 で開く | — | 押す | /account-close が開く（G-04） | BLOCKED（自動：行き先の画面 account-close は T-U-40 で実装（未着手）。href は flow の route と機械照合済み・押すと 404 になるので今は押せない） |  | T-U-58 | L1 |
| SCR-MEMBER-DETAIL-010 | member-detail | 到達性 | リンク先 ai-activity が実在ルートで 200 で開く | — | 押す | /ai-activity が開く（G-04） | BLOCKED（自動：行き先の画面 ai-activity は T-U-18 で実装（未着手）。href は flow の route と機械照合済み・押すと 404 になるので今は押せない） |  | T-U-58 | L1 |
| SCR-MEMBER-DETAIL-011 | member-detail | 到達性 | リンク先 ai-staff が実在ルートで 200 で開く | — | 押す | /ai-staff が開く（G-04） | BLOCKED（自動：行き先の画面 ai-staff は T-U-36 で実装（未着手）。href は flow の route と機械照合済み・押すと 404 になるので今は押せない） |  | T-U-58 | L1 |
| SCR-MEMBER-DETAIL-012 | member-detail | 到達性 | リンク先 approvals が実在ルートで 200 で開く | — | 押す | /approvals が開く（G-04） | BLOCKED（自動：行き先の画面 approvals は T-U-14 で実装（未着手）。href は flow の route と機械照合済み・押すと 404 になるので今は押せない） |  | T-U-58 | L1 |
| SCR-MEMBER-DETAIL-013 | member-detail | 到達性 | リンク先 audit が実在ルートで 200 で開く | — | 押す | /audit が開く（G-04） | BLOCKED（自動：行き先の画面 audit は T-U-33 で実装（未着手）。href は flow の route と機械照合済み・押すと 404 になるので今は押せない） |  | T-U-58 | L1 |
| SCR-MEMBER-DETAIL-014 | member-detail | 到達性 | リンク先 automation-repair が実在ルートで 200 で開く | — | 押す | /automation-repair が開く（G-04） | BLOCKED（自動：行き先の画面 automation-repair は T-U-32 で実装（未着手）。href は flow の route と機械照合済み・押すと 404 になるので今は押せない） |  | T-U-58 | L1 |
| SCR-MEMBER-DETAIL-015 | member-detail | 到達性 | リンク先 billing が実在ルートで 200 で開く | — | 押す | /billing が開く（G-04） | BLOCKED（自動：行き先の画面 billing は T-U-52 で実装（未着手）。href は flow の route と機械照合済み・押すと 404 になるので今は押せない） |  | T-U-58 | L1 |
| SCR-MEMBER-DETAIL-016 | member-detail | 横溢れ | 375・768・1024・1440 で scrollWidth - clientWidth <= 1、1180+ で本文 720 以上 | — | 各幅で開く | 溢れ 0 |  | G-05 | T-U-58 | L1 |
| SCR-MEMBER-DETAIL-017 | member-detail | 空・止まっている | データ 0 件の状態と AI が止まっている状態が cover 宣言どおりに出る | PS2 / PS4 | 開く | 空状態と止まっている帯 |  | G18 | T-U-58 | L1 |
| SCR-MEMBER-DETAIL-018 | member-detail | 表記ゆらぎ | 全角／半角：メール・数値・コードを全角で入れる | 入力欄がある状態 | 入力して保存 | 同一として扱われ、サーバー側で正規化されて保存される（クライアント側だけに頼らない） |  | human-grade-qa 第11軸 | T-U-58 | L1 |
| SCR-MEMBER-DETAIL-019 | member-detail | 表記ゆらぎ | 前後と途中の空白：空白付きで入れる | 入力欄がある状態 | 入力して保存 | 同一として扱われ、サーバー側で正規化されて保存される（クライアント側だけに頼らない） |  | human-grade-qa 第11軸 | T-U-58 | L1 |
| SCR-MEMBER-DETAIL-020 | member-detail | 表記ゆらぎ | 記号の種別（ハイフン・長音）：‐ ー − を混ぜる | 入力欄がある状態 | 入力して保存 | 同一として扱われ、サーバー側で正規化されて保存される（クライアント側だけに頼らない） |  | human-grade-qa 第11軸 | T-U-58 | L1 |
| SCR-MEMBER-DETAIL-021 | member-detail | 表記ゆらぎ | Unicode 正規化（NFC/NFD）：macOS の入力（NFD）で入れる | 入力欄がある状態 | 入力して保存 | 同一として扱われ、サーバー側で正規化されて保存される（クライアント側だけに頼らない） |  | human-grade-qa 第11軸 | T-U-58 | L1 |
| SCR-MEMBER-DETAIL-022 | member-detail | 表記ゆらぎ | 大文字小文字：メールを大文字で入れる | 入力欄がある状態 | 入力して保存 | 同一として扱われ、サーバー側で正規化されて保存される（クライアント側だけに頼らない） |  | human-grade-qa 第11軸 | T-U-58 | L1 |
| SCR-MEMBER-DETAIL-023 | member-detail | G-11 外部リソースの実在 | N/A：外部リソースを触らない | migration/IaC 適用後 | 起動時の存在確認を読む | 無ければ起動時に落ちる（黙って 502 にならない） |  | 環境ごと | T-U-58 | L1 |
| SCR-MEMBER-DETAIL-024 | member-detail | G-12 切り替わりの瞬間 | Bridge が切れた直後 0 秒・鮮度窓の内側に操作する | 本番稼働中 | PC を閉じた直後に主アクションを押す | 「AI は止まっています」が出て、押した内容は失われない |  |  | T-U-58 | L1 |
| SCR-MEMBER-DETAIL-025 | member-detail | G-13 機能の組み合わせ | 実行中 × 切替／中断 × 再開／別ロール同時 の直積のうち該当分 | — | 同時に起こす | 後勝ちでなく、規則どおり（承認は 1 人 1 回・切替は次の実行から） |  | features.json combination_points | T-U-58 | L1 |
| SCR-MEMBER-DETAIL-026 | member-detail | G-14 口座状態の波及 | 退会・停止・権限変更・パスワード変更の後に、この機能の既存セッション・接続・共有リンクが無効 | ログイン中の別端末と Bridge | 権限を変える | 別端末と Bridge は 0 秒で 401（sessions が revoked） |  |  | T-U-58 | L1 |
| SCR-MEMBER-DETAIL-027 | member-detail | G-15 信号なし終了 | N/A：外部を呼ばない | 外部を故意に切る | 実行する | 成功扱いにせず、502 と次の一手（人へのハンドオフ） |  |  | T-U-58 | L1 |
| SCR-MEMBER-DETAIL-028 | member-detail | G-16 有限資源 | 消費する資源：DB 接続（プール経由）・メモリ。1 要求あたり 1 接続以下・上限時は待機列 | 同時 50 要求 | 同時に叩く | ログインが落ちない・接続上限に張り付かない（関門 C2 のプール） |  | L4 で負荷試験 | T-U-58 | L1 |
| SCR-MEMBER-DETAIL-029 | member-detail | 操作 | ボタン「高本AI」（状態 共通） | 状態 共通 を作る（全役割） | 押す／入れる（実ブラウザ） | 押すと処理が起き、結果（遷移・DB の変化・表示の変化）が確認できる。押しても何も起きないなら未実装（G-01） |  | op=button:高本AI | T-U-58 | L1 |
| SCR-MEMBER-DETAIL-030 | member-detail | 操作 | リンク「AI は止まっています」（状態 共通） | 状態 共通 を作る（全役割） | 押す／入れる（実ブラウザ） | /automation-repair が実在ルートで 200 で開く（G-04） | BLOCKED（自動：行き先の画面 automation-repair は T-U-32 で実装（未着手）。href は flow の route と機械照合済み・押すと 404 になるので今は押せない） | op=link:AI は止まっています→automation-repair | T-U-58 | L1 |
| SCR-MEMBER-DETAIL-031 | member-detail | 操作 | リンク「PC をつなぐと話せます」（状態 共通） | 状態 共通 を作る（全役割） | 押す／入れる（実ブラウザ） | /bridge-setup が実在ルートで 200 で開く（G-04） |  | op=link:PC をつなぐと話せます→bridge-setup | T-U-58 | L1 |
| SCR-MEMBER-DETAIL-032 | member-detail | 操作 | ボタン「保存する」（状態 共通・佐藤 健・AI が止まっている） | 状態 共通 を作る（全役割） | 押す／入れる（実ブラウザ） | 押すと処理が起き、結果（遷移・DB の変化・表示の変化）が確認できる。押しても何も起きないなら未実装（G-01） |  | op=button:保存する | T-U-58 | L1 |
| SCR-MEMBER-DETAIL-033 | member-detail | 操作 | ボタン「範囲を変える」（状態 佐藤 健・AI が止まっている） | 状態 佐藤 健 を作る（全役割） | 押す／入れる（実ブラウザ） | 押すと処理が起き、結果（遷移・DB の変化・表示の変化）が確認できる。押しても何も起きないなら未実装（G-01） |  | op=button:範囲を変える | T-U-58 | L1 |
| SCR-MEMBER-DETAIL-034 | member-detail | 操作 | ボタン「無効にする」（状態 佐藤 健・AI が止まっている） | 状態 佐藤 健 を作る（全役割） | 押す／入れる（実ブラウザ） | 押すと処理が起き、結果（遷移・DB の変化・表示の変化）が確認できる。押しても何も起きないなら未実装（G-01） |  | op=button:無効にする | T-U-58 | L1 |
| SCR-MEMBER-DETAIL-035 | member-detail | 操作 | 選択「制作の長（制作の 直す・配る・承認 が付く）」（状態 佐藤 健・AI が止まっている） | 状態 佐藤 健 を作る（全役割） | 押す／入れる（実ブラウザ） | 切り替わり、送信に載る |  | op=select:制作の長（制作の 直す・配る・承認 が付く） | T-U-58 | L1 |
| SCR-MEMBER-DETAIL-036 | member-detail | 操作 | チェック「制作の長（制作の 直す・配る・承認 が付く）」（状態 佐藤 健・AI が止まっている） | 状態 佐藤 健 を作る（全役割） | 押す／入れる（実ブラウザ） | 切り替わり、送信に載る |  | op=checkbox:制作の長（制作の 直す・配る・承認 が付く） | T-U-58 | L1 |
| SCR-MEMBER-DETAIL-037 | member-detail | 操作 | ボタン「制作」（状態 佐藤 健・AI が止まっている） | 状態 佐藤 健 を作る（全役割） | 押す／入れる（実ブラウザ） | 押すと処理が起き、結果（遷移・DB の変化・表示の変化）が確認できる。押しても何も起きないなら未実装（G-01） |  | op=button:制作 | T-U-58 | L1 |
| SCR-MEMBER-DETAIL-038 | member-detail | 操作 | ボタン「会社」（状態 佐藤 健・AI が止まっている） | 状態 佐藤 健 を作る（全役割） | 押す／入れる（実ブラウザ） | 押すと処理が起き、結果（遷移・DB の変化・表示の変化）が確認できる。押しても何も起きないなら未実装（G-01） |  | op=button:会社 | T-U-58 | L1 |
| SCR-MEMBER-DETAIL-039 | member-detail | 操作 | ボタン「制作 → 人」（状態 佐藤 健・AI が止まっている） | 状態 佐藤 健 を作る（全役割） | 押す／入れる（実ブラウザ） | 押すと処理が起き、結果（遷移・DB の変化・表示の変化）が確認できる。押しても何も起きないなら未実装（G-01） |  | op=button:制作 → 人 | T-U-58 | L1 |
| SCR-MEMBER-DETAIL-040 | member-detail | 操作 | ボタン「制作の配分」（状態 佐藤 健・AI が止まっている） | 状態 佐藤 健 を作る（全役割） | 押す／入れる（実ブラウザ） | 押すと処理が起き、結果（遷移・DB の変化・表示の変化）が確認できる。押しても何も起きないなら未実装（G-01） |  | op=button:制作の配分 | T-U-58 | L1 |
| SCR-MEMBER-DETAIL-041 | member-detail | 操作 | ボタン「制作のAI社員へ」（状態 佐藤 健・AI が止まっている） | 状態 佐藤 健 を作る（全役割） | 押す／入れる（実ブラウザ） | 押すと処理が起き、結果（遷移・DB の変化・表示の変化）が確認できる。押しても何も起きないなら未実装（G-01） |  | op=button:制作のAI社員へ | T-U-58 | L1 |
| SCR-MEMBER-DETAIL-042 | member-detail | 操作 | ボタン「制作の変更」（状態 佐藤 健・AI が止まっている） | 状態 佐藤 健 を作る（全役割） | 押す／入れる（実ブラウザ） | 押すと処理が起き、結果（遷移・DB の変化・表示の変化）が確認できる。押しても何も起きないなら未実装（G-01） |  | op=button:制作の変更 | T-U-58 | L1 |
| SCR-MEMBER-DETAIL-043 | member-detail | 操作 | ボタン「制作 → 人に託す」（状態 佐藤 健・AI が止まっている） | 状態 佐藤 健 を作る（全役割） | 押す／入れる（実ブラウザ） | 押すと処理が起き、結果（遷移・DB の変化・表示の変化）が確認できる。押しても何も起きないなら未実装（G-01） |  | op=button:制作 → 人に託す | T-U-58 | L1 |
| SCR-MEMBER-DETAIL-044 | member-detail | 操作 | ボタン「制作のAI社員の外向き」（状態 佐藤 健・AI が止まっている） | 状態 佐藤 健 を作る（全役割） | 押す／入れる（実ブラウザ） | 押すと処理が起き、結果（遷移・DB の変化・表示の変化）が確認できる。押しても何も起きないなら未実装（G-01） |  | op=button:制作のAI社員の外向き | T-U-58 | L1 |
| SCR-MEMBER-DETAIL-045 | member-detail | 操作 | ボタン「制作の確認待ち」（状態 佐藤 健・AI が止まっている） | 状態 佐藤 健 を作る（全役割） | 押す／入れる（実ブラウザ） | 押すと処理が起き、結果（遷移・DB の変化・表示の変化）が確認できる。押しても何も起きないなら未実装（G-01） |  | op=button:制作の確認待ち | T-U-58 | L1 |
| SCR-MEMBER-DETAIL-046 | member-detail | 操作 | ボタン「既定に戻す」（状態 佐藤 健・AI が止まっている） | 状態 佐藤 健 を作る（全役割） | 押す／入れる（実ブラウザ） | 押すと処理が起き、結果（遷移・DB の変化・表示の変化）が確認できる。押しても何も起きないなら未実装（G-01） |  | op=button:既定に戻す | T-U-58 | L1 |
| SCR-MEMBER-DETAIL-047 | member-detail | 操作 | リンク「AI社員を託す」（状態 佐藤 健・AI が止まっている） | 状態 佐藤 健 を作る（全役割） | 押す／入れる（実ブラウザ） | /ai-staff が実在ルートで 200 で開く（G-04） | BLOCKED（自動：行き先の画面 ai-staff は T-U-36 で実装（未着手）。href は flow の route と機械照合済み・押すと 404 になるので今は押せない） | op=link:AI社員を託す→ai-staff | T-U-58 | L1 |
| SCR-MEMBER-DETAIL-048 | member-detail | 操作 | ボタン「全部切る」（状態 佐藤 健・AI が止まっている） | 状態 佐藤 健 を作る（全役割） | 押す／入れる（実ブラウザ） | 押すと処理が起き、結果（遷移・DB の変化・表示の変化）が確認できる。押しても何も起きないなら未実装（G-01） |  | op=button:全部切る | T-U-58 | L1 |
| SCR-MEMBER-DETAIL-049 | member-detail | 操作 | ボタン「切る」（状態 佐藤 健・AI が止まっている） | 状態 佐藤 健 を作る（全役割） | 押す／入れる（実ブラウザ） | 押すと処理が起き、結果（遷移・DB の変化・表示の変化）が確認できる。押しても何も起きないなら未実装（G-01） |  | op=button:切る | T-U-58 | L1 |
| SCR-MEMBER-DETAIL-050 | member-detail | 操作 | ボタン「権限の表に戻る」（状態 権限を変えるとき） | 状態 権限を変えるとき を作る（全役割） | 押す／入れる（実ブラウザ） | 押すと処理が起き、結果（遷移・DB の変化・表示の変化）が確認できる。押しても何も起きないなら未実装（G-01） |  | op=button:権限の表に戻る | T-U-58 | L1 |
| SCR-MEMBER-DETAIL-051 | member-detail | 操作 | ボタン「この案で」（状態 抜ける） | 状態 抜ける を作る（全役割） | 押す／入れる（実ブラウザ） | 押すと処理が起き、結果（遷移・DB の変化・表示の変化）が確認できる。押しても何も起きないなら未実装（G-01） |  | op=button:この案で | T-U-58 | L1 |
| SCR-MEMBER-DETAIL-052 | member-detail | 操作 | ボタン「自分で選ぶ」（状態 抜ける） | 状態 抜ける を作る（全役割） | 押す／入れる（実ブラウザ） | 押すと処理が起き、結果（遷移・DB の変化・表示の変化）が確認できる。押しても何も起きないなら未実装（G-01） |  | op=button:自分で選ぶ | T-U-58 | L1 |
| SCR-MEMBER-DETAIL-053 | member-detail | 操作 | ボタン「高本にする」（状態 抜ける） | 状態 抜ける を作る（全役割） | 押す／入れる（実ブラウザ） | 押すと処理が起き、結果（遷移・DB の変化・表示の変化）が確認できる。押しても何も起きないなら未実装（G-01） |  | op=button:高本にする | T-U-58 | L1 |
| SCR-MEMBER-DETAIL-054 | member-detail | 操作 | リンク「配り直す」（状態 抜ける） | 状態 抜ける を作る（全役割） | 押す／入れる（実ブラウザ） | /goal-allocation が実在ルートで 200 で開く（G-04） | BLOCKED（自動：行き先の画面 goal-allocation は T-U-23 で実装（未着手）。href は flow の route と機械照合済み・押すと 404 になるので今は押せない） | op=link:配り直す→goal-allocation | T-U-58 | L1 |
| SCR-MEMBER-DETAIL-055 | member-detail | 操作 | ボタン「会社に移す」（状態 抜ける） | 状態 抜ける を作る（全役割） | 押す／入れる（実ブラウザ） | 押すと処理が起き、結果（遷移・DB の変化・表示の変化）が確認できる。押しても何も起きないなら未実装（G-01） |  | op=button:会社に移す | T-U-58 | L1 |
| SCR-MEMBER-DETAIL-056 | member-detail | 操作 | ボタン「消す」（状態 抜ける） | 状態 抜ける を作る（全役割） | 押す／入れる（実ブラウザ） | 押すと処理が起き、結果（遷移・DB の変化・表示の変化）が確認できる。押しても何も起きないなら未実装（G-01） |  | op=button:消す | T-U-58 | L1 |
| SCR-MEMBER-DETAIL-057 | member-detail | 操作 | ボタン「高本へ移管」（状態 抜ける） | 状態 抜ける を作る（全役割） | 押す／入れる（実ブラウザ） | 押すと処理が起き、結果（遷移・DB の変化・表示の変化）が確認できる。押しても何も起きないなら未実装（G-01） |  | op=button:高本へ移管 | T-U-58 | L1 |
| SCR-MEMBER-DETAIL-058 | member-detail | 操作 | ボタン「無効にする（引き継ぎ 3／7 決定）」（状態 抜ける） | 状態 抜ける を作る（全役割） | 押す／入れる（実ブラウザ） | 押すと処理が起き、結果（遷移・DB の変化・表示の変化）が確認できる。押しても何も起きないなら未実装（G-01） |  | op=button:無効にする（引き継ぎ 3／7 決定） | T-U-58 | L1 |
| SCR-MEMBER-DETAIL-059 | member-detail | 操作 | ボタン「佐藤AIの案を全部採る」（状態 抜ける） | 状態 抜ける を作る（全役割） | 押す／入れる（実ブラウザ） | 押すと処理が起き、結果（遷移・DB の変化・表示の変化）が確認できる。押しても何も起きないなら未実装（G-01） |  | op=button:佐藤AIの案を全部採る | T-U-58 | L1 |
| SCR-MEMBER-DETAIL-060 | member-detail | 操作 | ボタン「やめる」（状態 抜ける） | 状態 抜ける を作る（全役割） | 押す／入れる（実ブラウザ） | 押すと処理が起き、結果（遷移・DB の変化・表示の変化）が確認できる。押しても何も起きないなら未実装（G-01） |  | op=button:やめる | T-U-58 | L1 |
| SCR-MEMBER-DETAIL-061 | member-detail | 操作 | ボタン「本人の分を書き出す」（状態 抜ける） | 状態 抜ける を作る（全役割） | 押す／入れる（実ブラウザ） | 押すと処理が起き、結果（遷移・DB の変化・表示の変化）が確認できる。押しても何も起きないなら未実装（G-01） |  | op=button:本人の分を書き出す | T-U-58 | L1 |
| SCR-MEMBER-DETAIL-062 | member-detail | 操作 | リンク「止まっているものを直す」（状態 AI が止まっている） | 状態 AI が止まっている を作る（全役割） | 押す／入れる（実ブラウザ） | /automation-repair が実在ルートで 200 で開く（G-04） | BLOCKED（自動：行き先の画面 automation-repair は T-U-32 で実装（未着手）。href は flow の route と機械照合済み・押すと 404 になるので今は押せない） | op=link:止まっているものを直す→automation-repair | T-U-58 | L1 |
| SCR-MEMBER-DETAIL-063 | member-detail | 発注者確認 | 手順 07_tasks/handoff/T-U-58.md を発注者が実際に触って OK を出す（Rule 12） | staging か ローカル | 手順どおりに触る | 手順の末尾に「OK: 日付 名前」が書かれる。無い間は BLOCKED（発注者の確認待ち） | BLOCKED（発注者の確認待ち：手順 07_tasks/handoff/T-U-58.md を高本さんが触って OK: を書く。ローカル 3123 で触れる・staging は無い） | Rule 12 | T-U-58 | L1 |
| SCR-MEMBER-DETAIL-064 | member-detail | メール | 送る操作をすると実際に送られる（API のログに「送った」が出る・黙って落ちない） | Resend の鍵が入っている | 送る操作をする | ログに「[mail] 送った → 宛先」。落ちたら「送れなかった」と理由 |  | G-15・関門 C6 | T-U-58 | L1 |
| SCR-MEMBER-DETAIL-065 | member-detail | メール | 自分の受信箱に届く（迷惑メールに入らない） | 実在するアドレス | 届いたメールを開く | 件名・差出人・本文が読める。リンクを押すと目的の画面が開く | BLOCKED（人が受信箱を見る：発注者確認の手順に入れた。dev は Resend の鍵で実送。staging は送信ドメインの検証が前提・FND-08-001） | 関門 C6 | T-U-58 | L1 |
| SCR-MEMBER-DETAIL-066 | member-detail | メール | 文面に内部の言葉（ID・関門・テーブル名）が出ていない。誰宛てか・何をすればよいかが 1 行で分かる | 届いたメール | 本文を読む | 宛先の名前・用件・次の一手・差出人。内部語なし | BLOCKED（人が文面を読む：発注者確認の手順に入れた。機械では読めない） | ui_lint の対象外なので人が見る | T-U-58 | L1 |
| SCR-MEMBER-DETAIL-067 | member-detail | メール | 届かないときに詰まらない（再送の導線がある・登録の有無は漏らさない） | 存在しないアドレス／受信箱が拒否 | 送る → 届かない | 画面は「送りました」のまま（有無を漏らさない）。再送で回復できる |  | G-15 | T-U-58 | L1 |
