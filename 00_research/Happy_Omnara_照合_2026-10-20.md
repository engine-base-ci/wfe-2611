# Happy・Omnara と Kaname Bridge の照合（2026-10-20）

作成: 2026-10-20 / 状態: **調査のみ。実装・仕様・テストは変えていない**（user「3 を一旦進めましょう」）
読んだもの: Happy `slopus/happy` 最終コミット 2026-10-19 b99e7f8（MIT）／Omnara `omnara-ai/omnara` 最終コミット 2026-10-19 fdacf84（Apache-2.0）／Kaname `apps/bridge/src`（commit d2c7d33）
目的: Bridge の作りを「公開して動いている同型の実装」と突き合わせ、**差分を見直し・確認の材料にする**。真似するかどうかはここでは決めない。

---

## 0. 結論（3 行）

1. **E2E 暗号は、Kaname には合わない。** Happy の E2E は「サーバーは中継だけで中身を読まない」製品だから成立する。Kaname はサーバーが会話を読んで 記憶・検索・会社モデル・承認 を作る製品なので、E2E にすると中核が動かない。情シスの「運営も見られない」（§42）に効くのは E2E ではなく **会社ごとの鍵での保存時暗号＋行レベル制御＋明示的許可と証跡**（Omnara の封筒暗号の型）。段階 2 の候補として残す。
2. **Codex／Gemini の包み方は、Happy が答えをもう出している。** Codex は `codex app-server`（JSON-RPC・承認の割り込みが取れる）、Gemini は ACP（`@agentclientprotocol/sdk`・`session/request_permission`）。Kaname の `runner.ts` の `ask` フックは提供元に依存しない形（requestId／tool／input／summary）になっているので、段階 2（D-004・D-083）で足すのは **parseLine／controlResponse に相当する 1 層だけ**で済む見込み。
3. **中断・再接続は、形が違うだけで守っている事は同じ。** Happy は WebSocket＋seq の追い付き、Kaname は HTTP の polling＋記録からの取り戻し（D-112）＋孤児の掃除。Kaname に無くて Happy・Omnara にあるのは **PC を寝かせない**（caffeinate）と **「途中で止めた道具の結果は不明」の一言**（Omnara）。どちらも候補として記録、実装は変えない。

---

## 1. 3 つの実装の立ち位置（まずここを揃える）

| | Happy | Omnara（2026-10 時点） | Kaname Bridge |
|---|---|---|---|
| 何の製品か | スマホから自分の PC の Claude Code／Codex／Gemini を使う **中継アプリ**。サーバーは暗号文を運ぶだけ | **マネージド・エージェント基盤**（Claude Managed Agents の自前版）。モデルはサーバー側で回り、`omnarad`（PC に置くデーモン）は「道具を動かす機械」を貸す | 会社の目標管理 SaaS。本人の PC の **公式 CLI を本人のサブスクで**動かし、結果を会社の記憶・承認・証跡にする（D-092） |
| サーバーが会話を読むか | **読まない**（E2E） | 読む（平文で DB） | **読む**（記憶・検索・承認のため） |
| 鍵・秘密の置き場 | `~/.happy/` の設定ファイルに平文 | DB に AES-256-GCM の封筒（鍵は鍵で包む・AAD 付き） | Infisical（C8）。Bridge は仕事の間だけ受け取り、ディスクに書かない（`vault.ts`・D-102.2） |
| 対応エージェント | Claude（Agent SDK）／Codex（app-server）／Gemini（ACP）／OpenCode／OpenClaw | 自前のハーネス（モデルは OpenRouter・Bedrock・Anthropic・OpenAI 等） | Claude Code CLI のみ（段階 2 で 3 社・D-083） |
| 中継の経路 | socket.io（WebSocket）・seq で追い付き | WebSocket・心拍の間隔はサーバーが指示 | HTTP polling（心拍 60 秒・止める合図 1.5 秒・書きかけ 0.4 秒） |
| 配布 | `npm i -g happy-coder` ＋ QR で対にする | `npx omnara` ＋ ブラウザでサインイン・launchd／systemd に登録 | 署名した Electron ＋ 自動更新（T-B-06）。QR は段階 2（D-084） |

**Omnara は「Claude Code の包み」ではなくなっている。** changelog を見る限り、いまは API／SDK／CLI／MCP でエージェントを作る基盤で、`omnarad` は Bridge の「道具を動かす側」だけに相当する。Bridge の照合相手として使えるのは **デーモンの監督（再起動・更新の受け渡し）と秘密の封筒暗号** に限る。

---

## 2. 照合 ①：E2E の鍵の持ち方

### Happy の作り（読んだ場所：`happy-cli/src/ui/auth.ts`・`api/encryption.ts`・`api/api.ts`・`happy-server/prisma/schema.prisma`）

