# 関門（choke points）の置き場

正本は `03_architecture/choke-points.json`。**外界に影響する操作は、ここに挙げたパスの中からしか呼べない。**
迂回は CI（G16〜G25・T-F-07 で実装）が静的解析で落とす。例外は `03_architecture/choke-point-exceptions.md` だけ。

| 関門              | パス                | 業務ロジックが呼ぶ唯一の入口           | 塞ぐ生 API                                          |
| ----------------- | ------------------- | -------------------------------------- | --------------------------------------------------- |
| C1 ネットワーク   | `packages/actions/` | `executeAction(actionRef, input, ctx)` | fetch / axios / undici / node:http(s)               |
| C2 永続化         | `packages/db/`      | `repository.<entity>.<op>(input, ctx)` | pg / postgres / drizzle の生クライアント            |
| C3 モデル呼び出し | `packages/llm/`     | `llm.invoke(request, ctx)`             | anthropic / openai SDK                              |
| C4 ファイル       | `packages/storage/` | `objectStore.<op>(ref, ctx)`           | fs / S3 SDK                                         |
| C5 プロセス起動   | `packages/runtime/` | `runProcess(spec, ctx)`                | child_process                                       |
| C6 通知           | `packages/notify/`  | `notify(event, audience, ctx)`         | nodemailer / resend                                 |
| C7 決済           | `packages/billing/` | `billing.<op>(input, ctx)`             | stripe SDK                                          |
| C8 秘密           | `packages/secrets/` | `secrets.resolve(ref, ctx)`            | infisical SDK / process.env（起動設定は例外 X-002） |

関門の中で 1 回だけ書くもの：認可 → ポリシー判定 → 承認 → 副作用 → 記録（この順。副作用は必ず認可の後）。
各関門のパッケージは T-F-07〜T-F-14 が作る。ここに無いパッケージ名で外界に触れる実装は書かない。
