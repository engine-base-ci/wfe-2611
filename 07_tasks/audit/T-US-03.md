# T-US-03 API クライアントと型

着手 2026-09-16 ／ ブランチ main（W10） ／ 担当 Claude（高本さんレビュー）

## 着手前の確認
- 根拠は tickets の source（決定の文）。モックの `06_mockup/_shell.py`・`_tokens.py`・`04_design/DESIGN-kaname.md`・`05_flow/flow.json navigation` を写す。画面（T-U-*）は触らない
- 見本と治具の的は `apps/web/app/(dev)/dev/*`（本番では notFound）

## impl line
- `apps/web/lib/api/client.ts`：request（Bearer・x-screen-id・書き込みは idempotency-key 必須）・ApiRequestError（正本のエラーの形）・401 → setUnauthorizedHandler・api.list/get/create/update/remove は契約（ENDPOINTS）から path を引く（無い組は例外）・saveDraft／takeDraft
- `query.tsx`：ApiProvider（QueryClient・401 で /login?next=）・useList／useOne／useCreate／useUpdate／useRemove（成功後は無効化→別 GET）
- next.config：transpilePackages と extensionAlias（workspace の NodeNext を bundler に解かせる）。`packages/contracts` に EndpointKind を export

## 実行した結果（2026-09-16）
- Playwright（実 Chrome・BASE_URL=preview 3123・workers 1）21 本 PASS：reachability 4・layout 1・shell 8・ui 3・views 3
- apps/web type-check 0・root lint OK・ci:routes 最新

## 未了・BLOCKED
- staging は高本さん（infra/STAGING.md）。画面の L1 はローカルの実 Chrome で流している
- 実データ（API・DB）との往復は各画面（T-U-*）と結線（T-I-*）で