| 段 | 内容 |
|---|---|
| 対にする | CLI が 32 バイトの秘密を作り `tweetnacl.box.keyPair` にする。公開鍵を `happy://terminal?<pubkey>` の QR（かブラウザの URL）で見せる。スマホが自分の秘密を**使い捨て鍵で封じて**返し、CLI が開く（`decryptWithEphemeralKey`） |
| 鍵の形 | 旧：共通の 32 バイト `secret`（secretbox）。新：アカウントの公開鍵＋機械ごとの `machineKey`。セッションごとに乱数のデータ鍵を作り、アカウントの公開鍵で包んだもの（先頭 1 バイトが版）を `dataEncryptionKey` としてサーバーに置く |
| 何を封じるか | セッションの `metadata`・`agentState`（承認待ちの一覧を含む）・全メッセージ・RPC の引数と返り。XSalsa20-Poly1305（`tweetnacl.secretbox`） |
| サーバーが持つもの | `Session.metadata / agentState`（暗号文の base64）・`SessionMessage.content`・`dataEncryptionKey`。**サーバーのコードに decrypt は 1 か所も無い**（grep 0 件） |
| 鍵の保存 | `~/.happy/` の JSON に平文。ファイルロックで多重起動に耐える作り。Keychain は使っていない |

### Kaname の作り（`vault.ts`・`stream.ts`・D-100／D-102／D-112）

- **中身を集めない**のが守り方。道具の返り値・ファイルの中身は PC に置いたまま、Kaname に送るのは **名前・対象・成否・時間**（D-100.2）。会話の本文は送る（記憶・検索のため）。
- ログイン情報は Infisical に置き、Bridge は **仕事の間だけ**解いた値を受け取って捨てる（D-102.2）。ディスクに書かない・ログに出さない・AI には参照 ID だけ（D-107.7）。
- 鍵の保存という意味では **Kaname の方が厳しい**（Happy は秘密を平文で `~/.happy/` に置く）。

### 判定

| 観点 | 判定 |
|---|---|
| E2E を Kaname に入れるか | **入れない。** サーバーが読めないと 記憶（D-112）・会社モデル・承認（D-026）・検索 が作れない。Happy の E2E は「表示するだけの中継」だから成立する |
| 情シス（§42「運営も見られない」）への答え | **会社ごとの鍵で保存時に暗号化**（Omnara の `LocalKeyWrapper`：データ鍵を会社の鍵で包む・AAD にテナント ID）＋ RLS ＋ サポート時の明示的許可と証跡。鍵の置き場は Infisical（C8）か KMS。**段階 2 の候補**（決定は未） |
| 取り込める小さな型 | Happy の **「版のバイト＋包んだデータ鍵」** の形は、鍵の入れ替え（ローテーション）に効く。保存時暗号を入れるときの参考 |

---

## 3. 照合 ②：Codex／Gemini の包み方と、許可の中継

### Happy の作り

| 提供元 | 包み方 | 許可の取り方 | 読んだ場所 |
|---|---|---|---|
| Claude | `@anthropic-ai/claude-agent-sdk` の `query()` を**同じプロセス**で呼ぶ | `canUseTool` の callback。`toolUseID` で待ち行列に入れ、スマホの答え（approved／mode／allowTools／updatedInput）で解く。計画モードの出口（ExitPlanMode）は答えの mode で SDK の `setPermissionMode` を呼ぶ | `claude/utils/permissionHandler.ts`・`claude/claudeRemote.ts` |
| Codex | `codex app-server`（JSON-RPC・双方向）。以前の `codex mcp` では承認が取れなかったので移った（`codexAppServerClient.ts` 冒頭のコメント） | `exec:request`／`patch:request`／`mcp:call` の承認 callback。`approvalPolicy`＋sandbox を明示。`turn/interrupt` で止める | `codex/codexAppServerClient.ts`・`codex/utils/permissionHandler.ts` |
| Gemini | ACP（`@agentclientprotocol/sdk`）で子プロセスと stdio | `session/request_permission` を受けて答える。許可モード（default／acceptEdits／bypass）は Happy 側で判定して自動許可か問い合わせ | `gemini/runGemini.ts`・`gemini/utils/permissionHandler.ts`・`agent/acp/AcpBackend.ts` |
| 共通 | `BasePermissionHandler`：pending の Map・`abortAll()`（止めたら待ち中の許可を `abort` で解く）・`reset()`・`agentState.requests／completedRequests` に写してスマホに見せる | | `utils/BasePermissionHandler.ts` |

### Kaname の作り（`runner.ts`・`stream.ts`・`loop.ts`・`modes.ts`）

