# T-US-00 apps/web の土台

着手 2026-09-16 ／ ブランチ main（W9・1 本） ／ 担当 Claude（高本さんレビュー）

## 着手前の確認
- 根拠 D-043.3（業務ロジックは全部 API・画面は叩くだけ）・D-067.1（部品の土台）・D-084.1（PC は Bridge の窓に Web の画面）。技術選定 02_tech_stack/selected-stack.json frontend（Next.js 15 App Router・Tailwind v4・shadcn/ui（Base UI）・lucide-react）
- 画面のタスク 70 本が前提にする置き場（apps/web・tests・CI のブラウザ job）を作る。部品・シェル・トークンは触らない（T-US-01〜06）

## impl line
- `apps/web/`：package.json（next 15.5・react 19・tailwindcss 4・@playwright/test 1.63・lucide-react）・next.config.ts（typedRoutes）・app/layout.tsx・app/page.tsx（入口 /）・app/globals.css（@theme に DESIGN の最小トークン）
- `scripts/ci/gen_routes.mjs`：flow.json の screens[].route → `apps/web/lib/routes.ts`（64 route・hash）。`pnpm ci:routes` が鮮度を検査（foundation_gates #27・static job）
- `apps/web/tests/_lib/browser.ts`：WIDTHS 4 幅の横溢れ測定・app/**/page.tsx からの実在ルート・a[href] の収集・違反の判定・flow との差の報告
- `apps/web/tests/reachability.spec.ts`（4 本）・`tests/layout.spec.ts`（1 本）。`playwright.config.ts`：BASE_URL があれば staging、無ければ next dev（port 3123。3100 は Langfuse が使っていて誤って通った→変更）。PW_CHANNEL=chrome で入っている Chrome
- `apps/e2e/`：流れ（L2）の置き場（playwright.config.ts・journeys/README.md）。spec は T-I-09〜17
- CI：foundation_gates #15 を `pnpm e2e:web` に（e2e job・apps/web/playwright-report）。`.claude/launch.json` に web。root script web:dev／e2e:web／e2e:journeys／ci:routes
- .gitignore：.next・next-env.d.ts・playwright-report・test-results

## 実行した結果（2026-09-16）
- Playwright（実 Chrome）5 本 PASS：GET / 200・href ⊆ 実在ルート・検査が赤になれる（/no-such-route を違反として出す）・未実装の route 63 件を報告・4 幅の横溢れ 0
- apps/web type-check 0・root lint OK・ci:routes 最新・v3-gate.yml 再生成（gate 37 本・新しい関門は #27）
- Chromium のダウンロードが 2 回失敗（ネットワーク）。入っている Google Chrome（channel）で流した。CI は playwright install chromium

## 未了・BLOCKED
- staging（USH-00-005）は高本さん。PR での CI 実走（004）は GitHub のリモートの後
- shadcn/ui の部品・全トークンは T-US-05。共通シェルは T-US-01（入ったら 4 幅の測定を全画面で）
