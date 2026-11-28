# Kaname — OSS 候補一覧（全領域）

作成: 2026-09-04 / 状態: **候補の洗い出し完了・採用は未決定**
**全て GitHub API で LICENSE を実確認済み**（★数は 2026-09-04 時点）

---

## ライセンスの読み方（この表の前提）

| 区分 | 意味 | Kaname での可否 |
|---|---|---|
| MIT / Apache-2.0 / BSD / ISC / MPL-2.0 / PostgreSQL | 制限なし（MPLはファイル単位のコピーレフト） | **組み込み可** |
| **Open Core**（本体 MIT/Apache ＋ `ee/` だけ商用） | `ee/` を使わなければ自由 | **`ee/` を使わない限り可** |
| **AGPL-3.0** | 改変してネットワーク提供 → ソース公開義務 | **組み込み不可**（別プロセスで無改変利用のみ検討可） |
| **SSPL** | SaaS 提供時に運用スタック全体の公開義務 | **不可** |
| **Elastic License 2.0** | 機能を第三者にホスト提供不可 | **不可** |
| **BSL / MSCL** | 期限付き商用制限 | **要個別判断** |
| **GPL-2.0 / GPL-3.0** | リンクすると伝播 | **別プロセスで呼ぶだけなら可** |

---

## 1. AI 実行基盤（エージェントランタイム）

| 候補 | License | ★ | 所見 |
|---|---|---|---|
| **anthropics/claude-agent-sdk-python** | MIT | 8.0k | Claude Code と同じハーネス。Bridge の中核候補 |
| **openai/openai-agents-python** | MIT | 29.2k | OpenAI 側の同等品。プロバイダ拡張時 |
| **langchain-ai/langgraph** | MIT | 41.0k | 状態機械としてのエージェント。Atelier が採用 |
| **pydantic/pydantic-ai** | MIT | 19.7k | 型安全。Python なら有力 |
| **crewAIInc/crewAI** | MIT | 58.1k | マルチエージェント。COO 配下の構成に近い |
| **microsoft/autogen** | CC-BY-4.0 | 60.8k | ライセンスがコード向けでない。**要注意** |
| **BerriAI/litellm** | Open Core（`enterprise/` 以外） | 58.0k | **プロバイダ切替の要**。能力表の実装に直結 |
| simonw/llm | Apache-2.0 | 12.5k | CLI 志向 |

## 2. ブラウザ操作（★Kaname の中核）

| 候補 | License | ★ | 所見 |
|---|---|---|---|
| **browser-use/browser-use** | **MIT** | 112.2k | 最大手。AI によるブラウザ操作 |
| **browserbase/stagehand** | **MIT** | 24.1k | observe→act。**操作キャッシュ＝1回覚えて再生** |
| **microsoft/playwright** | Apache-2.0 | 95.6k | 土台。決定的再生の実行エンジン |
| **microsoft/playwright-mcp** | Apache-2.0 | 36.8k | MCP 経由でブラウザ操作 |
| puppeteer/puppeteer | Apache-2.0 | 95.5k | Playwright の代替 |
| steel-dev/steel-browser | Apache-2.0 | 7.6k | AI 用ブラウザ基盤（サーバー側実行時） |
| ~~Skyvern-AI/skyvern~~ | **AGPL-3.0** | 22.9k | **組み込み不可**。「show once, run forever」の設計は参考価値大 |

## 3. デスクトップ・ローカル操作（Bridge）

| 候補 | License | ★ | 所見 |
|---|---|---|---|
| **electron/electron** | MIT | 122.9k | Atelier Bridge が採用済み |
| **tauri-apps/tauri** | Apache-2.0 | 110.8k | 軽量・省メモリ。Electron の代替 |
| **microsoft/node-pty** | MIT | 2.0k | ターミナル制御 |
| OpenAdaptAI/OpenAdapt | MIT | 1.7k | 画面操作の記録・再生 |

## 4. 記憶（長期記憶・個人化）

| 候補 | License | ★ | 所見 |
|---|---|---|---|
| **mem0ai/mem0** | Apache-2.0 | 64.7k | 最有力。事実の自動抽出＋vector/graph/KV |
| **getzep/graphiti** | Apache-2.0 | 30.6k | **時系列の知識グラフ**。「事実がいつ変わったか」を持てる |
| **letta-ai/letta** | Apache-2.0 | 24.6k | OS 型の階層記憶（自己編集） |
| **topoteretes/cognee** | Apache-2.0 | 30.4k | ナレッジ統合 |

