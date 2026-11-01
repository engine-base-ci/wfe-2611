// バケットのプロビジョニング（冪等・G-11）。`pnpm provision:bucket`。設定は packages/config（X-002）から
import { loadConfig } from "@kaname/config";
import { ensureBucket, s3Client } from "@kaname/storage";

async function main(): Promise<void> {
  const c = loadConfig();
  const r = await ensureBucket(s3Client(c.storage), c.storage.bucket);
  console.log(`[provision bucket] ${c.storage.bucket} @ ${c.storage.endpoint}: ${r}`);
}
main().catch((e: unknown) => {
  console.error("[provision bucket] 失敗:", (e as Error).message);
  process.exit(1);
});
