# 関門の例外台帳 — Kaname

> 正本: `.claude/rules/common/choke-points.md`
> **関門を迂回してよいのは、ここに登録された例外だけ。** 登録の無い迂回は CI で fail。
> **台帳が短いほど良い。**

作成 2026-09-08 / 最終更新 2026-10-03

## 運用ルール
1. 迂回が必要になった時点で登録する（CI が先に落ちるので後回しにできない）
2. **代替統制を必ず書く**。書けないなら例外ではなく設計不備
3. **期限**を書く。恒久例外は `expires_at: null` とし、理由を明記する
4. 解消したら削除せず「解消済（タスク ID）」に書き換える

## 現在の例外（16 件・いずれも恒久）

| ID | 関門 | 迂回箇所 | 理由 | 代替統制 | 期限 | 状態 |
|----|-----|---------|------|---------|------|------|
| X-001 | **C4 ファイル** | `apps/bridge/src/` | Bridge は顧客 PC の中で動く実行器で、ローカルのファイルを読み書きするのは**機能そのもの**（作業フォルダ・Bridge の置き場・ログの記録・配布物の入れ替え）。サーバー側の objectStore とは対象が違う（2026-10-03：`src/workspace/` だけでは実態と合わず、迂回 10 件が赤のままだった） | 作業フォルダの範囲外は `guard.ts`（packages/bridge-guard）が止め、止めた事実を証跡へ送る（T-B-04・guard.test）。それ以外の fs は Bridge 自身の置き場（userData・browser-profile・一時フォルダ）と、sha256 を確かめた配布物の入れ替え（update.ts）だけ。資格情報の値は書かない（vault.test・login-check.test がファイルの中身で確かめる） | 恒久 | 有効 |
| X-003 | **C2 永続化** | `packages/auth/` | 認証（Better Auth）は境界 B2。schema `auth` の表を自前の接続（ロール kaname_auth）で読み書きするのが機能そのもの。public の表は関門の関数（app.open_session 等）経由 | kaname_auth は schema auth と関門の関数の execute だけ（public の表に権限なし・RLS 素通りなし）。証跡は app.record_security_event。CI G4 が public の全表 RLS を検査 | 恒久 | 有効 |
| X-004 | **C4 ファイル** | `packages/db/` | migration／policy の SQL ファイルを起動時に読む（関門 C2 の中の作業。利用者のファイルではない） | 読むのは packages/db/migrations と policies だけ・書かない・利用者由来のパスを受け取らない | 恒久 | 有効 |
| X-005 | **C1 ネットワーク** | `packages/secrets/src/infisical.ts` | 資格情報の預かり先（Infisical）への通信は関門 C8 の中の作業で、業務の外部送信ではない（D-101） | 宛先は設定の `INFISICAL_SITE_URL` だけ。送るのは会社ごとの鍵で暗号化した中身だけ。全アクセスは C8 の `secret.*` 証跡。失敗の理由に中身を入れない | 恒久 | 有効 |
| X-006 | **C1 ネットワーク** | `apps/api/src/auth/bridge-release.ts` | Bridge の配布物の目録を運営の置き場（開発は手元のフォルダ・staging／本番は置き場の URL）から読むのは配布の口そのもの（D-109）。業務の外部送信・利用者のファイルではない | 読む先は設定の `BRIDGE_RELEASE_DIR`／`BRIDGE_RELEASE_BASE` だけ。利用者由来のパスを受け取らず、配るのは目録に載った名前（英数と . _ - だけ）のファイルだけ。書かない | 恒久 | 有効 |
| X-007 | **C4 ファイル** | `apps/api/src/auth/bridge-release.ts` | Bridge の配布物の目録を運営の置き場（開発は手元のフォルダ・staging／本番は置き場の URL）から読むのは配布の口そのもの（D-109）。業務の外部送信・利用者のファイルではない | 読む先は設定の `BRIDGE_RELEASE_DIR`／`BRIDGE_RELEASE_BASE` だけ。利用者由来のパスを受け取らず、配るのは目録に載った名前（英数と . _ - だけ）のファイルだけ。書かない | 恒久 | 有効 |
| X-008 | **C2 永続化（専用接続）** | `packages/db/src/listen.ts` | 会話が変わった知らせ（LISTEN kaname_agent）は、接続を持ち続けないと受けられない。Transaction pooler では LISTEN が効かない（D-113） | API 1 台につき 1 本だけ（人・画面ごとに持たない・G-16）。`application_name = kaname-listen` で見分ける。受けるのは member id だけで中身を持たない。確かめの知らせが戻らなければ落として全員に伝える。誰も受けていない間は 60 秒で閉じる | 恒久 | 有効 |
| X-009 | **C1 ネットワーク** | `apps/bridge/src/` | Bridge は顧客 PC の実行器で、Kaname（設定の API の基点）に仕事を取りに行く・結果を返す・鍵を受け取るのが機能そのもの。業務の外部送信（C1 の関門 packages/actions）ではない。`local.ts` の node:http は 127.0.0.1 だけに bind する Bridge の口（画面が「動いているか」を知る・D-089.8） | 宛先は `KANAME_API_BASE`（d.apiBase／API_BASE）か Kaname が返した URL（署名つきの資料・目録の配布物）だけ。`scripts/ci/net_boundary.mjs`（G16b）が fetch の宛先の基点を AST で検査し、よそへの fetch は CI で赤。外のサービスを開くのはブラウザ（Chrome／専用ブラウザ）で、禁止の宛先は bridge-guard が止める（D-107・D-119.5） | 恒久 | 有効 |
| X-010 | **C1 ネットワーク** | `apps/web/lib/` | 画面（ブラウザ）が Kaname 自身の API を呼ぶ口。業務の外部送信ではない（D-095.2「画面の fetch は C1 の対象外」）。`bridge-presence.ts` の `LOCAL` は本人の PC の Bridge の口（127.0.0.1:38617） | 宛先は `apiBase()`（NEXT_PUBLIC_API_BASE）か `LOCAL` だけ。`scripts/ci/net_boundary.mjs`（G16b）が fetch の宛先の基点を AST で検査し、よそへの fetch は CI で赤 | 恒久 | 有効 |
| X-011 | **C5 プロセス起動** | `apps/bridge/src/` | 本人のサブスクの公式 CLI（claude）・専用ブラウザ（playwright-mcp を node で）・配布物の入れ替え（sh／ditto）を起こすのが Bridge の機能そのもの（D-055・D-119） | 起こす実体は `proc.ts`／`runner.ts`／`install-claude.ts`／`update.ts` に閉じ、引数は設定と目録から組む（利用者由来の文字列をコマンドにしない）。完了信号（result）を出さずに終わった CLI は成功にしない（G-15・runner.test）。関門 C5 の中で守るべき「隔離・完了信号・タイムアウト・証跡」は Bridge の中で同じことをする | 恒久 | 有効 |
| X-012 | **C4 ファイル** | `apps/web/app/(dev)/dev/mail/page.tsx` | 開発の受信箱（API のログからメールのリンクを拾う画面）。本番には出ない（(dev) の枠は `WEB_ENV.isProduction && !devPages` で 404） | 読むのは `KANAME_API_LOG` の 1 ファイルだけ・書かない・利用者由来のパスを受け取らない | 恒久 | 有効 |
| X-002 | **C8 秘密** | `packages/config/` | 起動時のブート設定（DB 接続文字列等）は業務文脈が無く、vault より前に必要 | 起動時に 1 回だけ読み、型付きオブジェクトとして配る。**顧客の資格情報は絶対に扱わない**（CI で検査） | 恒久 | 有効 |
| X-013 | **C8 秘密** | `apps/bridge/src/env.ts` | Bridge は利用者の PC で動く別のアプリで、サーバーの起動設定（packages/config）を持たない。Bridge が自分で読む環境（基点の URL・PATH・SHELL など）はこのファイルの `bridgeEnv()` からだけ読む（K-42） | 読む名前は `BRIDGE_ENV_KEYS` に型で並べる。子に渡す環境は `childEnv` が許可リストに絞り、モデルの鍵（ANTHROPIC_ 等）は落とす（env.test.ts）。ほかのファイルで process.env を読めば G13 が赤 | 恒久 | 有効 |
| X-014 | **C8 秘密** | `apps/bridge/src/guard.ts#HOOK_SOURCE` | 定数 HOOK_SOURCE の中身は、Bridge が書き出して Claude Code が別のプロセスで起こす子のプログラム（直前のフック）。子は Bridge の入口を読み込めず、渡された環境を読むのが機能そのもの（K-42） | 渡す環境は Bridge が `childEnv` で絞り、Bridge が決めた KANAME_* だけを足す。G13 はこの定数の文字列の範囲だけを見ず、範囲の外で読めば赤（env_audit の自己試験）。ファイル全体は除かない | 恒久 | 有効 |
| X-015 | **C8 秘密** | `apps/bridge/src/kaname-tools.ts#MCP_SERVER_SOURCE` | 定数 MCP_SERVER_SOURCE の中身は、Bridge が書き出して Claude Code が別のプロセスで起こす子のプログラム（Kaname の道具のサーバー）。理由は X-014 と同じ（K-42） | X-014 と同じ | 恒久 | 有効 |
| X-016 | **C4 ファイル** | `apps/web/features/F1/consent-terms/legal-text.ts` | 規約・プライバシーポリシーの文面のページ（K-53）が、画面に同梱したひな形（`apps/web/content/legal/*.md`）を要求のときに読む。DB も API も読まない（画面だけを立ち上げる CI の段でも開ける）。利用者のファイルではない | 読むのは `apps/web/content/legal` の `<kind>-v<版>.md` だけ（kind は terms・privacy の 2 つ・版は数だけ）・書かない・利用者由来のパスを受け取らない | 恒久 | 有効 |

**例外件数：16（恒久 16 / 期限付き 0）**

## 過去の例外（解消済）

| ID | 関門 | 解消方法 | 解消日 |
|----|-----|---------|--------|
| （なし） | | | |