## 5. RAG / 検索 / ベクトル

| 候補 | License | ★ | 所見 |
|---|---|---|---|
| **pgvector/pgvector** | PostgreSQL License | 22.9k | Postgres 内で完結。運用が最も軽い |
| run-llama/llama_index | MIT | 52.0k | RAG フレームワーク |
| langchain-ai/langchain | MIT | 145.6k | 汎用 |
| infiniflow/ragflow | Apache-2.0 | 90.0k | 文書理解に強い |
| deepset-ai/haystack | Apache-2.0 | 26.4k | 本番志向 |
| qdrant/qdrant | Apache-2.0 | 34.4k | 専用ベクトル DB（規模が出たら） |
| chroma-core/chroma | Apache-2.0 | 29.2k | 軽量 |
| weaviate/weaviate | BSD-3 | 16.8k | ハイブリッド検索 |
| qdrant/fastembed | Apache-2.0 | 3.2k | ローカル埋め込み（コスト 0） |
| meilisearch/meilisearch | Open Core（EE は BSL） | 59.2k | 全文検索 |
| ~~typesense/typesense~~ | GPL-3.0 | 26.5k | 別プロセスなら可 |

## 6. ワークフロー・ジョブ・cron（自律トリガーの土台）

| 候補 | License | ★ | 所見 |
|---|---|---|---|
| **temporalio/temporal** | MIT | 22.8k | 最も堅牢。別クラスタが要る |
| **hatchet-dev/hatchet** | MIT | 7.9k | Postgres ベース。運用が軽い |
| **dbos-inc/dbos-transact** | MIT | 1.6k | Postgres をそのまま永続層に。最軽量 |
| taskforcesh/bullmq | MIT | 9.4k | Redis ベースのジョブキュー |
| graphile/worker | MIT | 2.4k | Postgres ベース・軽量 |
| riverqueue/river | MPL-2.0 | 5.6k | Go・Postgres |
| ~~inngest/inngest~~ | **SSPL** | 5.8k | **不可**。★Atelier が使用中 → 要確認事項 |

## 7. 資格情報・秘密の保管（★セキュリティの核）

| 候補 | License | ★ | 所見 |
|---|---|---|---|
| **Infisical** | Open Core（`ee/` 以外 MIT） | 29.1k | UI・環境分離・アクセス制御が揃う |
| **openbao/openbao** | MPL-2.0 | 7.3k | Linux Foundation。Vault のフォーク。動的認証情報・PKI・暗号化サービス |
| hashicorp/vault | BUSL（現行） | 36.2k | 商用制限あり → OpenBao 推奨 |

## 8. 認証（ユーザー・組織・SSO）

| 候補 | License | ★ | 所見 |
|---|---|---|---|
| **better-auth/better-auth** | MIT | 29.8k | TS ネイティブ。組織・マルチテナントを標準装備 |
| **supabase/auth** | MIT | 2.6k | Supabase 採用時 |
| nextauthjs/next-auth | ISC | 28.4k | Next.js 定番 |
| keycloak/keycloak | Apache-2.0 | 36.6k | 重いが SSO/SAML が完備 |
| ory/kratos | Apache-2.0 | 13.9k | API 中心 |
| logto-io/logto | MPL-2.0 | 14.5k | 現代的・マルチテナント対応 |
| ~~zitadel/zitadel~~ | AGPL-3.0 | 14.9k | 組み込み不可 |

## 9. 認可（権限・ポリシー）

| 候補 | License | ★ | 所見 |
|---|---|---|---|
| **openfga/openfga** | Apache-2.0 | 5.7k | Google Zanzibar 方式。**「誰が何にどの操作を」を厳密に**。承認ポリシーに直結 |
| casbin/casbin | Apache-2.0 | 20.4k | 軽量・多言語 |
| permitio/opal | Apache-2.0 | 5.5k | ポリシー配信 |
| （Postgres RLS） | — | — | DB 層の最後の砦。上記と併用 |

## 10. DB 基盤・BaaS

| 候補 | License | ★ | 所見 |
|---|---|---|---|
| **supabase/supabase** | Apache-2.0 | 108.8k | Postgres+Auth+Storage+RLS+Realtime。旧 jobrain・Atelier で実績 |
| pocketbase/pocketbase | MIT | 60.9k | 単一バイナリ。小規模向け |
| （素の PostgreSQL） | PostgreSQL | — | 依存を減らす選択肢 |

## 11. ★動的台帳（会社モデルの中核・最重要領域）