- CLI を **未改変のまま**子プロセスで起こす：`-p --input-format stream-json --output-format stream-json --permission-prompt-tool stdio`（D-092②・D-093）。SDK を同じプロセスで呼ぶ Happy とは層が 1 つ違う。
- 許可は `control_request(can_use_tool)` を `parseLine` で `ask` に直し、`/bridge/ask` → 画面 → `/bridge/answer2` を 1.5 秒ごとに最長 30 分見に行き、`control_response` で `allow／deny（理由つき）` を返す。問い合わせ（AskUserQuestion）は `updatedInput.answers` に「問い → 答え」（D-104.5）。
- 許可のモードは `manual／acceptEdits／auto／plan／bypassPermissions` を `--permission-mode` で渡す。`--dangerously-skip-permissions` は渡さない（`claude-terms.mjs` が検査）。モードに関わらず **台帳で禁止・銀行の宛先はフックで止める**（D-107）。
- `ask` フックの型（`{ requestId, tool, input, summary }` → `{ allow, note, answers }`）は **Claude の語を含まない**。Claude 固有なのは `parseLine`（stream-json）と `controlResponse` の 2 関数だけ。

### 判定

| 観点 | 判定 |
|---|---|
| 段階 2 で Codex／Gemini を足す道 | **Happy と同じ層を使う**：Codex は app-server（JSON-RPC）、Gemini は ACP。`codex mcp` 経由は承認が取れないので使わない（Happy が踏んだ穴） |
| Kaname 側で変える範囲（見込み） | `stream.ts` の `parseLine／controlResponse` に相当する **提供元ごとの 1 層** と、`modes.ts` の対応表。`loop.ts`・API・画面は触らない見込み（`ask` が提供元に依存しないため）。D-083 の分解のときにこの見込みを前提にできる |
| Happy の失敗から学ぶ | `CodexPermissionHandler` の自動許可は、かつて **ツール ID の部分一致**で判定していて「ID に change_title を含む何でも通る」穴があった（コメントに記録）。Kaname の `allowed_tools` は `^[A-Za-z][\w-]{0,40}(\(.{0,300}\))?$` の完全一致で、同じ穴は無い。**自動許可は完全一致だけ**を規則として残す |
| 止めたときの待ち中の許可 | Happy は `abortAll()` で `abort` として解く。Kaname は `kill → done(stopped)` で CLI ごと終わるので、待ち中の `control_request` は答えずに消える（答える相手がいない）。**同じ結果。** ただし Kaname は「答えを待っている間は無進捗の時計を止める」（`waitingHuman`）を持ち、Happy には無い |
| SDK か CLI か | Happy の SDK 同居は「本人の PC で本人のログイン」なので規約上は同じ扱い。Kaname が CLI（未改変バイナリ）を選んだのは D-092② を文字どおり守るため。**変えない** |

---

## 4. 照合 ③：中断・再接続

### 3 つの作り

| 観点 | Happy | Omnara（omnarad） | Kaname |
|---|---|---|---|
| つなぎ直し | socket.io は `reconnection:false`。自前で 1 秒後に 1 回、以後 3 秒ごと。**ネットが戻ったか**を見てから接続（`shouldReconnect`） | WebSocket。心拍の次の間隔は **サーバーが返す**（`next_heartbeat_after_ms`）。実行の lease 90 秒（15 秒〜30 分） | HTTP。失敗したら `alive=false` にして 5 秒後に再試行。401／403／410 は「この端末はもう登録されていない」として接続を切る（G-14）。心拍 60 秒・生死の判定は last_seen 75 秒 |
| 取りこぼしの回収 | `lastReceivedSeq` の続きから fetch（**自分の POST で cursor を進めない**——進めると相手の 1 件を飛ばす不具合があった、とコメントに記録） | 報告は `report_id` で ack。ack が無ければ再送 | つながったとき・仕事が終わったときに **`~/.claude/projects` の記録から**写し漏れを取り戻す（D-112）。同じ id は二度入れない |
| 止める | スマホから RPC `abort` → `AbortController` で SDK の query を止める。待ち中の許可は `abort` で解く | `turn` の中断。「**Tool call was interrupted; its external outcome is unknown.**」を会話に残す | 1.5 秒ごとに `/bridge/control` を見て `SIGTERM`。理由「あなたが止めました」を会話に残す。無進捗 N 分でも止める（答え待ちは数えない） |
| 途中で死んだ Bridge の仕事 | daemon が spawn／resume の ack で「準備できた」を判定 | 監督プロセスが子を再起動（3 秒 → 最大 3 分の後退・5 分安定で戻す）。更新は終了コードで受け渡し | 1 人に Bridge は 1 つ（claim で前の鍵は切れる）。つなぎ直したとき `bridge_sweep_orphans` が「動いている・答え待ちのまま残った仕事」を理由つきで止め、会話にも残す |
| 続きから | `--resume <claude session id>`／Codex は thread id。**記録が無ければ新規に落とす**（`claudeCheckSession`） | — | `--resume agent_session_id`。1 会話 ＝ PC の 1 セッション（D-104） |
| PC を寝かせない | `caffeinate` を起動中ずっと（mac） | launchd／systemd のサービス | **無い**（`powerSaveBlocker` 等の呼び出しは 0 件）。`openAtLogin` と自動更新はある |

