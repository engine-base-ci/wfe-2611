# T-US-06 タイムラインと見え方の切替

着手 2026-09-16 ／ ブランチ main（W10） ／ 担当 Claude（高本さんレビュー）

## 着手前の確認
- 根拠は tickets の source（決定の文）。モックの `06_mockup/_shell.py`・`_tokens.py`・`04_design/DESIGN-kaname.md`・`05_flow/flow.json navigation` を写す。画面（T-U-*）は触らない
- 見本と治具の的は `apps/web/app/(dev)/dev/*`（本番では notFound）

## impl line
- `components/views/timeline.tsx`＋`gantt-inner.tsx`：@svar-ui/react-gantt v2（svar-gantt の現行名。wx-react-gantt 1.3 は React 18 までで React 19 で落ちた）。ブラウザ専用なので next/dynamic ssr:false。文字列 id → 数値・最上位 parent 0・open は子を持つ行だけ（子の無い行に付けると store が落ちる）。棒を押すと右に詳細（select-task）・1023 以下は切替
- `view-switch.tsx`：リスト／カンバン（列に件数）／カレンダー（同じデータ・同じ描画関数）

## 実行した結果（2026-09-16）
- Playwright（実 Chrome・BASE_URL=preview 3123・workers 1）21 本 PASS：reachability 4・layout 1・shell 8・ui 3・views 3
- apps/web type-check 0・root lint OK・ci:routes 最新

## 未了・BLOCKED
- staging は高本さん（infra/STAGING.md）。画面の L1 はローカルの実 Chrome で流している
- 実データ（API・DB）との往復は各画面（T-U-*）と結線（T-I-*）で