「業界ごとに画面を作らない」を実現する部分。**先例から学ぶ価値が最も高い**。

| 候補 | License | ★ | 所見 |
|---|---|---|---|
| **appsmithorg/appsmith** | Apache-2.0 | 40.8k | **組み込み可**。内部ツール構築基盤 |
| **refinedev/refine** | MIT | 35.6k | **組み込み可**。React の CRUD フレームワーク。動的リソース定義 |
| nocodb/nocodb | Open Core（要精査） | 64.8k | Airtable 代替。**設計の教科書** |
| teableio/teable | 混合ライセンス（要精査） | 21.8k | 高機能な動的テーブル |
| baserow/baserow | Open Core（要精査） | 5.8k | 同上 |
| directus/directus | **MSCL-1.0-GPL**（2026 変更） | 37.7k | **ライセンス変更に注意**。動的スキーマの完成度は高い |
| ~~ToolJet~~ / ~~apitable~~ | AGPL-3.0 | 40.8k/15.6k | 組み込み不可。参考のみ |

## 12. ORM・スキーマ

| 候補 | License | ★ | 所見 |
|---|---|---|---|
| drizzle-team/drizzle-orm | Apache-2.0 | 35.7k | 軽量・型安全。Atelier 採用 |
| prisma/prisma | Apache-2.0 | 47.6k | 高機能 |
| kysely-org/kysely | MIT | 14.2k | クエリビルダ |
| sqlalchemy/sqlalchemy | MIT | 12.1k | Python |

## 13. UI 基盤

| 候補 | License | ★ | 所見 |
|---|---|---|---|
| shadcn-ui/ui | MIT | 123.0k | コピー方式。Atelier・旧 jobrain で実績 |
| radix-ui/primitives | MIT | 19.2k | アクセシビリティの土台 |
| tailwindlabs/tailwindcss | MIT | 97.4k | — |
| lucide-icons/lucide | ISC | 24.3k | **アイコンはこれ**（絵文字禁止の方針） |
| TanStack/table | MIT | 28.4k | **動的テーブル表示の中核** |
| react-hook-form | MIT | 44.8k | フォーム |
| colinhacks/zod | MIT | 43.8k | スキーマ検証 |
| **rjsf-team/react-jsonschema-form** | Apache-2.0 | 15.9k | **定義から自動でフォームを描く**＝動的台帳に直結 |
| clauderic/dnd-kit | MIT | 17.6k | カンバンの並べ替え |
| atlassian/pragmatic-drag-and-drop | Apache-2.0 | 12.7k | 高性能 D&D |
| recharts | MIT | 27.5k | グラフ |
| apache/echarts | Apache-2.0 | 67.2k | 高機能グラフ |
| ueberdosis/tiptap | MIT | 38.3k | リッチエディタ |
| udecode/plate | MIT | 16.6k | 同上 |

## 14. チャット UI・ストリーミング

| 候補 | License | ★ | 所見 |
|---|---|---|---|
| **assistant-ui/assistant-ui** | MIT | 12.0k | AI チャット UI。Atelier 採用 |
| **vercel/ai** | Apache-2.0 | 26.6k | ストリーミング・ツール呼び出しの標準 |

## 15. リアルタイム・同期

| 候補 | License | ★ | 所見 |
|---|---|---|---|
| yjs/yjs | MIT | 22.7k | 共同編集 CRDT |
| electric-sql/electric | Apache-2.0 | 10.4k | Postgres → クライアント同期 |
| powersync | 要精査 | 0.4k | オフライン対応 |

## 16. 課金

| 候補 | License | ★ | 所見 |
|---|---|---|---|
| stripe/stripe-node | MIT | 4.5k | 決済（Stripe 前提） |
| killbill/killbill | Apache-2.0 | 5.7k | サブスク課金基盤（自前で持つ場合） |
| lotus-data/lotus | Apache-2.0 | 1.7k | 従量課金 |

## 17. メール・通知

| 候補 | License | ★ | 所見 |
|---|---|---|---|
| resend/react-email | MIT | 19.7k | メールテンプレート |
| nodemailer/nodemailer | MIT | 17.7k | 送信 |
| **novuhq/novu** | Open Core（`enterprise/` 以外） | 39.7k | 通知基盤（メール/Slack/Push/アプリ内を一元化） |
| （Gmail API / Graph API） | — | — | **受信・下書き・送信の本命** |

## 18. ストレージ

| 候補 | License | ★ | 所見 |
|---|---|---|---|
| ~~minio/minio~~ | **AGPL-3.0** | 61.4k | **不可**。S3/R2/Supabase Storage を直接使う |