### 判定

| 観点 | 判定 |
|---|---|
| 守っている事 | 3 つとも「切れても取りこぼさない」「死んだら理由を残す」「続きから戻る」を持つ。Kaname は WebSocket を使わない分、**記録（PC の jsonl）を正本にして取り戻す**形で同じ事を達している。形の違いで、欠けではない |
| 候補①：PC が寝ると止まる | Happy は caffeinate、Omnara はサービス。Kaname の Bridge は PC が寝たら心拍が止まり、75 秒で「切れている」になる。段階 2 のアプリ（D-084）の論点として記録。段階 1 で入れるかは **user の判断**（Electron の `powerSaveBlocker` で数行だが、本人の PC の電源設定を製品が変える話なので勝手に入れない） |
| 候補②：止めた道具の結果は不明 | Omnara の一文は正しい。Kaname の「あなたが止めました」は、途中だった道具（送信・書き込み）の結末を言っていない。**エラー一覧（E-…）の文言の候補**として記録。実装は変えない |
| 候補③：記録が無いときの `--resume` | Happy は `claudeCheckSession` で記録の有無を見て、無ければ新規にする。Kaname の `runner.ts` は `agent_session_id` があれば無条件に `--resume` を渡す。本人が `~/.claude` を消した・別の PC につなぎ直した場合に何が起きるか、**T-I-01 か Bridge の次のチケットで実機で確かめる**（いまは「確認が要る」で、不具合とは断定しない） |
| 取り込まない | Happy の seq の cursor の話は、Kaname では D-112 の「`await sent` で写した文が先に届いてから区切りを渡す」で同じ順序の問題を既に押さえている |

---

## 5. 「真似した方が楽か」への答え

| 選択 | 判定 | 理由 |
|---|---|---|
| Happy をそのまま土台にする | **しない** | Happy は E2E の中継アプリ。Kaname はサーバーが読む製品で、鍵・DB・画面の前提が全部違う。合わせる方が作り直しになる |
| Happy の部品を写す | **段階 2 で 2 か所だけ** | Codex app-server の承認の中継（`codexAppServerClient.ts`）と Gemini の ACP の包み（`AcpBackend.ts`）。MIT。写すときは L-021（偽の CLI の試験だけで done にしない）を守り、実物を 1 回動かす |
| Omnara の部品を写す | **段階 2 の候補** | 秘密の封筒暗号（`internal/secrets/secrets.go`：データ鍵を鍵で包む・AAD・鍵の入れ替え）。Apache-2.0。会社ごとの保存時暗号を決めたときの手本 |
| いまの Bridge を変える | **変えない** | 3 つの照合で「欠け」と言えるものは無かった。候補①〜③はいずれも決定が要る話で、実装者が勝手に入れない（L-010） |

---

## 6. 決定（2026-10-20・user「これ完璧にしてね」で 5 つとも決めた）

| # | 候補だったこと | 決定 | 反映先 |
|---|---|---|---|
| C-1 | 会社ごとの鍵での保存時暗号。E2E は採らない | **D-122**（段階 2） | T-V2-06（仕様づくり）・アーキテクチャ設計書 6c |
| C-2 | Codex は app-server・Gemini は ACP。自動許可は完全一致のみ | **D-123**（段階 2） | T-V2-07（仕様づくり）・アーキテクチャ設計書 6c・CLI の表 |
| C-3 | 仕事の間 PC を寝かせない | **D-124.1**（段階 1） | T-B-42・`apps/bridge/src/awake.ts`（powerSaveBlocker は working の間だけ） |
| C-4 | 止めたとき「途中だった道具の結末は不明」 | **D-124.2**（段階 1） | T-B-42・E-SIG-003・`runner.ts inflightNote` |
| C-5 | 記録が無いときの `--resume` | **D-124.3**（段階 1・**不具合だった**） | T-B-42・E-NF-003・`runner.ts isResumeLost`＋`--resume` 無しで 1 回やり直し |

C-5 は本物の Claude Code 2.1.283 で確かめた：存在しない id を `--resume` すると stderr に `No conversation found with session ID`、result は `is_error`・`error_during_execution`・`num_turns 0`・`duration_api_ms 0`・本文なし。
Claude Code は既定 30 日で記録を消すので、古い会話の続きでは必ず起きる。直す前の runner はこれを「Claude Code が途中で終わりました」で止めるだけで、その会話は二度と動かなかった。
