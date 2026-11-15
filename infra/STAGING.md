# staging の作り方（段階 1：Vercel ＋ Supabase・D-097）

2026-09-16 user「staging を作る。作り方を出して」。2026-09-27 に置き場を決め直した（D-097：段階 1 は画面も API も Vercel、DB は Supabase。Railway・Infisical は段階 2）。
画面のタスクは、ここでブラウザの L1 と流れの L2 を流す（規約 test-ladder §5）。本番と同じ migration／deploy／プロビジョニングのコードで作る。
ダッシュボードで手で作ってよいのは「口座・支払い・鍵の登録」だけ。

段階 1 は**環境を 1 組だけ**作る（user「一旦は dev でいい。環境は僕だけで十分」）。Vercel の Production を staging として使い、Supabase も staging の 1 プロジェクトだけ。
**顧客に触らせる前に**、同じ手順で本番をもう 1 組作る（Supabase の本番プロジェクト・Vercel の本番用の環境変数・Vercel Pro）。

## 0. いまの実際（2026-11-14・K-37 の「前提と制約」の写し）

| もの                                                                                                                | 状態                                                                                                                                                                                                | どこで分かるか                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GitHub のリポジトリ（S0）・Supabase（S1）・Infisical（S1b）・Vercel の API（S2）・Resend（S3）・Vercel の画面（S4） | 済み（2026-11-08・人の準備のチケットは完了）                                                                                                                                                        | 11_tickets の K-78〜K-82                                                                                                                                               |
| 配る道すじ                                                                                                          | Vercel が GitHub の main を見て自分で配る。`.github/workflows` に配る段は無い                                                                                                                       | Vercel の画面（設定はリポジトリから見えない）                                                                                                                          |
| staging の住所                                                                                                      | リポジトリのどこにも書かない。CI には GitHub の Environment `staging` の Environment secrets の名前で渡す                                                                                           | 下の「CI から staging を指す名前」                                                                                                                                     |
| Supabase のプロジェクトの名前                                                                                       | `Kaname`（S1 の手順の例 `kaname-staging` ではない）                                                                                                                                                 | Supabase の画面                                                                                                                                                        |
| 立っているかの確かめ                                                                                                | 台本で見る（人が画面で見ない）                                                                                                                                                                      | S5 の `python3 scripts/ci/staging_health.py`                                                                                                                           |
| 口と画面の処理の場所（Function の地域）                                                                             | 東京（hnd1）。DB と同じ場所（Supabase の東京）に置く。変えるときは DB と両方。本番も同じ vercel.json で同じ場所に配られる（staging と本番で分けたくなったら、Root の vercel.json では分けられない） | 決まりは `scripts/ci/staging_region.json`。設定は各 Root の vercel.json の `regions`（Vercel の画面の Function Regions は触らない・K-212）。答えの頭で S5 の台本が見る |
| 途中でチャットに出た秘密                                                                                            | 取り替える（人の準備）                                                                                                                                                                              | 下の「秘密の取り替え」                                                                                                                                                 |

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
3. Storage → Settings → S3 Connection：S3 access keys を作る → `STORAGE_ACCESS_KEY_ID`／`STORAGE_SECRET_ACCESS_KEY`。Endpoint（`https://<ref>.storage.supabase.co/storage/v1/s3`）→ `STORAGE_ENDPOINT`、Region → `STORAGE_REGION`、`STORAGE_FORCE_PATH_STYLE=true`、`STORAGE_BUCKET=kaname-staging`。**バケットは非公開のまま（公開にしない）**。`pnpm provision:bucket` が確かめ用の物で非公開を確かめ、公開なら止まる（K-133）。Bridge の配布物の頭は `BRIDGE_RELEASE_BASE=<STORAGE_ENDPOINT>/<STORAGE_BUCKET>/<頭>`（S3 の口の下・path-style。provision が置き場の下かを確かめる）
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
5. Deploy。Build Command が `pnpm db:migrate && pnpm provision:bucket` を流してから関数を組み立てる（本番と同じコード・D-097.6）。Preview のビルドも同じ DB に流れる形なので、下の 6 で止める
6. **作業中の版の配りは止める**：Settings → Git → Ignored Build Step → **Only build production**（D-140.4）。main に入った版だけが配られ、作業中の枝の Build が同じ DB に migration を流さない

### S3 Resend（メール）

1. 送信ドメイン engine-base.com は検証済み（2026-09-20）。staging 用の API キーを作り `RESEND_API_KEY` に。無ければメールは送らない（staging では起動は止まらない）
2. `MAIL_FROM=Kaname <noreply@engine-base.com>`・`MAIL_REPLY_TO=info@engine-base.com`（D-096）

### S4 Vercel：画面（プロジェクト `kaname-web`）

1. 同じリポジトリでもう 1 つ Project → **Root Directory `apps/web`**・Framework Next.js
2. `NEXT_PUBLIC_API_BASE=https://<kaname-api の URL>`（秘密ではない）
3. Deploy → この URL を S2-4 の `WEB_BASE_URL` に入れて API を Redeploy（CORS）

