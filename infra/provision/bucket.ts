// バケットのプロビジョニング（冪等・G-11）。`pnpm provision:bucket`。設定は packages/config（X-002）から
//   K-133：置き場の中身は全部非公開。作った後に、在る物で非公開を確かめ、公開・確かめられない・配布物の頭が置き場の下に無い、は失敗で止まる
import { loadConfig } from "@kaname/config";
import { provisionBucket, s3Client, s3Presigner } from "@kaname/storage";

async function main(): Promise<void> {
  const c = loadConfig();
  const client = s3Client(c.storage);
  const code = await provisionBucket({
    client,
    presigner: s3Presigner(client, c.storage.endpoint),
    endpoint: c.storage.endpoint,
    bucket: c.storage.bucket,
    releaseBase: c.bridgeReleaseBase ?? "",
    log: (s) => console.log(s),
  });
  process.exit(code);
}
main().catch((e: unknown) => {
  console.error("[provision bucket] 失敗:", (e as Error).message);
  process.exit(1);
});
