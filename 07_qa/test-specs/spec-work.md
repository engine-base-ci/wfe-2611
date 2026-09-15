# spec-work テスト仕様（L1・機械生成）

> 05_flow/build_tasks.py がタスクと同時に生成。ID は変えない。途中変更は qa_delta.py で差分。結果列は staging で流した人が書く（再生成しても残る。結果あり 0 行）。

| ID | 画面 | テスト観点 | テスト項目 | 前提条件 | 操作手順 | 期待結果 | 結果 | 備考 | タスク | 実行条件 |
|---|---|---|---|---|---|---|---|---|---|---|
| SPC-01-001 | 仕様 | 決定ログ | payment（課金）の E-PAY-*。C7 は N/A（理由つき）：決定ログに節（decision／status／reflect_in／決めたこと表）が足され、trace_gate T1〜T10 が緑 | この文が後回しのまま | 仕様づくりを 1 周回す | trace_gate PASS |  | D-069.8 | T-V2-01 | L1 |
| SPC-01-002 | 仕様 | 画面と行為 | payment（課金）の E-PAY-*。C7 は N/A（理由つき）：flow.json に行為・画面が入り、G17 の deferred からこの文が消える（release を v1 か次の段階に） | この文が後回しのまま | 仕様づくりを 1 周回す | flow_gate G1〜G10・G17 PASS |  | D-069.8 | T-V2-01 | L1 |
| SPC-01-003 | 仕様 | モック | payment（課金）の E-PAY-*。C7 は N/A（理由つき）：モックが時点・役割・空／止まっている を持ち、治具（状態・横溢れ・レイアウト）が緑 | この文が後回しのまま | 仕様づくりを 1 周回す | mock_state・role_gate・ui_lint・治具 ★0 |  | D-069.8 | T-V2-01 | L1 |
| SPC-01-004 | 仕様 | DB と設計書 | payment（課金）の E-PAY-*。C7 は N/A（理由つき）：オブジェクトに ER 図の表と設計書の節がある（G20）。エラー一覧に異常状態が足されている（E1〜E9） | この文が後回しのまま | 仕様づくりを 1 周回す | er_gate・error_catalog gate PASS |  | D-069.8 | T-V2-01 | L1 |
| SPC-01-005 | 仕様 | 下流の再生成 | payment（課金）の E-PAY-*。C7 は N/A（理由つき）：functional → api → features → tasks → tickets → waves → test-plan を再生成し、実装タスクが日程に出る | この文が後回しのまま | 仕様づくりを 1 周回す | layer_audit --run PASS・ticket_gate PASS |  | D-069.8 | T-V2-01 | L1 |
| SPC-02-001 | 仕様 | 決定ログ | Stripe 課金：決定ログに節（decision／status／reflect_in／決めたこと表）が足され、trace_gate T1〜T10 が緑 | この文が後回しのまま | 仕様づくりを 1 周回す | trace_gate PASS |  | D-081.2 | T-V2-02 | L1 |
| SPC-02-002 | 仕様 | 画面と行為 | Stripe 課金：flow.json に行為・画面が入り、G17 の deferred からこの文が消える（release を v1 か次の段階に） | この文が後回しのまま | 仕様づくりを 1 周回す | flow_gate G1〜G10・G17 PASS |  | D-081.2 | T-V2-02 | L1 |
| SPC-02-003 | 仕様 | モック | Stripe 課金：モックが時点・役割・空／止まっている を持ち、治具（状態・横溢れ・レイアウト）が緑 | この文が後回しのまま | 仕様づくりを 1 周回す | mock_state・role_gate・ui_lint・治具 ★0 |  | D-081.2 | T-V2-02 | L1 |
| SPC-02-004 | 仕様 | DB と設計書 | Stripe 課金：オブジェクトに ER 図の表と設計書の節がある（G20）。エラー一覧に異常状態が足されている（E1〜E9） | この文が後回しのまま | 仕様づくりを 1 周回す | er_gate・error_catalog gate PASS |  | D-081.2 | T-V2-02 | L1 |
| SPC-02-005 | 仕様 | 下流の再生成 | Stripe 課金：functional → api → features → tasks → tickets → waves → test-plan を再生成し、実装タスクが日程に出る | この文が後回しのまま | 仕様づくりを 1 周回す | layer_audit --run PASS・ticket_gate PASS |  | D-081.2 | T-V2-02 | L1 |
| SPC-03-001 | 仕様 | 決定ログ | LLM の経路の追加：決定ログに節（decision／status／reflect_in／決めたこと表）が足され、trace_gate T1〜T10 が緑 | この文が後回しのまま | 仕様づくりを 1 周回す | trace_gate PASS |  | D-081.3 | T-V2-03 | L1 |
| SPC-03-002 | 仕様 | 画面と行為 | LLM の経路の追加：flow.json に行為・画面が入り、G17 の deferred からこの文が消える（release を v1 か次の段階に） | この文が後回しのまま | 仕様づくりを 1 周回す | flow_gate G1〜G10・G17 PASS |  | D-081.3 | T-V2-03 | L1 |
| SPC-03-003 | 仕様 | モック | LLM の経路の追加：モックが時点・役割・空／止まっている を持ち、治具（状態・横溢れ・レイアウト）が緑 | この文が後回しのまま | 仕様づくりを 1 周回す | mock_state・role_gate・ui_lint・治具 ★0 |  | D-081.3 | T-V2-03 | L1 |
| SPC-03-004 | 仕様 | DB と設計書 | LLM の経路の追加：オブジェクトに ER 図の表と設計書の節がある（G20）。エラー一覧に異常状態が足されている（E1〜E9） | この文が後回しのまま | 仕様づくりを 1 周回す | er_gate・error_catalog gate PASS |  | D-081.3 | T-V2-03 | L1 |
| SPC-03-005 | 仕様 | 下流の再生成 | LLM の経路の追加：functional → api → features → tasks → tickets → waves → test-plan を再生成し、実装タスクが日程に出る | この文が後回しのまま | 仕様づくりを 1 周回す | layer_audit --run PASS・ticket_gate PASS |  | D-081.3 | T-V2-03 | L1 |
| SPC-04-001 | 仕様 | 決定ログ | PWA：決定ログに節（decision／status／reflect_in／決めたこと表）が足され、trace_gate T1〜T10 が緑 | この文が後回しのまま | 仕様づくりを 1 周回す | trace_gate PASS |  | D-081.4 | T-V2-04 | L1 |
| SPC-04-002 | 仕様 | 画面と行為 | PWA：flow.json に行為・画面が入り、G17 の deferred からこの文が消える（release を v1 か次の段階に） | この文が後回しのまま | 仕様づくりを 1 周回す | flow_gate G1〜G10・G17 PASS |  | D-081.4 | T-V2-04 | L1 |
| SPC-04-003 | 仕様 | モック | PWA：モックが時点・役割・空／止まっている を持ち、治具（状態・横溢れ・レイアウト）が緑 | この文が後回しのまま | 仕様づくりを 1 周回す | mock_state・role_gate・ui_lint・治具 ★0 |  | D-081.4 | T-V2-04 | L1 |
| SPC-04-004 | 仕様 | DB と設計書 | PWA：オブジェクトに ER 図の表と設計書の節がある（G20）。エラー一覧に異常状態が足されている（E1〜E9） | この文が後回しのまま | 仕様づくりを 1 周回す | er_gate・error_catalog gate PASS |  | D-081.4 | T-V2-04 | L1 |
| SPC-04-005 | 仕様 | 下流の再生成 | PWA：functional → api → features → tasks → tickets → waves → test-plan を再生成し、実装タスクが日程に出る | この文が後回しのまま | 仕様づくりを 1 周回す | layer_audit --run PASS・ticket_gate PASS |  | D-081.4 | T-V2-04 | L1 |
| SPC-05-001 | 仕様 | 決定ログ | 情シス向けの開示資料：決定ログに節（decision／status／reflect_in／決めたこと表）が足され、trace_gate T1〜T10 が緑 | この文が後回しのまま | 仕様づくりを 1 周回す | trace_gate PASS |  | D-081.5 | T-V2-05 | L1 |
| SPC-05-002 | 仕様 | 画面と行為 | 情シス向けの開示資料：flow.json に行為・画面が入り、G17 の deferred からこの文が消える（release を v1 か次の段階に） | この文が後回しのまま | 仕様づくりを 1 周回す | flow_gate G1〜G10・G17 PASS |  | D-081.5 | T-V2-05 | L1 |
| SPC-05-003 | 仕様 | モック | 情シス向けの開示資料：モックが時点・役割・空／止まっている を持ち、治具（状態・横溢れ・レイアウト）が緑 | この文が後回しのまま | 仕様づくりを 1 周回す | mock_state・role_gate・ui_lint・治具 ★0 |  | D-081.5 | T-V2-05 | L1 |
| SPC-05-004 | 仕様 | DB と設計書 | 情シス向けの開示資料：オブジェクトに ER 図の表と設計書の節がある（G20）。エラー一覧に異常状態が足されている（E1〜E9） | この文が後回しのまま | 仕様づくりを 1 周回す | er_gate・error_catalog gate PASS |  | D-081.5 | T-V2-05 | L1 |
| SPC-05-005 | 仕様 | 下流の再生成 | 情シス向けの開示資料：functional → api → features → tasks → tickets → waves → test-plan を再生成し、実装タスクが日程に出る | この文が後回しのまま | 仕様づくりを 1 周回す | layer_audit --run PASS・ticket_gate PASS |  | D-081.5 | T-V2-05 | L1 |