### S5 できたかの確認（機械）

1. 健康診断の台本を流す（読むだけ・鍵を使わない）。住所は環境の値の名前 `STAGING_BASE_URL`（画面）・`STAGING_API_BASE`（口）で渡す。値はこの文書にもコミットにも書かない

   ```sh
   python3 scripts/ci/staging_health.py
   ```

   見るもの：`/health` が 200 で中身がそろっている（起動時の確かめ 5 つ＝db:tables・storage:bucket・secrets:master-key・notify:resend・secrets:vault は、1 つでも落ちると 503 と `STARTUP_FAILED` と落ちた確かめの名前が出る）・配った版の migration の一覧の最後が手元と同じ・CORS（画面の住所からの事前の問い合わせ）・画面の `/login` が 200

2. DB に migration が当たっているかも見る回（CI の staging を指す回）は、先に DB を読む台本を流して、その出力を渡す

   ```sh
   APPLIED="${RUNNER_TEMP:-${TMPDIR:-/tmp}}/kaname-staging-applied.json"   # 版に入らない一時の置き場（作業場所に置かない）
   node scripts/ci/staging_db_migrations.mjs > "$APPLIED"
   python3 scripts/ci/staging_health.py --applied "$APPLIED"
   ```

   DB を読む台本は `STAGING_DATABASE_READ_URL`（読むだけの役 `kaname_ci_read` の接続）でつなぎ、読むだけの取引の中で `app.schema_migrations` の名前を 1 回読むだけ（書かない）。手元（127.0.0.1）のほかは、接続の文字列に `sslmode=verify-full` が無ければ、つなぐ前に終わりの値 2 で止まる。つなぐときは証明書と名前を確かめる。TLS を外す・弱める指定が在ればつながない。DB の側の証明書が自前の認証局の物で確かめが通らないときも、**確かめは外さない**：認証局の証明書（公開の物・秘密ではない）を `infra/certs/` に置き、健康診断の段の env に `NODE_EXTRA_CA_CERTS`（その道）を作り手で足す

3. 終わりの値：**DB も見る回（CI の staging を指す回）で 0、手元では 3（DB は見ていない）**。1 は赤（★ の行を見る）。2 は名前が無い・住所が https の出どころだけの形でない（口に当てていない）。3 を緑と読まない。配り直した直後の数十秒は古い版が答えることがあるので、migration の行が赤なら少し待って流し直す。この台本で見えないもの：migration を足さない版の配りの遅れ・画面の版・メールの送る鍵（Vercel の画面と、最初の筋の通しで見る）
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

## 3b. CI から staging を指す名前（GitHub の Environment `staging` の Environment secrets）

入れる所：GitHub のリポジトリ → Settings → Environments → `staging` → Environment secrets → Add environment secret。入れるのは高本さん（値をチャット・ファイル・コミットに書かない）。Environment `staging` は、起こせる枝を `main` だけにする（Deployment branches and tags → Selected branches and tags → `main` の 1 つ）。**リポジトリの側の secrets（Settings → Secrets and variables → Actions）には入れない**（0 件のまま）：そこに入れると、枝から起こした回でも読める。

ふだんのチケットの CI にはこの名前を渡さない。渡すのは、main から手で起こす staging を指す回（`.github/workflows/staging-e2e.yml`・組が `environment: staging` を持つ）の、健康診断と統合テストの 2 つの段だけ。

| 名前                      | 何を入れる                                                                                                                                                                                                        | どこから写す                                                                                                                                 |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| STAGING_BASE_URL          | staging の画面の住所（`https://` から）                                                                                                                                                                           | Vercel → `kaname-web` → Domains                                                                                                              |
| STAGING_API_BASE          | staging の口の住所（`https://` から）                                                                                                                                                                             | Vercel → `kaname-api` → Domains                                                                                                              |
| STAGING_DATABASE_READ_URL | DB の変更の一覧（`app.schema_migrations`）を読む接続の文字列。**読むだけの役 `kaname_ci_read` の接続を入れる（管理者の接続を入れない）**。末尾に `sslmode=verify-full` を付ける（無ければ台本はつながずに止まる） | Supabase → プロジェクト `Kaname` → Connect → Session pooler の文字列の、ユーザー名を `kaname_ci_read.<ref>` に・合言葉を下で作った値に替える |
| STAGING_RESEND_READ_KEY   | 送ったメールの記録を読む鍵                                                                                                                                                                                        | Resend → API Keys で新しく作る（名前 `kaname-staging-ci-read`）                                                                              |

CI の VM は組ごとに捨てるので、台にファイルを置いて渡す形は使わない。

