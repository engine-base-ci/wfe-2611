# ops-catalog テスト仕様（L1・機械生成）

> 05_flow/build_tasks.py がタスクと同時に生成。ID は変えない。途中変更は qa_delta.py で差分。結果列は staging で流した人が書く。

| ID | 画面 | テスト観点 | テスト項目 | 前提条件 | 操作手順 | 期待結果 | 結果 | 備考 | タスク | 実行条件 |
|---|---|---|---|---|---|---|---|---|---|---|
| SCR-OPS-CATALOG-001 | ops-catalog | 状態 | 状態「AI社員」がモックどおりに出る（h1・第2ナビ・列の値がダミー固定でない） | その状態を作る | 画面を開く | モック 06_mockup/v1/v1-ops-catalog.html の状態 n と一致 |  | G-06・G-07 | T-U-43 | L1 |
| SCR-OPS-CATALOG-002 | ops-catalog | 状態 | 状態「担当業務」がモックどおりに出る（h1・第2ナビ・列の値がダミー固定でない） | その状態を作る | 画面を開く | モック 06_mockup/v1/v1-ops-catalog.html の状態 d と一致 |  | G-06・G-07 | T-U-43 | L1 |
| SCR-OPS-CATALOG-003 | ops-catalog | 状態 | 状態「ルール」がモックどおりに出る（h1・第2ナビ・列の値がダミー固定でない） | その状態を作る | 画面を開く | モック 06_mockup/v1/v1-ops-catalog.html の状態 r と一致 |  | G-06・G-07 | T-U-43 | L1 |
| SCR-OPS-CATALOG-004 | ops-catalog | 状態 | 状態「テンプレ」がモックどおりに出る（h1・第2ナビ・列の値がダミー固定でない） | その状態を作る | 画面を開く | モック 06_mockup/v1/v1-ops-catalog.html の状態 t と一致 |  | G-06・G-07 | T-U-43 | L1 |
| SCR-OPS-CATALOG-005 | ops-catalog | 状態 | 状態「目標スキル」がモックどおりに出る（h1・第2ナビ・列の値がダミー固定でない） | その状態を作る | 画面を開く | モック 06_mockup/v1/v1-ops-catalog.html の状態 g と一致 |  | G-06・G-07 | T-U-43 | L1 |
| SCR-OPS-CATALOG-006 | ops-catalog | 状態 | 状態「プランの定義」がモックどおりに出る（h1・第2ナビ・列の値がダミー固定でない） | その状態を作る | 画面を開く | モック 06_mockup/v1/v1-ops-catalog.html の状態 p と一致 |  | G-06・G-07 | T-U-43 | L1 |
| SCR-OPS-CATALOG-007 | ops-catalog | 状態 | 状態「空」がモックどおりに出る（h1・第2ナビ・列の値がダミー固定でない） | その状態を作る | 画面を開く | モック 06_mockup/v1/v1-ops-catalog.html の状態 ge と一致 |  | G-06・G-07 | T-U-43 | L1 |
| SCR-OPS-CATALOG-008 | ops-catalog | 役割 | 役割 R6 で開くと、その役割の中身（data-roles）が出て、他の役割の中身は出ない | R6 でログイン | 画面を開く | 役割ごとの中身（G15） |  |  | T-U-43 | L1 |
| SCR-OPS-CATALOG-009 | ops-catalog | 主アクション | 「版を出す」を押すと対応する endpoint が呼ばれ、別 GET で再取得した画面に反映される | 権限のある会員 | 押す | DB と画面が変わる（G-01・G-03） |  | GET /api/ai_employees GET /api/ai_employees | T-U-43 | L1 |
| SCR-OPS-CATALOG-010 | ops-catalog | 到達性 | リンク先 account が実在ルートで 200 で開く | — | 押す | /account が開く（G-04） |  |  | T-U-43 | L1 |
| SCR-OPS-CATALOG-011 | ops-catalog | 到達性 | リンク先 account-close が実在ルートで 200 で開く | — | 押す | /account-close が開く（G-04） |  |  | T-U-43 | L1 |
| SCR-OPS-CATALOG-012 | ops-catalog | 到達性 | リンク先 ai-activity が実在ルートで 200 で開く | — | 押す | /ai-activity が開く（G-04） |  |  | T-U-43 | L1 |
| SCR-OPS-CATALOG-013 | ops-catalog | 到達性 | リンク先 ai-staff が実在ルートで 200 で開く | — | 押す | /ai-staff が開く（G-04） |  |  | T-U-43 | L1 |
| SCR-OPS-CATALOG-014 | ops-catalog | 到達性 | リンク先 approvals が実在ルートで 200 で開く | — | 押す | /approvals が開く（G-04） |  |  | T-U-43 | L1 |
| SCR-OPS-CATALOG-015 | ops-catalog | 到達性 | リンク先 audit が実在ルートで 200 で開く | — | 押す | /audit が開く（G-04） |  |  | T-U-43 | L1 |
| SCR-OPS-CATALOG-016 | ops-catalog | 到達性 | リンク先 automation-repair が実在ルートで 200 で開く | — | 押す | /automation-repair が開く（G-04） |  |  | T-U-43 | L1 |
| SCR-OPS-CATALOG-017 | ops-catalog | 到達性 | リンク先 billing が実在ルートで 200 で開く | — | 押す | /billing が開く（G-04） |  |  | T-U-43 | L1 |
| SCR-OPS-CATALOG-018 | ops-catalog | 横溢れ | 375・768・1024・1440 で scrollWidth - clientWidth <= 1、1180+ で本文 720 以上 | — | 各幅で開く | 溢れ 0 |  | G-05 | T-U-43 | L1 |
| SCR-OPS-CATALOG-019 | ops-catalog | 空・止まっている | データ 0 件の状態と AI が止まっている状態が cover 宣言どおりに出る | PS2 / PS4 | 開く | 空状態と止まっている帯 |  | G18 | T-U-43 | L1 |
| SCR-OPS-CATALOG-020 | ops-catalog | 表記ゆらぎ | 全角／半角：メール・数値・コードを全角で入れる | 入力欄がある状態 | 入力して保存 | 同一として扱われ、サーバー側で正規化されて保存される（クライアント側だけに頼らない） |  | human-grade-qa 第11軸 | T-U-43 | L1 |
| SCR-OPS-CATALOG-021 | ops-catalog | 表記ゆらぎ | 前後と途中の空白：空白付きで入れる | 入力欄がある状態 | 入力して保存 | 同一として扱われ、サーバー側で正規化されて保存される（クライアント側だけに頼らない） |  | human-grade-qa 第11軸 | T-U-43 | L1 |
| SCR-OPS-CATALOG-022 | ops-catalog | 表記ゆらぎ | 記号の種別（ハイフン・長音）：‐ ー − を混ぜる | 入力欄がある状態 | 入力して保存 | 同一として扱われ、サーバー側で正規化されて保存される（クライアント側だけに頼らない） |  | human-grade-qa 第11軸 | T-U-43 | L1 |
| SCR-OPS-CATALOG-023 | ops-catalog | 表記ゆらぎ | Unicode 正規化（NFC/NFD）：macOS の入力（NFD）で入れる | 入力欄がある状態 | 入力して保存 | 同一として扱われ、サーバー側で正規化されて保存される（クライアント側だけに頼らない） |  | human-grade-qa 第11軸 | T-U-43 | L1 |
| SCR-OPS-CATALOG-024 | ops-catalog | 表記ゆらぎ | 大文字小文字：メールを大文字で入れる | 入力欄がある状態 | 入力して保存 | 同一として扱われ、サーバー側で正規化されて保存される（クライアント側だけに頼らない） |  | human-grade-qa 第11軸 | T-U-43 | L1 |
| SCR-OPS-CATALOG-025 | ops-catalog | G-11 外部リソースの実在 | N/A：外部リソースを触らない | migration/IaC 適用後 | 起動時の存在確認を読む | 無ければ起動時に落ちる（黙って 502 にならない） |  | 環境ごと | T-U-43 | L1 |
| SCR-OPS-CATALOG-026 | ops-catalog | G-12 切り替わりの瞬間 | Bridge が切れた直後 0 秒・鮮度窓の内側に操作する | 本番稼働中 | PC を閉じた直後に主アクションを押す | 「AI は止まっています」が出て、押した内容は失われない |  |  | T-U-43 | L1 |
| SCR-OPS-CATALOG-027 | ops-catalog | G-13 機能の組み合わせ | 実行中 × 切替／中断 × 再開／別ロール同時 の直積のうち該当分 | — | 同時に起こす | 後勝ちでなく、規則どおり（承認は 1 人 1 回・切替は次の実行から） |  | features.json combination_points | T-U-43 | L1 |
| SCR-OPS-CATALOG-028 | ops-catalog | G-14 口座状態の波及 | 退会・停止・権限変更・パスワード変更の後に、この機能の既存セッション・接続・共有リンクが無効 | ログイン中の別端末と Bridge | 権限を変える | 別端末と Bridge は 0 秒で 401（sessions が revoked） |  |  | T-U-43 | L1 |
| SCR-OPS-CATALOG-029 | ops-catalog | G-15 信号なし終了 | N/A：外部を呼ばない | 外部を故意に切る | 実行する | 成功扱いにせず、502 と次の一手（人へのハンドオフ） |  |  | T-U-43 | L1 |
| SCR-OPS-CATALOG-030 | ops-catalog | G-16 有限資源 | 消費する資源：DB 接続（プール経由）・メモリ。1 要求あたり 1 接続以下・上限時は待機列 | 同時 50 要求 | 同時に叩く | ログインが落ちない・接続上限に張り付かない（関門 C2 のプール） |  | L4 で負荷試験 | T-U-43 | L1 |
