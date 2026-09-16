# clone-thread テスト仕様（L1・機械生成）

> 05_flow/build_tasks.py がタスクと同時に生成。ID は変えない。途中変更は qa_delta.py で差分。結果列は staging で流した人が書く（再生成しても残る。結果あり 0 行）。

| ID | 画面 | テスト観点 | テスト項目 | 前提条件 | 操作手順 | 期待結果 | 結果 | 備考 | タスク | 実行条件 |
|---|---|---|---|---|---|---|---|---|---|---|
| SCR-CLONE-THREAD-001 | clone-thread | 状態 | 状態「1件のやりとり」がモックどおりに出る（h1・第2ナビ・列の値がダミー固定でない） | その状態を作る | 画面を開く | モック 06_mockup/v1/v1-clone-thread.html の状態 n と一致 |  | G-06・G-07 | T-U-15 | L1 |
| SCR-CLONE-THREAD-002 | clone-thread | 状態 | 状態「差し戻し中の一覧」がモックどおりに出る（h1・第2ナビ・列の値がダミー固定でない） | その状態を作る | 画面を開く | モック 06_mockup/v1/v1-clone-thread.html の状態 l と一致 |  | G-06・G-07 | T-U-15 | L1 |
| SCR-CLONE-THREAD-003 | clone-thread | 状態 | 状態「高本AIが判断できない」がモックどおりに出る（h1・第2ナビ・列の値がダミー固定でない） | その状態を作る | 画面を開く | モック 06_mockup/v1/v1-clone-thread.html の状態 a と一致 |  | G-06・G-07 | T-U-15 | L1 |
| SCR-CLONE-THREAD-004 | clone-thread | 状態 | 状態「空」がモックどおりに出る（h1・第2ナビ・列の値がダミー固定でない） | その状態を作る | 画面を開く | モック 06_mockup/v1/v1-clone-thread.html の状態 ge と一致 |  | G-06・G-07 | T-U-15 | L1 |
| SCR-CLONE-THREAD-005 | clone-thread | 状態 | 状態「AI が止まっている」がモックどおりに出る（h1・第2ナビ・列の値がダミー固定でない） | その状態を作る | 画面を開く | モック 06_mockup/v1/v1-clone-thread.html の状態 gs と一致 |  | G-06・G-07 | T-U-15 | L1 |
| SCR-CLONE-THREAD-006 | clone-thread | 役割 | 役割 R1 で開くと、その役割の中身（data-roles）が出て、他の役割の中身は出ない | R1 でログイン | 画面を開く | 役割ごとの中身（G15） |  |  | T-U-15 | L1 |
| SCR-CLONE-THREAD-007 | clone-thread | 役割 | 役割 R2 で開くと、その役割の中身（data-roles）が出て、他の役割の中身は出ない | R2 でログイン | 画面を開く | 役割ごとの中身（G15） |  |  | T-U-15 | L1 |
| SCR-CLONE-THREAD-008 | clone-thread | 役割 | 役割 R3 で開くと、その役割の中身（data-roles）が出て、他の役割の中身は出ない | R3 でログイン | 画面を開く | 役割ごとの中身（G15） |  |  | T-U-15 | L1 |
| SCR-CLONE-THREAD-009 | clone-thread | 主アクション | 「AI社員に伝える」を押すと対応する endpoint が呼ばれ、別 GET で再取得した画面に反映される | 権限のある会員 | 押す | DB と画面が変わる（G-01・G-03） |  | GET /api/approvals | T-U-15 | L1 |
| SCR-CLONE-THREAD-010 | clone-thread | 到達性 | リンク先 account が実在ルートで 200 で開く | — | 押す | /account が開く（G-04） | BLOCKED（自動：行き先の画面 account は T-U-44 で実装（未着手）。href は flow の route と機械照合済み・押すと 404 になるので今は押せない） |  | T-U-15 | L1 |
| SCR-CLONE-THREAD-011 | clone-thread | 到達性 | リンク先 account-close が実在ルートで 200 で開く | — | 押す | /account-close が開く（G-04） | BLOCKED（自動：行き先の画面 account-close は T-U-40 で実装（未着手）。href は flow の route と機械照合済み・押すと 404 になるので今は押せない） |  | T-U-15 | L1 |
| SCR-CLONE-THREAD-012 | clone-thread | 到達性 | リンク先 ai-activity が実在ルートで 200 で開く | — | 押す | /ai-activity が開く（G-04） | BLOCKED（自動：行き先の画面 ai-activity は T-U-18 で実装（未着手）。href は flow の route と機械照合済み・押すと 404 になるので今は押せない） |  | T-U-15 | L1 |
| SCR-CLONE-THREAD-013 | clone-thread | 到達性 | リンク先 ai-staff が実在ルートで 200 で開く | — | 押す | /ai-staff が開く（G-04） | BLOCKED（自動：行き先の画面 ai-staff は T-U-36 で実装（未着手）。href は flow の route と機械照合済み・押すと 404 になるので今は押せない） |  | T-U-15 | L1 |
| SCR-CLONE-THREAD-014 | clone-thread | 到達性 | リンク先 approvals が実在ルートで 200 で開く | — | 押す | /approvals が開く（G-04） | BLOCKED（自動：行き先の画面 approvals は T-U-14 で実装（未着手）。href は flow の route と機械照合済み・押すと 404 になるので今は押せない） |  | T-U-15 | L1 |
| SCR-CLONE-THREAD-015 | clone-thread | 到達性 | リンク先 audit が実在ルートで 200 で開く | — | 押す | /audit が開く（G-04） | BLOCKED（自動：行き先の画面 audit は T-U-33 で実装（未着手）。href は flow の route と機械照合済み・押すと 404 になるので今は押せない） |  | T-U-15 | L1 |
| SCR-CLONE-THREAD-016 | clone-thread | 到達性 | リンク先 automation-repair が実在ルートで 200 で開く | — | 押す | /automation-repair が開く（G-04） | BLOCKED（自動：行き先の画面 automation-repair は T-U-32 で実装（未着手）。href は flow の route と機械照合済み・押すと 404 になるので今は押せない） |  | T-U-15 | L1 |
| SCR-CLONE-THREAD-017 | clone-thread | 到達性 | リンク先 billing が実在ルートで 200 で開く | — | 押す | /billing が開く（G-04） | BLOCKED（自動：行き先の画面 billing は T-U-52 で実装（未着手）。href は flow の route と機械照合済み・押すと 404 になるので今は押せない） |  | T-U-15 | L1 |
| SCR-CLONE-THREAD-018 | clone-thread | 横溢れ | 375・768・1024・1440 で scrollWidth - clientWidth <= 1、1180+ で本文 720 以上 | — | 各幅で開く | 溢れ 0 |  | G-05 | T-U-15 | L1 |
| SCR-CLONE-THREAD-019 | clone-thread | 空・止まっている | データ 0 件の状態と AI が止まっている状態が cover 宣言どおりに出る | PS2 / PS4 | 開く | 空状態と止まっている帯 |  | G18 | T-U-15 | L1 |
| SCR-CLONE-THREAD-020 | clone-thread | 表記ゆらぎ | 全角／半角：メール・数値・コードを全角で入れる | 入力欄がある状態 | 入力して保存 | 同一として扱われ、サーバー側で正規化されて保存される（クライアント側だけに頼らない） |  | human-grade-qa 第11軸 | T-U-15 | L1 |
| SCR-CLONE-THREAD-021 | clone-thread | 表記ゆらぎ | 前後と途中の空白：空白付きで入れる | 入力欄がある状態 | 入力して保存 | 同一として扱われ、サーバー側で正規化されて保存される（クライアント側だけに頼らない） |  | human-grade-qa 第11軸 | T-U-15 | L1 |
| SCR-CLONE-THREAD-022 | clone-thread | 表記ゆらぎ | 記号の種別（ハイフン・長音）：‐ ー − を混ぜる | 入力欄がある状態 | 入力して保存 | 同一として扱われ、サーバー側で正規化されて保存される（クライアント側だけに頼らない） |  | human-grade-qa 第11軸 | T-U-15 | L1 |
| SCR-CLONE-THREAD-023 | clone-thread | 表記ゆらぎ | Unicode 正規化（NFC/NFD）：macOS の入力（NFD）で入れる | 入力欄がある状態 | 入力して保存 | 同一として扱われ、サーバー側で正規化されて保存される（クライアント側だけに頼らない） |  | human-grade-qa 第11軸 | T-U-15 | L1 |
| SCR-CLONE-THREAD-024 | clone-thread | 表記ゆらぎ | 大文字小文字：メールを大文字で入れる | 入力欄がある状態 | 入力して保存 | 同一として扱われ、サーバー側で正規化されて保存される（クライアント側だけに頼らない） |  | human-grade-qa 第11軸 | T-U-15 | L1 |
| SCR-CLONE-THREAD-025 | clone-thread | G-11 外部リソースの実在 | N/A：外部リソースを触らない | migration/IaC 適用後 | 起動時の存在確認を読む | 無ければ起動時に落ちる（黙って 502 にならない） |  | 環境ごと | T-U-15 | L1 |
| SCR-CLONE-THREAD-026 | clone-thread | G-12 切り替わりの瞬間 | Bridge が切れた直後 0 秒・鮮度窓の内側に操作する | 本番稼働中 | PC を閉じた直後に主アクションを押す | 「AI は止まっています」が出て、押した内容は失われない |  |  | T-U-15 | L1 |
| SCR-CLONE-THREAD-027 | clone-thread | G-13 機能の組み合わせ | 実行中 × 切替／中断 × 再開／別ロール同時 の直積のうち該当分 | — | 同時に起こす | 後勝ちでなく、規則どおり（承認は 1 人 1 回・切替は次の実行から） |  | features.json combination_points | T-U-15 | L1 |
| SCR-CLONE-THREAD-028 | clone-thread | G-14 口座状態の波及 | 退会・停止・権限変更・パスワード変更の後に、この機能の既存セッション・接続・共有リンクが無効 | ログイン中の別端末と Bridge | 権限を変える | 別端末と Bridge は 0 秒で 401（sessions が revoked） |  |  | T-U-15 | L1 |
| SCR-CLONE-THREAD-029 | clone-thread | G-15 信号なし終了 | N/A：外部を呼ばない | 外部を故意に切る | 実行する | 成功扱いにせず、502 と次の一手（人へのハンドオフ） |  |  | T-U-15 | L1 |
| SCR-CLONE-THREAD-030 | clone-thread | G-16 有限資源 | 消費する資源：DB 接続（プール経由）・メモリ。1 要求あたり 1 接続以下・上限時は待機列 | 同時 50 要求 | 同時に叩く | ログインが落ちない・接続上限に張り付かない（関門 C2 のプール） |  | L4 で負荷試験 | T-U-15 | L1 |
| SCR-CLONE-THREAD-031 | clone-thread | 操作 | ボタン「AI社員に伝える」（状態 共通・空） | 状態 共通 を作る（全役割） | 押す／入れる（実ブラウザ） | 押すと処理が起き、結果（遷移・DB の変化・表示の変化）が確認できる。押しても何も起きないなら未実装（G-01） |  | op=button:AI社員に伝える | T-U-15 | L1 |
| SCR-CLONE-THREAD-032 | clone-thread | 操作 | ボタン「コピー」（状態 1件のやりとり・高本AIが判断できない・AI が止まっている） | 状態 1件のやりとり を作る（R1 R2 R3） | 押す／入れる（実ブラウザ） | 押すと処理が起き、結果（遷移・DB の変化・表示の変化）が確認できる。押しても何も起きないなら未実装（G-01） |  | op=button:コピー | T-U-15 | L1 |
| SCR-CLONE-THREAD-033 | clone-thread | 操作 | ボタン「もう一度」（状態 1件のやりとり・高本AIが判断できない・AI が止まっている） | 状態 1件のやりとり を作る（R1 R2 R3） | 押す／入れる（実ブラウザ） | 押すと処理が起き、結果（遷移・DB の変化・表示の変化）が確認できる。押しても何も起きないなら未実装（G-01） |  | op=button:もう一度 | T-U-15 | L1 |
| SCR-CLONE-THREAD-034 | clone-thread | 操作 | ボタン「ここから分岐」（状態 1件のやりとり・高本AIが判断できない・AI が止まっている） | 状態 1件のやりとり を作る（R1 R2 R3） | 押す／入れる（実ブラウザ） | 押すと処理が起き、結果（遷移・DB の変化・表示の変化）が確認できる。押しても何も起きないなら未実装（G-01） |  | op=button:ここから分岐 | T-U-15 | L1 |
| SCR-CLONE-THREAD-035 | clone-thread | 操作 | ボタン「記憶に入れる」（状態 1件のやりとり・高本AIが判断できない・AI が止まっている） | 状態 1件のやりとり を作る（R1 R2 R3） | 押す／入れる（実ブラウザ） | 押すと処理が起き、結果（遷移・DB の変化・表示の変化）が確認できる。押しても何も起きないなら未実装（G-01） |  | op=button:記憶に入れる | T-U-15 | L1 |
| SCR-CLONE-THREAD-036 | clone-thread | 操作 | ボタン「根拠を見る」（状態 1件のやりとり・高本AIが判断できない・AI が止まっている） | 状態 1件のやりとり を作る（R1 R2 R3） | 押す／入れる（実ブラウザ） | 押すと処理が起き、結果（遷移・DB の変化・表示の変化）が確認できる。押しても何も起きないなら未実装（G-01） |  | op=button:根拠を見る | T-U-15 | L1 |
| SCR-CLONE-THREAD-037 | clone-thread | 操作 | ボタン「無名（アイコンだけ。実装では aria-label を付ける）」（状態 1件のやりとり・高本AIが判断できない・AI が止まっている） | 状態 1件のやりとり を作る（R1 R2 R3） | 押す／入れる（実ブラウザ） | 押すと処理が起き、結果（遷移・DB の変化・表示の変化）が確認できる。押しても何も起きないなら未実装（G-01） |  | op=button:無名（アイコンだけ。実装では aria-label を付ける） | T-U-15 | L1 |
| SCR-CLONE-THREAD-038 | clone-thread | 操作 | 入力欄「高本AIに伝える（例：京蟻は来月から税込を先に書いて）」（状態 1件のやりとり・AI が止まっている） | 状態 1件のやりとり を作る（R1 R2） | 押す／入れる（実ブラウザ） | 入力が受け付けられ、送信に載って別 GET で読める（G-01・反映） |  | op=textarea:高本AIに伝える（例：京蟻は来月から税込を先に書いて） | T-U-15 | L1 |
| SCR-CLONE-THREAD-039 | clone-thread | 操作 | ボタン「送る」（状態 1件のやりとり・高本AIが判断できない・AI が止まっている） | 状態 1件のやりとり を作る（R1 R2 R3） | 押す／入れる（実ブラウザ） | 押すと処理が起き、結果（遷移・DB の変化・表示の変化）が確認できる。押しても何も起きないなら未実装（G-01） |  | op=button:送る | T-U-15 | L1 |
| SCR-CLONE-THREAD-040 | clone-thread | 操作 | リンク「承認待ちを見る →」（状態 1件のやりとり・AI が止まっている） | 状態 1件のやりとり を作る（R1 R2） | 押す／入れる（実ブラウザ） | /approvals が実在ルートで 200 で開く（G-04） | BLOCKED（自動：行き先の画面 approvals は T-U-14 で実装（未着手）。href は flow の route と機械照合済み・押すと 404 になるので今は押せない） | op=link:承認待ちを見る →→approvals | T-U-15 | L1 |
| SCR-CLONE-THREAD-041 | clone-thread | 操作 | ボタン「編集して送り直す」（状態 1件のやりとり・AI が止まっている） | 状態 1件のやりとり を作る（R3） | 押す／入れる（実ブラウザ） | 押すと処理が起き、結果（遷移・DB の変化・表示の変化）が確認できる。押しても何も起きないなら未実装（G-01） |  | op=button:編集して送り直す | T-U-15 | L1 |
| SCR-CLONE-THREAD-042 | clone-thread | 操作 | 入力欄「ここに書く。声で話しても、資料を投げても構いません」（状態 1件のやりとり・高本AIが判断できない・AI が止まっている） | 状態 1件のやりとり を作る（R3） | 押す／入れる（実ブラウザ） | 入力が受け付けられ、送信に載って別 GET で読める（G-01・反映） |  | op=textarea:ここに書く。声で話しても、資料を投げても構いません | T-U-15 | L1 |
| SCR-CLONE-THREAD-043 | clone-thread | 操作 | ボタン「見る」（状態 差し戻し中の一覧） | 状態 差し戻し中の一覧 を作る（全役割） | 押す／入れる（実ブラウザ） | 押すと処理が起き、結果（遷移・DB の変化・表示の変化）が確認できる。押しても何も起きないなら未実装（G-01） |  | op=button:見る | T-U-15 | L1 |
| SCR-CLONE-THREAD-044 | clone-thread | 操作 | ボタン「値引きしない」（状態 高本AIが判断できない） | 状態 高本AIが判断できない を作る（全役割） | 押す／入れる（実ブラウザ） | 押すと処理が起き、結果（遷移・DB の変化・表示の変化）が確認できる。押しても何も起きないなら未実装（G-01） |  | op=button:値引きしない | T-U-15 | L1 |
| SCR-CLONE-THREAD-045 | clone-thread | 操作 | ボタン「1割まで」（状態 高本AIが判断できない） | 状態 高本AIが判断できない を作る（全役割） | 押す／入れる（実ブラウザ） | 押すと処理が起き、結果（遷移・DB の変化・表示の変化）が確認できる。押しても何も起きないなら未実装（G-01） |  | op=button:1割まで | T-U-15 | L1 |
| SCR-CLONE-THREAD-046 | clone-thread | 操作 | ボタン「私が直接返す」（状態 高本AIが判断できない） | 状態 高本AIが判断できない を作る（全役割） | 押す／入れる（実ブラウザ） | 押すと処理が起き、結果（遷移・DB の変化・表示の変化）が確認できる。押しても何も起きないなら未実装（G-01） |  | op=button:私が直接返す | T-U-15 | L1 |
| SCR-CLONE-THREAD-047 | clone-thread | 操作 | ボタン「その他（自由に書く）」（状態 高本AIが判断できない） | 状態 高本AIが判断できない を作る（全役割） | 押す／入れる（実ブラウザ） | 押すと処理が起き、結果（遷移・DB の変化・表示の変化）が確認できる。押しても何も起きないなら未実装（G-01） |  | op=button:その他（自由に書く） | T-U-15 | L1 |
| SCR-CLONE-THREAD-048 | clone-thread | 操作 | ボタン「あとで」（状態 高本AIが判断できない） | 状態 高本AIが判断できない を作る（全役割） | 押す／入れる（実ブラウザ） | 押すと処理が起き、結果（遷移・DB の変化・表示の変化）が確認できる。押しても何も起きないなら未実装（G-01） |  | op=button:あとで | T-U-15 | L1 |
| SCR-CLONE-THREAD-049 | clone-thread | 操作 | リンク「止まっているものを直す」（状態 AI が止まっている） | 状態 AI が止まっている を作る（全役割） | 押す／入れる（実ブラウザ） | /automation-repair が実在ルートで 200 で開く（G-04） | BLOCKED（自動：行き先の画面 automation-repair は T-U-32 で実装（未着手）。href は flow の route と機械照合済み・押すと 404 になるので今は押せない） | op=link:止まっているものを直す→automation-repair | T-U-15 | L1 |
| SCR-CLONE-THREAD-050 | clone-thread | 発注者確認 | 手順 07_tasks/handoff/T-U-15.md を発注者が実際に触って OK を出す（Rule 12） | staging か ローカル | 手順どおりに触る | 手順の末尾に「OK: 日付 名前」が書かれる。無い間は BLOCKED（発注者の確認待ち） | BLOCKED（発注者の確認待ち：手順 07_tasks/handoff/T-U-15.md を高本さんが触って OK: を書く。ローカル 3123 で触れる・staging は無い） | Rule 12 | T-U-15 | L1 |
