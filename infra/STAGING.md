# staging の作り方（本番と同じ構成をもう 1 組）

2026-09-16 user「staging を作る。作り方を出して」。画面のタスク（W9 以降）は、ここでブラウザの L1 と流れの L2 を流す（規約 test-ladder §5）。
本番と同じ migration／deploy／プロビジョニングのコードで作る。ダッシュボードで手で作ってよいのは「口座・支払い・鍵の登録」だけ。

## 0. いま無いもの（先に直す・T-F-18）

| 無いもの | 何が困るか | 直し方（T-F-18） |
|---|---|---|
| API の起動口と Dockerfile | Railway に置けない（apps/api には app.ts しか無い） | `apps/api/src/server.ts`（@hono/node-server・GET /health・起動時確認）と `apps/api/Dockerfile` |
| 認証の schema 名 `auth` | Supabase は schema `auth` を自社の認証（auth.users／auth.sessions）に使う。同じ名前に Better Auth の表を作ると衝突する | schema 名を `kaname_auth` に変える（migration 0004・packages/auth・テスト） |
| DB 役割のパスワードが migration に直書き（`kaname_app`／`kaname_auth`） | staging と本番で同じ・公開されたパスワードになる | migration は役割を作るだけ。パスワードは migrate の CLI が環境変数 `KANAME_APP_DB_PASSWORD`／`KANAME_AUTH_DB_PASSWORD` から `alter role … password` で入れる（ローカルは今の値を既定に） |
| GitHub のリモート | Railway と Vercel は GitHub から読む | 高本さんが private リポジトリを作り `git remote add origin …`。私は push しない（確認してから） |

## 1. 誰が何をするか

- 高本さん：口座を作る・支払い方法を登録する・鍵と接続文字列を **Infisical に直接入れる**。鍵をチャットや ファイルに貼らない。私は値を一切見ない。
- Claude：T-F-18 のコード、この手順、起動時確認、`db:migrate`／`provision:bucket` を deploy の前段（Railway の pre-deploy）で流す配線。

## 2. 順序

### S0 GitHub
1. private リポジトリを作る（例 `engine-base/kaname`）
2. `git remote add origin git@github.com:<org>/kaname.git`
3. Settings → Secrets and variables → Actions に `STAGING_BASE_URL`（S3 で決まる Railway の URL）を後で入れる

### S1 Supabase（DB とバケット）
1. Organization に staging 用のプロジェクトを 1 つ作る（名前 `kaname-staging`・Region `Northeast Asia (Tokyo)`）。本番は別プロジェクト
2. Connect から接続文字列を 2 つ取る
   - Direct connection（5432）＝ migration 用（管理者）→ Infisical の `DATABASE_ADMIN_URL`
   - Transaction pooler（6543）＝ 実行時。ユーザー名を `kaname_app`／`kaname_auth` に、パスワードを S2 で決めた値に置き換えて `DATABASE_URL`／`AUTH_DATABASE_URL`
3. Storage → Settings → S3 Connection：S3 access keys を作る → `STORAGE_ACCESS_KEY_ID`／`STORAGE_SECRET_ACCESS_KEY`。Endpoint（`https://<ref>.storage.supabase.co/storage/v1/s3`）→ `STORAGE_ENDPOINT`、Region → `STORAGE_REGION`、`STORAGE_FORCE_PATH_STYLE=true`、`STORAGE_BUCKET=kaname-staging`
4. Free プランのプロジェクトは 1 週間使わないと休止する。staging を常時使うなら Pro（目安 月 25 USD）にする

### S2 Infisical（鍵の置き場）
1. Organization → Project `kaname` を作る。環境は `staging` と `production`（`dev` は使わない）
2. `staging` に、下の「秘密の名前」の表の値を入れる。役割のパスワード 2 つ（`KANAME_APP_DB_PASSWORD`／`KANAME_AUTH_DB_PASSWORD`）はここで作った長い乱数を使う（S1-2 の接続文字列にも同じ値）
3. `SECRETS_MASTER_KEY` は 32 バイト以上を base64 で（`openssl rand -base64 48`）。`AUTH_SECRET` は 32 文字以上の乱数
4. Integrations → Railway（S3 の後）と Vercel（S5 の後）を接続し、`staging` 環境を同期する

