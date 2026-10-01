# 関門の例外台帳 — Kaname

> 正本: `.claude/rules/common/choke-points.md`
> **関門を迂回してよいのは、ここに登録された例外だけ。** 登録の無い迂回は CI で fail。
> **台帳が短いほど良い。**

作成 2026-09-08 / 最終更新 2026-09-29

## 運用ルール
1. 迂回が必要になった時点で登録する（CI が先に落ちるので後回しにできない）
2. **代替統制を必ず書く**。書けないなら例外ではなく設計不備
3. **期限**を書く。恒久例外は `expires_at: null` とし、理由を明記する
4. 解消したら削除せず「解消済（タスク ID）」に書き換える

## 現在の例外（8 件・いずれも恒久）

| ID | 関門 | 迂回箇所 | 理由 | 代替統制 | 期限 | 状態 |
|----|-----|---------|------|---------|------|------|
| X-001 | **C4 ファイル** | `apps/bridge/src/workspace/` | Bridge が顧客 PC のローカルファイルを操作するのは**機能そのもの**。サーバー側の objectStore とは対象が違う | 作業フォルダの範囲外アクセスを拒否。範囲チェックを `packages/bridge-guard/` に集約し、**そこ以外からの fs 使用は fail**。全操作を証跡へ送る | 恒久 | 有効 |
| X-003 | **C2 永続化** | `packages/auth/` | 認証（Better Auth）は境界 B2。schema `auth` の表を自前の接続（ロール kaname_auth）で読み書きするのが機能そのもの。public の表は関門の関数（app.open_session 等）経由 | kaname_auth は schema auth と関門の関数の execute だけ（public の表に権限なし・RLS 素通りなし）。証跡は app.record_security_event。CI G4 が public の全表 RLS を検査 | 恒久 | 有効 |
| X-004 | **C4 ファイル** | `packages/db/` | migration／policy の SQL ファイルを起動時に読む（関門 C2 の中の作業。利用者のファイルではない） | 読むのは packages/db/migrations と policies だけ・書かない・利用者由来のパスを受け取らない | 恒久 | 有効 |
| X-005 | **C1 ネットワーク** | `packages/secrets/src/infisical.ts` | 資格情報の預かり先（Infisical）への通信は関門 C8 の中の作業で、業務の外部送信ではない（D-101） | 宛先は設定の `INFISICAL_SITE_URL` だけ。送るのは会社ごとの鍵で暗号化した中身だけ。全アクセスは C8 の `secret.*` 証跡。失敗の理由に中身を入れない | 恒久 | 有効 |
| X-006 | **C1 ネットワーク** | `apps/api/src/auth/bridge-release.ts` | Bridge の配布物の目録を運営の置き場（開発は手元のフォルダ・staging／本番は置き場の URL）から読むのは配布の口そのもの（D-109）。業務の外部送信・利用者のファイルではない | 読む先は設定の `BRIDGE_RELEASE_DIR`／`BRIDGE_RELEASE_BASE` だけ。利用者由来のパスを受け取らず、配るのは目録に載った名前（英数と . _ - だけ）のファイルだけ。書かない | 恒久 | 有効 |
| X-007 | **C4 ファイル** | `apps/api/src/auth/bridge-release.ts` | Bridge の配布物の目録を運営の置き場（開発は手元のフォルダ・staging／本番は置き場の URL）から読むのは配布の口そのもの（D-109）。業務の外部送信・利用者のファイルではない | 読む先は設定の `BRIDGE_RELEASE_DIR`／`BRIDGE_RELEASE_BASE` だけ。利用者由来のパスを受け取らず、配るのは目録に載った名前（英数と . _ - だけ）のファイルだけ。書かない | 恒久 | 有効 |
| X-008 | **C2 永続化（専用接続）** | `packages/db/src/listen.ts` | 会話が変わった知らせ（LISTEN kaname_agent）は、接続を持ち続けないと受けられない。Transaction pooler では LISTEN が効かない（D-113） | API 1 台につき 1 本だけ（人・画面ごとに持たない・G-16）。`application_name = kaname-listen` で見分ける。受けるのは member id だけで中身を持たない。確かめの知らせが戻らなければ落として全員に伝える。誰も受けていない間は 60 秒で閉じる | 恒久 | 有効 |
| X-002 | **C8 秘密** | `packages/config/` | 起動時のブート設定（DB 接続文字列等）は業務文脈が無く、vault より前に必要 | 起動時に 1 回だけ読み、型付きオブジェクトとして配る。**顧客の資格情報は絶対に扱わない**（CI で検査） | 恒久 | 有効 |

**例外件数：2（恒久 2 / 期限付き 0）**

## 過去の例外（解消済）

| ID | 関門 | 解消方法 | 解消日 |
|----|-----|---------|--------|
| （なし） | | | |
