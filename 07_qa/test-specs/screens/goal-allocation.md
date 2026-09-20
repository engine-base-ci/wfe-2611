# goal-allocation テスト仕様（L1・機械生成）

> 05_flow/build_tasks.py がタスクと同時に生成。ID は変えない。途中変更は qa_delta.py で差分。結果列は staging で流した人が書く（再生成しても残る。結果あり 12 行）。

| ID | 画面 | テスト観点 | テスト項目 | 前提条件 | 操作手順 | 期待結果 | 結果 | 備考 | タスク | 実行条件 |
|---|---|---|---|---|---|---|---|---|---|---|
| SCR-GOAL-ALLOCATION-001 | goal-allocation | 状態 | 状態「配る」がモックどおりに出る（h1・第2ナビ・列の値がダミー固定でない） | その状態を作る | 画面を開く | モック 06_mockup/v1/v1-goal-allocation.html の状態 n と一致 |  | G-06・G-07 | T-U-23 | L1 |
| SCR-GOAL-ALLOCATION-002 | goal-allocation | 状態 | 状態「配り方」がモックどおりに出る（h1・第2ナビ・列の値がダミー固定でない） | その状態を作る | 画面を開く | モック 06_mockup/v1/v1-goal-allocation.html の状態 m と一致 |  | G-06・G-07 | T-U-23 | L1 |
| SCR-GOAL-ALLOCATION-003 | goal-allocation | 状態 | 状態「層を足す」がモックどおりに出る（h1・第2ナビ・列の値がダミー固定でない） | その状態を作る | 画面を開く | モック 06_mockup/v1/v1-goal-allocation.html の状態 l と一致 |  | G-06・G-07 | T-U-23 | L1 |
| SCR-GOAL-ALLOCATION-004 | goal-allocation | 状態 | 状態「単位を作る」がモックどおりに出る（h1・第2ナビ・列の値がダミー固定でない） | その状態を作る | 画面を開く | モック 06_mockup/v1/v1-goal-allocation.html の状態 u と一致 |  | G-06・G-07 | T-U-23 | L1 |
| SCR-GOAL-ALLOCATION-005 | goal-allocation | 状態 | 状態「空」がモックどおりに出る（h1・第2ナビ・列の値がダミー固定でない） | その状態を作る | 画面を開く | モック 06_mockup/v1/v1-goal-allocation.html の状態 ge と一致 |  | G-06・G-07 | T-U-23 | L1 |
| SCR-GOAL-ALLOCATION-006 | goal-allocation | 状態 | 状態「AI が止まっている」がモックどおりに出る（h1・第2ナビ・列の値がダミー固定でない） | その状態を作る | 画面を開く | モック 06_mockup/v1/v1-goal-allocation.html の状態 gs と一致 |  | G-06・G-07 | T-U-23 | L1 |
| SCR-GOAL-ALLOCATION-007 | goal-allocation | 役割 | 役割 R1 で開くと、その役割の中身（data-roles）が出て、他の役割の中身は出ない | R1 でログイン | 画面を開く | 役割ごとの中身（G15） |  |  | T-U-23 | L1 |
| SCR-GOAL-ALLOCATION-008 | goal-allocation | 役割 | 役割 R2 で開くと、その役割の中身（data-roles）が出て、他の役割の中身は出ない | R2 でログイン | 画面を開く | 役割ごとの中身（G15） |  |  | T-U-23 | L1 |
| SCR-GOAL-ALLOCATION-009 | goal-allocation | 主アクション | 「配る」を押すと対応する endpoint が呼ばれ、別 GET で再取得した画面に反映される | 権限のある会員 | 押す | DB と画面が変わる（G-01・G-03） |  | PATCH /api/goal_allocations/:id | T-U-23 | L1 |
| SCR-GOAL-ALLOCATION-010 | goal-allocation | 到達性 | リンク先 account が実在ルートで 200 で開く | — | 押す | /account が開く（G-04） | BLOCKED（自動：行き先の画面 account は T-U-44 で実装（未着手）。href は flow の route と機械照合済み・押すと 404 になるので今は押せない） |  | T-U-23 | L1 |
| SCR-GOAL-ALLOCATION-011 | goal-allocation | 到達性 | リンク先 account-close が実在ルートで 200 で開く | — | 押す | /account-close が開く（G-04） | BLOCKED（自動：行き先の画面 account-close は T-U-40 で実装（未着手）。href は flow の route と機械照合済み・押すと 404 になるので今は押せない） |  | T-U-23 | L1 |
| SCR-GOAL-ALLOCATION-012 | goal-allocation | 到達性 | リンク先 ai-activity が実在ルートで 200 で開く | — | 押す | /ai-activity が開く（G-04） | BLOCKED（自動：行き先の画面 ai-activity は T-U-18 で実装（未着手）。href は flow の route と機械照合済み・押すと 404 になるので今は押せない） |  | T-U-23 | L1 |
| SCR-GOAL-ALLOCATION-013 | goal-allocation | 到達性 | リンク先 ai-staff が実在ルートで 200 で開く | — | 押す | /ai-staff が開く（G-04） | BLOCKED（自動：行き先の画面 ai-staff は T-U-36 で実装（未着手）。href は flow の route と機械照合済み・押すと 404 になるので今は押せない） |  | T-U-23 | L1 |
| SCR-GOAL-ALLOCATION-014 | goal-allocation | 到達性 | リンク先 approvals が実在ルートで 200 で開く | — | 押す | /approvals が開く（G-04） | BLOCKED（自動：行き先の画面 approvals は T-U-14 で実装（未着手）。href は flow の route と機械照合済み・押すと 404 になるので今は押せない） |  | T-U-23 | L1 |
| SCR-GOAL-ALLOCATION-015 | goal-allocation | 到達性 | リンク先 audit が実在ルートで 200 で開く | — | 押す | /audit が開く（G-04） | BLOCKED（自動：行き先の画面 audit は T-U-33 で実装（未着手）。href は flow の route と機械照合済み・押すと 404 になるので今は押せない） |  | T-U-23 | L1 |
| SCR-GOAL-ALLOCATION-016 | goal-allocation | 到達性 | リンク先 automation-repair が実在ルートで 200 で開く | — | 押す | /automation-repair が開く（G-04） | BLOCKED（自動：行き先の画面 automation-repair は T-U-32 で実装（未着手）。href は flow の route と機械照合済み・押すと 404 になるので今は押せない） |  | T-U-23 | L1 |
| SCR-GOAL-ALLOCATION-017 | goal-allocation | 到達性 | リンク先 billing が実在ルートで 200 で開く | — | 押す | /billing が開く（G-04） | BLOCKED（自動：行き先の画面 billing は T-U-52 で実装（未着手）。href は flow の route と機械照合済み・押すと 404 になるので今は押せない） |  | T-U-23 | L1 |
| SCR-GOAL-ALLOCATION-018 | goal-allocation | 横溢れ | 375・768・1024・1440 で scrollWidth - clientWidth <= 1、1180+ で本文 720 以上 | — | 各幅で開く | 溢れ 0 |  | G-05 | T-U-23 | L1 |
| SCR-GOAL-ALLOCATION-019 | goal-allocation | 空・止まっている | データ 0 件の状態と AI が止まっている状態が cover 宣言どおりに出る | PS2 / PS4 | 開く | 空状態と止まっている帯 |  | G18 | T-U-23 | L1 |
| SCR-GOAL-ALLOCATION-020 | goal-allocation | 表記ゆらぎ | 全角／半角：メール・数値・コードを全角で入れる | 入力欄がある状態 | 入力して保存 | 同一として扱われ、サーバー側で正規化されて保存される（クライアント側だけに頼らない） |  | human-grade-qa 第11軸 | T-U-23 | L1 |
| SCR-GOAL-ALLOCATION-021 | goal-allocation | 表記ゆらぎ | 前後と途中の空白：空白付きで入れる | 入力欄がある状態 | 入力して保存 | 同一として扱われ、サーバー側で正規化されて保存される（クライアント側だけに頼らない） |  | human-grade-qa 第11軸 | T-U-23 | L1 |
| SCR-GOAL-ALLOCATION-022 | goal-allocation | 表記ゆらぎ | 記号の種別（ハイフン・長音）：‐ ー − を混ぜる | 入力欄がある状態 | 入力して保存 | 同一として扱われ、サーバー側で正規化されて保存される（クライアント側だけに頼らない） |  | human-grade-qa 第11軸 | T-U-23 | L1 |
| SCR-GOAL-ALLOCATION-023 | goal-allocation | 表記ゆらぎ | Unicode 正規化（NFC/NFD）：macOS の入力（NFD）で入れる | 入力欄がある状態 | 入力して保存 | 同一として扱われ、サーバー側で正規化されて保存される（クライアント側だけに頼らない） |  | human-grade-qa 第11軸 | T-U-23 | L1 |
| SCR-GOAL-ALLOCATION-024 | goal-allocation | 表記ゆらぎ | 大文字小文字：メールを大文字で入れる | 入力欄がある状態 | 入力して保存 | 同一として扱われ、サーバー側で正規化されて保存される（クライアント側だけに頼らない） |  | human-grade-qa 第11軸 | T-U-23 | L1 |
| SCR-GOAL-ALLOCATION-025 | goal-allocation | G-11 外部リソースの実在 | N/A：外部リソースを触らない | migration/IaC 適用後 | 起動時の存在確認を読む | 無ければ起動時に落ちる（黙って 502 にならない） |  | 環境ごと | T-U-23 | L1 |
| SCR-GOAL-ALLOCATION-026 | goal-allocation | G-12 切り替わりの瞬間 | Bridge が切れた直後 0 秒・鮮度窓の内側に操作する | 本番稼働中 | PC を閉じた直後に主アクションを押す | 「AI は止まっています」が出て、押した内容は失われない |  |  | T-U-23 | L1 |
| SCR-GOAL-ALLOCATION-027 | goal-allocation | G-13 機能の組み合わせ | 実行中 × 切替／中断 × 再開／別ロール同時 の直積のうち該当分 | — | 同時に起こす | 後勝ちでなく、規則どおり（承認は 1 人 1 回・切替は次の実行から） |  | features.json combination_points | T-U-23 | L1 |
| SCR-GOAL-ALLOCATION-028 | goal-allocation | G-14 口座状態の波及 | 退会・停止・権限変更・パスワード変更の後に、この機能の既存セッション・接続・共有リンクが無効 | ログイン中の別端末と Bridge | 権限を変える | 別端末と Bridge は 0 秒で 401（sessions が revoked） |  |  | T-U-23 | L1 |
| SCR-GOAL-ALLOCATION-029 | goal-allocation | G-15 信号なし終了 | N/A：外部を呼ばない | 外部を故意に切る | 実行する | 成功扱いにせず、502 と次の一手（人へのハンドオフ） |  |  | T-U-23 | L1 |
| SCR-GOAL-ALLOCATION-030 | goal-allocation | G-16 有限資源 | 消費する資源：DB 接続（プール経由）・メモリ。1 要求あたり 1 接続以下・上限時は待機列 | 同時 50 要求 | 同時に叩く | ログインが落ちない・接続上限に張り付かない（関門 C2 のプール） |  | L4 で負荷試験 | T-U-23 | L1 |
| SCR-GOAL-ALLOCATION-031 | goal-allocation | 操作 | ボタン「高本AI」（状態 共通） | 状態 共通 を作る（全役割） | 押す／入れる（実ブラウザ） | 押すと処理が起き、結果（遷移・DB の変化・表示の変化）が確認できる。押しても何も起きないなら未実装（G-01） |  | op=button:高本AI | T-U-23 | L1 |
| SCR-GOAL-ALLOCATION-032 | goal-allocation | 操作 | リンク「AI は止まっています」（状態 共通） | 状態 共通 を作る（全役割） | 押す／入れる（実ブラウザ） | /automation-repair が実在ルートで 200 で開く（G-04） | BLOCKED（自動：行き先の画面 automation-repair は T-U-32 で実装（未着手）。href は flow の route と機械照合済み・押すと 404 になるので今は押せない） | op=link:AI は止まっています→automation-repair | T-U-23 | L1 |
| SCR-GOAL-ALLOCATION-033 | goal-allocation | 操作 | リンク「PC をつなぐと話せます」（状態 共通） | 状態 共通 を作る（全役割） | 押す／入れる（実ブラウザ） | /bridge-setup が実在ルートで 200 で開く（G-04） |  | op=link:PC をつなぐと話せます→bridge-setup | T-U-23 | L1 |
| SCR-GOAL-ALLOCATION-034 | goal-allocation | 操作 | ボタン「配る」（状態 共通・配る・空・AI が止まっている） | 状態 共通 を作る（R2） | 押す／入れる（実ブラウザ） | 押すと処理が起き、結果（遷移・DB の変化・表示の変化）が確認できる。押しても何も起きないなら未実装（G-01） |  | op=button:配る | T-U-23 | L1 |
| SCR-GOAL-ALLOCATION-035 | goal-allocation | 操作 | ボタン「＋層を足す」（状態 配る・AI が止まっている） | 状態 配る を作る（R2） | 押す／入れる（実ブラウザ） | 押すと処理が起き、結果（遷移・DB の変化・表示の変化）が確認できる。押しても何も起きないなら未実装（G-01） |  | op=button:＋層を足す | T-U-23 | L1 |
| SCR-GOAL-ALLOCATION-036 | goal-allocation | 操作 | 入力欄「text」（状態 配る・AI が止まっている） | 状態 配る を作る（R2） | 押す／入れる（実ブラウザ） | 入力が受け付けられ、送信に載って別 GET で読める（G-01・反映） |  | op=input:text | T-U-23 | L1 |
| SCR-GOAL-ALLOCATION-037 | goal-allocation | 操作 | ボタン「この配分で確定」（状態 配る・AI が止まっている） | 状態 配る を作る（R1） | 押す／入れる（実ブラウザ） | 押すと処理が起き、結果（遷移・DB の変化・表示の変化）が確認できる。押しても何も起きないなら未実装（G-01） |  | op=button:この配分で確定 | T-U-23 | L1 |
| SCR-GOAL-ALLOCATION-038 | goal-allocation | 操作 | リンク「層を足す（人を招く）」（状態 配る・AI が止まっている） | 状態 配る を作る（R1） | 押す／入れる（実ブラウザ） | /members が実在ルートで 200 で開く（G-04） | BLOCKED（自動：行き先の画面 members は T-U-35 で実装（未着手）。href は flow の route と機械照合済み・押すと 404 になるので今は押せない） | op=link:層を足す（人を招く）→members | T-U-23 | L1 |
| SCR-GOAL-ALLOCATION-039 | goal-allocation | 操作 | ボタン「変える」（状態 配り方） | 状態 配り方 を作る（全役割） | 押す／入れる（実ブラウザ） | 押すと処理が起き、結果（遷移・DB の変化・表示の変化）が確認できる。押しても何も起きないなら未実装（G-01） |  | op=button:変える | T-U-23 | L1 |
| SCR-GOAL-ALLOCATION-040 | goal-allocation | 操作 | ボタン「保存する」（状態 配り方） | 状態 配り方 を作る（全役割） | 押す／入れる（実ブラウザ） | 押すと処理が起き、結果（遷移・DB の変化・表示の変化）が確認できる。押しても何も起きないなら未実装（G-01） |  | op=button:保存する | T-U-23 | L1 |
| SCR-GOAL-ALLOCATION-041 | goal-allocation | 操作 | 入力欄「層の名前」（状態 層を足す） | 状態 層を足す を作る（全役割） | 押す／入れる（実ブラウザ） | 入力が受け付けられ、送信に載って別 GET で読める（G-01・反映） |  | op=input:層の名前 | T-U-23 | L1 |
| SCR-GOAL-ALLOCATION-042 | goal-allocation | 操作 | 入力欄「どこの下に」（状態 層を足す） | 状態 層を足す を作る（全役割） | 押す／入れる（実ブラウザ） | 入力が受け付けられ、送信に載って別 GET で読める（G-01・反映） |  | op=input:どこの下に | T-U-23 | L1 |
| SCR-GOAL-ALLOCATION-043 | goal-allocation | 操作 | 入力欄「この層の目標を見せる相手」（状態 層を足す） | 状態 層を足す を作る（全役割） | 押す／入れる（実ブラウザ） | 入力が受け付けられ、送信に載って別 GET で読める（G-01・反映） |  | op=input:この層の目標を見せる相手 | T-U-23 | L1 |
| SCR-GOAL-ALLOCATION-044 | goal-allocation | 操作 | ボタン「足す」（状態 層を足す） | 状態 層を足す を作る（全役割） | 押す／入れる（実ブラウザ） | 押すと処理が起き、結果（遷移・DB の変化・表示の変化）が確認できる。押しても何も起きないなら未実装（G-01） |  | op=button:足す | T-U-23 | L1 |
| SCR-GOAL-ALLOCATION-045 | goal-allocation | 操作 | 入力欄「名前」（状態 単位を作る） | 状態 単位を作る を作る（全役割） | 押す／入れる（実ブラウザ） | 入力が受け付けられ、送信に載って別 GET で読める（G-01・反映） |  | op=input:名前 | T-U-23 | L1 |
| SCR-GOAL-ALLOCATION-046 | goal-allocation | 操作 | 入力欄「記号」（状態 単位を作る） | 状態 単位を作る を作る（全役割） | 押す／入れる（実ブラウザ） | 入力が受け付けられ、送信に載って別 GET で読める（G-01・反映） |  | op=input:記号 | T-U-23 | L1 |
| SCR-GOAL-ALLOCATION-047 | goal-allocation | 操作 | 入力欄「小数」（状態 単位を作る） | 状態 単位を作る を作る（全役割） | 押す／入れる（実ブラウザ） | 入力が受け付けられ、送信に載って別 GET で読める（G-01・反映） |  | op=input:小数 | T-U-23 | L1 |
| SCR-GOAL-ALLOCATION-048 | goal-allocation | 操作 | ボタン「作る」（状態 単位を作る） | 状態 単位を作る を作る（全役割） | 押す／入れる（実ブラウザ） | 押すと処理が起き、結果（遷移・DB の変化・表示の変化）が確認できる。押しても何も起きないなら未実装（G-01） |  | op=button:作る | T-U-23 | L1 |
| SCR-GOAL-ALLOCATION-049 | goal-allocation | 操作 | リンク「止まっているものを直す」（状態 AI が止まっている） | 状態 AI が止まっている を作る（全役割） | 押す／入れる（実ブラウザ） | /automation-repair が実在ルートで 200 で開く（G-04） | BLOCKED（自動：行き先の画面 automation-repair は T-U-32 で実装（未着手）。href は flow の route と機械照合済み・押すと 404 になるので今は押せない） | op=link:止まっているものを直す→automation-repair | T-U-23 | L1 |
| SCR-GOAL-ALLOCATION-050 | goal-allocation | 発注者確認 | 手順 07_tasks/handoff/T-U-23.md を発注者が実際に触って OK を出す（Rule 12） | staging か ローカル | 手順どおりに触る | 手順の末尾に「OK: 日付 名前」が書かれる。無い間は BLOCKED（発注者の確認待ち） | BLOCKED（発注者の確認待ち：手順 07_tasks/handoff/T-U-23.md を高本さんが触って OK: を書く。ローカル 3123 で触れる・staging は無い） | Rule 12 | T-U-23 | L1 |
