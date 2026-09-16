# 外部リソースのコード化（T-F-16・G-11）

「ダッシュボードで作る前提」を無くす。作れるものはコードで、手動を許すものはここに明記する（architecture.json external_resources_as_code）。

| リソース                            | 作り方                                                                    | 起動時の存在確認                                     |
| ----------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------- |
| DB の表・拡張（pgvector／pgcrypto） | `pnpm db:migrate`（本番と同じ migration。G12 fresh-migrate）              | `Repository.init()` が表を確認・無ければ起動で落ちる |
| ストレージのバケット                | `pnpm provision:bucket`（S3 互換 API・冪等。`infra/provision/bucket.ts`） | `startupChecks` が HEAD で確認                       |
| 秘密（Infisical の環境とパス）      | staging／production の環境を作り、`.env.example` の名前を登録（手順は下） | `loadConfig` が必須の名前を確認・無ければ落ちる      |
| 環境変数                            | `.env.example` が正本                                                     | CI G13 `ci:env-audit`                                |
| Resend（送信ドメイン）              | ダッシュボードで DNS を検証（手動を許容）                                 | `RESEND_API_KEY` が無ければメールは送らず inapp だけ |
| DNS・証明書                         | 手動を許容。リリースチェックリスト（08_schedule）に明記                   | —                                                    |

## staging（selected-stack `environments.staging`：本番と同じ構成をもう 1 組）

手順の正本は [`infra/STAGING.md`](../STAGING.md)（S0 GitHub → S1 Supabase → S2 Infisical → S3 Railway → S4 Resend → S5 Vercel → S6 確認・秘密の名前の表・誰がやるか）。先に直すコード側の前提（API の起動口と Dockerfile・認証の schema 名・役割のパスワード）は T-F-18。
