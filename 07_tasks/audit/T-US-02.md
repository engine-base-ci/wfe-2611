# T-US-02 自分のAIのパネルと会話の部品

着手 2026-09-16 ／ ブランチ main（W10） ／ 担当 Claude（高本さんレビュー）

## 着手前の確認
- 根拠は tickets の source（決定の文）。モックの `06_mockup/_shell.py`・`_tokens.py`・`04_design/DESIGN-kaname.md`・`05_flow/flow.json navigation` を写す。画面（T-U-*）は触らない
- 見本と治具の的は `apps/web/app/(dev)/dev/*`（本番では notFound）

## impl line
- `apps/web/components/ai/panel.tsx`：assistant-ui（ThreadPrimitive／ComposerPrimitive／useLocalRuntime）の右パネル。頭（AI の名前・いま見ている画面・会話モードへ・閉じる）・会話全体・入力（/配る /数値 /覚えて）。sonner の Toaster
- `parts.tsx`：ChoiceChips（その他・あとで必須）・ApprovalCard（宛先・金額・差分＋承認／直す／止める）・ReceiptCard（何が変わった・どこ・取り消し＋トースト）・Confidence（高／中／低＋根拠）・Citation
- `lib/agent-ui/`：AG-UI の HttpAgent adapter（Bridge の口。T-I-01 が接続）と unavailableAdapter（話せない理由を返す）

## 実行した結果（2026-09-16）
- Playwright（実 Chrome・BASE_URL=preview 3123・workers 1）21 本 PASS：reachability 4・layout 1・shell 8・ui 3・views 3
- apps/web type-check 0・root lint OK・ci:routes 最新

## 未了・BLOCKED
- staging は高本さん（infra/STAGING.md）。画面の L1 はローカルの実 Chrome で流している
- 実データ（API・DB）との往復は各画面（T-U-*）と結線（T-I-*）で