## 19. 文書生成（成果物）

| 候補 | License | ★ | 所見 |
|---|---|---|---|
| marp-team/marp | MIT | 12.4k | Markdown → スライド |
| scanny/python-pptx | MIT | 3.5k | PPTX |
| SheetJS/sheetjs | Apache-2.0 | 36.3k | Excel |
| foliojs/pdfkit | MIT | 10.7k | PDF |
| Stirling-Tools/Stirling-PDF | Open Core（MIT 本体） | 91.3k | PDF 加工 |
| jgm/pandoc | GPL-2.0 | 46.1k | **別プロセスで呼ぶなら可**（Docker で分離） |

## 20. 文書解析・音声

| 候補 | License | ★ | 所見 |
|---|---|---|---|
| **docling-project/docling** | MIT | 66.0k | PDF/Office → 構造化。IBM 製 |
| Unstructured-IO/unstructured | Apache-2.0 | 15.4k | 同上 |
| SYSTRAN/faster-whisper | MIT | 25.2k | 文字起こし（ローカル・コスト 0） |

## 21. 可観測性・LLM トレース

| 候補 | License | ★ | 所見 |
|---|---|---|---|
| **langfuse/langfuse** | Open Core（`ee/` 以外） | 34.2k | LLM トレース・コスト可視化。**AI 社員の実行証跡に直結** |
| traceloop/openllmetry | Apache-2.0 | 7.4k | OpenTelemetry 準拠 |
| ~~Arize-ai/phoenix~~ | **Elastic v2** | 11.3k | 不可 |
| getsentry/sentry | Open Core（FSL） | 44.7k | エラー監視。要精査 |
| ~~grafana/grafana~~ | AGPL-3.0 | 76.6k | 無改変の別プロセス運用なら可 |

## 22. MCP

| 候補 | License | ★ | 所見 |
|---|---|---|---|
| **modelcontextprotocol/servers** | MIT → Apache-2.0 移行中 | 90.1k | 公式サーバー群 |
| **modelcontextprotocol/typescript-sdk** | MIT → Apache-2.0 移行中 | 13.3k | MCP クライアント/サーバー実装 |
| punkpeye/fastmcp | MIT | 3.3k | MCP サーバーを短く書く |

## 23. ローカル LLM（エンタープライズ向けオプション）

| 候補 | License | ★ | 所見 |
|---|---|---|---|
| ollama/ollama | MIT | 180.1k | 導入が最も簡単 |
| ggml-org/llama.cpp | MIT | 127.0k | 省リソース |
| vllm-project/vllm | Apache-2.0 | 90.9k | 本番スループット |
| huggingface/TGI | Apache-2.0 | 10.9k | 同上 |

## 24. ファインチューニング（上位オプション）

| 候補 | License | ★ | 所見 |
|---|---|---|---|
| unslothai/unsloth | Apache-2.0 | 75.6k | 高速・省メモリ LoRA |
| hiyouga/LLaMA-Factory | Apache-2.0 | 74.6k | GUI つき |
| predibase/lorax | Apache-2.0 | 3.8k | **1000 単位のアダプタをマルチテナントで配信** |

## 25. テスト・品質

| 候補 | License | ★ | 所見 |
|---|---|---|---|
| microsoft/playwright | Apache-2.0 | 95.6k | E2E。QA 正本の実行 |

---

## ★ 特記事項（要判断・要注意）

1. **Inngest が SSPL** — Atelier が現在使用中。Kaname では不可。**Atelier 側にも影響あり、別途確認が必要**
2. **Directus が MSCL-1.0-GPL に変更**（2026） — 動的スキーマの参考にはなるが採用は不可
3. **Open Core は `ee/` を触らなければ自由** — litellm / Infisical / novu / langfuse / Stirling-PDF が該当。**採用時は「`ee/` を import しない」を CI で機械検査する**
4. **AGPL は無改変・別プロセス運用なら利用可**（Grafana 等）。ただしコードの取り込みは不可
5. **nocodb / teable / baserow は混合ライセンス** — 採用検討時は個別条項の精読が必須

---

## 次の作業（tech-stack フェーズ）
- この一覧から**領域ごとに 2〜3 案へ絞り、比較表を作って選定**する
- 選定基準：ライセンス / 保守性（★・更新頻度）/ 1 人開発での運用負荷 / セキュリティ / Kaname の要件適合
- **決め打ちしない**。候補を提示し、選択を確認してから確定する