### S3 Railway（API）
1. New Project `kaname` → Deploy from GitHub → リポジトリを選ぶ。Environment を `staging` と `production` に分ける
2. Service `api`：Root Directory `/`、Builder `Dockerfile`（`apps/api/Dockerfile`）。Healthcheck Path `/health`
3. Variables は Infisical の同期で入れる（手で貼らない）。`NODE_ENV=staging`、`PORT=3001`、`BASE_URL=https://<railway の URL>`
4. Deploy 設定 → Pre-deploy command：`pnpm db:migrate && pnpm provision:bucket`（本番と同じ migration・バケット作成。鍵は Railway の中だけ）
5. Public Networking でドメインを出す → その URL を `BASE_URL`・GitHub の `STAGING_BASE_URL`・Vercel の `NEXT_PUBLIC_API_BASE` に

### S4 Resend（メール・任意）
1. API Keys → staging 用のキー → `RESEND_API_KEY`。無ければメールは送らず inapp だけ（起動は止まらない）
2. 送信ドメインは本番と同じでよい（DNS の SPF／DKIM は本番の作業で 1 回）

### S5 Vercel（画面。T-US-00 の後）
1. apps/web ができてから。Project `kaname-web`、Root Directory `apps/web`、Framework Next.js
2. Preview 環境の `NEXT_PUBLIC_API_BASE` を Railway staging の URL に（Infisical の同期で）
3. Preview の URL がブラウザの L1・L2 を流す先

### S6 できたかの確認（機械）
1. `curl -s https://<api>/health` が 200 で版を返す
2. Railway の起動ログに 起動時確認 4／4（db:tables・storage:bucket・secrets:master-key・notify:resend）
3. 正本の行 `FND-01-001`／`FND-06-001`（prod-smoke.md）を BLOCKED から PASS に書き直す。T-F-16 の BLOCKED も同じ回で流し直す
4. `wave_gate W2` が完了 → W9（T-US-00）へ

## 3. 秘密の名前（`.env.example` が正本。G13 ci:env-audit が突き合わせる）

| 名前 | 誰が | どこから | 使う所 |
|---|---|---|---|
| DATABASE_ADMIN_URL | 高本さん | Supabase Direct connection | Railway pre-deploy（migration・役割のパスワード）だけ |
| DATABASE_URL | 高本さん | Transaction pooler・ユーザー kaname_app | API |
| AUTH_DATABASE_URL | 高本さん | Transaction pooler・ユーザー kaname_auth | API（認証） |
| KANAME_APP_DB_PASSWORD／KANAME_AUTH_DB_PASSWORD | 高本さん（乱数） | Infisical で生成 | migrate が役割に入れる |
| AUTH_SECRET | 高本さん（乱数） | — | API（認証） |
| SECRETS_MASTER_KEY | 高本さん（乱数・base64 32 バイト以上） | — | API（関門 C8） |
| STORAGE_ENDPOINT／STORAGE_REGION／STORAGE_BUCKET／STORAGE_ACCESS_KEY_ID／STORAGE_SECRET_ACCESS_KEY／STORAGE_FORCE_PATH_STYLE | 高本さん | Supabase S3 Connection | API・provision:bucket |
| RESEND_API_KEY | 高本さん（任意） | Resend | API（関門 C6） |
| NODE_ENV／PORT／BASE_URL | Claude（値は秘密でない） | — | API |
| NEXT_PUBLIC_API_BASE | Claude（値は秘密でない） | Railway の URL | Vercel Preview |
| STAGING_BASE_URL | 高本さん | Railway の URL | GitHub Actions（e2e job） |

## 4. 触らないもの

- 本番のデータと本番のプロジェクト（本番は L4 のスモークだけ）
- 本人のアカウント以外の外部サービスへの実操作
- 鍵の値をチャット・コミット・ログに出すこと（`.env` は git に入れない。CI は G13 が名前だけ突き合わせる）

## 5. 費用の目安（2026-09 時点の私の知識。実際の料金は各社の画面で確認）

Supabase Pro 25 USD／月（Free は 1 週間で休止）・Railway Hobby 5 USD／月＋使用量・Vercel Hobby 無料（会社利用は Pro）・Infisical 無料枠・Resend 無料枠。合計の目安 月 30〜50 USD。
