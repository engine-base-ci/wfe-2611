# staging の作り方（段階 1：Vercel ＋ Supabase・D-097）

2026-09-16 user「staging を作る。作り方を出して」。2026-09-27 に置き場を決め直した（D-097：段階 1 は画面も API も Vercel、DB は Supabase。Railway・Infisical は段階 2）。
画面のタスクは、ここでブラウザの L1 と流れの L2 を流す（規約 test-ladder §5）。本番と同じ migration／deploy／プロビジョニングのコードで作る。
ダッシュボードで手で作ってよいのは「口座・支払い・鍵の登録」だけ。

段階 1 は**環境を 1 組だけ**作る（user「一旦は dev でいい。環境は僕だけで十分」）。Vercel の Production を staging として使い、Supabase も staging の 1 プロジェクトだけ。
**顧客に触らせる前に**、同じ手順で本番をもう 1 組作る（Supabase の本番プロジェクト・Vercel の本番用の環境変数・Vercel Pro）。

## 0. いま無いもの

| 無いもの                                                        | 何が困るか                                                         | 誰が                                                                                            |
| --------------------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| GitHub のリモート                                               | Vercel は GitHub から読む                                          | 高本さんが private リポジトリを作り `git remote add origin …`。私は push しない（確認してから） |
| Supabase のプロジェクト（staging）                              | DB・添付の置き場が無い                                             | 高本さん（S1）                                                                                  |
| Vercel のプロジェクト 2 つ（画面・API）                         | 置き場が無い                                                       | 高本さん（S2・S4）                                                                              |
| Infisical のアカウントと機械の身元（資格情報の預かり先・D-101） | 無いと staging／本番の API が起動時の確認（secrets:vault）で止まる | 高本さん（S1b）                                                                                 |

コード側（API を Vercel の関数 1 本にする入口・組み立て・Bridge の問い合わせ）は済み（`apps/api/src/vercel.ts`・`apps/api/build-vercel.mjs`・`apps/api/vercel.json`）。

## 1. 誰が何をするか

- 高本さん：口座を作る・支払い方法を登録する・鍵と接続文字列を **Vercel の環境変数に直接入れる**（Sensitive にする）。鍵をチャットやファイルに貼らない。私は値を一切見ない。
- Claude：コード、この手順、起動時確認、`db:migrate`／`provision:bucket` を API の Build Command で流す配線。

## 2. 順序

### S0 GitHub

1. private リポジトリを作る（例 `engine-base/kaname`）
2. `git remote add origin git@github.com:<org>/kaname.git`（push は確認してから）

### S1 Supabase（DB と添付）

1. プロジェクトを 1 つ作る（名前 `kaname-staging`・Region `Northeast Asia (Tokyo)`・**Free**）
2. Connect から接続文字列を取る。**Direct connection は IPv6 だけなので Vercel から届かない。全部 pooler を使う**
   - **Session pooler**（`aws-…pooler.supabase.com:5432`・ユーザー `postgres.<ref>`）＝ migration 用（管理者）→ `DATABASE_ADMIN_URL`
   - **Transaction pooler**（同じ host の `:6543`）＝ 実行時。ユーザー名を `kaname_app.<ref>`／`kaname_auth.<ref>`、パスワードを S2-3 で作る値に置き換えて `DATABASE_URL`／`AUTH_DATABASE_URL`
3. Storage → Settings → S3 Connection：S3 access keys を作る → `STORAGE_ACCESS_KEY_ID`／`STORAGE_SECRET_ACCESS_KEY`。Endpoint（`https://<ref>.storage.supabase.co/storage/v1/s3`）→ `STORAGE_ENDPOINT`、Region → `STORAGE_REGION`、`STORAGE_FORCE_PATH_STYLE=true`、`STORAGE_BUCKET=kaname-staging`
4. 無料枠は 1 週間使わないと休止し、バックアップが無い。**顧客のデータを入れる前に Pro**（D-097.7）

### S1b Infisical（顧客の資格情報の預かり先・D-101）