DB の束ね役（Session pooler）の証明書は Supabase の自前の認証局（Supabase Root 2021 CA）の物で、台の既定の信頼の元では確かめが通らない。信頼の元は `infra/certs/supabase-root-2021.crt`（公開の証明書・秘密ではない。出どころは Supabase の画面の Project Settings → Database → SSL Configuration →「Download certificate」と同じ `prod-ca-2021.crt`）で、健康診断の段が `NODE_EXTRA_CA_CERTS` で読む。sha256 の指紋は `80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`（`openssl x509 -noout -fingerprint -sha256 -in <ファイル>` で確かめる）。Supabase が認証局を替えたら（今の根の期限は 2031-04-26）、同じ手順で落とした物に差し替える。確かめは外さない。

### 読むだけの役を作る（Supabase・1 回だけ）

DB を読む台本は読むだけの取引の中で 1 文を投げるだけだが、それは台本の中の守りで、役の権限は守らない。secrets から漏れたときに DB の全部が漏れないよう、入れる接続そのものを読むだけの役にする。与える権限は、DB につなぐ・schema `app` を使う・表 `app.schema_migrations` を読む、の 3 つだけ。

合言葉は `openssl rand -hex 32` で作る（どこにも控えない）。Supabase → プロジェクト `Kaname` → SQL Editor → New query に下の文を貼り、**`ここに自分で作った値` の所だけ**を合言葉に置き換えて Run。流した後、その query は消す（文に合言葉が残る）。

```sql
create role kaname_ci_read login password 'ここに自分で作った値' nosuperuser nocreatedb nocreaterole noinherit connection limit 3;
alter role kaname_ci_read set default_transaction_read_only = on;
grant connect on database postgres to kaname_ci_read;
grant usage on schema app to kaname_ci_read;
grant select on table app.schema_migrations to kaname_ci_read;
```

確かめ（別の query で）：2 行目は数が出て、3 行目は「permission denied」で止まれば正しい（読めるのは 1 表だけ）。

```sql
set role kaname_ci_read;
select count(*) from app.schema_migrations;
select count(*) from public.tenants;
reset role;
```

## 3c. 秘密の取り替え（チャットやログに出た・出たかもしれないとき）

乱数は `openssl rand -hex 32`（記号が入らない形）。入れる所はどれも Vercel → `kaname-api` → Settings → Environment Variables → その名前の行 → Edit。値は控えない・貼らない。

1. DB の役の合言葉 2 つ：乱数を 2 つ作り `KANAME_APP_DB_PASSWORD`・`KANAME_AUTH_DB_PASSWORD` に入れる。`DATABASE_URL`・`AUTH_DATABASE_URL` の中の合言葉の所も同じ値に替える
2. DB の管理者の合言葉：Supabase → Project Settings → Database → Reset database password → `DATABASE_ADMIN_URL` の中の合言葉の所を替える
3. `AUTH_SECRET`：乱数を 1 つ作って入れる（ログイン中の人は入り直しになる）
4. 置き場の鍵：Supabase → Storage → Settings → S3 access keys → 新しく作って `STORAGE_ACCESS_KEY_ID`・`STORAGE_SECRET_ACCESS_KEY` に入れ、古い鍵の行を消す
5. Infisical の鍵：Access Control → Identities → `kaname-api-staging` → Universal Auth → Client Secrets → 新しく足して `INFISICAL_CLIENT_SECRET` に入れ、古い行を Revoke
6. `SECRETS_MASTER_KEY`：`openssl rand -base64 48` の値を入れる。そのまま替えてよい：前に預けた試しの資格情報は開けなくなり、メールの確認待ちの登録はやり直しになる（staging の試しのデータは消えてよい・D-140.3）。**本番では同じことをしない**（包み直しの手順が要る）
7. メールの鍵：Resend → API Keys → 新しく作って（Sending access）`RESEND_API_KEY` に入れ、古い鍵の行を消す
8. 配り直す：`kaname-api` → Deployments → いちばん上の Production の行 → Redeploy → Ready まで待つ
9. 確かめ：S5 の 1 の命令を流す。起動時の確かめが落ちていれば `STARTUP_FAILED` と落ちた確かめの名前が出る（手元の回は DB を見ないので、全部通って終わりの値 3）

## 4. 触らないもの

- 本番のデータと本番のプロジェクト（本番は L4 のスモークだけ）
- 本人のアカウント以外の外部サービスへの実操作
- 鍵の値をチャット・コミット・ログに出すこと（`.env` は git に入れない。CI は G13 が名前だけ突き合わせる）

## 5. 費用の目安（2026-09 時点の私の知識。実際の料金は各社の画面で確認）

段階 1 の staging：Supabase Free・Vercel Hobby（2 プロジェクト）・Infisical 無料枠・Resend 無料枠 → **0 円**。
Vercel Hobby の目安の枠（関数の呼び出し 月 100 万回 等）に収まるよう、Bridge の問い合わせは 1 台あたり月およそ 50 万回（動いていない間 5 秒ごと）に抑えてある（D-097.4）。
顧客に触らせる前：Vercel Pro 20 USD／月・Supabase Pro 25 USD／月（D-097.7）。
