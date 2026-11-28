# T-US-01 シェル

着手 2026-09-16 ／ ブランチ main（W10） ／ 担当 Claude（高本さんレビュー）

## 着手前の確認
- 根拠は tickets の source（決定の文）。モックの `06_mockup/_shell.py`・`_tokens.py`・`04_design/DESIGN-kaname.md`・`05_flow/flow.json navigation` を写す。画面（T-U-*）は触らない
- 見本と治具の的は `apps/web/app/(dev)/dev/*`（本番では notFound）

## impl line
- `apps/web/components/shell/`：context（役割・時点の caps・枠の導出 deriveFrame・画面の型・第2ナビの形・パネルの記憶）・gates（PsGate＝data-requires／RoleGate＝data-roles）・sidebar（6 section・役割で本数・グループ開閉・バッジは data-requires=data）・subnav（column／anchors／三画面は横チップ）・tabbar（下タブ 4＋メニュー）・topbar（くくり・h1・AI トグル・主アクション 1）・threepane（一覧 380｜中身 640＋｜1023 以下は切替）・app-shell（本文の最小幅 720 で第2ナビを上の帯に畳む・norole）・shell.css（_shell.py／_tokens.py の写し。名前も同じ）
- ナビは flow.json から生成（`scripts/ci/gen_routes.mjs` → `lib/nav.ts`・ci:routes で鮮度）

## 実行した結果（2026-09-16）
- Playwright（実 Chrome・BASE_URL=preview 3123・workers 1）21 本 PASS：reachability 4・layout 1・shell 8・ui 3・views 3
- apps/web type-check 0・root lint OK・ci:routes 最新

## 未了・BLOCKED
- staging は高本さん（infra/STAGING.md）。画面の L1 はローカルの実 Chrome で流している
- 実データ（API・DB）との往復は各画面（T-U-*）と結線（T-I-*）で