1. https://app.infisical.com でアカウントを作る（無料枠）。地域（US／EU）を覚えておく → `INFISICAL_SITE_URL`（`https://us.infisical.com` か `https://eu.infisical.com`）
2. Project を 1 つ作る（名前 `kaname`）。環境は `staging` と `prod` の 2 つだけ使う（`dev` は使わない）→ Project ID を `INFISICAL_PROJECT_ID`、`staging` を `INFISICAL_ENVIRONMENT`
3. Organization → Access Control → Identities → Machine Identity を作る（名前 `kaname-api-staging`・Auth は **Universal Auth**）。Client ID と Client Secret を `INFISICAL_CLIENT_ID`／`INFISICAL_CLIENT_SECRET` に（Vercel の環境変数に直接・Sensitive。チャットに貼らない）
4. その Identity を Project `kaname` に追加し、`staging` 環境の Secrets を **読み書き** できる役割にする（`/tenants` の下を作れるように）。**組織全体の権限（project を作る・消す）は付けない**（D-102.3）
5. 無料枠（公式 2026-09-27：identity 5・project 無制限・環境 3・秘密の操作 毎分 120 回）を画面で確かめる。Kaname が使う identity は **サーバーの staging 用・本番用と高本さんの 3 つだけ**（会社・人・PC が増えても増えない・D-102.1）。Bridge 用の identity は作らない（D-102.2）
6. 上限の 8 割（毎分 96 回）で info@ にメールが届く。続くようなら Pro（毎分 300 回・3 つで月 60 ドル前後）か自前ホストを決める（D-102.6）

### S2 Vercel：API（プロジェクト `kaname-api`）

1. Add New → Project → GitHub のリポジトリ → **Root Directory `apps/api`**・Framework Preset **Other**。Build と Install は `apps/api/vercel.json` が決める（手で書かない）
2. Settings → Environment Variables（Production と Preview の両方・**Sensitive**）に下の「秘密の名前」の表の値を入れる
3. 役割のパスワード 2 つ（`KANAME_APP_DB_PASSWORD`／`KANAME_AUTH_DB_PASSWORD`）は長い乱数（`openssl rand -base64 32`）。S1-2 の接続文字列にも同じ値。`SECRETS_MASTER_KEY` は `openssl rand -base64 48`、`AUTH_SECRET` も長い乱数
4. `NODE_ENV=staging`、`BASE_URL=https://<kaname-api の URL>`、`WEB_BASE_URL=https://<kaname-web の URL>`（S4 の後に入れて Redeploy）
5. Deploy。Build Command が `pnpm db:migrate && pnpm provision:bucket` を流してから関数を組み立てる（本番と同じコード・D-097.6）。**Preview のビルドも同じ DB に流れる**（段階 1 は開発者 1 人なので許す。2 人目が入る前に GitHub Actions へ）

### S3 Resend（メール）

1. 送信ドメイン engine-base.com は検証済み（2026-09-20）。staging 用の API キーを作り `RESEND_API_KEY` に。無ければメールは送らない（staging では起動は止まらない）
2. `MAIL_FROM=Kaname <noreply@engine-base.com>`・`MAIL_REPLY_TO=info@engine-base.com`（D-096）

### S4 Vercel：画面（プロジェクト `kaname-web`）

1. 同じリポジトリでもう 1 つ Project → **Root Directory `apps/web`**・Framework Next.js
2. `NEXT_PUBLIC_API_BASE=https://<kaname-api の URL>`（秘密ではない）
3. Deploy → この URL を S2-4 の `WEB_BASE_URL` に入れて API を Redeploy（CORS）

### S5 できたかの確認（機械）

