# T-US-05 デザイントークンと部品

着手 2026-09-16 ／ ブランチ main（W10） ／ 担当 Claude（高本さんレビュー）

## 着手前の確認
- 根拠は tickets の source（決定の文）。モックの `06_mockup/_shell.py`・`_tokens.py`・`04_design/DESIGN-kaname.md`・`05_flow/flow.json navigation` を写す。画面（T-U-*）は触らない
- 見本と治具の的は `apps/web/app/(dev)/dev/*`（本番では notFound）

## impl line
- `apps/web/styles/tokens.css`：DESIGN-kaname.md の色（primary／secondary／tertiary／surface／状態色 4／データ色 6）・書体・余白・角・書体の段を @theme と :root（_tokens.py と同じ名前）に
- `components/ui/`：Button（primary／secondary／outline／ghost／danger・sm・icon）・Pill（状態は面）・Section（段：罫線 1 本）・Table／Th／Td（数値列は右寄せ）・Empty（空の状態）・StoppedBanner（止まっている帯）・Field／Input（スマホ 16px・エラーは何が起きた＋一手）・Metric
- shadcn/ui（Base UI）は導入済み（@base-ui-components/react）。複合部品（Dialog・Select・Combobox）は使う画面（T-U-*）で足す

## 実行した結果（2026-09-16）
- Playwright（実 Chrome・BASE_URL=preview 3123・workers 1）21 本 PASS：reachability 4・layout 1・shell 8・ui 3・views 3
- apps/web type-check 0・root lint OK・ci:routes 最新

## 未了・BLOCKED
- staging は高本さん（infra/STAGING.md）。画面の L1 はローカルの実 Chrome で流している
- 実データ（API・DB）との往復は各画面（T-U-*）と結線（T-I-*）で
