# T-US-04 認証の配管

着手 2026-09-16 ／ ブランチ main（W10） ／ 担当 Claude（高本さんレビュー）

## 着手前の確認
- 根拠は tickets の source（決定の文）。モックの `06_mockup/_shell.py`・`_tokens.py`・`04_design/DESIGN-kaname.md`・`05_flow/flow.json navigation` を写す。画面（T-U-*）は触らない
- 見本と治具の的は `apps/web/app/(dev)/dev/*`（本番では notFound）

## impl line
- `apps/web/lib/auth/client.ts`：Better Auth の client（basePath /api/auth・Bearer・set-auth-token を localStorage に）・twoFactorClient・DeviceRow
- `session.tsx`：useSession・RequireSession（無ければ /login?next=）・signOut（トークンを消す）
- ログイン・2 段階・招待の画面は T-U-*（login／mfa-setup／invite-accept／password-reset）がこの配管を使う

## 実行した結果（2026-09-16）
- Playwright（実 Chrome・BASE_URL=preview 3123・workers 1）21 本 PASS：reachability 4・layout 1・shell 8・ui 3・views 3
- apps/web type-check 0・root lint OK・ci:routes 最新

## 未了・BLOCKED
- staging は高本さん（infra/STAGING.md）。画面の L1 はローカルの実 Chrome で流している
- 実データ（API・DB）との往復は各画面（T-U-*）と結線（T-I-*）で