1. `curl -s https://<kaname-api>/health` が 200 で版を返す。503 なら本文の理由（`STARTUP_FAILED`）と Vercel の関数のログ（`[api] 起動しない: …`）を見る
2. 起動時確認 5／5（db:tables・storage:bucket・secrets:master-key・notify:resend・secrets:vault）がログに出る。secrets:vault が落ちたら S1b の値と役割を見直す
3. `kaname_app.<ref>`／`kaname_auth.<ref>` で Transaction pooler に入れること（custom role が pooler を通るか）を 1 で確かめる。入れなければ Supabase 側で role の `login` と pooler の設定を見直す
4. 画面から新規登録 → 確認メール → Bridge をつなぐ → 自分のAIと話す、を 1 周（L2）
5. 正本の行 `FND-01-001`／`FND-06-001`（prod-smoke.md）を BLOCKED から PASS に書き直す

## 3. 秘密の名前（`.env.example` が正本。G13 ci:env-audit が突き合わせる）

| 名前                                                                                                                         | 誰が                                   | どこから                                         | 使う所                                                  |
| ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------ | ------------------------------------------------------- |
| DATABASE_ADMIN_URL                                                                                                           | 高本さん                               | Supabase Session pooler（`postgres.<ref>`）      | API の Build Command（migration・役割のパスワード）だけ |
| DATABASE_URL                                                                                                                 | 高本さん                               | Transaction pooler・ユーザー `kaname_app.<ref>`  | API                                                     |
| AUTH_DATABASE_URL                                                                                                            | 高本さん                               | Transaction pooler・ユーザー `kaname_auth.<ref>` | API（認証）                                             |
| KANAME_APP_DB_PASSWORD／KANAME_AUTH_DB_PASSWORD                                                                              | 高本さん（乱数）                       | 自分で生成                                       | migrate が役割に入れる                                  |
| AUTH_SECRET                                                                                                                  | 高本さん（乱数）                       | —                                                | API（認証）                                             |
| SECRETS_MASTER_KEY                                                                                                           | 高本さん（乱数・base64 32 バイト以上） | —                                                | API（関門 C8）                                          |
| STORAGE_ENDPOINT／STORAGE_REGION／STORAGE_BUCKET／STORAGE_ACCESS_KEY_ID／STORAGE_SECRET_ACCESS_KEY／STORAGE_FORCE_PATH_STYLE | 高本さん                               | Supabase S3 Connection                           | API・provision:bucket                                   |
| RESEND_API_KEY                                                                                                               | 高本さん                               | Resend                                           | API（関門 C6）                                          |
| INFISICAL_SITE_URL／INFISICAL_CLIENT_ID／INFISICAL_CLIENT_SECRET／INFISICAL_PROJECT_ID／INFISICAL_ENVIRONMENT                | 高本さん                               | Infisical（S1b）                                 | API（関門 C8・顧客の資格情報の預かり先）                |
| MAIL_FROM／MAIL_REPLY_TO／OPS_EMAIL／OPERATOR_*                                                                              | Claude（値は秘密でない）               | D-096                                            | API                                                     |
| NODE_ENV／BASE_URL／WEB_BASE_URL                                                                                             | Claude（値は秘密でない）               | Vercel の URL                                    | API                                                     |
| NEXT_PUBLIC_API_BASE                                                                                                         | Claude（値は秘密でない）               | kaname-api の URL                                | 画面                                                    |

## 4. 触らないもの

- 本番のデータと本番のプロジェクト（本番は L4 のスモークだけ）
- 本人のアカウント以外の外部サービスへの実操作
- 鍵の値をチャット・コミット・ログに出すこと（`.env` は git に入れない。CI は G13 が名前だけ突き合わせる）

## 5. 費用の目安（2026-09 時点の私の知識。実際の料金は各社の画面で確認）

段階 1 の staging：Supabase Free・Vercel Hobby（2 プロジェクト）・Infisical 無料枠・Resend 無料枠 → **0 円**。
Vercel Hobby の目安の枠（関数の呼び出し 月 100 万回 等）に収まるよう、Bridge の問い合わせは 1 台あたり月およそ 50 万回（動いていない間 5 秒ごと）に抑えてある（D-097.4）。
顧客に触らせる前：Vercel Pro 20 USD／月・Supabase Pro 25 USD／月（D-097.7）。
